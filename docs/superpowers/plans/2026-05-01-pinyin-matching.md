# 拼音检索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users find Chinese-titled tabs / bookmarks / history / topSites by typing pinyin (`baidu`), initials (`bd`), or mixed Chinese+Latin (`百d搜索`). Strict literal-first ordering preserved. Setting toggle defaults on.

**Architecture:** Two new pure modules (`pinyin-index.js`, `pinyin-matcher.js`) feed an extended `getMatchTier()` (tiers 6–10) and `getHighlightRanges()` (pinyin fallback) inside `search-ranking.js`. Vendor tiny-pinyin UMD bundle. No bundler / build step. Module-level `pinyinMatchingEnabled` flag updated via `setPinyinMatchingEnabled(bool)` from `search-overlay.js` on storage load + `chrome.storage.onChanged`.

**Tech Stack:** Plain JavaScript (no transpiler), `node:test` + `node:assert/strict`, tiny-pinyin v1.3.x UMD bundle vendored at `vendor/tiny-pinyin.js`.

**Spec:** `docs/superpowers/specs/2026-05-01-pinyin-matching-design.md`

**Notes on spec deviations** (already justified, no need to revisit):
- spec said `vendor/tiny-pinyin.min.js`; upstream ships CJS source only (no UMD bundle on npm/CDN) → bundle locally with `esbuild --format=iife`, plus a Node-side `module.exports` postlude. Resulting file at `vendor/tiny-pinyin.js`. Future re-vendoring: see Task 1 procedure.
- spec said edit `manifest.json` content_scripts; manifest has no content_scripts block (dynamic injection only) → only `background.js` is touched
- spec assumed tiny-pinyin token `type === 1` for CJK pinyin; **actual codes**: type 1 = ASCII passthrough, type 2 = CJK with pinyin, type 3 = CJK without pinyin / surrogate halves. Code in Task 3 reflects this.

---

## File Map

| File | Change |
|------|--------|
| `vendor/tiny-pinyin.js` | **Create** — vendor tiny-pinyin UMD bundle |
| `preferences.js` | + `pinyinMatchingEnabled: true` in `DEFAULT_SEARCH_PREFERENCES` |
| `pinyin-index.js` | **Create** — `getPinyinIndex(title)` + `clearCache()` + `hasCjkText(s)` |
| `pinyin-matcher.js` | **Create** — 5 matchers + `hasAsciiLetter(s)` |
| `search-ranking.js` | + tier 6–10 in `getMatchTier`; + pinyin fallback in `getHighlightRanges`; + module-level `pinyinMatchingEnabled` + `setPinyinMatchingEnabled()` exposed on `api` |
| `search-overlay.js` | Update fallback `DEFAULT_SEARCH_PREFERENCES` literal; thread `pinyinMatchingEnabled` through onChanged listener; call `setPinyinMatchingEnabled` after preferences load |
| `options.html` | + 1 `setting-row` toggle after Highlight matches |
| `options.js` | + 1 `getElementById` + addEventListener + onChanged branch + applySearchPreferenceToggles assignment |
| `background.js` | + 3 `executeScript` calls (vendor, pinyin-index, pinyin-matcher) before search-ranking.js |
| `tests/pinyin-index.test.js` | **Create** — 9 tests |
| `tests/pinyin-matcher.test.js` | **Create** — 14 tests |
| `tests/search-ranking-pinyin.test.js` | **Create** — 11 tests |
| `tests/search-ranking.test.js` | + 5 tests for pinyin highlight fallback |

---

## Task 1: Vendor tiny-pinyin

**Files:**
- Create: `vendor/tiny-pinyin.js`

- [ ] **Step 1: Create the vendor directory**

```bash
mkdir -p vendor
```

- [ ] **Step 2: Bundle tiny-pinyin from npm CJS source into a single IIFE**

tiny-pinyin's npm package ships CJS only (no UMD bundle on unpkg/jsdelivr). We bundle locally with esbuild — output is committed; esbuild is not a runtime dep.

```bash
mkdir -p /tmp/pounce-bundle
cat > /tmp/pounce-bundle/entry.js <<'EOF'
const TinyPinyin = require('tiny-pinyin');
if (typeof globalThis !== 'undefined') globalThis.TinyPinyin = TinyPinyin;
EOF
cd /tmp/pounce-bundle
npm install --silent tiny-pinyin@1.3.2
npx --yes esbuild@0.24.0 entry.js --bundle --format=iife --global-name=__TinyPinyinBundle --outfile=bundle.js
```

Append a Node-interop postlude so `require()` returns the lib in the test runner:

```bash
cat > vendor/tiny-pinyin.js <<EOF
// Pounce: bundled tiny-pinyin@1.3.2 via esbuild --format=iife.
// Browser: IIFE side-effects globalThis.TinyPinyin.
// Node: same side-effect populates global.TinyPinyin; postlude mirrors to module.exports.

$(cat /tmp/pounce-bundle/bundle.js)

// Postlude: Node interop (no-op in browser).
if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof globalThis !== "undefined" ? globalThis : this).TinyPinyin;
}
EOF
```

Expected: ~16KB single file, no `require(` calls in body.

- [ ] **Step 3: Smoke-test the vendor file in both modes**

```bash
node -e "const t=require('./vendor/tiny-pinyin.js'); console.log(JSON.stringify(t.parse('百度')))"
```

Expected output:

```
[{"source":"百","type":2,"target":"BAI"},{"source":"度","type":2,"target":"DU"}]
```

Note: `type: 2` for CJK with pinyin (not `1` — the spec/early plan assumed `1`, which is wrong). Type codes: `1` = ASCII passthrough, `2` = CJK with pinyin, `3` = CJK without pinyin / surrogate halves.

- [ ] **Step 4: Commit**

```bash
git add vendor/tiny-pinyin.js
git commit -m "chore(vendor): vendor tiny-pinyin@1.3.2 for pinyin search"
```

---

## Task 2: Add `pinyinMatchingEnabled` to preferences

**Files:**
- Modify: `preferences.js`

- [ ] **Step 1: Edit `DEFAULT_SEARCH_PREFERENCES`**

In `preferences.js`, change the frozen object literal:

```javascript
const DEFAULT_SEARCH_PREFERENCES = Object.freeze({
  quickPickEnabled: true,
  highlightMatchesEnabled: true,
  pinyinMatchingEnabled: true
});
```

`SEARCH_PREFERENCE_KEYS` is derived via `Object.keys`, so it picks up the new key automatically.

- [ ] **Step 2: Verify in Node**

```bash
node -e "const p=require('./preferences.js'); console.log(p.SEARCH_PREFERENCE_KEYS); console.log(p.normalizeSearchPreferences({}))"
```

Expected:

```
[ 'quickPickEnabled', 'highlightMatchesEnabled', 'pinyinMatchingEnabled' ]
{ quickPickEnabled: true, highlightMatchesEnabled: true, pinyinMatchingEnabled: true }
```

- [ ] **Step 3: Commit**

```bash
git add preferences.js
git commit -m "feat(preferences): add pinyinMatchingEnabled toggle (default on)"
```

---

## Task 3: Build `pinyin-index.js` (TDD)

**Files:**
- Create: `tests/pinyin-index.test.js`
- Create: `pinyin-index.js`

- [ ] **Step 1: Write failing tests**

Create `tests/pinyin-index.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

// tiny-pinyin attaches to module.exports in Node; mirror to globalThis so pinyin-index.js
// can find it the same way the browser content script does.
const TinyPinyin = require('../vendor/tiny-pinyin.js');
globalThis.TinyPinyin = TinyPinyin;

const { getPinyinIndex, clearCache, hasCjkText } = require('../pinyin-index.js');

test('hasCjkText flags strings containing CJK', () => {
  assert.equal(hasCjkText('百度'), true);
  assert.equal(hasCjkText('GitHub - 百度'), true);
  assert.equal(hasCjkText('GitHub'), false);
  assert.equal(hasCjkText(''), false);
  assert.equal(hasCjkText(null), false);
});

test('empty title returns hasCjk=false index', () => {
  clearCache();
  const idx = getPinyinIndex('');
  assert.equal(idx.hasCjk, false);
  assert.equal(idx.full, '');
  assert.equal(idx.initials, '');
  assert.deepEqual(idx.charInfo, []);
});

test('all-ASCII title returns hasCjk=false but charInfo populated', () => {
  clearCache();
  const idx = getPinyinIndex('GitHub');
  assert.equal(idx.hasCjk, false);
  assert.equal(idx.charInfo.length, 6);
  assert.equal(idx.charInfo[0].char, 'G');
  assert.equal(idx.charInfo[0].isCjk, false);
  assert.equal(idx.charInfo[0].full, '');
  assert.equal(idx.full, '');
  assert.equal(idx.initials, '');
});

test('CJK title 百度 produces full+initials and reverse maps', () => {
  clearCache();
  const idx = getPinyinIndex('百度');
  assert.equal(idx.hasCjk, true);
  assert.equal(idx.full, 'baidu');
  assert.equal(idx.initials, 'bd');
  assert.deepEqual(idx.fullToTitle, [0, 0, 0, 1, 1]);
  assert.deepEqual(idx.initialsToTitle, [0, 1]);
  assert.equal(idx.charInfo.length, 2);
  assert.equal(idx.charInfo[0].char, '百');
  assert.equal(idx.charInfo[0].full, 'bai');
  assert.equal(idx.charInfo[0].initial, 'b');
  assert.equal(idx.charInfo[0].isCjk, true);
});

test('CJK title 百度搜索 produces full=baidusousuo, initials=bdss', () => {
  clearCache();
  const idx = getPinyinIndex('百度搜索');
  assert.equal(idx.full, 'baidusousuo');
  assert.equal(idx.initials, 'bdss');
  assert.deepEqual(idx.initialsToTitle, [0, 1, 2, 3]);
});

test('mixed CJK + ASCII title interleaves charInfo correctly', () => {
  clearCache();
  const idx = getPinyinIndex('GitHub - 百度');
  assert.equal(idx.hasCjk, true);
  assert.equal(idx.full, 'baidu');
  assert.equal(idx.initials, 'bd');
  // ASCII portion gets isCjk:false entries; CJK gets isCjk:true with pinyin
  const cjkEntries = idx.charInfo.filter(c => c.isCjk);
  assert.equal(cjkEntries.length, 2);
  assert.equal(cjkEntries[0].char, '百');
  assert.equal(cjkEntries[1].char, '度');
});

test('multi-char title preserves title indices in reverse maps', () => {
  clearCache();
  const idx = getPinyinIndex('我爱百度');
  assert.equal(idx.full, 'woaibaidu');
  assert.equal(idx.initials, 'wabd');
  // 'b' maps back to title index 2 (百), 'd' to index 3 (度)
  assert.equal(idx.initialsToTitle[2], 2);
  assert.equal(idx.initialsToTitle[3], 3);
});

test('cache returns same object reference for repeated calls', () => {
  clearCache();
  const a = getPinyinIndex('百度');
  const b = getPinyinIndex('百度');
  assert.equal(a, b);
});

test('clearCache lets new index be built', () => {
  const a = getPinyinIndex('百度');
  clearCache();
  const b = getPinyinIndex('百度');
  // After clearCache, identity differs (new object) but values are equal
  assert.notEqual(a, b);
  assert.deepEqual(a.full, b.full);
});
```

- [ ] **Step 2: Run tests — expect 9 failures**

Run: `node --test tests/pinyin-index.test.js`

Expected: `Cannot find module '../pinyin-index.js'` for all 9 tests.

- [ ] **Step 3: Create `pinyin-index.js`**

Create `pinyin-index.js` at repo root:

```javascript
(function() {
  'use strict';

  const CJK_REGEX = /[㐀-䶿一-鿿豈-﫿]/;
  const cache = new Map();

  function hasCjkText(text) {
    return typeof text === 'string' && CJK_REGEX.test(text);
  }

  function getTinyPinyin() {
    if (typeof globalThis !== 'undefined' && globalThis.TinyPinyin && typeof globalThis.TinyPinyin.parse === 'function') {
      return globalThis.TinyPinyin;
    }
    return null;
  }

  function emptyIndex() {
    return {
      hasCjk: false,
      full: '',
      initials: '',
      fullToTitle: [],
      initialsToTitle: [],
      charInfo: []
    };
  }

  function buildIndex(title) {
    if (typeof title !== 'string' || title.length === 0) {
      return emptyIndex();
    }

    const TinyPinyin = getTinyPinyin();
    if (!TinyPinyin) {
      // No library available — degrade to charInfo with no pinyin so walker still has literal path.
      const charInfo = [];
      for (let i = 0; i < title.length; i++) {
        charInfo.push({ idx: i, char: title.charAt(i), full: '', initial: '', isCjk: false });
      }
      return { hasCjk: false, full: '', initials: '', fullToTitle: [], initialsToTitle: [], charInfo };
    }

    let tokens;
    try {
      tokens = TinyPinyin.parse(title);
    } catch (err) {
      return emptyIndex();
    }
    if (!Array.isArray(tokens)) return emptyIndex();

    let full = '';
    let initials = '';
    const fullToTitle = [];
    const initialsToTitle = [];
    const charInfo = [];
    let titleIdx = 0;
    let hasCjk = false;

    for (const token of tokens) {
      const source = String(token && token.source != null ? token.source : '');
      const type = token && token.type;
      const targetUpper = String(token && token.target != null ? token.target : '');

      if (type === 2 && source.length === 1 && targetUpper.length > 0) {
        // Single-char CJK token with pinyin (tiny-pinyin uses type=2 for matched CJK)
        const pinyin = targetUpper.toLowerCase();
        const initial = pinyin.charAt(0);
        for (let k = 0; k < pinyin.length; k++) {
          full += pinyin.charAt(k);
          fullToTitle.push(titleIdx);
        }
        initials += initial;
        initialsToTitle.push(titleIdx);
        charInfo.push({ idx: titleIdx, char: source, full: pinyin, initial, isCjk: true });
        hasCjk = true;
        titleIdx += 1;
      } else {
        // ASCII / digits / unknown CJK / multi-char tokens — split per source char, no pinyin
        for (let i = 0; i < source.length; i++) {
          const ch = source.charAt(i);
          const isCjkChar = CJK_REGEX.test(ch);
          if (isCjkChar) hasCjk = true;
          charInfo.push({ idx: titleIdx, char: ch, full: '', initial: '', isCjk: isCjkChar });
          titleIdx += 1;
        }
      }
    }

    return { hasCjk, full, initials, fullToTitle, initialsToTitle, charInfo };
  }

  function getPinyinIndex(title) {
    const key = String(title || '');
    if (cache.has(key)) return cache.get(key);
    const idx = buildIndex(key);
    cache.set(key, idx);
    return idx;
  }

  function clearCache() {
    cache.clear();
  }

  const api = { getPinyinIndex, clearCache, hasCjkText };

  if (typeof globalThis !== 'undefined') {
    globalThis.PouncePinyinIndex = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
```

- [ ] **Step 4: Run tests — expect all pass**

Run: `node --test tests/pinyin-index.test.js`

Expected: 9 tests pass.

If a CJK assertion fails because tiny-pinyin returned a different reading (e.g., for 行 being `XING` instead of `HANG`), update the test expectation to match what the lib actually returns — the spec accepts whatever the lib's default reading is.

- [ ] **Step 5: Commit**

```bash
git add pinyin-index.js tests/pinyin-index.test.js
git commit -m "feat(search): add pinyin-index helper for title pinyin extraction"
```

---

## Task 4: Build `pinyin-matcher.js` fast paths (TDD)

**Files:**
- Create: `tests/pinyin-matcher.test.js`
- Create: `pinyin-matcher.js`

- [ ] **Step 1: Write failing tests for the four fast-path matchers**

Create `tests/pinyin-matcher.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

const TinyPinyin = require('../vendor/tiny-pinyin.js');
globalThis.TinyPinyin = TinyPinyin;

const { getPinyinIndex, clearCache } = require('../pinyin-index.js');
const {
  matchFullStartsWith,
  matchInitialsStartsWith,
  matchFullIncludes,
  matchInitialsIncludes,
  matchMixed,
  hasAsciiLetter
} = require('../pinyin-matcher.js');

function idxOf(title) {
  clearCache();
  return getPinyinIndex(title);
}

test('hasAsciiLetter detects ASCII a-z / A-Z', () => {
  assert.equal(hasAsciiLetter('bd'), true);
  assert.equal(hasAsciiLetter('百d'), true);
  assert.equal(hasAsciiLetter('百度'), false);
  assert.equal(hasAsciiLetter('123'), false);
  assert.equal(hasAsciiLetter(''), false);
  assert.equal(hasAsciiLetter(null), false);
});

test('matchFullStartsWith hits prefix of full pinyin', () => {
  const result = matchFullStartsWith('baidu', idxOf('百度搜索'));
  assert.deepEqual(result, { ranges: [[0, 2]] });
});

test('matchFullStartsWith hits with partial-char prefix (bai)', () => {
  const result = matchFullStartsWith('bai', idxOf('百度搜索'));
  assert.deepEqual(result, { ranges: [[0, 1]] });
});

test('matchFullStartsWith returns null when query is not a prefix', () => {
  assert.equal(matchFullStartsWith('aidu', idxOf('百度搜索')), null);
});

test('matchInitialsStartsWith hits prefix of initials', () => {
  const result = matchInitialsStartsWith('bd', idxOf('百度搜索'));
  assert.deepEqual(result, { ranges: [[0, 2]] });
});

test('matchInitialsStartsWith returns null when query is not initial prefix', () => {
  assert.equal(matchInitialsStartsWith('ds', idxOf('百度搜索')), null);
});

test('matchFullIncludes hits middle-of-title pinyin substring', () => {
  const result = matchFullIncludes('baidu', idxOf('我爱百度'));
  assert.deepEqual(result, { ranges: [[2, 4]] });
});

test('matchFullIncludes returns null when query absent', () => {
  assert.equal(matchFullIncludes('xyz', idxOf('百度搜索')), null);
});

test('matchInitialsIncludes hits middle-of-title initials substring', () => {
  const result = matchInitialsIncludes('bd', idxOf('我爱百度'));
  assert.deepEqual(result, { ranges: [[2, 4]] });
});

test('matchInitialsIncludes returns null when query absent', () => {
  assert.equal(matchInitialsIncludes('xy', idxOf('百度搜索')), null);
});

test('all fast-path matchers return null when idx.hasCjk is false', () => {
  const idx = idxOf('GitHub');
  assert.equal(matchFullStartsWith('git', idx), null);
  assert.equal(matchInitialsStartsWith('git', idx), null);
  assert.equal(matchFullIncludes('git', idx), null);
  assert.equal(matchInitialsIncludes('git', idx), null);
});

test('all fast-path matchers return null on empty query', () => {
  const idx = idxOf('百度搜索');
  assert.equal(matchFullStartsWith('', idx), null);
  assert.equal(matchInitialsStartsWith('', idx), null);
  assert.equal(matchFullIncludes('', idx), null);
  assert.equal(matchInitialsIncludes('', idx), null);
});

test('matchers are case-insensitive on query', () => {
  assert.deepEqual(matchInitialsStartsWith('BD', idxOf('百度搜索')), { ranges: [[0, 2]] });
  assert.deepEqual(matchFullStartsWith('BAIDU', idxOf('百度搜索')), { ranges: [[0, 2]] });
});

test('matchMixed placeholder — returns null until walker is implemented', () => {
  // This test intentionally pins the current behavior; Task 5 will replace it.
  assert.equal(typeof matchMixed, 'function');
});
```

- [ ] **Step 2: Run tests — expect 14 failures**

Run: `node --test tests/pinyin-matcher.test.js`

Expected: Cannot find module `../pinyin-matcher.js`.

- [ ] **Step 3: Create `pinyin-matcher.js` with fast paths + matchMixed stub**

Create `pinyin-matcher.js`:

```javascript
(function() {
  'use strict';

  function hasAsciiLetter(s) {
    return typeof s === 'string' && /[A-Za-z]/.test(s);
  }

  // Compress a sorted (or roughly sorted) list of title indices into [start, end) ranges,
  // merging contiguous indices.
  function compressIndices(indices) {
    if (!indices || indices.length === 0) return [];
    const sorted = [...indices].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = start + 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end) {
        end = sorted[i] + 1;
      } else if (sorted[i] === end - 1) {
        // Duplicate — skip
        continue;
      } else {
        ranges.push([start, end]);
        start = sorted[i];
        end = start + 1;
      }
    }
    ranges.push([start, end]);
    return ranges;
  }

  function normalizeQuery(query) {
    return typeof query === 'string' ? query.toLowerCase() : '';
  }

  function matchFullStartsWith(query, idx) {
    if (!idx || !idx.hasCjk || !idx.full) return null;
    const q = normalizeQuery(query);
    if (!q) return null;
    if (!idx.full.startsWith(q)) return null;
    const titleIdxs = idx.fullToTitle.slice(0, q.length);
    return { ranges: compressIndices(titleIdxs) };
  }

  function matchInitialsStartsWith(query, idx) {
    if (!idx || !idx.hasCjk || !idx.initials) return null;
    const q = normalizeQuery(query);
    if (!q) return null;
    if (!idx.initials.startsWith(q)) return null;
    const titleIdxs = idx.initialsToTitle.slice(0, q.length);
    return { ranges: compressIndices(titleIdxs) };
  }

  function matchFullIncludes(query, idx) {
    if (!idx || !idx.hasCjk || !idx.full) return null;
    const q = normalizeQuery(query);
    if (!q) return null;
    const pos = idx.full.indexOf(q);
    if (pos < 0) return null;
    const titleIdxs = idx.fullToTitle.slice(pos, pos + q.length);
    return { ranges: compressIndices(titleIdxs) };
  }

  function matchInitialsIncludes(query, idx) {
    if (!idx || !idx.hasCjk || !idx.initials) return null;
    const q = normalizeQuery(query);
    if (!q) return null;
    const pos = idx.initials.indexOf(q);
    if (pos < 0) return null;
    const titleIdxs = idx.initialsToTitle.slice(pos, pos + q.length);
    return { ranges: compressIndices(titleIdxs) };
  }

  function matchMixed(_query, _idx) {
    // Implemented in Task 5
    return null;
  }

  const api = {
    matchFullStartsWith,
    matchInitialsStartsWith,
    matchFullIncludes,
    matchInitialsIncludes,
    matchMixed,
    hasAsciiLetter
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.PouncePinyinMatcher = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
```

- [ ] **Step 4: Run tests — expect all pass**

Run: `node --test tests/pinyin-matcher.test.js`

Expected: 14 tests pass.

- [ ] **Step 5: Commit**

```bash
git add pinyin-matcher.js tests/pinyin-matcher.test.js
git commit -m "feat(search): add pinyin matchers (full/initials × startsWith/includes)"
```

---

## Task 5: Add mixed walker `matchMixed` (TDD)

**Files:**
- Modify: `tests/pinyin-matcher.test.js` (replace the placeholder test, add walker tests)
- Modify: `pinyin-matcher.js` (replace the stub)

- [ ] **Step 1: Replace placeholder test + add walker tests**

In `tests/pinyin-matcher.test.js`, **delete** this test:

```javascript
test('matchMixed placeholder — returns null until walker is implemented', () => {
  assert.equal(typeof matchMixed, 'function');
});
```

And **append** at the end of the file:

```javascript
test('matchMixed handles 百d搜索 → 百度搜索 (mode D mixed)', () => {
  const result = matchMixed('百d搜索', idxOf('百度搜索'));
  assert.deepEqual(result, { ranges: [[0, 4]] });
});

test('matchMixed handles baidu搜 → 百度搜索 (full pinyin + literal CJK)', () => {
  const result = matchMixed('baidu搜', idxOf('百度搜索'));
  assert.deepEqual(result, { ranges: [[0, 3]] });
});

test('matchMixed handles bd搜索 → 百度搜索 (initials + literal CJK)', () => {
  const result = matchMixed('bd搜索', idxOf('百度搜索'));
  assert.deepEqual(result, { ranges: [[0, 4]] });
});

test('matchMixed returns null when no contiguous match exists', () => {
  assert.equal(matchMixed('xy', idxOf('百度搜索')), null);
});

test('matchMixed returns null on empty query', () => {
  assert.equal(matchMixed('', idxOf('百度搜索')), null);
});

test('matchMixed returns null when idx.hasCjk is false', () => {
  assert.equal(matchMixed('git', idxOf('GitHub')), null);
});

test('matchMixed handles middle-of-title start (我d → 我爱度...)', () => {
  // Title 我爱度搜 has charInfo wo/ai/du/sou; query 我d wants to match 我 + initial of 度.
  // But 度 is at idx 2, with 爱 at idx 1 in between → walker requires contiguous chars.
  // 我d cannot bridge across 爱, so this returns null.
  assert.equal(matchMixed('我d', idxOf('我爱度搜')), null);
});

test('matchMixed handles contiguous middle-of-title 度搜 → 我爱度搜', () => {
  const result = matchMixed('度s', idxOf('我爱度搜'));
  assert.deepEqual(result, { ranges: [[2, 4]] });
});
```

- [ ] **Step 2: Run tests — expect 8 failures**

Run: `node --test tests/pinyin-matcher.test.js`

Expected: 8 new tests fail (matchMixed returns null for all). The 13 fast-path tests still pass.

- [ ] **Step 3: Replace `matchMixed` stub with the walker**

In `pinyin-matcher.js`, replace the `matchMixed` stub:

```javascript
  function charsEqual(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return a.toLowerCase() === b.toLowerCase();
  }

  function isAsciiLetter(ch) {
    return typeof ch === 'string' && ch.length === 1 && /[A-Za-z]/.test(ch);
  }

  // Recursive walker. Tries 3 branches per title char:
  //   (1) literal char equality
  //   (2) CJK + ASCII initial
  //   (3) CJK + ASCII full pinyin substring
  // Returns true if `query` is fully consumed starting from charInfo[t]; pushes matched
  // title indices into `hits` (caller compresses to ranges).
  // `ctx.steps` provides a hard cap to avoid pathological inputs.
  function walk(t, qPos, charInfo, query, hits, ctx) {
    if (qPos >= query.length) return true;
    if (t >= charInfo.length) return false;
    if (++ctx.steps > 50000) return false;

    const info = charInfo[t];
    const qCh = query.charAt(qPos);

    // Branch 1: literal char equality (case-insensitive for ASCII; CJK is byte-equal).
    if (charsEqual(info.char, qCh)) {
      hits.push(info.idx);
      if (walk(t + 1, qPos + 1, charInfo, query, hits, ctx)) return true;
      hits.pop();
    }

    // Branch 2: CJK + ASCII initial.
    if (info.isCjk && info.initial && isAsciiLetter(qCh) && info.initial === qCh.toLowerCase()) {
      hits.push(info.idx);
      if (walk(t + 1, qPos + 1, charInfo, query, hits, ctx)) return true;
      hits.pop();
    }

    // Branch 3: CJK + ASCII full pinyin substring.
    if (info.isCjk && info.full) {
      const pyLen = info.full.length;
      if (qPos + pyLen <= query.length) {
        const slice = query.substr(qPos, pyLen).toLowerCase();
        if (slice === info.full) {
          hits.push(info.idx);
          if (walk(t + 1, qPos + pyLen, charInfo, query, hits, ctx)) return true;
          hits.pop();
        }
      }
    }

    return false;
  }

  function matchMixed(query, idx) {
    if (!idx || !idx.hasCjk) return null;
    const q = typeof query === 'string' ? query : '';
    if (!q) return null;
    const charInfo = idx.charInfo || [];
    if (charInfo.length === 0) return null;

    for (let start = 0; start < charInfo.length; start++) {
      const hits = [];
      const ctx = { steps: 0 };
      if (walk(start, 0, charInfo, q, hits, ctx)) {
        return { ranges: compressIndices(hits) };
      }
    }
    return null;
  }
```

(Place `charsEqual`, `isAsciiLetter`, and `walk` above `matchMixed` inside the IIFE; `matchMixed` replaces the stub and goes after `matchInitialsIncludes`.)

- [ ] **Step 4: Run tests — expect all pass**

Run: `node --test tests/pinyin-matcher.test.js`

Expected: 21 tests pass (13 fast-path + 8 walker).

- [ ] **Step 5: Commit**

```bash
git add pinyin-matcher.js tests/pinyin-matcher.test.js
git commit -m "feat(search): add matchMixed walker for mixed CJK/Latin pinyin queries"
```

---

## Task 6: Extend `getMatchTier` for tiers 6–10 (TDD)

**Files:**
- Create: `tests/search-ranking-pinyin.test.js`
- Modify: `search-ranking.js`

- [ ] **Step 1: Write failing tests for tier assignment**

Create `tests/search-ranking-pinyin.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

const TinyPinyin = require('../vendor/tiny-pinyin.js');
globalThis.TinyPinyin = TinyPinyin;

require('../pinyin-index.js');
require('../pinyin-matcher.js');

const { rankResults, setPinyinMatchingEnabled } = require('../search-ranking.js');

function makeItem(title, type = 'tab', extras = {}) {
  return {
    type,
    id: `${type}:${title}`,
    title,
    url: `https://example.com/${encodeURIComponent(title)}`,
    lastAccessed: 100,
    ...extras
  };
}

function nonSearchTypes(results) {
  return results.filter(r => r.type !== 'search' && r.type !== 'open').map(r => r.title);
}

test('setPinyinMatchingEnabled is exposed on the helper api', () => {
  assert.equal(globalThis.PounceSearchUtils.setPinyinMatchingEnabled, setPinyinMatchingEnabled);
});

test('full pinyin startsWith hits when literal misses (tier 6 — comes after literal)', () => {
  setPinyinMatchingEnabled(true);
  const items = [makeItem('百度搜索')];
  const results = rankResults(items, 'baidu', 10);
  assert.deepEqual(nonSearchTypes(results), ['百度搜索']);
});

test('initials startsWith hits when literal misses (tier 7)', () => {
  setPinyinMatchingEnabled(true);
  const items = [makeItem('百度搜索')];
  const results = rankResults(items, 'bd', 10);
  assert.deepEqual(nonSearchTypes(results), ['百度搜索']);
});

test('full pinyin includes hits when not at title start (tier 8)', () => {
  setPinyinMatchingEnabled(true);
  const items = [makeItem('我爱百度')];
  const results = rankResults(items, 'baidu', 10);
  assert.deepEqual(nonSearchTypes(results), ['我爱百度']);
});

test('initials includes hits when not at title start (tier 9)', () => {
  setPinyinMatchingEnabled(true);
  const items = [makeItem('我爱百度')];
  const results = rankResults(items, 'bd', 10);
  assert.deepEqual(nonSearchTypes(results), ['我爱百度']);
});

test('mixed CJK+Latin query hits via mode D (tier 10)', () => {
  setPinyinMatchingEnabled(true);
  const items = [makeItem('百度搜索')];
  const results = rankResults(items, '百d搜索', 10);
  assert.deepEqual(nonSearchTypes(results), ['百度搜索']);
});

test('literal title.includes wins over pinyin when both match (literal-first ordering)', () => {
  setPinyinMatchingEnabled(true);
  const items = [
    makeItem('百度搜索'),     // pinyin initials bd
    makeItem('BD products')    // literal title contains "BD" → tier 4
  ];
  const results = rankResults(items, 'bd', 10);
  // Literal title startsWith ('BD products' tier 4) outranks pinyin initials (tier 7)
  assert.deepEqual(nonSearchTypes(results), ['BD products', '百度搜索']);
});

test('pure-CJK query uses literal path, not pinyin (no ASCII letter gating)', () => {
  setPinyinMatchingEnabled(true);
  const items = [makeItem('百度搜索')];
  const results = rankResults(items, '百度', 10);
  assert.deepEqual(nonSearchTypes(results), ['百度搜索']);
});

test('all-ASCII title with ASCII query that has no literal hit returns no pinyin match', () => {
  setPinyinMatchingEnabled(true);
  const items = [makeItem('GitHub')];
  const results = rankResults(items, 'bd', 10);
  // GitHub has no CJK → pinyin gate fails. No literal hit. Item filtered out.
  assert.deepEqual(nonSearchTypes(results), []);
});

test('setPinyinMatchingEnabled(false) disables pinyin matching', () => {
  setPinyinMatchingEnabled(false);
  const items = [makeItem('百度搜索')];
  const results = rankResults(items, 'bd', 10);
  assert.deepEqual(nonSearchTypes(results), []);
  // Restore default for subsequent tests
  setPinyinMatchingEnabled(true);
});

test('non-letter-only query (e.g. 123) does not invoke pinyin', () => {
  setPinyinMatchingEnabled(true);
  const items = [makeItem('百度搜索')];
  const results = rankResults(items, '123', 10);
  assert.deepEqual(nonSearchTypes(results), []);
});
```

- [ ] **Step 2: Run tests — expect 11 failures**

Run: `node --test tests/search-ranking-pinyin.test.js`

Expected: most fail with `setPinyinMatchingEnabled is not a function` or pinyin items missing from results.

- [ ] **Step 3: Edit `search-ranking.js` to add the pinyin tier path + setter**

Open `search-ranking.js`. The IIFE currently does not require `pinyin-index.js` / `pinyin-matcher.js`; we need it to find them on `globalThis` (set by Node test setup or content-script injection order).

Near the top of the IIFE (after `'use strict';`), add:

```javascript
  // Pinyin matching is opt-out; toggle is wired from search-overlay.js based on user preference.
  let pinyinMatchingEnabled = true;

  function setPinyinMatchingEnabled(value) {
    pinyinMatchingEnabled = !!value;
  }

  function getPinyinHelpers() {
    if (typeof globalThis === 'undefined') return null;
    const indexApi = globalThis.PouncePinyinIndex;
    const matcherApi = globalThis.PouncePinyinMatcher;
    if (!indexApi || !matcherApi) return null;
    return { indexApi, matcherApi };
  }
```

In `getMatchTier`, **before** the final `return Number.POSITIVE_INFINITY;`, insert:

```javascript
    // Pinyin fallback (tiers 6–10). Only invoked when:
    //   1) setting on
    //   2) query has at least one ASCII letter
    //   3) title contains at least one CJK character (verified by the index)
    if (!pinyinMatchingEnabled) {
      return Number.POSITIVE_INFINITY;
    }
    const helpers = getPinyinHelpers();
    if (!helpers) {
      return Number.POSITIVE_INFINITY;
    }
    if (!helpers.matcherApi.hasAsciiLetter(queryData.lowerRaw)) {
      return Number.POSITIVE_INFINITY;
    }
    const titleSource = getDisplayTitle(item);
    const idx = helpers.indexApi.getPinyinIndex(titleSource);
    if (!idx || !idx.hasCjk) {
      return Number.POSITIVE_INFINITY;
    }

    const q = queryData.lowerRaw;
    if (helpers.matcherApi.matchFullStartsWith(q, idx))     return 6;
    if (helpers.matcherApi.matchInitialsStartsWith(q, idx)) return 7;
    if (helpers.matcherApi.matchFullIncludes(q, idx))       return 8;
    if (helpers.matcherApi.matchInitialsIncludes(q, idx))   return 9;
    if (helpers.matcherApi.matchMixed(queryData.raw, idx))  return 10;
```

(Note: `matchMixed` receives `queryData.raw` — the un-lowercased trimmed query — because mixed queries may contain CJK characters that must match by literal equality. The matcher itself handles ASCII case-insensitivity internally.)

Update the `api` object near the bottom to expose the setter:

```javascript
  const api = {
    rankResults,
    getDisplayTitle,
    getHighlightRanges,
    setPinyinMatchingEnabled
  };
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
node --test tests/search-ranking-pinyin.test.js
node --test tests/search-ranking.test.js
node --test tests/pinyin-index.test.js
node --test tests/pinyin-matcher.test.js
```

Expected: all four test files pass. Existing `search-ranking.test.js` cases stay green.

- [ ] **Step 5: Commit**

```bash
git add search-ranking.js tests/search-ranking-pinyin.test.js
git commit -m "feat(search): extend getMatchTier with pinyin tiers 6-10"
```

---

## Task 7: Extend `getHighlightRanges` for pinyin fallback (TDD)

**Files:**
- Modify: `tests/search-ranking.test.js` (append 5 tests)
- Modify: `search-ranking.js` (extend `getHighlightRanges` body)

- [ ] **Step 1: Append failing tests**

At the end of `tests/search-ranking.test.js`, before EOF, append:

```javascript
// --- Pinyin highlight fallback ---
const TinyPinyinForHighlight = require('../vendor/tiny-pinyin.js');
globalThis.TinyPinyin = TinyPinyinForHighlight;
require('../pinyin-index.js');
require('../pinyin-matcher.js');
const { setPinyinMatchingEnabled: setPyForHighlight } = require('../search-ranking.js');

test('getHighlightRanges falls back to pinyin initials when literal misses', () => {
  setPyForHighlight(true);
  assert.deepEqual(getHighlightRanges('百度搜索', 'bd'), [[0, 2]]);
});

test('getHighlightRanges falls back to full pinyin when literal misses', () => {
  setPyForHighlight(true);
  assert.deepEqual(getHighlightRanges('百度搜索', 'baidu'), [[0, 2]]);
});

test('getHighlightRanges prefers literal CJK match over pinyin', () => {
  setPyForHighlight(true);
  // '百度' is a literal substring of '百度搜索' → returns literal range, not pinyin range.
  assert.deepEqual(getHighlightRanges('百度搜索', '百度'), [[0, 2]]);
});

test('getHighlightRanges returns [] for ASCII query against all-ASCII title with no literal hit', () => {
  setPyForHighlight(true);
  assert.deepEqual(getHighlightRanges('GitHub', 'bd'), []);
});

test('getHighlightRanges respects setPinyinMatchingEnabled(false)', () => {
  setPyForHighlight(false);
  assert.deepEqual(getHighlightRanges('百度搜索', 'bd'), []);
  setPyForHighlight(true); // restore
});
```

- [ ] **Step 2: Run tests — expect 5 failures**

Run: `node --test tests/search-ranking.test.js`

Expected: 5 new tests fail (pinyin queries return `[]` instead of `[[0, 2]]`).

- [ ] **Step 3: Extend `getHighlightRanges` in `search-ranking.js`**

Replace the existing `getHighlightRanges` body. The current function looks roughly like:

```javascript
  function getHighlightRanges(text, query) {
    if (typeof text !== 'string' || text.length === 0) return [];
    if (typeof query !== 'string') return [];
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0 || trimmedQuery.length > text.length) return [];

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

Update to:

```javascript
  function getHighlightRanges(text, query) {
    if (typeof text !== 'string' || text.length === 0) return [];
    if (typeof query !== 'string') return [];
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) return [];

    // Literal pass — same as before.
    const literalRanges = [];
    if (trimmedQuery.length <= text.length) {
      const haystack = text.toLowerCase();
      const needle = trimmedQuery.toLowerCase();
      let pos = 0;
      while (pos <= haystack.length - needle.length) {
        const idx = haystack.indexOf(needle, pos);
        if (idx === -1) break;
        literalRanges.push([idx, idx + needle.length]);
        pos = idx + needle.length;
      }
    }
    if (literalRanges.length > 0) return literalRanges;

    // Pinyin fallback — same gates as getMatchTier.
    if (!pinyinMatchingEnabled) return [];
    const helpers = getPinyinHelpers();
    if (!helpers) return [];
    if (!helpers.matcherApi.hasAsciiLetter(trimmedQuery)) return [];
    const idx = helpers.indexApi.getPinyinIndex(text);
    if (!idx || !idx.hasCjk) return [];

    const m = helpers.matcherApi.matchFullStartsWith(trimmedQuery, idx)
           || helpers.matcherApi.matchInitialsStartsWith(trimmedQuery, idx)
           || helpers.matcherApi.matchFullIncludes(trimmedQuery, idx)
           || helpers.matcherApi.matchInitialsIncludes(trimmedQuery, idx)
           || helpers.matcherApi.matchMixed(trimmedQuery, idx);
    return m ? m.ranges : [];
  }
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
node --test tests/search-ranking.test.js
```

Expected: all tests pass (existing cases including the original 11 highlight tests + 5 new pinyin highlight tests).

Run the full test suite:

```bash
node --test tests/
```

Expected: all 4 test files pass.

- [ ] **Step 5: Commit**

```bash
git add search-ranking.js tests/search-ranking.test.js
git commit -m "feat(search): extend getHighlightRanges with pinyin fallback"
```

---

## Task 8: Wire `pinyinMatchingEnabled` into `search-overlay.js`

**Files:**
- Modify: `search-overlay.js`

- [ ] **Step 1: Update fallback `DEFAULT_SEARCH_PREFERENCES` literal**

In `search-overlay.js`, find the constant near line 33–36:

```javascript
  const DEFAULT_SEARCH_PREFERENCES = PREFERENCES.DEFAULT_SEARCH_PREFERENCES || {
    quickPickEnabled: true,
    highlightMatchesEnabled: true
  };
```

Replace with:

```javascript
  const DEFAULT_SEARCH_PREFERENCES = PREFERENCES.DEFAULT_SEARCH_PREFERENCES || {
    quickPickEnabled: true,
    highlightMatchesEnabled: true,
    pinyinMatchingEnabled: true
  };
```

- [ ] **Step 2: Update the `chrome.storage.onChanged` handler**

Find the storage handler near line 278–288:

```javascript
      this.storageChangeHandler = (changes, area) => {
        if (area !== 'sync') return;
        if (!SEARCH_PREFERENCE_KEYS.some(key => changes[key])) return;

        this.searchPreferences = normalizeSearchPreferences({
          quickPickEnabled: changes.quickPickEnabled ? changes.quickPickEnabled.newValue : this.searchPreferences.quickPickEnabled,
          highlightMatchesEnabled: changes.highlightMatchesEnabled ? changes.highlightMatchesEnabled.newValue : this.searchPreferences.highlightMatchesEnabled
        });
        this.applySearchPreferences();
      };
```

Replace the `normalizeSearchPreferences` call with:

```javascript
        this.searchPreferences = normalizeSearchPreferences({
          quickPickEnabled: changes.quickPickEnabled ? changes.quickPickEnabled.newValue : this.searchPreferences.quickPickEnabled,
          highlightMatchesEnabled: changes.highlightMatchesEnabled ? changes.highlightMatchesEnabled.newValue : this.searchPreferences.highlightMatchesEnabled,
          pinyinMatchingEnabled: changes.pinyinMatchingEnabled ? changes.pinyinMatchingEnabled.newValue : this.searchPreferences.pinyinMatchingEnabled
        });
```

- [ ] **Step 3: Push the preference into `search-ranking.js`**

In `applySearchPreferences()` (near line 404), find the existing body and **add at the top** (before the existing `if (this.overlay)` block):

```javascript
    applySearchPreferences() {
      if (window.PounceSearchUtils && typeof window.PounceSearchUtils.setPinyinMatchingEnabled === 'function') {
        window.PounceSearchUtils.setPinyinMatchingEnabled(this.searchPreferences.pinyinMatchingEnabled);
      }

      if (this.overlay) {
        // ... existing body unchanged ...
```

Leave the rest of `applySearchPreferences` as-is.

- [ ] **Step 4: Manually verify by reloading the extension**

There is no JS test for this — the overlay runs in Chrome. Validation happens in Task 11.

- [ ] **Step 5: Commit**

```bash
git add search-overlay.js
git commit -m "feat(overlay): thread pinyinMatchingEnabled to search-ranking"
```

---

## Task 9: Add toggle to `options.html` + `options.js`

**Files:**
- Modify: `options.html`
- Modify: `options.js`

- [ ] **Step 1: Add the toggle markup**

In `options.html`, after the `Highlight matches` `<label class="setting-row">` block (the one that ends around line 651 with `</label>`) and **before** the closing `</div>` of `.settings-list`, insert:

```html
      <label class="setting-row">
        <div class="setting-copy">
          <div class="setting-title">Match Chinese titles by pinyin</div>
          <div class="setting-desc">Type "bd" or "baidu" to find 百度. Auto-skipped for non-Chinese titles.</div>
        </div>
        <span class="toggle">
          <input type="checkbox" id="pinyinMatchingEnabled" checked>
          <span class="toggle-slider"></span>
        </span>
      </label>
```

- [ ] **Step 2: Add the JS wiring**

In `options.js`:

**(2a)** Near line 95, where `highlightMatchesToggle` is declared, add the new toggle reference:

```javascript
  const quickPickToggle = document.getElementById('quickPickEnabled');
  const highlightMatchesToggle = document.getElementById('highlightMatchesEnabled');
  const pinyinMatchingToggle = document.getElementById('pinyinMatchingEnabled');
```

**(2b)** Near line 395, find the `highlightMatchesToggle.addEventListener` block and **append**:

```javascript
      pinyinMatchingToggle.addEventListener('change', () => {
        saveSearchPreference('pinyinMatchingEnabled', pinyinMatchingToggle.checked);
      });
```

**(2c)** In the `chrome.storage.onChanged` listener near line 404, update the `normalizeSearchPreferences` argument:

```javascript
        applySearchPreferenceToggles(normalizeSearchPreferences({
          quickPickEnabled: changes.quickPickEnabled ? changes.quickPickEnabled.newValue : quickPickToggle.checked,
          highlightMatchesEnabled: changes.highlightMatchesEnabled ? changes.highlightMatchesEnabled.newValue : highlightMatchesToggle.checked,
          pinyinMatchingEnabled: changes.pinyinMatchingEnabled ? changes.pinyinMatchingEnabled.newValue : pinyinMatchingToggle.checked
        }));
```

**(2d)** In `applySearchPreferenceToggles` near line 414, add the new line:

```javascript
  function applySearchPreferenceToggles(preferences) {
    quickPickToggle.checked = preferences.quickPickEnabled;
    highlightMatchesToggle.checked = preferences.highlightMatchesEnabled;
    pinyinMatchingToggle.checked = preferences.pinyinMatchingEnabled;
  }
```

- [ ] **Step 3: Manually verify in browser**

```bash
# Load unpacked extension at chrome://extensions and open options page
```

Confirm the new toggle appears under "Search Experience", defaults checked, and persists across page reload.

- [ ] **Step 4: Commit**

```bash
git add options.html options.js
git commit -m "feat(options): add pinyin matching toggle to settings page"
```

---

## Task 10: Update `background.js` content-script injection order

**Files:**
- Modify: `background.js`

- [ ] **Step 1: Add three executeScript calls before search-ranking.js**

In `background.js`, find the `injectAndShow` function near line 437–443:

```javascript
async function injectAndShow(tabId, bridgeTabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['theme-manager.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['preferences.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['search-ranking.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['search-overlay.js'] });
```

Insert three new lines between `preferences.js` and `search-ranking.js`:

```javascript
async function injectAndShow(tabId, bridgeTabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['theme-manager.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['preferences.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['vendor/tiny-pinyin.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['pinyin-index.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['pinyin-matcher.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['search-ranking.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['search-overlay.js'] });
```

The order matters: `vendor/tiny-pinyin.js` must run before `pinyin-index.js` (which uses `globalThis.TinyPinyin`); `pinyin-index.js` and `pinyin-matcher.js` must run before `search-ranking.js` (which calls `getPinyinHelpers()` reading `globalThis.PouncePinyinIndex` / `PouncePinyinMatcher`).

- [ ] **Step 2: Verify the injection still works**

Reload the extension in `chrome://extensions`, open a non-chrome:// page, press `⌘K`. The overlay should appear with no console errors.

If you see `TinyPinyin is not defined` or `Cannot read properties of undefined (reading 'parse')` in the console, double-check the file paths — `vendor/tiny-pinyin.js` is relative to the extension root.

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "feat(background): inject pinyin scripts before search-ranking"
```

---

## Task 11: Manual end-to-end verification

**Files:** None modified.

This task does not produce code; it validates the integrated behavior. Mark each item complete only after observing the expected result.

- [ ] **Step 1: Reload the unpacked extension**

In `chrome://extensions`, click the reload button on the Pounce card. Open a fresh tab.

- [ ] **Step 2: Verify the new toggle**

Open the options page (right-click → Options, or via `chrome://extensions`). Confirm:
- "Match Chinese titles by pinyin" appears under "Search Experience"
- Toggle defaults to ON
- Toggling and reloading the page persists the state

- [ ] **Step 3: Verify pinyin matching with realistic content**

Open at least 3 tabs whose titles contain Chinese (e.g., 知乎, 百度, 微博). Press `⌘K`.

- [ ] Type `bd` → 百度 appears in results, with 百度 highlighted
- [ ] Type `baidu` → 百度 appears, 百度 highlighted
- [ ] Type `zh` → 知乎 appears, 知乎 highlighted
- [ ] Type `百度` → 百度 appears via literal CJK matching (highlight on 百度)
- [ ] Type `百d` (mixed) → 百度 appears, 百度 highlighted

- [ ] **Step 4: Verify literal-first ordering**

Open one tab titled in English (e.g., a Bond movie page) and one titled 百度 simultaneously. Type `bd`:
- The English `BD…` / Bond tab should rank above 百度 (literal title startsWith tier 4 vs pinyin initials tier 7)

- [ ] **Step 5: Verify the disable toggle**

Turn the new toggle OFF in options. Reopen `⌘K` and type `bd`:
- 百度 should NOT appear in results
- English tabs containing literal "bd" should still appear (literal path unaffected)

Re-enable the toggle.

- [ ] **Step 6: Verify highlight visual**

While typing pinyin queries, confirm the matched CJK characters render with the same `.pounce-highlight` style (primary color, weight 600) as the existing literal highlight.

- [ ] **Step 7: Verify no console errors**

Open DevTools on the host page where the overlay is visible. The console should be free of any errors mentioning `TinyPinyin`, `PouncePinyinIndex`, `PouncePinyinMatcher`, or `setPinyinMatchingEnabled`.

- [ ] **Step 8: Verify backwards compatibility**

Disable the new toggle, then verify all existing 1.4.6 functionality is unchanged:
- Quick pick (Alt+1..9) still works
- Highlight on literal matches still works
- Direct URL input ("Open …") still appears
- "Search for …" fallback still appears

- [ ] **Step 9: Bundle the package and inspect zip size**

```bash
./build.sh
ls -lh pounce-*.zip | tail -1
```

Expected: zip grows from ~55KB to ~150–170KB.

- [ ] **Step 10: Commit any final tweaks**

If verification surfaced minor adjustments (typo, label wording, etc.), commit them with focused messages. Otherwise:

```bash
# No-op — no commit needed if verification passed cleanly
```

---

## Self-Review Notes

This section is for the plan author. Items below were verified before publishing:

- **Spec coverage:** Every line in the spec's "决策摘要" table has a corresponding task. Tier numbers (6=full startsWith, 7=initials startsWith, 8=full includes, 9=initials includes, 10=mixed) are consistent across Task 6 implementation and Task 6/Task 7 tests.
- **Type/name consistency:** `setPinyinMatchingEnabled`, `getPinyinIndex`, `clearCache`, `hasCjkText`, `hasAsciiLetter`, `matchFullStartsWith`, `matchInitialsStartsWith`, `matchFullIncludes`, `matchInitialsIncludes`, `matchMixed` — all referenced consistently across tasks.
- **Spec deviations** (intentional, called out in header): vendor filename `vendor/tiny-pinyin.js` (not `.min.js`); no `manifest.json` change (no content_scripts block).
- **First-run prompt:** Spec is silent on this. Per user feedback (memory: `feedback_no_optin_prompts.md`), default ON without any first-run hint. Task 9 implements only the persistent toggle in options.
- **Test file load order:** Each pinyin test file loads `vendor/tiny-pinyin.js` and assigns to `globalThis.TinyPinyin` before requiring `pinyin-index.js` — same pattern Chrome uses via injection order.
