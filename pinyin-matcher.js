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

  function matchMixed(_query, _idx) {
    // Implemented in Task 5
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
