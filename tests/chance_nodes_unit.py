#!/usr/bin/env python3
"""Compile the actual flip_search body with scripted identity search outcomes.

python3 tests/chance_nodes_unit.py --source src/search.cpp
python3 tests/chance_nodes_unit.py --source .baseline/src/search.cpp --baseline

The baseline is expected to fail the mixed-mate and null-window regressions.
This isolates aggregation and window/depth plumbing; corpus tests exercise the
real position, accumulator, NNUE, and full search together.
"""
import argparse
from pathlib import Path
import subprocess
import tempfile

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--source', type=Path, default=Path('src/search.cpp'))
p.add_argument('--baseline', action='store_true')
a = p.parse_args()
source = a.source.read_text()
start = source.index('template<NodeType nodeType>\nValue Search::Worker::flip_search(')
end = source.index('\nDepth Search::Worker::reduction', start)
root = Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='jieqi-chance-unit-') as temp:
    temp = Path(temp)
    (temp/'flip_search.inc').write_text(source[start:end])
    command = ['clang++', '-std=c++17', '-Wall', '-Wextra', '-Wno-unused-parameter',
               '-I'+str(root/'src'), '-I'+str(temp), str(root/'tests/chance_nodes_unit.cpp'),
               '-o', str(temp/'test')]
    if a.baseline:
        command.insert(1, '-DBASELINE')
    subprocess.run(command, check=True)
    raise SystemExit(subprocess.run([str(temp/'test')]).returncode)
