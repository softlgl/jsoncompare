/** 根对象自身差异的展示文案（此时路径为空字符串） */
export const ROOT_LABEL = '(根)';

/** 根对象在树结构中的占位 key，避免与空字符串父节点形成自引用 */
export const ROOT_KEY = '__root__';

/** 展示用的路径：根路径回退为可读文案 */
export function displayPath(path: string): string {
  return path || ROOT_LABEL;
}

export interface PathSegment {
  /** 当前段的展示文本，数组下标形如 `[0]` */
  seg: string;
  /** 从根到当前段的完整前缀，即该段对应的树节点 key */
  prefix: string;
}

/** 解析形如 "a.b[0].c" 的路径，返回逐段的 {seg, prefix} */
export function parsePath(path: string): PathSegment[] {
  const out: PathSegment[] = [];
  let i = 0;
  let buf = '';
  let prefix = '';
  const push = (seg: string) => {
    out.push({ seg, prefix });
  };
  while (i < path.length) {
    const ch = path[i];
    if (ch === '.') {
      if (buf) {
        prefix = prefix ? `${prefix}.${buf}` : buf;
        push(buf);
        buf = '';
      }
      i++;
    } else if (ch === '[') {
      if (buf) {
        prefix = prefix ? `${prefix}.${buf}` : buf;
        push(buf);
        buf = '';
      }
      const close = path.indexOf(']', i);
      const idx = path.slice(i + 1, close);
      prefix = `${prefix}[${idx}]`;
      push(`[${idx}]`);
      i = close + 1;
    } else {
      buf += ch;
      i++;
    }
  }
  if (buf) {
    prefix = prefix ? `${prefix}.${buf}` : buf;
    push(buf);
  }
  return out;
}

/** 路径对应的树节点 key（根路径用占位 key） */
export function treeKeyOf(path: string): string {
  return path === '' ? ROOT_KEY : path;
}

/** 从根到自身的全部节点 key，用于展开定位 */
export function ancestorKeys(path: string): string[] {
  if (path === '') return [ROOT_KEY];
  return parsePath(path).map((p) => p.prefix);
}
