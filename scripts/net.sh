#!/bin/sh
# Verify and embed only the checked-in net; never download weights.
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec python3 "$script_dir/embed-net.py"
