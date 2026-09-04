import { Drawer, List, Switch, Tag, Divider, Select, Alert, Empty, Typography } from 'antd';
import { useMemo } from 'react';
import { useJsonStore } from '../../store/jsonStore';
import { useViewStore } from '../../store/viewStore';
import { flattenDiff } from '../../utils/diffEngine';
import { useRerunDiff } from '../../hooks/useDiffActions';
import { displayPath } from '../../utils/paths';
import type { DiffItem } from '../../types';

const { Text } = Typography;

const typeMeta: Record<string, { color: string; label: string }> = {
  added: { color: 'green', label: '新增' },
  deleted: { color: 'red', label: '删除' },
  updated: { color: 'orange', label: '修改' },
};

// 把字面路径转义为正则，避免其中的 . [ ] 等被当作通配
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isIgnored(path: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    try {
      return new RegExp(p).test(path);
    } catch {
      return false;
    }
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const IgnoreFields: React.FC<Props> = ({ open, onClose }) => {
  const { diffResult } = useJsonStore();
  const config = useViewStore((s) => s.config);
  const items = useMemo<DiffItem[]>(
    () => (diffResult ? flattenDiff(diffResult) : []),
    [diffResult]
  );

  const rerunDiff = useRerunDiff();
  const ignoredCount = items.filter((i) => isIgnored(i.path, config.ignorePatterns)).length;

  const toggle = (path: string, ignore: boolean) => {
    const current = config.ignorePatterns;
    const escaped = escapeRegex(path);
    const patterns = ignore
      ? current.some((p) => p === escaped)
        ? current
        : [...current, escaped]
      : current.filter((p) => p !== escaped && p !== path); // 移除字面或裸路径
    rerunDiff({ ignorePatterns: patterns });
  };

  return (
    <Drawer
      title={`字段忽略配置${items.length ? `（已忽略 ${ignoredCount}/${items.length}）` : ''}`}
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
    >
      {items.length === 0 ? (
        <Empty description="没有差异字段可配置，请先对比" />
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            message="逐个开关差异字段即可忽略对应路径，切换后立即重新对比。"
            style={{ marginBottom: 16 }}
          />
          <List
            size="small"
            dataSource={items}
            pagination={items.length > 50 ? { pageSize: 50, size: 'small' } : false}
            renderItem={(item) => {
              const ignored = isIgnored(item.path, config.ignorePatterns);
              const meta = typeMeta[item.type] ?? typeMeta.updated;
              return (
                <List.Item
                  actions={[
                    <Switch
                      key="sw"
                      size="small"
                      checked={ignored}
                      onChange={(checked) => toggle(item.path, checked)}
                    />,
                  ]}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>{meta.label}</Tag>
                      <Text code ellipsis style={{ maxWidth: 220 }}>{displayPath(item.path)}</Text>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        </>
      )}

      <Divider orientation="left" plain>自定义正则（高级）</Divider>
      <Select
        mode="tags"
        placeholder="如 ^metadata\\. 回车添加，可与上方联动"
        allowClear
        style={{ width: '100%' }}
        value={config.ignorePatterns}
        onChange={(values) => rerunDiff({ ignorePatterns: values })}
        options={config.ignorePatterns.map((p) => ({ value: p }))}
      />
    </Drawer>
  );
};

export default IgnoreFields;