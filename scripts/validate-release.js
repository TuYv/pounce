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

module.exports = {
  parsePackageFileList,
  validateArchiveEntries
};
