# QuickFind Direct URL Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make URL-like input open directly in QuickFind, while preserving ordinary search behavior for non-URL queries and keeping strong real autocomplete-style URL matches ahead of the synthetic open action.

**Architecture:** Extend `search-ranking.js` so it can detect address intent, normalize direct-open URLs, and emit a synthetic `open` result ahead of the existing `search` result. Then update `search-overlay.js` and `search-overlay.css` so the overlay can render and execute the new `open` result type, with a small degraded-mode fallback when the helper is unavailable.

**Tech Stack:** Manifest V3 extension APIs, plain JavaScript, HTML/CSS, Node `--test`, Node syntax checks

---

## File Structure

- Modify: `search-ranking.js`
  Add URL-intent detection, URL normalization, and synthetic `open` result generation inside the existing ranking helper.
- Modify: `tests/search-ranking.test.js`
  Add automated coverage for domain, localhost, IP, non-URL query, and real-match-vs-open ordering cases.
- Modify: `search-overlay.js`
  Render `open` results, handle Enter/click selection for `open`, and append a simple fallback `open` result when helper injection is unavailable.
- Modify: `search-overlay.css`
  Add styles for the new `open` result icon/badge.

### Task 1: Add Direct-Open Ranking Logic

**Files:**
- Modify: `search-ranking.js`
- Modify: `tests/search-ranking.test.js`

- [ ] **Step 1: Add failing tests for direct-open behavior**

Append these tests to `tests/search-ranking.test.js`:

```js
test('complete domain input adds an open result before search', () => {
  const results = rankResults([], 'google.com', 10);

  assert.deepEqual(
    results.map((item) => item.type),
    ['open', 'search']
  );
  assert.equal(results[0].url, 'https://google.com');
  assert.equal(results[0].displayTitle, 'Open https://google.com');
});

test('localhost and private ip inputs normalize to http', () => {
  const localhostResults = rankResults([], 'localhost:3000', 10);
  const ipResults = rankResults([], '192.168.1.1', 10);

  assert.equal(localhostResults[0].type, 'open');
  assert.equal(localhostResults[0].url, 'http://localhost:3000');
  assert.equal(ipResults[0].type, 'open');
  assert.equal(ipResults[0].url, 'http://192.168.1.1');
});

test('strong real url matches stay ahead of synthetic open results', () => {
  const results = rankResults([
    {
      type: 'history',
      id: 'history:1',
      title: 'Google',
      url: 'https://www.google.com/',
      typedCount: 10,
      visitCount: 30,
      lastVisitTime: 400
    }
  ], 'google.com', 10);

  assert.deepEqual(
    results.map((item) => item.type),
    ['history', 'open', 'search']
  );
  assert.equal(results[1].url, 'https://google.com');
});

test('non-url search phrases do not create synthetic open results', () => {
  const results = rankResults([], 'openai api', 10);
  assert.deepEqual(results.map((item) => item.type), ['search']);
});

test('partial hostname input prefers real matches and does not force synthetic open', () => {
  const results = rankResults([
    {
      type: 'history',
      id: 'history:1',
      title: 'Google',
      url: 'https://www.google.com/',
      typedCount: 12,
      visitCount: 40,
      lastVisitTime: 500
    }
  ], 'googl', 10);

  assert.equal(results[0].type, 'history');
  assert.equal(results.some((item) => item.type === 'open'), false);
  assert.equal(results.at(-1).type, 'search');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
node --test tests/search-ranking.test.js
```

Expected: FAIL because `rankResults()` does not yet create `open` results or normalize direct URLs.

- [ ] **Step 3: Implement direct-open helpers and ranking output**

Update `search-ranking.js` with these additions and changes:

```js
  const SOURCE_PRIORITY = {
    tab: 0,
    history: 1,
    topSite: 2,
    bookmark: 3,
    open: 4,
    search: 5
  };

  const SOURCE_LABELS = {
    history: 'History',
    topSite: 'Top Site',
    bookmark: 'Bookmark',
    open: 'Open',
    search: 'Search'
  };

  const ICON_FALLBACKS = {
    tab: 'T',
    history: 'H',
    topSite: 'S',
    bookmark: 'B',
    open: 'O',
    search: 'S'
  };

  function looksLikeIpv4Host(value) {
    return /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#].*)?$/i.test(value);
  }

  function looksLikeLocalhost(value) {
    return /^localhost(?::\d+)?(?:[/?#].*)?$/i.test(value);
  }

  function looksLikeDomain(value) {
    return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[:/?#].*)?$/i.test(value);
  }

  function looksLikeDirectUrlInput(value) {
    const raw = String(value || '').trim();
    if (!raw || /\s/.test(raw)) {
      return false;
    }

    if (/^https?:\/\//i.test(raw)) {
      return true;
    }

    return looksLikeLocalhost(raw) || looksLikeIpv4Host(raw) || looksLikeDomain(raw);
  }

  function normalizeDirectUrlInput(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    if (looksLikeLocalhost(raw) || looksLikeIpv4Host(raw)) {
      return `http://${raw}`;
    }

    return `https://${raw}`;
  }

  function getOpenOption(query) {
    if (!looksLikeDirectUrlInput(query)) {
      return null;
    }

    const normalizedUrl = normalizeDirectUrlInput(query);
    return {
      type: 'open',
      id: `open:${normalizedUrl}`,
      title: `Open ${normalizedUrl}`,
      url: normalizedUrl,
      displayTitle: `Open ${normalizedUrl}`,
      displayUrl: normalizedUrl,
      sourceLabel: getSourceLabel('open'),
      iconFallback: getIconFallback('open'),
      isOpenOption: true
    };
  }
```

Keep the current non-empty real-result ranking intact, then change the `rankResults()` return tail to:

```js
    const openOption = getOpenOption(String(query || '').trim());
    const resultsWithActions = [...clipped];

    if (openOption) {
      resultsWithActions.push(openOption);
    }

    resultsWithActions.push(getSearchOption(String(query || '').trim()));
    return resultsWithActions;
```

- [ ] **Step 4: Run the tests to verify the helper passes**

Run:

```bash
node --test tests/search-ranking.test.js
```

Expected: PASS with the old tests plus the new direct-open tests all passing.

- [ ] **Step 5: Skip commit in this workspace**

This directory is not a Git repository. Do not create a commit here.

If the same changes are replayed later in the real repo checkout, use:

```bash
git add search-ranking.js tests/search-ranking.test.js
git commit -m "feat: add direct url open suggestions"
```

### Task 2: Render and Execute the New `open` Result

**Files:**
- Modify: `search-overlay.js`
- Modify: `search-overlay.css`

- [ ] **Step 1: Update the overlay fallback path to support direct-open results**

In `search-overlay.js`, add a tiny degraded-mode helper near `getFallbackResults()`:

```js
    getFallbackOpenResult(query) {
      const trimmedQuery = String(query || '').trim();
      if (!trimmedQuery || /\s/.test(trimmedQuery)) {
        return null;
      }

      const looksLikeIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#].*)?$/i.test(trimmedQuery);
      const looksLikeLocalhost = /^localhost(?::\d+)?(?:[/?#].*)?$/i.test(trimmedQuery);
      const looksLikeDomain = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[:/?#].*)?$/i.test(trimmedQuery);
      const hasProtocol = /^https?:\/\//i.test(trimmedQuery);

      if (!hasProtocol && !looksLikeIpv4 && !looksLikeLocalhost && !looksLikeDomain) {
        return null;
      }

      const normalizedUrl = hasProtocol
        ? trimmedQuery
        : (looksLikeIpv4 || looksLikeLocalhost)
          ? `http://${trimmedQuery}`
          : `https://${trimmedQuery}`;

      return {
        type: 'open',
        id: `open:${normalizedUrl}`,
        title: `Open ${normalizedUrl}`,
        url: normalizedUrl,
        displayTitle: `Open ${normalizedUrl}`,
        displayUrl: normalizedUrl,
        sourceLabel: 'Open',
        iconFallback: 'O',
        isOpenOption: true
      };
    }
```

Then change the tail of `getFallbackResults()` to:

```js
      const openResult = this.getFallbackOpenResult(trimmedQuery);

      if (!trimmedQuery) {
        return results;
      }

      if (openResult) {
        results.push(openResult);
      }

      results.push({
        type: 'search',
        id: 'web-search',
        title: `Search for "${trimmedQuery}"`,
        url: `search:${trimmedQuery}`,
        displayTitle: `Search for "${trimmedQuery}"`,
        displayUrl: 'Search with default search engine',
        sourceLabel: 'Search',
        iconFallback: 'S',
        isSearchOption: true
      });

      return results;
```

- [ ] **Step 2: Render `open` results distinctly and make Enter open them**

In `search-overlay.js`, update `createResultElement()` and `selectResult()`:

```js
      if (item.type === 'search') {
        icon.innerHTML = `...existing search svg...`;
        element.classList.add('search-option');
      } else if (item.type === 'open') {
        icon.textContent = item.iconFallback || 'O';
        element.classList.add('open-option');
      } else if (item.favIconUrl && item.favIconUrl !== '') {
```

And update selection handling:

```js
        if (item.type === 'search') {
          const searchQuery = item.url.replace('search:', '');
          await chrome.runtime.sendMessage({
            action: 'performWebSearch',
            query: searchQuery
          });
        } else if (item.type === 'tab') {
          await chrome.runtime.sendMessage({
            action: 'switchToTab',
            tabId: item.id
          });
        } else if (item.type === 'open') {
          await chrome.runtime.sendMessage({
            action: 'openBookmark',
            url: item.url
          });
        } else {
          await chrome.runtime.sendMessage({
            action: 'openBookmark',
            url: item.url
          });
        }
```

Keep the first-item auto-selection behavior unchanged so Enter opens the top ranked direct-open candidate when it is first.

- [ ] **Step 3: Add `open` styling**

In `search-overlay.css`, add these selectors alongside the existing source styles:

```css
.quickfind-result-icon.open:not(:has(img)) {
  background-color: #10b981;
  color: #ffffff;
}

.quickfind-result-badge-open {
  background: rgba(16, 185, 129, 0.16);
  color: #059669;
}

.quickfind-search-result.open-option .quickfind-result-title {
  font-weight: 600;
}
```

- [ ] **Step 4: Run syntax verification for the overlay integration**

Run:

```bash
node --check search-overlay.js
```

Expected: no syntax output and exit code `0`.

- [ ] **Step 5: Skip commit in this workspace**

This directory is not a Git repository. Do not commit here.

If replayed later in the real repo checkout:

```bash
git add search-overlay.js search-overlay.css
git commit -m "feat: open url-like quickfind queries directly"
```

### Task 3: Final Verification

**Files:**
- No file changes expected

- [ ] **Step 1: Re-run the helper test suite**

Run:

```bash
node --test tests/search-ranking.test.js
```

Expected: PASS with all ranking and direct-open tests passing.

- [ ] **Step 2: Re-run syntax checks for touched JS files**

Run:

```bash
node --check search-ranking.js
```

Run:

```bash
node --check search-overlay.js
```

Expected: both commands exit `0`.

- [ ] **Step 3: Manually verify the extension in Chrome**

Manual checklist:

1. Reload the unpacked extension at `chrome://extensions`
2. Open a normal webpage, trigger `Alt+K` / `Command+K`
3. Type `google.com`
   Expected: a real `google.com` match or `Open https://google.com` is selected before `Search for "google.com"`
4. Type `github.com/openai`
   Expected: `Open https://github.com/openai` appears and opens directly on Enter
5. Type `localhost:3000`
   Expected: `Open http://localhost:3000`
6. Type `192.168.1.1`
   Expected: `Open http://192.168.1.1`
7. Type `googl`
   Expected: real autocomplete-style matches like `google.com` can appear, but there is no forced `Open https://googl`
8. Type `openai api`
   Expected: no synthetic `open` result; normal search behavior remains
9. Test popup-triggered search on a restricted page such as `chrome://extensions`
   Expected: graceful failure or popup fallback, not a silent close with no result

- [ ] **Step 4: Skip commit in this workspace**

This directory is not a Git repository. Do not create an empty completion commit here.

If replayed later in the real repo checkout and all checks pass:

```bash
git add search-ranking.js tests/search-ranking.test.js search-overlay.js search-overlay.css
git commit -m "test: verify quickfind direct url open flow"
```
