# Keyboard / a11y audit (issue #12)

**Environment:** Windows · Chromium automation (Playwright) for live PR pages · Node unit harness for overlay keys · code review of `search-overlay.js`, `popup.js`, `options.js`  
**Date:** 2026-07-12  
**No private browsing data** included.

## Surfaces

| Surface | Keyboard role | Notes |
|---------|---------------|--------|
| Search overlay | Primary | Arrows, Enter, Esc, Alt+1–9, ⌘/Ctrl+Backspace |
| Popup | Secondary | Click/actions; search injects into tab (no in-popup result list) |
| Options | Light | Enter on URL field; shortcut labels only |

## Overlay (confirmed behavior)

| Key | Expected | Actual (code + tests) |
|-----|----------|------------------------|
| ArrowDown / ArrowUp | Move selection; wrap ends | `handleKeyDown` → `moveSelection`; wrap covered by unit test |
| Enter | Open selected | `selectResult` |
| Escape | Close | Document **keyup** (not keydown) — avoids macOS Space fullscreen hold-Esc |
| Alt+1–9 | Quick pick | Uses `e.code` DigitN |
| Tab | Move focus (e.g. results limit) | Not intercepted; Esc still works when select focused (existing test) |

## Gaps (not fixed this PR)

1. Overlay root lacks `role="dialog"` / `aria-modal`.
2. Results use div + `.selected`, not `listbox`/`option`/`aria-selected`.
3. Close control is a `div` without role/label (Esc still works).
4. Popup has no dedicated keyboard result navigation (by design of inject-to-tab).

Recommend separate issues for ARIA if maintainers want screen-reader parity — not drive-by refactors here.

## Changes in this PR

- Unit test: ArrowDown/ArrowUp wrap via `handleKeyDown`.
- This short audit doc.

## Live tool check

Playwright opened https://github.com/TuYv/pounce/pull/18 (prior open PR) and confirmed page title/PR heading live (mergeable workstream still visible).
