import { useEffect, useState } from 'react';
import { Button, Select, message } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useUIStore, useAuthStore, useConnectionStore } from '../../store';
import { serversApi } from '../../api/servers';
import { useT } from '../../i18n';
import SettingsPage from '../dialogs/SettingsPage';

export default function Header() {
  const { lang, leftPanelCollapsed, toggleLeftPanel, rightPanelCollapsed, toggleRightPanel } = useUIStore();
  const { username, logout } = useAuthStore();
  const { servers, connectedAlias, connecting, autoConnecting, connect, disconnect, setServers, autoConnect } = useConnectionStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serversLoaded, setServersLoaded] = useState(false);
  const T = useT(lang);

  // Load servers on mount, then try auto-connect
  useEffect(() => {
    serversApi.list()
      .then(r => {
        setServers(r.data);
        setServersLoaded(true);
      })
      .catch(() => { setServersLoaded(true); });
  }, []);

  // Auto-connect after servers are loaded (runs once)
  useEffect(() => {
    if (serversLoaded && !connectedAlias && !connecting && !autoConnecting) {
      autoConnect().then(ok => {
        if (!ok && useConnectionStore.getState().connectError) {
          // Silently fail — user can connect manually
        }
      });
    }
  }, [serversLoaded]);

  const handleServerChange = async (alias: string) => {
    if (!alias) {
      disconnect();
      return;
    }
    const ok = await connect(alias);
    if (!ok) {
      const err = useConnectionStore.getState().connectError;
      message.error(err || T('msg.connect_failed'));
    }
  };

  return (
    <>
      <div className="vasp-header">
        <div className="vasp-header-left">
          <Button type="text" size="small" icon={leftPanelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleLeftPanel} style={{ color: '#888' }} />
          <span style={{ color: '#e0e0e0', fontWeight: 600 }}>VASP GUI</span>
        </div>
        <div className="vasp-header-right">
          <Select size="small" placeholder={autoConnecting ? '⏳ Reconnecting...' : T('header.select_server')} style={{ width: 160 }}
            value={connectedAlias || undefined} onChange={handleServerChange} loading={connecting || autoConnecting}
            allowClear onClear={() => disconnect()}
            notFoundContent={<span style={{ fontSize: 11, color: '#888' }}>{T('settings.add_server')} — {T('header.settings')}</span>}
            options={servers.map(s => ({ label: s.alias, value: s.alias }))} />
          <Button type="text" size="small" icon={rightPanelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleRightPanel} style={{ color: '#888' }} />
          <Button type="text" size="small" icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)} style={{ color: '#888' }} title={T('header.settings')} />
          <span style={{ color: '#888', fontSize: 12 }}>{username || 'admin'}</span>
          <Button type="text" size="small" onClick={logout} style={{ color: '#888' }}>{T('header.logout')}</Button>
        </div>
      </div>
      <SettingsPage open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
