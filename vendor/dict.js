/**
 * Source: <https://android.googlesource.com/platform/packages/providers/ContactsProvider/+/0c49720fb3d58e346739c2ccd56ed2b739249e07/src/com/android/providers/contacts/HanziToPinyin.java>
 * Updated by creeper
 */
'use strict';

var UNIHANS = ['\u963F', '\u54CE', '\u5B89', '\u80AE', '\u51F9', '\u516B', '\u6300', '\u6273', '\u90A6', '\u52F9', '\u9642', '\u5954', '\u4F3B', '\u5C44', '\u8FB9', '\u706C', '\u618B', '\u6C43', '\u51AB', '\u7676', '\u5CEC', '\u5693', '\u5072', '\u53C2', '\u4ED3', '\u64A1', '\u518A', '\u5D7E', '\u66FD', '\u53C9', '\u8286', '\u8FBF', '\u4F25', '\u6284', '\u8F66', '\u62BB', '\u9637', '\u5403', '\u5145', '\u62BD', '\u51FA', '\u6B3B', '\u63E3', '\u5DDB', '\u5205', '\u5439', '\u65FE', '\u9034', '\u5472', '\u5306', '\u51D1', '\u7C97', '\u6C46', '\u5D14', '\u90A8', '\u6413', '\u5491', '\u5446', '\u4E39', '\u5F53', '\u5200', '\u561A', '\u6265', '\u706F', '\u6C10', '\u7538', '\u5201', '\u7239', '\u4E01', '\u4E1F', '\u4E1C', '\u543A', '\u53BE', '\u8011', '\u5796', '\u5428', '\u591A', '\u59B8', '\u8BF6', '\u5940', '\u97A5', '\u513F', '\u53D1', '\u5E06', '\u531A', '\u98DE', '\u5206', '\u4E30', '\u8985', '\u4ECF', '\u7D11', '\u592B', '\u65EE', '\u4F85', '\u7518', '\u5188', '\u768B', '\u6208', '\u7ED9', '\u6839', '\u522F', '\u5DE5', '\u52FE', '\u4F30', '\u74DC', '\u4E56', '\u5173', '\u5149', '\u5F52', '\u4E28', '\u5459', '\u54C8', '\u548D', '\u4F44', '\u592F', '\u8320', '\u8BC3', '\u9ED2', '\u62EB', '\u4EA8', '\u5677', '\u53FF', '\u9F41', '\u4E4E', '\u82B1', '\u6000', '\u6B22', '\u5DDF', '\u7070', '\u660F', '\u5419', '\u4E0C', '\u52A0', '\u620B', '\u6C5F', '\u827D', '\u9636', '\u5DFE', '\u5755', '\u5182', '\u4E29', '\u51E5', '\u59E2', '\u5658', '\u519B', '\u5494', '\u5F00', '\u520A', '\u5FFC', '\u5C3B', '\u533C', '\u808E', '\u52A5', '\u7A7A', '\u62A0', '\u625D', '\u5938', '\u84AF', '\u5BBD', '\u5321', '\u4E8F', '\u5764', '\u6269', '\u5783', '\u6765', '\u5170', '\u5577', '\u635E', '\u808B', '\u52D2', '\u5D1A', '\u54E9', '\u4FE9', '\u5941', '\u826F', '\u64A9', '\u6BDF', '\u62CE', '\u4F36', '\u6E9C', '\u56D6', '\u9F99', '\u779C', '\u565C', '\u9A74', '\u5A08', '\u63A0', '\u62A1', '\u7F57', '\u5463', '\u5988', '\u57CB', '\u5ADA', '\u7264', '\u732B', '\u4E48', '\u5445', '\u95E8', '\u753F', '\u54AA', '\u5B80', '\u55B5', '\u4E5C', '\u6C11', '\u540D', '\u8C2C', '\u6478', '\u54DE', '\u6BEA', '\u55EF', '\u62CF', '\u8149', '\u56E1', '\u56D4', '\u5B6C', '\u7592', '\u5A1E', '\u6041', '\u80FD', '\u59AE', '\u62C8', '\u5A18', '\u9E1F', '\u634F', '\u56DC', '\u5B81', '\u599E', '\u519C', '\u7FBA', '\u5974', '\u5973', '\u597B', '\u759F', '\u9EC1', '\u632A', '\u5594', '\u8BB4', '\u5991', '\u62CD', '\u7705', '\u4E53', '\u629B', '\u5478', '\u55B7', '\u5309', '\u4E15', '\u56E8', '\u527D', '\u6C15', '\u59D8', '\u4E52', '\u948B', '\u5256', '\u4EC6', '\u4E03', '\u6390', '\u5343', '\u545B', '\u6084', '\u767F', '\u4EB2', '\u9751', '\u536D', '\u4E18', '\u533A', '\u5CD1', '\u7F3A', '\u590B', '\u5465', '\u7A63', '\u5A06', '\u60F9', '\u4EBA', '\u6254', '\u65E5', '\u8338', '\u53B9', '\u909A', '\u633C', '\u5827', '\u5A51', '\u77A4', '\u637C', '\u4EE8', '\u6BE2', '\u4E09', '\u6852', '\u63BB', '\u95AA', '\u68EE', '\u50E7', '\u6740', '\u7B5B', '\u5C71', '\u4F24', '\u5F30', '\u5962', '\u7533', '\u5347', '\u5C38', '\u53CE', '\u4E66', '\u5237', '\u8870', '\u95E9', '\u53CC', '\u813D', '\u542E', '\u8BF4', '\u53B6', '\u5FEA', '\u635C', '\u82CF', '\u72FB', '\u590A', '\u5B59', '\u5506', '\u4ED6', '\u56FC', '\u574D', '\u6C64', '\u5932', '\u5FD1', '\u71A5', '\u5254', '\u5929', '\u65EB', '\u5E16', '\u5385', '\u56F2', '\u5077', '\u51F8', '\u6E4D', '\u63A8', '\u541E', '\u4E47', '\u7A75', '\u6B6A', '\u5F2F', '\u5C23', '\u5371', '\u6637', '\u7FC1', '\u631D', '\u4E4C', '\u5915', '\u8672', '\u4ED9', '\u4E61', '\u7071', '\u4E9B', '\u5FC3', '\u661F', '\u51F6', '\u4F11', '\u5401', '\u5405', '\u524A', '\u5743', '\u4E2B', '\u6079', '\u592E', '\u5E7A', '\u503B', '\u4E00', '\u56D9', '\u5E94', '\u54DF', '\u4F63', '\u4F18', '\u625C', '\u56E6', '\u66F0', '\u6655', '\u5E00', '\u707D', '\u5142', '\u5328', '\u50AE', '\u5219', '\u8D3C', '\u600E', '\u5897', '\u624E', '\u635A', '\u6CBE', '\u5F20', '\u4F4B', '\u8707', '\u8D1E', '\u4E89', '\u4E4B', '\u4E2D', '\u5DDE', '\u6731', '\u6293', '\u62FD', '\u4E13', '\u5986', '\u96B9', '\u5B92', '\u5353', '\u4E72', '\u5B97', '\u90B9', '\u79DF', '\u94BB', '\u539C', '\u5C0A', '\u6628', '\u5159'];

// convert ascii array to Pinyin
var PINYINS = ['A', 'AI', 'AN', 'ANG', 'AO', 'BA', 'BAI', 'BAN', 'BANG', 'BAO', 'BEI', 'BEN', 'BENG', 'BI', 'BIAN', 'BIAO', 'BIE', 'BIN', 'BING', 'BO', 'BU', 'CA', 'CAI', 'CAN', 'CANG', 'CAO', 'CE', 'CEN', 'CENG', 'CHA', 'CHAI', 'CHAN', 'CHANG', 'CHAO', 'CHE', 'CHEN', 'CHENG', 'CHI', 'CHONG', 'CHOU', 'CHU', 'CHUA', 'CHUAI', 'CHUAN', 'CHUANG', 'CHUI', 'CHUN', 'CHUO', 'CI', 'CONG', 'COU', 'CU', 'CUAN', 'CUI', 'CUN', 'CUO', 'DA', 'DAI', 'DAN', 'DANG', 'DAO', 'DE', 'DEN', 'DENG', 'DI', 'DIAN', 'DIAO', 'DIE', 'DING', 'DIU', 'DONG', 'DOU', 'DU', 'DUAN', 'DUI', 'DUN', 'DUO', 'E', 'EI', 'EN', 'ENG', 'ER', 'FA', 'FAN', 'FANG', 'FEI', 'FEN', 'FENG', 'FIAO', 'FO', 'FOU', 'FU', 'GA', 'GAI', 'GAN', 'GANG', 'GAO', 'GE', 'GEI', 'GEN', 'GENG', 'GONG', 'GOU', 'GU', 'GUA', 'GUAI', 'GUAN', 'GUANG', 'GUI', 'GUN', 'GUO', 'HA', 'HAI', 'HAN', 'HANG', 'HAO', 'HE', 'HEI', 'HEN', 'HENG', 'HM', 'HONG', 'HOU', 'HU', 'HUA', 'HUAI', 'HUAN', 'HUANG', 'HUI', 'HUN', 'HUO', 'JI', 'JIA', 'JIAN', 'JIANG', 'JIAO', 'JIE', 'JIN', 'JING', 'JIONG', 'JIU', 'JU', 'JUAN', 'JUE', 'JUN', 'KA', 'KAI', 'KAN', 'KANG', 'KAO', 'KE', 'KEN', 'KENG', 'KONG', 'KOU', 'KU', 'KUA', 'KUAI', 'KUAN', 'KUANG', 'KUI', 'KUN', 'KUO', 'LA', 'LAI', 'LAN', 'LANG', 'LAO', 'LE', 'LEI', 'LENG', 'LI', 'LIA', 'LIAN', 'LIANG', 'LIAO', 'LIE', 'LIN', 'LING', 'LIU', 'LO', 'LONG', 'LOU', 'LU', 'LV', 'LUAN', 'LVE', 'LUN', 'LUO', 'M', 'MA', 'MAI', 'MAN', 'MANG', 'MAO', 'ME', 'MEI', 'MEN', 'MENG', 'MI', 'MIAN', 'MIAO', 'MIE', 'MIN', 'MING', 'MIU', 'MO', 'MOU', 'MU', 'N', 'NA', 'NAI', 'NAN', 'NANG', 'NAO', 'NE', 'NEI', 'NEN', 'NENG', 'NI', 'NIAN', 'NIANG', 'NIAO', 'NIE', 'NIN', 'NING', 'NIU', 'NONG', 'NOU', 'NU', 'NV', 'NUAN', 'NVE', 'NUN', 'NUO', 'O', 'OU', 'PA', 'PAI', 'PAN', 'PANG', 'PAO', 'PEI', 'PEN', 'PENG', 'PI', 'PIAN', 'PIAO', 'PIE', 'PIN', 'PING', 'PO', 'POU', 'PU', 'QI', 'QIA', 'QIAN', 'QIANG', 'QIAO', 'QIE', 'QIN', 'QING', 'QIONG', 'QIU', 'QU', 'QUAN', 'QUE', 'QUN', 'RAN', 'RANG', 'RAO', 'RE', 'REN', 'RENG', 'RI', 'RONG', 'ROU', 'RU', 'RUA', 'RUAN', 'RUI', 'RUN', 'RUO', 'SA', 'SAI', 'SAN', 'SANG', 'SAO', 'SE', 'SEN', 'SENG', 'SHA', 'SHAI', 'SHAN', 'SHANG', 'SHAO', 'SHE', 'SHEN', 'SHENG', 'SHI', 'SHOU', 'SHU', 'SHUA', 'SHUAI', 'SHUAN', 'SHUANG', 'SHUI', 'SHUN', 'SHUO', 'SI', 'SONG', 'SOU', 'SU', 'SUAN', 'SUI', 'SUN', 'SUO', 'TA', 'TAI', 'TAN', 'TANG', 'TAO', 'TE', 'TENG', 'TI', 'TIAN', 'TIAO', 'TIE', 'TING', 'TONG', 'TOU', 'TU', 'TUAN', 'TUI', 'TUN', 'TUO', 'WA', 'WAI', 'WAN', 'WANG', 'WEI', 'WEN', 'WENG', 'WO', 'WU', 'XI', 'XIA', 'XIAN', 'XIANG', 'XIAO', 'XIE', 'XIN', 'XING', 'XIONG', 'XIU', 'XU', 'XUAN', 'XUE', 'XUN', 'YA', 'YAN', 'YANG', 'YAO', 'YE', 'YI', 'YIN', 'YING', 'YO', 'YONG', 'YOU', 'YU', 'YUAN', 'YUE', 'YUN', 'ZA', 'ZAI', 'ZAN', 'ZANG', 'ZAO', 'ZE', 'ZEI', 'ZEN', 'ZENG', 'ZHA', 'ZHAI', 'ZHAN', 'ZHANG', 'ZHAO', 'ZHE', 'ZHEN', 'ZHENG', 'ZHI', 'ZHONG', 'ZHOU', 'ZHU', 'ZHUA', 'ZHUAI', 'ZHUAN', 'ZHUANG', 'ZHUI', 'ZHUN', 'ZHUO', 'ZI', 'ZONG', 'ZOU', 'ZU', 'ZUAN', 'ZUI', 'ZUN', 'ZUO', ''];

// Separate from UNIHANS & PINYINS.
// So PINYINS are completely of alphabetical order, and no duplicate pinyin.
var EXCEPTIONS = {
  '\u66FE': 'ZENG', // CENG 曾
  '\u6C88': 'SHEN', // CHEN 沈
  '\u55F2': 'DIA', // DIE 嗲
  '\u78A1': 'ZHOU', // DU 碡
  '\u8052': 'GUO', // GUA 聒
  '\u7094': 'QUE', // GUI 炔
  '\u86B5': 'KE', // HE 蚵
  '\u7809': 'HUA', // HUO 砉
  '\u5B24': 'MO', // MA 嬤
  '\u5B37': 'MO', // MA 嬷
  '\u8E52': 'PAN', // MAN 蹒
  '\u8E4A': 'XI', // QI 蹊
  '\u4E2C': 'PAN', // QIANG 丬
  '\u9730': 'XIAN', // SAN 霰
  '\u8398': 'XIN', // SHEN 莘
  '\u8C49': 'CHI', // SHI 豉
  '\u9967': 'XING', // TANG 饧
  '\u7B60': 'JUN', // YUN 筠
  '\u957F': 'CHANG', // ZHANG 长
  '\u5E27': 'ZHEN', // ZHENG 帧
  '\u5CD9': 'SHI', // ZHI 峙
  '\u90CD': 'NA',
  '\u828E': 'XIONG',
  '\u8C01': 'SHUI'
};

module.exports = {
  PINYINS: PINYINS,
  UNIHANS: UNIHANS,
  EXCEPTIONS: EXCEPTIONS
};