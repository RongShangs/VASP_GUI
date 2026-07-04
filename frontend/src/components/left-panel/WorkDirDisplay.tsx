import { Tooltip, Typography } from 'antd';
import { FolderOutlined, CopyOutlined } from '@ant-design/icons';
import { useConnectionStore, useUIStore } from '../../store';
import { useT } from '../../i18n';
import { message } from 'antd';

export default function WorkDirDisplay() {
  const { currentCwd, workDir, connectedAlias } = useConnectionStore();
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);

  if (!connectedAlias) return null;

  // Show terminal-detected CWD if available, otherwise workDir
  const displayPath = currentCwd !== '/' ? currentCwd : workDir || '/';

  const copyPath = () => {
    navigator.clipboard.writeText(displayPath).then(() => {
      message.success(T('file.copied'));
    }).catch(() => {});
  };

  // Truncate for display (show last 3 segments)
  const parts = displayPath.split('/').filter(Boolean);
  const shortPath = parts.length > 3
    ? '…/' + parts.slice(-2).join('/')
    : displayPath;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', background: '#0a0a1e',
      borderBottom: '1px solid #2a2a4a', minHeight: 26,
    }}>
      <FolderOutlined style={{ color: '#528bff', fontSize: 11 }} />
      <Tooltip title={displayPath} placement="bottom">
        <Typography.Text
          style={{
            color: '#ccc', fontSize: 11, fontFamily: 'monospace',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            cursor: 'default',
          }}
        >
          <span style={{ color: '#666', fontSize: 10 }}>{T('terminal.cwd_label')}: </span>
          {shortPath}
        </Typography.Text>
      </Tooltip>
      <Tooltip title="Copy full path">
        <CopyOutlined
          style={{ color: '#666', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}
          onClick={copyPath}
        />
      </Tooltip>
    </div>
  );
}
