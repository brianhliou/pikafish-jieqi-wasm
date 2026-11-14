#!/usr/bin/env bash
set -euo pipefail
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
src_dir="$repo_root/src"
out_dir="${1:-$repo_root/dist/wasm}"
if ! em++ --version | head -n 1 | grep -q ' 3\.1\.74 '; then
  echo 'This artifact requires Emscripten 3.1.74.' >&2
  exit 1
fi
mkdir -p "$out_dir"
out_dir=$(cd "$out_dir" && pwd)
sh "$repo_root/scripts/net.sh"
source_paths=()
while IFS= read -r source_file; do
  source_paths+=("$source_file")
done < <(find "$src_dir" -name '*.cpp' | sort)
em++ "${source_paths[@]}" -I"$src_dir" \
  -std=c++17 -O3 -DNDEBUG -DIS_64BIT -DNO_PREFETCH -DUSE_PTHREADS \
  -DZSTD_DISABLE_ASM -pthread -msimd128 -fno-exceptions \
  -sWASM=1 -sMODULARIZE=1 -sEXPORT_NAME=PikaJieQi \
  -sENVIRONMENT=web,worker \
  -sEXPORTED_FUNCTIONS=_pikajieqi_initialize,_pikajieqi_command,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=cwrap \
  -sINITIAL_MEMORY=64MB -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=3MB \
  -sPTHREAD_POOL_SIZE=4 -sNO_EXIT_RUNTIME=1 \
  -o "$out_dir/pikajieqi.js"
cp "$repo_root/Copying.txt" "$out_dir/COPYING.txt"
cp "$src_dir/jieqi-net-LICENSE" "$out_dir/jieqi-net-LICENSE"
