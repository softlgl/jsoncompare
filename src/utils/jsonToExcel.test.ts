import { describe, it, expect } from 'vitest';
import { jsonToSheetPlans } from './jsonToExcel';

const plans = (text: string, sideName = 'S') => jsonToSheetPlans(text, sideName, new Set<string>());

describe('对象数组拆 sheet', () => {
  it('根对象：记录数组属性独立成表，其余字段留主表', () => {
    const p = plans('{"name":"prod","list":[{"id":1},{"id":2,"v":"b"}]}');
    expect(p.map((x) => x.name)).toEqual(['S', 'list']);
    expect(p[0].data.header).toEqual(['name']);
    expect(p[0].data.rows).toEqual([['prod']]);
    // 列 = 键并集，缺失补 null
    expect(p[1].data.header).toEqual(['id', 'v']);
    expect(p[1].data.rows).toEqual([[1, null], [2, 'b']]);
  });

  it('全部字段都是记录数组时没有主表', () => {
    const p = plans('{"only":[{"v":1}]}');
    expect(p.map((x) => x.name)).toEqual(['only']);
  });

  it('根是对象数组时单表行展开', () => {
    const p = plans('[{"a":1},{"a":2}]');
    expect(p).toHaveLength(1);
    expect(p[0].data.header).toEqual(['a']);
    expect(p[0].data.rows).toEqual([[1], [2]]);
  });
});

describe('超阈值自动降级为路径/值清单', () => {
  it('100 元素标量数组：两列 100 行', () => {
    const nums = Array.from({ length: 100 }, (_, i) => i);
    const p = plans(JSON.stringify({ nums }));
    expect(p[0].data.header).toEqual(['路径', '值']);
    expect(p[0].data.rows).toHaveLength(100);
    expect(p[0].data.rows[0]).toEqual(['nums[0]', 0]);
  });

  it('子表自身过宽也降级，路径带 [i] 前缀', () => {
    const rows = Array.from({ length: 5 }, (_, r) =>
      Object.fromEntries(Array.from({ length: 50 }, (_, c) => [`k${c}`, r * 50 + c])),
    );
    const p = plans(JSON.stringify({ rows }));
    const child = p.find((x) => x.name === 'rows')!;
    expect(child.data.header).toEqual(['路径', '值']);
    expect(child.data.rows).toHaveLength(250);
    expect(child.data.rows[0]).toEqual(['[0].k0', 0]);
  });

  it('刚好 40 列以内保持表格模式', () => {
    const nums = Array.from({ length: 40 }, (_, i) => i);
    const p = plans(JSON.stringify({ nums }));
    expect(p[0].data.header.length).toBe(40);
    expect(p[0].data.header[0]).toBe('nums[0]');
  });
});

describe('单元格值', () => {
  it('大整数以原始文本进入单元格', () => {
    const p = plans('[{"id":9007199254740993}]');
    expect(p[0].data.rows[0][0]).toBe('9007199254740993');
  });

  it('安全范围内的数字保持数字类型', () => {
    const p = plans('[{"n":42}]');
    expect(p[0].data.rows[0][0]).toBe(42);
  });

  it('标量数组落在「值」列', () => {
    const p = plans('[1,2]');
    expect(p[0].data.header).toEqual(['值']);
    expect(p[0].data.rows).toEqual([[1], [2]]);
  });

  it('空对象兜底为单列表格', () => {
    const p = plans('{}');
    expect(p[0].data.header).toEqual(['值']);
    expect(p[0].data.rows).toEqual([['{}']]);
  });
});

describe('sheet 命名合规与去重', () => {
  it('清洗非法字符并大小写去重', () => {
    const p = plans('{"a":[{"x":1}],"a/b*":[{"y":1}],"A":[{"z":1}]}');
    expect(p.map((x) => x.name)).toEqual(['a', 'a_b_', 'A (2)']);
  });

  it('两侧共享命名空间：第二个 JSON B 的同名子表被去重', () => {
    const used = new Set<string>();
    const text = '{"list":[{"v":1}]}';
    jsonToSheetPlans(text, 'JSON A', used);
    const second = jsonToSheetPlans(text, 'JSON B', used);
    expect(second.map((x) => x.name)).toEqual(['list (2)']);
  });
});
