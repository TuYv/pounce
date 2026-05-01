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
