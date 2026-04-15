# QuickFind Direct URL Open Design

## Goal
Extend the QuickFind overlay so inputs that look like navigable addresses open directly instead of falling through to web search. The overlay should also provide address-like autocomplete behavior by surfacing strong history/top-site URL matches and a synthetic `Open ...` action when the user input is already a valid-looking destination.

## Scope
In scope:
- Detect address intent for domain-like, path-like, localhost, and IP-based inputs.
- Open direct-address inputs instead of sending them to web search.
- Add a synthetic `Open ...` result type for direct navigation.
- Prioritize strong real URL matches from tabs/history/top sites before synthetic open actions.
- Preserve ordinary search behavior for non-address queries.

Out of scope:
- Reusing Chrome omnibox’s internal suggestion list directly.
- Treating every bare word as a likely URL.
- Changing the existing popup/options UI outside the overlay result list.

## Address Intent Rules
Treat the query as URL-like when it matches one of these patterns:
- Domain-like input such as `google.com`
- Domain + path/query such as `github.com/openai` or `example.com?a=1`
- Explicit protocol such as `https://example.com`
- `localhost` with optional port/path such as `localhost:3000`
- IPv4 addresses with optional port/path such as `192.168.1.1`

Do not treat clearly search-like phrases such as `openai api` as a direct address.

## Protocol Normalization
When generating a direct-open candidate:
- Use `https://` for normal domains
- Use `http://` for `localhost` and private/local IP addresses
- Preserve explicit `http://` or `https://` if the user already typed one

Examples:
- `google.com` -> `https://google.com`
- `github.com/openai` -> `https://github.com/openai`
- `localhost:3000` -> `http://localhost:3000`
- `192.168.1.1` -> `http://192.168.1.1`

## Result Types
The overlay should support three classes of results:
- Real results from tabs, history, top sites, and bookmarks
- Synthetic direct-open result: `Open https://...`
- Synthetic search result: `Search for "..."`

Add a new synthetic result type, `open`, distinct from `search`.

## Ranking Rules
For URL-like queries:
1. Strong real URL/navigation matches
2. Synthetic `Open ...` result
3. Synthetic `Search for "..."` result

Real results should still use the existing navigation-first ranking, so a strong hostname/history/top-site match can beat a weak tab title match.

Only generate `Open ...` when the input is sufficiently URL-like. Do not create synthetic open actions for generic search phrases.

For partial address inputs such as `googl`:
- Prefer strong real autocomplete-style matches like `google.com`
- Do not force a synthetic `Open https://googl` candidate if the input is not confidently a navigable address

## Selection Behavior
Keep existing behavior for existing result types:
- `tab`: activate current tab
- `bookmark`, `history`, `topSite`: open in a new tab
- `search`: perform web search

Add:
- `open`: open the normalized direct URL in a new tab

When the top result is a strong real URL match or a synthetic `Open ...` result, Enter should open that destination directly rather than web-searching the raw input.

## Display
The synthetic `open` result should render clearly, for example:
- Title: `Open https://google.com`
- Secondary text: normalized URL

It should remain visually distinct from `Search for "..."`.

## Verification
Manual verification should confirm:
- `google.com` defaults to direct open, not search
- `github.com/openai` opens directly
- `localhost:3000` opens with `http://`
- `192.168.1.1` opens with `http://`
- `googl` prefers strong real autocomplete matches when available
- `openai api` still behaves like a normal search query
- Search fallback still works when the query is not URL-like
