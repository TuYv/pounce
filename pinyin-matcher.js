(function() {
  'use strict';

  function hasAsciiLetter(s) {
    return typeof s === 'string' && /[A-Za-z]/.test(s);
  }

  // Compress a sorted (or roughly sorted) list of title indices into [start, end) ranges,
  // merging contiguous indices.
  function compressIndices(indices) {
    if (!indices || indices.length === 0) return [];
    const sorted = [...indices].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = start + 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end) {
        end = sorted[i] + 1;
      } else if (sorted[i] === end - 1) {
        // Duplicate — skip
        continue;
      } else {
        ranges.push([start, end]);
        start = sorted[i];
        end = start + 1;
      }
    }
    ranges.push([start, end]);
    return ranges;
  }

  function normalizeQuery(query) {
    return typeof query === 'string' ? query.toLowerCase() : '';
  }

  function matchFullStartsWith(query, idx) {
    if (!idx || !idx.hasCjk || !idx.full) return null;
    const q = normalizeQuery(query);
    if (!q) return null;
    if (!idx.full.startsWith(q)) return null;
    const titleIdxs = idx.fullToTitle.slice(0, q.length);
    return { ranges: compressIndices(titleIdxs) };
  }

  function matchInitialsStartsWith(query, idx) {
    if (!idx || !idx.hasCjk || !idx.initials) return null;
    const q = normalizeQuery(query);
    if (!q) return null;
    if (!idx.initials.startsWith(q)) return null;
    const titleIdxs = idx.initialsToTitle.slice(0, q.length);
    return { ranges: compressIndices(titleIdxs) };
  }

  function matchFullIncludes(query, idx) {
    if (!idx || !idx.hasCjk || !idx.full) return null;
    const q = normalizeQuery(query);
    if (!q) return null;
    const pos = idx.full.indexOf(q);
    if (pos < 0) return null;
    const titleIdxs = idx.fullToTitle.slice(pos, pos + q.length);
    return { ranges: compressIndices(titleIdxs) };
  }

  function matchInitialsIncludes(query, idx) {
    if (!idx || !idx.hasCjk || !idx.initials) return null;
    const q = normalizeQuery(query);
    if (!q) return null;
    const pos = idx.initials.indexOf(q);
    if (pos < 0) return null;
    const titleIdxs = idx.initialsToTitle.slice(pos, pos + q.length);
    return { ranges: compressIndices(titleIdxs) };
  }

  function charsEqual(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return a.toLowerCase() === b.toLowerCase();
  }

  function isAsciiLetter(ch) {
    return typeof ch === 'string' && ch.length === 1 && /[A-Za-z]/.test(ch);
  }

  // Recursive walker. Tries 3 branches per title char:
  //   (1) literal char equality
  //   (2) CJK + ASCII initial
  //   (3) CJK + ASCII full pinyin substring
  // Returns true if `query` is fully consumed starting from charInfo[t]; pushes matched
  // title indices into `hits` (caller compresses to ranges).
  // `ctx.steps` provides a hard cap to avoid pathological inputs.
  function walk(t, qPos, charInfo, query, hits, ctx) {
    if (qPos >= query.length) return true;
    if (t >= charInfo.length) return false;
    if (++ctx.steps > 50000) return false;

    const info = charInfo[t];
    const qCh = query.charAt(qPos);

    // Branch 1: literal char equality (case-insensitive for ASCII; CJK is byte-equal).
    if (charsEqual(info.char, qCh)) {
      hits.push(info.idx);
      if (walk(t + 1, qPos + 1, charInfo, query, hits, ctx)) return true;
      hits.pop();
    }

    // Branch 2: CJK + ASCII initial.
    if (info.isCjk && info.initial && isAsciiLetter(qCh) && info.initial === qCh.toLowerCase()) {
      hits.push(info.idx);
      if (walk(t + 1, qPos + 1, charInfo, query, hits, ctx)) return true;
      hits.pop();
    }

    // Branch 3: CJK + ASCII full pinyin substring.
    if (info.isCjk && info.full) {
      const pyLen = info.full.length;
      if (qPos + pyLen <= query.length) {
        const slice = query.substr(qPos, pyLen).toLowerCase();
        if (slice === info.full) {
          hits.push(info.idx);
          if (walk(t + 1, qPos + pyLen, charInfo, query, hits, ctx)) return true;
          hits.pop();
        }
      }
    }

    return false;
  }

  function matchMixed(query, idx) {
    if (!idx || !idx.hasCjk) return null;
    const q = typeof query === 'string' ? query : '';
    if (!q) return null;
    const charInfo = idx.charInfo || [];
    if (charInfo.length === 0) return null;

    for (let start = 0; start < charInfo.length; start++) {
      const hits = [];
      const ctx = { steps: 0 };
      if (walk(start, 0, charInfo, q, hits, ctx)) {
        return { ranges: compressIndices(hits) };
      }
    }
    return null;
  }

  const api = {
    matchFullStartsWith,
    matchInitialsStartsWith,
    matchFullIncludes,
    matchInitialsIncludes,
    matchMixed,
    hasAsciiLetter
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.PouncePinyinMatcher = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
