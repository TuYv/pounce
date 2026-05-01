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
