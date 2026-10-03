#!/usr/bin/env bash
# Submit Night Better to AMO as listed (public gallery).
# Run only when publishing a finished version. Do not submit mid-development
# CSS or add-on tweaks; AMO reviews listed uploads.
# Listed versions cannot reuse an unlisted version number; bump first.
# --approval-timeout 0 returns after validation: listed signing waits for
# Mozilla review, so a signed XPI may not download until the listing is public.
# Needs JWT credentials from:
# https://addons.mozilla.org/en-US/developers/addon/api/key/
#
#   export WEB_EXT_API_KEY='user:########:##'
#   export WEB_EXT_API_SECRET='...'
#   ./sign.sh
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
cd "$root"

if [[ -f "$root/.amo-credentials" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$root/.amo-credentials"
  set +a
fi

if [[ -z "${WEB_EXT_API_KEY:-}" || -z "${WEB_EXT_API_SECRET:-}" ]]; then
  echo "Set WEB_EXT_API_KEY and WEB_EXT_API_SECRET from https://addons.mozilla.org/en-US/developers/addon/api/key/" >&2
  echo "Or put them in $root/.amo-credentials (gitignored)." >&2
  exit 1
fi

mkdir -p "$root/dist/signed"
rm -rf "$root/web-ext-artifacts"

npx --yes web-ext@8 sign \
  --source-dir "$root" \
  --artifacts-dir "$root/dist/signed" \
  --channel listed \
  --amo-metadata "$root/amo-metadata.json" \
  --timeout 900000 \
  --approval-timeout 0 \
  --no-input

shopt -s nullglob
for f in "$root/dist/signed"/*.xpi; do
  base="$(basename "$f")"
  case "$base" in
    night-better-*.xpi) continue ;;
  esac
  meta="$(unzip -p "$f" manifest.json | python3 -c 'import json,sys; m=json.load(sys.stdin); print(m.get("name",""), m.get("version",""))')"
  name="${meta% *}"
  ver="${meta##* }"
  if [[ "$name" == "Night Better" ]]; then
    cp -f "$f" "$root/dist/signed/night-better-${ver}.xpi"
  fi
done

echo "Signed files:"
ls -l "$root/dist/signed"
