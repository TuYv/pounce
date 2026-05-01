'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var DICT = require('./dict');

var FIRST_PINYIN_UNIHAN = '\u963F';
var LAST_PINYIN_UNIHAN = '\u9FFF';

var LATIN = 1;
var PINYIN = 2;
var UNKNOWN = 3;

var supported = null;
var COLLATOR = void 0;

function patchDict(patchers) {
  if (!patchers) return;
  if (typeof patchers === 'function') {
    patchers = [patchers];
  }
  if (patchers.forEach) {
    patchers.forEach(function (p) {
      typeof p === 'function' && p(DICT);
    });
  }
}

function isSupported(force) {
  if (!force && supported !== null) {
    return supported;
  }
  if ((typeof Intl === 'undefined' ? 'undefined' : _typeof(Intl)) === 'object' && Intl.Collator) {
    COLLATOR = new Intl.Collator(['zh-Hans-CN', 'zh-CN']);
    supported = Intl.Collator.supportedLocalesOf(['zh-CN']).length === 1;
  } else {
    supported = false;
  }
  return supported;
}

function genToken(ch) {
  // Access DICT here, give the chance to patch DICT.
  var UNIHANS = DICT.UNIHANS;
  var PINYINS = DICT.PINYINS;
  var EXCEPTIONS = DICT.EXCEPTIONS;
  var token = {
    source: ch

    // First check EXCEPTIONS map, then search with UNIHANS table.
  };if (ch in EXCEPTIONS) {
    token.type = PINYIN;
    token.target = EXCEPTIONS[ch];
    return token;
  }

  var offset = -1;
  var cmp = void 0;
  if (ch.charCodeAt(0) < 256) {
    token.type = LATIN;
    token.target = ch;
    return token;
  } else {
    cmp = COLLATOR.compare(ch, FIRST_PINYIN_UNIHAN);
    if (cmp < 0) {
      token.type = UNKNOWN;
      token.target = ch;
      return token;
    } else if (cmp === 0) {
      token.type = PINYIN;
      offset = 0;
    } else {
      cmp = COLLATOR.compare(ch, LAST_PINYIN_UNIHAN);
      if (cmp > 0) {
        token.type = UNKNOWN;
        token.target = ch;
        return token;
      } else if (cmp === 0) {
        token.type = PINYIN;
        offset = UNIHANS.length - 1;
      }
    }
  }

  token.type = PINYIN;
  if (offset < 0) {
    var begin = 0;
    var end = UNIHANS.length - 1;
    while (begin <= end) {
      offset = ~~((begin + end) / 2);
      var unihan = UNIHANS[offset];
      cmp = COLLATOR.compare(ch, unihan);

      // Catch it.
      if (cmp === 0) {
        break;
      }
      // Search after offset.
      else if (cmp > 0) {
          begin = offset + 1;
        }
        // Search before the offset.
        else {
            end = offset - 1;
          }
    }
  }

  if (cmp < 0) {
    offset--;
  }

  token.target = PINYINS[offset];
  if (!token.target) {
    token.type = UNKNOWN;
    token.target = token.source;
  }
  return token;
}

function parse(str) {
  if (typeof str !== 'string') {
    throw new Error('argument should be string.');
  }
  if (!isSupported()) {
    throw new Error('not support Intl or zh-CN language.');
  }
  return str.split('').map(function (v) {
    return genToken(v);
  });
}

module.exports = {
  isSupported: isSupported,
  parse: parse,
  patchDict: patchDict,
  genToken: genToken, // inner usage
  convertToPinyin: function convertToPinyin(str, separator, lowerCase) {
    return parse(str).map(function (v) {
      if (lowerCase && v.type === PINYIN) {
        return v.target.toLowerCase();
      }
      return v.target;
    }).join(separator || '');
  }
};