const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_SEARCH_PREFERENCES,
  ALLOWED_RESULTS_LIMITS,
  normalizeResultsLimit,
  normalizeSearchPreferences
} = require('../preferences.js');

test('missing search preferences default to enabled', () => {
  assert.deepEqual(normalizeSearchPreferences({}), DEFAULT_SEARCH_PREFERENCES);
  assert.deepEqual(normalizeSearchPreferences(undefined), DEFAULT_SEARCH_PREFERENCES);
});

test('explicit disabled search preferences are preserved', () => {
  assert.deepEqual(normalizeSearchPreferences({
    quickPickEnabled: false,
    pinyinMatchingEnabled: false
  }), {
    quickPickEnabled: false,
    pinyinMatchingEnabled: false,
    tabGroupingEnabled: DEFAULT_SEARCH_PREFERENCES.tabGroupingEnabled,
    resultsLimit: DEFAULT_SEARCH_PREFERENCES.resultsLimit
  });
});

test('tabGroupingEnabled defaults to false (opt-in feature)', () => {
  assert.equal(normalizeSearchPreferences({}).tabGroupingEnabled, false);
  assert.equal(normalizeSearchPreferences({ tabGroupingEnabled: true }).tabGroupingEnabled, true);
});

test('non-boolean search preferences fall back to defaults', () => {
  assert.deepEqual(normalizeSearchPreferences({
    quickPickEnabled: 'false',
    pinyinMatchingEnabled: null
  }), DEFAULT_SEARCH_PREFERENCES);
});

test('resultsLimit accepts only allowed values', () => {
  for (const value of ALLOWED_RESULTS_LIMITS) {
    assert.equal(normalizeResultsLimit(value), value);
    assert.equal(normalizeResultsLimit(String(value)), value);
    assert.equal(normalizeSearchPreferences({ resultsLimit: value }).resultsLimit, value);
    assert.equal(normalizeSearchPreferences({ resultsLimit: String(value) }).resultsLimit, value);
  }
});

test('invalid resultsLimit falls back to default', () => {
  for (const value of [0, 5, 100, 'ten', null, undefined, NaN, true]) {
    assert.equal(normalizeResultsLimit(value), DEFAULT_SEARCH_PREFERENCES.resultsLimit);
    assert.equal(
      normalizeSearchPreferences({ resultsLimit: value }).resultsLimit,
      DEFAULT_SEARCH_PREFERENCES.resultsLimit
    );
  }
});

test('non-object preference payloads fall back to defaults without throwing', () => {
  for (const bad of [null, 'nope', 42, true, []]) {
    assert.deepEqual(normalizeSearchPreferences(bad), DEFAULT_SEARCH_PREFERENCES);
  }
});

test('unknown preference keys are not copied into the result', () => {
  const out = normalizeSearchPreferences({
    evil: true,
    quickPickEnabled: false
  });
  assert.equal(out.quickPickEnabled, false);
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'evil'), false);
  assert.deepEqual(Object.keys(out).sort(), Object.keys(DEFAULT_SEARCH_PREFERENCES).sort());
});
