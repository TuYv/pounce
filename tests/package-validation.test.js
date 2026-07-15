const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const {
  parsePackageFileList,
  validateArchiveEntries,
  validateManifest
} = require('../scripts/validate-release.js');

function createValidManifest() {
  return {
    manifest_version: 3,
    version: '1.6.1',
    default_locale: 'en',
    name: '__MSG_ext_name__',
    description: '__MSG_ext_description__',
    background: {
      service_worker: 'background.js'
    },
    action: {
      default_popup: 'popup.html',
      default_title: '__MSG_action_title__'
    },
    options_page: 'options.html',
    icons: {
      16: 'icons/icon16.png'
    },
    web_accessible_resources: [
      {
        matches: ['<all_urls>'],
        resources: ['_locales/*/messages.json', '_favicon/*']
      }
    ]
  };
}

const validArchiveEntries = [
  'manifest.json',
  'background.js',
  'popup.html',
  'options.html',
  'icons/icon16.png',
  '_locales/en/messages.json',
  '_locales/zh_CN/messages.json'
];

const validDefaultMessages = {
  ext_name: { message: 'Pounce' },
  ext_description: { message: 'Search tabs and bookmarks' },
  action_title: { message: 'Pounce' }
};

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

test('manifest validation accepts packaged runtime and localization references', () => {
  assert.deepEqual(
    validateManifest(
      createValidManifest(),
      validArchiveEntries,
      validDefaultMessages
    ),
    []
  );
});

test('manifest validation reports missing runtime files and default messages', () => {
  const manifest = createValidManifest();
  manifest.name = '__MSG_missing_name__';

  assert.deepEqual(
    validateManifest(
      manifest,
      validArchiveEntries.filter(entry => entry !== 'background.js'),
      validDefaultMessages
    ),
    [
      'manifest message key is missing from default locale: missing_name',
      'manifest references missing packaged file: background.js'
    ]
  );
});

test('manifest validation rejects non-object manifests', () => {
  for (const manifest of [null, [], 'manifest']) {
    assert.deepEqual(
      validateManifest(manifest, validArchiveEntries, validDefaultMessages),
      ['manifest must be an object']
    );
  }
});

test('manifest validation enforces manifest metadata and the default locale directory', () => {
  const manifest = createValidManifest();
  manifest.manifest_version = 2;
  manifest.default_locale = 'fr';

  assert.deepEqual(
    validateManifest(manifest, validArchiveEntries, validDefaultMessages),
    [
      'manifest default locale directory is missing: _locales/fr/',
      'manifest_version must be 3'
    ]
  );

  manifest.manifest_version = 3;
  manifest.default_locale = '';
  assert.deepEqual(
    validateManifest(manifest, validArchiveEntries, validDefaultMessages),
    ['manifest default_locale must be a non-empty string']
  );
});

test('manifest validation accepts any normalized file in the default locale directory', () => {
  const archiveEntries = [
    ...validArchiveEntries.filter(entry => entry !== '_locales/en/messages.json'),
    '.\\_locales\\en\\placeholder.txt'
  ];

  assert.deepEqual(
    validateManifest(
      createValidManifest(),
      archiveEntries,
      validDefaultMessages
    ),
    []
  );
});

test('manifest validation accepts only canonical Chrome dotted numeric versions', () => {
  for (const version of ['0', '65535.0.1.2']) {
    const manifest = createValidManifest();
    manifest.version = version;
    assert.deepEqual(
      validateManifest(manifest, validArchiveEntries, validDefaultMessages),
      []
    );
  }

  for (const version of ['', '01.2', '1.2.3.4.5', '1.65536', '-1', 1]) {
    const manifest = createValidManifest();
    manifest.version = version;
    assert.deepEqual(
      validateManifest(manifest, validArchiveEntries, validDefaultMessages),
      ['manifest version must be a Chrome dotted numeric version']
    );
  }
});

test('manifest validation matches packaged wildcards and only exempts exact _favicon/*', () => {
  const manifest = createValidManifest();
  manifest.web_accessible_resources[0].resources = [
    'assets/*.js',
    '_favicon/*',
    '_favicon/icon.png'
  ];
  const archiveEntries = [
    ...validArchiveEntries,
    '.\\assets\\runtime.js'
  ];

  assert.deepEqual(
    validateManifest(manifest, archiveEntries, validDefaultMessages),
    ['manifest references missing packaged file: _favicon/icon.png']
  );

  assert.deepEqual(
    validateManifest(
      manifest,
      validArchiveEntries,
      validDefaultMessages
    ),
    [
      'manifest references missing packaged file: _favicon/icon.png',
      'manifest references missing packaged file: assets/*.js'
    ]
  );
});

test('manifest validation does not exempt normalized aliases of _favicon/*', () => {
  for (const resource of ['./_favicon/*', '_favicon\\*']) {
    const manifest = createValidManifest();
    manifest.web_accessible_resources[0].resources = [resource];

    assert.deepEqual(
      validateManifest(manifest, validArchiveEntries, validDefaultMessages),
      ['manifest references missing packaged file: _favicon/*']
    );
  }
});

test('manifest wildcard matching treats every non-star character literally', () => {
  const manifest = createValidManifest();
  manifest.web_accessible_resources[0].resources = [
    'assets/*[draft](😀).js'
  ];

  assert.deepEqual(
    validateManifest(
      manifest,
      [...validArchiveEntries, 'assets/build[draft](😀).js'],
      validDefaultMessages
    ),
    []
  );
});

test('manifest validation bounds adversarial wildcard matching time', () => {
  const manifest = createValidManifest();
  const wildcard = `${'*a'.repeat(16)}b`;
  manifest.web_accessible_resources[0].resources = [wildcard];
  const archiveEntries = [
    ...validArchiveEntries,
    `${'a'.repeat(32)}c`
  ];

  const start = performance.now();
  const errors = validateManifest(
    manifest,
    archiveEntries,
    validDefaultMessages
  );
  const elapsed = performance.now() - start;

  assert.deepEqual(
    errors,
    [`manifest references missing packaged file: ${wildcard}`]
  );
  assert.ok(elapsed < 1000, `wildcard matching took ${elapsed.toFixed(1)}ms`);
});
