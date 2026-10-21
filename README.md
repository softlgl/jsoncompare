# JSON Diff Pro

一款面向技术人员的 JSON 工具，提供**对比**与**美化**两种模式：对比模式通过 6 种可视化视图直观展示两个 JSON 的差异；美化模式提供词法级无损的 JSON 格式化，并支持导出 Excel。

## ✨ 功能特性

- 🎨 **双模式** - 顶部一键切换「对比」与「美化」

- 🎯 **双编辑器输入** - 基于 Monaco Editor 的专业 JSON 编辑体验

- 🔄 **实时对比** - 一键计算并展示 JSON 差异

- ✨ **无损美化** - 基于 jsonc-parser 词法级格式化：超大整数精度、注释、键序全部原样保留（区别于 `JSON.parse` 会损坏大整数）

- 🧩 **JSONC 支持** - 可选允许注释，实时校验带行列定位

- 📊 **JSON 转 Excel** - 基于 exceljs：键名作列名表格、对象数组自动拆 sheet、超宽结构降级为「路径/值」清单，不可无损往返的数字写文本单元格避免 Excel 精度损坏

- 👁️ **6 种视图模式**：

  - 📊 概览视图 - 统计仪表板

  - 🌳 树形视图 - 结构化层级展示（核心视图，启用虚拟滚动）

  - 📋 并排视图 - 经典左右对比

  - 🎴 卡片视图 - 字段级卡片展示

  - 🕸️ 图形视图 - D3.js 矩形树图（treemap）

  - 📝 摘要视图 - 智能文本总结

- 🎨 **直观标记** - 颜色编码（绿色=新增，红色=删除，黄色=修改）

- 🚫 **字段忽略** - 逐字段开关忽略差异，支持自定义正则匹配

- 🔧 **实用工具** - 格式化、压缩、交换、复制、清空等操作

- 💾 **本地持久化** - 输入内容、对比偏好、美化草稿自动保存到 localStorage（刷新不丢失，隐私模式/配额满时优雅降级）

- 🧱 **健壮性** - 顶层 ErrorBoundary 兜底渲染异常；大文件导入限流；校验防抖

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 <http://localhost:5173>

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

### 运行单元测试

```bash
npm test          # 一次性跑全部用例
npm run test:watch # 监听模式
```

## 🛠️ 技术栈

- **框架**: React 18 + TypeScript

- **构建工具**: Vite

- **状态管理**: Zustand（+ persist 持久化中间件）

- **UI 组件库**: Ant Design

- **代码编辑器**: Monaco Editor

- **差异引擎**: 自研（LCS 对齐 + 相似度配对 + 主键对齐）

- **JSON 处理**: jsonc-parser（无损格式化/压缩/校验）

- **Excel 导出**: exceljs（按需动态导入，独立分包）

- **可视化**: D3.js

- **测试**: Vitest

## 📁 项目结构

```
src/
├── components/
│   ├── Beautify/        # 美化模式视图
│   ├── Layout/          # 布局组件
│   ├── ViewSwitcher/    # 视图切换器
│   ├── Views/           # 6 种视图组件
│   └── ErrorBoundary.tsx # 顶层错误边界
├── hooks/               # 自定义 Hooks（差异重算、防抖、编辑器标记等）
├── store/               # Zustand 状态管理 + 安全持久化
├── utils/               # 工具函数（差异引擎/无损格式化/Excel 导出，含对应 *.test.ts）
├── types/               # TypeScript 类型定义
└── styles/              # 全局样式
```

## 🎯 使用示例

1. 在左侧编辑器粘贴原始 JSON
2. 在右侧编辑器粘贴修改后的 JSON
3. 点击"对比"按钮
4. 切换不同视图查看差异

### 示例 JSON A

```json
{
  "user": {
    "name": "Alice",
    "age": 25,
    "email": "alice@example.com"
  },
  "settings": {
    "theme": "dark"
  }
}
```

### 示例 JSON B

```json
{
  "user": {
    "name": "Alice",
    "age": 26,
    "phone": "13800138000"
  },
  "settings": {
    "theme": "light"
  }
}
```

## 📝 开发计划

### Phase 1 (已完成) ✅

- [x] 项目初始化

- [x] 状态管理

- [x] 核心差异引擎

- [x] 输入面板

- [x] 视图切换器

- [x] 6 种基础视图

### Phase 2 (已完成) ✅

- [x] 筛选和搜索功能

- [x] 导出功能（JSON 转 Excel）

- [x] 配置和设置（对比选项、字段忽略）

- [x] 性能优化（树视图虚拟滚动、exceljs 按需分包）

### Phase 3 (已完成) ✅

- [x] 高级树形视图（带差异高亮）

- [x] 智能摘要生成

- [x] 图形视图（treemap）

- [x] 单元测试（Vitest，差异引擎/无损格式化/Excel 展平）

- [x] 无损美化模式 + JSONC 支持

- [x] 本地持久化 + ErrorBoundary 健壮性

### Phase 4 (计划中) 📋

- [ ] 更多导出格式（Markdown/HTML/CSV）

- [ ] 全局快捷键

- [ ] 部署配置

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [Vite](https://vitejs.dev/)

- [React](https://react.dev/)

- [Ant Design](https://ant.design/)

- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

