const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const {
  parsePackageFileList,
  validateArchiveEntries,
  validateManifest,
  validateLocales,
  validatePrivacyPolicy
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

test('locale validation reports extra keys and broken placeholder references', () => {
  const en = {
    notify: {
      message: 'Press $search$',
      placeholders: {
        search: { content: '$1' }
      }
    }
  };
  const zh_CN = {
    notify: {
      message: '按 \\$',
      placeholders: {
        search: { content: '$1' }
      }
    },
    extra: { message: '额外' }
  };

  const errors = validateLocales({ en, zh_CN });

  assert.ok(errors.includes('locale key only in zh_CN: extra'));
  assert.ok(errors.includes(
    'locale message does not reference declared placeholder zh_CN.notify: $search$'
  ));
});

test('locale validation reports key parity in both directions', () => {
  assert.deepEqual(
    validateLocales({
      en: { englishOnly: { message: 'English' } },
      zh_CN: { chineseOnly: { message: '中文' } }
    }),
    [
      'locale key only in en: englishOnly',
      'locale key only in zh_CN: chineseOnly'
    ]
  );
});

test('locale validation reports placeholder name and content incompatibilities', () => {
  const errors = validateLocales({
    en: {
      notify: {
        message: '$englishOnly$ $shared$',
        placeholders: {
          englishOnly: { content: '$1' },
          shared: { content: '$2' }
        }
      }
    },
    zh_CN: {
      notify: {
        message: '$chineseOnly$ $shared$',
        placeholders: {
          chineseOnly: { content: '$1' },
          shared: { content: '$3' }
        }
      }
    }
  });

  assert.deepEqual(errors, [
    'locale placeholder content differs notify.shared',
    'locale placeholder only in en notify: englishOnly',
    'locale placeholder only in zh_CN notify: chineseOnly'
  ]);
});

test('locale validation reports declared and undeclared named tokens per locale', () => {
  const errors = validateLocales({
    en: {
      notify: {
        message: 'Press $ghost$',
        placeholders: { search: { content: '$1' } }
      }
    },
    zh_CN: {
      notify: {
        message: '按 $other$',
        placeholders: { search: { content: '$1' } }
      }
    }
  });

  assert.deepEqual(errors, [
    'locale message does not reference declared placeholder en.notify: $search$',
    'locale message does not reference declared placeholder zh_CN.notify: $search$',
    'locale message references undeclared placeholder en.notify: $ghost$',
    'locale message references undeclared placeholder zh_CN.notify: $other$'
  ]);
});

test('locale validation recognizes only exact valid named placeholder tokens', () => {
  const placeholders = { search: { content: '$1' } };

  assert.deepEqual(
    validateLocales({
      en: {
        notify: {
          message: '$search$ $9ignored$ $dash-name$',
          placeholders
        }
      },
      zh_CN: {
        notify: {
          message: '$search$ $9ignored$ $dash-name$',
          placeholders
        }
      }
    }),
    []
  );

  assert.deepEqual(
    validateLocales({
      en: {
        notify: {
          message: '$searching$',
          placeholders
        }
      },
      zh_CN: {
        notify: {
          message: '$search$',
          placeholders
        }
      }
    }),
    [
      'locale message does not reference declared placeholder en.notify: $search$',
      'locale message references undeclared placeholder en.notify: $searching$'
    ]
  );
});

test('locale validation handles malformed locale and message values safely', () => {
  assert.deepEqual(validateLocales({ en: null, zh_CN: [] }), []);
  assert.deepEqual(
    validateLocales({
      en: { malformed: null },
      zh_CN: { malformed: 'not a message object' }
    }),
    []
  );
});

test('locale validation ignores inherited locale dictionaries', () => {
  const locales = Object.create({
    en: { inherited: { message: 'Inherited' } },
    zh_CN: { inherited: { message: '继承' } }
  });
  locales.zh_CN = {};

  assert.deepEqual(validateLocales(locales), []);
});

test('locale validation ignores inherited message and placeholders fields', () => {
  const inheritedMessage = Object.create({ message: '$ghost$' });
  const inheritedPlaceholders = Object.assign(
    Object.create({
      placeholders: { ghost: { content: '$1' } }
    }),
    { message: 'Plain' }
  );

  assert.deepEqual(
    validateLocales({
      en: {
        inheritedMessage,
        inheritedPlaceholders
      },
      zh_CN: {
        inheritedMessage: {},
        inheritedPlaceholders: { message: 'Plain' }
      }
    }),
    []
  );
});

test('locale validation ignores inherited placeholder names and content', () => {
  const inheritedNames = Object.create({
    ghost: { content: '$1' }
  });
  const enContent = Object.create({ content: '$1' });
  const zhContent = Object.create({ content: '$2' });
  inheritedNames.search = enContent;

  assert.deepEqual(
    validateLocales({
      en: {
        notify: {
          message: '$search$',
          placeholders: inheritedNames
        }
      },
      zh_CN: {
        notify: {
          message: '$search$',
          placeholders: { search: zhContent }
        }
      }
    }),
    []
  );
});

test('privacy validation reports missing canonical source and packaged source', () => {
  const errors = validatePrivacyPolicy({
    readmeText: 'Privacy: https://example.com/privacy.html',
    privacyFileExists: false,
    archiveEntries: ['manifest.json', 'docs/privacy.html']
  });

  assert.deepEqual(errors, [
    'canonical privacy policy URL is missing from README.md',
    'docs/privacy.html is missing from the repository',
    'privacy policy source must not be packaged: docs/privacy.html'
  ]);
});

test('privacy validation accepts canonical repository-only policy metadata', () => {
  assert.deepEqual(
    validatePrivacyPolicy({
      readmeText: 'Privacy policy: https://tuyv.github.io/pounce/privacy.html',
      privacyFileExists: true,
      archiveEntries: ['manifest.json', 'background.js']
    }),
    []
  );
});

test('privacy validation normalizes archive entries before checking packaging', () => {
  assert.deepEqual(
    validatePrivacyPolicy({
      readmeText: 'https://tuyv.github.io/pounce/privacy.html',
      privacyFileExists: true,
      archiveEntries: ['.\\docs\\privacy.html']
    }),
    ['privacy policy source must not be packaged: docs/privacy.html']
  );
});

test('privacy validation canonicalizes safe internal archive path segments', () => {
  for (const archiveEntry of [
    'docs/./privacy.html',
    'docs//privacy.html',
    '.\\docs\\.\\privacy.html'
  ]) {
    assert.deepEqual(
      validatePrivacyPolicy({
        readmeText: 'https://tuyv.github.io/pounce/privacy.html',
        privacyFileExists: true,
        archiveEntries: [archiveEntry]
      }),
      ['privacy policy source must not be packaged: docs/privacy.html']
    );
  }
});

test('privacy validation does not collapse unsafe parent traversal segments', () => {
  const unsafeEntry = 'docs/../docs/privacy.html';

  assert.deepEqual(
    validatePrivacyPolicy({
      readmeText: 'https://tuyv.github.io/pounce/privacy.html',
      privacyFileExists: true,
      archiveEntries: [unsafeEntry]
    }),
    []
  );
  assert.ok(
    validateArchiveEntries(
      ['manifest.json', unsafeEntry],
      ['manifest.json']
    ).includes(`unsafe archive entry: ${unsafeEntry}`)
  );
});
