'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var pinyin = require('./index');
var patcher = require('./patchers/safari');

// Patch dict for safari.
if ((typeof navigator === 'undefined' ? 'undefined' : _typeof(navigator)) === 'object' && /safari/i.test(navigator.userAgent) && !/chrome|android/i.test(navigator.userAgent)) {
  pinyin.patchDict(patcher);
}

module.exports = pinyin;