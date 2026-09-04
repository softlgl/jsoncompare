import { DiffResult, DiffItem, AppConfig, DIFF_AFFECTING_KEYS } from '../types';

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

/**
 * 影响对比结果的配置指纹：任一影响项变化都意味着已有结果已过期。
 */
export function getConfigFingerprint(config: AppConfig): string {
  return JSON.stringify(DIFF_AFFECTING_KEYS.map((k) => config[k] ?? null));
}

/**
 * 结果指纹 = 配置指纹 + 两侧原始文本，用于判断当前结果是否仍然匹配输入。
 */
export function makeSourceKey(jsonA: string, jsonB: string, config: AppConfig): string {
  return `${getConfigFingerprint(config)}\u0000${jsonA}\u0000${jsonB}`;
}

function isPlainObject(v: any): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 将 ignorePatterns 编译为正则列表 */
function buildIgnoreMatchers(patterns: string[]): RegExp[] {
  return patterns
    .map((p) => {
      try {
        return new RegExp(p);
      } catch {
        return null;
      }
    })
    .filter((r): r is RegExp => r !== null);
}

function shouldIgnore(path: string, matchers: RegExp[]): boolean {
  return matchers.some((r) => r.test(path));
}

function isValueEqual(a: any, b: any, tolerant: boolean): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return tolerant ? Math.abs(a - b) < 1e-9 : a === b;
  }
  return a === b;
}

/** 数组是否忽略顺序地相等（作为多重集合比较） */
function arraysEquivalentAsMultiSet(a: any[], b: any[]): boolean {
  const sig = (arr: any[]) => arr.map((x) => JSON.stringify(x)).sort().join('\u0000');
  return sig(a) === sig(b);
}

// ---------------------------------------------------------------------------
// 数组对齐：LCS + 相似度配对 + 主键对齐
// ---------------------------------------------------------------------------

/** LCS 动态规划的最大单元数，超出则退化为按下标对齐，避免大数组卡死主线程 */
const LCS_CELL_LIMIT = 1_000_000;
/** 未匹配元素之间判定为「同一元素被修改」的相似度下限 */
const PAIR_THRESHOLD = 0.5;
/** 相似度配对的最大候选对数，超出则退化为按序配对 */
const PAIR_CELL_LIMIT = 250_000;

/** 元素的稳定签名，用于快速判等与 LCS 比较 */
function signature(v: any): string {
  if (v === null) return 'null';
  if (typeof v !== 'object') return `${typeof v}:${String(v)}`;
  try {
    return `obj:${JSON.stringify(v)}`;
  } catch {
    return `obj:${String(v)}`;
  }
}

/** 计算两个数组的 LCS 配对；规模过大时返回 null 交由调用方降级 */
function lcsPairs(a: any[], b: any[]): Array<[number, number]> | null {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return [];
  if ((n + 1) * (m + 1) > LCS_CELL_LIMIT) return null;

  const sa = a.map(signature);
  const sb = b.map(signature);
  const dp: Uint32Array[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = sa[i] === sb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (sa[i] === sb[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/** 字符串的粗略相似度（长度过大时用公共前缀估算） */
function strSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  if (a.length > 300 || b.length > 300) {
    let p = 0;
    const min = Math.min(a.length, b.length);
    while (p < min && a[p] === b[p]) p++;
    return p / Math.max(a.length, b.length);
  }
  let prev = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length] / Math.max(a.length, b.length);
}

/** 两个值的粗略相似度（0~1），用于判断「删除+新增」是否其实是「修改」 */
function similarity(a: any, b: any): number {
  if (a === b) return 1;
  const ta = typeof a;
  const tb = typeof b;
  if (a === null || b === null || ta !== tb) return 0;

  if (ta === 'string') return strSimilarity(a as string, b as string);
  if (ta !== 'object') return 0;

  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return 0;

  if (aArr) {
    const len = Math.max(a.length, b.length);
    if (len === 0) return 1;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += i < a.length && i < b.length ? similarity(a[i], b[i]) : 0;
    }
    return sum / len;
  }

  const ka = Object.keys(a);
  const kb = Object.keys(b);
  const union = new Set([...ka, ...kb]);
  if (union.size === 0) return 1;
  let score = 0;
  union.forEach((k) => {
    if (k in a && k in b) score += a[k] === b[k] ? 1 : 0.5;
  });
  return score / union.size;
}

/**
 * 把两侧「未匹配」的元素做贪心配对：相似度达标者视为同一元素被修改，
 * 剩下的才是真正的删除 / 新增。
 */
function pairLeftovers(
  aIdx: number[],
  bIdx: number[],
  a: any[],
  b: any[],
): { pairs: Array<[number, number]>; restA: number[]; restB: number[] } {
  if (!aIdx.length || !bIdx.length) {
    return { pairs: [], restA: aIdx, restB: bIdx };
  }

  if (aIdx.length * bIdx.length > PAIR_CELL_LIMIT) {
    const n = Math.min(aIdx.length, bIdx.length);
    const pairs: Array<[number, number]> = [];
    for (let k = 0; k < n; k++) pairs.push([aIdx[k], bIdx[k]]);
    return { pairs, restA: aIdx.slice(n), restB: bIdx.slice(n) };
  }

  const cands: Array<{ i: number; j: number; s: number }> = [];
  for (const i of aIdx) {
    for (const j of bIdx) {
      const s = similarity(a[i], b[j]);
      if (s >= PAIR_THRESHOLD) cands.push({ i, j, s });
    }
  }
  cands.sort((x, y) => y.s - x.s);

  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const pairs: Array<[number, number]> = [];
  for (const c of cands) {
    if (usedA.has(c.i) || usedB.has(c.j)) continue;
    usedA.add(c.i);
    usedB.add(c.j);
    pairs.push([c.i, c.j]);
  }
  return {
    pairs,
    restA: aIdx.filter((i) => !usedA.has(i)),
    restB: bIdx.filter((j) => !usedB.has(j)),
  };
}

/** 取元素的主键值，支持 'a.b' 形式的嵌套路径；取不到返回 null */
function primaryKeyValue(v: any, pk: string[]): string | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const parts: string[] = [];
  for (const p of pk) {
    let cur: any = v;
    for (const seg of p.split('.')) {
      if (cur === null || typeof cur !== 'object') return null;
      cur = cur[seg];
    }
    if (cur === undefined) return null;
    parts.push(typeof cur === 'object' && cur !== null ? JSON.stringify(cur) : String(cur));
  }
  return parts.join('\u0001');
}

/** 主键是否可用：要求两侧多数元素都带该主键，避免脏数据把对齐带偏 */
function canAlignByKey(a: any[], b: any[], pk: string[]): boolean {
  const ratio = (arr: any[]) =>
    arr.length === 0 ? 0 : arr.filter((v) => primaryKeyValue(v, pk) !== null).length / arr.length;
  return ratio(a) > 0.5 && ratio(b) > 0.5;
}

type AlignCtx = {
  result: DiffResult;
  path: string;
  cfg: AppConfig;
  matchers: RegExp[];
};

/** 按主键对齐数组元素：同主键的元素递归比较，其余走相似度配对或增删 */
function alignByKey(a: any[], b: any[], pk: string[], ctx: AlignCtx): void {
  const { result, path, cfg, matchers } = ctx;

  const bByKey = new Map<string, number[]>();
  b.forEach((v, j) => {
    const k = primaryKeyValue(v, pk);
    if (k === null) return;
    if (!bByKey.has(k)) bByKey.set(k, []);
    bByKey.get(k)!.push(j);
  });

  const usedB = new Set<number>();
  const pairs: Array<[number, number]> = [];
  // 有主键但另一侧没有同主键的元素：这是真正的删除 / 新增，
  // 不能再按相似度强行配对，否则 id 不同的两条记录会被误判为「修改」。
  const keyedOnlyA: number[] = [];
  const keylessA: number[] = [];
  a.forEach((v, i) => {
    const k = primaryKeyValue(v, pk);
    if (k === null) {
      keylessA.push(i);
      return;
    }
    const j = bByKey.get(k)?.find((x) => !usedB.has(x));
    if (j === undefined) {
      keyedOnlyA.push(i);
      return;
    }
    usedB.add(j);
    pairs.push([i, j]);
  });

  const keyedOnlyB: number[] = [];
  const keylessB: number[] = [];
  b.forEach((_, j) => {
    if (usedB.has(j)) return;
    if (primaryKeyValue(b[j], pk) === null) keylessB.push(j);
    else keyedOnlyB.push(j);
  });

  const childOf = (i: number) => `${path}[${i}]`;

  for (const [i, j] of pairs) {
    const childPath = childOf(i);
    if (shouldIgnore(childPath, matchers)) continue;
    compare(a[i], b[j], result, childPath, cfg, matchers);
  }

  // 取不到主键的元素退化为相似度配对
  const { pairs: extraPairs, restA: onlyA, restB: onlyB } = pairLeftovers(keylessA, keylessB, a, b);
  for (const [i, j] of extraPairs.sort((x, y) => x[0] - y[0])) {
    const childPath = childOf(i);
    if (shouldIgnore(childPath, matchers)) continue;
    compare(a[i], b[j], result, childPath, cfg, matchers);
  }

  for (const i of [...keyedOnlyA, ...onlyA]) {
    const childPath = childOf(i);
    if (!shouldIgnore(childPath, matchers)) result.deleted[childPath] = a[i];
  }
  for (const j of [...keyedOnlyB, ...onlyB]) {
    const childPath = childOf(j);
    if (!shouldIgnore(childPath, matchers)) result.added[childPath] = b[j];
  }
}

/** 统一输出数组差异：匹配对递归比较，仅 A 有的记为删除，仅 B 有的记为新增 */
function emitArrayDiff(
  a: any[],
  b: any[],
  pairs: Array<[number, number]>,
  restA: number[],
  restB: number[],
  ctx: AlignCtx,
): void {
  const { result, path, cfg, matchers } = ctx;
  const { pairs: extraPairs, restA: onlyA, restB: onlyB } = pairLeftovers(restA, restB, a, b);

  // 匹配对按 A 侧下标输出，保证路径顺序与原始数据一致
  for (const [i, j] of [...pairs, ...extraPairs].sort((x, y) => x[0] - y[0])) {
    const childPath = `${path}[${i}]`;
    if (shouldIgnore(childPath, matchers)) continue;
    compare(a[i], b[j], result, childPath, cfg, matchers);
  }
  for (const i of onlyA) {
    const childPath = `${path}[${i}]`;
    if (!shouldIgnore(childPath, matchers)) result.deleted[childPath] = a[i];
  }
  for (const j of onlyB) {
    const childPath = `${path}[${j}]`;
    if (!shouldIgnore(childPath, matchers)) result.added[childPath] = b[j];
  }
}

/** 比较两个数组：主键对齐 > LCS 对齐 > 按下标对齐 */
function compareArrays(a: any[], b: any[], result: DiffResult, path: string, cfg: AppConfig, matchers: RegExp[]): void {
  // 完全相同（含顺序）时直接跳过
  if (a.length === b.length) {
    let same = true;
    for (let i = 0; i < a.length; i++) {
      if (signature(a[i]) !== signature(b[i])) {
        same = false;
        break;
      }
    }
    if (same) return;
  }

  if (!cfg.arrayOrderSensitive && arraysEquivalentAsMultiSet(a, b)) return;

  const ctx: AlignCtx = { result, path, cfg, matchers };

  const pk = cfg.arrayPrimaryKey ?? [];
  if (pk.length > 0 && canAlignByKey(a, b, pk)) {
    alignByKey(a, b, pk, ctx);
    return;
  }

  if (!cfg.arrayOrderSensitive) {
    const lcs = lcsPairs(a, b);
    if (lcs) {
      const matchedA = new Set(lcs.map((p) => p[0]));
      const matchedB = new Set(lcs.map((p) => p[1]));
      const restA = a.map((_, i) => i).filter((i) => !matchedA.has(i));
      const restB = b.map((_, i) => i).filter((i) => !matchedB.has(i));
      // LCS 命中的元素两侧完全相等，无需再递归
      emitArrayDiff(a, b, [], restA, restB, ctx);
      return;
    }
  }

  // 降级：按下标逐个比较
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const childPath = `${path}[${i}]`;
    if (shouldIgnore(childPath, matchers)) continue;
    if (i >= a.length) result.added[childPath] = b[i];
    else if (i >= b.length) result.deleted[childPath] = a[i];
    else compare(a[i], b[i], result, childPath, cfg, matchers);
  }
}

function compare(
  a: any,
  b: any,
  result: DiffResult,
  path: string,
  cfg: AppConfig,
  matchers: RegExp[],
): void {
  if (path && shouldIgnore(path, matchers)) return;

  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  const aObj = isPlainObject(a);
  const bObj = isPlainObject(b);
  const aScalar = !aArr && !aObj;
  const bScalar = !bArr && !bObj;

  // 类型不一致（对象/数组/标量之间互转）判定为修改
  if (aArr !== bArr || aObj !== bObj || (aScalar && bScalar && typeof a !== typeof b)) {
    result.updated[path] = { from: a, to: b };
    return;
  }

  // 两个标量
  if (aScalar && bScalar) {
    if (!isValueEqual(a, b, cfg.numericPrecision === 'tolerant')) {
      result.updated[path] = { from: a, to: b };
    }
    return;
  }

  // 两个数组
  if (aArr && bArr) {
    compareArrays(a, b, result, path, cfg, matchers);
    return;
  }

  // 两个对象：键顺序敏感时，键集合相同但顺序不同视为一次修改
  if (cfg.objectKeyOrderSensitive) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length === kb.length && ka.every((k) => k in b) && ka.join('\u0000') !== kb.join('\u0000')) {
      result.updated[path] = { from: ka, to: kb };
      return;
    }
  }

  // 两个对象：取键并集，递归比较
  const allKeys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const childPath = path ? `${path}.${key}` : key;
    if (shouldIgnore(childPath, matchers)) continue;
    const inA = key in a;
    const inB = key in b;
    if (inA && !inB) result.deleted[childPath] = a[key];
    else if (!inA && inB) result.added[childPath] = b[key];
    else compare(a[key], b[key], result, childPath, cfg, matchers);
  }
}

/**
 * 计算两个 JSON 对象的差异
 * updated 中的每一项为 { from, to }，记录修改前后的值
 */
export function calculateDiff(
  jsonA: any,
  jsonB: any,
  config: Partial<AppConfig> = {},
): DiffResult {
  if (typeof jsonA !== 'object' || jsonA === null || Array.isArray(jsonA)) {
    throw new Error('JSON A 必须是对象');
  }
  if (typeof jsonB !== 'object' || jsonB === null || Array.isArray(jsonB)) {
    throw new Error('JSON B 必须是对象');
  }

  const cfg: AppConfig = { ...defaultConfig, ...config };
  const matchers = buildIgnoreMatchers(cfg.ignorePatterns);
  const result: DiffResult = {
    added: {},
    deleted: {},
    updated: {},
    statistics: { total: 0, added: 0, deleted: 0, updated: 0 },
  };

  compare(jsonA, jsonB, result, '', cfg, matchers);

  result.statistics = {
    total: Object.keys(result.added).length + Object.keys(result.deleted).length + Object.keys(result.updated).length,
    added: Object.keys(result.added).length,
    deleted: Object.keys(result.deleted).length,
    updated: Object.keys(result.updated).length,
  };
  return result;
}

/**
 * 将差异结果扁平化为路径列表
 */
export function flattenDiff(diffResult: DiffResult): DiffItem[] {
  const items: DiffItem[] = [];

  Object.entries(diffResult.added).forEach(([path, value]) => {
    items.push({ path, type: 'added', newValue: value });
  });

  Object.entries(diffResult.deleted).forEach(([path, value]) => {
    items.push({ path, type: 'deleted', oldValue: value });
  });

  Object.entries(diffResult.updated).forEach(([path, value]) => {
    items.push({ path, type: 'updated', oldValue: value.from, newValue: value.to });
  });

  return items;
}

/**
 * 验证 JSON 字符串是否有效
 */
export function validateJson(jsonString: string): { valid: boolean; parsed?: any; error?: string } {
  try {
    if (!jsonString.trim()) {
      return { valid: false, error: 'JSON 不能为空' };
    }

    const parsed = JSON.parse(jsonString);
    return { valid: true, parsed };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : '无效的 JSON 格式',
    };
  }
}

/**
 * 格式化 JSON 字符串（美化）
 */
export function formatJson(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return jsonString;
  }
}