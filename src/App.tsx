import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './components/Layout/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { useViewStore } from './store/viewStore';

/**
 * 把 antd token 同步到 document，避免暗色模式下
 * 页面底色、滚动条与表单控件仍是亮色。
 */
function ThemeBridge({ children }: { children: ReactNode }) {
  const config = useViewStore((s) => s.config);
  const { token } = antdTheme.useToken();
  const isDark = config.theme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = isDark ? 'dark' : 'light';
    // 供 Monaco decoration 等全局 CSS 使用的暗色标记
    root.classList.toggle('app-dark', isDark);
    document.body.style.backgroundColor = token.colorBgLayout;
    document.body.style.color = token.colorText;
  }, [isDark, token]);

  return <>{children}</>;
}

function App() {
  const isDark = useViewStore((s) => s.config.theme) === 'dark';

  return (
    <ErrorBoundary>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        }}
      >
        <AntdApp>
          <ThemeBridge>
            <MainLayout />
          </ThemeBridge>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
