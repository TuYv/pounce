# Keyboard / a11y audit (issue #12)

**Environment (this update):** Windows · code review of `search-overlay.js`, `popup.js`, `options.js`, `popup.html` · Node unit harness for overlay keys
**Date:** 2026-07-14
**Live unpacked-extension keyboard run:** **not completed on this machine** — issue #12 full acceptance still needs real popup / options / overlay runs in a browser with the extension loaded. This doc records code-confirmed behavior + one hard keyboard gap.

No private browsing data included.

## Surfaces

| Surface | Keyboard role | Notes |
|---------|---------------|--------|
| Search overlay | Primary | Arrows, Enter, Esc, Alt+1-9, ? / Ctrl+Backspace |
| Popup | Secondary | Click/actions; search injects into tab (no in-popup result list) |
| Options | Light | Enter on URL field; shortcut labels only |

## Overlay (confirmed in code + unit tests)

| Key | Expected | Actual (code + tests) |
|-----|----------|------------------------|
| ArrowDown / ArrowUp | Move selection; wrap ends | `handleKeyDown` / `moveSelection`; wrap covered by unit test |
| Enter | Open selected | `selectResult` |
| Escape | Close | Document **keyup** (not keydown) — avoids macOS Space fullscreen hold-Esc |
| Alt+1-9 | Quick pick | Uses `e.code` DigitN |
| Tab | Move focus (e.g. results limit) | Not intercepted; Esc still works when select focused (existing test) |

## Gaps (code-confirmed)

1. Overlay root lacks `role="dialog"` / `aria-modal`.
2. Results use div + `.selected`, not `listbox` / `option` / `aria-selected`.
3. Close control is a `div` without role/label (Esc still works).
4. Popup has no dedicated keyboard result navigation (by design of inject-to-tab).
5. **`#emptyHintBtn` (popup empty state)** — in `popup.html` this is a **click-only `div`** (`class="empty-hint"`). It has a `click` listener in `popup.js` but **no `tabindex`, no `role="button"`, no keyboard handler**. Keyboard users cannot focus or activate “Add URLs for batch open.” **Reproducible from source without live smoke.** Fix should be a focused a11y PR (button element or role + keydown Enter/Space) — not done in this docs/test PR unless maintainers want it here.

Recommend separate issues for ARIA if maintainers want full screen-reader parity — not drive-by refactors here.

## Changes in this PR

- Unit test: ArrowDown/ArrowUp wrap via `handleKeyDown`.
- This audit doc (updated: empty-state keyboard gap; no unrelated GitHub-page tooling notes).

## Live keyboard matrix (still open for #12)

Fill when running **unpacked Pounce** with keyboard only:

| Surface | Browser / version | OS | Steps | Expected | Actual |
|---------|-------------------|----|-------|----------|--------|
| Overlay on https | | | | | |
| Popup | | | | | |
| Options | | | | | |
| emptyHintBtn focus/activate | | | Tab to “Add URLs…” | Focusable + Enter activates | |

## Issue

https://github.com/TuYv/pounce/issues/12 — full close needs filled live matrix above (or maintainer waive).
