import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // 编辑器（体积最大，独立缓存）
          if (id.includes('monaco-editor') || id.includes('@monaco-editor')) return 'monaco'
          // 仅图形视图使用
          if (id.includes('/d3/') || id.includes('d3-')) return 'd3'
          // 核心运行时
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('zustand') ||
            id.includes('use-sync-external-store') ||
            id.includes('/react-is/')
          ) return 'react'
          // UI 组件库
          if (
            id.includes('/antd/') ||
            id.includes('/@ant-design/') ||
            id.includes('/rc-') ||
            id.includes('/@rc-component/') ||
            id.includes('/@babel/runtime/')
          ) return 'antd'
          // 其余依赖交给 rollup 自动分包：仅被动态 import 的库（如 exceljs 及其依赖树）
          // 会落在异步 chunk，首屏不加载；静态依赖则进入口 chunk。
          // 注意：不能把它们强制归入某个固定名字的 manualChunk，
          // 否则会被并入首屏 eager chunk，破坏按需加载。
        },
      },
    },
  },
})