# Jieqi chance-node verification

Branch: `agent/jieqi-chance-nodes`; unmodified baseline: `9b963f72`.
No push. The baseline sources and binary are in the ignored `.baseline/` directory;
`.baseline/` is in the shared repository's `.git/info/exclude`.

## Implementation

1. Open-window PV probes search every identity at `max(0, depth - 6)`; the most numerous identity is then searched at full depth and replaces its probe, weighted by reserve counts in the existing sigmoid scale (`360.83524`).
2. The full-depth identity's window is mapped through the other identities' fixed contributions, following jqe's `cvValue` with `rho=0`. Its sole bound is a valid bound on the approximation. Decisive probes/windows keep the deep search open so mate distances remain meaningful.
3. Only unanimous winning identities return the slowest win, and only unanimous losing identities return the longest loss. Mixed outcomes use exact winrates 1/0 for mating/mated identities and return a non-mate expectation.

`ChanceMix` is a UCI check option, default `true`. Set it to `false` for the
original method, including its original mate behavior. A single remaining identity
uses ordinary search without averaging or an extra probe.

At depth <= 0, probes use **quiescence, not static evaluation**. A flip at qsearch
entry averages open-window qsearch values and has no extra full-depth pass. As in
jqe, subsequent flips at `qply >= 2` (jqe parent `qply >= 1`) search one representative whose material
value is closest to the count-weighted urn mean. Because that is a sampled
approximation, its result is clamped to the non-mate range when multiple identities
remain. Qsearch ply is propagated through single-identity flips as well.

Source read: local `jqe-331a6e61/engine/src/search.cpp`, its `ChanceMix`/`cvValue`
implementation, and `REPORT.md` “Chance nodes” (MIT). The classical engine's
`bcc83f88` and `4f857757` were read for context; their root-only re-search and
forced-loss override were not used.

Production files: `src/search.cpp`, `src/search.h`, `src/engine.cpp`.
Verification drivers: `tests/chance_nodes.py`, `tests/chance_nodes_unit.cpp`,
`tests/chance_nodes_unit.py`, `tests/chance_nodes_match_stats.py`.

## Build and network

Both release builds used `make -C <src> -j8 all ARCH=apple-silicon COMP=clang`.
The supplied network has the correct architecture/header but is raw NNUE;
`read_compressed_nnue` requires a zstd frame. Copying it directly causes both
baseline and fixed to reject it at the first search. The loadable local copies
contain a lossless zstd wrapper around exactly the supplied weights:

- Raw: 16,229,159 bytes; SHA256 `3b7fe3801d9ad2026967716431b89e85e856367233a42f97d1a10db086f2289c`.
- Wrapped: 10,564,746 bytes; SHA256 `75125bf89d5f1ad60051a1283a9becb481e52f1c2a1f5ff94275e2248e3f091c`.

Neither the network nor either binary is committed. See [net.json](net.json) and
[bench.summary.json](bench.summary.json) for network/binary hashes.

## 1. Mixed mates

All 30 positions / 75 dark root moves were checked. Each move is searched alone
with `go depth D searchmoves <move>`. Each possible revealed identity is then
constructed as an independent child FEN and searched at `D-1`, using the fixed
engine as the common reference. Searches use 1 thread, 16 MiB hash, and clear hash
and histories between searches.

| Root depth | Baseline mate reports | Fixed mate reports | Baseline false mates | Fixed false mates |
|---|---:|---:|---:|---:|
| 8 | 39 | 24 | 0 / 75 | 0 / 75 |
| 12, with disputed children confirmed at depth 16 | 40 | 36 | 0 / 75 | 0 / 75 |

At depth 12, both builds initially disagree with the depth-11 child search on
`M19 c9e7`: both report `mate -6`, while the child reports `cp 552`. There is
**only one possible identity**, a cannon. Child searches at depths 12 and 13
report `cp 690` and `cp 687`; depths 14 and 16 confirm `mate 6`. The final depth-12
records retain the initial child score and the deeper confirmation separately.
This is a selective-search horizon difference, not a mixed-identity mate.

**Limit:** this corpus and network did not reproduce the baseline mixed-mate bug.
At these depths none of the reference identity sets contains mates of opposite signs. The requested failing baseline corpus case therefore could not be demonstrated.
The isolated regression compiles the actual `flip_search` body with scripted
identity searches: one winning identity plus three losing identities incorrectly
returns mate in the baseline and a finite weighted expectation in the fixed code.
The baseline also fails the opposite fail-high/fail-low null-window regression:
**7 checks, 2 failures**. Fixed passes **221 checks, 0 failures**, including
200 mapped-window bound cases, mate signs/distances, count weighting, probe/deep
depths and node types, qsearch limits, interruption, and state/PV restoration.
See [unit-baseline.log](unit-baseline.log), [unit-fixed.log](unit-fixed.log),
[depth8.jsonl](depth8.jsonl), and [depth12.jsonl](depth12.jsonl).

## 2. Clamping / reference error

All 30 midgame positions / 147 dark root moves were checked at each depth. The
reference searches every independently revealed identity at the full remaining
depth (`D-1`) with its own unrestricted root search, then averages by identity
counts using the engine's existing sigmoid. It uses the fixed engine for
subsequent reveals too. This isolates the root reveal approximation, not every
change in selective search below it.

UCI cp is nonlinear and depends on ply, so the driver first inverts this branch's
`to_cp` display mapping before applying the chance sigmoid. Reference expectations
therefore have integer-UCI rounding precision, not raw internal-score precision.
Mate values contribute exactly 0/1. Winrate MAE covers **all 147 moves**. Cp MAE
covers **146 finite comparisons**: one reference is a unanimous mate and has no
finite cp value. The opponent's reserve after capturing a dark piece is left
unchanged, matching this branch's `Position::do_move` behavior.

| Root / child depth | Metric | Baseline | Fixed |
|---|---|---:|---:|
| 8 / 7 | Winrate MAE | 0.0454136051 | 0.0484042284 |
| 8 / 7 | Winrate bias | -0.0223460324 | +0.0050265708 |
| 8 / 7 | Cp MAE (146) | 35.6155215 | 29.5496785 |
| 12 / 11 | Winrate MAE | 0.0351897665 | 0.0278302900 |
| 12 / 11 | Winrate bias | -0.0122715981 | +0.0059858191 |
| 12 / 11 | Cp MAE (146) | 27.8141208 | 17.9084876 |

Midgame mate reports: depth 8 baseline 1, fixed 0; depth 12 baseline 1, fixed 1.
No false mate reports in either midgame run.

Supplementary mate-corpus reference errors (75 moves):

| Root depth | Metric | Baseline | Fixed |
|---|---|---:|---:|
| 8 | Winrate MAE | 0.0091130513 | 0.0425351203 |
| 8 | Winrate bias | -0.0086169589 | +0.0365487522 |
| 8 | Cp MAE (36 finite comparisons) | 69.3549857 | 67.5944542 |
| 12 | Winrate MAE | 0.0108379259 | 0.0086167437 |
| 12 | Winrate bias | -0.0102075307 | +0.0024357583 |
| 12 | Cp MAE (35 finite comparisons) | 95.3305013 | 40.7131364 |

Reduced probes can miss mates; the lower mate-report count and worse winrate MAE at
depth 8 are measured tradeoffs. This method is an approximation, not an exhaustive chance-tree
solution. Full records: [depth8.jsonl](depth8.jsonl),
[depth12.jsonl](depth12.jsonl).

## 3. Bench

Default `bench`, 1 thread, run sequentially on the same Mac:

| Method | Nodes | Time (ms) | NPS |
|---|---:|---:|---:|
| Unmodified baseline | 219,085 | 390 | 561,756 |
| Fixed / `ChanceMix=true` | 672,359 | 894 | 752,079 |
| Same fixed binary / `ChanceMix=false` | 219,085 | 387 | 566,111 |

The old option reproduces the baseline node count exactly. The new method uses
3.0689x the nodes and 2.2923x the measured bench time. NPS is sensitive to shared
Mac load; the node counts are deterministic. Raw transcripts and exact executable
hashes are alongside this report.

## 4. Match

Fixed: **70 wins, 79 losses, 51 draws / 200 games**. Score **47.75%**; Elo **-15.65**, 95% interval **[-57.77, +26.02]**. The interval includes zero; this match does not establish a strength gain.

Score standard error: 0.03055136; 95% score interval [0.41762043, 0.53737957]. The 200 games finished in 1,516 seconds. See [match.log](match.log) and [match.summary.json](match.summary.json).

Settings: supplied net above for both builds; referee `h2h_ab.py`; 200 games;
100 ms/move; 1 thread per engine; default 256 MiB hash per engine; seeds 1000–1199;
fixed plays red on even-numbered games, black on odd-numbered games; default
400-ply maximum; no ponder. Only this final run is used for the reported result.
The referee uses full FENs and resolves actual reveals from the seeded reserve.

The 95% interval is an approximate normal score interval using the unbiased
sample variance of the trinomial outcomes (win=1, loss=0, draw=.5), transformed
through `400*log10(p/(1-p))`. It is a single 200-game estimate.

## Rerun

```sh
# The raw supplied net needs a zstd wrapper for this branch's loader:
zstd -q -f /path/to/jieqi-rung2-wd1e-02.nnue -o src/pikafish.nnue
cp src/pikafish.nnue .baseline/src/pikafish.nnue
make -C src -j8 all ARCH=apple-silicon COMP=clang
make -C .baseline/src -j8 all ARCH=apple-silicon COMP=clang

python3 tests/chance_nodes_unit.py
# Expected exit 1 with 2 regression failures:
python3 tests/chance_nodes_unit.py --source .baseline/src/search.cpp --baseline

python3 tests/chance_nodes.py --baseline .baseline/src/pikafish --fixed src/pikafish \
  --corpus-dir /Users/brianliou/projects/mistboard-engine/lab/jieqi-darkmove-2026-08-31 \
  --depth 8 --output tests/chance_nodes_results/depth8.jsonl
python3 tests/chance_nodes.py --baseline .baseline/src/pikafish --fixed src/pikafish \
  --corpus-dir /Users/brianliou/projects/mistboard-engine/lab/jieqi-darkmove-2026-08-31 \
  --depth 12 --mate-confirmation-depth 16 --output tests/chance_nodes_results/depth12.jsonl

MISTBOARD_PIKAFISH_NET="$PWD/src/pikafish.nnue" \
  /Users/brianliou/projects/tools/nnue-pytorch/.venv/bin/python \
  /Users/brianliou/projects/tools/nnue-pytorch/fow_chess/jieqi/h2h_ab.py \
  --a "$PWD/src/pikafish" --b "$PWD/.baseline/src/pikafish" \
  --games 200 --movetime 100 > tests/chance_nodes_results/match.log
python3 tests/chance_nodes_match_stats.py tests/chance_nodes_results/match.log \
  > tests/chance_nodes_results/match.summary.json
```
