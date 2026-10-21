import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DiffResult, AppConfig } from '../types';
import { calculateDiff, validateJson, makeSourceKey } from '../utils/diffEngine';
import { safeStorage } from './safeStorage';

export interface RunDiffOutcome {
  ok: boolean;
  /** 失败原因（格式错误 / 对比异常） */
  error?: string;
  /** 成功时的差异总数 */
  total?: number;
}

interface JsonState {
  // JSON 原始字符串
  jsonA: string;
  jsonB: string;

  // 解析后的对象
  parsedA: any;
  parsedB: any;

  // 差异结果
  diffResult: DiffResult | null;

  // 解析错误
  parseErrorA: string | null;
  parseErrorB: string | null;

  /**
   * 产出当前 diffResult 时的输入指纹（配置 + 两侧文本）。
   * 与当前指纹不一致即表示结果已过期。
   */
  comparedKey: string | null;

  // Actions
  setJsonA: (json: string) => void;
  setJsonB: (json: string) => void;
  setDiffResult: (diff: DiffResult | null) => void;
  swapJsons: () => void;
  clearAll: () => void;

  /** 执行一次对比；静默返回结果，由调用方决定是否提示用户 */
  runDiff: (config: AppConfig) => RunDiffOutcome;
}

export const useJsonStore = create<JsonState>()(
  persist(
    (set, get) => ({
  jsonA: '{\n  "user": {\n    "name": "Alice",\n    "age": 25,\n    "email": "alice@example.com"\n  },\n  "settings": {\n    "theme": "dark"\n  }\n}',
  jsonB: '{\n  "user": {\n    "name": "Alice",\n    "age": 26,\n    "phone": "13800138000"\n  },\n  "settings": {\n    "theme": "light"\n  }\n}',
  parsedA: null,
  parsedB: null,
  diffResult: null,
  parseErrorA: null,
  parseErrorB: null,
  comparedKey: null,

  setJsonA: (json) => set({ jsonA: json }),
  setJsonB: (json) => set({ jsonB: json }),

  setDiffResult: (diff) => set({ diffResult: diff }),

  swapJsons: () => set((state) => ({
    jsonA: state.jsonB,
    jsonB: state.jsonA,
    parsedA: state.parsedB,
    parsedB: state.parsedA,
    parseErrorA: state.parseErrorB,
    parseErrorB: state.parseErrorA,
  })),

  clearAll: () => set({
    jsonA: '',
    jsonB: '',
    parsedA: null,
    parsedB: null,
    diffResult: null,
    parseErrorA: null,
    parseErrorB: null,
    comparedKey: null,
  }),

  runDiff: (config) => {
    const { jsonA, jsonB } = get();

    const validationA = validateJson(jsonA);
    if (!validationA.valid) {
      set({
        parsedA: null,
        parseErrorA: validationA.error ?? '无效的 JSON',
        diffResult: null,
        comparedKey: null,
      });
      return { ok: false, error: `JSON A 格式错误: ${validationA.error}` };
    }

    const validationB = validateJson(jsonB);
    if (!validationB.valid) {
      set({
        parsedB: null,
        parseErrorB: validationB.error ?? '无效的 JSON',
        diffResult: null,
        comparedKey: null,
      });
      return { ok: false, error: `JSON B 格式错误: ${validationB.error}` };
    }

    try {
      const diff = calculateDiff(validationA.parsed, validationB.parsed, config);
      set({
        parsedA: validationA.parsed,
        parsedB: validationB.parsed,
        parseErrorA: null,
        parseErrorB: null,
        diffResult: diff,
        comparedKey: makeSourceKey(jsonA, jsonB, config),
      });
      return { ok: true, total: diff.statistics.total };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      set({ diffResult: null, comparedKey: null });
      return { ok: false, error: message };
    }
  },
    }),
    {
      name: 'jsoncompare-inputs',
      storage: createJSONStorage(() => safeStorage),
      // 只持久化原始输入；解析结果/差异是运行时派生态，重建后由自动对比重新生成
      partialize: (state) => ({ jsonA: state.jsonA, jsonB: state.jsonB }),
    },
  ),
);
