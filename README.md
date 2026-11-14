# Pikafish jieqi for mistboard.com

This build follows the official Pikafish `jieqi` NNUE branch with chance-node
reveal search (`ChanceMix`, default `true`). Its NNUE architecture is **256 wide**
(`L2Big = 15`, `L3Big = 32`).

The embedded net was independently trained from random initialization on positions
labelled by [jqe](https://github.com/devinokeefe/jieqi) (MIT). It contains no
Pikafish weights. The default is `src/jieqi-b395f77e3ee9.nnue.zst`, SHA-256
`b395f77e3ee9520900512ee6697d8ae2c384c040491cafb33b893d3715e0b71e`.
The build verifies and embeds this compressed file offline; it never downloads
weights. The executable needs no external net or `EvalFile` setting. `EvalFile`
can still select another compatible compressed net.

## Native build

Python 3 and a C++17 compiler are required. On an Apple silicon Mac:

```sh
make -C src -j4 build ARCH=apple-silicon COMP=clang
./src/pikafish bench
```

For other targets, see `make -C src help` and the
[Pikafish compilation documentation](https://github.com/official-pikafish/Pikafish/wiki/Compiling-from-source).

## Browser build and rules

See [wasm/README.md](wasm/README.md) for the pinned Emscripten 3.1.74 browser
build and persistent UCI entry points. The same net is embedded in WebAssembly.

`Jieqi Rule` defaults to `legacy`: threefold cycles draw and the no-capture limit
is 120 plies. Select `jqe-v1` for the site's stamped rules: unilateral perpetual
check or chase loses and the no-capture limit is 80 plies. Set the option while
idle, before `position` / `go`. See [kernel fixtures](tools/kernel-fixtures/README.md)
for checks against the site's rules kernel.

## Licenses

The engine is distributed under GPL v3; see [Copying.txt](Copying.txt) and
[AUTHORS](AUTHORS). Distribute its corresponding source with binaries as required
by that license.

The embedded net is MIT licensed, copyright 2026 Brian H. Liou; see
[src/jieqi-net-LICENSE](src/jieqi-net-LICENSE). The upstream
`NNUE-License.txt` **does not cover this embedded net**.
