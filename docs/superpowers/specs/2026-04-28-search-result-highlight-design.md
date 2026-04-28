# 搜索结果命中字符高亮 — Design

- 状态：设计已确认，待实现
- 日期：2026-04-28
- 关联 issue：[#2](https://github.com/TuYv/pounce/issues/2)
- 范围：仅"高亮"。issue #2 中的"拼音检索"留作下一版评估。

## 目标

用户在 overlay 里输入 query 后，搜索结果的标题和 URL 中**命中 query 的字符**以更显眼的样式呈现，让用户一眼看到"是因为哪几个字符匹配上的"。

## 非目标

- 不引入模糊匹配（fuzzy matching）
- 不引入拼音检索 / 拼音首字母（独立 issue 评估）
- 不改变 `rankResults` 的排序契约或返回项形状（除新增可选字段外，本次实际未新增）
- 不在合成项（`Search for "..."`、`Open ...`）上做高亮
- 不在 source badge / icon 上做高亮

## 决策摘要

| 项 | 决策 |
|----|------|
| 高亮覆盖字段 | `displayTitle` + `displayUrl` |
| 多次出现 | 全部高亮 |
| 合成项 | 不高亮（仅 `tab` / `history` / `topSite` / `bookmark`） |
| 视觉样式 | 加粗 + 主色（`font-weight: 600` + `color: var(--pn-primary)`） |
| 元素 | `<span class="pounce-highlight">`，不用 `<mark>`（避开浏览器默认黄色背景） |
| ranges 计算位置 | **渲染时**独立扫描（matcher 不动） |
| query 来源 | 显式从 `rerankAndRender → renderResults(query)` 链路传入 |
| 大小写 | 大小写不敏感匹配，保留原文大小写显示 |
| 正则元字符 | 用 `indexOf` 不用正则，无需转义 |
| 安全 | 全程 `createElement` + `textContent`，不触碰 `innerHTML` |

## 架构

```
input 事件 → handleSearch(query)
          → rerankAndRender(query)
              ├─ rankResults(items, query)        ← 已有，不动
              └─ renderResults(query)              ← 新增 query 参数
                   └─ 每个 item 调用 createResultElement(item, index, query)
                        ├─ getHighlightRanges(displayTitle, query)   ← 新 export
                        ├─ getHighlightRanges(displayUrl,   query)   ← 新 export
                        └─ renderHighlightedText(el, text, ranges)   ← 新内部 helper
```

`rankResults` 与现有 matcher 完全保持原状，零风险。

## 组件

### 1. `getHighlightRanges(text, query)` — `search-ranking.js` 新 export

**签名**

```
getHighlightRanges(text: string | null | undefined, query: string | null | undefined)
  → Array<[number, number]>   // 半开区间 [start, end)，UTF-16 索引
```

**行为**

- `text` 为非字符串或空字符串 → `[]`
- `query` 为非字符串、`trim()` 后为空 → `[]`
- 内部用 `query.trim()` 后的字符串做匹配（去除首尾空白，与 matcher 一致）；若 trim 后长度大于 `text` → `[]`
- 大小写不敏感匹配（`text.toLowerCase()` vs `trimmedQuery.toLowerCase()`）
- 用 `indexOf` 循环查找，每次命中后 `pos += trimmedQuery.length`（重叠如 `aaaa`/`aa` 命中两段，无死循环风险）
- 返回所有命中 range，顺序排列

**导出**

- 通过 `globalThis.PounceSearchUtils.getHighlightRanges` 暴露给浏览器侧
- 通过 `module.exports.getHighlightRanges` 暴露给 `node:test`

### 2. `renderHighlightedText(textEl, text, ranges)` — `search-overlay.js` 内部 helper

**签名**

```
renderHighlightedText(textEl: HTMLElement, text: string, ranges: Array<[number, number]>) → void
```

**行为**

- 清空 `textEl`
- `ranges` 为空 → `textEl.textContent = text`，等价于今日行为
- 否则按顺序遍历：未命中段 `appendChild(document.createTextNode(...))`，命中段 `appendChild(span)` 其中 `span = document.createElement('span'); span.className = 'pounce-highlight'; span.textContent = ...`
- 全程不使用 `innerHTML`，天然防 XSS

### 3. 渲染处改造 — `search-overlay.js`（约 663–669）

```
const isHighlightable = ['tab','history','topSite','bookmark'].includes(item.type);
const titleText = item.displayTitle || item.title || 'Untitled';
const urlText   = item.displayUrl   || item.url   || '';

if (isHighlightable && query) {
  renderHighlightedText(title, titleText, getHighlightRanges(titleText, query));
  renderHighlightedText(url,   urlText,   getHighlightRanges(urlText,   query));
} else {
  title.textContent = titleText;
  url.textContent   = urlText;
}
```

`query` 由 `renderResults(query)` 链路显式传入；`renderResults` 签名调整：

```
renderResults() → renderResults(query = '')
```

调用点改造（已知三处）：
- `rerankAndRender(query)` 内部调用 `renderResults(query)`
- `loadSearchData()` 路径：query 取 `this.searchInput.value`，传入 `renderResults`
- 其他直接调用 `renderResults()` 的地方（如清空 / 兜底）默认参数 `''`，行为不变

### 4. CSS 新增 — `search-overlay.css`

```css
.pounce-result-title .pounce-highlight,
.pounce-result-url .pounce-highlight {
  font-weight: 600;
  color: var(--pn-primary);
}
```

仅作用于 result-title / result-url 内的 `.pounce-highlight`，不影响其他位置。`<span>` 是 inline 元素，参与同一行高/字号/省略号截断。

## 数据流

1. 用户在 input 输入或修改 query
2. `handleSearch(query)` 触发
3. `rerankAndRender(query)` 计算新的 `currentResults`
4. `renderResults(query)` 把 query 透传给每个 item 渲染
5. 真实结果项（`tab`/`history`/`topSite`/`bookmark`）调用 `getHighlightRanges` → `renderHighlightedText` 拼出带 `<span>` 的 DOM
6. 合成项（`search`/`open`）走原 `textContent` 路径

## 边界情况

| 场景 | 处理 |
|------|------|
| query 为空 / 全空白 | helper 返回 `[]`，渲染走 `textContent` 原路径，外观零变化 |
| `text` 为 null / undefined / 非字符串 | helper 返回 `[]` |
| query 含 HTML 字符 | textContent 写入，无注入风险 |
| query 含正则元字符（`. * + [ ]` 等） | 使用 `indexOf` 不依赖正则，无副作用 |
| query 大小写与 text 不同 | 大小写不敏感匹配，原文大小写保留 |
| 重叠匹配（`aaaa`/`aa`） | `pos += query.length` 步进，命中两段，无死循环 |
| CJK / Unicode | UTF-16 索引在 `indexOf` 下行为一致；`toLowerCase()` 对汉字 no-op |
| 选中态（accent 背景） | mockup 验证主色对比足够 |
| 极长标题触发 ellipsis | `<span>` inline，不打断 ellipsis |
| 快速连续键入 | 每次重渲染清空 `textEl`，无残留 span |
| query 与 results 异步错位 | query 显式跟随 results 一起经 `renderResults` 传入，永不错配 |

**容错原则**：所有 helper 对非法输入返回空数组 / 空字符串，不抛异常，不让搜索框白屏。

## 测试

### 单元测试 — `tests/search-ranking.test.js` 新增

测试 `getHighlightRanges`：

| case | 输入 | 期望 |
|------|------|------|
| 单次命中 | `('GitHub', 'git')` | `[[0,3]]` |
| 多次命中 | `('Google Docs - Google', 'go')` | `[[0,2],[15,17]]` |
| 大小写不敏感 | `('GitHub', 'GIT')` | `[[0,3]]` |
| 含正则元字符 | `('a.b.c', '.')` | `[[1,2],[3,4]]` |
| 重叠匹配 | `('aaaa', 'aa')` | `[[0,2],[2,4]]` |
| 空 query | `('GitHub', '')` | `[]` |
| 空白 query | `('GitHub', '   ')` | `[]` |
| null text | `(null, 'git')` | `[]` |
| query 长于 text | `('git', 'github')` | `[]` |
| 无命中 | `('GitHub', 'foo')` | `[]` |
| CJK | `('支付宝官网', '官网')` | `[[3,5]]` |

### 渲染层

不写单元测试（pounce 无 jsdom 依赖，仅为这一个 helper 引入不划算）。改通过手动验证：

- [ ] 英文 query：标题 + URL 都高亮加粗主色
- [ ] CJK query：能高亮中文字符
- [ ] query 含正则元字符：不报错
- [ ] 选中态：高亮在 accent 背景上清晰
- [ ] 亮 / 暗主题：两种主题都清晰
- [ ] 合成项：query 不被高亮
- [ ] 清空输入：高亮消失
- [ ] 快速键入：无残留 span
- [ ] 极长标题：ellipsis 仍正常

## 实现影响范围

| 文件 | 改动 |
|------|------|
| `search-ranking.js` | + `getHighlightRanges` 函数 + 暴露到 api |
| `search-overlay.js` | + `renderHighlightedText` helper + 渲染处分支 + `renderResults` 加 `query` 参数 + 调用点传 query |
| `search-overlay.css` | + `.pounce-highlight` 选择器 |
| `tests/search-ranking.test.js` | + 11 个 case |

预计代码量：~80 行新增（含测试）。

## 风险

- **极小**。matcher 不动，渲染路径仅在分支命中时多走一段确定性 DOM 操作。
- helper 内部对所有非法输入（null / 非字符串 / 空 / 越界）均做了容错返回，不会抛异常。
- 现有功能（matcher / 排序 / dedupe / 合成项 / fallback）行为零变化。
