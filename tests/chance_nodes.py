#!/usr/bin/env python3
"""Compare reveal scores with independently searched, open-window identities.

Example (run from the repository):
  python3 tests/chance_nodes.py --baseline .baseline/src/pikafish \
    --fixed src/pikafish --corpus-dir /path/to/jieqi-darkmove-2026-08-31 \
    --depth 8 --output tests/chance_nodes_results/depth8.jsonl

Only dark root moves are measured. Each search clears hash and histories. The
common reference uses the fixed engine, one revealed child FEN per identity,
searched unrestricted at depth_root - 1. Opponent dark-capture reserves are left
unchanged, matching this NNUE branch's do_move (no capture-identity expansion).
UCI cp uses a nonlinear, ply-dependent display scale: invert it before applying
flip_search's sigmoid (360.83524), then convert the expectation back for cp MAE.
The inversion has only UCI integer rounding precision; raw scores are retained.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import queue
import re
import subprocess
import threading
import time

SCALE = 360.83524
# src/uci.cpp win_rate_params; NOT the chance-node sigmoid.
PARAMS = [(9, .00064066, -.05207866), (19, .00091732, -.07495616),
          (29, .00125966, -.09838683), (39, .00162431, -.13737944),
          (49, .00196824, -.19680290), (59, .00235683, -.29232929),
          (69, .00277996, -.42024359), (79, .00324104, -.58686233),
          (100, .00394702, -.90882361), (120, .00426714, -1.24856114),
          (100000, .00353587, -1.81372732)]


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


def display_cp(value, ply):
    _, a, b = next(p for p in PARAMS if ply <= p[0])
    delta = sigmoid(a * value + b) - sigmoid(-a * value + b)
    if abs(delta) >= 1:
        return math.copysign(math.inf, delta)
    return 400 * math.log10((1 + delta) / (1 - delta))


def internal_cp(cp, ply):
    # C++ truncates (continuous_cp + .5) towards zero, including negatives.
    target = cp if cp >= 0 else cp - 1
    lo, hi = -15000., 15000.
    for _ in range(48):
        mid = (lo + hi) / 2
        if display_cp(mid, ply) < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def winrate(score, ply, negate=False):
    sign = -1 if negate else 1
    if score['kind'] == 'mate':
        # A negative zero can represent a side already mated.
        return float(sign * (-1 if score['negative'] else 1) > 0)
    return sigmoid(sign * internal_cp(score['value'], ply) / SCALE)


def mate_sign(children, key='score'):
    signs = {(-1 if c[key]['negative'] else 1) * -1
             if c[key]['kind'] == 'mate' else 0 for c in children}
    return next(iter(signs)) if len(signs) == 1 else 0


class Engine:
    def __init__(self, binary, option=None, net=None, timeout=180):
        self.binary = str(Path(binary).resolve())
        self.timeout = timeout
        self.proc = subprocess.Popen([self.binary], stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                     text=True, bufsize=1, cwd=str(Path(self.binary).parent))
        self.lines = queue.Queue()
        def reader():
            for line in self.proc.stdout:
                self.lines.put(line.rstrip())
            self.lines.put(None)
        self.reader = threading.Thread(target=reader, daemon=True)
        self.reader.start()
        self.send('uci')
        self.wait('uciok')
        self.send('setoption name Threads value 1')
        self.send('setoption name Hash value 16')
        if net:
            self.send(f'setoption name EvalFile value {Path(net).resolve()}')
        if option is not None:
            self.send(f'setoption name ChanceMix value {str(option).lower()}')
        self.send('isready')
        self.wait('readyok')

    def send(self, command):
        self.proc.stdin.write(command + '\n')
        self.proc.stdin.flush()

    def wait(self, token):
        output = []
        deadline = time.monotonic() + self.timeout
        while True:
            line = self.lines.get(timeout=max(.01, deadline - time.monotonic()))
            if line is None:
                raise RuntimeError(f'{self.binary} closed: {output[-10:]}')
            output.append(line)
            if line.startswith(token):
                return output

    def search(self, fen, depth, move=None):
        self.send('ucinewgame')
        self.send('setoption name Clear Hash')
        self.send('isready')
        self.wait('readyok')
        self.send('position fen ' + fen)
        self.send(f'go depth {depth}' + (f' searchmoves {move}' if move else ''))
        lines = self.wait('bestmove')
        scored = [line for line in lines if re.search(r'score (cp|mate) -?\d+', line)]
        if not scored:
            raise RuntimeError(f'no score for {fen}: {lines[-10:]}')
        last = scored[-1]
        kind, raw = re.search(r'score (cp|mate) (-?\d+)', last).groups()
        dp = re.search(r'\bdepth (\d+)', last)
        nodes = re.search(r'\bnodes (\d+)', last)
        # UCI mate 0 is an already mated side, even when the minus is lost.
        return dict(kind=kind, value=int(raw),
                    negative=raw.startswith('-') or (kind == 'mate' and int(raw) == 0),
                    depth=int(dp[1]) if dp else 0, nodes=int(nodes[1]) if nodes else 0,
                    info=last, bestmove=lines[-1])

    def close(self):
        if self.proc.poll() is None:
            self.send('quit')
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()
        self.reader.join(timeout=1)


def child_fens(fen, move):
    board, stm, pool, clock, number = fen.split()
    rows = []
    for rank in board.split('/'):
        row = []
        for char in rank:
            row.extend(['1'] * int(char) if char.isdigit() else [char])
        assert len(row) == 9
        rows.append(row)
    def square(s):
        return 9 - int(s[1]), ord(s[0]) - ord('a')
    fr, ff = square(move[:2]); tr, tf = square(move[2:4])
    assert rows[fr][ff] == ('X' if stm == 'w' else 'x')
    captured = rows[tr][tf] != '1'
    reserve = dict((pc, int(count)) for pc, count in re.findall(r'([a-zA-Z])(\d+)', pool))
    for pc, count in reserve.items():
        if not count or pc.isupper() != (stm == 'w'):
            continue
        newrows = [r.copy() for r in rows]
        newrows[fr][ff] = '1'; newrows[tr][tf] = pc
        encoded = []
        for row in newrows:
            text = ''.join(row)
            encoded.append(re.sub(r'1+', lambda m: str(len(m[0])), text))
        rest = ''.join(p + str(n - (p == pc)) for p, n in reserve.items())
        child = f'{"/".join(encoded)} {"b" if stm == "w" else "w"} {rest} '
        child += f'{0 if captured else int(clock)+1} {int(number)+(stm == "b")}'
        yield pc, count, child


def summarize(records):
    result = {}
    for corpus in sorted({r['corpus'] for r in records}):
        rows = [r for r in records if r['corpus'] == corpus]
        result[corpus] = {'moves': len(rows)}
        for method in ('baseline', 'fixed'):
            false_mates = []
            errors = []; cp_errors = []; bias = []
            reported = 0
            horizon_disagreements = 0
            for r in rows:
                score = r[method]
                wr = winrate(score, r['ply'])
                errors.append(abs(wr - r['reference_winrate']))
                bias.append(wr - r['reference_winrate'])
                if score['kind'] == 'cp' and r['reference_cp'] is not None:
                    cp_errors.append(abs(score['value'] - r['reference_cp']))
                if score['kind'] == 'mate':
                    reported += 1
                    sign = -1 if score['negative'] else 1
                    horizon_disagreements += r['reference_mate_sign'] != sign
                    if r.get('confirmed_mate_sign', r['reference_mate_sign']) != sign:
                        false_mates.append([r['position'], r['move'], score['value']])
            result[corpus][method] = dict(reported_mates=reported, false_mates=len(false_mates),
                false_mate_moves=false_mates, winrate_mae=sum(errors)/len(errors),
                reference_horizon_mate_disagreements=horizon_disagreements,
                winrate_bias=sum(bias)/len(bias),
                cp_mae=sum(cp_errors)/len(cp_errors) if cp_errors else None,
                cp_comparisons=len(cp_errors))
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--baseline', required=True)
    ap.add_argument('--fixed', required=True)
    ap.add_argument('--corpus-dir', type=Path, required=True)
    ap.add_argument('--depth', type=int, default=8)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--corpora', nargs='+', default=['corpus_mate.json', 'corpus.json'])
    ap.add_argument('--limit', type=int)
    ap.add_argument('--old-option', action='store_true', help='Use ChanceMix=false in --baseline binary')
    ap.add_argument('--net', type=Path, help='Compatible zstd-wrapped NNUE file for all engines')
    ap.add_argument('--mate-confirmation-depth', type=int, default=0,
                    help='Recheck mate/reference disagreements at this child depth; retain original MAE reference')
    args = ap.parse_args()
    assert args.depth >= 2
    args.output.parent.mkdir(parents=True, exist_ok=True)
    manifest = dict(_manifest=True, depth=args.depth, child_depth=args.depth-1,
        baseline=str(Path(args.baseline).resolve()), fixed=str(Path(args.fixed).resolve()),
        hashes={n: hashlib.sha256(Path(p).read_bytes()).hexdigest()
                for n, p in [('baseline', args.baseline), ('fixed', args.fixed)]},
        threads=1, hash_mb=16, reference='fixed engine, independent revealed child FENs',
        uci_rounding='inverse display cp; integer UCI precision', started=time.strftime('%FT%TZ',time.gmtime()))
    manifest['mate_confirmation_depth'] = args.mate_confirmation_depth
    net = args.net or Path(args.fixed).resolve().parent / 'pikafish.nnue'
    manifest['net_sha256'] = hashlib.sha256(net.read_bytes()).hexdigest()
    engines = [Engine(args.baseline, False if args.old_option else None, net), Engine(args.fixed, net=net)]
    reference = Engine(args.fixed, net=net)
    records = []
    try:
        with args.output.open('w', buffering=1) as out:
            out.write(json.dumps(manifest)+'\n')
            for name in args.corpora:
                corpus = json.loads((args.corpus_dir/name).read_text())
                for position in corpus['positions'][:args.limit]:
                    fen = position['fen']
                    fields = fen.split()
                    ply = 2 * (int(fields[4])-1) + (fields[1] == 'b')
                    for move in position['moves']:
                        if not move['dark']:
                            continue
                        rec = dict(corpus=name, position=position['id'], fen=fen, ply=ply, move=move['uci'])
                        for method, engine in zip(('baseline','fixed'), engines):
                            rec[method] = engine.search(fen, args.depth, move['uci'])
                        children = []
                        for piece, count, child in child_fens(fen, move['uci']):
                            score = reference.search(child, args.depth-1)
                            children.append(dict(piece=piece, count=count, fen=child, score=score,
                                                 winrate=winrate(score, ply+1, negate=True)))
                        rec['identities'] = children
                        total = sum(c['count'] for c in children)
                        wr = sum(c['count'] * c['winrate'] for c in children) / total
                        rec['reference_winrate'] = wr
                        rec['reference_mate_sign'] = mate_sign(children)
                        root_mate_signs = {(-1 if rec[m]['negative'] else 1)
                                           for m in ('baseline', 'fixed') if rec[m]['kind'] == 'mate'}
                        if (args.mate_confirmation_depth and root_mate_signs
                                and root_mate_signs != {rec['reference_mate_sign']}):
                            for c in children:
                                c['confirmation_score'] = reference.search(c['fen'], args.mate_confirmation_depth)
                            rec['confirmed_mate_sign'] = mate_sign(children, 'confirmation_score')
                        rec['reference_cp'] = (display_cp(SCALE*math.log(wr/(1-wr)), ply)
                                               if 0 < wr < 1 else None)
                        records.append(rec)
                        out.write(json.dumps(rec)+'\n')
                    print(f'{name} {position["id"]}: {len(records)} moves complete', flush=True)
    finally:
        for engine in engines+[reference]:
            engine.close()
    summary = summarize(records)
    args.output.with_suffix('.summary.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
