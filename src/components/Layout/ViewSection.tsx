import { Card, Empty, Spin, Alert, Button, App } from 'antd';
import { lazy, Suspense } from 'react';
import { useJsonStore } from '../../store/jsonStore';
import { useViewStore } from '../../store/viewStore';
import ViewSwitcher from '../ViewSwitcher';
import TreeView from '../Views/TreeView';
import OverviewView from '../Views/OverviewView';
import SideBySideView from '../Views/SideBySideView';
import CardView from '../Views/CardView';
import SummaryView from '../Views/SummaryView';
import { useIsStale } from '../../hooks/useDiffActions';

// 图形视图依赖 d3，按需加载以缩小首屏
const GraphView = lazy(() => import('../Views/GraphView'));

const ViewSection: React.FC = () => {
  const diffResult = useJsonStore((s) => s.diffResult);
  const runDiff = useJsonStore((s) => s.runDiff);
  const currentView = useViewStore((s) => s.currentView);
  const config = useViewStore((s) => s.config);
  const isStale = useIsStale();
  const { message } = App.useApp();

  const handleRerun = () => {
    const result = runDiff(config);
    if (result.ok) {
      message.success(`对比完成！发现 ${result.total} 处差异`);
    } else {
      message.error(result.error ?? '对比失败');
    }
  };

  if (!diffResult) {
    return (
      <Card style={{ margin: '0 16px 16px', flex: 1 }}>
        <Empty
          description={
            config.autoCompare
              ? '正在对比，或输入完整的 JSON 后自动开始'
              : '请输入 JSON 并点击对比按钮'
          }
          style={{ marginTop: 100 }}
        />
      </Card>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'overview':
        return <OverviewView />;
      case 'tree':
        return <TreeView />;
      case 'sidebyside':
        return <SideBySideView />;
      case 'card':
        return <CardView />;
      case 'graph':
        return (
          <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>}>
            <GraphView />
          </Suspense>
        );
      case 'summary':
        return <SummaryView />;
      default:
        return <TreeView />;
    }
  };

  return (
    <Card
      style={{
        margin: '0 16px 16px',
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        body: {
          padding: '12px',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <ViewSwitcher />

      {isStale && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message="输入或对比规则已变更，当前展示的不是最新结果"
          action={
            <Button size="small" type="primary" onClick={handleRerun}>
              重新对比
            </Button>
          }
        />
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', marginTop: 12 }}>
        {renderView()}
      </div>
    </Card>
  );
};

export default ViewSection;
