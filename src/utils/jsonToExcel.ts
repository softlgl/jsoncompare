import { parseTree, type Node } from 'jsonc-parser';
import { validateJsonText } from './jsonFormat';

/**
 * JSON → Excel 导出。
 *
 * 关键设计：不能直接 JSON.parse 后丢给 Excel——那会踩中双重精度坑：
 * 1. JS number 精度上限 2^53（`9007199254740993` 解析即损坏）；
 * 2. Excel 本身只保留 15 位有效数字（即便是可还原的浮点也可能被显示截断）。
 * 因此这里基于 jsonc-parser 的 AST 做「安全值」转换：凡是无法用 JS number
 * 无损往返表示的数字，一律保留原始文本，以文本单元格写入，内容不被破坏。
 *
 * 展平策略（键名即列名 + 自动降级）：
 * - 记录数组（对象数组）→ 一行一个条目，嵌套对象展平成点号路径列；
 * - 根对象里的「对象数组」属性 → 拆成独立 sheet，主 sheet 只留其余字段，避免横向爆炸；
 * - 预估列数超过阈值（40）→ 自动降级为「路径/值」两列清单，宽深结构纵向可读。
 */

type CellValue = string | number | boolean | null;
type SafeValue = CellValue | SafeValue[] | { [key: string]: SafeValue };

function isPlainObject(v: SafeValue): v is { [key: string]: SafeValue } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** AST 节点 → 安全值：不可无损表示的数字保留原始文本 */
function nodeToSafe(node: Node, text: string): SafeValue {
  switch (node.type) {
    case 'object': {
      const obj: { [key: string]: SafeValue } = {};
      for (const prop of node.children ?? []) {
        if (prop.type !== 'property' || !prop.children || prop.children.length < 2) continue;
        const keyNode = prop.children[0];
        const valueNode = prop.children[1];
        if (!keyNode || !valueNode) continue;
        obj[String(keyNode.value)] = nodeToSafe(valueNode, text);
      }
      return obj;
    }
    case 'array':
      return (node.children ?? []).map((child) => (child ? nodeToSafe(child, text) : null));
    case 'number': {
      const raw = text.slice(node.offset, node.offset + node.length);
      const n = Number(raw);
      if (!Number.isFinite(n)) return raw; // 超大整数：number 已失真，用原文
      const isInteger = !raw.includes('.') && !/[eE]/.test(raw);
      if (isInteger) return Number.isSafeInteger(n) ? n : raw;
      // 小数：仅当 JS number 能无损往返原文时才保留数字类型
      return String(n) === raw ? n : raw;
    }
    default:
      // string / boolean / null 的节点 value 即原始 JS 值
      return (node.value ?? null) as CellValue;
  }
}

/** 值 → 「叶子路径 : 值」序列；空容器折叠为 {} / [] 文本 */
function flattenLeaves(value: SafeValue, path: string, out: Map<string, CellValue>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(path, '[]');
    else value.forEach((item, i) => flattenLeaves(item, `${path}[${i}]`, out));
    return;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) out.set(path, '{}');
    else entries.forEach(([k, v]) => flattenLeaves(v, path ? `${path}.${k}` : k, out));
    return;
  }
  out.set(path, value);
}

interface SheetData {
  header: string[];
  rows: CellValue[][];
}

/** 标量条目（非对象元素）所在的列名 */
const SCALAR_HEADER = '值';

/** 表格模式的最大列数，超过则降级为「路径/值」清单，避免超宽表 */
const MAX_TABLE_COLUMNS = 40;

/** 记录列表 → 键作列的表格：一行一条记录，列 = 叶子路径并集，按首次出现排序 */
function recordsToTable(records: SafeValue[]): SheetData {
  const perRows = records.map((item) => {
    const pairs = new Map<string, CellValue>();
    flattenLeaves(item, '', pairs);
    return pairs;
  });

  const header: string[] = [];
  const seen = new Set<string>();
  perRows.forEach((pairs) =>
    pairs.forEach((_v, key) => {
      const label = key || SCALAR_HEADER;
      if (!seen.has(label)) {
        seen.add(label);
        header.push(label);
      }
    }),
  );
  if (header.length === 0) header.push(SCALAR_HEADER);

  const rows = perRows.map((pairs) =>
    header.map((label) =>
      label === SCALAR_HEADER ? pairs.get('') ?? null : pairs.get(label) ?? null,
    ),
  );
  return { header, rows };
}

/** 记录列表 → 「路径/值」两列清单：天然免疫宽/深结构；numbered 时加 [i] 路径前缀 */
function recordsToPairs(records: SafeValue[], numbered: boolean): SheetData {
  const rows: CellValue[][] = [];
  records.forEach((item, i) => {
    const pairs = new Map<string, CellValue>();
    flattenLeaves(item, numbered ? `[${i}]` : '', pairs);
    pairs.forEach((value, key) => rows.push([key || SCALAR_HEADER, value]));
  });
  return { header: ['路径', '值'], rows };
}

/** 按预估列数自动选择表格或清单模式 */
function toSheetData(records: SafeValue[], numbered: boolean): SheetData {
  const table = recordsToTable(records);
  return table.header.length <= MAX_TABLE_COLUMNS ? table : recordsToPairs(records, numbered);
}

/** Excel sheet 名规则：禁用 \ / ? * [ ] : 且长度≤ 31；工作簿内去重（大小写不敏感） */
function sanitizeSheetName(raw: string, used: Set<string>): string {
  const base = (raw.trim() || 'Sheet').replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base.slice(0, 27)} (${n++})`;
  }
  used.add(name.toLowerCase());
  return name;
}

interface SheetPlan {
  name: string;
  data: SheetData;
}

const isRecordArray = (v: SafeValue): v is SafeValue[] =>
  Array.isArray(v) && v.length > 0 && v.every(isPlainObject);

/**
 * JSON 文本（已校验合法）→ 一个或多个 sheet 方案。
 * 根对象拆分：值为「对象数组」的属性各自成独立 sheet（行展开）；
 * 其余字段归入主 sheet；任张表列数超阈值则降级为路径/值清单。
 * 注：仅拆第一层，子 sheet 记录内再嵌套的对象数组不再继续拆。
 */
export function jsonToSheetPlans(text: string, sideName: string, used: Set<string>): SheetPlan[] {
  const root = parseTree(text);
  if (!root) throw new Error('无法解析内容');
  const safe = nodeToSafe(root, text);

  if (isPlainObject(safe)) {
    const entries = Object.entries(safe);
    const recordEntries = entries.filter(([, v]) => isRecordArray(v)) as [string, SafeValue[]][];
    const rest = Object.fromEntries(entries.filter(([, v]) => !isRecordArray(v)));

    const plans: SheetPlan[] = [];
    if (Object.keys(rest).length > 0) {
      plans.push({ name: sanitizeSheetName(sideName, used), data: toSheetData([rest], false) });
    }
    recordEntries.forEach(([key, arr]) => {
      plans.push({ name: sanitizeSheetName(key, used), data: toSheetData(arr, true) });
    });
    if (plans.length === 0) {
      // 空对象等无任何可拆内容：整体作为一张清单
      plans.push({ name: sanitizeSheetName(sideName, used), data: toSheetData([safe], false) });
    }
    return plans;
  }

  if (Array.isArray(safe)) {
    return [{ name: sanitizeSheetName(sideName, used), data: toSheetData(safe, true) }];
  }
  return [{ name: sanitizeSheetName(sideName, used), data: toSheetData([safe], false) }];
}

function fillSheet(sheet: import('exceljs').Worksheet, data: SheetData): void {
  sheet.columns = data.header.map((name, i) => ({
    header: name,
    key: `c${i}`,
    width: 12,
  }));
  data.rows.forEach((row) => sheet.addRow(row));

  // 表头样式与冻结首行
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // 近似自适应列宽：取表头与该列内容的最大字符数
  data.header.forEach((name, colIdx) => {
    let max = name.length;
    data.rows.forEach((row) => {
      const v = row[colIdx];
      if (v !== null && v !== undefined) max = Math.max(max, String(v).length);
    });
    sheet.getColumn(colIdx + 1).width = Math.min(60, Math.max(10, max + 2));
  });
}

export interface ExportSide {
  /** sheet 名称，如 JSON A */
  name: string;
  /** 原始 JSON 文本 */
  text: string;
}

/** 生成导出文件名：json-export-YYYYMMDD-HHmmss.xlsx */
function buildFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `json-export-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.xlsx`;
}

/**
 * 将两侧 JSON 导出为一个 xlsx，浏览器端触发下载，返回 sheet 数。
 * 根对象里的对象数组会拆独立 sheet；列数超阈值自动降级为路径/值清单。
 * 空的一侧自动跳过；非法的一侧抛出带定位信息的错误。
 */
export async function exportJsonToExcel(sides: ExportSide[]): Promise<number> {
  // 校验（严格 JSON，与对比模式输入要求一致）
  for (const side of sides) {
    if (!side.text.trim()) continue;
    const v = validateJsonText(side.text, false);
    if (!v.valid) {
      const pos = v.line != null ? `（第 ${v.line} 行第 ${v.column} 列）` : '';
      throw new Error(`${side.name} 格式错误: ${v.error}${pos}`);
    }
  }
  const nonEmpty = sides.filter((s) => s.text.trim());
  if (nonEmpty.length === 0) throw new Error('没有可导出的内容');

  // 按需加载 exceljs（体积大，仅在导出时进入运行时）
  const mod = (await import('exceljs')) as unknown as Record<string, unknown>;
  const ExcelJS = (mod.Workbook ? mod : (mod.default ?? mod)) as { Workbook: new () => import('exceljs').Workbook };

  const wb = new ExcelJS.Workbook();
  const usedNames = new Set<string>();
  nonEmpty.forEach((side) => {
    jsonToSheetPlans(side.text, side.name, usedNames).forEach((plan) => {
      fillSheet(wb.addWorksheet(plan.name), plan.data);
    });
  });

  const buffer = (await wb.xlsx.writeBuffer()) as unknown as BlobPart;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFileName();
  a.click();
  URL.revokeObjectURL(url);
  return wb.worksheets.length;
}
