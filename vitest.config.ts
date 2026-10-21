import { defineConfig } from 'vitest/config';

// 独立于 vite.config.ts：单测全部是纯逻辑（utils/store），node 环境即可，
// 不加载 react 插件，跑得更快也不受构建侧配置变化影响。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
