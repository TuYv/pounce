# Contributing to Pounce

Thanks for helping improve Pounce. The project is intentionally conservative about scope, but well-scoped fixes and improvements are welcome.

## Before you start

- Search existing Issues and Discussions first.
- Open an Issue or Discussion before large features, architecture changes, or changes to `manifest.json` permissions.
- Keep pull requests focused on one problem.
- Do not include browsing data, private URLs, credentials, or other personal information in reports or screenshots.

## Local development

Pounce requires no package-manager install step and is built with plain HTML, CSS, and JavaScript.

1. Clone the repository.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer Mode.
4. Choose **Load unpacked** and select the repository directory.
5. Reload the extension after each change.

You can preview `popup.html` and `options.html` directly in a browser. The popup includes a mock `chrome` fallback for local previews.

## Automated tests

Pounce uses Node.js's built-in test runner and has no npm dependencies:

```bash
node --test tests/*.test.js
```

Run the full suite before opening a pull request.

## Manual checks

For behavior changes, verify the affected flows in an unpacked extension. Depending on the change, check:

- Search launch with `Command+K` on macOS or `Alt+K` on Windows/Linux.
- Keyboard navigation, result selection, and Escape handling.
- Popup actions and settings persistence.
- Light, dark, and system theme behavior.
- Restricted pages such as `chrome://` fail gracefully.
- Both English and Simplified Chinese UI text where applicable.

## Code style

- Use 2-space indentation and semicolons.
- Use `camelCase` for variables and functions and `PascalCase` for classes.
- Keep shared module filenames descriptive and kebab-cased.
- Reuse existing helpers instead of duplicating behavior.
- Keep browser permissions minimal and justify every permission change.

## Pull requests

A pull request should include:

- A concise summary and linked Issue or Discussion.
- Automated test results and relevant manual checks.
- Screenshots or GIFs for visible UI changes.
- Documentation and localization changes when user-facing behavior changes.
- A clear statement about whether `manifest.json` or browser permissions changed.

Maintainers may decline changes that add broad scope, duplicate existing behavior, or increase permissions without enough user benefit.
