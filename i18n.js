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
    let out = message;
    for (const [name, def] of Object.entries(placeholders)) {
      const content = def && def.content;
      if (typeof content !== 'string') continue;
      const match = /^\$(\d+)$/.exec(content);
      if (!match) continue;
      const idx = parseInt(match[1], 10) - 1;
      const sub = substitutions && substitutions[idx];
      if (sub === undefined) continue;
      out = out.split('$' + name + '$').join(String(sub));
    }
    return out;
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
      const v = api.t(el.dataset.i18n);
      if (v) el.textContent = v;
    });
    doc.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const v = api.t(el.dataset.i18nPlaceholder);
      if (v) el.placeholder = v;
    });
    doc.querySelectorAll('[data-i18n-title]').forEach(el => {
      const v = api.t(el.dataset.i18nTitle);
      if (v) el.title = v;
    });
    doc.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const v = api.t(el.dataset.i18nAriaLabel);
      if (v) el.setAttribute('aria-label', v);
    });
  }

  async function readPreference() {
    try {
      const r = await chrome.storage.sync.get([STORAGE_KEY]);
      return r[STORAGE_KEY] || 'auto';
    } catch {
      return 'auto';
    }
  }

  function browserLang() {
    try {
      return chrome.i18n.getUILanguage();
    } catch {
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
      try { await chrome.storage.sync.set({ [STORAGE_KEY]: lang }); } catch {}
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
  if (typeof module !== 'undefined') module.exports = { decideLanguage, formatMessage };
})(typeof window !== 'undefined' ? window : globalThis);
