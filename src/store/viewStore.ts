import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ViewType, FilterOptions, AppConfig } from '../types';
import { ancestorKeys } from '../utils/paths';
import { safeStorage } from './safeStorage';

// 顶层工具模式：对比 / 美化
export type ToolMode = 'compare' | 'beautify';

interface ViewState {
  // 顶层模式
  mode: ToolMode;

  // 当前视图
  currentView: ViewType;
  
  // 筛选条件
  filters: FilterOptions;
  
  // 搜索关键词
  searchKeyword: string;
  
  // 展开/折叠状态（用于树形视图）
  expandedPaths: Set<string>;
  
  // 被定位的差异路径（来自输入框点击联动）与其定位序号
  focusedPath: string | null;
  focusSeq: number;
  
  // 配置
  config: AppConfig;
  
  // Actions
  setMode: (mode: ToolMode) => void;
  setCurrentView: (view: ViewType) => void;
  setFilters: (filters: Partial<FilterOptions>) => void;
  setSearchKeyword: (keyword: string) => void;
  toggleExpandedPath: (path: string) => void;
  setExpandedPaths: (keys: Set<string>) => void;
  expandAll: (keys: string[]) => void;
  collapseAll: () => void;
  focusDiffPath: (path: string) => void;
  setFocusedPath: (path: string | null) => void;
  setConfig: (config: Partial<AppConfig>) => void;
  resetFilters: () => void;
}

const defaultFilters: FilterOptions = {
  showAdded: true,
  showDeleted: true,
  showUpdated: true,
  showUnchanged: false,
  maxDepth: undefined,
  includePaths: [],
  excludePaths: [],
};

const defaultConfig: AppConfig = {
  arrayOrderSensitive: false,
  objectKeyOrderSensitive: false,
  numericPrecision: 'exact',
  ignorePatterns: [],
  arrayPrimaryKey: [],
  autoCompare: true,
  markDiffInEditor: true,
  theme: 'light',
  fontSize: 14,
};

export const useViewStore = create<ViewState>()(
  persist(
    (set) => ({
  mode: 'compare',
  currentView: 'tree',
  filters: defaultFilters,
  searchKeyword: '',
  expandedPaths: new Set(),
  focusedPath: null,
  focusSeq: 0,
  config: defaultConfig,

  setMode: (mode) => set({ mode }),

  setCurrentView: (view) => set({ currentView: view }),
  
  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters }
  })),
  
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  
  toggleExpandedPath: (path) => set((state) => {
    const newExpanded = new Set(state.expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    return { expandedPaths: newExpanded };
  }),

  setExpandedPaths: (keys) => set({ expandedPaths: keys }),

  expandAll: (keys) => set({ expandedPaths: new Set(keys) }),

  collapseAll: () => set({ expandedPaths: new Set() }),

  // 定位某条差异：展开祖先链 + 记录焦点，交给树视图滚动/高亮
  focusDiffPath: (path) => set((state) => {
    const expandedPaths = new Set(state.expandedPaths);
    ancestorKeys(path).forEach((k) => expandedPaths.add(k));
    return {
      focusedPath: path,
      focusSeq: state.focusSeq + 1,
      expandedPaths,
    };
  }),

  setFocusedPath: (path) => set({ focusedPath: path }),
  
  setConfig: (config) => set((state) => ({
    config: { ...state.config, ...config }
  })),
  
  resetFilters: () => set({ filters: defaultFilters }),
    }),
    {
      name: 'jsoncompare-view',
      storage: createJSONStorage(() => safeStorage),
      // 只持久化偏好（主题/字号/对比规则/上次模式）；
      // 筛选、展开集、焦点路径是一次性会话态，不跨页面重建
      partialize: (state) => ({ config: state.config, mode: state.mode }),
    },
  ),
);
