# Serving branch kernel verification

Pikafish jieqi, 256-wide independently trained NNUE, with the Patch B rule port.

- Kernel agreement: 53/53 cases.
- Rule/UCI verification: 53 cases, 161 probes, 54 searches, 0 failures.
- Public chase targets: 567 boards, 1134 actor comparisons, 0 failures.

`Jieqi Rule` remains `legacy` by default: 120 no-capture plies and threefold draws. The site will select `jqe-v1` (80 plies; unilateral perpetual check/chase loses) after its own rules match.

Expected outcomes were replayed against the local read-only site kernel. Two fixtures intentionally exercise the strictly in-tree twofold draw shortcut; the kernel remains ongoing in those cases. Mate/stalemate is checked with actual root searches.

The current NNUE API owns options and the root position in Engine, so this port changes `engine.cpp`/`engine.h` where the older patch changed `ucioption.cpp`. The existing `rule40` field carries the no-capture clock; a separate irreversible-window counter prevents repetition scans crossing reveals. TT keys and prefetch use the exact clock and selected rule.

Historical Patch B before/match/performance evidence is retained as described in README.md. No strength matches were run for this NNUE port. See the untracked root codex-serve-report.md for commit hashes, native benchmarks, browser artifacts and verification limits.

| Case | Expected search outcome | Actual |
| --- | --- | --- |
| quiet-twofold/legacy | ongoing | ongoing |
| quiet-twofold/jqe-v1 | ongoing | ongoing |
| quiet-threefold/legacy | draw | draw |
| quiet-threefold/jqe-v1 | draw | draw |
| check-twofold/legacy | ongoing | ongoing |
| check-twofold/jqe-v1 | ongoing | ongoing |
| check-threefold/legacy | draw | draw |
| check-threefold/jqe-v1 | win | win |
| chase-twofold/legacy | ongoing | ongoing |
| chase-twofold/jqe-v1 | ongoing | ongoing |
| chase-threefold/legacy | draw | draw |
| chase-threefold/jqe-v1 | loss | loss |
| unequal-mixed-check/legacy | draw | draw |
| unequal-mixed-check/jqe-v1 | draw | draw |
| mixed-check-chase/legacy | draw | draw |
| mixed-check-chase/jqe-v1 | draw | draw |
| swap-identical-pieces/legacy | draw | draw |
| swap-identical-pieces/jqe-v1 | draw | draw |
| clock-79/legacy | ongoing | ongoing |
| clock-79/jqe-v1 | ongoing | ongoing |
| clock-80/legacy | ongoing | ongoing |
| clock-80/jqe-v1 | draw | draw |
| clock-119/legacy | ongoing | ongoing |
| clock-119/jqe-v1 | draw | draw |
| clock-120/legacy | draw | draw |
| clock-120/jqe-v1 | draw | draw |
| check-precedes-clock-80/legacy | draw | draw |
| check-precedes-clock-80/jqe-v1 | win | win |
| capture-resets-clock/legacy | ongoing | ongoing |
| capture-resets-clock/jqe-v1 | ongoing | ongoing |
| soldier-does-not-reset-clock/legacy | ongoing | ongoing |
| soldier-does-not-reset-clock/jqe-v1 | draw | draw |
| reveal-does-not-reset-clock/legacy | ongoing | ongoing |
| reveal-does-not-reset-clock/jqe-v1 | draw | draw |
| tree-twofold-prune/legacy | draw | draw |
| tree-twofold-prune/jqe-v1 | draw | draw |
| root-boundary-twofold/legacy | ongoing | ongoing |
| root-boundary-twofold/jqe-v1 | ongoing | ongoing |
| quiet-unequal-length/legacy | draw | draw |
| quiet-unequal-length/jqe-v1 | draw | draw |
| mate-before-clock/legacy | loss | loss |
| mate-before-clock/jqe-v1 | loss | loss |
| stalemate-before-clock/legacy | loss | loss |
| stalemate-before-clock/jqe-v1 | loss | loss |
| mixed-new-chase-and-check/legacy | draw | draw |
| mixed-new-chase-and-check/jqe-v1 | draw | draw |
| check-twofold-at-clock-80/legacy | ongoing | ongoing |
| check-twofold-at-clock-80/jqe-v1 | draw | draw |
| chase-twofold-at-clock-80/legacy | ongoing | ongoing |
| chase-twofold-at-clock-80/jqe-v1 | draw | draw |
| chase-threefold-at-clock-80/legacy | draw | draw |
| chase-threefold-at-clock-80/jqe-v1 | loss | loss |
| legacy-check-at-clock-120/legacy | draw | draw |
