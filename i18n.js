// i18n loader for Pounce.
// Browser globals: window, document, chrome, fetch.
// Also CommonJS-compatible for node:test on the pure helpers.

(function (root) {
  'use strict';

  const SUPPORTED = ['en', 'zh_CN'];
  const DEFAULT_LANG = 'en';
  const STORAGE_KEY = 'language';

  function decideLanguage(preference, browserLang) {
    if (preference && SUPPORTED.includes(preference)) {
      return preference;
    }
    const lang = (browserLang || '').toLowerCase();
    if (lang.startsWith('zh')) return 'zh_CN';
    return DEFAULT_LANG;
  }

  function formatMessage(message, placeholders, substitutions) {
    if (!placeholders) return message;
    const lookup = {};
    for (const [name, def] of Object.entries(placeholders)) {
      const content = def && def.content;
      if (typeof content !== 'string') continue;
      const match = /^\$(\d+)$/.exec(content);
      if (!match) continue;
      const idx = parseInt(match[1], 10) - 1;
      const sub = substitutions && substitutions[idx];
      if (sub === undefined) continue;
      lookup[name] = String(sub);
    }
    return message.replace(/\$([A-Za-z_][A-Za-z0-9_]*)\$/g, (full, name) => {
      return name in lookup ? lookup[name] : full;
    });
  }

  // ----- Browser-only state below; skipped under node:test -----
  if (typeof window === 'undefined') {
    if (typeof module !== 'undefined') {
      module.exports = { decideLanguage, formatMessage };
    }
    return;
  }

  let dict = {};
  let resolvedLang = DEFAULT_LANG;
  let preference = 'auto';

  async function loadDict(lang) {
    try {
      const url = chrome.runtime.getURL('_locales/' + lang + '/messages.json');
      const res = await fetch(url);
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[i18n] failed to load', lang, e);
      if (lang !== DEFAULT_LANG) return loadDict(DEFAULT_LANG);
      return {};
    }
  }

  function applyToDom(doc) {
    if (!doc || !doc.querySelectorAll) return;
    doc.querySelectorAll('[data-i18n]').forEach(el => {
      if (dict[el.dataset.i18n]) el.textContent = api.t(el.dataset.i18n);
    });
    doc.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      if (dict[el.dataset.i18nPlaceholder]) el.placeholder = api.t(el.dataset.i18nPlaceholder);
    });
    doc.querySelectorAll('[data-i18n-title]').forEach(el => {
      if (dict[el.dataset.i18nTitle]) el.title = api.t(el.dataset.i18nTitle);
    });
    doc.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      if (dict[el.dataset.i18nAriaLabel]) el.setAttribute('aria-label', api.t(el.dataset.i18nAriaLabel));
    });
  }

  async function readPreference() {
    try {
      const r = await chrome.storage.sync.get([STORAGE_KEY]);
      return r[STORAGE_KEY] || 'auto';
    } catch (e) {
      console.warn('[i18n] failed to read language preference', e);
      return 'auto';
    }
  }

  function browserLang() {
    try {
      return chrome.i18n.getUILanguage();
    } catch (e) {
      console.warn('[i18n] failed to get browser language', e);
      return 'en';
    }
  }

  const api = {
    decideLanguage,
    formatMessage,

    async init(doc) {
      preference = await readPreference();
      resolvedLang = decideLanguage(preference, browserLang());
      dict = await loadDict(resolvedLang);
      applyToDom(doc || (typeof document !== 'undefined' ? document : null));
    },

    t(key, substitutions) {
      const entry = dict[key];
      if (!entry) return key;
      return formatMessage(entry.message, entry.placeholders, substitutions);
    },

    async setLanguage(lang, doc) {
      preference = lang;
      try {
        await chrome.storage.sync.set({ [STORAGE_KEY]: lang });
      } catch (e) {
        console.warn('[i18n] failed to persist language preference', e);
      }
      resolvedLang = decideLanguage(preference, browserLang());
      dict = await loadDict(resolvedLang);
      applyToDom(doc || (typeof document !== 'undefined' ? document : null));
    },

    async reload(doc) {
      preference = await readPreference();
      resolvedLang = decideLanguage(preference, browserLang());
      dict = await loadDict(resolvedLang);
      applyToDom(doc || (typeof document !== 'undefined' ? document : null));
    },

    getCurrentLanguage() { return resolvedLang; },
    getPreference() { return preference; },
    applyToDom,
  };

  root.i18n = api;
})(typeof window !== 'undefined' ? window : globalThis);
