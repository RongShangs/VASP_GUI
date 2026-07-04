import { useState, useRef } from 'react';
import { Collapse, Tooltip, Button } from 'antd';
import { CaretRightOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import VersionInfo from './VersionInfo';
import ProcessStatus from './ProcessStatus';
import NodeLoad from './NodeLoad';
import ConnectionStatus from './ConnectionStatus';
import WorkDirDisplay from './WorkDirDisplay';
import MiniTerminal, { type MiniTerminalHandle } from './MiniTerminal';
import { useUIStore, useTerminalStore } from '../../store';
import { useT } from '../../i18n';

export default function LeftPanel() {
  const collapsed = useUIStore(s => s.leftPanelCollapsed);
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);
  const leftWide = useUIStore(s => s.leftPanelWide);
  const toggleLeftPanelWide = useUIStore(s => s.toggleLeftPanelWide);
  const [activeKeys, setActiveKeys] = useState<string[]>(['status', 'monitor', 'terminal']);
  const terminalRef = useRef<MiniTerminalHandle>(null);

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 14 }}>
        <Tooltip title={T('left.version')} placement="right"><span style={{ cursor: 'pointer', fontSize: 16 }}>⚛</span></Tooltip>
        <Tooltip title={T('left.process')} placement="right"><span style={{ cursor: 'pointer', fontSize: 16 }}>📊</span></Tooltip>
        <Tooltip title={T('left.load')} placement="right"><span style={{ cursor: 'pointer', fontSize: 16 }}>💻</span></Tooltip>
        <Tooltip title={T('left.connection')} placement="right"><span style={{ cursor: 'pointer', fontSize: 16 }}>🔌</span></Tooltip>
        <Tooltip title={T('left.terminal')} placement="right"><span style={{ cursor: 'pointer', fontSize: 16 }}>🖥</span></Tooltip>
      </div>
    );
  }

  const panelStyle: React.CSSProperties = {
    background: '#1a1a2e',
    border: 'none',
    borderRadius: 0,
    marginBottom: 0,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Status section */}
      <div style={{ flex: 'none', overflow: 'auto' }}>
        <Collapse
          ghost
          activeKey={activeKeys}
          onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys as string[] : [keys as string])}
          expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} style={{ fontSize: 10, color: '#666' }} />}
          style={{ background: 'transparent' }}
          items={[
            {
              key: 'status',
              label: (
                <span style={{ fontSize: 10, fontWeight: 600, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {T('left.connection')}
                </span>
              ),
              style: panelStyle,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <ConnectionStatus />
                  <VersionInfo />
                </div>
              ),
            },
            {
              key: 'monitor',
              label: (
                <span style={{ fontSize: 10, fontWeight: 600, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {T('left.load')}
                </span>
              ),
              style: panelStyle,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <NodeLoad />
                  <ProcessStatus />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Terminal section */}
      <div style={{ flex: 1, borderTop: '1px solid #2a2a4a', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 12px', background: '#16162a',
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
            {T('left.terminal')}
          </span>
          <Button
            type="text" size="small"
            icon={leftWide ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={toggleLeftPanelWide}
            style={{ color: '#888', fontSize: 11 }}
            title={leftWide ? 'Shrink terminal' : 'Expand terminal'}
          />
        </div>
        {/* Working directory display */}
        <WorkDirDisplay />
        {/* Terminal */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <MiniTerminal ref={terminalRef} />
        </div>
      </div>
    </div>
  );
}
