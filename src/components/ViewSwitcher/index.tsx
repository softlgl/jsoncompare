import { Badge, Space, Button, Tooltip } from 'antd';
import { 
  DashboardOutlined, 
  BranchesOutlined, 
  ColumnWidthOutlined,
  AppstoreOutlined,
  ShareAltOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useMemo } from 'react';
import { useJsonStore } from '../../store/jsonStore';
import { useViewStore } from '../../store/viewStore';
import { flattenDiff } from '../../utils/diffEngine';
import type { ViewType } from '../../types';

const views: Array<{ type: ViewType; label: string; icon: any }> = [
  { type: 'overview', label: '概览', icon: DashboardOutlined },
  { type: 'tree', label: '树形', icon: BranchesOutlined },
  { type: 'sidebyside', label: '并排', icon: ColumnWidthOutlined },
  { type: 'card', label: '卡片', icon: AppstoreOutlined },
  { type: 'graph', label: '图形', icon: ShareAltOutlined },
  { type: 'summary', label: '摘要', icon: FileTextOutlined },
];

// 图形视图按顶层路径的可视化块数展示，其余视图展示差异总数
function categoryCount(paths: string[]): number {
  const set = new Set<string>();
  paths.forEach((p) => set.add(p.split(/[.[\]]/).filter(Boolean)[0] ?? p));
  return set.size;
}

const ViewSwitcher: React.FC = () => {
  const { currentView, setCurrentView } = useViewStore();
  const { diffResult } = useJsonStore();

  const counts = useMemo(() => {
    if (!diffResult) return {} as Record<ViewType, number>;
    const items = flattenDiff(diffResult);
    const paths = items.map((i) => i.path);
    const total = diffResult.statistics?.total ?? paths.length;
    return {
      overview: total,
      tree: total,
      sidebyside: total,
      card: total,
      graph: categoryCount(paths),
      summary: total,
    };
  }, [diffResult]);

  return (
    <Space wrap>
      {views.map(({ type, label, icon: Icon }) => {
        const count = diffResult ? counts[type] : 0;
        const badge = count > 0 ? (
          <Badge count={count} overflowCount={999} size="small" />
        ) : undefined;
        return (
          <Tooltip key={type} title={count > 0 ? `${label}（${count} 处差异）` : label}>
            <Button
              type={currentView === type ? 'primary' : 'default'}
              icon={<Icon />}
              onClick={() => setCurrentView(type)}
            >
              <Space size={4}>
                {label}
                {badge}
              </Space>
            </Button>
          </Tooltip>
        );
      })}
    </Space>
  );
};

export default ViewSwitcher;
