import { describe, it, expect } from 'vitest';
import {
  formatJsonText,
  minifyJsonText,
  removeComments,
  validateJsonText,
  getTextStats,
} from './jsonFormat';

describe('formatJsonText 无损美化', () => {
  const src = '{\n  // 头注释\n  "id": 9007199254740993,\n  "pi": 3.14159265358979323846,\n  "arr": [1,2,   3]\n}';

  it('保留大整数与高精度小数的原始字面量', () => {
    const out = formatJsonText(src, { insertSpaces: true, tabSize: 2 });
    expect(out).toContain('9007199254740993');
    expect(out).toContain('3.14159265358979323846');
  });

  it('保留注释', () => {
    expect(formatJsonText(src, { insertSpaces: true, tabSize: 2 })).toContain('// 头注释');
  });

  it('缩进可配：4 空格与 Tab', () => {
    const four = formatJsonText('{"a":1}', { insertSpaces: true, tabSize: 4 });
    expect(four).toContain('\n    "a"');
    const tab = formatJsonText('{"a":1}', { insertSpaces: false, tabSize: 1 });
    expect(tab).toContain('\n\t"a"');
  });

  it('对比：JSON.parse 路线会损坏大整数（守护回归的根据）', () => {
    // 注意用字符串比较：测试源码里的数字字面量也会被同样损坏
    const parsedId = String(JSON.parse('{"id":9007199254740993}').id);
    expect(parsedId).not.toBe('9007199254740993');
  });
});

describe('minifyJsonText 无损压缩', () => {
  it('去空白与注释但保留数字原文', () => {
    const out = minifyJsonText('{\n  // c\n  "id": 9007199254740993,\n  "b": false\n}');
    expect(out).toBe('{"id":9007199254740993,"b":false}');
  });

  it('字符串内部的空白不受影响', () => {
    expect(minifyJsonText('{"s": "a  b  c"}')).toBe('{"s":"a  b  c"}');
  });
});

describe('validateJsonText', () => {
  it('合法 JSON', () => {
    const v = validateJsonText('{"a":1}');
    expect(v.valid).toBe(true);
    expect(v.hasComments).toBe(false);
  });

  it('带注释时 hasComments 标记，且严格模式判非法', () => {
    const loose = validateJsonText('{"a":1 // x\n}', true);
    expect(loose.valid).toBe(true);
    expect(loose.hasComments).toBe(true);
    expect(validateJsonText('{"a":1 // x\n}', false).valid).toBe(false);
  });

  it('非法内容给出错误与行列定位', () => {
    const v = validateJsonText('{\n  "a":\n}');
    expect(v.valid).toBe(false);
    expect(v.error).toBeTruthy();
    expect(v.offset).toBeTypeOf('number');
    expect(v.line).toBeGreaterThanOrEqual(2);
    expect(v.column).toBeGreaterThan(0);
  });

  it('空内容', () => {
    expect(validateJsonText('   ').valid).toBe(false);
  });
});

describe('removeComments 与 getTextStats', () => {
  it('剥注释不影响其余内容', () => {
    const out = removeComments('{"a":1 /* x */ ,\n"b":2}');
    expect(out).not.toContain('/* x */');
    expect(out).toContain('"b"');
  });

  it('统计字符/行数', () => {
    const s = getTextStats('abc\ndef');
    expect(s.chars).toBe(7);
    expect(s.lines).toBe(2);
    expect(s.bytes).toBe(7);
    expect(getTextStats('').lines).toBe(0);
  });
});
