# Kernel comparison before engine changes

Recorded against Mistboard kernel at `125f37a52` and engine `bcc83f88`.
Baseline source is unchanged except a read-only `ruleprobe` command calling `Position::is_repeated`.
Every row replays the recorded FEN and moves from `kernel.json`; results are relative to the side to move.

| Case | Kernel | bcc83f88 |
|---|---|---|
| quiet-twofold/legacy | ongoing | draw |
| quiet-twofold/jqe-v1 | ongoing | draw |
| quiet-threefold/legacy | draw | draw |
| quiet-threefold/jqe-v1 | draw | draw |
| check-twofold/legacy | ongoing | win |
| check-twofold/jqe-v1 | ongoing | win |
| check-threefold/legacy | draw | win |
| check-threefold/jqe-v1 | win | win |
| chase-twofold/legacy | ongoing | loss |
| chase-twofold/jqe-v1 | ongoing | loss |
| chase-threefold/legacy | draw | loss |
| chase-threefold/jqe-v1 | loss | loss |
| unequal-mixed-check/legacy | draw | loss |
| unequal-mixed-check/jqe-v1 | draw | loss |
| mixed-check-chase/legacy | draw | loss |
| mixed-check-chase/jqe-v1 | draw | loss |
| swap-identical-pieces/legacy | draw | draw |
| swap-identical-pieces/jqe-v1 | draw | draw |
| clock-79/legacy | ongoing | ongoing |
| clock-79/jqe-v1 | ongoing | ongoing |
| clock-80/legacy | ongoing | ongoing |
| clock-80/jqe-v1 | draw | ongoing |
| clock-119/legacy | ongoing | ongoing |
| clock-119/jqe-v1 | draw | ongoing |
| clock-120/legacy | draw | ongoing |
| clock-120/jqe-v1 | draw | ongoing |
| check-precedes-clock-80/legacy | draw | win |
| check-precedes-clock-80/jqe-v1 | win | win |
| capture-resets-clock/legacy | ongoing | ongoing |
| capture-resets-clock/jqe-v1 | ongoing | ongoing |
| soldier-does-not-reset-clock/legacy | ongoing | ongoing |
| soldier-does-not-reset-clock/jqe-v1 | draw | ongoing |
| reveal-does-not-reset-clock/legacy | ongoing | ongoing |
| reveal-does-not-reset-clock/jqe-v1 | draw | ongoing |
| tree-twofold-prune/legacy | ongoing | draw |
| tree-twofold-prune/jqe-v1 | ongoing | draw |
| root-boundary-twofold/legacy | ongoing | draw |
| root-boundary-twofold/jqe-v1 | ongoing | draw |

17/38 agree (including the permitted in-tree second-occurrence draw).
`tree-twofold-prune` uses search ply 5 for an interval of 4: the earlier position is strictly inside the tree.
`root-boundary-twofold` uses ply 4: the earlier occurrence is the root and is insufficient.
These search-pruning rows have an ongoing kernel state; only the first deliberately accepts an engine draw.

The corpus covers quiet/check/chase twofold and threefold cycles, unequal intervals, mixed checks/chases, physical piece swaps, clocks 79/80/119/120, capture and soldier/reveal clock behavior.
