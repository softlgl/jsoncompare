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
          // 其余第三方依赖
          return 'vendor'
        },
      },
    },
  },
})