# Pounce Package Validation CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, validate, and upload the exact Chrome Web Store ZIP for every pull request targeting `master` and every push to `master`.

**Architecture:** Keep `build.sh` as the sole packaging entry point, move its allowlist into a shared text file, and add a dependency-free CommonJS validator that inspects the completed ZIP with the system `unzip` command. Unit tests cover pure validation rules, integration tests exercise the CLI against real ZIP fixtures, and a separate GitHub Actions workflow publishes a seven-day artifact after validation succeeds.

**Tech Stack:** Bash, Node.js built-ins, `node:test`, `node:assert/strict`, system `zip`/`unzip`, GitHub Actions.

---

## File Map

- Create `scripts/package-files.txt`: single source of truth for packaged paths.
- Create `scripts/validate-release.js`: pure validation helpers plus the ZIP-reading CLI.
- Create `tests/package-validation.test.js`: unit and CLI integration coverage.
- Modify `build.sh`: load the shared allowlist without changing packaging semantics.
- Create `.github/workflows/package.yml`: build, validate, and upload the ZIP.
- Modify `CONTRIBUTING.md`: document local package validation.

### Task 1: Define the archive allowlist contract

**Files:**
- Create: `tests/package-validation.test.js`
- Create: `scripts/validate-release.js`

- [ ] **Step 1: Write failing tests for parsing the package list and validating archive coverage**

Create `tests/package-validation.test.js` with the initial tests below:

```js
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```sh
node --test tests/package-validation.test.js
```

Expected: FAIL with `Cannot find module '../scripts/validate-release.js'`.

- [ ] **Step 3: Implement the minimum allowlist and archive helpers**

Create `scripts/validate-release.js` with CommonJS exports and these behaviors:

```js
const path = require('node:path');

function parsePackageFileList(text) {
  const entries = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  const seen = new Set();
  for (const entry of entries) {
    if (path.posix.isAbsolute(entry) || entry.split('/').includes('..')) {
      throw new Error(`invalid package path: ${entry}`);
    }
    if (seen.has(entry)) throw new Error(`duplicate package path: ${entry}`);
    seen.add(entry);
  }
  return entries;
}

function normalizeArchiveEntry(entry) {
  return entry.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isCovered(entry, packagePath) {
  if (packagePath.endsWith('/')) return entry.startsWith(packagePath);
  return entry === packagePath;
}

function validateArchiveEntries(rawEntries, packagePaths) {
  const entries = rawEntries
    .map(normalizeArchiveEntry)
    .filter(entry => entry && !entry.endsWith('/'));
  const errors = [];

  for (const entry of entries) {
    if (entry.startsWith('/') || entry.split('/').includes('..')) {
      errors.push(`unsafe archive entry: ${entry}`);
    }
  }
  if (!entries.includes('manifest.json')) {
    errors.push('manifest.json must be at the archive root');
  }
  for (const packagePath of packagePaths) {
    if (!entries.some(entry => isCovered(entry, packagePath))) {
      errors.push(`missing packaged path: ${packagePath.replace(/\/$/, '')}`);
    }
  }
  for (const entry of entries) {
    if (!packagePaths.some(packagePath => isCovered(entry, packagePath))) {
      errors.push(`unexpected archive entry: ${entry}`);
    }
  }
  return errors.sort();
}

module.exports = {
  parsePackageFileList,
  validateArchiveEntries
};
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```sh
node --test tests/package-validation.test.js
```

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the archive contract**

```sh
git add scripts/validate-release.js tests/package-validation.test.js
git commit -m "test: define release archive contract"
```

### Task 2: Validate the archived manifest and runtime references

**Files:**
- Modify: `tests/package-validation.test.js`
- Modify: `scripts/validate-release.js`

- [ ] **Step 1: Add failing manifest validation tests**

Extend the test imports with `validateManifest`, then add tests that use a valid manifest containing `background.service_worker`, `action.default_popup`, `options_page`, icons, `_locales/*/messages.json`, `_favicon/*`, and `__MSG_*__` fields. Assert:

```js
test('manifest validation accepts packaged references and browser favicon namespace', () => {
  const manifest = {
    manifest_version: 3,
    version: '1.6.1',
    default_locale: 'en',
    name: '__MSG_ext_name__',
    description: '__MSG_ext_description__',
    background: { service_worker: 'background.js' },
    action: { default_popup: 'popup.html', default_title: '__MSG_action_title__' },
    options_page: 'options.html',
    icons: { 16: 'icons/icon16.png' },
    web_accessible_resources: [{
      matches: ['<all_urls>'],
      resources: ['_locales/*/messages.json', '_favicon/*']
    }]
  };
  const entries = [
    'manifest.json', 'background.js', 'popup.html', 'options.html',
    'icons/icon16.png', '_locales/en/messages.json',
    '_locales/zh_CN/messages.json'
  ];
  const defaultMessages = {
    ext_name: { message: 'Pounce' },
    ext_description: { message: 'Search' },
    action_title: { message: 'Open Pounce' }
  };

  assert.deepEqual(validateManifest(manifest, entries, defaultMessages), []);
});

test('manifest validation reports missing files and unresolved __MSG keys', () => {
  const manifest = {
    manifest_version: 3,
    version: '1.6.1',
    default_locale: 'en',
    name: '__MSG_missing_name__',
    background: { service_worker: 'background.js' }
  };
  assert.deepEqual(
    validateManifest(manifest, ['manifest.json', '_locales/en/messages.json'], {}),
    [
      'manifest message key is missing from default locale: missing_name',
      'manifest references missing packaged file: background.js'
    ]
  );
});
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/package-validation.test.js`.

Expected: FAIL because `validateManifest` is not exported.

- [ ] **Step 3: Implement manifest validation**

Add these complete helpers above `module.exports`:

```js
function isValidChromeVersion(version) {
  if (typeof version !== 'string') return false;
  const parts = version.split('.');
  if (parts.length < 1 || parts.length > 4) return false;
  return parts.every(part => {
    if (!/^(0|[1-9]\d*)$/.test(part)) return false;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 65535;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wildcardMatches(pattern, entries) {
  const source = pattern
    .split('*')
    .map(escapeRegExp)
    .join('.*');
  const regex = new RegExp(`^${source}$`);
  return entries.some(entry => regex.test(entry));
}

function collectManifestMessageKeys(value, keys = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) {
      keys.add(match[1]);
    }
    return keys;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectManifestMessageKeys(item, keys);
    return keys;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectManifestMessageKeys(item, keys);
    }
  }
  return keys;
}

function collectManifestPaths(manifest) {
  const paths = [];
  if (manifest.background && manifest.background.service_worker) {
    paths.push(manifest.background.service_worker);
  }
  if (manifest.action && manifest.action.default_popup) {
    paths.push(manifest.action.default_popup);
  }
  if (manifest.options_page) paths.push(manifest.options_page);
  if (manifest.icons) paths.push(...Object.values(manifest.icons));
  for (const resourceGroup of manifest.web_accessible_resources || []) {
    for (const resource of resourceGroup.resources || []) {
      if (resource === '_favicon/*') continue;
      paths.push(resource);
    }
  }
  return paths;
}

function validateManifest(manifest, archiveEntries, defaultMessages) {
  const errors = [];
  const entries = archiveEntries
    .map(normalizeArchiveEntry)
    .filter(entry => entry && !entry.endsWith('/'));

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['manifest.json must contain a JSON object'];
  }
  if (manifest.manifest_version !== 3) {
    errors.push('manifest_version must be 3');
  }
  if (!isValidChromeVersion(manifest.version)) {
    errors.push(`invalid Chrome extension version: ${String(manifest.version)}`);
  }
  if (typeof manifest.default_locale !== 'string' ||
      !entries.some(entry => entry.startsWith(`_locales/${manifest.default_locale}/`))) {
    errors.push(`default locale is missing from package: ${String(manifest.default_locale)}`);
  }

  for (const reference of collectManifestPaths(manifest)) {
    const present = reference.includes('*')
      ? wildcardMatches(reference, entries)
      : entries.includes(reference);
    if (!present) {
      errors.push(`manifest references missing packaged file: ${reference}`);
    }
  }

  for (const key of collectManifestMessageKeys(manifest)) {
    if (!Object.prototype.hasOwnProperty.call(defaultMessages || {}, key)) {
      errors.push(`manifest message key is missing from default locale: ${key}`);
    }
  }
  return errors.sort();
}
```

Add `validateManifest` to `module.exports`.

- [ ] **Step 4: Verify GREEN and run the full suite**

```sh
node --test tests/package-validation.test.js
node --test tests/*.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit manifest validation**

```sh
git add scripts/validate-release.js tests/package-validation.test.js
git commit -m "test: validate packaged manifest references"
```

### Task 3: Validate archived locales and privacy-policy sources

**Files:**
- Modify: `tests/package-validation.test.js`
- Modify: `scripts/validate-release.js`

- [ ] **Step 1: Add failing locale and privacy tests**

Import `validateLocales` and `validatePrivacyPolicy`, then add tests for:

```js
test('locale validation reports key and exact message-token mismatches', () => {
  const en = {
    notify: {
      message: 'Press $search$',
      placeholders: { search: { content: '$1' } }
    }
  };
  const zh = {
    notify: {
      message: '按 \\$',
      placeholders: { search: { content: '$1' } }
    },
    extra: { message: '额外' }
  };
  const errors = validateLocales({ en, zh_CN: zh });
  assert.ok(errors.includes('locale key only in zh_CN: extra'));
  assert.ok(errors.includes('locale message does not reference declared placeholder zh_CN.notify: $search$'));
});

test('privacy validation requires the canonical URL and excludes docs from ZIP', () => {
  const errors = validatePrivacyPolicy({
    readmeText: 'Privacy: https://example.com/privacy',
    privacyFileExists: false,
    archiveEntries: ['manifest.json', 'docs/privacy.html']
  });
  assert.deepEqual(errors, [
    'canonical privacy policy URL is missing from README.md',
    'docs/privacy.html is missing from the repository',
    'privacy policy source must not be packaged: docs/privacy.html'
  ]);
});
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/package-validation.test.js`.

Expected: FAIL because the locale and privacy functions are missing.

- [ ] **Step 3: Implement locale and privacy validation**

Add these complete functions:

```js
const CANONICAL_PRIVACY_URL = 'https://tuyv.github.io/pounce/privacy.html';

function getPlaceholders(entry) {
  if (!entry || typeof entry !== 'object' || !entry.placeholders) return {};
  return entry.placeholders;
}

function namedMessageTokens(message) {
  const tokens = new Set();
  if (typeof message !== 'string') return tokens;
  for (const match of message.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)\$/g)) {
    tokens.add(match[1]);
  }
  return tokens;
}

function validateLocaleEntry(localeName, key, entry) {
  const errors = [];
  const placeholders = getPlaceholders(entry);
  const tokens = namedMessageTokens(entry && entry.message);

  for (const name of Object.keys(placeholders).sort()) {
    if (!tokens.has(name)) {
      errors.push(
        `locale message does not reference declared placeholder ${localeName}.${key}: $${name}$`
      );
    }
  }
  for (const name of [...tokens].sort()) {
    if (!Object.prototype.hasOwnProperty.call(placeholders, name)) {
      errors.push(
        `locale message references undeclared placeholder ${localeName}.${key}: $${name}$`
      );
    }
  }
  return errors;
}

function validateLocales(locales) {
  const en = locales.en || {};
  const zh = locales.zh_CN || {};
  const errors = [];
  const enKeys = new Set(Object.keys(en));
  const zhKeys = new Set(Object.keys(zh));

  for (const key of [...enKeys].sort()) {
    if (!zhKeys.has(key)) errors.push(`locale key only in en: ${key}`);
  }
  for (const key of [...zhKeys].sort()) {
    if (!enKeys.has(key)) errors.push(`locale key only in zh_CN: ${key}`);
  }

  for (const key of [...enKeys].filter(key => zhKeys.has(key)).sort()) {
    const enPlaceholders = getPlaceholders(en[key]);
    const zhPlaceholders = getPlaceholders(zh[key]);
    const names = new Set([
      ...Object.keys(enPlaceholders),
      ...Object.keys(zhPlaceholders)
    ]);
    for (const name of [...names].sort()) {
      const enHas = Object.prototype.hasOwnProperty.call(enPlaceholders, name);
      const zhHas = Object.prototype.hasOwnProperty.call(zhPlaceholders, name);
      if (!enHas) {
        errors.push(`locale placeholder only in zh_CN ${key}: ${name}`);
      } else if (!zhHas) {
        errors.push(`locale placeholder only in en ${key}: ${name}`);
      } else if (enPlaceholders[name].content !== zhPlaceholders[name].content) {
        errors.push(`locale placeholder content differs ${key}.${name}`);
      }
    }
    errors.push(...validateLocaleEntry('en', key, en[key]));
    errors.push(...validateLocaleEntry('zh_CN', key, zh[key]));
  }
  return errors.sort();
}

function validatePrivacyPolicy({
  readmeText,
  privacyFileExists,
  archiveEntries
}) {
  const errors = [];
  if (!String(readmeText || '').includes(CANONICAL_PRIVACY_URL)) {
    errors.push('canonical privacy policy URL is missing from README.md');
  }
  if (!privacyFileExists) {
    errors.push('docs/privacy.html is missing from the repository');
  }
  if (archiveEntries.map(normalizeArchiveEntry).includes('docs/privacy.html')) {
    errors.push('privacy policy source must not be packaged: docs/privacy.html');
  }
  return errors.sort();
}
```

Add `validateLocales` and `validatePrivacyPolicy` to `module.exports`.

- [ ] **Step 4: Verify GREEN and full-suite compatibility**

```sh
node --test tests/package-validation.test.js
node --test tests/*.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit locale and privacy validation**

```sh
git add scripts/validate-release.js tests/package-validation.test.js
git commit -m "test: validate locale and privacy metadata"
```

### Task 4: Exercise the validator CLI against real ZIP fixtures

**Files:**
- Modify: `tests/package-validation.test.js`
- Modify: `scripts/validate-release.js`

- [ ] **Step 1: Add a failing end-to-end CLI test**

Add these imports at the top of the test file:

```js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
```

Add this complete integration test, which creates a temporary package whose archived manifest references a missing `background.js`:

```js
test('validator CLI exits nonzero for an archived missing runtime reference', t => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pounce-package-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  const packageRoot = path.join(fixtureRoot, 'package');
  fs.mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, '_locales', 'en'), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, '_locales', 'zh_CN'), { recursive: true });

  fs.writeFileSync(
    path.join(fixtureRoot, 'scripts', 'package-files.txt'),
    'manifest.json\n_locales/\n'
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'README.md'),
    'https://tuyv.github.io/pounce/privacy.html\n'
  );
  fs.writeFileSync(path.join(fixtureRoot, 'docs', 'privacy.html'), '<h1>Privacy</h1>');

  fs.writeFileSync(path.join(packageRoot, 'manifest.json'), JSON.stringify({
    manifest_version: 3,
    version: '1.0.0',
    default_locale: 'en',
    name: '__MSG_ext_name__',
    background: { service_worker: 'background.js' }
  }));
  const messages = JSON.stringify({ ext_name: { message: 'Pounce' } });
  fs.writeFileSync(path.join(packageRoot, '_locales', 'en', 'messages.json'), messages);
  fs.writeFileSync(path.join(packageRoot, '_locales', 'zh_CN', 'messages.json'), messages);

  const zipPath = path.join(fixtureRoot, 'invalid.zip');
  execFileSync('zip', [
    '-r', zipPath, 'manifest.json', '_locales'
  ], { cwd: packageRoot, stdio: 'ignore' });

  const validatorPath = path.resolve(__dirname, '..', 'scripts', 'validate-release.js');
const result = spawnSync(
  process.execPath,
  [validatorPath, zipPath, '--repo-root', fixtureRoot],
  { encoding: 'utf8' }
);
assert.notEqual(result.status, 0);
assert.match(result.stderr, /manifest references missing packaged file: background\.js/);
});
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/package-validation.test.js`.

Expected: FAIL because the current module has no CLI archive reader.

- [ ] **Step 3: Implement ZIP reading and the complete CLI**

Add these imports beside the existing `path` import:

```js
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
```

Add the complete ZIP and CLI implementation:

```js
function runUnzip(args) {
  try {
    return execFileSync('unzip', args, { encoding: 'utf8' });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const unavailable = new Error('required tool is unavailable: unzip');
      unavailable.code = 'TOOL_UNAVAILABLE';
      throw unavailable;
    }
    throw error;
  }
}

function readArchiveEntries(zipPath) {
  return runUnzip(['-Z1', zipPath])
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function readArchiveText(zipPath, archivePath) {
  return runUnzip(['-p', zipPath, archivePath]);
}

function parseJsonText(label, text, errors) {
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`invalid JSON in ${label}: ${error.message}`);
    return null;
  }
}

function validateReleasePackage(zipPath, repoRoot = process.cwd()) {
  const errors = [];
  try {
    runUnzip(['-t', zipPath]);
  } catch (error) {
    if (error && error.code === 'TOOL_UNAVAILABLE') throw error;
    return [`archive integrity check failed: ${zipPath}`];
  }

  const archiveEntries = readArchiveEntries(zipPath);
  const packageListPath = path.join(repoRoot, 'scripts', 'package-files.txt');
  const packagePaths = parsePackageFileList(
    fs.readFileSync(packageListPath, 'utf8')
  );
  errors.push(...validateArchiveEntries(archiveEntries, packagePaths));

  let manifestText;
  let enText;
  let zhText;
  try {
    manifestText = readArchiveText(zipPath, 'manifest.json');
    enText = readArchiveText(zipPath, '_locales/en/messages.json');
    zhText = readArchiveText(zipPath, '_locales/zh_CN/messages.json');
  } catch (error) {
    if (error && error.code === 'TOOL_UNAVAILABLE') throw error;
    errors.push('archive is missing manifest.json or required locale files');
    return [...new Set(errors)].sort();
  }

  const manifest = parseJsonText('manifest.json', manifestText, errors);
  const en = parseJsonText('_locales/en/messages.json', enText, errors);
  const zh_CN = parseJsonText('_locales/zh_CN/messages.json', zhText, errors);
  if (manifest && en && zh_CN) {
    const locales = { en, zh_CN };
    errors.push(...validateManifest(
      manifest,
      archiveEntries,
      locales[manifest.default_locale] || {}
    ));
    errors.push(...validateLocales(locales));
  }

  const readmePath = path.join(repoRoot, 'README.md');
  errors.push(...validatePrivacyPolicy({
    readmeText: fs.readFileSync(readmePath, 'utf8'),
    privacyFileExists: fs.existsSync(path.join(repoRoot, 'docs', 'privacy.html')),
    archiveEntries
  }));
  return [...new Set(errors)].sort();
}

function parseCliArgs(argv) {
  let zipPath = null;
  let repoRoot = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--repo-root') {
      index += 1;
      if (!argv[index]) throw new Error('--repo-root requires a path');
      repoRoot = path.resolve(argv[index]);
    } else if (!zipPath) {
      zipPath = path.resolve(argument);
    } else {
      throw new Error(`unexpected argument: ${argument}`);
    }
  }
  if (!zipPath) {
    throw new Error('usage: node scripts/validate-release.js <zip> [--repo-root <path>]');
  }
  return { zipPath, repoRoot };
}

function main(argv) {
  try {
    const { zipPath, repoRoot } = parseCliArgs(argv);
    const errors = validateReleasePackage(zipPath, repoRoot);
    if (errors.length > 0) {
      process.stderr.write(
        `release package validation failed:\n${errors.map(error => `- ${error}`).join('\n')}\n`
      );
      return 1;
    }
    process.stdout.write(`release package validation passed: ${zipPath}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`release package validation failed:\n- ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
```

Add `validateReleasePackage` and `main` to `module.exports`.

- [ ] **Step 4: Verify GREEN**

```sh
node --test tests/package-validation.test.js
node --test tests/*.test.js
```

Expected: CLI integration and all existing tests pass.

- [ ] **Step 5: Commit the CLI**

```sh
git add scripts/validate-release.js tests/package-validation.test.js
git commit -m "feat: validate release zip contents"
```

### Task 5: Share the package allowlist with build.sh

**Files:**
- Create: `scripts/package-files.txt`
- Modify: `build.sh`

- [ ] **Step 1: Create the allowlist with the current package contract**

Write these exact paths, using trailing slashes for directories:

```text
manifest.json
background.js
popup.html
popup.js
options.html
options.js
options-theme-sync.js
theme-manager.js
preferences.js
i18n.js
_locales/
search-overlay.js
search-overlay.css
search-ranking.js
tab-grouping.js
pinyin-index.js
pinyin-matcher.js
vendor/
bridge.html
icons/
```

- [ ] **Step 2: Replace the embedded Bash array with a portable reader**

Use a Bash 3-compatible loop rather than `mapfile`:

```bash
PACKAGE_FILES="scripts/package-files.txt"
FILES=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  FILES+=("$line")
done < "$PACKAGE_FILES"

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "error: $PACKAGE_FILES contains no packaged paths" >&2
  exit 1
fi
```

Leave all later build behavior unchanged.

Update the injected-file guard to treat trailing-slash allowlist entries as directory prefixes:

```python
def covered(path):
    return any(path == item or (item.endswith('/') and path.startswith(item))
               for item in packaged)

missing = [path for path in sorted(injected) if not covered(path)]
```

- [ ] **Step 3: Run syntax, build, tag-safety, and real-package validation checks**

```sh
bash -n build.sh
VERSION="$(node -p "require('./manifest.json').version")"
TAG_BEFORE="$(git rev-parse -q --verify "refs/tags/v${VERSION}" 2>/dev/null || true)"
rm -f "pounce-${VERSION}.zip"
./build.sh "$VERSION"
node scripts/validate-release.js "pounce-${VERSION}.zip"
TAG_AFTER="$(git rev-parse -q --verify "refs/tags/v${VERSION}" 2>/dev/null || true)"
test "$TAG_BEFORE" = "$TAG_AFTER"
```

Expected: build and validation succeed, and no tag changes.

- [ ] **Step 4: Run the complete tests**

```sh
node --test tests/*.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit the shared allowlist**

```sh
git add build.sh scripts/package-files.txt
git commit -m "build: share release package allowlist"
```

### Task 6: Add the package workflow and contributor documentation

**Files:**
- Create: `.github/workflows/package.yml`
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Create the GitHub Actions workflow**

Use this complete workflow:

```yaml
name: Package

on:
  push:
    branches:
      - master
  pull_request:
    branches:
      - master

permissions:
  contents: read

jobs:
  package-validation:
    name: Package validation
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Check out repository
        uses: actions/checkout@v5
      - name: Use Node.js 24
        uses: actions/setup-node@v5
        with:
          node-version: 24
      - name: Build and validate release package
        id: package
        shell: bash
        run: |
          VERSION="$(node -p "require('./manifest.json').version")"
          ARCHIVE="pounce-${VERSION}.zip"
          ./build.sh "$VERSION"
          node scripts/validate-release.js "$ARCHIVE"
          echo "archive=$ARCHIVE" >> "$GITHUB_OUTPUT"
      - name: Upload validated package
        uses: actions/upload-artifact@v4
        with:
          name: pounce-package-${{ github.sha }}
          path: ${{ steps.package.outputs.archive }}
          if-no-files-found: error
          retention-days: 7
```

- [ ] **Step 2: Document local package validation**

Add a concise `Release package validation` section to `CONTRIBUTING.md` containing:

````markdown
## Release package validation

Build and validate the same ZIP used for Chrome Web Store uploads:

```sh
VERSION="$(node -p "require('./manifest.json').version")"
./build.sh "$VERSION"
node scripts/validate-release.js "pounce-${VERSION}.zip"
```

Passing the version explicitly prevents the local validation build from creating a Git tag. Generated ZIP files are ignored by Git.
````

- [ ] **Step 3: Validate workflow syntax and repository formatting**

```sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/package.yml"); puts "workflow yaml: OK"'
bash -n build.sh
git diff --check
```

Expected: all commands exit zero.

- [ ] **Step 4: Run all local verification again**

```sh
node --test tests/*.test.js
VERSION="$(node -p "require('./manifest.json').version")"
rm -f "pounce-${VERSION}.zip"
./build.sh "$VERSION"
node scripts/validate-release.js "pounce-${VERSION}.zip"
```

Expected: tests, build, and validation pass.

- [ ] **Step 5: Commit workflow and docs**

```sh
git add .github/workflows/package.yml CONTRIBUTING.md
git commit -m "ci: validate release packages"
```

### Task 7: Review, publish the branch, and open the Draft PR

**Files:**
- Review all branch changes.

- [ ] **Step 1: Run final verification from a clean generated-artifact state**

```sh
VERSION="$(node -p "require('./manifest.json').version")"
rm -f "pounce-${VERSION}.zip"
node --test tests/*.test.js
bash -n build.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/package.yml")'
./build.sh "$VERSION"
node scripts/validate-release.js "pounce-${VERSION}.zip"
git diff --check origin/master...HEAD
git status --short
```

Expected: all commands pass; status contains no tracked modifications, and the ignored ZIP is the only generated artifact.

- [ ] **Step 2: Perform independent specification and quality reviews**

Specification review must compare the branch against `docs/superpowers/specs/2026-07-15-package-validation-ci-design.md`. Quality review must inspect correctness, error messages, Bash portability, archive path safety, locale token handling, workflow permissions, and test effectiveness. Address all blocking findings and rerun Step 1.

- [ ] **Step 3: Push the feature branch**

```sh
git push -u origin ci/package-validation
```

- [ ] **Step 4: Open a Draft PR**

Create `/tmp/pounce-package-validation-pr.md` with:

```markdown
## Summary

- keep `build.sh` as the release entry point while moving its packaged paths to a shared allowlist
- validate the finished ZIP's archive layout, manifest references, locale keys/placeholders, and privacy-policy source
- add real ZIP CLI regression coverage and upload a seven-day GitHub Actions artifact

## Verification

- `node --test tests/*.test.js`
- `bash -n build.sh`
- workflow YAML parsed locally
- `./build.sh <manifest-version>`
- `node scripts/validate-release.js pounce-<manifest-version>.zip`
- `git diff --check origin/master...HEAD`

## Scope

- no product behavior changes
- no manifest or browser-permission changes
- no automatic tag, release, or Chrome Web Store publication

## Follow-up after merge

After `Package validation` succeeds on `master`, add that exact status context to ruleset `18852815`.
```

Then run:

```sh
gh pr create --repo TuYv/pounce --base master --head ci/package-validation --draft \
  --title "ci: validate Chrome Web Store packages" \
  --body-file /tmp/pounce-package-validation-pr.md
```

- [ ] **Step 5: Verify GitHub checks and artifact**

Wait for `Node.js 22 tests`, `Node.js 24 tests`, `GitGuardian Security Checks`, and `Package validation`. Confirm the package workflow uploads exactly one `pounce-package-<sha>` artifact with seven-day retention. If a fork-approval gate is not involved, no manual workflow approval should be required for the maintainer branch.

- [ ] **Step 6: Stop at the Draft PR handoff**

Report the Draft PR URL, commit list, local test count, workflow results, artifact name, and any non-blocking warnings. Do not mark ready, merge, or update ruleset `18852815` until the user explicitly approves the completed Draft PR.
