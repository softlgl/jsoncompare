# JSON Diff Pro

一款面向技术人员的多视图 JSON 对比工具，支持通过 6 种不同的可视化视图直观地对比和展示两个 JSON 文件的差异。

## ✨ 功能特性

- 🎯 **双编辑器输入** - 基于 Monaco Editor 的专业 JSON 编辑体验

- 🔄 **实时对比** - 一键计算并展示 JSON 差异

- 👁️ **6 种视图模式**：

  - 📊 概览视图 - 统计仪表板

  - 🌳 树形视图 - 结构化层级展示（核心视图）

  - 📋 并排视图 - 经典左右对比

  - 🎴 卡片视图 - 字段级卡片展示

  - 🕸️ 图形视图 - D3.js 力导向图

  - 📝 摘要视图 - 智能文本总结

- 🎨 **直观标记** - 颜色编码（绿色=新增，红色=删除，黄色=修改）

- 🚫 **字段忽略** - 逐字段开关忽略差异，支持自定义正则匹配

- 🔧 **实用工具** - 格式化、交换、清空等操作

- 💾 **导出功能** - 支持多种格式导出（开发中）

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

## 🛠️ 技术栈

- **框架**: React 18 + TypeScript

- **构建工具**: Vite

- **状态管理**: Zustand

- **UI 组件库**: Ant Design

- **代码编辑器**: Monaco Editor

- **差异引擎**: 自研（LCS 对齐 + 相似度配对 + 主键对齐）

- **JSON 解析**: jsonc-parser

- **可视化**: D3.js

## 📁 项目结构

```
src/
├── components/
│   ├── Layout/          # 布局组件
│   ├── ViewSwitcher/    # 视图切换器
│   └── Views/           # 6 种视图组件
├── hooks/               # 自定义 Hooks（差异重算、编辑器标记等）
├── store/               # Zustand 状态管理
├── utils/               # 工具函数
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

### Phase 2 (进行中) 🚧

- [ ] 筛选和搜索功能

- [ ] 导出功能（JSON/Markdown/HTML/CSV）

- [x] 配置和设置（对比选项、字段忽略）

- [ ] 性能优化

### Phase 3 (计划中) 📋

- [ ] 高级树形视图（带差异高亮）

- [x] 智能摘要生成

- [ ] 图形视图完善

- [ ] 单元测试

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

