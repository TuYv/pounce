const path = require('node:path');

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

module.exports = {
  parsePackageFileList,
  validateArchiveEntries,
  validateManifest
};
