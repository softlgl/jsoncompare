import { Empty, Card, Row, Col, Statistic, Table, Tag, Progress, theme as antdTheme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowUpOutlined, ArrowDownOutlined, EditOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { useJsonStore } from '../../store/jsonStore';
import { flattenDiff } from '../../utils/diffEngine';
import { displayPath } from '../../utils/paths';
import { MONO_FONT } from '../../utils/theme';

const typeMeta: Record<string, { color: string; label: string }> = {
  added: { color: 'green', label: '新增' },
  deleted: { color: 'red', label: '删除' },
  updated: { color: 'orange', label: '修改' },
};

function rootSegmentsOf(path: string): string {
  const segs = path.split(/[.[\]]/).filter(Boolean);
  return segs[0] ?? path;
}

function printValue(v: any): string {
  if (v === undefined || v === null) return String(v);
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

const SummaryView: React.FC = () => {
  const diffResult = useJsonStore((s) => s.diffResult);
  const { token } = antdTheme.useToken();

  const items = useMemo(() => (diffResult ? flattenDiff(diffResult) : []), [diffResult]);
  const stats = diffResult?.statistics;

  const topLevel = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item) => {
      const root = rootSegmentsOf(item.path);
      map.set(root, (map.get(root) ?? 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [items]);

  if (!diffResult || !stats) {
    return <Empty description="暂无差异数据" />;
  }

  const metrics = [
    { key: 'total', title: '总计差异', value: stats.total, color: token.colorInfo },
    { key: 'added', title: '新增', value: stats.added, color: token.colorSuccess, icon: <ArrowUpOutlined /> },
    { key: 'deleted', title: '删除', value: stats.deleted, color: token.colorError, icon: <ArrowDownOutlined /> },
    { key: 'updated', title: '修改', value: stats.updated, color: token.colorWarning, icon: <EditOutlined /> },
  ];

  const columns: ColumnsType = [
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      render: (v: string) => <span style={{ fontFamily: MONO_FONT }}>{displayPath(v)}</span>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (type: string) => (
        <Tag color={typeMeta[type]?.color}>{typeMeta[type]?.label}</Tag>
      ),
    },
    {
      title: '旧值',
      dataIndex: 'oldValue',
      key: 'oldValue',
      ellipsis: true,
      render: (v) =>
        v === undefined ? (
          <span style={{ color: token.colorTextQuaternary }}>—</span>
        ) : (
          <span title={printValue(v)} style={{ fontFamily: MONO_FONT }}>{printValue(v)}</span>
        ),
    },
    {
      title: '新值',
      dataIndex: 'newValue',
      key: 'newValue',
      ellipsis: true,
      render: (v) =>
        v === undefined ? (
          <span style={{ color: token.colorTextQuaternary }}>—</span>
        ) : (
          <span title={printValue(v)} style={{ fontFamily: MONO_FONT }}>{printValue(v)}</span>
        ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {metrics.map((m) => (
          <Col key={m.key} xs={12} sm={12} md={6}>
            <Card>
              <Statistic title={m.title} value={m.value} prefix={m.icon} valueStyle={{ color: m.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      {topLevel.length > 0 && (
        <Card title="差异分布（按顶层路径）" style={{ marginBottom: 16 }}>
          {topLevel.map(({ name, count }) => (
            <div key={name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                <span style={{ fontFamily: MONO_FONT }}>{name}</span>
                <span style={{ color: token.colorTextSecondary, whiteSpace: 'nowrap' }}>{count} 处</span>
              </div>
              <Progress
                percent={Math.round((count / stats.total) * 100)}
                showInfo={false}
                strokeColor={token.colorInfo}
              />
            </div>
          ))}
        </Card>
      )}

      <Card title="全部变更">
        <Table
          size="small"
          rowKey="path"
          columns={columns}
          dataSource={items}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
};

export default SummaryView;
