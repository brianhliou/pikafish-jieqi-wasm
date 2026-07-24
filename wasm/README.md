# PikaJieQi browser build

This directory builds the public `jieqi_old` Pikafish branch as a browser
WebAssembly module. It keeps the branch's classical evaluation and does not
bundle an NNUE network.

Requirements:

- Emscripten SDK with `em++`
- A cross-origin-isolated browser document (`COOP` + `COEP`) because the engine
  uses pthreads

Build:

```sh
./wasm/build.sh
```

The output under `dist/wasm/` is generated and should be served together:

- `pikajieqi.js`
- `pikajieqi.wasm`
- `COPYING.txt`

The JavaScript factory exposes `cwrap`. Call the exported
`pikajieqi_command(const char*)` function with successive UCI commands. Engine
output is emitted through the Emscripten module's `print` callback. The generated
JavaScript URL is also used as the pthread worker entry point.
