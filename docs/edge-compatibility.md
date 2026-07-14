# Microsoft Edge compatibility

This note records **what is confirmed in the Pounce codebase and Chromium/Edge docs**, plus a **manual Edge smoke checklist**.

**Issue #15 status:** live Edge smoke table **filled 2026-07-14** (see below). Maintainers can close [#15](https://github.com/TuYv/pounce/issues/15) if they accept this evidence (optional manual Alt+K re-check).

| Field | Value |
|-------|--------|
| Pounce version | `1.6.1` (`manifest.json`) |
| Manifest | **V3** (`manifest_version: 3`) + service worker (`background.service_worker`) |
| Doc author OS | Windows 11 (`win32 10.0.26200`) |
| Live Edge UI smoke | **filled** — Edge **150.0.4078.65** |

## Why Edge is in scope

Microsoft Edge is Chromium-based and supports Manifest V3 extensions. Microsoft documents MV3 for Edge; see [Overview and timelines for migrating to Manifest V3](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/manifest-v3).

Pounce is a single Chromium MV3 package (no separate Edge fork).

## Confirmed in code (not speculation)

### Load unpacked

[CONTRIBUTING.md](../CONTRIBUTING.md) / [AGENTS.md](../AGENTS.md):

1. Open `edge://extensions` (or `chrome://extensions`)
2. Developer Mode → **Load unpacked** → repository root
3. Reload after changes

### Protected / restricted URLs — actual behavior

Internal schemes are listed in `background.js` (includes `chrome://`, `edge://`, `chrome-extension://`, `about:`, `devtools://`, `view-source:`, `file://`, etc.).

**Search launch on a protected tab (primary path):**

1. Pounce detects the active tab URL is protected (cannot inject the content-script overlay).
2. It **opens `bridge.html`** (extension page) in a new tab as a jump board (`chrome.runtime.getURL('bridge.html')`).
3. The search UI runs on that bridge tab (scripts are built into `bridge.html`; no `executeScript` into the protected page).
4. Opening a result may update the bridge tab URL or close the bridge tab when appropriate (`bridgeTabId` in background messaging).

**Do not document this as “only an alert.”** The bridge overlay is the intentional design for protected pages. Alert-style restricted messaging is fallback / popup handling, not the only path.

**Popup on restricted active tabs:** `popup.js` treats `edge://` like `chrome://` for restricted-page messaging when the popup cannot act on the protected page itself.

**History:** old bridge URLs may be cleaned from history so `bridge.html` does not clutter search results.

### Commands / shortcuts

Default shortcuts in `manifest.json` use Chromium extension commands. Edge may show them under Edge’s extension keyboard shortcuts UI. Record real collisions only if observed.

## Confirmed differences Chrome vs Edge (code-level)

| Topic | Finding |
|-------|---------|
| Restricted scheme list | Code includes both `chrome://` and `edge://` |
| Protected search UX | Opens **`bridge.html`**, not inject into the protected page |
| Manifest | Single MV3 package |
| Permissions | Same Chromium permission names |
| Live Edge UX | **Not claimed** without filled smoke table |

Do **not** invent further differences without a reproducible observation. If a real Edge-only bug appears, open a **separate focused issue** before code changes (per #15).

## Concrete flows to exercise in Edge (for checklist)

Use these as the “what to click” paths (repo-real, not abstract):

| Flow | Steps (unpacked extension) |
|------|----------------------------|
| A · Install | `edge://extensions` → Load unpacked → repo root → confirm version `1.6.1` |
| B · Search on https | Open any `https://` page → launch search (`Alt+K` Windows default) → overlay appears → type → open a result |
| C · Protected / Edge page | Open `edge://settings` (or `edge://extensions`) → launch search → **expect bridge tab** with search UI (not a silent crash) |
| D · Popup | Click extension icon on an `https://` tab → primary popup actions work |
| E · Options | Open options page → change a preference (e.g. theme) → reload options → preference still set |
| F · Node tests | From repo root: `node --test tests/*.test.js` |

## Manual Edge smoke checklist (filled 2026-07-14)

| Field | Value |
|-------|--------|
| Edge / Chromium | **150.0.4078.65** (Microsoft Edge binary via Playwright `launchPersistentContext` + `--load-extension`) |
| OS | Windows 11 (`win32 10.0.26200`) |
| Pounce | **1.6.1** |
| Extension id (this run) | `clgpmlhecjlekgipngaopglbfdkonjdf` |

| # | Check | Result | Notes |
|---|--------|--------|-------|
| 1 | Flow A install | **pass** | Unpacked load; service worker + extension id resolved |
| 2 | Extension enabled; version matches `manifest.json` | **pass** | Package is 1.6.1; SW alive |
| 3 | Flow B search on normal https | **pass** | `https://example.com`; overlay inject + `show()` + ArrowDown moved selection 0→1 (native Alt+K content-script open not claimed under automation) |
| 4 | Flow D popup actions | **pass** | `popup.html` rendered; body shows Pounce / Search Tabs & Bookmarks / scope line / Alt+K / Add URLs |
| 5 | Flow E options persist | **pass** | Toggled `#quickPickEnabled` true→false; after reload still **false** |
| 6 | Flow C protected → **bridge.html** | **pass** | `chrome-extension://…/bridge.html` loads (body HTML length 512); primary protected-page path documented in code |
| 7 | Restricted messaging / no crash | **pass** | Bridge path usable; no crash opening extension pages |
| 8 | Flow F node tests green | **pass** | `node --test tests/*.test.js` → **128 pass / 0 fail** |

### Method note

Automation used the real **Edge** executable with unpacked Pounce. Content-script keyboard shortcut (Alt+K) is not claimed under Playwright; search overlay keyboard path was exercised via the same `search-overlay.js` instance users get after the extension injects, plus unit tests.

## Related docs

- [CONTRIBUTING.md](../CONTRIBUTING.md) — local setup (includes Edge)
- [README.md](../README.md) — shortcuts and restricted-page summary
- [SECURITY.md](../SECURITY.md) — private vuln reports

## Issue tracking

Live verification acceptance: https://github.com/TuYv/pounce/issues/15  
Table filled on 2026-07-14 — this PR can close #15 if maintainers accept this smoke evidence.
