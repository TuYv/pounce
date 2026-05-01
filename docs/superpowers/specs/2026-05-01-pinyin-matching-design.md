# 拼音检索 — Design

- 状态：设计已确认，待实现
- 日期：2026-05-01
- 关联 issue：[#2](https://github.com/TuYv/pounce/issues/2)（高亮已在 1.4.6 完成；本 spec 实现"拼音检索"子项）
- 范围：在现有字面匹配通道之外，追加一条拼音匹配通道，让用户用拼音 / 首字母找到含中文字符的 tab / bookmark / history / topSite。

## 目标

支持以下四种输入方式命中含中文字符的 title：

| Mode | 例子 | 命中 |
|------|------|------|
| A 全拼 | `baidusousuo` | 百度搜索 |
| B 首字母 | `bdss` / `bd` | 百度搜索 |
| C 全拼前缀 | `baidu` / `bai` | 百度搜索 |
| D 中英混打 | `百d搜索` / `baidu搜` | 百度搜索 |

命中后，**贡献到匹配的中文字符在结果列表中按现有 `pounce-highlight` 样式高亮**，与字面匹配的视觉一致。

## 非目标

- 不对 URL 字段做拼音匹配（URL 几乎全为 ASCII，CJK URL 通常已 percent-encoded）
- 不做声调匹配（`bāi` vs `bai`）
- 不做模糊匹配 / typo 容忍（`baudi`）
- 不做不连续子序列匹配（`bs` 跳过中间字命中"百度搜索"）
- 不做多音字穷举（"银行"仅取 yinhang，不为 yinxing 单独建索引）
- 不做拼音→中文反查 / IME 候选词
- 不支持空格分隔的拼音 query（`bai du` 第一版不命中"百度"）
- 不改变现有 tier 0–5 的字面匹配语义

## 决策摘要

| 项 | 决策 |
|----|------|
| 拼音库 | 自带 [`tiny-pinyin`](https://github.com/creditkarma/tiny-pinyin) UMD bundle，vendor 进 `vendor/tiny-pinyin.min.js` |
| 多音字 | 取常用读音（库默认） |
| 匹配字段 | 仅 title（`displayTitle`） |
| Gating | (1) 设置开关 (2) title 含 CJK (3) query 含 ASCII 字母 — 三者全满足才进 pinyin 通道 |
| Tier 顺序 | 字面 0–5 严格优先；拼音 6–10 全部排在字面之后 |
| Tier 内部 | 6 全拼 startsWith → 7 首字母 startsWith → 8 全拼 includes → 9 首字母 includes → 10 mixed walker |
| 高亮 | 复用现有 `getHighlightRanges` + `renderHighlightedText` 链路；`getHighlightRanges` 内部在字面匹配为空时尝试拼音 |
| 设置项 | `pinyinMatchingEnabled`，默认 `true`，与 `quickPickEnabled` / `highlightMatchesEnabled` 同风格 |
| 模块拆分 | `pinyin-index.js`（title → 索引）+ `pinyin-matcher.js`（query × 索引 → ranges）两个新模块 |
| 索引缓存 | 模块级 `Map<string, pinyinIndex>`，懒构建、不主动清；session 内最多几千 entries × ~几百字节 ≈ 1MB 上限 |

## 架构

```
input 事件 → handleSearch(query)
          → rerankAndRender(query)
              ├─ rankResults(items, query)
              │     └─ getMatchTier(item, query)         ← 扩展：tier 0–5 不命中时进 pinyin 通道
              │           └─ getPinyinIndex(title)        ← 新模块 pinyin-index.js
              │           └─ matchFull/Initials/Mixed     ← 新模块 pinyin-matcher.js
              └─ renderResults(query)
                   └─ createResultElement(item, index, query)
                        └─ getHighlightRanges(text, query)  ← 扩展：字面 ranges 为空 → 拼音 ranges
                              └─ getPinyinIndex / matcher  ← 同上
```

`rankResults` 与 `renderResults` 的对外形状不变；现有调用点零改动。

## 组件

### 1. `vendor/tiny-pinyin.min.js`（新增）

- 从 tiny-pinyin GitHub releases 下载构建好的 UMD bundle
- 注入后挂载 `globalThis.TinyPinyin`，仅使用 `parse(str)` API
- ~100KB minified，单文件，无 transitive dep

### 2. `pinyin-index.js`（新增）

**API**

```
getPinyinIndex(title: string) → PinyinIndex
```

**`PinyinIndex` 形状**

```js
{
  hasCjk: boolean,
  // mode A/B/C 的 fast path：连续小写字符串
  full:     'baidusousuo',     // 全拼拼接，仅 CJK 段
  initials: 'bdss',            // 首字母拼接
  // 反查 highlight 用：full[i] / initials[i] 来自原 title 的哪个字符
  fullToTitle:     [0,0,0, 1,1, 2,2,2, 3,3,3],
  initialsToTitle: [0, 1, 2, 3],
  // mode D walker 用
  charInfo: [
    { idx: 0, char: '百', full: 'bai', initial: 'b', isCjk: true },
    { idx: 1, char: '度', full: 'du',  initial: 'd', isCjk: true },
    { idx: 2, char: '搜', full: 'sou', initial: 's', isCjk: true },
    { idx: 3, char: '索', full: 'suo', initial: 's', isCjk: true }
  ]
}
```

非 CJK 字符（ASCII / 标点）也进 `charInfo`，标 `isCjk: false, full: '', initial: ''`，仅供 mode D walker 做字面比对。`full` / `initials` / `*ToTitle` 仅记录 CJK 段。

**实现要点**

- 调用 `TinyPinyin.parse(title)`，按 `type === 1`（CJK）分支取 `target` 即拼音
- 多 token 字（极少见）取首个字符的 pinyin，整体 token 当一个字符处理（库行为）
- 库未识别的 CJK 字符 → 标 `isCjk: true, full: '', initial: ''`，不参与 fast path 但 walker 路径仍可走字面相等

**缓存**

- 模块级 `const cache = new Map<string, PinyinIndex>()`
- 命中即返；未命中走 `TinyPinyin.parse` + 构建 → 写入
- 不做 LRU。session 内 title 数有限，重复率高（多 tab 同站点）

**导出**

- `globalThis.PouncePinyinIndex = { getPinyinIndex }`
- `module.exports = { getPinyinIndex }`（`node:test` 用）

### 3. `pinyin-matcher.js`（新增）

**API**

```
matchFullStartsWith(query, idx)     → { ranges } | null   // tier 6
matchInitialsStartsWith(query, idx) → { ranges } | null   // tier 7
matchFullIncludes(query, idx)       → { ranges } | null   // tier 8
matchInitialsIncludes(query, idx)   → { ranges } | null   // tier 9
matchMixed(query, idx)              → { ranges } | null   // tier 10
```

`ranges`：原 title 字符位置的 `Array<[start, end]>`，半开区间，UTF-16 索引。可直接喂给 `renderHighlightedText`。

**fast path（matchFull/Initials × StartsWith/Includes）**

- query 必须 ASCII（含字母）；`String.prototype.toLowerCase()` 后用 `startsWith` / `indexOf` 在 `idx.full` 或 `idx.initials` 上查
- 命中后通过 `fullToTitle` / `initialsToTitle` 反查映射出原 title 的字符 range
- 反查算法：连续命中区间 `[a, b)` → 原 title 的 `[fullToTitle[a], fullToTitle[b-1] + 1)`

**mixed walker（matchMixed，mode D）**

伪代码：

```
walk(t, q, hits):
  q 用尽 → 命中，return hits
  t 用尽 → 不命中，return null
  让 t' = title[t]，q' = query[q]
  分支：
    1. q' 与 t' 字面相等 → walk(t+1, q+1, hits + [t])
    2. t' 是 CJK 且 q' 是 ASCII 字母 且 q' 等于 t' 的 initial → walk(t+1, q+1, hits + [t])
    3. t' 是 CJK 且 query[q..q+L] 等于 t' 的 full pinyin → walk(t+1, q+L, hits + [t])
  任一分支命中即返回；全部不通 → null
```

外层从 `t = 0` 起跑（startsWith 语义）；若失败再从 `t = 1`、`t = 2` … 起跑直至命中或 title 用尽（includes 语义）。

memo key = `(t, q)`，避免指数爆炸。`t` ≤ ~80，`q` ≤ ~30，状态数 ≤ 2400，常数级。

`hits` 是命中的 title 字符 idx 数组，最后压缩成 ranges：连续 idx 合并。

**导出**

- `globalThis.PouncePinyinMatcher = { matchFullStartsWith, matchInitialsStartsWith, matchFullIncludes, matchInitialsIncludes, matchMixed }`
- `module.exports = { ... }`

### 4. `search-ranking.js` 改动

#### 4.1 偏好 gating

读取 `globalThis.PouncePreferences` 中的 `pinyinMatchingEnabled`。content script 注入顺序保证 preferences.js 先于 search-ranking.js。

模块级缓存读到的开关，在 `chrome.storage.onChanged` 回调里更新。具体读取链路与现有 `highlightMatchesEnabled` 一致。

#### 4.2 `getMatchTier(item, query)` 扩展

```
原 tier 0..5 命中即返回。
都不命中时：

if (!pinyinMatchingEnabled) return POSITIVE_INFINITY;
if (!hasAsciiLetter(query)) return POSITIVE_INFINITY;

const idx = getPinyinIndex(item.title || '');
if (!idx.hasCjk) return POSITIVE_INFINITY;

if (matchFullStartsWith(query, idx))     return 6;
if (matchInitialsStartsWith(query, idx)) return 7;
if (matchFullIncludes(query, idx))       return 8;
if (matchInitialsIncludes(query, idx))   return 9;
if (matchMixed(query, idx))              return 10;

return POSITIVE_INFINITY;
```

**SOURCE_PRIORITY 不变**：拼音命中也要在 tier 内按 source priority（tab > history > bookmark > topSite）排序，复用现有 `compareSourceSpecific`。

#### 4.3 `getHighlightRanges(text, query)` 扩展

```
const literal = computeLiteralRanges(text, query);   // 原行为
if (literal.length > 0) return literal;

if (!pinyinMatchingEnabled) return [];
if (!hasAsciiLetter(query)) return [];
const idx = getPinyinIndex(text);
if (!idx.hasCjk) return [];

const m = matchFullStartsWith(query, idx)
       || matchInitialsStartsWith(query, idx)
       || matchFullIncludes(query, idx)
       || matchInitialsIncludes(query, idx)
       || matchMixed(query, idx);
return m ? m.ranges : [];
```

注意：`getHighlightRanges` 当前对 title 和 url 都调用。新增的拼音分支会被 url 路径也走到，但 url 极少含 CJK → `idx.hasCjk` gate 会立即返回 `[]`，无开销。

### 5. `preferences.js` 改动

```js
DEFAULT_SEARCH_PREFERENCES = {
  quickPickEnabled: true,
  highlightMatchesEnabled: true,
  pinyinMatchingEnabled: true   // 新增
}
```

`SEARCH_PREFERENCE_KEYS` 由 `Object.keys` 自动覆盖，无需额外改动。

### 6. `search-overlay.js` 改动

- 构造函数 / `chrome.storage.onChanged` 监听里读取多一个 key（`normalizeSearchPreferences` 已经按 `SEARCH_PREFERENCE_KEYS` 自动覆盖，零改动）
- 不需要改 render 路径 —— `getHighlightRanges` 内部已处理拼音

### 7. `options.html` / `options.js` 改动

在现有 `highlightMatchesEnabled` checkbox 后追加：

```html
<label class="pn-toggle">
  <input type="checkbox" id="pinyin-matching-toggle">
  <span class="pn-toggle-text">
    <strong>Match Chinese titles by pinyin</strong>
    <span class="pn-toggle-hint">Type "bd" or "baidu" to find 百度. Auto-skipped for non-Chinese titles.</span>
  </span>
</label>
```

`options.js`：复用现有的 boolean preference wiring，不新增框架代码。

### 8. `manifest.json` / `background.js` 改动

注入顺序追加 3 个文件：

```json
"content_scripts": [{
  "js": [
    "preferences.js",
    "vendor/tiny-pinyin.min.js",
    "pinyin-index.js",
    "pinyin-matcher.js",
    "search-ranking.js",
    "search-overlay.js"
  ],
  ...
}]
```

`background.js` 中 `chrome.scripting.executeScript` 同步追加 vendor + pinyin-index + pinyin-matcher（`search-ranking.js` 之前）。

## 数据流

1. content script 注入：preferences → tiny-pinyin → pinyin-index → pinyin-matcher → search-ranking → search-overlay
2. 用户敲键 → `handleSearch(query)` → `rerankAndRender(query)` → `rankResults`
3. `rankResults` 对每个 item 调 `getMatchTier`：tier 0–5 命中即返；否则进 pinyin 通道 → tier 6–10 或 POSITIVE_INFINITY
4. 排序、dedup、合成 `Search for ...` / `Open ...` 选项 —— 路径同现有
5. `renderResults(query)` 渲染每条结果 → `getHighlightRanges(text, query)` 返回字面或拼音 ranges → `renderHighlightedText` 拼出 DOM

## 边界情况

| 场景 | 处理 |
|------|------|
| 设置 off | 全部 pinyin gate 返回 false，零开销 |
| query 为空 / 全空白 | 现有 `rankResults` 对空 query 不进 matcher；高亮路径返回 `[]` |
| query 无 ASCII 字母（`百度` / `123`） | gate 失败，仅走字面通道 |
| title 无 CJK | gate 失败，零开销 |
| title 与 query 都同时命中字面与拼音 | 字面 tier 严格更小，胜出；拼音逻辑被短路 |
| 多音字 | 取库默认读音；为常用场景做的取舍 |
| 繁体字 / 罕见 CJK | 库未识别字 → 标 `isCjk: true, full: '', initial: ''`，仅 walker 字面比对路径有效 |
| 极长 title（≥ 200 字符） | walker memo 状态上限 200 × 30 = 6000，可接受 |
| query 含空格 | 第一版不分词，空格在 walker 里走字面比对，多数情况命不中 —— 已在非目标声明 |
| query 含 emoji / 特殊 Unicode | walker 走字面，CJK 段走 pinyin |
| 缓存爆炸 | 实测每个 PinyinIndex ~几百字节，session 内最多几千条 → ~1MB 内 |
| 库初始化失败 | `try { TinyPinyin.parse(...) } catch` 降级为 `hasCjk: false`，相当于 pinyin 通道关闭 |

## 测试

### 单元测试

#### `tests/pinyin-index.test.js`（新增）

| case | 输入 title | 期望 |
|------|------|------|
| 纯中文 | `'百度搜索'` | `hasCjk=true, full='baidusousuo', initials='bdss', charInfo.length=4` |
| 纯英文 | `'GitHub'` | `hasCjk=false`，其他字段为空但合法 |
| 中英混合 | `'GitHub - 百度'` | `hasCjk=true, full='baidu', initials='bd'`，charInfo 含 ASCII 段 |
| 多音字（取首读） | `'银行'` | `full='yinhang'`（不为 yinxing 二建索引） |
| 罕见 CJK 跳过 | 含库未识别字 | 该字 `isCjk=true, full='', initial=''`，不影响其他字 |
| 反查映射 | `'百度'` | `fullToTitle=[0,0,0,1,1], initialsToTitle=[0,1]` |
| 缓存命中 | 同一 title 调两次 | 第二次返回同一对象引用 |

#### `tests/pinyin-matcher.test.js`（新增）

| matcher | query × idx(title) | 期望 |
|---------|------|------|
| FullStartsWith | `'baidu' × 百度搜索` | ranges `[[0,2]]` |
| FullStartsWith 不命中 | `'aidu' × 百度搜索` | `null` |
| InitialsStartsWith | `'bd' × 百度搜索` | ranges `[[0,2]]` |
| InitialsStartsWith 不命中（中部命中） | `'ds' × 百度搜索` | `null` |
| FullIncludes | `'baidu' × 我爱百度` | ranges `[[2,4]]` |
| InitialsIncludes | `'bd' × 我爱百度` | ranges `[[2,4]]` |
| Mixed 中英混打 | `'百d搜索' × 百度搜索` | ranges `[[0,4]]` |
| Mixed 全英前缀 + 部分中文 | `'baidu搜' × 百度搜索` | ranges `[[0,3]]` |
| Mixed 不命中 | `'xy' × 百度搜索` | `null` |
| Mixed 包含非匹配段 | `'我d搜' × 我爱度搜` | 命中（如 `[[0,0],[2,3]]` 等，断言准确 ranges） |

#### `tests/search-ranking-pinyin.test.js`（新增）

端到端断言 `rankResults` 的 tier 分配：

| 场景 | 期望 tier |
|------|------|
| `query='baidu'`, title='百度搜索' | 6 |
| `query='bd'`, title='百度搜索' | 7 |
| `query='baidu'`, title='我爱百度' | 8 |
| `query='bd'`, title='我爱百度' | 9 |
| `query='百d搜索'`, title='百度搜索' | 10 |
| `query='百度'`, title='百度搜索' | 5（字面 includes，不进 pinyin 通道） |
| `query='bd'`, title='BD products' | 4（字面 startsWith） |
| `query='bd'`, title='GitHub' | POSITIVE_INFINITY（filtered out） |
| 设置 off + `query='bd'`, title='百度' | POSITIVE_INFINITY |

#### `tests/search-ranking.test.js` 既有

`getHighlightRanges` 既有 case 全部保留。新增：

| case | 期望 |
|------|------|
| `getHighlightRanges('百度搜索', 'bd')` | `[[0,2]]`（拼音首字母回退） |
| `getHighlightRanges('百度搜索', 'baidu')` | `[[0,2]]`（拼音全拼回退） |
| `getHighlightRanges('百度搜索', '百度')` | `[[0,2]]`（字面命中，不进拼音） |
| 设置 off | 拼音 case 返回 `[]` |

### 手动验证

- [ ] `bd` 命中 `百度`，标题中 `百度` 高亮
- [ ] `baidu` 命中 `百度`
- [ ] `baidu` 命中长 title（如 `百度 - 全球最大中文搜索引擎`），仅 `百度` 两字高亮
- [ ] `百d` 命中 `百度`
- [ ] `bd` 同时存在字面（`BD products`）和拼音（`百度`）项时，字面在前
- [ ] 关闭设置后，`bd` 不再命中 `百度`
- [ ] 关闭设置后，`bd` 仍命中 `BD products`（字面通道不受影响）
- [ ] 1.4.6 已有的字面高亮在拼音 PR 上线后行为完全一致
- [ ] 选中态 / 亮暗主题下，拼音命中字符的高亮可读

## 实现影响范围

| 文件 | 改动 |
|------|------|
| `vendor/tiny-pinyin.min.js` | 新增（vendor） |
| `pinyin-index.js` | 新增 |
| `pinyin-matcher.js` | 新增 |
| `search-ranking.js` | + tier 6–10 / + `getHighlightRanges` 拼音回退 |
| `preferences.js` | + `pinyinMatchingEnabled: true` |
| `options.html` | + 一个 checkbox |
| `options.js` | + 一行偏好 wiring |
| `manifest.json` | + 3 个 content_scripts 文件 |
| `background.js` | + 3 个 executeScript 文件 |
| `tests/pinyin-index.test.js` | 新增 |
| `tests/pinyin-matcher.test.js` | 新增 |
| `tests/search-ranking-pinyin.test.js` | 新增 |
| `tests/search-ranking.test.js` | + 4 个高亮拼音 case |

预计代码量：新模块 ~400 行 + ranking 改动 ~80 行 + UI/preference ~20 行 + 测试 ~250 行。库 vendor 文件不计。

## 风险

- **库依赖体积**：zip 包从 ~55KB 涨到 ~155KB（约 3 倍）；可接受，仍远低于 Chrome 扩展 limit
- **多音字误命中**：`银行` 用户搜 `yinxing` 命不中。已在非目标声明，第一版不处理
- **mixed walker 性能**：理论 O(t × q × 3)，memo 后实测可接受；若发现极端 title 卡顿，加 title 长度上限（200 字符）作为护栏
- **库未识别字符**：tiny-pinyin 对生僻字 / 扩展区返回原字 / 空。`pinyin-index.js` 容错到 `full: '', initial: ''`，不抛异常
- **缓存增长**：上限 ~1MB，无主动清理。如未来 issue 反馈再加 LRU
- **现有功能回归**：tier 0–5 / `rankResults` 形状 / `renderHighlightedText` 接口零变化，回归面控制在 pinyin 通道内
