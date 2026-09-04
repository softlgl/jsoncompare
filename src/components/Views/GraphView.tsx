import { Empty, Spin, theme as antdTheme } from 'antd';
import type { HierarchyRectangularNode } from 'd3';
import { hierarchy, treemap } from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useJsonStore } from '../../store/jsonStore';
import { flattenDiff } from '../../utils/diffEngine';
import { MONO_FONT } from '../../utils/theme';

interface Category { name: string; total: number; added: number; deleted: number; updated: number; }

function rootSegmentsOf(path: string): string {
  const segs = path.split(/[.[\]]/).filter(Boolean);
  return segs[0] ?? path;
}

function dominantKind(c: Category): 'added' | 'deleted' | 'updated' {
  if (c.added >= c.deleted && c.added >= c.updated) return 'added';
  if (c.deleted >= c.updated) return 'deleted';
  return 'updated';
}

const GraphView: React.FC = () => {
  const diffResult = useJsonStore((s) => s.diffResult);
  const { token } = antdTheme.useToken();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<string | null>(null);

  const palette = useMemo(
    () => ({
      added: token.colorSuccess,
      deleted: token.colorError,
      updated: token.colorWarning,
    }),
    [token],
  );

  const categories = useMemo<Category[]>(() => {
    if (!diffResult) return [];
    const map = new Map<string, Omit<Category, 'name' | 'total'>>();
    flattenDiff(diffResult).forEach((item) => {
      const root = rootSegmentsOf(item.path);
      const e = map.get(root) ?? { added: 0, deleted: 0, updated: 0 };
      if (item.type === 'added') e.added++;
      else if (item.type === 'deleted') e.deleted++;
      else e.updated++;
      map.set(root, e);
    });
    return [...map.entries()].map(([name, c]) => ({ name, total: c.added + c.deleted + c.updated, ...c }));
  }, [diffResult]);

  // 监听容器尺寸，自适应图表
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight - 40 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rects = useMemo(() => {
    if (!categories.length || size.width === 0 || size.height === 0) return [];
    const data = { name: 'root', children: categories.slice().sort((a, b) => b.total - a.total) };
    const root = hierarchy<Category>(data as any).sum((d: any) => d.total);
    treemap<Category>().size([size.width, size.height]).padding(2).round(true)(root);
    return (root.leaves() as Array<HierarchyRectangularNode<Category>>).map((n) => ({
      key: n.data.name,
      x: n.x0,
      y: n.y0,
      width: n.x1 - n.x0,
      height: n.y1 - n.y0,
      data: n.data,
    }));
  }, [categories, size]);

  if (!diffResult) {
    return <Empty description="暂无差异数据" />;
  }

  if (!categories.length) {
    return <Empty description="没有可展示的差异分布" />;
  }

  const legend = [
    { label: '新增为主', color: palette.added },
    { label: '删除为主', color: palette.deleted },
    { label: '修改为主', color: palette.updated },
  ];

  return (
    <div
      ref={wrapRef}
      style={{ width: '100%', height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column' }}
    >
      {!rects.length ? (
        <Spin style={{ margin: 'auto' }} />
      ) : (
        <svg width={size.width} height={size.height} style={{ flex: 1 }}>
          {rects.map((r) => {
            const kind = dominantKind(r.data);
            const fill = palette[kind];
            const active = hovered === r.key;
            return (
              <g
                key={r.key}
                onMouseEnter={() => setHovered(r.key)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'default' }}
              >
                <title>
                  {`${r.data.name} · 共 ${r.data.total} 处（新增 ${r.data.added} / 删除 ${r.data.deleted} / 修改 ${r.data.updated}）`}
                </title>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={fill}
                  fillOpacity={active ? 0.85 : 0.55}
                  stroke={token.colorBgContainer}
                  strokeWidth={1}
                  rx={3}
                  style={{ transition: 'fill-opacity .2s, x .3s, y .3s, width .3s, height .3s' }}
                />
                {r.width > 40 && r.height > 18 && (
                  <text
                    x={r.x + 6}
                    y={r.y + 14}
                    fill={token.colorText}
                    fontSize={12}
                    fontWeight={600}
                    fontFamily={MONO_FONT}
                    style={{ pointerEvents: 'none' }}
                  >
                    {r.data.name}
                  </text>
                )}
                {r.width > 30 && r.height > 12 && (
                  <text
                    x={r.x + 6}
                    y={r.y + r.height - 6}
                    fill={token.colorTextSecondary}
                    fontSize={11}
                    style={{ pointerEvents: 'none' }}
                  >
                    {r.data.total} 处
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      <div
        style={{
          marginTop: 8,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          fontSize: 12,
          color: token.colorTextTertiary,
        }}
      >
        <span>区块大小 = 该顶层路径的差异数量，颜色表示主导变更类型。</span>
        {legend.map((l) => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: l.color,
                display: 'inline-block',
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default GraphView;
