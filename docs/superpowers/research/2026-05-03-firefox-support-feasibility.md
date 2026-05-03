# Firefox Support — Feasibility Research

**Status:** Research / Discovery (not yet a spec)
**Goal:** Determine if Pounce (Chrome MV3) can be packaged for Firefox without forking the codebase, what it costs, and what's blocked.
**Codebase baseline:** post-i18n release, master @ `5bc26e5`.

---

## TL;DR

Mostly portable. The main work is build/manifest plumbing, not runtime. `chrome.topSites` is the only API Pounce uses that Firefox lacks — and Pounce already gracefully degrades to `[]` when the call fails (`background.js:387-390`), so a Firefox build silently runs without that source instead of crashing.

Estimated effort: **1-2 days** for a working Firefox build, plus a manual smoke pass on real Firefox.

---

## API surface inventory

| API | Firefox support | Notes |
|---|---|---|
| `chrome.storage.sync` | ✅ | Same shape. Backed by Sync if signed in, local otherwise. |
| `chrome.tabs.*` | ✅ | All Pounce uses (`query`, `create`, `update`, `remove`, `sendMessage`, `get`) work. |
| `chrome.bookmarks.getTree/search` | ✅ | Same shape. |
| `chrome.history.search` | ✅ | Same shape. |
| `chrome.topSites.get` | ❌ | **Not implemented in Firefox.** See "Blockers" below. |
| `chrome.commands.onCommand` | ✅ | Firefox respects `suggested_key`; user can rebind via `about:addons` shortcut UI. |
| `chrome.notifications.create` | ✅ | Same shape. |
| `chrome.scripting.executeScript({files})` | ✅ | Firefox ≥109 (MV3 GA). Multi-file array honored in order. |
| `chrome.runtime.getManifest/getURL/onMessage/onInstalled/sendMessage` | ✅ | Same. |
| `chrome.i18n.getUILanguage` | ✅ | Returns BCP 47 like Chrome. |
| `chrome.i18n.getMessage` | ✅ | Pounce uses a custom loader (Task 1 of i18n PR), so this doesn't matter — but works if needed. |
| `chrome.windows.update({focused})` | ✅ | Same. |
| Shadow DOM, `attachShadow({mode:'open'})` | ✅ | Native. |
| `fetch(chrome.runtime.getURL(...))` for `_locales/*/messages.json` | ✅ | Works in Firefox MV3. |

---

## Blockers and concerns

### 1. `chrome.topSites` not in Firefox

- **Impact:** Search loses the "top sites" source. Tabs / bookmarks / history still work.
- **Severity:** Low — Pounce wraps it in try/catch and returns `[]`. UI shows fewer results, no crash.
- **Options:**
  - Ship as-is; Firefox users just see no top-sites results (cheapest).
  - Fall back to deriving "frequent sites" from the top of `history.search({maxResults:N, text:''})` and unique-by-host (more work, more useful).

### 2. Manifest divergence

- Need `browser_specific_settings.gecko.id` (and optionally `strict_min_version`) for Firefox's permanent extension ID and to opt into MV3.
- Firefox's MV3 background field: **`background.scripts: ["background.js"]`** for older Firefox; `background.service_worker` only landed stable in Firefox 121 (Dec 2023). For best compatibility ship `scripts`. Service-worker-only background fails on older Firefox.
- Pounce currently writes `"background": { "service_worker": "background.js" }`. For Firefox, this needs to become `"background": { "scripts": ["background.js"] }` OR a dual-shape manifest.
- `web_accessible_resources` shape (array of `{matches, resources}`) — Firefox accepts the same MV3 form.

### 3. Service worker lifetime semantics

- Chrome aggressively suspends service workers; Pounce already handles this (e.g. `background.js` re-loads i18n dict per notification call).
- Firefox `background.scripts` is an **event page** that may also be suspended but with different timing. Pounce's per-call lazy loading already accommodates this — no code change expected.

### 4. Bridge tab on protected URLs

- Chrome blocks scripting on `chrome://*` and `chrome.google.com/webstore`. Pounce's bridge-tab pattern (`background.js:injectAndShow` + `bridge.html`) works around this by opening a normal extension tab.
- Firefox's protected URLs are `about:*` and `addons.mozilla.org`. The same bridge pattern *should* work because the bridge is itself an extension page (`bridge.html`), not an injection target.
- **Needs verification on real Firefox:** trigger Cmd+K (or Firefox equivalent) on `about:addons` and confirm the bridge tab opens and the overlay launches.

### 5. Keyboard shortcut conflicts

- `Cmd+K` on Firefox macOS opens the **search bar** (default). Firefox's `commands.suggested_key` may be ignored if conflict; user has to rebind manually via `about:addons` → ⚙️ → Manage Extension Shortcuts.
- `Cmd+Shift+U` for batch open — should be free on Firefox.
- **Needs documentation update:** Firefox README section explaining the conflict and the rebind UI.

### 6. Build pipeline

- `build.sh` produces `pounce-X.Y.Z.zip` for Chrome Web Store. Firefox uses signed `.xpi` (which is also a zip). For an unsigned developer build it's the same zip with `.xpi` extension.
- If we want both stores from one source: parameterize `build.sh` (`./build.sh --target firefox`) to swap manifest fragments and emit `.xpi`.
- Mozilla's signed distribution requires AMO submission + their automated review; first submission ~hours, updates faster.

---

## Open questions to verify

These I cannot answer from spec alone — need a real Firefox or current docs:

1. Does `chrome.scripting.executeScript({files: [...]})` honor the array order on Firefox (same as Chrome)? Pounce relies on it (preferences before pinyin before overlay).
2. Does `Shadow DOM` overlay rendering on `addons.mozilla.org` get blocked by AMO's CSP, the way it gets blocked on `chrome.google.com/webstore` by Chrome's? Bridge-tab assumed answer is yes.
3. Pinyin matching uses `globalThis.TinyPinyin` — does the vendored library load correctly in Firefox's content script context? (Probably yes, it's vanilla JS, but worth a smoke test.)
4. Does Firefox's `chrome.storage.sync` synchronize across devices for users who aren't signed in to a Firefox account? (Chrome falls back to local-only; Firefox might silently lose data on uninstall.)
5. Minimum Firefox version we should declare in `strict_min_version`. MV3 GA was 109 (Jan 2023); recommend `"strict_min_version": "115.0"` (current ESR) for safer baseline.

---

## Proposed path (if we proceed)

Don't fork. Use a single source tree with a small build-time manifest swap:

1. Keep `manifest.json` as Chrome-only.
2. Add `manifest.firefox.json` with the gecko-specific fields (`browser_specific_settings`, `background.scripts` instead of `service_worker`).
3. Extend `build.sh` with a `--target chrome|firefox` flag that picks the right manifest.
4. Add `tests/firefox-smoke.md` checklist (manual; Pounce doesn't have a CI for cross-browser e2e).
5. Update `README.md` / `README.zh-CN.md` with a Firefox install section + shortcut-rebind note.
6. (Optional) Replace topSites with history-derived frequent-sites helper if user feedback complains.

Effort breakdown: manifest split + build flag (~3h), README updates (~1h), real-Firefox smoke pass (~2h), AMO submission paperwork (~half day). **~1-2 days total**.

---

## Decision points for owner

- Ship Firefox build at all? (Pounce's user base is currently Chrome-centric — check Web Store stats.)
- Drop `topSites` for Firefox or invest in a fallback?
- Submit to AMO for distribution, or only offer self-hosted `.xpi` initially?
- Single-source build with target flag, or maintain a `firefox` branch?

If yes to all, next step is to promote this research into a proper spec at
`docs/superpowers/specs/2026-XX-XX-firefox-support-design.md` and then a plan.
