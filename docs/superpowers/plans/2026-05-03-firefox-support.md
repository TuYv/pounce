# Firefox Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task.

**Goal:** Single source tree, dual build target. `./build.sh` produces `pounce-X.Y.Z.zip` (Chrome). `./build.sh --target firefox` produces `pounce-X.Y.Z.xpi` (Firefox + AMO).

**Reference spec:** `docs/superpowers/specs/2026-05-03-firefox-support-design.md`

**Decisions confirmed (2026-05-03):**
- Submit to AMO (release channel install requires it).
- `chrome.topSites` falls back to `[]` silently on Firefox (already wrapped in try/catch).
- `strict_min_version = "115.0"` (Firefox ESR).
- Gecko ID: `pounce@tuyv.dev`.

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `manifest.firefox.json` | Create | Gecko-specific overrides (id, min version, background.scripts) |
| `build.sh` | Modify | `--target chrome\|firefox` flag, manifest merge, `.xpi` extension |
| `tests/firefox-smoke.md` | Create | Manual smoke checklist for the Firefox build |
| `README.md` | Modify | Firefox install + shortcut rebind section, 1.6.0 changelog entry |
| `README.zh-CN.md` | Modify | Mirror in Chinese |
| `manifest.json` | Modify | Bump `"version"` to `"1.6.0"` |

No JS / HTML / CSS changes.

---

## Task 1: Create the Firefox manifest fragment

**Files:** Create `manifest.firefox.json`.

- [ ] **Step 1.1: Write the file**

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "pounce@tuyv.dev",
      "strict_min_version": "115.0"
    }
  },
  "background": {
    "scripts": ["background.js"]
  }
}
```

The build merge replaces the entire `background` field (drops `service_worker`). All other manifest fields stay from the base.

- [ ] **Step 1.2: Validate JSON**

```bash
python3 -c 'import json; json.load(open("manifest.firefox.json"))' && echo OK
```

- [ ] **Step 1.3: Commit**

```bash
git add manifest.firefox.json
git commit -m "feat(firefox): add manifest override fragment"
```

---

## Task 2: Extend `build.sh` with `--target` flag

**Files:** Modify `build.sh`.

The current script:
- Reads version from `manifest.json`.
- Zips a fixed `FILES=()` array.
- Auto-creates a git tag when no version arg.

Goal: accept `--target chrome|firefox` (default chrome). For firefox: deep-merge `manifest.firefox.json` over `manifest.json`, write the merged JSON into the zip as `manifest.json`, name the artifact `pounce-X.Y.Z.xpi`. The git auto-tag logic must NOT fire for firefox builds (only one tag per version, and we ship from the chrome build).

- [ ] **Step 2.1: Add target flag parsing**

At the top of `build.sh` (after `set -euo pipefail`), parse args. Support both forms:
- `./build.sh` → chrome, version from manifest
- `./build.sh 1.6.0` → chrome, version overridden
- `./build.sh --target firefox` → firefox, version from manifest
- `./build.sh --target firefox 1.6.0` → firefox, version overridden

- [ ] **Step 2.2: Manifest merge for firefox target**

For `--target firefox`, generate `/tmp/pounce-firefox-manifest.json` via:

```bash
python3 -c '
import json, sys
base = json.load(open("manifest.json"))
override = json.load(open("manifest.firefox.json"))
def merge(a, b):
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(a.get(k), dict):
            merge(a[k], v)
        else:
            a[k] = v
base["background"] = override["background"]   # full replace, not merge
for k, v in override.items():
    if k != "background":
        base[k] = v
json.dump(base, sys.stdout, indent=2)
' > /tmp/pounce-firefox-manifest.json
```

`background` is a full replacement (removes `service_worker`). Other top-level overrides shallow-replace.

- [ ] **Step 2.3: Zip with substituted manifest**

For firefox, build the zip without the original `manifest.json` and add the merged one in its place:

```bash
TMPDIR=$(mktemp -d)
trap "rm -rf '$TMPDIR'" EXIT
cp /tmp/pounce-firefox-manifest.json "$TMPDIR/manifest.json"
# zip everything except manifest.json, then add the substituted one
zip -r -q "$OUT" "${FILES[@]:1}" -x '**/.DS_Store'  # FILES[0] is manifest.json
( cd "$TMPDIR" && zip -q "$OLDPWD/$OUT" manifest.json )
```

OR simpler: copy all files into a staging dir, swap manifest, then zip from staging.

Pick whichever you find clearer. Whatever you choose, verify with `unzip -p $OUT manifest.json | head` that the firefox build has `browser_specific_settings.gecko.id` present.

- [ ] **Step 2.4: Output extension**

For chrome: `pounce-X.Y.Z.zip` (unchanged). For firefox: `pounce-X.Y.Z.xpi` (same zip format internally).

- [ ] **Step 2.5: Skip git auto-tag on firefox builds**

The auto-tag block currently fires when no version arg passed. Add: skip the tag creation when `--target firefox` (the tag belongs to the chrome release).

- [ ] **Step 2.6: Test both builds**

```bash
./build.sh 1.6.0-test
unzip -p pounce-1.6.0-test.zip manifest.json | grep -E '"version"|"name"'
unzip -p pounce-1.6.0-test.zip manifest.json | grep -i 'gecko' && echo "FAIL: chrome zip has gecko" || echo "OK: chrome zip clean"

./build.sh --target firefox 1.6.0-test
unzip -p pounce-1.6.0-test.xpi manifest.json | grep -E '"version"|"name"'
unzip -p pounce-1.6.0-test.xpi manifest.json | grep -i 'gecko' && echo "OK: firefox xpi has gecko"
unzip -p pounce-1.6.0-test.xpi manifest.json | grep '"service_worker"' && echo "FAIL: firefox xpi has service_worker" || echo "OK: firefox xpi has no service_worker"

rm pounce-1.6.0-test.zip pounce-1.6.0-test.xpi
```

Expected: chrome zip has version+name, no gecko, has service_worker. Firefox xpi has version+name, has gecko, no service_worker.

- [ ] **Step 2.7: Commit**

```bash
git add build.sh
git commit -m "feat(build): add --target firefox flag for cross-browser packaging"
```

---

## Task 3: Manual smoke checklist for Firefox build

**Files:** Create `tests/firefox-smoke.md`.

This is a checklist the user (or a Firefox-equipped reviewer) walks through. Pounce has no automated cross-browser CI.

- [ ] **Step 3.1: Write the file**

Cover:
- Install via `about:debugging` (temporary install) for dev iteration.
- Install via `about:addons` (signed `.xpi`) for full integration.
- Cmd+K (or rebound) on a regular page → overlay opens, all four sources (tabs, bookmarks, history) populate. Top sites should be empty (silent degrade) — note this in the checklist.
- Cmd+K on `about:addons` → bridge tab opens, overlay launches there.
- Switch language to 中文 → overlay text flips.
- Pinyin search: type `bd` with a Chinese-titled tab open → matches "百度".
- Trigger each notification: empty URL list, batch-open success, web search failure, fresh install onboarding.
- Verify shortcut rebind path: `about:addons` → ⚙️ → Manage Extension Shortcuts.

- [ ] **Step 3.2: Commit**

```bash
git add tests/firefox-smoke.md
git commit -m "docs(firefox): add manual smoke checklist"
```

---

## Task 4: README updates

**Files:** Modify `README.md` and `README.zh-CN.md`.

- [ ] **Step 4.1: Add Firefox install section to `README.md`**

Insert after the existing Chrome install section. Cover:
- Link to AMO listing (placeholder URL until submission completes; mark as "Coming soon" if not yet listed).
- Note that Firefox release channel requires AMO-signed install.
- Shortcut rebind instructions (about:addons → ⚙️ → Manage Extension Shortcuts).
- Caveat: top sites source not available on Firefox.

- [ ] **Step 4.2: Mirror in `README.zh-CN.md`**

Same content in natural Chinese. Use existing translations of "搜索框", "标签页", etc. for vocabulary consistency.

- [ ] **Step 4.3: Add 1.6.0 changelog entries**

In `README.md`, above the 1.5.0 entry:
```markdown
- **v1.6.0** — Firefox support (115 ESR+). Single-source build now produces both Chrome `.zip` and Firefox `.xpi`.
```

In `README.zh-CN.md`:
```markdown
- **v1.6.0** —— 新增 Firefox 支持（115 ESR 起）。单源代码同时构建 Chrome `.zip` 和 Firefox `.xpi`。
```

Match the existing changelog formatting (look at the 1.5.0 entry).

- [ ] **Step 4.4: Commit**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: add firefox install section and 1.6.0 changelog"
```

---

## Task 5: Bump version, build both targets

**Files:** Modify `manifest.json`.

- [ ] **Step 5.1: Bump version**

In `manifest.json`, change `"version": "1.5.0"` → `"version": "1.6.0"`.

- [ ] **Step 5.2: Build chrome target**

```bash
./build.sh
```

Expected: `built pounce-1.6.0.zip` and `tagged v1.6.0 → push with: git push origin v1.6.0`.

- [ ] **Step 5.3: Build firefox target**

```bash
./build.sh --target firefox
```

Expected: `built pounce-1.6.0.xpi`. NO new tag (firefox build skips tagging).

- [ ] **Step 5.4: Verify zip contents**

```bash
unzip -l pounce-1.6.0.zip | grep manifest.json
unzip -l pounce-1.6.0.xpi | grep manifest.json
unzip -p pounce-1.6.0.zip manifest.json | python3 -m json.tool | head
unzip -p pounce-1.6.0.xpi manifest.json | python3 -m json.tool | head
```

Both should be valid JSON. Chrome has `service_worker`, Firefox has `browser_specific_settings.gecko.id` and `background.scripts`.

- [ ] **Step 5.5: Commit version bump**

```bash
git add manifest.json
git commit -m "chore(release): bump to 1.6.0 with firefox support"
```

The git tag was created in Step 5.2. Do NOT push it — leave for the user.

---

## Done

After all 5 tasks the user can:

1. Manually smoke-test `pounce-1.6.0.xpi` in Firefox following `tests/firefox-smoke.md`.
2. Submit `pounce-1.6.0.xpi` to https://addons.mozilla.org/developers/ for AMO review.
3. Push the chrome zip + tag for Web Store update: `git push origin v1.6.0`.
4. Update the Firefox AMO listing URL in `README.md` once approved.
