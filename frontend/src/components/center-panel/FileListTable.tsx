import { Spin } from 'antd';
import { FolderOutlined, FileOutlined, ArrowUpOutlined } from '@ant-design/icons';
import FileContextMenu from './FileContextMenu';
import type { FileNode } from '../../types/files';

interface Props {
  files: FileNode[];
  loading: boolean;
  onFileClick: (file: FileNode) => void;
  selectedPath: string | null;
  onNavigateUp: () => void;
  currentPath: string;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
}

export default function FileListTable({ files, loading, onFileClick, selectedPath, currentPath, onRefresh, onNavigate, onNavigateUp }: Props) {
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* Parent directory */}
      <div className="file-row" onClick={onNavigateUp} style={{ borderBottom: '1px solid #2a2a4a', color: '#888' }}>
        <ArrowUpOutlined /> ..
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
      ) : (
        files.map(f => (
          <FileContextMenu
            key={f.path}
            file={f}
            currentPath={currentPath}
            onRefresh={onRefresh}
            onNavigate={onNavigate}
          >
            <div
              className={`file-row${selectedPath === f.path ? ' selected' : ''}`}
              onClick={() => onFileClick(f)}
              onDoubleClick={() => onFileClick(f)}
              onContextMenu={(e) => {
                // Let the Dropdown handle it; also highlight the file
                e.preventDefault();
              }}
            >
              {f.type === 'dir' ? <FolderOutlined style={{ color: '#528bff' }} /> : <FileOutlined style={{ color: '#888' }} />}
              <span style={{ flex: 1 }}>{f.name}</span>
              {f.type === 'file' && <span style={{ fontSize: 10, color: '#555' }}>{formatSize(f.size)}</span>}
            </div>
          </FileContextMenu>
        ))
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}M`;
  return `${(bytes / 1073741824).toFixed(1)}G`;
}
