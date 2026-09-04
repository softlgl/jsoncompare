import { lazy, Suspense } from 'react';
import { Layout, Card, Skeleton } from 'antd';
import Header from './Header';
import ViewSection from './ViewSection';
import { useAutoCompare } from '../../hooks/useDiffActions';

const InputSection = lazy(() => import('./InputSection'));

const { Content } = Layout;

const MainLayout: React.FC = () => {
  // 输入或对比规则变化后自动重算，全局只需挂载一次
  useAutoCompare();

  return (
    <Layout style={{ height: '100vh' }}>
      <Header />
      <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Suspense
          fallback={
            <Card style={{ margin: '16px' }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          }
        >
          <InputSection />
        </Suspense>
        <ViewSection />
      </Content>
    </Layout>
  );
};

export default MainLayout;
