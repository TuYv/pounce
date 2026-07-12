# Microsoft Edge compatibility

This note records **what is confirmed in the Pounce codebase and Chromium/Edge docs**, plus a **manual Edge smoke checklist**. Live UI smoke on a specific Edge build is filled in by whoever runs the checklist (do not invent pass/fail).

| Field | Value |
|-------|--------|
| Pounce version | `1.6.1` (`manifest.json`) |
| Manifest | **V3** (`manifest_version: 3`) + service worker (`background.service_worker`) |
| Agent machine OS (doc author) | Windows |
| Live Edge UI smoke | **untested on author machine** — use checklist below |

## Why Edge is in scope

Microsoft Edge is Chromium-based and supports Manifest V3 extensions (service workers, same extension APIs Pounce uses). Microsoft documents MV3 for Edge independently of Chrome timelines; see [Overview and timelines for migrating to Manifest V3](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/manifest-v3).

Pounce is already written for Chromium MV3. There is no separate Firefox/Safari package.

## Confirmed in code (not speculation)

### Load unpacked

[CONTRIBUTING.md](../CONTRIBUTING.md) already documents:

1. Open `edge://extensions` (or `chrome://extensions`)
2. Developer Mode → **Load unpacked** → repository root
3. Reload after changes

### Restricted pages include Edge schemes

Injection / overlay is blocked on browser-internal URLs. The background restricted list includes **`edge://`** alongside `chrome://`, `chrome-extension://`, `about:`, etc. (`background.js`).

Popup active-tab handling also treats **`edge://`** like `chrome://` and shows the restricted-page message (`popup.js`).

### Overlay note

README states the overlay cannot be injected into `chrome://`, `chrome-extension://`, or `about:` pages (Chromium security model). **Same class of restriction applies on Edge** for `edge://` and related internal pages — already handled in code, not a Chrome-only branch.

### Commands / shortcuts

Default shortcuts in `manifest.json` (Windows/Linux vs Mac) use standard Chromium command keys. Edge uses the same extension commands surface; if a shortcut collides with an Edge browser shortcut, users rebind under Edge extension keyboard shortcuts (Edge UI path may differ slightly from Chrome — record if you observe a real collision).

## Confirmed differences Chrome vs Edge (code-level)

| Topic | Finding |
|-------|---------|
| Restricted scheme list | Code includes both `chrome://` and `edge://` |
| Manifest | Single MV3 package; no Edge-only fork |
| Permissions | Same Chromium permission names |
| Live keyboard / popup / options UX | **Not claimed here** without running the checklist |

Do **not** invent further differences without a reproducible observation. If a real Edge-only bug appears, open a **separate focused issue** (per issue #15) before code changes.

## Manual Edge smoke checklist

Run on **current Microsoft Edge** (record exact version from `edge://version`).

| # | Check | Result (pass / fail / n/a) | Notes |
|---|--------|----------------------------|-------|
| 1 | Install: `edge://extensions` → Load unpacked → this repo | | Edge version: ____ |
| 2 | Extension shows as enabled; version matches `manifest.json` | | |
| 3 | Search launch (`Alt+K` on Windows) opens overlay on a normal `https://` page | | |
| 4 | Popup actions (open URLs / primary controls) work | | |
| 5 | Options page loads; theme/prefs persist after reload | | |
| 6 | Restricted: open `edge://settings` (or similar) → search / overlay fails gracefully (no crash; restricted message if applicable) | | |
| 7 | Restricted: `chrome://` URL in Edge (if any) or `edge://extensions` behaves as restricted | | |
| 8 | `node --test tests/*.test.js` still green after any doc-only PR | | |

### How to fill versions

- **Edge:** `edge://version` → copy full version string  
- **OS:** e.g. Windows 11  
- **Pounce:** `version` field in `manifest.json`

## Related docs

- [CONTRIBUTING.md](../CONTRIBUTING.md) — local setup (includes Edge)
- [README.md](../README.md) — shortcuts and restricted-page summary
- [SECURITY.md](../SECURITY.md) — private vuln reports

## Issue

Tracks acceptance for live verification + documentation: https://github.com/TuYv/pounce/issues/15
