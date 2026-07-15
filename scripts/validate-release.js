const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CANONICAL_PRIVACY_POLICY_URL =
  'https://tuyv.github.io/pounce/privacy.html';

function normalizePathSeparators(entry) {
  return entry.replace(/\\/g, '/');
}

function isUnsafePath(entry) {
  const normalized = normalizePathSeparators(entry);
  return path.posix.isAbsolute(normalized) ||
    path.win32.isAbsolute(normalized) ||
    normalized.split('/').includes('..');
}

function parsePackageFileList(text) {
  const entries = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  const seen = new Set();
  for (const entry of entries) {
    if (isUnsafePath(entry)) {
      throw new Error(`invalid package path: ${entry}`);
    }
    if (seen.has(entry)) {
      throw new Error(`duplicate package path: ${entry}`);
    }
    seen.add(entry);
  }

  return entries;
}

function normalizeArchiveEntry(entry) {
  return normalizePathSeparators(entry).replace(/^(?:\.\/)+/, '');
}

function isCovered(entry, packagePath) {
  if (packagePath.endsWith('/')) {
    return entry.startsWith(packagePath);
  }
  return entry === packagePath;
}

function canonicalizeArchiveMemberPath(entry) {
  const normalized = normalizePathSeparators(entry);
  const root = normalized.startsWith('//')
    ? '//'
    : normalized.startsWith('/')
      ? '/'
      : '';
  const relativePath = normalized
    .split('/')
    .filter(segment => segment && segment !== '.')
    .join('/');

  return root && relativePath
    ? `${root}${relativePath}`
    : root || relativePath;
}

function describeArchiveEntry(raw) {
  const normalized = normalizePathSeparators(raw);
  const collisionKey = canonicalizeArchiveMemberPath(raw);
  const directory = normalized.endsWith('/');
  const canonicalName = directory && collisionKey &&
    !collisionKey.endsWith('/')
    ? `${collisionKey}/`
    : collisionKey;

  return {
    raw,
    normalized,
    collisionKey,
    directory,
    unsafe: isUnsafePath(normalized),
    canonical: raw.length > 0 && raw === canonicalName
  };
}

function analyzeArchiveEntries(rawEntries, packagePaths) {
  const entries = rawEntries
    .map(describeArchiveEntry);
  const validFileEntries = entries
    .filter(entry => entry.canonical && !entry.unsafe && !entry.directory)
    .map(entry => entry.raw);
  const errors = [];
  const seen = new Set();
  const collidingPaths = new Set();

  for (const entry of entries) {
    if (entry.unsafe) {
      errors.push(`unsafe archive entry: ${entry.normalized || '<empty>'}`);
    }
    if (!entry.canonical) {
      errors.push(`noncanonical archive entry: ${entry.raw || '<empty>'}`);
    }
    if (seen.has(entry.collisionKey)) {
      const displayPath = entry.collisionKey || '<empty>';
      errors.push(`duplicate archive entry: ${displayPath}`);
      collidingPaths.add(entry.collisionKey);
    } else {
      seen.add(entry.collisionKey);
    }
  }

  if (!validFileEntries.includes('manifest.json')) {
    errors.push('manifest.json must be at the archive root');
  }

  for (const packagePath of packagePaths) {
    if (!validFileEntries.some(entry => isCovered(entry, packagePath))) {
      errors.push(`missing packaged path: ${packagePath.replace(/\/$/, '')}`);
    }
  }

  for (const entry of validFileEntries) {
    if (!packagePaths.some(packagePath => isCovered(entry, packagePath))) {
      errors.push(`unexpected archive entry: ${entry}`);
    }
  }

  return {
    collidingPaths,
    errors: [...new Set(errors)].sort()
  };
}

function getCanonicalArchiveFileEntries(rawEntries) {
  return rawEntries
    .map(describeArchiveEntry)
    .filter(entry => entry.canonical && !entry.unsafe && !entry.directory)
    .map(entry => entry.raw);
}

function validateArchiveEntries(rawEntries, packagePaths) {
  return analyzeArchiveEntries(rawEntries, packagePaths).errors;
}

function isNonArrayObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getOwnPropertyValue(value, property) {
  return isNonArrayObject(value) &&
    Object.prototype.hasOwnProperty.call(value, property)
    ? value[property]
    : undefined;
}

function isValidChromeVersion(version) {
  if (typeof version !== 'string') {
    return false;
  }

  const components = version.split('.');
  return components.length >= 1 &&
    components.length <= 4 &&
    components.every(component =>
      /^(?:0|[1-9]\d*)$/.test(component) && Number(component) <= 65535
    );
}

function wildcardMatches(pattern, entry) {
  const patternCharacters = Array.from(pattern);
  const entryCharacters = Array.from(entry);
  let matches = new Array(entryCharacters.length + 1).fill(false);
  matches[0] = true;

  for (const character of patternCharacters) {
    const nextMatches = new Array(entryCharacters.length + 1).fill(false);
    if (character === '*') {
      nextMatches[0] = matches[0];
      for (let index = 1; index <= entryCharacters.length; index += 1) {
        nextMatches[index] = matches[index] || nextMatches[index - 1];
      }
    } else {
      for (let index = 1; index <= entryCharacters.length; index += 1) {
        nextMatches[index] = matches[index - 1] &&
          character === entryCharacters[index - 1];
      }
    }
    matches = nextMatches;
  }

  return matches[entryCharacters.length];
}

function collectMessageKeys(value, keys = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/__MSG_([A-Za-z0-9_@]+)__/g)) {
      keys.add(match[1]);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectMessageKeys(item, keys);
    }
  } else if (isNonArrayObject(value)) {
    for (const item of Object.values(value)) {
      collectMessageKeys(item, keys);
    }
  }

  return keys;
}

function collectManifestFileReferences(manifest) {
  const references = [];
  const addReference = value => {
    if (typeof value === 'string' && value) {
      references.push({
        raw: value,
        normalized: normalizeArchiveEntry(value)
      });
    }
  };

  if (isNonArrayObject(manifest.background)) {
    addReference(manifest.background.service_worker);
  }
  if (isNonArrayObject(manifest.action)) {
    addReference(manifest.action.default_popup);
  }
  addReference(manifest.options_page);

  if (isNonArrayObject(manifest.icons)) {
    for (const icon of Object.values(manifest.icons)) {
      addReference(icon);
    }
  }

  if (Array.isArray(manifest.web_accessible_resources)) {
    for (const resourceGroup of manifest.web_accessible_resources) {
      if (!isNonArrayObject(resourceGroup) || !Array.isArray(resourceGroup.resources)) {
        continue;
      }
      for (const resource of resourceGroup.resources) {
        addReference(resource);
      }
    }
  }

  return references;
}

function validateManifest(manifest, rawArchiveEntries, defaultLocaleMessages) {
  if (!isNonArrayObject(manifest)) {
    return ['manifest must be an object'];
  }

  const archiveEntries = getCanonicalArchiveFileEntries(rawArchiveEntries);
  const errors = new Set();

  if (manifest.manifest_version !== 3) {
    errors.add('manifest_version must be 3');
  }
  if (!isValidChromeVersion(manifest.version)) {
    errors.add('manifest version must be a Chrome dotted numeric version');
  }

  if (typeof manifest.default_locale !== 'string' || !manifest.default_locale) {
    errors.add('manifest default_locale must be a non-empty string');
  } else {
    const localeDirectory = `_locales/${manifest.default_locale}/`;
    if (!archiveEntries.some(entry => entry.startsWith(localeDirectory))) {
      errors.add(`manifest default locale directory is missing: ${localeDirectory}`);
    }
  }

  for (const reference of collectManifestFileReferences(manifest)) {
    if (reference.raw === '_favicon/*') {
      continue;
    }

    const exists = reference.normalized.includes('*')
      ? archiveEntries.some(entry => wildcardMatches(reference.normalized, entry))
      : archiveEntries.includes(reference.normalized);
    if (!exists) {
      errors.add(`manifest references missing packaged file: ${reference.normalized}`);
    }
  }

  const messages = isNonArrayObject(defaultLocaleMessages) ? defaultLocaleMessages : {};
  for (const key of collectMessageKeys(manifest)) {
    if (!Object.prototype.hasOwnProperty.call(messages, key)) {
      errors.add(`manifest message key is missing from default locale: ${key}`);
    }
  }

  return [...errors].sort();
}

function getLocaleMessages(locale) {
  return isNonArrayObject(locale) ? locale : {};
}

function getMessagePlaceholders(message) {
  const placeholders = getOwnPropertyValue(message, 'placeholders');
  return isNonArrayObject(placeholders)
    ? placeholders
    : {};
}

function collectNamedPlaceholderTokens(message) {
  const tokens = new Set();
  const messageText = getOwnPropertyValue(message, 'message');
  if (typeof messageText !== 'string') {
    return tokens;
  }

  for (const match of messageText.matchAll(
    /\$([A-Za-z_][A-Za-z0-9_]*)\$/g
  )) {
    tokens.add(match[1]);
  }
  return tokens;
}

function validateMessagePlaceholderReferences(localeName, key, message, errors) {
  const placeholders = getMessagePlaceholders(message);
  const declaredNames = Object.keys(placeholders);
  const referencedNames = collectNamedPlaceholderTokens(message);

  for (const name of declaredNames) {
    if (!referencedNames.has(name)) {
      errors.push(
        `locale message does not reference declared placeholder ${localeName}.${key}: $${name}$`
      );
    }
  }

  for (const name of referencedNames) {
    if (!Object.prototype.hasOwnProperty.call(placeholders, name)) {
      errors.push(
        `locale message references undeclared placeholder ${localeName}.${key}: $${name}$`
      );
    }
  }
}

function validateLocales(locales) {
  const localeMap = isNonArrayObject(locales) ? locales : {};
  const en = getLocaleMessages(getOwnPropertyValue(localeMap, 'en'));
  const zh_CN = getLocaleMessages(getOwnPropertyValue(localeMap, 'zh_CN'));
  const enKeys = Object.keys(en);
  const zhKeys = Object.keys(zh_CN);
  const enKeySet = new Set(enKeys);
  const zhKeySet = new Set(zhKeys);
  const errors = [];

  for (const key of enKeys) {
    if (!zhKeySet.has(key)) {
      errors.push(`locale key only in en: ${key}`);
    }
  }
  for (const key of zhKeys) {
    if (!enKeySet.has(key)) {
      errors.push(`locale key only in zh_CN: ${key}`);
    }
  }

  for (const key of enKeys) {
    if (!zhKeySet.has(key)) {
      continue;
    }

    const enPlaceholders = getMessagePlaceholders(en[key]);
    const zhPlaceholders = getMessagePlaceholders(zh_CN[key]);
    const enNames = Object.keys(enPlaceholders);
    const zhNames = Object.keys(zhPlaceholders);
    const enNameSet = new Set(enNames);
    const zhNameSet = new Set(zhNames);

    for (const name of enNames) {
      if (!zhNameSet.has(name)) {
        errors.push(`locale placeholder only in en ${key}: ${name}`);
      } else if (getOwnPropertyValue(enPlaceholders[name], 'content') !==
        getOwnPropertyValue(zhPlaceholders[name], 'content')) {
        errors.push(`locale placeholder content differs ${key}.${name}`);
      }
    }
    for (const name of zhNames) {
      if (!enNameSet.has(name)) {
        errors.push(`locale placeholder only in zh_CN ${key}: ${name}`);
      }
    }
  }

  for (const [localeName, messages] of [['en', en], ['zh_CN', zh_CN]]) {
    for (const key of Object.keys(messages)) {
      validateMessagePlaceholderReferences(
        localeName,
        key,
        messages[key],
        errors
      );
    }
  }

  return errors.sort();
}

function canonicalizeSafeArchiveEntry(entry) {
  const normalized = normalizePathSeparators(entry);
  if (isUnsafePath(normalized)) {
    return normalized;
  }

  return normalized
    .split('/')
    .filter(segment => segment && segment !== '.')
    .join('/');
}

function validatePrivacyPolicy(options) {
  const values = isNonArrayObject(options) ? options : {};
  const errors = [];

  if (typeof values.readmeText !== 'string' ||
    !values.readmeText.includes(CANONICAL_PRIVACY_POLICY_URL)) {
    errors.push('canonical privacy policy URL is missing from README.md');
  }
  if (!values.privacyFileExists) {
    errors.push('docs/privacy.html is missing from the repository');
  }

  const archiveEntries = Array.isArray(values.archiveEntries)
    ? values.archiveEntries
    : [];
  if (archiveEntries
    .filter(entry => typeof entry === 'string')
    .map(canonicalizeSafeArchiveEntry)
    .includes('docs/privacy.html')) {
    errors.push(
      'privacy policy source must not be packaged: docs/privacy.html'
    );
  }

  return errors.sort();
}

function runUnzip(args) {
  try {
    return execFileSync('unzip', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const unavailableError = new Error(
        'required tool is unavailable: unzip'
      );
      unavailableError.code = 'TOOL_UNAVAILABLE';
      throw unavailableError;
    }
    throw error;
  }
}

function parseJson(text, label, errors) {
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`invalid JSON in ${label}: ${error.message}`);
    return undefined;
  }
}

function validateReleasePackage(zipPath, repoRoot = process.cwd()) {
  try {
    runUnzip(['-t', zipPath]);
  } catch (error) {
    if (error && error.code === 'TOOL_UNAVAILABLE') {
      throw error;
    }
    return [`archive integrity check failed: ${zipPath}`];
  }

  const archiveEntries = runUnzip(['-Z1', zipPath])
    .split(/\r?\n/)
    .filter(Boolean);
  const packagePaths = parsePackageFileList(fs.readFileSync(
    path.join(repoRoot, 'scripts', 'package-files.txt'),
    'utf8'
  ));
  const archiveAnalysis = analyzeArchiveEntries(
    archiveEntries,
    packagePaths
  );
  const errors = [...archiveAnalysis.errors];
  const requiredArchiveFiles = [
    ['manifest', 'manifest.json'],
    ['en', '_locales/en/messages.json'],
    ['zh_CN', '_locales/zh_CN/messages.json']
  ];
  const archivedFiles = {};
  for (const [key, archivePath] of requiredArchiveFiles) {
    if (archiveAnalysis.collidingPaths.has(archivePath)) {
      continue;
    }
    try {
      archivedFiles[key] = runUnzip(['-p', zipPath, archivePath]);
    } catch (error) {
      if (error && error.code === 'TOOL_UNAVAILABLE') {
        throw error;
      }
      errors.push(`archive is missing required file: ${archivePath}`);
    }
  }

  const manifest = archivedFiles.manifest === undefined
    ? undefined
    : parseJson(
      archivedFiles.manifest,
      'manifest.json',
      errors
    );
  const en = archivedFiles.en === undefined
    ? undefined
    : parseJson(
      archivedFiles.en,
      '_locales/en/messages.json',
      errors
    );
  const zh_CN = archivedFiles.zh_CN === undefined
    ? undefined
    : parseJson(
      archivedFiles.zh_CN,
      '_locales/zh_CN/messages.json',
      errors
    );
  const locales = {};
  if (en !== undefined) {
    locales.en = en;
  }
  if (zh_CN !== undefined) {
    locales.zh_CN = zh_CN;
  }

  if (manifest !== undefined) {
    const defaultLocaleMessages = getOwnPropertyValue(
      locales,
      getOwnPropertyValue(manifest, 'default_locale')
    ) ?? {};
    errors.push(...validateManifest(
      manifest,
      archiveEntries,
      defaultLocaleMessages
    ));
  }
  if (en !== undefined && zh_CN !== undefined) {
    errors.push(...validateLocales(locales));
  }
  errors.push(...validatePrivacyPolicy({
    readmeText: fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8'),
    privacyFileExists: fs.existsSync(
      path.join(repoRoot, 'docs', 'privacy.html')
    ),
    archiveEntries
  }));

  return [...new Set(errors)].sort();
}

function parseCliArgs(argv) {
  let zipPath;
  let repoRoot = process.cwd();
  let hasRepoRoot = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--repo-root') {
      if (hasRepoRoot) {
        throw new Error('unexpected argument: --repo-root');
      }
      if (index + 1 >= argv.length || !argv[index + 1] ||
        argv[index + 1].startsWith('--')) {
        throw new Error('missing value for --repo-root');
      }
      repoRoot = argv[index + 1];
      hasRepoRoot = true;
      index += 1;
    } else if (zipPath === undefined && !argument.startsWith('--')) {
      zipPath = argument;
    } else {
      throw new Error(`unexpected argument: ${argument}`);
    }
  }

  if (zipPath === undefined || zipPath === '') {
    throw new Error('missing release ZIP path');
  }

  return {
    zipPath: path.resolve(zipPath),
    repoRoot: path.resolve(repoRoot)
  };
}

function main(argv) {
  try {
    const { zipPath, repoRoot } = parseCliArgs(argv);
    const errors = validateReleasePackage(zipPath, repoRoot);

    if (errors.length > 0) {
      console.error('release package validation failed:');
      for (const error of errors) {
        console.error(`- ${error}`);
      }
      return 1;
    }

    console.log(`release package validation passed: ${zipPath}`);
    return 0;
  } catch (error) {
    console.error('release package validation failed:');
    console.error(`- ${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  parsePackageFileList,
  validateArchiveEntries,
  validateManifest,
  validateLocales,
  validatePrivacyPolicy,
  validateReleasePackage,
  main
};
