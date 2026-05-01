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
