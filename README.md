# Visual Page Editor

独立的页面可视化编辑工具。目标是让本地 Next/Vite 项目在开发模式下注入一个页面 overlay：用鼠标选中元素，用自然语言修改样式或文案，导出 `visual-edits.json`，再用 CLI 生成 patch。

当前优先级：

1. Next/Vite 本地开发插件
2. CLI patch
3. 后续再扩展浏览器插件、线上网页、低代码配置后台

## 能力边界

当前版本做两类 patch：

- CSS override patch：根据页面导出的 selector + style 生成 CSS 文件 patch，适合快速落地视觉修改。
- Source text patch：如果元素带 `data-vpe-source="src/app/page.tsx"`，并且修改的是文案，CLI 会尝试在源码里替换原始文案。

当前版本不承诺自动把任意 CSS 精确改回 Tailwind class 或组件 props。那是下一阶段的框架适配能力。

## 修改记录与回退

运行时会把每次自然语言修改保存到 `localStorage` 的 `visual-page-editor-edits-v1`：

- 记录内容包括页面路径、selector、元素标签、自然语言命令、修改后的 style/text，以及修改前的快照。
- 面板会展示当前页面最近 5 条修改记录。
- `撤销` 会回退当前页面的最后一条修改。
- 历史列表里的 `回退` 会从最新记录倒序回退到所选记录之前，适合一次撤掉连续试错。
- `重置` 会清空本地所有修改记录并刷新页面。

## Vite 接入

```js
// vite.config.mjs
import { defineConfig } from 'vite'
import visualPageEditor from './src/plugins/vite.mjs'

export default defineConfig({
  plugins: [visualPageEditor()],
})
```

如果作为 npm 包发布后：

```js
import visualPageEditor from 'visual-page-editor/plugins/vite'
```

## Next 接入

```js
// next.config.mjs
import withVisualPageEditor from './src/plugins/next.mjs'

const nextConfig = {}

export default withVisualPageEditor(nextConfig)
```

如果目标项目使用 `next.config.ts`，先用 CommonJS 入口：

```ts
import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withVisualPageEditor = require("../可视化编辑/src/plugins/next.cjs");

const nextConfig: NextConfig = {};

export default withVisualPageEditor(nextConfig);
```

Next 16 默认使用 Turbopack。当前 Next 插件第一版使用 webpack client entry 注入，因此本地验证时需要：

```bash
next dev --webpack
```

如果作为 npm 包发布后：

```js
import withVisualPageEditor from 'visual-page-editor/plugins/next'
```

## 提高源码 patch 成功率

给可编辑元素加稳定标记：

```jsx
<h1 data-vpe-id="hero-title" data-vpe-source="src/app/page.tsx">
  开始训练
</h1>
```

运行时会优先使用 `data-vpe-id` 生成 selector，并把 `data-vpe-source` 写进 edit record。这样 CLI 可以更可靠地替换源码文案。

## CLI

导出 `visual-edits.json` 后，在项目根目录执行：

```bash
vpe patch --edits visual-edits.json --root . --out visual-editor.patch
```

直接应用：

```bash
vpe apply --edits visual-edits.json --root . --css src/visual-editor-overrides.css
```

检查 edits：

```bash
vpe inspect --edits visual-edits.json
```

## 测试

```bash
npm test
```

测试覆盖已知自然语言失败用例：

- `高度适配网页高度`
- `这一行不是透明的，是磨砂半透明的`
- `删除阴影`
- `磨砂半透明，但不要阴影`
- `底色改为纯白色`
- `背景色改成白色`
- `填充色改成蓝色`

## 下一阶段

- 将 CSS override patch 升级为 Tailwind/React AST patch。
- 浏览器插件：支持任意线上网页注入和导出。
- 远端配置：支持非技术运营保存配置并发布。
