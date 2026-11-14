# PikaJieQi browser build

This builds the 256-wide Pikafish jieqi NNUE engine and its embedded, independently
trained net as a persistent UCI session. Search and evaluation match the native
build. Python 3 and **Emscripten 3.1.74** are required; other SDK versions are
rejected to keep the artifact on the site's toolchain.

From the repository root:

```sh
docker run --rm --platform linux/amd64 -v "$PWD:/work" -w /work \
  emscripten/emsdk:3.1.74 bash ./wasm/build.sh
```

Or run `./wasm/build.sh [output-directory]` with that exact SDK on PATH. The net
is verified and embedded offline. No external net or filesystem preload is needed.

Serve all generated files under `dist/wasm/` together:

- `pikajieqi.js`: modular factory `PikaJieQi`; also used as the pthread entry point
- `pikajieqi.wasm`: executable and compressed net
- `COPYING.txt` and `jieqi-net-LICENSE`: engine and net licenses
- Any additional worker file emitted by the pinned SDK

The browser document must be cross-origin isolated (`COOP: same-origin` and
`COEP: require-corp`) for pthreads/SharedArrayBuffer. Create the module in a
dedicated worker, supply its `print` callback, then use `cwrap`:

```js
const engine = await PikaJieQi({
  mainScriptUrlOrBlob: new URL('/wasm/pikajieqi.js', self.location.href).href,
  locateFile: file => new URL('/wasm/' + file, self.location.href).href,
  print: line => postMessage(line),
});
engine.cwrap('pikajieqi_initialize', null, [])();
const command = engine.cwrap('pikajieqi_command', null, ['string']);
command('uci');
command('position startpos');
command('go nodes 10000');
// Send stop, isready, position, and subsequent go commands to this same module.
```

Adjust `/wasm/` to the served artifact directory. In a worker, set
`mainScriptUrlOrBlob` explicitly so pthreads can load the same generated JS.
Initialization is idempotent. Engine state persists between command calls.
Keep the default thread count when calling from the worker event loop; changing
thread count there can block pthread startup. The module reserves four workers.
