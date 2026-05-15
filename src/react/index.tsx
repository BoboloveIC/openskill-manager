import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import { LanguageProvider } from './i18n';
import { ThemeProvider } from './context/ThemeContext';

// React 错误边界：捕获渲染错误，防止空白屏
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40, color: '#f44336', background: '#1a1a2e',
          minHeight: '100vh', fontFamily: 'monospace'
        }}>
          <h1>⚠️ 应用渲染错误</h1>
          <p>React 组件渲染时发生错误，错误信息：</p>
          <pre style={{
            background: '#222', padding: 16, borderRadius: 8,
            overflow: 'auto', color: '#ff8a80', marginTop: 16
          }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 20, padding: '10px 20px', cursor: 'pointer',
              background: '#333', color: 'white', border: '1px solid #555', borderRadius: 6
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
