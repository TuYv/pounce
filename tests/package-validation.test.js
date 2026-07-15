const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
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

function requireArchiveTools(t) {
  for (const tool of ['zip', 'unzip']) {
    const result = spawnSync(tool, ['-v'], { stdio: 'ignore' });
    if (result.error && result.error.code === 'ENOENT') {
      t.skip(`required integration-test tool is unavailable: ${tool}`);
      return false;
    }
  }
  return true;
}

function archiveTest(name, fn) {
  test(name, t => {
    if (requireArchiveTools(t)) {
      fn(t);
    }
  });
}

function createReleaseFixture(t, options = {}) {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pounce-package-validation-')
  );
  t.after(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });
  const packageRoot = path.join(fixtureRoot, 'package');
  const zipPath = path.join(fixtureRoot, 'release.zip');
  const manifest = options.manifest ?? {
    manifest_version: 3,
    version: '1.0.0',
    default_locale: 'en'
  };

  fs.mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, '_locales', 'en'), {
    recursive: true
  });
  fs.mkdirSync(path.join(packageRoot, '_locales', 'zh_CN'), {
    recursive: true
  });
  fs.writeFileSync(
    path.join(fixtureRoot, 'scripts', 'package-files.txt'),
    options.packageFileList ?? 'manifest.json\n_locales/\n'
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'README.md'),
    options.readmeText ?? 'https://tuyv.github.io/pounce/privacy.html\n'
  );
  fs.writeFileSync(path.join(fixtureRoot, 'docs', 'privacy.html'), 'Privacy');
  fs.writeFileSync(
    path.join(packageRoot, 'manifest.json'),
    options.manifestText ?? JSON.stringify(manifest)
  );
  fs.writeFileSync(
    path.join(packageRoot, '_locales', 'en', 'messages.json'),
    options.enText ?? JSON.stringify(options.en ?? {})
  );
  fs.writeFileSync(
    path.join(packageRoot, '_locales', 'zh_CN', 'messages.json'),
    options.zhText ?? JSON.stringify(options.zh_CN ?? {})
  );
  execFileSync(
    'zip',
    ['-r', zipPath, 'manifest.json', '_locales'],
    { cwd: packageRoot, stdio: 'ignore' }
  );

  return { fixtureRoot, packageRoot, zipPath };
}

function createBuildFixture(t) {
  const repositoryRoot = path.resolve(__dirname, '..');
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pounce-build-validation-')
  );
  t.after(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  const packageFileListPath = path.join(
    repositoryRoot,
    'scripts',
    'package-files.txt'
  );
  const packagePaths = parsePackageFileList(
    fs.readFileSync(packageFileListPath, 'utf8')
  );
  const fixtureScripts = path.join(fixtureRoot, 'scripts');
  fs.mkdirSync(fixtureScripts, { recursive: true });
  fs.copyFileSync(
    path.join(repositoryRoot, 'build.sh'),
    path.join(fixtureRoot, 'build.sh')
  );

  for (const filename of [
    'CHANGELOG.md',
    'CHANGELOG.zh-CN.md',
    'README.md',
    'docs/privacy.html'
  ]) {
    const destination = path.join(fixtureRoot, filename);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(repositoryRoot, filename), destination);
  }

  for (const packagePath of packagePaths) {
    const relativePath = packagePath.replace(/\/$/, '');
    const source = path.join(repositoryRoot, relativePath);
    const destination = path.join(fixtureRoot, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
  }

  return { fixtureRoot, packagePaths };
}

function renameArchiveEntry(zipPath, originalName, replacementName) {
  const original = Buffer.from(originalName);
  const replacement = Buffer.from(replacementName);
  assert.equal(replacement.length, original.length);

  const archive = fs.readFileSync(zipPath);
  let offset = 0;
  let replacements = 0;
  while ((offset = archive.indexOf(original, offset)) !== -1) {
    replacement.copy(archive, offset);
    offset += original.length;
    replacements += 1;
  }

  assert.equal(replacements, 2);
  fs.writeFileSync(zipPath, archive);
}

function addRenamedArchiveEntry(
  zipPath,
  packageRoot,
  originalName,
  replacementName,
  contents = 'runtime'
) {
  const originalPath = path.join(packageRoot, ...originalName.split('/'));
  fs.mkdirSync(path.dirname(originalPath), { recursive: true });
  fs.writeFileSync(originalPath, contents);
  execFileSync(
    'zip',
    ['-g', zipPath, originalName],
    { cwd: packageRoot, stdio: 'ignore' }
  );
  if (originalName !== replacementName) {
    renameArchiveEntry(zipPath, originalName, replacementName);
  }
}

function writeRepositoryMetadata(fixtureRoot, manifest, en = {}, zh_CN = {}) {
  fs.mkdirSync(path.join(fixtureRoot, '_locales', 'en'), {
    recursive: true
  });
  fs.mkdirSync(path.join(fixtureRoot, '_locales', 'zh_CN'), {
    recursive: true
  });
  fs.writeFileSync(
    path.join(fixtureRoot, 'manifest.json'),
    JSON.stringify(manifest)
  );
  fs.writeFileSync(
    path.join(fixtureRoot, '_locales', 'en', 'messages.json'),
    JSON.stringify(en)
  );
  fs.writeFileSync(
    path.join(fixtureRoot, '_locales', 'zh_CN', 'messages.json'),
    JSON.stringify(zh_CN)
  );
}

function runValidator(zipPath, fixtureRoot) {
  return spawnSync(
    process.execPath,
    [
      'scripts/validate-release.js',
      zipPath,
      '--repo-root',
      fixtureRoot
    ],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
  );
}

archiveTest('build trims package allowlist whitespace like release validation', t => {
  const { fixtureRoot, packagePaths } = createBuildFixture(t);
  const version = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, 'manifest.json'), 'utf8')
  ).version;
  const packageFileList = [
    '   # package payload   ',
    ' \t ',
    ...packagePaths.map(packagePath => ` \t${packagePath}\t `),
    ''
  ].join('\r\n');
  fs.writeFileSync(
    path.join(fixtureRoot, 'scripts', 'package-files.txt'),
    packageFileList
  );

  const buildResult = spawnSync(
    'bash',
    ['build.sh', version],
    { cwd: fixtureRoot, encoding: 'utf8' }
  );

  assert.equal(
    buildResult.status,
    0,
    `build stdout:\n${buildResult.stdout}\nbuild stderr:\n${buildResult.stderr}`
  );
  const zipPath = path.join(fixtureRoot, `pounce-${version}.zip`);
  assert.ok(fs.existsSync(zipPath));

  const validationResult = runValidator(zipPath, fixtureRoot);
  assert.equal(validationResult.status, 0, validationResult.stderr);
  assert.equal(
    validationResult.stdout,
    `release package validation passed: ${zipPath}\n`
  );
  assert.equal(validationResult.stderr, '');
});

archiveTest('CLI validates manifest references against files in a real ZIP', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t, {
    manifest: {
      manifest_version: 3,
      version: '1.0.0',
      default_locale: 'en',
      background: { service_worker: 'background.js' }
    }
  });

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'release package validation failed:\n' +
      '- manifest references missing packaged file: background.js\n'
  );
  assert.equal(result.stdout, '');
});

archiveTest('CLI enforces package-files.txt for runtime files in a real ZIP', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t, {
    packageFileList: 'manifest.json\npopup.js\n_locales/\n'
  });

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'release package validation failed:\n' +
      '- missing packaged path: popup.js\n'
  );
  assert.equal(result.stdout, '');
});

archiveTest('CLI rejects canonical path collisions in a real ZIP', t => {
  const { fixtureRoot, packageRoot, zipPath } = createReleaseFixture(t, {
    en: { archiveOnly: { message: 'Archive' } }
  });
  addRenamedArchiveEntry(
    zipPath,
    packageRoot,
    'x/manifest.json',
    './manifest.json',
    JSON.stringify({ manifest_version: 2 })
  );

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'release package validation failed:\n' +
      '- duplicate archive entry: manifest.json\n' +
      '- locale key only in en: archiveOnly\n' +
      '- noncanonical archive entry: ./manifest.json\n'
  );
  assert.equal(result.stdout, '');
});

archiveTest('CLI rejects a backslash runtime alias as missing', t => {
  const { fixtureRoot, packageRoot, zipPath } = createReleaseFixture(t, {
    packageFileList: 'manifest.json\nvendor/runtime.js\n_locales/\n'
  });
  addRenamedArchiveEntry(
    zipPath,
    packageRoot,
    'vendor/runtime.js',
    'vendor\\runtime.js'
  );

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'release package validation failed:\n' +
      '- missing packaged path: vendor/runtime.js\n' +
      '- noncanonical archive entry: vendor\\runtime.js\n'
  );
  assert.equal(result.stdout, '');
});

archiveTest('CLI rejects a terminal-dot runtime alias as missing', t => {
  const { fixtureRoot, packageRoot, zipPath } = createReleaseFixture(t, {
    packageFileList: 'manifest.json\npopup.js\n_locales/\n'
  });
  addRenamedArchiveEntry(
    zipPath,
    packageRoot,
    'x/popup.js',
    'popup.js/.'
  );

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'release package validation failed:\n' +
      '- missing packaged path: popup.js\n' +
      '- noncanonical archive entry: popup.js/.\n'
  );
  assert.equal(result.stdout, '');
});

archiveTest('CLI rejects a leading-dot manifest as missing', t => {
  const { fixtureRoot, packageRoot, zipPath } = createReleaseFixture(t);
  execFileSync('zip', ['-d', zipPath, 'manifest.json'], { stdio: 'ignore' });
  addRenamedArchiveEntry(
    zipPath,
    packageRoot,
    'x/manifest.json',
    './manifest.json',
    JSON.stringify({
      manifest_version: 3,
      version: '1.0.0',
      default_locale: 'en'
    })
  );

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'release package validation failed:\n' +
      '- archive is missing required file: manifest.json\n' +
      '- manifest.json must be at the archive root\n' +
      '- missing packaged path: manifest.json\n' +
      '- noncanonical archive entry: ./manifest.json\n'
  );
  assert.equal(result.stdout, '');
});

archiveTest('CLI rejects an internal-dot locale alias as missing', t => {
  const { fixtureRoot, packageRoot, zipPath } = createReleaseFixture(t);
  execFileSync(
    'zip',
    ['-d', zipPath, '_locales/en/messages.json'],
    { stdio: 'ignore' }
  );
  addRenamedArchiveEntry(
    zipPath,
    packageRoot,
    '_locales/x/en/messages.json',
    '_locales/en/./messages.json',
    '{}'
  );

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'release package validation failed:\n' +
      '- archive is missing required file: _locales/en/messages.json\n' +
      '- manifest default locale directory is missing: _locales/en/\n' +
      '- noncanonical archive entry: _locales/en/./messages.json\n'
  );
  assert.equal(result.stdout, '');
});

archiveTest('CLI parses metadata despite an unrelated runtime collision', t => {
  const { fixtureRoot, packageRoot, zipPath } = createReleaseFixture(t, {
    manifestText: '{ invalid manifest JSON',
    packageFileList: 'manifest.json\nbackground.js\n_locales/\n'
  });
  addRenamedArchiveEntry(
    zipPath,
    packageRoot,
    'background.js',
    'background.js'
  );
  addRenamedArchiveEntry(
    zipPath,
    packageRoot,
    'x/background.js',
    './background.js'
  );

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate archive entry: background\.js/);
  assert.match(result.stderr, /invalid JSON in manifest\.json:/);
  assert.match(
    result.stderr,
    /noncanonical archive entry: \.\/background\.js/
  );
});

archiveTest('CLI accepts a valid real ZIP with repo root before the archive', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t);

  const result = spawnSync(
    process.execPath,
    [
      'scripts/validate-release.js',
      '--repo-root',
      fixtureRoot,
      zipPath
    ],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    `release package validation passed: ${zipPath}\n`
  );
  assert.equal(result.stderr, '');
});

archiveTest('CLI uses messages from the manifest default locale', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t, {
    manifest: {
      manifest_version: 3,
      version: '1.0.0',
      default_locale: 'zh_CN',
      name: '__MSG_zh_name__'
    },
    zh_CN: {
      zh_name: { message: '灵扑' }
    }
  });

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /locale key only in zh_CN: zh_name/);
  assert.doesNotMatch(
    result.stderr,
    /manifest message key is missing from default locale: zh_name/
  );
});

archiveTest('CLI reports a corrupt archive integrity failure', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t);

  fs.writeFileSync(zipPath, 'not a ZIP archive');

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    new RegExp(
      `archive integrity check failed: ${zipPath.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      )}`
    )
  );
});

archiveTest('CLI labels invalid JSON read from the archive', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t, {
    manifestText: '{ invalid manifest JSON'
  });

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid JSON in manifest\.json:/);
});

archiveTest('CLI aggregates JSON errors from each archived metadata file', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t, {
    manifestText: '{ invalid manifest JSON',
    enText: '{ invalid English JSON',
    zhText: '{ invalid Chinese JSON'
  });

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid JSON in manifest\.json:/);
  assert.match(
    result.stderr,
    /invalid JSON in _locales\/en\/messages\.json:/
  );
  assert.match(
    result.stderr,
    /invalid JSON in _locales\/zh_CN\/messages\.json:/
  );
});

archiveTest('CLI aggregates invalid manifest JSON with a missing locale', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t, {
    manifestText: '{ invalid manifest JSON'
  });
  execFileSync(
    'zip',
    ['-d', zipPath, '_locales/zh_CN/messages.json'],
    { stdio: 'ignore' }
  );

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /archive is missing required file: _locales\/zh_CN\/messages\.json/
  );
  assert.match(result.stderr, /invalid JSON in manifest\.json:/);
  assert.ok(
    result.stderr.indexOf('archive is missing required file:') <
      result.stderr.indexOf('invalid JSON in manifest.json:')
  );
});

archiveTest('CLI validates a parsed manifest when a locale is missing', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t, {
    manifest: {
      manifest_version: 3,
      version: '1.0.0',
      default_locale: 'zh_CN',
      name: '__MSG_missing_name__',
      background: { service_worker: 'background.js' }
    }
  });
  execFileSync(
    'zip',
    ['-d', zipPath, '_locales/zh_CN/messages.json'],
    { stdio: 'ignore' }
  );

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'release package validation failed:\n' +
      '- archive is missing required file: ' +
      '_locales/zh_CN/messages.json\n' +
      '- manifest default locale directory is missing: ' +
      '_locales/zh_CN/\n' +
      '- manifest message key is missing from default locale: ' +
      'missing_name\n' +
      '- manifest references missing packaged file: background.js\n'
  );
});

archiveTest('CLI validates parsed locales when the manifest is invalid', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t, {
    manifestText: '{ invalid manifest JSON',
    en: { archiveOnly: { message: 'Archive' } }
  });

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid JSON in manifest\.json:/);
  assert.match(result.stderr, /locale key only in en: archiveOnly/);
});

archiveTest('CLI validates manifest and locales from the ZIP instead of the repo', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t, {
    manifest: {
      manifest_version: 3,
      version: '1.0.0',
      default_locale: 'en',
      background: { service_worker: 'background.js' }
    },
    en: { archiveOnly: { message: 'Archive' } }
  });

  writeRepositoryMetadata(fixtureRoot, {
    manifest_version: 3,
    version: '1.0.0',
    default_locale: 'en'
  });

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /manifest references missing packaged file: background\.js/
  );
  assert.match(result.stderr, /locale key only in en: archiveOnly/);
});

archiveTest('CLI names a required metadata file missing from the ZIP', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t);

  writeRepositoryMetadata(fixtureRoot, {
    manifest_version: 3,
    version: '1.0.0',
    default_locale: 'en'
  });
  execFileSync(
    'zip',
    ['-d', zipPath, '_locales/zh_CN/messages.json'],
    { stdio: 'ignore' }
  );

  const result = runValidator(zipPath, fixtureRoot);

  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'release package validation failed:\n' +
      '- archive is missing required file: ' +
      '_locales/zh_CN/messages.json\n'
  );
  assert.equal(result.stdout, '');
});

archiveTest('CLI reports clear argument errors', t => {
  const { fixtureRoot, zipPath } = createReleaseFixture(t);
  const cases = [
    { args: [], message: 'missing release ZIP path' },
    { args: [''], message: 'missing release ZIP path' },
    {
      args: [zipPath, '--repo-root'],
      message: 'missing value for --repo-root'
    },
    {
      args: [zipPath, '--repo-root', '--bogus'],
      message: 'missing value for --repo-root'
    },
    {
      args: [zipPath, '--repo-root', ''],
      message: 'missing value for --repo-root'
    },
    {
      args: [zipPath, '--repo-root', fixtureRoot, 'extra'],
      message: 'unexpected argument: extra'
    }
  ];

  for (const fixture of cases) {
    const result = spawnSync(
      process.execPath,
      ['scripts/validate-release.js', ...fixture.args],
      { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
    );

    assert.equal(result.status, 1, fixture.message);
    assert.equal(
      result.stderr,
      `release package validation failed:\n- ${fixture.message}\n`
    );
    assert.equal(result.stdout, '');
  }
});

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

test('archive coverage rejects duplicate and colliding canonical entries', () => {
  assert.deepEqual(
    validateArchiveEntries(
      [
        'manifest.json',
        './manifest.json',
        'background.js',
        'background.js',
        'icons/icon16.png',
        'icons\\icon16.png',
        'scripts/runtime.js',
        'scripts/./runtime.js',
        'scripts//runtime.js'
      ],
      [
        'manifest.json',
        'background.js',
        'icons/icon16.png',
        'scripts/runtime.js'
      ]
    ),
    [
      'duplicate archive entry: background.js',
      'duplicate archive entry: icons/icon16.png',
      'duplicate archive entry: manifest.json',
      'duplicate archive entry: scripts/runtime.js',
      'noncanonical archive entry: ./manifest.json',
      'noncanonical archive entry: icons\\icon16.png',
      'noncanonical archive entry: scripts/./runtime.js',
      'noncanonical archive entry: scripts//runtime.js'
    ]
  );
});

test('archive coverage detects duplicate empty canonical paths', () => {
  assert.deepEqual(
    validateArchiveEntries(
      ['manifest.json', './', './'],
      ['manifest.json']
    ),
    [
      'duplicate archive entry: <empty>',
      'noncanonical archive entry: ./'
    ]
  );
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

test('archive coverage rejects backslashes and leading dot segments', () => {
  assert.deepEqual(
    validateArchiveEntries(
      ['.\\manifest.json', '.\\icons\\icon16.png'],
      ['manifest.json', 'icons/']
    ),
    [
      'manifest.json must be at the archive root',
      'missing packaged path: icons',
      'missing packaged path: manifest.json',
      'noncanonical archive entry: .\\icons\\icon16.png',
      'noncanonical archive entry: .\\manifest.json'
    ]
  );
});

test('archive coverage rejects noncanonical and unsafe directories', () => {
  assert.deepEqual(
    validateArchiveEntries(
      ['./manifest.json', './icons/'],
      ['manifest.json', 'icons/']
    ),
    [
      'manifest.json must be at the archive root',
      'missing packaged path: icons',
      'missing packaged path: manifest.json',
      'noncanonical archive entry: ./icons/',
      'noncanonical archive entry: ./manifest.json'
    ]
  );

  assert.deepEqual(
    validateArchiveEntries(
      ['./manifest.json', './icons/', '../secret/', 'C:\\private\\'],
      ['manifest.json']
    ),
    [
      'manifest.json must be at the archive root',
      'missing packaged path: manifest.json',
      'noncanonical archive entry: ./icons/',
      'noncanonical archive entry: ./manifest.json',
      'noncanonical archive entry: C:\\private\\',
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

test('manifest validation rejects noncanonical default locale entries', () => {
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
    ['manifest default locale directory is missing: _locales/en/']
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
    [
      'manifest references missing packaged file: _favicon/icon.png',
      'manifest references missing packaged file: assets/*.js'
    ]
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
