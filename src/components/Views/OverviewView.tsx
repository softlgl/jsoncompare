import { Card, Statistic, Row, Col, Progress, theme as antdTheme } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, EditOutlined } from '@ant-design/icons';
import { useJsonStore } from '../../store/jsonStore';

const OverviewView: React.FC = () => {
  const diffResult = useJsonStore((s) => s.diffResult);
  const { token } = antdTheme.useToken();

  if (!diffResult) {
    return <div style={{ color: token.colorTextTertiary, padding: 16 }}>暂无数据</div>;
  }

  const stats = diffResult.statistics;
  const changed = stats.added + stats.deleted + stats.updated;
  const dominant = Math.max(stats.added, stats.deleted, stats.updated);
  const dominantLabel =
    dominant === stats.added ? '以新增为主' : dominant === stats.deleted ? '以删除为主' : '以修改为主';

  const metrics = [
    { key: 'total', title: '总计差异', value: stats.total, color: token.colorInfo },
    { key: 'added', title: '新增', value: stats.added, color: token.colorSuccess, icon: <ArrowUpOutlined /> },
    { key: 'deleted', title: '删除', value: stats.deleted, color: token.colorError, icon: <ArrowDownOutlined /> },
    { key: 'updated', title: '修改', value: stats.updated, color: token.colorWarning, icon: <EditOutlined /> },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]}>
        {metrics.map((m) => (
          <Col key={m.key} xs={12} sm={12} md={6}>
            <Card styles={{ body: { padding: 16 } }}>
              <Statistic
                title={m.title}
                value={m.value}
                prefix={m.icon}
                valueStyle={{ color: m.color }}
              />
              {changed > 0 && (
                <Progress
                  percent={Math.round((m.value / changed) * 100)}
                  showInfo={false}
                  size="small"
                  strokeColor={m.color}
                  style={{ marginTop: 8, marginBottom: 0 }}
                />
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {changed > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: token.colorTextTertiary }}>
          共 {changed} 处变更，{dominantLabel}。
        </div>
      )}
    </div>
  );
};

export default OverviewView;
