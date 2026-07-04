import { useEffect, useMemo } from 'react';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { useUIStore, useAuthStore } from './store';
import { darkTheme } from './styles/theme';
import MainLayout from './components/layout/MainLayout';
import LoginModal from './components/dialogs/LoginModal';

const antdLocales = { zh: zhCN, en: enUS };

export default function App() {
  const lang = useUIStore(s => s.lang);
  const { isLoggedIn, loading, requirePassword, checkAuth, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();
    const handleLogout = () => logout();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const locale = useMemo(() => antdLocales[lang] || zhCN, [lang]);

  if (loading) {
    return (
      <ConfigProvider theme={darkTheme} locale={locale}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0a0a1a' }}>
          <Spin size="large" />
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={darkTheme} locale={locale}>
      {isLoggedIn ? <MainLayout /> : (requirePassword ? <LoginModal /> : <MainLayout />)}
    </ConfigProvider>
  );
}
