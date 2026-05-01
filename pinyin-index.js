(function() {
  'use strict';

  const CJK_REGEX = /[㐀-䶿一-鿿豈-﫿]/;
  const cache = new Map();

  function hasCjkText(text) {
    return typeof text === 'string' && CJK_REGEX.test(text);
  }

  function getTinyPinyin() {
    if (typeof globalThis !== 'undefined' && globalThis.TinyPinyin && typeof globalThis.TinyPinyin.parse === 'function') {
      return globalThis.TinyPinyin;
    }
    return null;
  }

  function emptyIndex() {
    return {
      hasCjk: false,
      full: '',
      initials: '',
      fullToTitle: [],
      initialsToTitle: [],
      charInfo: []
    };
  }

  function buildIndex(title) {
    if (typeof title !== 'string' || title.length === 0) {
      return emptyIndex();
    }

    const TinyPinyin = getTinyPinyin();
    if (!TinyPinyin) {
      // No library available — degrade to charInfo with no pinyin so walker still has literal path.
      const charInfo = [];
      for (let i = 0; i < title.length; i++) {
        charInfo.push({ idx: i, char: title.charAt(i), full: '', initial: '', isCjk: false });
      }
      return { hasCjk: false, full: '', initials: '', fullToTitle: [], initialsToTitle: [], charInfo };
    }

    let tokens;
    try {
      tokens = TinyPinyin.parse(title);
    } catch (err) {
      return emptyIndex();
    }
    if (!Array.isArray(tokens)) return emptyIndex();

    let full = '';
    let initials = '';
    const fullToTitle = [];
    const initialsToTitle = [];
    const charInfo = [];
    let titleIdx = 0;
    let hasCjk = false;

    for (const token of tokens) {
      const source = String(token && token.source != null ? token.source : '');
      const type = token && token.type;
      const targetUpper = String(token && token.target != null ? token.target : '');

      if (type === 2 && source.length === 1 && targetUpper.length > 0) {
        // Single-char CJK token with pinyin (tiny-pinyin uses type=2 for matched CJK)
        const pinyin = targetUpper.toLowerCase();
        const initial = pinyin.charAt(0);
        for (let k = 0; k < pinyin.length; k++) {
          full += pinyin.charAt(k);
          fullToTitle.push(titleIdx);
        }
        initials += initial;
        initialsToTitle.push(titleIdx);
        charInfo.push({ idx: titleIdx, char: source, full: pinyin, initial, isCjk: true });
        hasCjk = true;
        titleIdx += 1;
      } else {
        // ASCII / digits / unknown CJK / multi-char tokens — split per source char, no pinyin
        for (let i = 0; i < source.length; i++) {
          const ch = source.charAt(i);
          const isCjkChar = CJK_REGEX.test(ch);
          if (isCjkChar) hasCjk = true;
          charInfo.push({ idx: titleIdx, char: ch, full: '', initial: '', isCjk: isCjkChar });
          titleIdx += 1;
        }
      }
    }

    return { hasCjk, full, initials, fullToTitle, initialsToTitle, charInfo };
  }

  function getPinyinIndex(title) {
    const key = String(title || '');
    if (cache.has(key)) return cache.get(key);
    const idx = buildIndex(key);
    cache.set(key, idx);
    return idx;
  }

  function clearCache() {
    cache.clear();
  }

  const api = { getPinyinIndex, clearCache, hasCjkText };

  if (typeof globalThis !== 'undefined') {
    globalThis.PouncePinyinIndex = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
