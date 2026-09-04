import { useMonaco } from '@monaco-editor/react';
import type { editor, Position } from 'monaco-editor';
import { useEffect, useMemo, useRef } from 'react';
import type { DiffItem, ChangeType } from '../types';
import { buildPathIndex } from '../utils/jsonSourceIndex';

/** 内联高亮的上限，超出后只保留概览标尺与缩略图标记，避免海量装饰拖慢渲染 */
const MAX_INLINE_MARKS = 2000;

export interface MarkColors {
  added: string;
  deleted: string;
  updated: string;
}

type MarkKind = Exclude<ChangeType, 'unchanged'>;

/** A 侧只标删除与旧值，B 侧只标新增与新值 */
function kindFor(item: DiffItem, side: 'A' | 'B'): MarkKind | null {
  if (item.type === 'updated') return 'updated';
  if (side === 'A') return item.type === 'deleted' ? 'deleted' : null;
  return item.type === 'added' ? 'added' : null;
}

function preview(v: any, max = 100): string {
  let s: string;
  if (v === undefined) s = 'undefined';
  else if (v === null) s = 'null';
  else if (typeof v === 'string') s = v === '' ? '(空字符串)' : `"${v}"`;
  else if (typeof v === 'object') s = JSON.stringify(v) ?? String(v);
  else s = String(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function hoverFor(item: DiffItem, kind: MarkKind, locatable: boolean): string {
  const base = kind === 'added'
    ? `新增：${preview(item.newValue)}`
    : kind === 'deleted'
      ? `删除：${preview(item.oldValue)}`
      : `修改：${preview(item.oldValue)}  →  ${preview(item.newValue)}`;
  return locatable ? `${base}\n\n---\nCtrl/⌘+点击 定位到树形视图` : base;
}

/**
 * 命中检测：offset 落在多个嵌套范围内时取范围最小（最精确）的一条。
 * 之所以不把路径写进 decoration 再读回来，是因为 Monaco 的
 * IModelDecorationOptions 没有自定义数据字段，反查更直接。
 */
function findHitByOffset(
  index: ReturnType<typeof buildPathIndex>,
  items: DiffItem[],
  side: 'A' | 'B',
  offset: number,
): string | null {
  let bestPath: string | null = null;
  let bestLen = Infinity;
  for (const item of items) {
    if (!kindFor(item, side)) continue;
    const span = index.get(item.path);
    if (!span) continue;
    if (offset < span.offset || offset > span.offset + span.length) continue;
    if (span.length < bestLen) {
      bestLen = span.length;
      bestPath = item.path;
    }
  }
  return bestPath;
}

/**
 * 在编辑器里把差异位置标记出来，并支持 Ctrl/⌘+点击定位到树视图。
 *
 * @param active 结果是否为最新。过期时保留上一批标记——此时路径与文本已不同步，
 *               重算会定位到错误位置，不如让既有标记随编辑粘性跟随。
 * @param onLocate 命中差异处（Ctrl/⌘+点击）时的回调，参数为差异路径。
 */
export function useDiffMarks(
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>,
  text: string,
  items: DiffItem[],
  side: 'A' | 'B',
  colors: MarkColors,
  active: boolean,
  onLocate?: (path: string) => void,
): void {
  const monaco = useMonaco();
  const collectionRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  // 扫描整份文本不算便宜，只在文本真正变化时重建，
  // 改配置或切主题时直接复用。
  const index = useMemo(() => buildPathIndex(text), [text]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !monaco) return;

    if (!collectionRef.current) {
      collectionRef.current = ed.createDecorationsCollection();
    }
    const collection = collectionRef.current;

    if (items.length === 0) {
      collection.clear();
      return;
    }
    if (!active) return;

    const model = ed.getModel();
    if (!model) return;

    const decorations: editor.IModelDeltaDecoration[] = [];
    let inlineCount = 0;

    for (const item of items) {
      const span = index.get(item.path);
      if (!span) continue;

      const kind = kindFor(item, side);
      if (!kind) continue;

      const start = model.getPositionAt(span.offset);
      const end = model.getPositionAt(span.offset + span.length);
      const color = colors[kind];
      const inline = inlineCount < MAX_INLINE_MARKS;
      if (inline) inlineCount++;

      decorations.push({
        range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
        options: {
          className: inline ? `json-diff-mark json-diff-mark--${kind}` : undefined,
          overviewRuler: { color, position: monaco.editor.OverviewRulerLane.Full },
          minimap: { color, position: monaco.editor.MinimapPosition.Inline },
          hoverMessage: { value: hoverFor(item, kind, onLocate != null) },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    collection.set(decorations);
  }, [monaco, index, items, side, colors, active, onLocate, editorRef]);

  // Ctrl/⌘+点击差异区域 -> 定位到树视图
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !onLocate) return;
    if (items.length === 0) return;

    const disposable = ed.onMouseDown((e) => {
      if (!(e.event.ctrlKey || e.event.metaKey)) return;
      const pos: Position | null = e.target.position;
      if (!pos) return;
      const model = ed.getModel();
      if (!model) return;
      const path = findHitByOffset(index, items, side, model.getOffsetAt(pos));
      if (path) onLocate(path);
    });

    return () => disposable.dispose();
  }, [editorRef, index, items, side, onLocate]);
}
