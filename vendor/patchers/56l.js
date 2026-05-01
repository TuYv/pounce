'use strict';

exports = module.exports = function patcher(DICT) {
  // Update EXCEPTIONS dict.
  DICT.EXCEPTIONS = {
    '\u55F2': 'DIA', // DIE 嗲
    '\u78A1': 'ZHOU', // DU 碡
    '\u8052': 'GUO', // GUA 聒
    '\u7094': 'QUE', // GUI 炔
    '\u86B5': 'KE', // HE 蚵
    '\u7809': 'HUA', // HUO 砉
    '\u5B37': 'MO', // MA 嬷 新增
    '\u8E4A': 'XI', // QI 蹊
    '\u4E2C': 'PAN', // QIANG 丬
    '\u9730': 'XIAN', // SAN 霰
    '\u8C49': 'CHI', // SHI 豉
    '\u9967': 'XING', // TANG 饧
    '\u5E27': 'ZHEN', // ZHENG 帧
    '\u828E': 'XIONG', // 芎
    '\u8C01': 'SHUI', // 谁
    '\u94B6': 'KE' // 钶


    // Update UNIHANS dict.
  };DICT.UNIHANS[91] = '\u4F15'; // FU: 夫 --> 伕
  DICT.UNIHANS[347] = '\u4EDA'; // XIAN: 仙 --> 仚
  DICT.UNIHANS[393] = '\u8BCC'; // ZHOU: 州 --> 诌
  DICT.UNIHANS[39] = '\u5A64'; // CHOU: 抽 --> 婤
  DICT.UNIHANS[50] = '\u8160'; // COU: 凑 --> 腠
  DICT.UNIHANS[369] = '\u6538'; // YOU: 优 --> 攸
  DICT.UNIHANS[123] = '\u4E6F'; // HU: 乎 --> 乯
  DICT.UNIHANS[171] = '\u5215'; // LI: 哩 --> 刕
  DICT.UNIHANS[102] = '\u4F5D'; // GOU: 勾 --> 佝
  DICT.UNIHANS[126] = '\u72BF'; // HUAN: 欢 --> 犿
  DICT.UNIHANS[176] = '\u5217'; // LIE: 毟 --> 列
  DICT.UNIHANS[178] = '\u5222'; // LING: 伶 --> 刢
  DICT.UNIHANS[252] = '\u5A1D'; // POU: 剖 --> 娝
  DICT.UNIHANS[330] = '\u5078'; // TOU: 偷 --> 偸
};

exports.shouldPatch = function shouldPatch(toToken) {
  if (typeof toToken !== 'function') return false;
  // Special unihans that get incorrect pinyins.
  if (toToken('\u4F15').target === 'FOU' && toToken('\u4EDA').target === 'XIA' && toToken('\u8BCC').target === 'ZHONG' && toToken('\u5A64').target === 'CHONG' && toToken('\u8160').target === 'CONG' && toToken('\u6538').target === 'YONG' && toToken('\u4E6F').target === 'HOU' && toToken('\u5215').target === 'LENG' && toToken('\u4F5D').target === 'GONG' && toToken('\u72BF').target === 'HUAI' && toToken('\u5217').target === 'LIAO' && toToken('\u5222').target === 'LIN' && toToken('\u94B6').target === 'E') {
    return true;
  }
  return false;
};