#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
dist="$root/dist"
mkdir -p "$dist"
python3 - <<PY
import json, pathlib
root = pathlib.Path("$root")
json.loads((root / "manifest.json").read_text())
print("ok manifest.json")
PY
(cd "$root" && zip -r -q "$dist/night-better.xpi" \
  manifest.json background.js ui.css icons chrome popup options)
echo "Wrote:"
ls -l "$dist"
