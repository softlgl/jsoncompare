import { describe, it, expect } from 'vitest';
import {
  calculateDiff,
  flattenDiff,
  validateJson,
  formatJson,
  getConfigFingerprint,
  makeSourceKey,
} from './diffEngine';
import type { AppConfig } from '../types';

const base = (patch: Partial<AppConfig> = {}): Partial<AppConfig> => patch;

describe('calculateDiff 输入约束', () => {
  it('根节点必须是对象', () => {
    expect(() => calculateDiff([] as any, {})).toThrow(/JSON A 必须是对象/);
    expect(() => calculateDiff({}, 5 as any)).toThrow(/JSON B 必须是对象/);
    expect(() => calculateDiff({}, null as any)).toThrow(/JSON B 必须是对象/);
  });

  it('相同对象无差异', () => {
    const d = calculateDiff({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } });
    expect(d.statistics.total).toBe(0);
  });
});

describe('对象基础差异', () => {
  const A = { user: { name: 'Alice', age: 25, email: 'a@x.com' }, settings: { theme: 'dark' } };
  const B = { user: { name: 'Alice', age: 26, phone: '138' }, settings: { theme: 'light' } };
  const d = calculateDiff(A, B);

  it('新增/删除/修改的路径与值', () => {
    expect(d.added).toEqual({ 'user.phone': '138' });
    expect(d.deleted).toEqual({ 'user.email': 'a@x.com' });
    expect(d.updated).toEqual({
      'user.age': { from: 25, to: 26 },
      'settings.theme': { from: 'dark', to: 'light' },
    });
  });

  it('统计数一致', () => {
    expect(d.statistics).toEqual({ total: 4, added: 1, deleted: 1, updated: 2 });
  });

  it('类型互转视为修改而非增删', () => {
    expect(calculateDiff({ v: '1' }, { v: 1 }).updated.v).toEqual({ from: '1', to: 1 });
    expect(calculateDiff({ o: { a: 1 } }, { o: [1] }).updated.o).toEqual({ from: { a: 1 }, to: [1] });
    expect(calculateDiff({ v: null }, { v: 1 }).updated.v).toEqual({ from: null, to: 1 });
  });
});

describe('数字容差', () => {
  const A = { v: 1 };
  const B = { v: 1.0000000001 }; // 差 1e-10

  it('exact 模式视为修改', () => {
    expect(calculateDiff(A, B, base({ numericPrecision: 'exact' })).statistics.total).toBe(1);
  });

  it('tolerant 模式视为未变', () => {
    expect(calculateDiff(A, B, base({ numericPrecision: 'tolerant' })).statistics.total).toBe(0);
  });

  it('超出容差仍视为修改', () => {
    const d = calculateDiff({ v: 1 }, { v: 1.001 }, base({ numericPrecision: 'tolerant' }));
    expect(d.statistics.total).toBe(1);
  });
});

describe('数组差异', () => {
  it('默认顺序不敏感：纯换序无差异', () => {
    expect(calculateDiff({ l: [1, 2, 3] }, { l: [3, 2, 1] }).statistics.total).toBe(0);
  });

  it('顺序敏感：换序按下标产出修改', () => {
    const d = calculateDiff({ l: [1, 2, 3] }, { l: [3, 2, 1] }, base({ arrayOrderSensitive: true }));
    expect(Object.keys(d.updated).sort()).toEqual(['l[0]', 'l[2]']);
    expect(d.statistics.total).toBe(2);
  });

  it('LCS 对齐：插入元素按 B 侧下标记新增', () => {
    const d = calculateDiff({ l: ['a', 'b', 'c'] }, { l: ['a', 'x', 'b', 'c'] });
    expect(d.added).toEqual({ 'l[1]': 'x' });
    expect(d.statistics.total).toBe(1);
  });

  it('LCS 对齐：删除元素按 A 侧下标记删除', () => {
    const d = calculateDiff({ l: ['a', 'b', 'c'] }, { l: ['a', 'c'] });
    expect(d.deleted).toEqual({ 'l[1]': 'b' });
  });

  it('相似对象达到阈值配对为修改而非一删一增', () => {
    const d = calculateDiff({ l: [{ name: 'Alice', age: 25 }] }, { l: [{ name: 'Alice', age: 26 }] });
    expect(d.updated).toEqual({ 'l[0].age': { from: 25, to: 26 } });
    expect(d.added).toEqual({});
    expect(d.deleted).toEqual({});
  });

  it('相似度过低退化为删除+新增', () => {
    const d = calculateDiff({ l: [{ a: 1, b: 2, c: 3, d: 4 }] }, { l: [{ e: 5 }] });
    expect(d.deleted['l[0]']).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    expect(d.added['l[0]']).toEqual({ e: 5 });
    expect(d.statistics.total).toBe(2);
  });
});

describe('主键对齐', () => {
  it('同主键元素互相配对，路径用 A 侧下标', () => {
    const A = { l: [{ id: 1, v: 'a' }, { id: 2, v: 'b' }] };
    const B = { l: [{ id: 2, v: 'b' }, { id: 1, v: 'c' }] };
    const d = calculateDiff(A, B, base({ arrayPrimaryKey: ['id'] }));
    expect(d.updated).toEqual({ 'l[0].v': { from: 'a', to: 'c' } });
    expect(d.statistics.total).toBe(1);
  });

  it('不同主键视为删除/新增，不做相似度强行配对', () => {
    const A = { l: [{ id: 1, v: 'x' }] };
    const B = { l: [{ id: 9, v: 'x' }] };
    const d = calculateDiff(A, B, base({ arrayPrimaryKey: ['id'] }));
    expect(d.deleted['l[0]']).toEqual({ id: 1, v: 'x' });
    expect(d.added['l[0]']).toEqual({ id: 9, v: 'x' });
    expect(d.statistics.total).toBe(2);
  });

  it('主键覆盖率不足一半时退化到默认对齐', () => {
    const A = { l: [{ id: 1 }, { y: 2 }, { z: 3 }] };
    const B = { l: [{ id: 1 }, { y: 2 }] };
    const d = calculateDiff(A, B, base({ arrayPrimaryKey: ['id'] }));
    expect(d.deleted).toEqual({ 'l[2]': { z: 3 } });
  });

  it('支持 a.b 形式的嵌套主键路径', () => {
    const A = { l: [{ meta: { k: 'x' }, v: 1 }] };
    const B = { l: [{ meta: { k: 'x' }, v: 2 }] };
    const d = calculateDiff(A, B, base({ arrayPrimaryKey: ['meta.k'] }));
    expect(d.updated).toEqual({ 'l[0].v': { from: 1, to: 2 } });
  });
});

describe('忽略规则', () => {
  it('正则匹配的路径整棵跳过', () => {
    const A = { ts: 1, name: 'a', nested: { ts: 1 } };
    const B = { ts: 2, name: 'b', nested: { ts: 2 } };
    const d = calculateDiff(A, B, base({ ignorePatterns: ['ts'] }));
    expect(d.updated).toEqual({ name: { from: 'a', to: 'b' } });
  });

  it('非法正则被安全丢弃而不是崩溃', () => {
    const d = calculateDiff({ a: 1 }, { a: 2 }, base({ ignorePatterns: ['('] }));
    expect(d.statistics.total).toBe(1);
  });
});

describe('键顺序敏感', () => {
  it('默认不敏感：仅换序无差异', () => {
    expect(calculateDiff({ a: 1, b: 2 }, { b: 2, a: 1 }).statistics.total).toBe(0);
  });

  it('敏感时根路径记录键序变化', () => {
    const d = calculateDiff({ a: 1, b: 2 }, { b: 2, a: 1 }, base({ objectKeyOrderSensitive: true }));
    expect(d.updated['']).toEqual({ from: ['a', 'b'], to: ['b', 'a'] });
    expect(d.statistics.total).toBe(1);
  });
});

describe('flattenDiff', () => {
  it('展开条目携带类型与新旧值', () => {
    const d = calculateDiff({ a: 1, gone: 2 }, { a: 2, added: 3 });
    const items = flattenDiff(d);
    expect(items).toHaveLength(3);
    const byPath = Object.fromEntries(items.map((i) => [i.path, i]));
    expect(byPath.a).toMatchObject({ type: 'updated', oldValue: 1, newValue: 2 });
    expect(byPath.gone).toMatchObject({ type: 'deleted', oldValue: 2 });
    expect(byPath.added).toMatchObject({ type: 'added', newValue: 3 });
  });
});

describe('validateJson / formatJson', () => {
  it('校验基本行为', () => {
    expect(validateJson('').valid).toBe(false);
    expect(validateJson('{bad').valid).toBe(false);
    expect(validateJson('{"a":1}')).toEqual({ valid: true, parsed: { a: 1 } });
  });

  it('formatJson 无损：大整数与注释都不被破坏', () => {
    const big = formatJson('{"id":9007199254740993}');
    expect(big).toContain('9007199254740993');
    expect(JSON.parse(formatJson('{"a":1}')).id).toBeUndefined(); // sanity：结构完整
    const withComment = formatJson('{\n  // note\n  "a": 1\n}');
    expect(withComment).toContain('// note');
  });
});

describe('指纹与结果有效性', () => {
  it('仅对比相关配置变化才改变指纹', () => {
    const a = getConfigFingerprint({ numericPrecision: 'exact' } as AppConfig);
    const b = getConfigFingerprint({ numericPrecision: 'tolerant' } as AppConfig);
    expect(a).not.toBe(b);
    const themeA = getConfigFingerprint({ theme: 'light' } as AppConfig);
    const themeB = getConfigFingerprint({ theme: 'dark' } as AppConfig);
    expect(themeA).toBe(themeB);
  });

  it('makeSourceKey 随文本或配置变化', () => {
    const cfg = { numericPrecision: 'exact' } as AppConfig;
    expect(makeSourceKey('a', 'b', cfg)).not.toBe(makeSourceKey('a', 'c', cfg));
    expect(makeSourceKey('a', 'b', cfg)).toBe(makeSourceKey('a', 'b', cfg));
  });
});
