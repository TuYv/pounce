# 多语言支持 — Design

- 状态：设计已确认，待实现
- 日期：2026-05-02
- 范围：把目前硬编码英文的 UI（popup / options / overlay / 系统通知 / manifest 元信息）抽出为可切换的多语种文案，首发 `en` + `zh-CN`，框架支持随时增补语种。

## 目标

1. 浏览器 UI 语种 = 中文 → 默认看到全中文界面（含商店描述）
2. 浏览器 UI 语种 = 其他 → 默认英文兜底
3. 用户可在 options 手动覆盖为 `Auto / English / 中文`，立即生效（不需刷新）
4. i18n 框架可扩展：新增语种只需放一个 `_locales/<lang>/messages.json`，不改代码
5. 新装 / 升级用户零感知，不弹任何"我们支持中文了"提示

## 非目标

- 不做翻译记忆 / key 同步检查脚本（首发 50 条以内手动维护）
- 不做 RTL 语种支持
- 不做日期 / 数字本地化（暂无相关 UI）
- 不做 zh-TW / 其他语种（框架就位后按需增补）
- 不更新 README / Chrome Web Store 截图
- 不本地化用户自己的数据（tab 标题、书签名照原样显示）

## 决策摘要

| 项 | 决策 |
|----|------|
| 文件格式 | Chrome 原生 `_locales/<lang>/messages.json`（含 `placeholders` 字段） |
| default_locale | `en` |
| 首发语种 | `en`、`zh_CN` |
| Loader | 自定义 `i18n.js`（不用 `chrome.i18n.getMessage`，因后者无法运行时覆盖） |
| 存储 | `chrome.storage.sync`，key = `language`，值 ∈ `'auto' \| 'en' \| 'zh_CN'`，默认 `'auto'` |
| Auto 映射 | `chrome.i18n.getUILanguage()` 开头是 `zh` → `zh_CN`，其他 → `en` |
| HTML 绑定 | `data-i18n` / `data-i18n-placeholder` / `data-i18n-title` / `data-i18n-aria-label` 属性 + 启动时一次性 DOM 扫描 |
| JS 绑定 | 动态字符串调 `i18n.t(key, substitutions?)` |
| Fallback | HTML 标签里保留英文原文，loader 失败时不会显示空 |
| manifest 元信息 | 用 `__MSG_xxx__` 占位符（Chrome 强制走浏览器 UI 语种，手动覆盖不影响此处） |
| 通知 | background.js 走自定义 loader，尊重手动设置 |

## 架构

### 文件布局

```
_locales/
  en/messages.json
  zh_CN/messages.json
i18n.js                ← 新增
manifest.json          ← default_locale + __MSG_xxx__ + web_accessible_resources 加 _locales/*
popup.html / popup.js
options.html / options.js
search-overlay.js
bridge.html
background.js
```

### `i18n.js` 接口

```js
window.i18n = {
  init: async () => Promise<void>,
  t: (key: string, substitutions?: string[]) => string,
  setLanguage: async (lang: 'auto' | 'en' | 'zh_CN') => Promise<void>,
  getCurrentLanguage: () => 'en' | 'zh_CN',  // 解析后的实际语种
  getPreference: () => 'auto' | 'en' | 'zh_CN',  // 用户设置原值
};
```

### 语种决策（init 内部）

1. `chrome.storage.sync.get('language')`，缺省 `'auto'`
2. `'auto'` → `chrome.i18n.getUILanguage()`，前缀 `zh` → `zh_CN`，其他 → `en`
3. 手动值（`'en'` / `'zh_CN'`）直接采用
4. `fetch(chrome.runtime.getURL('_locales/' + lang + '/messages.json'))` 加载到内存 dict
5. 加载失败 → 退化到 `en`，再失败则保留 HTML 原文

### DOM 扫描

`init` 末尾对当前 document 跑一次：

```js
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = i18n.t(el.dataset.i18n);
});
document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
  el.placeholder = i18n.t(el.dataset.i18nPlaceholder);
});
document.querySelectorAll('[data-i18n-title]').forEach(el => {
  el.title = i18n.t(el.dataset.i18nTitle);
});
document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
  el.setAttribute('aria-label', i18n.t(el.dataset.i18nAriaLabel));
});
```

`setLanguage` 复用同一段扫描函数，实现切换即时生效。

### 实时切换

- options 切换 → `chrome.storage.sync.set({ language: ... })`
- 各页面（popup / options / overlay / background）已注册的 `chrome.storage.onChanged` 监听 `language` key → 调 `i18n.setLanguage(newValue)` → 重新加载 JSON 并重跑 DOM 扫描
- 模式与现有 theme 实时切换一致

### Manifest 调整

```json
{
  "default_locale": "en",
  "name": "__MSG_ext_name__",
  "description": "__MSG_ext_description__",
  "action": { "default_title": "__MSG_action_title__" },
  "commands": {
    "open-all-urls": { "description": "__MSG_cmd_open_all__" },
    "search-tabs-bookmarks": { "description": "__MSG_cmd_search__" }
  },
  "web_accessible_resources": [
    {
      "matches": [ "<all_urls>" ],
      "resources": [ "search-overlay.css", "_locales/*/messages.json" ]
    }
  ]
}
```

⚠️ `__MSG_xxx__` 字段强制走浏览器 UI 语种，options 里的手动语种**不影响商店描述与 chrome://extensions 列表**。已对齐为可接受。

### Key 命名约定

`<scope>.<concept>`，scope 取自所属页面：

- `popup.openAll`、`popup.batchOpenURLs`、`popup.addUrls`
- `options.appearance`、`options.darkMode`、`options.savedUrlsCount`、`options.language`、`options.languageAuto`
- `overlay.searchPlaceholder`、`overlay.noResults`、`overlay.navigate`、`overlay.quickPick`
- `notify.restrictedPage`、`notify.openAllError`
- manifest 专用扁平命名（Chrome 强制）：`ext_name`、`ext_description`、`action_title`、`cmd_open_all`、`cmd_search`

带变量用 Chrome 原生 `placeholders`：

```json
{
  "options.savedUrlsCount": {
    "message": "$count$ saved URLs",
    "placeholders": { "count": { "content": "$1" } }
  }
}
```

`i18n.t('options.savedUrlsCount', [urls.length])` → `"12 saved URLs"`（中文版同一 key 翻成 `"已保存 $count$ 个 URL"`）。

## 风险与注意点

- `chrome.i18n.getUILanguage()` 在 service worker 中可用（MV3 已确认）
- content script 走 `fetch(chrome.runtime.getURL(...))` 必须把 `_locales/*/messages.json` 加到 `web_accessible_resources`
- `i18n.init()` 是异步，所有页面在 `DOMContentLoaded` 后必须 `await` 完再渲染业务，避免一闪英文一闪中文
- background service worker 每次唤起需 lazy load 一次 JSON（开销可接受，整个 dict < 5KB）

## 实施切片（每个独立 commit）

1. 加 `i18n.js` + `_locales/en/messages.json` 骨架（暂不接入 UI）
2. popup.html / popup.js 全量接入 + manual smoke test
3. options.html / options.js 全量接入 + 加 Language 下拉
4. search-overlay.js / bridge.html 接入
5. background.js 通知接入
6. manifest.json 切到 `__MSG_xxx__` + `web_accessible_resources` 加 `_locales/*`
7. 一次性补齐 `_locales/zh_CN/messages.json` 翻译
8. 版本号 → 1.5.0，更新 CHANGELOG，重新打包

## 验收清单

1. 浏览器 UI = 中文 → reload 扩展 → popup / options / overlay / 系统通知 / chrome://extensions 描述全部中文
2. 浏览器 UI = 英文 → 同上全部英文
3. options 选 `中文` → popup 与已打开 overlay 文案立即变化（不刷新）
4. options 选 `Auto` → 回到跟随浏览器
5. 删除 `_locales/zh_CN/messages.json` → fallback 到英文不崩
6. 拼音匹配、批量打开、主题切换在两种语种下功能正常
7. 无任何首装弹窗 / 引导浮层
