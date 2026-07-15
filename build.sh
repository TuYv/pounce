#!/usr/bin/env bash
# 打包 Chrome 扩展为 pounce-<version>.zip
# 用法：./build.sh        → 读 manifest.json 的 version
#       ./build.sh 1.5.0  → 覆盖版本号

set -euo pipefail

cd "$(dirname "$0")"

PACKAGE_FILES="scripts/package-files.txt"
FILES=()
while IFS= read -r file || [[ -n "$file" ]]; do
  file="${file#"${file%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  if [[ -z "$file" || "$file" == \#* ]]; then
    continue
  fi
  FILES+=("$file")
done < "$PACKAGE_FILES"

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "error: $PACKAGE_FILES contains no package files" >&2
  exit 1
fi

for f in "${FILES[@]}"; do
  if [[ ! -e "$f" ]]; then
    echo "error: missing $f" >&2
    exit 1
  fi
done

# Guard: every file injected via chrome.scripting.executeScript in background.js
# must be in FILES, or the packaged build will fail at runtime with
# "Could not load file" (this is what broke ⌘K in 1.6.0).
python3 - "${FILES[@]}" <<'PYEOF'
import re, sys
packaged = sys.argv[1:]
src = open('background.js').read()
injected = set()
for block in re.findall(r'files:\s*\[(.*?)\]', src, re.DOTALL):
    injected |= set(re.findall(r"""['"]([^'"]+\.(?:js|css))['"]""", block))
missing = [path for path in sorted(injected)
           if not any(path == item or (item.endswith('/') and path.startswith(item))
                      for item in packaged)]
if missing:
    sys.stderr.write("error: background.js injects files missing from "
                     "scripts/package-files.txt: " + ", ".join(missing)
                     + "\n        add them to the package allowlist.\n")
    sys.exit(1)
print(f"inject-coverage check: {len(injected)} injected file(s), all packaged")
PYEOF

if [[ $# -ge 1 ]]; then
  VERSION="$1"
else
  VERSION=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
fi

python3 - "$VERSION" <<'PY'
from pathlib import Path
import sys

version = sys.argv[1]
missing = []
for filename in ('CHANGELOG.md', 'CHANGELOG.zh-CN.md'):
    path = Path(filename)
    heading = f'### {version}'
    if not path.exists():
        missing.append(f'{filename} is missing')
    elif heading not in path.read_text(encoding='utf-8'):
        missing.append(f'{filename} is missing {heading}')

if missing:
    for item in missing:
        print(f'error: {item}', file=sys.stderr)
    sys.exit(1)
PY

OUT="pounce-${VERSION}.zip"

if [[ -e "$OUT" ]]; then
  echo "error: $OUT already exists, remove it or pass a new version" >&2
  exit 1
fi

zip -r -q "$OUT" "${FILES[@]}" -x '**/.DS_Store'

echo "built $OUT"
unzip -l "$OUT" | tail -1

python3 - <<'PY'
from pathlib import Path
import re

packages = []
for package in Path('.').glob('pounce-*.zip'):
    match = re.fullmatch(r'pounce-(\d+)\.(\d+)\.(\d+)\.zip', package.name)
    if match:
        packages.append((tuple(int(part) for part in match.groups()), package))

packages.sort(reverse=True)
remove = [package for _, package in packages[3:]]

for package in sorted(remove, key=lambda item: item.name):
    package.unlink()
    print(f"removed old package {package.name}")
PY

# Auto-tag the release when building from manifest version (skip if version was overridden)
if [[ $# -eq 0 ]]; then
  TAG="v${VERSION}"
  if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
    EXISTING=$(git rev-parse "${TAG}")
    HEAD_SHA=$(git rev-parse HEAD)
    if [[ "$EXISTING" == "$HEAD_SHA" ]]; then
      echo "tag ${TAG} already at HEAD"
    else
      echo "warn: tag ${TAG} exists at ${EXISTING:0:7} but HEAD is ${HEAD_SHA:0:7} — not moving" >&2
    fi
  else
    git tag -a "${TAG}" -m "Release ${VERSION}"
    echo "tagged ${TAG} → push with: git push origin ${TAG}"
  fi
fi
