# Repository Guidelines

## Project Structure & Module Organization
This repository is a flat Manifest V3 browser extension. Core entry points live at the root: `manifest.json`, `background.js`, `popup.html` + `popup.js`, `options.html` + `options.js`, `search-overlay.js`, `search-overlay.css`, and `theme-manager.js`. Shared visual assets live in `icons/`. Keep related UI logic close to its entry page and reuse `theme-manager.js` instead of duplicating theme behavior.

## Build, Test, and Development Commands
There is no package manager, bundler, or formal build step. Edit the source files directly.

- `open popup.html`: preview the popup UI in a browser; `popup.js` includes a mock `chrome` fallback for local preview.
- `open options.html`: preview the settings page the same way.
- Browser workflow: open `chrome://extensions` or `edge://extensions`, enable Developer Mode, choose **Load unpacked**, and select this directory. Reload the extension after each change.

## Coding Style & Naming Conventions
Follow the existing plain HTML/CSS/JavaScript style:

- Use 2-space indentation and semicolons.
- Use `camelCase` for variables/functions and `PascalCase` for classes such as `ThemeManager`.
- Prefer descriptive kebab-case filenames for shared modules, for example `search-overlay.js`.
- Keep user-facing strings and new comments concise and in English unless matching nearby localized text.

## Testing Guidelines
Pounce uses Node.js's built-in test runner and has no npm dependencies. Run the full automated test suite with:

```sh
node --test tests/*.test.js
```

Add focused regression tests under `tests/` for shared JavaScript behavior. Manual browser checks remain required for extension integration and UI changes:

- Verify URL add/remove/save flows in `options.html`.
- Verify popup actions, especially “Open All” and search launch.
- Verify the overlay on a normal web page with `Alt+K` or `Command+K`.
- Re-check theme switching across popup, options, and overlay.
- Confirm restricted pages fail gracefully.

## Commit & Pull Request Guidelines
Follow the existing history's short, scoped commit subjects, such as `docs: ...` and `ci: ...`. Keep commits focused and use an imperative description after the scope. PRs should include a brief summary, manual test steps, linked issue or task if applicable, and screenshots or GIFs for popup, options, or overlay UI changes.

## Security & Configuration Tips
Treat `manifest.json` changes carefully. Keep permissions minimal, explain any new permission in the PR, and note changes to commands, icons, or update metadata explicitly.
