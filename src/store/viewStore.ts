import { create } from 'zustand';
import { ViewType, FilterOptions, AppConfig } from '../types';
import { ancestorKeys } from '../utils/paths';

interface ViewState {
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

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'tree',
  filters: defaultFilters,
  searchKeyword: '',
  expandedPaths: new Set(),
  focusedPath: null,
  focusSeq: 0,
  config: defaultConfig,

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
}));
