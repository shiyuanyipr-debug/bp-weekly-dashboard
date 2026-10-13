# BP Weekly Lens

一个面向财务 BP 周会的单用户经营分析 PWA。用户上传 `.xlsx` 周报后，系统在浏览器内完成语义字段识别、指标计算、生命周期判断和页面生成。

## 已实现

- 兼容固定模板和列名、Sheet 名、表头行不同的周报。
- 全盘概览、业务线分析、单项目详情和可编辑的分析口径。
- 成熟期、启动/成长期、研发期状态判断及重点关注规则。
- 规则参数、生命周期基准和按月维护的项目实收率；默认内置 22 个模拟项目实收率。
- 人工填写 OpenAI 兼容中转站、模型和 Key，生成全盘、业务线和项目分析。
- BP 补充按项目和周次保存到 IndexedDB，并在各页面同步。
- 当前业务线导出 Excel，全盘和项目页打印为 PDF。
- 离线缓存和可安装 PWA manifest。

## 数据和密钥

Excel 在当前浏览器内解析，不上传到服务端。AI Base URL、Model 和 API Key 保存在 `sessionStorage`，请求由 `/api/analyze` 临时代理，不记录 Key、请求体或响应。中转站地址必须是 HTTPS 公网地址。

## 本地运行

```bash
pnpm install
pnpm dev
```

```bash
pnpm build
pnpm start
```

## 技术栈

Next.js 16、React 19、TypeScript、Tailwind CSS、ExcelJS、TanStack Table、Apache ECharts、Dexie/IndexedDB、Zod 和 Vercel AI SDK。
