import { lazy, Suspense } from 'react';
import { Layout, Card, Skeleton } from 'antd';
import Header from './Header';
import ViewSection from './ViewSection';
import { useAutoCompare } from '../../hooks/useDiffActions';
import { useViewStore } from '../../store/viewStore';

const InputSection = lazy(() => import('./InputSection'));
const BeautifyView = lazy(() => import('../Beautify/BeautifyView'));

const { Content } = Layout;

const MainLayout: React.FC = () => {
  // 输入或对比规则变化后自动重算，全局只需挂载一次
  useAutoCompare();
  const mode = useViewStore((s) => s.mode);

  return (
    <Layout style={{ height: '100vh' }}>
      <Header />
      <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {mode === 'beautify' ? (
          <Suspense
            fallback={
              <Card style={{ margin: '16px' }}>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            }
          >
            <BeautifyView />
          </Suspense>
        ) : (
          <>
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
          </>
        )}
      </Content>
    </Layout>
  );
};

export default MainLayout;
