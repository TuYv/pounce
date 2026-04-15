# QuickFind History Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the `Alt+K` / `Command+K` overlay so it suggests tabs, history, top sites, and bookmarks with Chrome-like URL-first ranking.

**Architecture:** Keep the existing MV3 extension structure, but move ranking, URL normalization, deduplication, and display fallbacks into a pure helper module that can be tested with Node’s built-in test runner. Let `background.js` gather normalized search items from Chrome APIs, and let `search-overlay.js` render ranked results using the helper while preserving the existing selection and keyboard flow.

**Tech Stack:** Manifest V3 extension APIs, plain JavaScript, HTML/CSS, Node `--test` for pure helper tests

---

### Task 1: Add a testable ranking helper

**Files:**
- Create: `search-ranking.js`
- Create: `tests/search-ranking.test.js`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { rankResults, getDisplayTitle } = require('../search-ranking.js');

test('hostname prefix history matches outrank bookmarks and append search action', () => {
  const results = rankResults([
    {
      type: 'bookmark',
      id: 'bookmark:1',
      title: 'Google Docs',
      url: 'https://docs.google.com/document/d/1'
    },
    {
      type: 'history',
      id: 'history:1',
      title: '',
      url: 'https://www.google.com/',
      typedCount: 9,
      visitCount: 40,
      lastVisitTime: 500
    },
    {
      type: 'topSite',
      id: 'top-site:1',
      title: 'Google',
      url: 'https://www.google.com/'
    }
  ], 'goo', 10);

  assert.equal(results[0].type, 'history');
  assert.equal(results[0].displayUrl, 'google.com');
  assert.equal(results.at(-1).type, 'search');
});

test('dedupe keeps the highest priority source for the same URL', () => {
  const results = rankResults([
    {
      type: 'bookmark',
      id: 'bookmark:1',
      title: 'GitHub Bookmark',
      url: 'https://github.com/'
    },
    {
      type: 'history',
      id: 'history:1',
      title: 'GitHub',
      url: 'https://github.com/',
      typedCount: 4,
      visitCount: 10,
      lastVisitTime: 200
    },
    {
      type: 'tab',
      id: 17,
      title: 'GitHub - Home',
      url: 'https://github.com/',
      lastAccessed: 1000
    }
  ], 'git', 10);

  const githubResults = results.filter((item) => item.type !== 'search');
  assert.equal(githubResults.length, 1);
  assert.equal(githubResults[0].type, 'tab');
});

test('empty query keeps tabs first, then history, then top sites, then bookmarks', () => {
  const results = rankResults([
    {
      type: 'bookmark',
      id: 'bookmark:1',
      title: 'MDN',
      url: 'https://developer.mozilla.org/'
    },
    {
      type: 'topSite',
      id: 'top-site:1',
      title: 'Stack Overflow',
      url: 'https://stackoverflow.com/'
    },
    {
      type: 'history',
      id: 'history:1',
      title: 'Google',
      url: 'https://www.google.com/',
      typedCount: 12,
      visitCount: 30,
      lastVisitTime: 900
    },
    {
      type: 'tab',
      id: 99,
      title: 'Current Tab',
      url: 'https://example.com/',
      lastAccessed: 1200
    }
  ], '', 10);

  assert.deepEqual(results.map((item) => item.type), ['tab', 'history', 'topSite', 'bookmark']);
});

test('display title falls back to hostname when history title is empty', () => {
  assert.equal(
    getDisplayTitle({
      type: 'history',
      title: '',
      url: 'https://calendar.google.com/calendar/u/0/r'
    }),
    'calendar.google.com'
  );
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run:

```bash
node --test tests/search-ranking.test.js
```

Expected: FAIL with `Cannot find module '../search-ranking.js'`.

- [ ] **Step 3: Write the helper implementation**

Create `search-ranking.js` with this content:

```js
(function attachQuickFindSearchUtils(root) {
  const SOURCE_PRIORITY = {
    tab: 0,
    history: 1,
    topSite: 2,
    bookmark: 3,
    search: 4
  };

  const SOURCE_LABELS = {
    bookmark: 'Bookmark',
    history: 'History',
    topSite: 'Top'
  };

  function safeText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function parseUrlParts(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
      const pathname = parsed.pathname === '/' ? '' : parsed.pathname;

      return {
        hostname,
        pathname,
        href: parsed.href.toLowerCase()
      };
    } catch (error) {
      return {
        hostname: '',
        pathname: '',
        href: String(rawUrl || '').toLowerCase()
      };
    }
  }

  function normalizeUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      parsed.hash = '';

      if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }

      return parsed.toString();
    } catch (error) {
      return String(rawUrl || '').trim();
    }
  }

  function getDisplayTitle(item) {
    const title = safeText(item.title);
    if (title) {
      return title;
    }

    const { hostname } = parseUrlParts(item.url);
    return hostname || String(item.url || '').trim() || 'Untitled';
  }

  function getDisplayUrl(item) {
    if (item.type === 'search') {
      return 'Search with default search engine';
    }

    const { hostname, pathname } = parseUrlParts(item.url);
    if (!hostname) {
      return String(item.url || '').trim();
    }

    return `${hostname}${pathname}`;
  }

  function getSourceLabel(item) {
    return SOURCE_LABELS[item.type] || '';
  }

  function getIconFallback(item) {
    switch (item.type) {
      case 'tab':
        return 'T';
      case 'bookmark':
        return 'B';
      case 'history':
        return 'H';
      case 'topSite':
        return 'S';
      default:
        return '';
    }
  }

  function getMatchTier(item, query) {
    const normalizedQuery = safeText(query).toLowerCase();
    if (!normalizedQuery) {
      return { matched: true, tier: 99 };
    }

    const { hostname, href } = parseUrlParts(item.url);
    const title = getDisplayTitle(item).toLowerCase();

    if (hostname.startsWith(normalizedQuery)) {
      return { matched: true, tier: 0 };
    }

    if (hostname.includes(normalizedQuery)) {
      return { matched: true, tier: 1 };
    }

    if (title.startsWith(normalizedQuery)) {
      return { matched: true, tier: 2 };
    }

    if (href.includes(normalizedQuery)) {
      return { matched: true, tier: 3 };
    }

    return { matched: false, tier: Number.MAX_SAFE_INTEGER };
  }

  function compareBySourceMetrics(left, right) {
    switch (left.type) {
      case 'tab':
        return (right.lastAccessed || 0) - (left.lastAccessed || 0);
      case 'history':
        return (
          (right.typedCount || 0) - (left.typedCount || 0) ||
          (right.visitCount || 0) - (left.visitCount || 0) ||
          (right.lastVisitTime || 0) - (left.lastVisitTime || 0)
        );
      case 'topSite':
      case 'bookmark':
      default:
        return getDisplayTitle(left).localeCompare(getDisplayTitle(right));
    }
  }

  function enrichItem(item, query) {
    const match = getMatchTier(item, query);

    return {
      ...item,
      normalizedUrl: normalizeUrl(item.url),
      displayTitle: getDisplayTitle(item),
      displayUrl: getDisplayUrl(item),
      sourceLabel: getSourceLabel(item),
      iconFallback: getIconFallback(item),
      matchesQuery: match.matched,
      matchTier: match.tier
    };
  }

  function compareResults(left, right) {
    return (
      (SOURCE_PRIORITY[left.type] ?? 99) - (SOURCE_PRIORITY[right.type] ?? 99) ||
      (left.matchTier ?? 99) - (right.matchTier ?? 99) ||
      compareBySourceMetrics(left, right) ||
      left.displayTitle.localeCompare(right.displayTitle)
    );
  }

  function dedupeResults(items) {
    const seen = new Set();
    const deduped = [];

    for (const item of items) {
      if (item.type === 'search') {
        deduped.push(item);
        continue;
      }

      if (seen.has(item.normalizedUrl)) {
        continue;
      }

      seen.add(item.normalizedUrl);
      deduped.push(item);
    }

    return deduped;
  }

  function createSearchOption(query) {
    return enrichItem({
      type: 'search',
      id: 'web-search',
      title: `Search for "${query}"`,
      url: `search:${query}`
    }, query);
  }

  function rankResults(items, query, limit) {
    const normalizedQuery = safeText(query);
    const maxResults = typeof limit === 'number' ? limit : 10;

    const rankedItems = items
      .map((item) => enrichItem(item, normalizedQuery))
      .filter((item) => normalizedQuery ? item.matchesQuery : true)
      .sort(compareResults);

    const dedupedResults = dedupeResults(rankedItems).slice(0, maxResults);

    if (!normalizedQuery) {
      return dedupedResults;
    }

    return [...dedupedResults, createSearchOption(normalizedQuery)];
  }

  const api = {
    getDisplayTitle,
    rankResults
  };

  root.QuickFindSearchUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: Run the tests to verify the helper passes**

Run:

```bash
node --test tests/search-ranking.test.js
```

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit the helper**

```bash
git add tests/search-ranking.test.js search-ranking.js
git commit -m "feat: add quickfind search ranking helper"
```

### Task 2: Expand background search data and permissions

**Files:**
- Modify: `manifest.json:1-37`
- Modify: `background.js:17-107`
- Modify: `background.js:159-221`

- [ ] **Step 1: Add the new extension permissions**

Update `manifest.json` so the permissions list becomes:

```json
"permissions": [
  "storage",
  "tabs",
  "notifications",
  "bookmarks",
  "history",
  "topSites",
  "scripting",
  "activeTab"
]
```

- [ ] **Step 2: Refactor `background.js` to return normalized tabs, bookmarks, history, and top sites**

Replace the current search-data section with the following helpers and `getSearchData()` implementation:

```js
function createFaviconUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.hostname}/favicon.ico`;
  } catch (error) {
    return '';
  }
}

async function getTabsData() {
  const tabs = await chrome.tabs.query({});

  return tabs
    .filter((tab) => tab.url)
    .map((tab) => ({
      type: 'tab',
      id: tab.id,
      title: tab.title || '',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl || createFaviconUrl(tab.url),
      lastAccessed: tab.lastAccessed || Date.now()
    }));
}

async function getBookmarksData() {
  const bookmarkTree = await chrome.bookmarks.getTree();
  const bookmarks = [];

  function walk(nodes) {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push({
          type: 'bookmark',
          id: node.id,
          title: node.title || '',
          url: node.url,
          favIconUrl: createFaviconUrl(node.url),
          dateAdded: node.dateAdded || 0
        });
      }

      if (node.children) {
        walk(node.children);
      }
    }
  }

  walk(bookmarkTree);
  return bookmarks;
}

async function getHistoryData() {
  try {
    const historyItems = await chrome.history.search({
      text: '',
      startTime: 0,
      maxResults: 500
    });

    return historyItems
      .filter((item) => item.url)
      .map((item) => ({
        type: 'history',
        id: item.id || `history:${item.url}`,
        title: item.title || '',
        url: item.url,
        favIconUrl: createFaviconUrl(item.url),
        lastVisitTime: item.lastVisitTime || 0,
        visitCount: item.visitCount || 0,
        typedCount: item.typedCount || 0
      }));
  } catch (error) {
    console.warn('QuickFind: Unable to read history data', error);
    return [];
  }
}

async function getTopSitesData() {
  try {
    const topSites = await chrome.topSites.get();

    return topSites
      .filter((site) => site.url)
      .map((site) => ({
        type: 'topSite',
        id: `top-site:${site.url}`,
        title: site.title || '',
        url: site.url,
        favIconUrl: createFaviconUrl(site.url)
      }));
  } catch (error) {
    console.warn('QuickFind: Unable to read top sites', error);
    return [];
  }
}

async function getSearchData() {
  try {
    console.log('QuickFind: Starting to get search data...');

    const [tabsData, bookmarksData, historyData, topSitesData] = await Promise.all([
      getTabsData(),
      getBookmarksData(),
      getHistoryData(),
      getTopSitesData()
    ]);

    const allData = [...tabsData, ...bookmarksData, ...historyData, ...topSitesData];

    console.log('QuickFind: Search data ready', {
      tabs: tabsData.length,
      bookmarks: bookmarksData.length,
      history: historyData.length,
      topSites: topSitesData.length,
      total: allData.length
    });

    return allData;
  } catch (error) {
    console.error('QuickFind: Error getting search data:', error);
    throw error;
  }
}
```

- [ ] **Step 3: Reload the extension and verify the service worker starts cleanly**

Manual check:

1. Open `chrome://extensions`
2. Reload the unpacked QuickFind extension
3. Open the service worker console
4. Trigger the popup once and confirm there are no permission errors for `history` or `topSites`

Expected: the extension reloads successfully and `getSearchData()` logs counts instead of throwing.

- [ ] **Step 4: Commit the data-source expansion**

```bash
git add manifest.json background.js
git commit -m "feat: add history and top sites search data"
```

### Task 3: Wire the overlay, rendering, and injection order

**Files:**
- Modify: `background.js:223-271`
- Modify: `popup.js:125-181`
- Modify: `search-overlay.js:39-67`
- Modify: `search-overlay.js:212-543`
- Modify: `search-overlay.css:199-335`

- [ ] **Step 1: Inject `search-ranking.js` before `search-overlay.js` in both code paths**

Update the background injection fallback to:

```js
await chrome.scripting.executeScript({
  target: { tabId: activeTab.id },
  files: ['theme-manager.js']
});

await chrome.scripting.executeScript({
  target: { tabId: activeTab.id },
  files: ['search-ranking.js']
});

await chrome.scripting.executeScript({
  target: { tabId: activeTab.id },
  files: ['search-overlay.js']
});

await chrome.scripting.insertCSS({
  target: { tabId: activeTab.id },
  files: ['search-overlay.css']
});
```

Update the popup direct-injection fallback to:

```js
await chrome.scripting.insertCSS({
  target: { tabId: activeTab.id },
  files: ['search-overlay.css']
});

await chrome.scripting.executeScript({
  target: { tabId: activeTab.id },
  files: ['theme-manager.js']
});

await chrome.scripting.executeScript({
  target: { tabId: activeTab.id },
  files: ['search-ranking.js']
});

await chrome.scripting.executeScript({
  target: { tabId: activeTab.id },
  files: ['search-overlay.js']
});
```

- [ ] **Step 2: Replace the overlay search logic with helper-driven ranking**

In `search-overlay.js`, update the placeholder, `handleSearch()`, result rendering, and empty state:

```js
this.searchInput.placeholder = 'Search tabs, history, and bookmarks...';
```

```js
handleSearch(query) {
  if (!this.allData) {
    this.showLoading();
    return;
  }

  if (!window.QuickFindSearchUtils) {
    this.showError('Search helpers failed to load');
    return;
  }

  this.currentResults = window.QuickFindSearchUtils.rankResults(this.allData, query, 10);
  this.selectedIndex = -1;
  this.renderResults();
}
```

```js
if (item.type === 'search') {
  url.textContent = 'Search with default search engine';
} else {
  url.textContent = item.displayUrl || item.url;
}

if (item.sourceLabel) {
  const titleText = document.createElement('span');
  titleText.textContent = item.displayTitle || 'Untitled';

  const sourceBadge = document.createElement('span');
  sourceBadge.className = `quickfind-source-badge ${item.type}`;
  sourceBadge.textContent = item.sourceLabel;

  title.appendChild(titleText);
  title.appendChild(sourceBadge);
} else {
  title.textContent = item.displayTitle || 'Untitled';
}
```

```js
icon.textContent = item.iconFallback || '•';
```

```js
showEmpty() {
  this.resultsContainer.innerHTML = `
    <div class="quickfind-search-empty">
      No matching tabs, history, bookmarks, or top sites found
    </div>
  `;
  this.updateResultsCount(0);
}
```

- [ ] **Step 3: Update result styling for new source badges and icon fallbacks**

In `search-overlay.css`, add and adjust these selectors:

```css
.quickfind-result-icon.history:not(:has(img)) {
  background-color: #22c55e;
}

.quickfind-result-icon.topSite:not(:has(img)) {
  background-color: #0ea5e9;
}

.quickfind-source-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.quickfind-source-badge.bookmark {
  background: rgba(255, 152, 0, 0.16);
  color: #ff9800;
}

.quickfind-source-badge.history {
  background: rgba(34, 197, 94, 0.16);
  color: #16a34a;
}

.quickfind-source-badge.topSite {
  background: rgba(14, 165, 233, 0.16);
  color: #0284c7;
}
```

- [ ] **Step 4: Run unit tests, reload the extension, and smoke test the autocomplete**

Run:

```bash
node --test tests/search-ranking.test.js
```

Then manually verify:

1. Reload the unpacked extension in `chrome://extensions`
2. Open a normal webpage
3. Trigger `Alt+K` / `Command+K`
4. Type `goo` and confirm a history-backed `google.com` style result appears before bookmark-only matches
5. Clear the query and confirm tabs appear first, then navigation suggestions
6. Hit Enter on a `tab`, `history`, and `bookmark` result and verify the correct behavior for each

Expected: helper tests pass, the overlay opens normally, and ranking matches the approved behavior.

- [ ] **Step 5: Commit the overlay integration**

```bash
git add background.js popup.js search-overlay.js search-overlay.css
git commit -m "feat: add history-backed quickfind autocomplete"
```

### Task 4: Final regression pass

**Files:**
- No file changes expected

- [ ] **Step 1: Re-run the helper tests**

```bash
node --test tests/search-ranking.test.js
```

Expected: PASS with no regressions.

- [ ] **Step 2: Run the full manual regression checklist**

Manual checklist:

1. `Ctrl+Shift+U` / `Command+Shift+U` still opens saved URLs from the options page
2. Popup search button still launches the overlay
3. Theme switching still updates popup, options, and overlay
4. `goo`, `git`, and another host-prefix query produce navigation-first results
5. A URL present in multiple sources renders once with the right priority
6. Restricted pages such as `chrome://extensions` still fail gracefully

Expected: no previously working feature regresses while the new history/top-site autocomplete works.

- [ ] **Step 3: Commit the verified state**

If Task 4 exposes bugs and you make follow-up fixes, commit them with:

```bash
git add manifest.json background.js popup.js search-overlay.js search-overlay.css search-ranking.js tests/search-ranking.test.js
git commit -m "fix: polish quickfind autocomplete regression issues"
```

If Task 4 is clean and no files changed, do not create an extra empty commit.
