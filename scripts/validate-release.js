const path = require('node:path');

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

function validateArchiveEntries(rawEntries, packagePaths) {
  const entries = rawEntries
    .map(normalizeArchiveEntry)
    .filter(Boolean);
  const fileEntries = entries.filter(entry => !entry.endsWith('/'));
  const errors = [];

  for (const entry of entries) {
    if (isUnsafePath(entry)) {
      errors.push(`unsafe archive entry: ${entry}`);
    }
  }

  if (!fileEntries.includes('manifest.json')) {
    errors.push('manifest.json must be at the archive root');
  }

  for (const packagePath of packagePaths) {
    if (!fileEntries.some(entry => isCovered(entry, packagePath))) {
      errors.push(`missing packaged path: ${packagePath.replace(/\/$/, '')}`);
    }
  }

  for (const entry of fileEntries) {
    if (!packagePaths.some(packagePath => isCovered(entry, packagePath))) {
      errors.push(`unexpected archive entry: ${entry}`);
    }
  }

  return errors.sort();
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

  const archiveEntries = rawArchiveEntries
    .map(normalizeArchiveEntry)
    .filter(entry => entry && !entry.endsWith('/'));
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
  const normalized = normalizeArchiveEntry(entry);
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

module.exports = {
  parsePackageFileList,
  validateArchiveEntries,
  validateManifest,
  validateLocales,
  validatePrivacyPolicy
};
