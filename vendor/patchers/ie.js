'use strict';

exports = module.exports = function patcher(DICT) {
  // Update EXCEPTIONS dict.
  DICT.EXCEPTIONS = {
    // '\u55f2': 'DIA', // DIE 嗲
    // '\u78a1': 'ZHOU', // DU 碡
    // '\u8052': 'GUO', // GUA 聒
    // '\u7094': 'QUE', // GUI 炔
    // '\u86b5': 'KE', // HE 蚵
    // '\u7809': 'HUA', // HUO 砉
    // '\u5b37': 'MO', // MA 嬷 新增
    // '\u8e4a': 'XI', // QI 蹊
    // '\u4e2c': 'PAN', // QIANG 丬
    // '\u9730': 'XIAN', // SAN 霰
    // '\u8c49': 'CHI', // SHI 豉
    // '\u9967': 'XING', // TANG 饧
    // '\u5e27': 'ZHEN', // ZHENG 帧
    // '\u828e': 'XIONG', // 芎
    // '\u8c01': 'SHUI', // 谁
    // '\u94b6': 'KE' // 钶
  };
  DICT.FIRST_PINYIN_UNIHAN = '\u9FFF';
  DICT.LAST_PINYIN_UNIHAN = '\u9FC3';

  // Update UNIHANS dict.
  DICT.UNIHANS[339] = '\u5C2A'; // WANG: 尣 --> 尪
  DICT.UNIHANS[112] = '\u8FD8'; // HAI: 咍 --> 还
  DICT.UNIHANS[18] = '\u4ECC'; // BING: 冫 --> 仌
  DICT.UNIHANS[15] = '\u6807'; // BIAO: 灬 --> 标
  DICT.UNIHANS[346] = '\u867E'; // XIA: 虲 --> 虾
  DICT.UNIHANS[30] = '\u62C6'; // CHAI: 芆 --> 拆
  DICT.UNIHANS[21] = '\u6503'; // CA: 嚓 --> 攃
  DICT.UNIHANS[22] = '\u731C'; // CAI: 偲 --> 猜
  DICT.UNIHANS[278] = ''; // RUA: 挼 --> ''
  DICT.UNIHANS[279] = '\u648B'; // RUAN: 堧 --> 撋
  DICT.UNIHANS[280] = '\u7524'; // RUI: 婑 --> 甤
  DICT.UNIHANS[281] = '\u95F0'; // RUN: 瞤 --> 闰
  DICT.UNIHANS[282] = '\u53D2'; // RUO: 捼 --> 叒
  DICT.UNIHANS[27] = '\u5C91'; // CEN: 嵾 --> 岑
  DICT.UNIHANS[64] = '\u4EFE'; // DI: 氐 --> 仾
  DICT.UNIHANS[65] = '\u6541'; // DIAN: 甸 --> 敁
  DICT.UNIHANS[72] = '\u5262'; // DU: 厾 --> 剢
  DICT.UNIHANS[73] = '\u526C'; // DUAN: 耑 --> 剬
  DICT.UNIHANS[109] = '\u886E'; // GUN: 丨 --> 衮
  DICT.UNIHANS[115] = '\u84BF'; // HAO: 茠 --> 蒿
  DICT.UNIHANS[120] = '\u583C'; // HENG: 噷 --> 堼
  DICT.PINYINS[120] = 'HENG';
  DICT.UNIHANS[169] = '\u96F7'; // LEI: 勒 --> 雷
  DICT.UNIHANS[170] = '\u5844'; // LENG: 崚 --> 塄
  DICT.UNIHANS[171] = '\u550E'; // LI: 哩 --> 唎
  DICT.UNIHANS[172] = '\u74C8'; // LIA: 俩 --> 瓈
  DICT.PINYINS[172] = 'LI';
  DICT.UNIHANS[198] = '\u64DD'; // MENG: 甿 --> 擝
};

exports.shouldPatch = function shouldPatch(toToken) {
  if (typeof toToken !== 'function') return false;
  if (
  // In ie, '\u9fff' is the first unihan.
  toToken('\u963F').target === '\u963F' && toToken('\u54CE').target === '\u54CE' && toToken('\u5B89').target === '\u5B89' && toToken('\u80AE').target === '\u80AE') {
    return true;
  }
  return false;
};