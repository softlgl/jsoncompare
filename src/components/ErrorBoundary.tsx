import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 顶层错误边界：任何视图渲染抛错时降级为可恢复的提示页，
 * 而不是整棵 React 树卸载导致的白屏。
 * 「重试」清空错误重新渲染（适用于一次性渲染异常，如某份输入触发的 bug）；
 * 「刷新」应对需要重置全部运行时状态的场景。
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 保留控制台线索，方便从浏览器 DevTools 定位
    console.error('UI 渲染异常:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <Result
          status="error"
          title="界面渲染出错"
          subTitle={error.message || '未知错误，可尝试重试或刷新页面'}
          style={{ marginTop: 48 }}
          extra={[
            <Button key="retry" onClick={() => this.setState({ error: null })}>
              重试
            </Button>,
            <Button key="reload" type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>,
          ]}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
