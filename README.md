# PikaJieQi, the Mistboard build

The jieqi (揭棋, xiangqi with face-down pieces) engine behind the bot and the
analysis board on [mistboard.com](https://mistboard.com/rules/jieqi). It is
[Pikafish](https://github.com/official-pikafish/Pikafish)'s `jieqi_old` branch,
pinned at a known commit, with two engine fixes and a browser build on top.
Classical hand-written evaluation, no neural network.

The upstream branch has not moved since August 2025 and its maintainers say
non-master branches are unsupported, so this repository is a pinned snapshot
rather than a moving fork. Every upstream branch is mirrored here untouched.

## Branches

- `jieqi_old-mistboard`: this branch. Upstream `jieqi_old` at `23b9466c` plus
  the three commits below. Mistboard's production image builds the commit named
  in its [`pikafish-jieqi.ref`](https://github.com/brianhliou/mistboard/blob/main/pikafish-jieqi.ref);
  the analysis board runs the same commit compiled to WebAssembly.
- Everything else (`master`, `jieqi`, `jieqi_old`, `wasm`, …) is upstream as is.

## What differs from upstream

1. **`ScoreCalc` no longer averages a forced loss away at flip nodes**
   (`src/misc.h`). A mate behind a dark-piece move was clamped to
   ±`DARKVALRATE` (2862) and then diluted by the other possible identities, so
   the engine could report a comfortable advantage while it was being mated.
   Measured on 30 mate-decided positions: mates seen behind a dark root move
   went from 39/47 to 44/47, none lost, and 4 of 89 non-mate evaluations moved,
   by at most 50 cp.
2. **`qsearch` honours `Threads.stop` and `movetime`** (`src/search.cpp`). It
   checked neither, and the dark-piece recursion re-enters quiescence at depth
   0, so `go movetime` could not stop a thread inside those tails and
   `bestmove` waited on the slowest helper. Server-side that was the tail of
   multi-second timeouts; in the browser it was a search overrunning the depth
   asked for.
3. **A persistent browser UCI entry point** (`src/main.cpp`, `src/uci.cpp`,
   `wasm/`): `pikajieqi_command(const char*)` takes UCI commands one at a time
   from JavaScript, output arrives through the Emscripten `print` callback.

## Build

Native, on Linux or macOS:

```sh
make -C src -j build ARCH=x86-64-sse41-popcnt   # src/PikaJieQi
```

Browser (`wasm/build.sh`, Emscripten SDK 3.1.74; the module uses pthreads, so
the page that loads it needs COOP and COEP headers):

```sh
./wasm/build.sh          # dist/wasm/pikajieqi.{js,wasm}
```

Prebuilt binaries for both are on the
[releases page](https://github.com/brianhliou/pikafish-jieqi-wasm/releases).

## Using it

It speaks UCI. A jieqi position is a FEN with five fields: the board, where a
face-down piece is `X` (red) or `x` (black) and generals are never dark; the
side to move (`w` is red); each side's pool of identities still face-down as
`<piece><count>` pairs in the order R A C P N B; the no-capture ply count; and
the move number.

```
position fen xxxxkxxxx/9/1x5x1/x1x1x1x1x/9/9/X1X1X1X1X/1X5X1/9/XXXXKXXXX w R2A2C2P5N2B2r2a2c2p5n2b2 0 1
go movetime 4000
```

A dark piece moves by the point it starts on and reveals when it moves.
Mistboard runs the bot at four seconds a move with `Hash 256`.

## Strength, and an open challenge

A strong player beats it. Almost all of modern Pikafish's strength is in its
network, and jieqi has no good one: upstream's `jieqi` branch has a jieqi NNUE
architecture but has never had weights to load, and a net we trained on this
engine's own evaluations never came out stronger than the hand-written one. If
yours does, over a 200-game match, it becomes the bot on Mistboard with your
name on it. The terms are on
[brianhliou.com/challenges](https://brianhliou.com/challenges/).

## License

GPL-3.0-or-later, as upstream. See `Copying.txt` and `AUTHORS` for the
Pikafish authors; the three commits above are Mistboard's.
