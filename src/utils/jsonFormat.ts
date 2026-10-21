import {
  format,
  applyEdits,
  parse as jsoncParse,
  createScanner,
  stripComments,
  type ParseError,
  printParseErrorCode,
} from 'jsonc-parser';

/**
 * 词法级（无损）JSON 处理工具。
 *
 * 与 `JSON.parse + JSON.stringify` 的关键区别：
 * 1. 数字按原始 token 文本输出，超过 2^53 的大整数/高精度小数不会被四舍五入或转科学计数；
 * 2. JSONC 注释（// 与 /* *\/）作为 trivia 被保留；
 * 3. 只重排空白、不改动内容，因此键顺序、重复键等原始信息保持不变。
 *
 * 实现依赖项目已有的 jsonc-parser：format() 计算「空白编辑列表」，
 * applyEdits() 将其应用回原文，全程不构造 JS 对象。
 */

// SyntaxKind 是 const enum，为避免 esbuild 跨模块内联问题，这里用数值常量并注释对齐。
const KIND_EOF = 17;
const KIND_UNKNOWN = 16;

export interface BeautifyOptions {
  /** 用空格缩进（true）还是用制表符（false） */
  insertSpaces: boolean;
  /** 一级缩进的宽度 */
  tabSize: number;
  /** 行尾符，默认 '\n' */
  eol?: string;
}

export const DEFAULT_BEAUTIFY_OPTIONS: BeautifyOptions = {
  insertSpaces: true,
  tabSize: 2,
  eol: '\n',
};

/**
 * 无损美化：重排缩进与换行，保留注释与数字原始精度。
 * 传入非法文本时 jsonc-parser 会尽力返回可解析部分，不抛异常。
 */
export function formatJsonText(text: string, opts: BeautifyOptions = DEFAULT_BEAUTIFY_OPTIONS): string {
  const edits = format(text, undefined, {
    insertSpaces: opts.insertSpaces,
    tabSize: opts.tabSize,
    eol: opts.eol ?? '\n',
  });
  return applyEdits(text, edits);
}

/**
 * 无损压缩：移除字符串外的所有空白与注释，数字/字符串按原始源码切片拼接。
 */
export function minifyJsonText(text: string): string {
  // ignoreTrivia=true：scan() 只返回有意义的 token，自动跳过空白与注释
  const scanner = createScanner(text, true);
  let out = '';
  let token = scanner.scan();
  while (token !== KIND_EOF) {
    if (token === KIND_UNKNOWN) {
      // 词法错误：交给 validate 报错，压缩时停止以避免产出坏数据
      break;
    }
    const start = scanner.getTokenOffset();
    const len = scanner.getTokenLength();
    out += text.slice(start, start + len);
    token = scanner.scan();
  }
  return out;
}

/** 移除 JSONC 注释（标准 JSON 场景下使用） */
export function removeComments(text: string): string {
  return stripComments(text);
}

export interface JsonValidation {
  valid: boolean;
  /** 首个错误的可读名称 */
  error?: string;
  /** 错误在原文中的零基偏移 */
  offset?: number;
  /** 错误所在行（1 基，便于展示） */
  line?: number;
  /** 错误所在列（1 基） */
  column?: number;
  /** 是否含注释（供 UI 提示「是否转标准 JSON」） */
  hasComments?: boolean;
}

/**
 * 校验 JSON / JSONC，返回首个错误的位置（行/列）。
 * @param allowComments 是否允许注释；标准 JSON 传 false
 */
export function validateJsonText(text: string, allowComments = true): JsonValidation {
  if (!text.trim()) {
    return { valid: false, error: '内容不能为空' };
  }

  const errors: ParseError[] = [];
  jsoncParse(text, errors, {
    disallowComments: !allowComments,
    allowTrailingComma: false,
  });

  if (errors.length > 0) {
    const first = errors[0];
    const { line, column } = offsetToLineCol(text, first.offset);
    return {
      valid: false,
      error: describeParseError(first.error),
      offset: first.offset,
      line,
      column,
    };
  }

  return { valid: true, hasComments: containsComment(text) };
}

/** 将 ParseErrorCode 转成中文可读文案 */
function describeParseError(code: ParseError['error']): string {
  const en = printParseErrorCode(code);
  const map: Record<string, string> = {
    InvalidSymbol: '非法符号',
    InvalidNumberFormat: '数字格式错误',
    PropertyNameExpected: '缺少属性名',
    ValueExpected: '缺少值',
    ColonExpected: '缺少冒号 ":"',
    CommaExpected: '缺少逗号 ","',
    CloseBraceExpected: '缺少右花括号 "}"',
    CloseBracketExpected: '缺少右方括号 "]"',
    EndOfFileExpected: '内容未结束，存在多余或缺失的括号',
    InvalidCommentToken: '非法注释标记',
    UnexpectedEndOfComment: '注释未闭合',
    UnexpectedEndOfString: '字符串未闭合',
    UnexpectedEndOfNumber: '数字不完整',
    InvalidUnicode: '非法 Unicode 转义',
    InvalidEscapeCharacter: '非法转义字符',
    InvalidCharacter: '非法字符',
  };
  return map[en] ?? `格式错误（${en}）`;
}

/** 零基偏移 -> 1 基行列 */
function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lastBreak = -1;
  for (let i = 0; i < clamped; i++) {
    if (text[i] === '\n') {
      line++;
      lastBreak = i;
    }
  }
  return { line, column: clamped - lastBreak };
}

/** 粗略判断是否含注释（词法扫描，非纯正则） */
function containsComment(text: string): boolean {
  const scanner = createScanner(text, false);
  let token = scanner.scan();
  while (token !== KIND_EOF) {
    // LineCommentTrivia=12, BlockCommentTrivia=13
    if (token === 12 || token === 13) return true;
    token = scanner.scan();
  }
  return false;
}

/** 统计：字符数 / 行数 / 字节数（近似） */
export function getTextStats(text: string): { chars: number; lines: number; bytes: number } {
  const chars = text.length;
  const lines = text ? text.split('\n').length : 0;
  const bytes = new TextEncoder().encode(text).length;
  return { chars, lines, bytes };
}
