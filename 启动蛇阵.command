#!/bin/bash
set -e
arena_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
python_bin="$arena_dir/.venv/bin/python"
if [[ ! -x "$python_bin" ]]; then
  printf '请先按照 README.md 创建 .venv 并安装依赖。\n'
  exit 1
fi
exec "$python_bin" -B "$arena_dir/arena.py" --open
