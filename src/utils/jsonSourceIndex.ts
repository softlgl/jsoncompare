import { parseTree, type Node } from 'jsonc-parser';

export interface SourceSpan {
  offset: number;
  length: number;
}

/** 路径 -> 源码区间。路径格式与 diffEngine 一致：`a.b`、`list[0].name`，根为 '' */
export type PathIndex = Map<string, SourceSpan>;

/**
 * 扫描 JSON 源码，建立「路径 -> 文本区间」索引。
 *
 * 采用 jsonc-parser 而非正则/手写扫描，原因：
 * 1. 容错——用户粘贴半截 JSON 时仍能返回部分 AST，不会整棵丢失；
 * 2. 正确处理字符串转义、数字边界、嵌套结构，无需自己维护词法状态。
 */
export function buildPathIndex(text: string): PathIndex {
  const index: PathIndex = new Map();
  if (!text.trim()) return index;

  const root = parseTree(text);
  if (!root) return index;

  walk(root, '', index);
  return index;
}

function walk(node: Node, path: string, out: PathIndex): void {
  out.set(path, { offset: node.offset, length: node.length });

  if (node.type === 'object' && node.children) {
    for (const prop of node.children) {
      if (prop.type !== 'property') continue;
      const children = prop.children;
      if (!children || children.length < 2) continue;
      const keyNode = children[0];
      const valueNode = children[1];
      if (!keyNode || !valueNode) continue;
      const key = String(keyNode.value);
      // 高亮落在值上而非整个 `key: value`，同行多个差异也能区分开
      walk(valueNode, path ? `${path}.${key}` : key, out);
    }
    return;
  }

  if (node.type === 'array' && node.children) {
    node.children.forEach((child, i) => {
      if (!child) return;
      walk(child, `${path}[${i}]`, out);
    });
  }
}
