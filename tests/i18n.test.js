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
