"""Summarize fresh serving-branch fixture evidence without historical matches."""
import json
from pathlib import Path
here = Path(__file__).resolve().parent
read = lambda name: json.loads((here / name).read_text())
results = [r for name in ('after.json', 'extra-after.json') for r in read(name)['results']]
v = read('verification.json')
c = read('chase-check.json')
lines = [
    '# Serving branch kernel verification', '',
    'Pikafish jieqi, 256-wide independently trained NNUE, with the Patch B rule port.', '',
    f"- Kernel agreement: {sum(r['agree'] for r in results)}/{len(results)} cases.",
    f"- Rule/UCI verification: {v['cases']} cases, {v['probes']} probes, {v['searches']} searches, {v['failures']} failures.",
    f"- Public chase targets: {c['boards']} boards, {c['actors']} actor comparisons, {c['failures']} failures.", '',
    '`Jieqi Rule` remains `legacy` by default: 120 no-capture plies and threefold draws. '
    'The site will select `jqe-v1` (80 plies; unilateral perpetual check/chase loses) after its own rules match.', '',
    'Expected outcomes were replayed against the local read-only site kernel. '
    'Two fixtures intentionally exercise the strictly in-tree twofold draw shortcut; '
    'the kernel remains ongoing in those cases. Mate/stalemate is checked with actual root searches.', '',
    'The current NNUE API owns options and the root position in Engine, so this port changes '
    '`engine.cpp`/`engine.h` where the older patch changed `ucioption.cpp`. '
    'The existing `rule40` field carries the no-capture clock; a separate irreversible-window counter '
    'prevents repetition scans crossing reveals. TT keys and prefetch use the exact clock and selected rule.', '',
    'Historical Patch B before/match/performance evidence is retained as described in README.md. '
    'No strength matches were run for this NNUE port. See the untracked root codex-serve-report.md '
    'for commit hashes, native benchmarks, browser artifacts and verification limits.', '',
    '| Case | Expected search outcome | Actual |', '| --- | --- | --- |',
]
for r in results:
    lines.append(f"| {r['id']} | {r['searchExpected']} | {r['actual']} |")
(here / 'REPORT.md').write_text('\n'.join(lines) + '\n')
