# Keyboard / a11y audit (issue #12)

**Environment:** Windows 10/11 (`win32 10.0.26200`) · Playwright Chromium **148.0.7778.96** (ms-playwright chromium-1223) · unpacked extension loaded via `--load-extension`  
**Date:** 2026-07-14  
**How:** `node scripts/a11y-keyboard-run.mjs` (live popup + options + overlay keyboard path)  
**Extension id (this run):** `clgpmlhecjlekgipngaopglbfdkonjdf`

No private browsing data included.

## Surfaces

| Surface | Keyboard role | Notes |
|---------|---------------|--------|
| Search overlay | Primary | Arrows, Enter, Esc, Alt+1-9, ? / Ctrl+Backspace |
| Popup | Secondary | Click/actions; search injects into tab (no in-popup result list) |
| Options | Light | Enter on URL field; shortcut labels only |

## Live keyboard matrix (this run)

| Surface | Browser / version | OS | Steps | Expected | Actual |
|---------|-------------------|----|-------|----------|--------|
| **Popup** | Chromium 148.0.7778.96 (Playwright) | win32 10.0.26200 | Open `chrome-extension://…/popup.html`; Tab ×10; try focus `#emptyHintBtn` | Interactive controls focusable; emptyHint focusable + Enter activates | **FAIL on emptyHint:** element is a `DIV`, `tabIndex: -1`, `role: null`. Tab lands on `.github-link` etc.; programmatic `focus()` does **not** activate emptyHint. |
| **Options** | same | same | Open `options.html`; Tab ×12; type URL in `#urlInput` + Enter | Focus moves across form controls; Enter does not throw | **PASS.** Tab order includes shortcut buttons, feature checkboxes, `#resultsLimit`, `#urlInput`, Add / Open All / Clear All, theme radios, language select. Enter after typing `https://example.com` — no crash. |
| **Overlay** on https://example.com | same | same | Try Alt+K (manifest `search-tabs-bookmarks`); then live inject `search-overlay.js` + `show()`; ArrowDown/Up wrap; Esc handler | Overlay opens; Arrow wraps; Esc path exists | **Native Alt+K** did not open overlay under automation (content-script shortcut). **Live inject:** `handleKeyDown` ArrowDown wraps 0→1→2→0; ArrowUp to end index 2; Esc keyup handler present. Unit test also covers wrap. |
| **emptyHintBtn** | same | same | Tab to “Add URLs…”; Enter/Space | Focusable + activates options | **FAIL** — see Popup row. Fix is separate PR #22 (`button type="button"`). |

## Overlay (code + unit tests + live inject)

| Key | Expected | Actual |
|-----|----------|--------|
| ArrowDown / ArrowUp | Move selection; wrap ends | Confirmed live inject + unit test `ArrowDown/ArrowUp wrap selection via handleKeyDown` |
| Enter | Open selected | `selectResult` (code) |
| Escape | Close | Document **keyup** handler present on live instance |
| Alt+1-9 | Quick pick | Uses `e.code` DigitN (code) |
| Tab | Move focus (e.g. results limit) | Not intercepted; Esc still works when select focused (existing test) |

## Gaps (still open)

1. Overlay root lacks `role="dialog"` / `aria-modal`.
2. Results use div + `.selected`, not `listbox` / `option` / `aria-selected`.
3. Close control is a `div` without role/label (Esc still works).
4. Popup has no dedicated keyboard result navigation (by design of inject-to-tab).
5. **`#emptyHintBtn` (popup empty state)** — **live FAIL:** click-only `div`. Keyboard users cannot focus or activate “Add URLs for batch open.” Tracked fix: **PR #22**.

Recommend separate issues for ARIA if maintainers want full screen-reader parity — not drive-by refactors here.

## Changes in this PR

- Unit test: ArrowDown/ArrowUp wrap via `handleKeyDown`.
- This audit doc with **filled live matrix** (popup / options / overlay / emptyHint).
- Repro script: `scripts/a11y-keyboard-run.mjs` (optional; needs Playwright Chromium).

## Issue

https://github.com/TuYv/pounce/issues/12
