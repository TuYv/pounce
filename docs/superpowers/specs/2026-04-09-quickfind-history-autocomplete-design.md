# QuickFind History Autocomplete Design

## Goal
Extend the `Alt+K` / `Command+K` QuickFind overlay so it behaves more like the Chrome address bar for URL navigation. The overlay should continue searching open tabs and bookmarks, but also surface browser history and top sites so short prefixes such as `goo` can resolve to frequently typed or visited destinations like `google.com`.

## Scope
In scope:
- Add Chrome history results to the existing overlay search.
- Add Chrome top sites as a supplemental source.
- Re-rank results to favor URL navigation patterns over generic substring matches.
- Preserve existing tab switching, bookmark opening, theme sync, and web-search fallback.

Out of scope:
- Reusing Chrome omnibox’s internal suggestion list directly.
- Replacing the existing overlay UI with the browser address bar.
- Adding a new omnibox keyword mode in this change.

## Permissions
Update `manifest.json` to add:
- `history`
- `topSites`

No other permission changes are required for this feature.

## Data Model
`background.js` will continue exposing a single `getSearchData()` response, but the returned array will include normalized entries for four source types:

```js
{ type: 'tab', id, title, url, favIconUrl, lastAccessed }
{ type: 'bookmark', id, title, url, favIconUrl, dateAdded }
{ type: 'history', id, title, url, lastVisitTime, visitCount, typedCount }
{ type: 'topSite', id, title, url }
```

`history` items will be sourced from `chrome.history.search()`. `topSite` items will be sourced from `chrome.topSites.get()`. The overlay keeps consuming one flat array; source-specific behavior stays in the ranking and selection logic.

## Search Behavior
The current `includes()`-based search is replaced with layered matching:

1. Hostname prefix match
2. Hostname substring match
3. Title prefix match
4. URL substring match

This applies to tabs, bookmarks, history, and top sites. Matching should normalize case and evaluate both raw URL and parsed hostname where parsing succeeds.

## Ranking Rules
The overlay should behave like navigation-first autocomplete rather than document search.

When a query is present, order by:
1. Matching open tabs
2. Strong matching history results
3. Matching top sites
4. Matching bookmarks
5. Trailing `Search for "..."` action

History ranking should prioritize:
1. `typedCount`
2. `visitCount`
3. `lastVisitTime`

Within each source, hostname-prefix matches outrank title or loose URL matches.

When the query is empty, show:
1. All open tabs
2. Frequently typed or visited history entries
3. Top sites
4. Bookmarks as remaining fillers

## Deduplication
Duplicate URLs should be collapsed before rendering. If the same URL exists in multiple sources, keep the highest-priority representation:

`tab > history > topSite > bookmark`

Deduplication is URL-based after normalization. Results should not show multiple rows for the same destination unless the URLs are materially different.

## Selection Behavior
Selection remains source-aware:
- `tab`: activate the existing tab and focus its window
- `bookmark`, `history`, `topSite`: open the URL in a new tab
- `search`: run a search using the current fallback behavior

No keyboard interaction changes are required. Arrow navigation, Enter to confirm, and Escape to close remain unchanged.

## UI Changes
The existing overlay layout stays intact. Add lightweight source labeling so users can distinguish new result types:
- `Bookmark`
- `History`
- optional `Top` label for top sites if needed for clarity

If a history or top-site result has no title, display the hostname as its primary text.

## Failure Handling
The overlay must degrade gracefully:
- If history retrieval fails, continue with tabs, bookmarks, and top sites where available.
- If top sites retrieval fails, continue with tabs, bookmarks, and history.
- If URL parsing fails, fall back to raw URL string matching and display.
- The overlay must never fail to open because one data source is unavailable.

## Verification
Manual verification should confirm:
- Typing `goo` prioritizes `google.com` or similar strong history matches.
- Hostname-prefix matches outrank loose title matches.
- Empty queries show open tabs first, then navigation-oriented suggestions.
- Duplicate URLs from multiple sources render once with the correct source priority.
- Existing behavior still works for tab switching, bookmark opening, popup launch, and theme updates.

## Constraints
Chrome’s internal omnibox suggestion engine is not directly available to this extension. This feature approximates address-bar behavior using extension APIs, mainly `chrome.history` and `chrome.topSites`.
