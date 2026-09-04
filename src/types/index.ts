// 视图类型
export type ViewType = 'overview' | 'tree' | 'sidebyside' | 'card' | 'graph' | 'summary';

// 差异类型
export type ChangeType = 'added' | 'deleted' | 'updated' | 'unchanged';

// 修改项：记录修改前后的值
export interface UpdateChange {
  from: any;
  to: any;
}

// 差异结果接口
export interface DiffResult {
  added: Record<string, any>;
  deleted: Record<string, any>;
  updated: Record<string, UpdateChange>;
  statistics: {
    total: number;
    added: number;
    deleted: number;
    updated: number;
  };
}

// 扁平化的差异项
export interface DiffItem {
  path: string;
  type: ChangeType;
  oldValue?: any;
  newValue?: any;
}

// 筛选条件
export interface FilterOptions {
  showAdded: boolean;
  showDeleted: boolean;
  showUpdated: boolean;
  showUnchanged: boolean;
  maxDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
}

// 配置选项
export interface AppConfig {
  arrayOrderSensitive: boolean;
  objectKeyOrderSensitive: boolean;
  numericPrecision: 'exact' | 'tolerant';
  ignorePatterns: string[];
  /** 数组元素按主键对齐，如 ['id']；为空则只对顺序不敏感的数组做 LCS 对齐 */
  arrayPrimaryKey: string[];
  /** 输入停止后自动重新对比 */
  autoCompare: boolean;
  /** 在输入编辑器内标记差异位置 */
  markDiffInEditor: boolean;
  theme: 'light' | 'dark';
  fontSize: number;
}

/** 影响对比结果的配置项（用于判断结果是否过期） */
export const DIFF_AFFECTING_KEYS = [
  'arrayOrderSensitive',
  'objectKeyOrderSensitive',
  'numericPrecision',
  'ignorePatterns',
  'arrayPrimaryKey',
] as const;

