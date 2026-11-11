#!/usr/bin/env bash
# M-21: the hop-assets files vendored in web/public/hop-assets/<version> must be byte-identical to the
# hub's copy of that version (they are immutable once deployed). Compares what git has committed on
# both sides, so line-ending settings on a workstation cannot cause a false alarm.
#
#   scripts/check-vendored-assets.sh <path-to-HEL.ink-clone> [version] [hub-ref]
#
# version defaults to the one the page references; hub-ref defaults to origin/main.
set -euo pipefail

hub=${1:?usage: check-vendored-assets.sh <HEL.ink clone> [version] [hub-ref]}
root=$(cd "$(dirname "$0")/.." && pwd)
version=${2:-$(grep -o 'hop-assets/v[0-9]*' "$root/web/index.html" | head -1 | cut -d/ -f2)}
ref=${3:-origin/main}
dir="web/public/hop-assets/$version"

[ -n "$version" ] || { echo "no version found" >&2; exit 2; }
n=0; bad=0
while IFS= read -r f; do
  n=$((n + 1))
  mine=$(git -C "$root" show "HEAD:$f" | sha256sum | cut -d' ' -f1)
  theirs=$(git -C "$hub" show "$ref:public/hop-assets/$version/${f#"$dir"/}" 2>/dev/null | sha256sum | cut -d' ' -f1) || theirs=missing
  if [ "$mine" != "$theirs" ]; then echo "DIFFERENT OR MISSING: $f"; bad=$((bad + 1)); fi
done < <(git -C "$root" ls-files "$dir")

echo "$version: $n vendored files, $bad different or missing against $ref of the hub"
[ "$n" -gt 0 ] && [ "$bad" -eq 0 ]
