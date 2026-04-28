# Search Result Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Highlight matched characters of the search query in result titles and URLs of pounce's overlay (issue #2, highlight portion).

**Architecture:** Add a pure `getHighlightRanges(text, query)` helper to `search-ranking.js`; matcher and `rankResults` stay untouched. At render time in `search-overlay.js`, scan `displayTitle`/`displayUrl` for the current query, wrap matched substrings in `<span class="pounce-highlight">` using `createElement` + `textContent` (no `innerHTML`). Synthetic items (`search`/`open`) skip highlighting. Style: `font-weight: 600` + `color: var(--pn-primary)`.

**Tech Stack:** Vanilla JS Chrome MV3 extension (no bundler), `node:test` for unit tests.

**Reference:** Spec `docs/superpowers/specs/2026-04-28-search-result-highlight-design.md` and issue [#2](https://github.com/TuYv/pounce/issues/2).

---

## File Map

| File | Change |
|------|--------|
| `search-ranking.js` | + `getHighlightRanges(text, query)` function + export on `api` |
| `tests/search-ranking.test.js` | + 11 test cases for `getHighlightRanges` |
| `search-overlay.js` | + `renderHighlightedText` IIFE-scoped helper; modify `renderResults(query='')` + `createResultElement(item, index, query='')`; add highlight branch in render |
| `search-overlay.css` | + `.pounce-highlight` selector under result-title / result-url |

---

## Task 1: `getHighlightRanges` — pure helper + tests (TDD)

**Files:**
- Modify: `tests/search-ranking.test.js` (append 12 tests — 1 export check + 11 behavior cases)
- Modify: `search-ranking.js` (add function inside IIFE, append to `api`)

- [ ] **Step 1: Write the failing tests**

First, edit the top destructuring import in `tests/search-ranking.test.js`:

```javascript
// before
const { rankResults, getDisplayTitle } = require('../search-ranking.js');

// after
const { rankResults, getDisplayTitle, getHighlightRanges } = require('../search-ranking.js');
```

Then append after the existing `test(...)` blocks, before EOF:

```javascript
test('getHighlightRanges is exposed on the helper api', () => {
  assert.equal(globalThis.PounceSearchUtils.getHighlightRanges, getHighlightRanges);
});

test('getHighlightRanges returns single range for single occurrence', () => {
  assert.deepEqual(getHighlightRanges('GitHub', 'git'), [[0, 3]]);
});

test('getHighlightRanges returns all occurrences in order', () => {
  assert.deepEqual(getHighlightRanges('Google Docs - Google', 'go'), [[0, 2], [15, 17]]);
});

test('getHighlightRanges is case-insensitive but preserves source positions', () => {
  assert.deepEqual(getHighlightRanges('GitHub', 'GIT'), [[0, 3]]);
});

test('getHighlightRanges treats regex meta characters literally', () => {
  assert.deepEqual(getHighlightRanges('a.b.c', '.'), [[1, 2], [3, 4]]);
});

test('getHighlightRanges handles overlapping matches without infinite loop', () => {
  assert.deepEqual(getHighlightRanges('aaaa', 'aa'), [[0, 2], [2, 4]]);
});

test('getHighlightRanges returns [] for empty query', () => {
  assert.deepEqual(getHighlightRanges('GitHub', ''), []);
});

test('getHighlightRanges returns [] for whitespace-only query', () => {
  assert.deepEqual(getHighlightRanges('GitHub', '   '), []);
});

test('getHighlightRanges returns [] for null/undefined text', () => {
  assert.deepEqual(getHighlightRanges(null, 'git'), []);
  assert.deepEqual(getHighlightRanges(undefined, 'git'), []);
});

test('getHighlightRanges returns [] when query is longer than text', () => {
  assert.deepEqual(getHighlightRanges('git', 'github'), []);
});

test('getHighlightRanges returns [] when query is not found', () => {
  assert.deepEqual(getHighlightRanges('GitHub', 'foo'), []);
});

test('getHighlightRanges supports CJK substrings', () => {
  assert.deepEqual(getHighlightRanges('支付宝官网', '官网'), [[3, 5]]);
});
```

- [ ] **Step 2: Run tests — expect 12 failures**

Run: `node --test tests/search-ranking.test.js`

Expected: 12 new tests fail (most likely with `getHighlightRanges is not a function` or similar). The original tests stay green.

- [ ] **Step 3: Implement `getHighlightRanges` in `search-ranking.js`**

In `search-ranking.js`, locate the existing `function rankResults(...)` declaration. Insert this new function **before** `rankResults` (anywhere inside the IIFE is fine, but near `rankResults` keeps related code together):

```javascript
  function getHighlightRanges(text, query) {
    if (typeof text !== 'string' || text.length === 0) {
      return [];
    }
    if (typeof query !== 'string') {
      return [];
    }
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0 || trimmedQuery.length > text.length) {
      return [];
    }

    const haystack = text.toLowerCase();
    const needle = trimmedQuery.toLowerCase();
    const ranges = [];
    let pos = 0;

    while (pos <= haystack.length - needle.length) {
      const idx = haystack.indexOf(needle, pos);
      if (idx === -1) break;
      ranges.push([idx, idx + needle.length]);
      pos = idx + needle.length;
    }

    return ranges;
  }
```

Then update the `api` object near the bottom of the same IIFE to expose it:

```javascript
  const api = {
    rankResults,
    getDisplayTitle,
    getHighlightRanges
  };
```

- [ ] **Step 4: Run tests — expect all pass**

Run: `node --test tests/search-ranking.test.js`

Expected: all tests pass (existing + 12 new).

- [ ] **Step 5: Commit**

```bash
git add search-ranking.js tests/search-ranking.test.js
git commit -m "feat(search): add getHighlightRanges helper for matched-char highlighting"
```

---

## Task 2: `renderHighlightedText` DOM helper

**Files:**
- Modify: `search-overlay.js` (add helper inside the IIFE/class scope, near top of class or as a module-scoped function)

This task does not have a unit test (pounce has no jsdom dependency; helper is verified manually in Task 5).

- [ ] **Step 1: Add the helper as a private method on the overlay class**

In `search-overlay.js`, find the class that owns `renderResults()` (the same class — search for `renderResults() {`). Add this method anywhere inside the class body (suggested: directly above `renderResults()`):

```javascript
    renderHighlightedText(textEl, text, ranges) {
      // Always reset the element first.
      textEl.textContent = '';

      const safeText = typeof text === 'string' ? text : '';
      const safeRanges = Array.isArray(ranges) ? ranges : [];

      if (safeRanges.length === 0) {
        textEl.textContent = safeText;
        return;
      }

      let cursor = 0;
      for (const range of safeRanges) {
        const start = range[0];
        const end = range[1];
        if (start > cursor) {
          textEl.appendChild(document.createTextNode(safeText.slice(cursor, start)));
        }
        const span = document.createElement('span');
        span.className = 'pounce-highlight';
        span.textContent = safeText.slice(start, end);
        textEl.appendChild(span);
        cursor = end;
      }

      if (cursor < safeText.length) {
        textEl.appendChild(document.createTextNode(safeText.slice(cursor)));
      }
    }
```

- [ ] **Step 2: Sanity check by loading the extension (optional at this stage)**

Helper is unused yet; loading the extension should be a no-op behavior change. Skip if iterating fast — Task 3 is where it gets wired.

- [ ] **Step 3: Commit**

```bash
git add search-overlay.js
git commit -m "feat(search): add renderHighlightedText DOM helper"
```

---

## Task 3: Wire highlight into `renderResults` / `createResultElement`

**Files:**
- Modify: `search-overlay.js`
  - `renderResults` definition (line ~594): add `query = ''` parameter; pass it to `createResultElement`
  - The single call site in `rerankAndRender` (line ~404): pass `query` through
  - `createResultElement(item, index)` definition (line ~622+): add `query = ''` parameter; replace `title.textContent = ...` and `url.textContent = ...` with the highlight branch

- [ ] **Step 1: Update `renderResults` signature and inner call**

Find this block in `search-overlay.js` (around line 594):

```javascript
    renderResults() {
      if (!this.currentResults.length) {
        this.showEmpty();
        return;
      }
      
      this.resultsContainer.innerHTML = '';
      
      this.currentResults.forEach((item, index) => {
        const resultElement = this.createResultElement(item, index);
        this.resultsContainer.appendChild(resultElement);
      });
```

Change to:

```javascript
    renderResults(query = '') {
      if (!this.currentResults.length) {
        this.showEmpty();
        return;
      }
      
      this.resultsContainer.innerHTML = '';
      
      this.currentResults.forEach((item, index) => {
        const resultElement = this.createResultElement(item, index, query);
        this.resultsContainer.appendChild(resultElement);
      });
```

(Remember `renderResults` may have more body below — leave the rest unchanged.)

- [ ] **Step 2: Update the single call site in `rerankAndRender`**

Find around line 404:

```javascript
      this.renderResults();
```

Change to:

```javascript
      this.renderResults(query);
```

(`query` is the existing parameter of `rerankAndRender(query)` declared at line 392 — it is already in scope.)

- [ ] **Step 3: Update `createResultElement` signature and the title/url render branch**

Find the function signature `createResultElement(item, index)` (search for `createResultElement` — it lives around line 622). Change the signature to:

```javascript
    createResultElement(item, index, query = '') {
```

Then inside the function, locate this block (around lines 663–669):

```javascript
      const title = document.createElement('div');
      title.className = 'pounce-result-title';
      title.textContent = item.displayTitle || item.title || 'Untitled';
      
      const url = document.createElement('div');
      url.className = 'pounce-result-url';
      url.textContent = item.displayUrl || item.url || '';
```

Replace with:

```javascript
      const HIGHLIGHTABLE_TYPES = ['tab', 'history', 'topSite', 'bookmark'];
      const titleText = item.displayTitle || item.title || 'Untitled';
      const urlText = item.displayUrl || item.url || '';
      const isHighlightable = HIGHLIGHTABLE_TYPES.includes(item.type) && typeof query === 'string' && query.trim().length > 0;
      const ranger = (typeof globalThis !== 'undefined' && globalThis.PounceSearchUtils && globalThis.PounceSearchUtils.getHighlightRanges) || null;

      const title = document.createElement('div');
      title.className = 'pounce-result-title';
      if (isHighlightable && ranger) {
        this.renderHighlightedText(title, titleText, ranger(titleText, query));
      } else {
        title.textContent = titleText;
      }

      const url = document.createElement('div');
      url.className = 'pounce-result-url';
      if (isHighlightable && ranger) {
        this.renderHighlightedText(url, urlText, ranger(urlText, query));
      } else {
        url.textContent = urlText;
      }
```

(The `ranger` lookup defends against script load order — if `search-ranking.js` somehow hasn't loaded, render falls back to plain `textContent` instead of throwing.)

- [ ] **Step 4: Reload the extension and smoke test**

In Chrome: `chrome://extensions` → reload pounce → press `⌘K`/`Alt+K` on any tab → type a query (e.g. `git`).

Expected: matched characters in result title and URL are bold + theme-primary color. Synthetic `Search for "..."` row remains plain.

- [ ] **Step 5: Commit**

```bash
git add search-overlay.js
git commit -m "feat(search): highlight query matches in result title and URL"
```

---

## Task 4: CSS for `.pounce-highlight`

**Files:**
- Modify: `search-overlay.css` (append a new selector block after the existing `.pounce-result-url` block around line ~289–298, or anywhere after `.pounce-result-title` — placement does not affect behavior)

- [ ] **Step 1: Append the new rule**

Add at the end of `search-overlay.css` (or after the result-title / result-url section if you prefer co-location):

```css
/* Highlighted query matches inside result title / URL */
.pounce-result-title .pounce-highlight,
.pounce-result-url .pounce-highlight {
  font-weight: 600;
  color: var(--pn-primary);
}
```

- [ ] **Step 2: Reload the extension and verify visually**

Reload extension. Open overlay, type a query, confirm highlighted segments now render as bold + primary color in both light and dark themes.

- [ ] **Step 3: Commit**

```bash
git add search-overlay.css
git commit -m "feat(search): style highlighted query matches with primary color"
```

---

## Task 5: Manual verification checklist

This is the gate before merging. Walk through every item; if any fails, fix and re-verify before committing further changes.

- [ ] **English query** — type `git` on a page where you have GitHub bookmarks/tabs/history. Title and URL both show bold primary-color "Git" / "git".
- [ ] **CJK query** — type `知乎` (or another CJK substring you have in history). The matched Chinese characters are highlighted.
- [ ] **Regex meta chars** — type `.com`. No errors in the devtools console; matches still render.
- [ ] **Selected state** — use ↑/↓ to select a row. Highlighted text stays clearly visible against `--pn-accent` background.
- [ ] **Light & dark themes** — toggle the system / extension theme; verify both modes are legible.
- [ ] **Synthetic rows** — `Search for "..."` and `Open https://...` rows do **not** highlight any substring of the query.
- [ ] **Clear input** — backspace until empty; all highlighted spans disappear, items render as plain text.
- [ ] **Rapid typing** — type a long query fast (e.g. `googledocstabs`); no leftover/stale `<span>` artifacts (inspect a few rows in DevTools).
- [ ] **Long titles** — find a result with a title that triggers ellipsis (`…`); the trailing ellipsis still appears correctly with highlights present.
- [ ] **Empty results** — type something with no matches at all; "no results" UI is unchanged.

If everything passes, the feature is ready.

---

## Self-Review Notes (post-write check)

- Spec coverage: every item in `Decisions Summary`, `Components`, `Boundary cases`, and `Tests` of the spec maps to a task above. Tasks 1–4 implement the four files listed in the spec's "Implementation Impact" table; Task 5 covers the spec's manual verification list.
- Placeholder scan: no TBDs/TODOs; every step has either complete code, an exact command, or a precise UI action.
- Type consistency: `getHighlightRanges`, `renderHighlightedText`, `renderResults`, `createResultElement` parameter names match across tasks.
- Spec said "three call sites for `renderResults`" — actual code has only one (`rerankAndRender` line 404). Plan reflects reality; default `query = ''` keeps any future callers safe with no behavior change.
