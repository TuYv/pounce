const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parsePackageFileList,
  validateArchiveEntries
} = require('../scripts/validate-release.js');

test('parsePackageFileList ignores comments and blank lines', () => {
  assert.deepEqual(
    parsePackageFileList('manifest.json\n\n# assets\nicons/\n'),
    ['manifest.json', 'icons/']
  );
});

test('parsePackageFileList rejects unsafe and duplicate paths', () => {
  assert.throws(
    () => parsePackageFileList('/tmp/manifest.json\n'),
    /invalid package path: \/tmp\/manifest\.json/
  );
  assert.throws(
    () => parsePackageFileList('../manifest.json\n'),
    /invalid package path: \.\.\/manifest\.json/
  );
  assert.throws(
    () => parsePackageFileList('manifest.json\nmanifest.json\n'),
    /duplicate package path: manifest\.json/
  );
});

test('parsePackageFileList rejects Windows absolute paths and traversal', () => {
  for (const entry of ['..\\secret.txt', 'C:\\secret.txt', 'C:/secret.txt']) {
    assert.throws(
      () => parsePackageFileList(`${entry}\n`),
      new RegExp(`invalid package path: ${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    );
  }
});

test('archive coverage reports missing allowlisted paths and unexpected files', () => {
  const errors = validateArchiveEntries(
    ['manifest.json', 'icons/icon16.png', 'tests/debug.test.js'],
    ['manifest.json', 'background.js', 'icons/']
  );

  assert.deepEqual(errors, [
    'missing packaged path: background.js',
    'unexpected archive entry: tests/debug.test.js'
  ]);
});

test('archive coverage rejects parent traversal and a nested package root', () => {
  const traversalErrors = validateArchiveEntries(
    ['manifest.json', '../secret.txt'],
    ['manifest.json']
  );
  assert.ok(traversalErrors.includes('unsafe archive entry: ../secret.txt'));

  const nestedErrors = validateArchiveEntries(
    ['pounce/manifest.json'],
    ['manifest.json']
  );
  assert.ok(nestedErrors.includes('manifest.json must be at the archive root'));
});

test('archive coverage normalizes backslashes and leading dot segments', () => {
  assert.deepEqual(
    validateArchiveEntries(
      ['.\\manifest.json', '.\\icons\\icon16.png'],
      ['manifest.json', 'icons/']
    ),
    []
  );
});

test('archive coverage ignores safe directories but rejects unsafe directories', () => {
  assert.deepEqual(
    validateArchiveEntries(
      ['./manifest.json', './icons/'],
      ['manifest.json', 'icons/']
    ),
    ['missing packaged path: icons']
  );

  assert.deepEqual(
    validateArchiveEntries(
      ['./manifest.json', './icons/', '../secret/', 'C:\\private\\'],
      ['manifest.json']
    ),
    [
      'unsafe archive entry: ../secret/',
      'unsafe archive entry: C:/private/'
    ]
  );
});

test('archive coverage rejects POSIX and Windows absolute file entries', () => {
  const errors = validateArchiveEntries(
    ['manifest.json', '/tmp/secret.txt', 'C:\\secret.txt', 'D:/private.txt'],
    ['manifest.json']
  );

  assert.ok(errors.includes('unsafe archive entry: /tmp/secret.txt'));
  assert.ok(errors.includes('unsafe archive entry: C:/secret.txt'));
  assert.ok(errors.includes('unsafe archive entry: D:/private.txt'));
});

test('archive coverage returns errors in stable sorted order', () => {
  const errors = validateArchiveEntries(
    ['z.txt', '../secret.txt', 'nested/manifest.json'],
    ['manifest.json', 'background.js']
  );

  assert.deepEqual(errors, [...errors].sort());
  assert.deepEqual(errors, [
    'manifest.json must be at the archive root',
    'missing packaged path: background.js',
    'missing packaged path: manifest.json',
    'unexpected archive entry: ../secret.txt',
    'unexpected archive entry: nested/manifest.json',
    'unexpected archive entry: z.txt',
    'unsafe archive entry: ../secret.txt'
  ]);
});
