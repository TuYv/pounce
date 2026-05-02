# i18n Multi-Language Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize Pounce's UI (popup / options / overlay / system notifications / Chrome Web Store metadata) into English and Simplified Chinese, with auto-detect by default and manual override in options.

**Architecture:** A custom `i18n.js` loader (since `chrome.i18n.getMessage` cannot be runtime-overridden) loads `_locales/<lang>/messages.json` over `fetch`. HTML strings carry `data-i18n` attributes and get replaced after `i18n.init()`. JS-rendered strings call `i18n.t(key, [substitutions])`. Manifest metadata uses Chrome-native `__MSG_xxx__` placeholders (browser-UI-driven only, by design). Storage `chrome.storage.sync.language` ∈ `'auto' | 'en' | 'zh_CN'`.

**Tech Stack:** Vanilla MV3 extension (no bundler). Tests run via `node:test` for the loader's pure logic; everything else is manual smoke-tested by loading the unpacked extension.

**Reference spec:** `docs/superpowers/specs/2026-05-02-i18n-multi-language-design.md`

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `i18n.js` | Create | Loader, decision logic, DOM scan, runtime switch |
| `_locales/en/messages.json` | Create | Source-of-truth English copy |
| `_locales/zh_CN/messages.json` | Create | Simplified Chinese copy |
| `tests/i18n.test.js` | Create | `node:test` coverage for `decideLanguage` and `formatMessage` |
| `manifest.json` | Modify | `default_locale`, `__MSG_*__` fields, `web_accessible_resources` adds `_locales/*` |
| `popup.html` | Modify | `<script src="i18n.js">`, `data-i18n` on every English string |
| `popup.js` | Modify | `await window.i18n.init()` before render; storage listener for `language` key; replace dynamic strings with `i18n.t(...)` |
| `options.html` | Modify | `<script src="i18n.js">`, `data-i18n` everywhere; new Language `<select>` |
| `options.js` | Modify | Init i18n; bind Language select to `chrome.storage.sync.set({language})`; storage listener |
| `bridge.html` | Modify | Add `<script src="i18n.js">` before overlay scripts |
| `search-overlay.js` | Modify | Init i18n; replace English literals with `i18n.t(...)`; storage listener for live switch |
| `background.js` | Modify | Lazy-load i18n on each notification; replace literal `message`/`title` with `i18n.t(...)` |
| `build.sh` | Modify | `FILES=()` array adds `i18n.js` and `_locales` |
| `README.md` / `README.zh-CN.md` | Modify | Add 1.5.0 changelog entry |

---

## Task 1: Build the i18n core (TDD on pure logic)

**Files:**
- Create: `i18n.js`
- Create: `tests/i18n.test.js`

The decision logic and substitution are pure JS — testable with `node:test`. The DOM/fetch/storage glue is integration and gets covered by manual smoke tests in later tasks.

- [ ] **Step 1.1: Write failing tests for `decideLanguage`**

Create `tests/i18n.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

const { decideLanguage, formatMessage } = require('../i18n.js');

test('decideLanguage: auto + Chinese browser → zh_CN', () => {
  assert.equal(decideLanguage('auto', 'zh-CN'), 'zh_CN');
  assert.equal(decideLanguage('auto', 'zh-TW'), 'zh_CN');
  assert.equal(decideLanguage('auto', 'zh'), 'zh_CN');
});

test('decideLanguage: auto + non-Chinese browser → en', () => {
  assert.equal(decideLanguage('auto', 'en-US'), 'en');
  assert.equal(decideLanguage('auto', 'fr-FR'), 'en');
  assert.equal(decideLanguage('auto', ''), 'en');
  assert.equal(decideLanguage('auto', undefined), 'en');
});

test('decideLanguage: explicit preference always wins', () => {
  assert.equal(decideLanguage('en', 'zh-CN'), 'en');
  assert.equal(decideLanguage('zh_CN', 'en-US'), 'zh_CN');
});

test('decideLanguage: unknown preference falls back to auto', () => {
  assert.equal(decideLanguage('ja', 'zh-CN'), 'zh_CN');
  assert.equal(decideLanguage(null, 'en-US'), 'en');
  assert.equal(decideLanguage(undefined, 'zh-CN'), 'zh_CN');
});

test('formatMessage: no placeholders returns message unchanged', () => {
  assert.equal(formatMessage('Open All', undefined, undefined), 'Open All');
  assert.equal(formatMessage('Open All', {}, []), 'Open All');
});

test('formatMessage: $1-style substitution', () => {
  const placeholders = { count: { content: '$1' } };
  assert.equal(formatMessage('$count$ saved URLs', placeholders, ['12']), '12 saved URLs');
});

test('formatMessage: multiple placeholders', () => {
  const placeholders = { a: { content: '$1' }, b: { content: '$2' } };
  assert.equal(formatMessage('$a$ + $b$', placeholders, ['x', 'y']), 'x + y');
});

test('formatMessage: missing substitution leaves placeholder name', () => {
  const placeholders = { count: { content: '$1' } };
  assert.equal(formatMessage('$count$ items', placeholders, []), '$count$ items');
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `node --test tests/i18n.test.js`
Expected: FAIL with `Cannot find module '../i18n.js'`.

- [ ] **Step 1.3: Implement `i18n.js`**

Create `i18n.js`:

```javascript
// i18n loader for Pounce.
// Browser globals: window, document, chrome, fetch.
// Also CommonJS-compatible for node:test on the pure helpers.

(function (root) {
  'use strict';

  const SUPPORTED = ['en', 'zh_CN'];
  const DEFAULT_LANG = 'en';
  const STORAGE_KEY = 'language';

  function decideLanguage(preference, browserLang) {
    if (preference && SUPPORTED.includes(preference)) {
      return preference;
    }
    const lang = (browserLang || '').toLowerCase();
    if (lang.startsWith('zh')) return 'zh_CN';
    return DEFAULT_LANG;
  }

  function formatMessage(message, placeholders, substitutions) {
    if (!placeholders) return message;
    let out = message;
    for (const [name, def] of Object.entries(placeholders)) {
      const content = def && def.content;
      if (typeof content !== 'string') continue;
      const match = /^\$(\d+)$/.exec(content);
      if (!match) continue;
      const idx = parseInt(match[1], 10) - 1;
      const sub = substitutions && substitutions[idx];
      if (sub === undefined) continue;
      out = out.split('$' + name + '$').join(String(sub));
    }
    return out;
  }

  // ----- Browser-only state below; skipped under node:test -----
  if (typeof window === 'undefined') {
    if (typeof module !== 'undefined') {
      module.exports = { decideLanguage, formatMessage };
    }
    return;
  }

  let dict = {};
  let resolvedLang = DEFAULT_LANG;
  let preference = 'auto';

  async function loadDict(lang) {
    try {
      const url = chrome.runtime.getURL('_locales/' + lang + '/messages.json');
      const res = await fetch(url);
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[i18n] failed to load', lang, e);
      if (lang !== DEFAULT_LANG) return loadDict(DEFAULT_LANG);
      return {};
    }
  }

  function applyToDom(doc) {
    if (!doc || !doc.querySelectorAll) return;
    doc.querySelectorAll('[data-i18n]').forEach(el => {
      const v = api.t(el.dataset.i18n);
      if (v) el.textContent = v;
    });
    doc.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const v = api.t(el.dataset.i18nPlaceholder);
      if (v) el.placeholder = v;
    });
    doc.querySelectorAll('[data-i18n-title]').forEach(el => {
      const v = api.t(el.dataset.i18nTitle);
      if (v) el.title = v;
    });
    doc.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const v = api.t(el.dataset.i18nAriaLabel);
      if (v) el.setAttribute('aria-label', v);
    });
  }

  async function readPreference() {
    try {
      const r = await chrome.storage.sync.get([STORAGE_KEY]);
      return r[STORAGE_KEY] || 'auto';
    } catch {
      return 'auto';
    }
  }

  function browserLang() {
    try {
      return chrome.i18n.getUILanguage();
    } catch {
      return 'en';
    }
  }

  const api = {
    decideLanguage,
    formatMessage,

    async init(doc) {
      preference = await readPreference();
      resolvedLang = decideLanguage(preference, browserLang());
      dict = await loadDict(resolvedLang);
      applyToDom(doc || (typeof document !== 'undefined' ? document : null));
    },

    t(key, substitutions) {
      const entry = dict[key];
      if (!entry) return key;
      return formatMessage(entry.message, entry.placeholders, substitutions);
    },

    async setLanguage(lang, doc) {
      preference = lang;
      try { await chrome.storage.sync.set({ [STORAGE_KEY]: lang }); } catch {}
      resolvedLang = decideLanguage(preference, browserLang());
      dict = await loadDict(resolvedLang);
      applyToDom(doc || (typeof document !== 'undefined' ? document : null));
    },

    async reload(doc) {
      preference = await readPreference();
      resolvedLang = decideLanguage(preference, browserLang());
      dict = await loadDict(resolvedLang);
      applyToDom(doc || (typeof document !== 'undefined' ? document : null));
    },

    getCurrentLanguage() { return resolvedLang; },
    getPreference() { return preference; },
    applyToDom,
  };

  root.i18n = api;
  if (typeof module !== 'undefined') module.exports = { decideLanguage, formatMessage };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `node --test tests/i18n.test.js`
Expected: 8 passed.

- [ ] **Step 1.5: Commit**

```bash
git add i18n.js tests/i18n.test.js
git commit -m "feat(i18n): add custom loader with language decision and substitution"
```

---

## Task 2: Inventory strings and create the English message catalog

Walk every UI surface and turn each English literal into a key. The `en` catalog is the source of truth — `zh_CN` mirrors its keys.

**Files:**
- Create: `_locales/en/messages.json`

- [ ] **Step 2.1: Inventory the surfaces**

Run these commands and capture every English string visible to the user:

```bash
# popup.html visible text and attributes
grep -oE '>[^<]{2,80}<|placeholder="[^"]+"|title="[^"]+"|aria-label="[^"]+"' popup.html

# options.html (large file — skim everything user-visible)
grep -oE '>[^<]{2,120}<|placeholder="[^"]+"|title="[^"]+"|aria-label="[^"]+"' options.html

# search-overlay.js — strings rendered into the overlay DOM
grep -nE "'[A-Z][^']{1,80}'|\"[A-Z][^\"]{1,80}\"" search-overlay.js | grep -vE 'console\.|throw new Error|querySelector|getAttribute|className|id='

# background.js — notification title + message strings
grep -nE "title:|message:" background.js
```

For each string, decide a key under the convention `<scope>.<concept>`:
- `popup.*` for popup
- `options.*` for options page
- `overlay.*` for the search overlay
- `notify.*` for system notifications
- Flat keys for manifest: `ext_name`, `ext_description`, `action_title`, `cmd_open_all`, `cmd_search`

- [ ] **Step 2.2: Create `_locales/en/messages.json`**

Create the file with the catalog below. Add any string the inventory turns up that isn't listed — match the naming convention. Every entry needs a `description` field (Chrome convention; helps future translators).

```json
{
  "ext_name": {
    "message": "Pounce – Cmd+K Search Tabs & Bookmarks",
    "description": "Extension name shown in Chrome Web Store and chrome://extensions"
  },
  "ext_description": {
    "message": "One keystroke to find anything in your browser. Press ⌘K to search open tabs, bookmarks, history, and top sites.",
    "description": "Extension description in Chrome Web Store"
  },
  "action_title": {
    "message": "Pounce – Search Tabs, Bookmarks & History",
    "description": "Toolbar icon tooltip"
  },
  "cmd_open_all": {
    "message": "Open all configured URLs",
    "description": "Description of the batch-open keyboard command"
  },
  "cmd_search": {
    "message": "Search open tabs and bookmarks",
    "description": "Description of the search keyboard command"
  },

  "popup.openSearch": { "message": "Open search", "description": "Popup primary action label" },
  "popup.openSearchHint": { "message": "anywhere", "description": "Hint after Open search button" },
  "popup.batchOpenURLs": { "message": "Batch Open URLs", "description": "Popup section title" },
  "popup.openAll": { "message": "Open All", "description": "Button to open every saved URL" },
  "popup.addUrls": { "message": "+ Add URLs for batch open", "description": "Empty-state CTA in popup" },
  "popup.manage": { "message": "Manage →", "description": "Link to options page" },
  "popup.loading": { "message": "Loading...", "description": "Loading placeholder" },

  "options.title": { "message": "Pounce Settings", "description": "Options page title" },
  "options.appearance": { "message": "Appearance", "description": "Options section header" },
  "options.darkMode": { "message": "Dark Mode", "description": "Theme group label" },
  "options.lightMode": { "message": "Light Mode", "description": "Light theme label" },
  "options.light": { "message": "Light", "description": "Light theme button" },
  "options.dark": { "message": "Dark", "description": "Dark theme button" },
  "options.system": { "message": "System", "description": "System theme button" },
  "options.followSystem": { "message": "Follow System", "description": "System theme description" },

  "options.language": { "message": "Language", "description": "Language section header" },
  "options.languageAuto": { "message": "Auto (follow browser)", "description": "Language dropdown auto option" },
  "options.languageEnglish": { "message": "English", "description": "Language dropdown English option" },
  "options.languageChinese": { "message": "中文", "description": "Language dropdown Chinese option (kept native)" },

  "options.searchExperience": { "message": "Search Experience", "description": "Search settings section header" },
  "options.highlightMatches": { "message": "Highlight matches", "description": "Toggle label" },
  "options.highlightMatchesDesc": { "message": "Emphasize matched text in result titles and URLs.", "description": "Toggle description" },
  "options.pinyinToggle": { "message": "Match Chinese titles by pinyin", "description": "Pinyin toggle label" },
  "options.pinyinToggleDesc": { "message": "Type \"bd\" or \"baidu\" to find 百度. Auto-skipped for non-Chinese titles.", "description": "Pinyin toggle description" },
  "options.quickPick": { "message": "Quick pick", "description": "Quick pick toggle label" },
  "options.quickPickDesc": { "message": "Open visible results with Alt/Option + 1-9.", "description": "Quick pick description" },

  "options.batchOpen": { "message": "Batch open", "description": "Batch open section header" },
  "options.batchOpenURLs": { "message": "Batch Open URLs", "description": "Batch URL list header" },
  "options.savedUrlsCount": {
    "message": "$count$ saved URLs",
    "description": "Saved URL count, $count$ is a number",
    "placeholders": { "count": { "content": "$1" } }
  },
  "options.footer": { "message": "© 2025 Pounce", "description": "Footer copyright" },

  "overlay.searchPlaceholder": { "message": "Search tabs, bookmarks, history…", "description": "Overlay search input placeholder" },
  "overlay.noResults": { "message": "No results found", "description": "Empty state in overlay" },
  "overlay.navigate": { "message": "Navigate", "description": "Hint label" },
  "overlay.selectClose": { "message": "Select / Close", "description": "Hint label" },
  "overlay.openSearch": { "message": "Open search", "description": "Hint label" },

  "notify.title": { "message": "Pounce", "description": "Generic notification title" },
  "notify.errorTitle": { "message": "Pounce - Error", "description": "Error notification title" },
  "notify.searchErrorTitle": { "message": "Pounce - Search Error", "description": "Search error notification title" },
  "notify.installedTitle": { "message": "Pounce Installed Successfully", "description": "Onboarding notification title" },
  "notify.noUrls": { "message": "Please add URLs first before using this feature", "description": "Shown when batch-open fires with empty list" },
  "notify.openedCount": {
    "message": "Successfully opened $count$ URLs",
    "description": "Confirmation after batch open",
    "placeholders": { "count": { "content": "$1" } }
  },
  "notify.openError": { "message": "Error occurred while opening URLs, please check URL configuration", "description": "Batch open failure" },
  "notify.searchError": { "message": "Failed to perform web search", "description": "Web search failure" },
  "notify.installedBody": {
    "message": "Press $search$ to search tabs & bookmarks. Use $batch$ to batch open URLs.",
    "description": "Onboarding body, $search$ and $batch$ are keyboard shortcut strings",
    "placeholders": {
      "search": { "content": "$1" },
      "batch": { "content": "$2" }
    }
  }
}
```

If your inventory in Step 2.1 surfaces strings not in this catalog, **add them before moving on**. Wire-up tasks below assume every string already has a key.

- [ ] **Step 2.3: Validate JSON parses**

Run: `python3 -c 'import json; json.load(open("_locales/en/messages.json"))' && echo OK`
Expected: `OK`

- [ ] **Step 2.4: Commit**

```bash
git add _locales/en/messages.json
git commit -m "feat(i18n): add English message catalog"
```

---

## Task 3: Wire popup

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`

- [ ] **Step 3.1: Inject `i18n.js` into `popup.html`**

In `popup.html`, in `<head>`, add `<script src="i18n.js"></script>` **before** any other `<script>` tag.

- [ ] **Step 3.2: Add `data-i18n` attributes**

For every English string identified in Task 2.1 for popup, add the matching attribute. Examples:

```html
<!-- before -->
<button id="open-all-btn">Open All</button>
<input id="search-trigger" placeholder="Search...">

<!-- after -->
<button id="open-all-btn" data-i18n="popup.openAll">Open All</button>
<input id="search-trigger" data-i18n-placeholder="popup.openSearch" placeholder="Search...">
```

Keep the original English text inside the tag — it's the fallback if i18n fails to load. Repeat for every popup string in the catalog (`popup.*`).

- [ ] **Step 3.3: Init i18n in `popup.js`**

In `popup.js`, find the existing `DOMContentLoaded` handler (or the first thing the page does after load). Wrap the existing init so i18n runs first:

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  if (window.i18n) await window.i18n.init();
  // ... existing init logic ...
});
```

- [ ] **Step 3.4: Replace dynamic strings in `popup.js` with `i18n.t`**

For every string `popup.js` writes into the DOM at runtime (e.g. `el.textContent = 'Loading...'`), use:

```javascript
el.textContent = window.i18n ? window.i18n.t('popup.loading') : 'Loading...';
```

Pattern: keep the literal English as the fallback in case `window.i18n` isn't defined (e.g. local preview without extension).

- [ ] **Step 3.5: Add storage listener for live language switch**

In `popup.js`, alongside the existing `chrome.storage.onChanged` listener (the one that handles `theme`), handle `language` too:

```javascript
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' && changes.language && window.i18n) {
    await window.i18n.reload();
  }
});
```

If popup.js's existing listener already exists, add the `language` branch into it instead of registering a second listener.

- [ ] **Step 3.6: Smoke test**

1. Load unpacked at `chrome://extensions`
2. Click the Pounce toolbar icon → popup opens, every English string renders
3. Open DevTools on popup → Console: no errors. Type `window.i18n.getCurrentLanguage()` → returns `'en'` (or `'zh_CN'` if your browser is Chinese)

- [ ] **Step 3.7: Commit**

```bash
git add popup.html popup.js
git commit -m "feat(popup): wire i18n loader and replace hardcoded strings"
```

---

## Task 4: Wire options + add Language dropdown

**Files:**
- Modify: `options.html`
- Modify: `options.js`

- [ ] **Step 4.1: Inject `i18n.js` into `options.html`**

In `<head>`, add `<script src="i18n.js"></script>` before all other `<script>` tags.

- [ ] **Step 4.2: Add `data-i18n` attributes everywhere**

Apply the same pattern as popup. Cover every label, button, section header, and description (`options.*` keys). For tooltips, use `data-i18n-title`. For placeholders, use `data-i18n-placeholder`. Footer copyright too: `data-i18n="options.footer"`.

- [ ] **Step 4.3: Add Language section to `options.html`**

Insert this block immediately after the Appearance section (find it by searching `data-i18n="options.appearance"` after Step 4.2):

```html
<section class="settings-section">
  <h2 data-i18n="options.language">Language</h2>
  <select id="language-select">
    <option value="auto" data-i18n="options.languageAuto">Auto (follow browser)</option>
    <option value="en" data-i18n="options.languageEnglish">English</option>
    <option value="zh_CN" data-i18n="options.languageChinese">中文</option>
  </select>
</section>
```

If the existing options page already groups settings inside a different wrapper (e.g. `.card`, `.option-group`), match that structure instead of the generic `<section>` above. Read the surrounding HTML and follow it.

- [ ] **Step 4.4: Init i18n + bind dropdown in `options.js`**

Inside the existing `DOMContentLoaded` (or equivalent) handler, before any other init:

```javascript
if (window.i18n) await window.i18n.init();

const languageSelect = document.getElementById('language-select');
if (languageSelect && window.i18n) {
  languageSelect.value = window.i18n.getPreference();
  languageSelect.addEventListener('change', async (e) => {
    await window.i18n.setLanguage(e.target.value);
  });
}
```

`setLanguage` already persists to `chrome.storage.sync` and re-applies the DOM, so the page updates immediately.

- [ ] **Step 4.5: Replace dynamic strings**

Find every place `options.js` builds a string into the DOM (e.g. `${urls.length} saved URLs`). Replace with:

```javascript
const label = window.i18n
  ? window.i18n.t('options.savedUrlsCount', [String(urls.length)])
  : `${urls.length} saved URLs`;
```

- [ ] **Step 4.6: Add cross-page storage listener**

Add to the existing `chrome.storage.onChanged` listener in `options.js`:

```javascript
if (area === 'sync' && changes.language && window.i18n) {
  await window.i18n.reload();
  const sel = document.getElementById('language-select');
  if (sel) sel.value = window.i18n.getPreference();
}
```

- [ ] **Step 4.7: Smoke test**

1. Reload unpacked extension
2. Open options page → verify English renders, Language dropdown shows current preference (`Auto` for new installs)
3. Switch dropdown to `中文` → page text instantly switches to Chinese (well, English fallback for now since `zh_CN/messages.json` doesn't exist yet — verify there are no errors and selected English keys still render)
4. With popup open in another window → switching language in options should update popup live (verify via Console after Task 8 once `zh_CN` exists; for now confirm no errors)
5. Switch back to `Auto` → preference saved as `auto` (`window.i18n.getPreference()` returns `'auto'`)

- [ ] **Step 4.8: Commit**

```bash
git add options.html options.js
git commit -m "feat(options): wire i18n and add language dropdown"
```

---

## Task 5: Wire search overlay

**Files:**
- Modify: `bridge.html`
- Modify: `search-overlay.js`

- [ ] **Step 5.1: Add `i18n.js` to `bridge.html`**

The overlay scripts load via `bridge.html`. Add `<script src="i18n.js"></script>` as the **first** `<script>` in the `<body>`:

```html
<body>
  <script src="i18n.js"></script>
  <script src="theme-manager.js"></script>
  <!-- ... existing scripts ... -->
  <script src="search-overlay.js"></script>
</body>
```

- [ ] **Step 5.2: Init i18n in `search-overlay.js`**

The overlay constructs its DOM in JS, not via static HTML. Find the entry point (the IIFE or top-level setup that creates the overlay container). Before it builds the DOM:

```javascript
if (window.i18n) await window.i18n.init();
```

If the entry point isn't `async`, wrap it: `(async () => { ... })()`.

- [ ] **Step 5.3: Replace English literals**

For every string the overlay writes into its DOM (search input placeholder, "No results", footer hint labels), call `i18n.t`:

```javascript
// before
input.placeholder = 'Search tabs, bookmarks, history…';

// after
input.placeholder = window.i18n ? window.i18n.t('overlay.searchPlaceholder') : 'Search tabs, bookmarks, history…';
```

Apply to every `overlay.*` key from the catalog.

- [ ] **Step 5.4: Add storage listener for live switch**

When the overlay builds its DOM in Step 5.3, keep module-level references to each text-bearing node (e.g. `let searchInputEl`, `let noResultsEl`, `let navigateHintEl`, `let selectCloseHintEl`). Then add a single re-render helper and a storage listener:

```javascript
function rerenderStaticOverlayText() {
  if (!window.i18n) return;
  if (searchInputEl) searchInputEl.placeholder = window.i18n.t('overlay.searchPlaceholder');
  if (noResultsEl) noResultsEl.textContent = window.i18n.t('overlay.noResults');
  if (navigateHintEl) navigateHintEl.textContent = window.i18n.t('overlay.navigate');
  if (selectCloseHintEl) selectCloseHintEl.textContent = window.i18n.t('overlay.selectClose');
  // Add one line per static text node the overlay holds. Result list rows
  // are re-rendered on each keystroke and pick up the new language naturally.
}

if (chrome && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'sync' && changes.language && window.i18n) {
      await window.i18n.reload();
      rerenderStaticOverlayText();
    }
  });
}
```

If the overlay holds additional static nodes beyond the four above (e.g. an "Open search" hint), add a matching line to the helper.

- [ ] **Step 5.5: Smoke test**

1. Reload unpacked extension
2. Open any normal web page, press `Cmd+K` → overlay opens, English placeholder + hints render
3. Open options in another tab, switch Language → return to the page with overlay open → text updates without closing the overlay
4. DevTools console on the page: no errors

- [ ] **Step 5.6: Commit**

```bash
git add bridge.html search-overlay.js
git commit -m "feat(overlay): wire i18n into search overlay with live language switch"
```

---

## Task 6: Wire background notifications

**Files:**
- Modify: `background.js`

The service worker may be evicted between events, so re-init i18n on each notification.

- [ ] **Step 6.1: Add a top-level i18n loader to `background.js`**

`background.js` is a service worker — there's no `window` and no `<script>` tag mechanism. Add this near the top:

```javascript
// Lazy i18n loader for the service worker.
async function loadI18nMessages() {
  let preference = 'auto';
  try {
    const r = await chrome.storage.sync.get(['language']);
    preference = r.language || 'auto';
  } catch {}
  const browserLang = (chrome.i18n.getUILanguage() || '').toLowerCase();
  let lang;
  if (preference === 'en' || preference === 'zh_CN') {
    lang = preference;
  } else {
    lang = browserLang.startsWith('zh') ? 'zh_CN' : 'en';
  }
  try {
    const url = chrome.runtime.getURL('_locales/' + lang + '/messages.json');
    const res = await fetch(url);
    return { lang, dict: await res.json() };
  } catch {
    if (lang !== 'en') {
      const res = await fetch(chrome.runtime.getURL('_locales/en/messages.json'));
      return { lang: 'en', dict: await res.json() };
    }
    return { lang: 'en', dict: {} };
  }
}

function tFromDict(dict, key, substitutions) {
  const entry = dict[key];
  if (!entry) return key;
  let out = entry.message;
  if (entry.placeholders) {
    for (const [name, def] of Object.entries(entry.placeholders)) {
      const m = /^\$(\d+)$/.exec(def.content || '');
      if (!m) continue;
      const sub = substitutions && substitutions[parseInt(m[1], 10) - 1];
      if (sub === undefined) continue;
      out = out.split('$' + name + '$').join(String(sub));
    }
  }
  return out;
}
```

- [ ] **Step 6.2: Replace each `chrome.notifications.create` call**

For each of the 5 call sites (lines 145, 162, 173, 484, 502 in current code — line numbers will drift, find by `chrome.notifications.create`), wrap with the loader:

```javascript
// before
await chrome.notifications.create({
  type: 'basic',
  iconUrl: 'icons/icon48.png',
  title: 'Pounce',
  message: 'Please add URLs first before using this feature'
});

// after
{
  const { dict } = await loadI18nMessages();
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: tFromDict(dict, 'notify.title'),
    message: tFromDict(dict, 'notify.noUrls')
  });
}
```

Mapping per call site:
- Empty URLs → `notify.title` + `notify.noUrls`
- Open success → `notify.title` + `notify.openedCount` with `[String(urls.length)]`
- Open failure → `notify.errorTitle` + `notify.openError`
- Search failure → `notify.searchErrorTitle` + `notify.searchError`
- Onboarding install → `notify.installedTitle` + `notify.installedBody` with `[searchShortcut, batchShortcut]`

- [ ] **Step 6.3: Smoke test**

1. Reload unpacked
2. Trigger empty-URL notification: with no URLs configured, press `Cmd+Shift+U` → notification appears with English title + body
3. Configure 2 URLs in options, press `Cmd+Shift+U` → success notification with `Successfully opened 2 URLs`
4. Switch options Language to `中文` (still showing English fallback since `zh_CN` doesn't exist yet — verify no errors)
5. Test onboarding notification: Remove the extension, re-add it via Load unpacked → "Pounce Installed Successfully" notification appears

- [ ] **Step 6.4: Commit**

```bash
git add background.js
git commit -m "feat(background): localize notifications via lazy i18n loader"
```

---

## Task 7: Migrate manifest to `__MSG_xxx__`

**Files:**
- Modify: `manifest.json`

- [ ] **Step 7.1: Replace literal strings with placeholders + add default_locale + expose locale files**

Apply these changes:

```json
{
  "default_locale": "en",
  "name": "__MSG_ext_name__",
  "description": "__MSG_ext_description__",
  "action": {
    "default_popup": "popup.html",
    "default_title": "__MSG_action_title__"
  },
  "commands": {
    "open-all-urls": {
      "description": "__MSG_cmd_open_all__",
      "suggested_key": { "default": "Ctrl+Shift+U", "mac": "Command+Shift+U" }
    },
    "search-tabs-bookmarks": {
      "description": "__MSG_cmd_search__",
      "suggested_key": { "default": "Alt+K", "mac": "Command+K" }
    }
  },
  "web_accessible_resources": [
    {
      "matches": [ "<all_urls>" ],
      "resources": [ "search-overlay.css", "_locales/*/messages.json" ]
    }
  ]
}
```

Leave every other field (`background`, `icons`, `key`, `permissions`, `manifest_version`, `version`, `update_url`, `options_page`) untouched.

- [ ] **Step 7.2: Validate JSON**

Run: `python3 -c 'import json; json.load(open("manifest.json"))' && echo OK`
Expected: `OK`

- [ ] **Step 7.3: Smoke test**

1. Reload unpacked → no parse errors at `chrome://extensions`
2. Hover the toolbar icon → tooltip shows `Pounce – Search Tabs, Bookmarks & History`
3. Open `chrome://extensions` → name and description render
4. Open `chrome://extensions/shortcuts` → command descriptions render
5. Verify overlay still loads on a normal page (the new `_locales/*/messages.json` in `web_accessible_resources` shouldn't have broken anything)

- [ ] **Step 7.4: Commit**

```bash
git add manifest.json
git commit -m "feat(manifest): migrate metadata to __MSG__ placeholders + default_locale=en"
```

---

## Task 8: Add Simplified Chinese translation

**Files:**
- Create: `_locales/zh_CN/messages.json`

- [ ] **Step 8.1: Mirror every key from `en/messages.json`**

Open `_locales/en/messages.json`. For each key, write a Chinese translation, **keeping `placeholders` and key names identical**. Use natural Chinese — don't word-for-word translate. Reuse Pounce's existing zh-CN copy in `README.zh-CN.md` for vocabulary consistency (e.g. "搜索框" not "搜索覆盖层").

Translation reference (use as-is unless you have a better wording):

```json
{
  "ext_name": { "message": "Pounce – ⌘K 搜索标签页 & 书签", "description": "Extension name" },
  "ext_description": { "message": "一个快捷键，找到浏览器里的任何东西。按 ⌘K 同时搜索打开的标签页、书签、历史和常用站点。", "description": "Extension description" },
  "action_title": { "message": "Pounce – 搜索标签页、书签和历史", "description": "Toolbar tooltip" },
  "cmd_open_all": { "message": "打开所有已配置的 URL", "description": "Batch open command" },
  "cmd_search": { "message": "搜索打开的标签页和书签", "description": "Search command" },

  "popup.openSearch": { "message": "打开搜索框", "description": "Popup primary action" },
  "popup.openSearchHint": { "message": "在任意页面", "description": "Hint after Open search" },
  "popup.batchOpenURLs": { "message": "批量打开 URL", "description": "Section title" },
  "popup.openAll": { "message": "全部打开", "description": "Open all button" },
  "popup.addUrls": { "message": "+ 添加要批量打开的 URL", "description": "Empty state CTA" },
  "popup.manage": { "message": "管理 →", "description": "Manage link" },
  "popup.loading": { "message": "加载中…", "description": "Loading placeholder" },

  "options.title": { "message": "Pounce 设置", "description": "Options page title" },
  "options.appearance": { "message": "外观", "description": "Section header" },
  "options.darkMode": { "message": "深色模式", "description": "Theme group" },
  "options.lightMode": { "message": "浅色模式", "description": "Light theme" },
  "options.light": { "message": "浅色", "description": "Light button" },
  "options.dark": { "message": "深色", "description": "Dark button" },
  "options.system": { "message": "跟随系统", "description": "System button" },
  "options.followSystem": { "message": "跟随系统", "description": "System theme description" },

  "options.language": { "message": "语言", "description": "Language section" },
  "options.languageAuto": { "message": "自动（跟随浏览器）", "description": "Auto option" },
  "options.languageEnglish": { "message": "English", "description": "English option (kept native)" },
  "options.languageChinese": { "message": "中文", "description": "Chinese option" },

  "options.searchExperience": { "message": "搜索体验", "description": "Search section" },
  "options.highlightMatches": { "message": "高亮匹配文本", "description": "Highlight toggle" },
  "options.highlightMatchesDesc": { "message": "在结果标题和 URL 中突出显示匹配的文本。", "description": "Highlight description" },
  "options.pinyinToggle": { "message": "用拼音匹配中文标题", "description": "Pinyin toggle" },
  "options.pinyinToggleDesc": { "message": "输入 \"bd\" 或 \"baidu\" 找到 百度。非中文标题自动跳过。", "description": "Pinyin description" },
  "options.quickPick": { "message": "快速跳转", "description": "Quick pick toggle" },
  "options.quickPickDesc": { "message": "用 Alt/Option + 1-9 直接打开可见结果。", "description": "Quick pick description" },

  "options.batchOpen": { "message": "批量打开", "description": "Batch section" },
  "options.batchOpenURLs": { "message": "批量打开 URL", "description": "Batch URL header" },
  "options.savedUrlsCount": {
    "message": "已保存 $count$ 个 URL",
    "description": "Saved URL count",
    "placeholders": { "count": { "content": "$1" } }
  },
  "options.footer": { "message": "© 2025 Pounce", "description": "Footer" },

  "overlay.searchPlaceholder": { "message": "搜索标签页、书签、历史…", "description": "Overlay placeholder" },
  "overlay.noResults": { "message": "没有找到结果", "description": "Empty state" },
  "overlay.navigate": { "message": "切换", "description": "Navigate hint" },
  "overlay.selectClose": { "message": "选择 / 关闭", "description": "Select hint" },
  "overlay.openSearch": { "message": "打开搜索", "description": "Open search hint" },

  "notify.title": { "message": "Pounce", "description": "Generic notification title" },
  "notify.errorTitle": { "message": "Pounce - 错误", "description": "Error title" },
  "notify.searchErrorTitle": { "message": "Pounce - 搜索错误", "description": "Search error title" },
  "notify.installedTitle": { "message": "Pounce 安装成功", "description": "Onboarding title" },
  "notify.noUrls": { "message": "请先在设置里添加 URL 再使用此功能", "description": "Empty URL list" },
  "notify.openedCount": {
    "message": "已成功打开 $count$ 个 URL",
    "description": "Open success",
    "placeholders": { "count": { "content": "$1" } }
  },
  "notify.openError": { "message": "打开 URL 时出错，请检查 URL 配置", "description": "Open failure" },
  "notify.searchError": { "message": "搜索失败", "description": "Search failure" },
  "notify.installedBody": {
    "message": "按 $search$ 搜索标签页和书签。按 $batch$ 批量打开 URL。",
    "description": "Onboarding body",
    "placeholders": {
      "search": { "content": "$1" },
      "batch": { "content": "$2" }
    }
  }
}
```

If you added extra keys in Task 2 beyond this template, **mirror them into Chinese here**. The two files must have identical key sets.

- [ ] **Step 8.2: Verify key parity**

Run:

```bash
python3 -c '
import json
en = set(json.load(open("_locales/en/messages.json")).keys())
zh = set(json.load(open("_locales/zh_CN/messages.json")).keys())
missing_zh = en - zh
missing_en = zh - en
if missing_zh: print("missing in zh_CN:", missing_zh)
if missing_en: print("missing in en:", missing_en)
if not missing_zh and not missing_en: print("OK: key parity")
'
```

Expected: `OK: key parity`. If anything is missing, fix it.

- [ ] **Step 8.3: Full smoke test**

1. Set Chrome UI language to Simplified Chinese (`chrome://settings/languages` → move 中文 to top → Restart). Or skip and just use the manual override.
2. Reload unpacked extension
3. Open popup → verify all Chinese
4. Open options → verify all Chinese, Language dropdown shows `自动（跟随浏览器）`
5. Switch dropdown to `English` → page flips to English live; popup also flips when reopened or via storage event
6. Switch back to `中文` → page flips to Chinese
7. Open a normal web page, press `Cmd+K` → overlay placeholder + hints in Chinese
8. With 2 URLs configured, press `Cmd+Shift+U` → notification "已成功打开 2 个 URL"
9. Re-add the extension fresh → onboarding notification in Chinese
10. Open `chrome://extensions` → Pounce description and command descriptions in Chinese (only respects browser UI language — manual override does NOT affect manifest fields, by design)

- [ ] **Step 8.4: Commit**

```bash
git add _locales/zh_CN/messages.json
git commit -m "feat(i18n): add Simplified Chinese translation"
```

---

## Task 9: Update build script

**Files:**
- Modify: `build.sh`

- [ ] **Step 9.1: Add `i18n.js` and `_locales` to FILES array**

In `build.sh`, modify the `FILES=( ... )` block to include the new entries (alphabetical or grouped — match existing style):

```bash
FILES=(
  manifest.json
  background.js
  popup.html
  popup.js
  options.html
  options.js
  options-theme-sync.js
  theme-manager.js
  preferences.js
  i18n.js
  _locales
  search-overlay.js
  search-overlay.css
  search-ranking.js
  pinyin-index.js
  pinyin-matcher.js
  vendor
  bridge.html
  icons
)
```

The existence-check loop already handles directories, so `_locales` will work out of the box.

- [ ] **Step 9.2: Verify build runs**

Run: `./build.sh 1.5.0-test`
Expected: `built pounce-1.5.0-test.zip`. The output should NOT include the auto-tag step (only fires when no version arg).

Verify the zip contains the new files:

```bash
unzip -l pounce-1.5.0-test.zip | grep -E "i18n|_locales"
```

Expected: shows `i18n.js`, `_locales/en/messages.json`, `_locales/zh_CN/messages.json`.

- [ ] **Step 9.3: Clean up the test artifact**

```bash
rm pounce-1.5.0-test.zip
```

- [ ] **Step 9.4: Commit**

```bash
git add build.sh
git commit -m "chore(build): include i18n.js and _locales/ in extension package"
```

---

## Task 10: Bump version, update changelog, build release

**Files:**
- Modify: `manifest.json`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 10.1: Bump version to 1.5.0**

In `manifest.json`, change `"version": "1.4.7"` → `"version": "1.5.0"`. (Minor bump because new user-visible feature.)

- [ ] **Step 10.2: Add changelog entries**

In `README.md`, find the Changelog section (look at `git show 3f012e6 -- README.md` for the format). Add the 1.5.0 entry above the 1.4.7 entry:

```markdown
- **v1.5.0** — Added Simplified Chinese localization. Auto-detects browser language; manual override in Settings → Language.
```

In `README.zh-CN.md`, mirror in Chinese:

```markdown
- **v1.5.0** —— 新增简体中文界面。自动跟随浏览器语种；可在 设置 → 语言 手动切换。
```

If the existing format uses different bullet style or English/Chinese phrasing, **match the surrounding entries** rather than the templates above.

- [ ] **Step 10.3: Final regression pass**

Repeat the smoke test from Task 8 Step 8.3 once more with the bumped version. Confirm everything still works after all edits.

- [ ] **Step 10.4: Build the release zip**

Run: `./build.sh`
Expected: `built pounce-1.5.0.zip`, then `tagged v1.5.0 → push with: git push origin v1.5.0`.

- [ ] **Step 10.5: Commit version + changelog**

```bash
git add manifest.json README.md README.zh-CN.md pounce-1.5.0.zip
git commit -m "chore(release): bump to 1.5.0 with i18n support"
```

The git tag was created automatically by `build.sh`. Do NOT push it — leave that for the user to run manually.

---

## Done

After Task 10, the user can:

1. Inspect `pounce-1.5.0.zip` and upload it to the Chrome Web Store
2. Push the tag with `git push origin v1.5.0` when ready

Adding new languages later only requires creating `_locales/<lang>/messages.json` with the same keys — no code changes.
