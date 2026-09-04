import { Empty, Card, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { useJsonStore } from '../../store/jsonStore';
import { flattenDiff } from '../../utils/diffEngine';
import { displayPath } from '../../utils/paths';
import type { ChangeType } from '../../types';
import type { DiffItem } from '../../types';

const { Text } = Typography;

const typeMeta: Record<Exclude<ChangeType, 'unchanged'>, { color: string; label: string }> = {
  added: { color: 'green', label: '新增' },
  deleted: { color: 'red', label: '删除' },
  updated: { color: 'orange', label: '修改' },
};

function Value({ prefix, children }: { prefix?: string; children: any }) {
  const value = typeof children === 'object' && children !== null
    ? JSON.stringify(children)
    : String(children);
  return (
    <Text code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {prefix}{value}
    </Text>
  );
}

const CardView: React.FC = () => {
  const { diffResult } = useJsonStore();

  const items = useMemo(() => (diffResult ? flattenDiff(diffResult) : []), [diffResult]);

  if (!diffResult || items.length === 0) {
    return <Empty description="暂无差异数据" />;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 12,
      }}
    >
      {items.map((item) => {
        const meta = item.type !== 'unchanged' ? typeMeta[item.type] : typeMeta.updated;
        const diffItem: DiffItem = item;
        return (
          <Card
            key={diffItem.path}
            size="small"
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>{meta.label}</Tag>
                <Text code strong>{displayPath(diffItem.path)}</Text>
              </span>
            }
            styles={{ body: { padding: 12 } }}
          >
            {diffItem.type === 'added' && (
              <div><Value prefix="→ ">{diffItem.newValue}</Value></div>
            )}
            {diffItem.type === 'deleted' && (
              <div><Value prefix="← ">{diffItem.oldValue}</Value></div>
            )}
            {diffItem.type === 'updated' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Value prefix="旧值: ">{diffItem.oldValue}</Value>
                <Value prefix="新值: ">{diffItem.newValue}</Value>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default CardView;