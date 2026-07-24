#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
src_dir="$repo_root/src"
out_dir="${1:-$repo_root/dist/wasm}"

mkdir -p "$out_dir"

sources=(
  benchmark.cpp
  bitboard.cpp
  evaluate.cpp
  main.cpp
  material.cpp
  misc.cpp
  movegen.cpp
  movepick.cpp
  position.cpp
  psqt.cpp
  search.cpp
  thread.cpp
  timeman.cpp
  tt.cpp
  uci.cpp
  ucioption.cpp
  tune.cpp
  nnue/evaluate_nnue.cpp
  nnue/features/half_ka_v2_hm.cpp
  compression/zip.cpp
)

source_paths=()
for source_file in "${sources[@]}"; do
  source_paths+=("$src_dir/$source_file")
done

em++ \
  "${source_paths[@]}" \
  -I"$src_dir" \
  -std=c++17 \
  -O3 \
  -DNDEBUG \
  -DIS_64BIT \
  -DNO_PREFETCH \
  -DUSE_PTHREADS \
  -pthread \
  -msimd128 \
  -fno-exceptions \
  -sWASM=1 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=PikaJieQi \
  -sENVIRONMENT=web,worker \
  -sEXPORTED_FUNCTIONS=_pikajieqi_initialize,_pikajieqi_command,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=cwrap \
  -sINITIAL_MEMORY=64MB \
  -sALLOW_MEMORY_GROWTH=1 \
  -sSTACK_SIZE=3MB \
  -sPTHREAD_POOL_SIZE=4 \
  -sNO_EXIT_RUNTIME=1 \
  -o "$out_dir/pikajieqi.js"

cp "$repo_root/Copying.txt" "$out_dir/COPYING.txt"
