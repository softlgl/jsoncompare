import { Empty, Tree, Input, Space, Tag, Checkbox, Button, theme as antdTheme } from 'antd';
import {
  SearchOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import type { TreeDataNode, TreeProps } from 'antd';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useJsonStore } from '../../store/jsonStore';
import { useViewStore } from '../../store/viewStore';
import { flattenDiff } from '../../utils/diffEngine';
import { ROOT_KEY, ROOT_LABEL, parsePath, treeKeyOf } from '../../utils/paths';
import type { DiffItem } from '../../types';

type DiffType = DiffItem['type'];

const typeMeta: Record<DiffType, { color: string; label: string }> = {
  added: { color: 'green', label: '新增' },
  deleted: { color: 'red', label: '删除' },
  updated: { color: 'orange', label: '修改' },
  unchanged: { color: 'default', label: '未变' },
};

interface DiffNode {
  key: string;
  seg: string;
  type?: DiffType;
  diffItem?: DiffItem;
}

/** 由过滤后的差异条目构建树结构 */
function buildDiffTree(
  items: DiffItem[],
  keyword: string,
  focusedKey: string | null,
  focusSeq: number,
  onToggleKey: (key: string) => void,
): TreeDataNode[] {
  const nodeMap = new Map<string, DiffNode>();
  // children: parentKey → childKey 列表
  const children = new Map<string, string[]>();

  const addChild = (parent: string, child: string) => {
    if (!children.has(parent)) children.set(parent, []);
    const list = children.get(parent)!;
    if (!list.includes(child)) list.push(child);
  };

  for (const item of items) {
    const parsed = parsePath(item.path);
    // 根对象自身的差异没有路径段，用占位节点承载，否则会被整棵丢弃
    const parts = parsed.length ? parsed : [{ seg: ROOT_LABEL, prefix: ROOT_KEY }];
    parts.forEach((p, idx) => {
      if (!nodeMap.has(p.prefix)) {
        nodeMap.set(p.prefix, { key: p.prefix, seg: p.seg });
        const parentKey = idx === 0 ? '' : parts[idx - 1].prefix;
        addChild(parentKey, p.prefix);
      }
      if (idx === parts.length - 1) {
        const node = nodeMap.get(p.prefix)!;
        node.type = item.type;
        node.diffItem = item;
      }
    });
  }

  const toTreeData = (parentKey: string): TreeDataNode[] =>
    (children.get(parentKey) ?? []).map((childKey) => {
      const meta = nodeMap.get(childKey)!;
      const childNodes = toTreeData(childKey);
      const focused = focusedKey === childKey;
      const expandable = childNodes.length > 0;
      return {
        key: childKey,
        title: (
          <NodeTitle
            // key 随 focusSeq 变化：连续定位同一节点时强制重挂载以重播闪烁动画
            key={focused ? `focused-${focusSeq}` : 'node'}
            meta={meta}
            keyword={keyword}
            focused={focused}
            expandable={expandable}
            onToggleKey={onToggleKey}
          />
        ),
        children: expandable ? childNodes : undefined,
      };
    });

  return toTreeData('');
}

/** 高亮命中搜索关键词的片段 */
function highlight(text: string, keyword: string, token: any): ReactNode {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(kw);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: token.colorWarningBg, color: token.colorWarningText, borderRadius: 3, padding: '0 2px' }}>
        {text.slice(idx, idx + kw.length)}
      </span>
      {text.slice(idx + kw.length)}
    </>
  );
}

function NodeTitle({
  meta,
  keyword,
  focused,
  expandable,
  onToggleKey,
}: {
  meta: DiffNode;
  keyword: string;
  focused?: boolean;
  expandable?: boolean;
  onToggleKey?: (key: string) => void;
}) {
  const { token } = antdTheme.useToken();
  const goalMeta = meta.type ? typeMeta[meta.type] : undefined;
  const diff = meta.diffItem;

  // 差异类型的语义色（可随主题适配）
  const tone = (() => {
    switch (meta.type) {
      case 'added': return { fg: token.colorSuccess, bg: token.colorSuccessBg, edge: token.colorSuccessBorder };
      case 'deleted': return { fg: token.colorError, bg: token.colorErrorBg, edge: token.colorErrorBorder };
      case 'updated': return { fg: token.colorWarning, bg: token.colorWarningBg, edge: token.colorWarningBorder };
      default: return undefined;
    }
  })();

  const isIndex = meta.seg.startsWith('[');

  // 数组索引段：以浅色底块区分，视觉上更清晰
  const segEl = isIndex ? (
    <span
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Courier New", monospace',
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusSM,
        padding: '0 5px',
        fontSize: 12,
        color: token.colorTextSecondary,
      }}
    >
      {meta.seg}
    </span>
  ) : (
    <span style={{ fontWeight: 600, color: tone ? tone.fg : token.colorText }}>{highlight(meta.seg, keyword, token)}</span>
  );

  // 值预览胶囊：可读、超出省略、悬停展示完整值
  const chip = (value: any, kind?: 'old') => (
    <span
      title={printValue(value)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: 300,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Courier New", monospace',
        fontSize: 12,
        lineHeight: '20px',
        padding: '0 6px',
        borderRadius: token.borderRadiusSM,
        color: kind ? token.colorError : token.colorTextSecondary,
        background: kind ? token.colorErrorBg : token.colorFillTertiary,
        textDecoration: kind === 'old' ? 'line-through' : undefined,
      }}
    >
      {printValue(value)}
    </span>
  );

  return (
    <span
      id={focused ? `diff-node-${meta.key}` : undefined}
      className={focused ? 'diff-node-focused' : undefined}
      onClick={expandable && onToggleKey ? () => onToggleKey(meta.key) : undefined}
      title={expandable ? '点击展开 / 折叠' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        width: '100%',
        cursor: expandable ? 'pointer' : 'default',
        padding: '3px 10px 3px 6px',
        boxSizing: 'border-box',
        borderRadius: token.borderRadius,
        background: tone?.bg,
        borderInlineStart: `3px solid ${tone?.edge ?? 'transparent'}`,
        transition: 'background .2s',
      }}
    >
      {segEl}
      {diff && goalMeta && (
        <Tag color={goalMeta.color} bordered={false} style={{ marginInlineEnd: 0, fontWeight: 600, fontSize: 11 }}>
          {goalMeta.label}
        </Tag>
      )}
      {diff?.type === 'added' && chip(diff.newValue)}
      {diff?.type === 'deleted' && chip(diff.oldValue, 'old')}
      {diff?.type === 'updated' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {chip(diff.oldValue, 'old')}
          <ArrowRightOutlined style={{ fontSize: 11, color: token.colorWarningText }} />
          {chip(diff.newValue)}
        </span>
      )}
    </span>
  );
}

function printValue(v: any): string {
  if (v === undefined) return 'undefined';
  if (typeof v === 'object' && v !== null) return JSON.stringify(v);
  return String(v);
}

/** 差异类型颜色圆点指示 */
function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        marginRight: 4,
        verticalAlign: 'middle',
      }}
    />
  );
}

/** rc-tree 实例：虚拟滚动下靠 scrollTo({key}) 定位，而非直接操作 DOM */
type TreeInstance = { scrollTo: (arg: { key: string }) => void };

/** 单行标题的估算高度（px），rc-virtual-list 用于计算可视窗口 */
const ROW_HEIGHT = 28;

const TreeView: React.FC = () => {
  const { token } = antdTheme.useToken();
  const { diffResult } = useJsonStore();
  const {
    filters, setFilters,
    searchKeyword, setSearchKeyword,
    expandedPaths, setExpandedPaths, expandAll, collapseAll,
  } = useViewStore();
  const focusedPath = useViewStore((s) => s.focusedPath);
  const focusSeq = useViewStore((s) => s.focusSeq);
  const setFocusedPath = useViewStore((s) => s.setFocusedPath);

  const focusedKey = focusedPath === null ? null : treeKeyOf(focusedPath);

  // 虚拟滚动：测出 Tree 容器的可用高度，只在拿到大小时长挂载可视区节点
  const treeWrapRef = useRef<HTMLDivElement | null>(null);
  const treeRef = useRef<TreeInstance | null>(null);
  const [treeHeight, setTreeHeight] = useState<number>(0);

  const allItems = useMemo(() => (diffResult ? flattenDiff(diffResult) : []), [diffResult]);

  const filteredItems = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return allItems.filter((item) => {
      if (!filters.showAdded && item.type === 'added') return false;
      if (!filters.showDeleted && item.type === 'deleted') return false;
      if (!filters.showUpdated && item.type === 'updated') return false;
      if (kw && !item.path.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [allItems, filters, searchKeyword]);

  useLayoutEffect(() => {
    const el = treeWrapRef.current;
    if (!el) return;
    setTreeHeight(Math.floor(el.clientHeight));
    const ro = new ResizeObserver(() => {
      setTreeHeight(Math.floor(el.clientHeight));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [diffResult]);

  // 点击节点文字切换展开/折叠（不再只能点箭头）
  const toggleNode = useCallback((key: string) => {
    const state = useViewStore.getState();
    const next = new Set(state.expandedPaths);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    state.setExpandedPaths(next);
  }, []);

  const treeData = useMemo(
    () => buildDiffTree(filteredItems, searchKeyword, focusedKey, focusSeq, toggleNode),
    [filteredItems, searchKeyword, focusedKey, focusSeq, toggleNode],
  );

  // 定位联动：先滚动到目标行（虚拟滚动下靠 key），再对已挂载的 DOM 节点闪烁/居中
  useEffect(() => {
    if (focusedPath === null) return;
    const key = treeKeyOf(focusedPath);
    // rc-tree 的 scrollTo 会把虚拟列表中任意（已展开路径上的）行滚进视口
    treeRef.current?.scrollTo({ key });
    const timer = setTimeout(() => {
      document
        .getElementById(`diff-node-${key}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => clearTimeout(timer);
  }, [focusedPath, focusSeq, treeData, treeHeight]);

  const searchExpanded = useMemo(() => {
    if (!searchKeyword.trim()) return new Set<string>();
    const paths = new Set<string>();
    filteredItems.forEach((item) => {
      parsePath(item.path).forEach((p) => paths.add(p.prefix));
    });
    return paths;
  }, [filteredItems, searchKeyword]);

  const allKeysRef = useRef<Set<string> | null>(null);
  useLayoutEffect(() => {
    const collect = (node: TreeDataNode) => {
      allKeysRef.current = allKeysRef.current ?? new Set<string>();
      allKeysRef.current.add(String(node.key));
      node.children?.forEach(collect);
    };
    allKeysRef.current = new Set<string>();
    treeData.forEach(collect);
  }, [treeData]);

  const visibleKeys = useMemo(() => {
    const all = allKeysRef.current ?? new Set<string>();
    const merged = new Set(searchExpanded);
    expandedPaths.forEach((k) => merged.add(k));
    return [...merged].filter((k) => all.has(k));
    // treeData 变化时需重算以确保 key 在新树上有效
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedPaths, searchExpanded, treeData]);

  const onExpand: TreeProps['onExpand'] = (keys) => {
    // antd 回调的是完整的展开键列表，直接整体覆盖，从而同时支持展开与折叠
    setExpandedPaths(new Set((keys as React.Key[]).map(String)));
  };

  if (!diffResult) {
    return <Empty description="暂无差异数据" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Space wrap style={{ marginBottom: 12, rowGap: 8 }}>
        <Input.Search
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
          placeholder="搜索路径…"
          style={{ width: 280 }}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
        />
        <Checkbox
          checked={filters.showAdded}
          onChange={(e) => setFilters({ showAdded: e.target.checked })}
        >
          <Dot color={token.colorSuccess} /> 新增
        </Checkbox>
        <Checkbox
          checked={filters.showDeleted}
          onChange={(e) => setFilters({ showDeleted: e.target.checked })}
        >
          <Dot color={token.colorError} /> 删除
        </Checkbox>
        <Checkbox
          checked={filters.showUpdated}
          onChange={(e) => setFilters({ showUpdated: e.target.checked })}
        >
          <Dot color={token.colorWarning} /> 修改
        </Checkbox>
        <span style={{ marginInline: 4 }} />
        <Button size="small" icon={<FolderOpenOutlined />} onClick={() => expandAll([...(allKeysRef.current ?? [])])}>全部展开</Button>
        <Button size="small" icon={<FolderOutlined />} onClick={collapseAll}>全部折叠</Button>
      </Space>

      {filteredItems.length === 0 ? (
        <Empty description="没有符合条件的差异" />
      ) : (
        <div ref={treeWrapRef} style={{ flex: 1, minHeight: 0 }}>
          <Tree
            ref={treeRef as any}
            showLine
            blockNode
            defaultExpandParent
            switcherIcon
            treeData={treeData}
            expandedKeys={visibleKeys}
            onExpand={onExpand}
            selectedKeys={focusedKey !== null ? [focusedKey] : []}
            onSelect={(keys) => setFocusedPath(keys.length ? String(keys[0]) : null)}
            height={treeHeight > 0 ? treeHeight : undefined}
            itemHeight={ROW_HEIGHT}
            virtual={treeHeight > 0}
            style={{ background: token.colorBgContainer, borderRadius: token.borderRadiusLG, padding: 8, height: '100%' }}
          />
        </div>
      )}
    </div>
  );
};

export default TreeView;