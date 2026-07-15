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

## Debugging an unpacked extension

These steps work for **Chrome** and **Microsoft Edge** (Chromium). No package manager is required.

### Reload after code changes

1. Open the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Ensure **Developer mode** is on.
3. Find **Pounce** in the list.
4. Click **Reload** (circular arrow). Prefer a full reload after changes to `manifest.json`, `background.js`, or content-script entry points.
5. Refresh any open page where you are testing the overlay (`F5` / reload), then trigger search again (`Command+K` or `Alt+K`).

If the extension does not appear, use **Load unpacked** again and select the repository root (the folder that contains `manifest.json`).

### Inspect popup errors

1. Click the Pounce toolbar icon to open the popup.
2. Right-click inside the popup → **Inspect** (or **Inspect popup**).
3. Use the **Console** panel for runtime errors and the **Network** panel only if you are debugging asset loads.
4. Leave the DevTools window open while reproducing the issue so logs are not lost when the popup closes.

### Inspect options page errors

1. Open the options page from the extensions list (**Details → Extension options**) or right-click the toolbar icon → **Options**.
2. On the options tab, open DevTools (`F12` / `Command+Option+I`).
3. Check **Console** for errors from `options.js` and related scripts.

### Inspect the background service worker

Pounce uses a Manifest V3 service worker (`background.js`).

1. Open `chrome://extensions` or `edge://extensions`.
2. Find Pounce → click **service worker** / **Inspect views: service worker** (wording varies slightly by browser version).
3. Watch the service worker **Console** for message-passing errors, permission failures, and startup exceptions.
4. Note: Chromium may stop an idle service worker. Trigger a shortcut or popup action, then re-open the inspector if the link disappears.

### Inspect page-overlay errors

The search overlay runs in the context of the **current tab** page.

1. Open a normal `https://` page (not `chrome://`, `edge://`, `chrome-extension://`, or `about:` — the overlay cannot inject there).
2. Open DevTools on that page (`F12`).
3. Trigger the overlay (`Command+K` / `Alt+K`).
4. In **Console**, filter for Pounce-related messages or uncaught exceptions from injected scripts.
5. If nothing appears, confirm the extension reloaded and that the tab is not a restricted URL.

### Safe reporting

When filing issues or attaching screenshots:

- Do not include private browsing data, credentials, or personal URLs.
- Prefer redacted console text over full-screen captures of your open tabs.

## Automated tests

Pounce uses Node.js's built-in test runner and has no npm dependencies:

```bash
node --test tests/*.test.js
```

Run the full suite before opening a pull request.

## Release package validation

Build and validate the same release package checked in CI:

```bash
VERSION="$(node -p "require('./manifest.json').version")"
rm -f "pounce-${VERSION}.zip"
./build.sh "$VERSION" && node scripts/validate-release.js "pounce-${VERSION}.zip"
```

Passing the version explicitly prevents `build.sh` from creating a local Git tag. Generated ZIP files are ignored by Git.

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
