# Jieqi kernel fixtures for the 256-wide serving branch

These fixtures and chase geometry were ported from Patch B. The UCI combo
`Jieqi Rule` defaults to `legacy` (threefold cycles draw, 120 no-capture plies).
`jqe-v1` selects unilateral perpetual check/chase losses and an 80-ply clock.
The site will set `jqe-v1` after its separate rules match. Set the option while
idle, before `position` and `go`; switching rules clears the search state/TT.

## Native verification

From this engine worktree (Python 3, C++17, Node.js):

```sh
make -C src -j4 build ARCH=apple-silicon COMP=clang
node tools/kernel-fixtures/compare.mjs src/pikafish tools/kernel-fixtures/after.json
node tools/kernel-fixtures/compare.mjs src/pikafish tools/kernel-fixtures/extra-after.json extra-kernel.json
node tools/kernel-fixtures/verify.mjs src/pikafish
mkdir -p tools/kernel-fixtures/.build
clang++ -std=c++17 -O2 -Isrc tools/kernel-fixtures/chase-probe.cpp -o tools/kernel-fixtures/.build/chase-probe
```

Use the appropriate native `ARCH`/`COMP` elsewhere. Before CPU-heavy work, check
shared-machine capacity according to the operator's instructions.

To regenerate kernel expectations and compare public chase targets, set
`MISTBOARD_CHECKOUT` to a local read-only site checkout and use its installed tsx
loader. All output is written in this engine worktree:

```sh
export MISTBOARD_CHECKOUT=/absolute/path/to/site-checkout
node --import "$MISTBOARD_CHECKOUT/node_modules/tsx/dist/loader.mjs" tools/kernel-fixtures/kernel.mts record
node --import "$MISTBOARD_CHECKOUT/node_modules/tsx/dist/loader.mjs" tools/kernel-fixtures/kernel.mts record extra-cycles.json extra-kernel.json
node --import "$MISTBOARD_CHECKOUT/node_modules/tsx/dist/loader.mjs" tools/kernel-fixtures/chase-compare.mts "$PWD/tools/kernel-fixtures/.build/chase-probe"
python3 tools/kernel-fixtures/summarize.py
```

`ruleprobe [search-ply]` waits for idle and reports a verdict relative to the side
to move plus its FEN. It is a repetition/clock probe, not a general mate detector.
`verify.mjs` also checks real searches, terminal score signs, FEN/clock round trips,
warm clock-specific TT entries, and shared root history after two searches with
two threads. A twofold draw shortcut is allowed only at `distance < searchPly`.
Captures reset both windows; reveals reset the repetition window only. Soldier
moves reset neither. The full three-occurrence interval determines perpetuals.

## Evidence provenance

`kernel.json`, `extra-kernel.json`, `after.json`, `extra-after.json`,
`verification.json`, and `chase-check.json` are refreshed for this serving branch;
see [REPORT.md](REPORT.md). `compare.mjs` exits unsuccessfully on mismatches.

`BEFORE.md`, `before.json`, `extra-before.json`, `node-comparison.json`,
`selfplay.json`, and `selfplay-final.json` are retained historical Patch B evidence
from its earlier branch. They are not validation or strength results for this
NNUE build. The historical match/performance runners are retained for provenance;
no strength matches were run for this port. `prepare-baseline.py` now extracts the
pre-rules serving commit and adds only a read-only probe for optional comparisons.
