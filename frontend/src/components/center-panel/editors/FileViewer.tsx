import { Button, Space, Tooltip } from 'antd';
import {
  EditOutlined, SaveOutlined, CloseOutlined, DownloadOutlined,
  FileOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import IncarViewer from './IncarViewer';
import OszicarViewer from './OszicarViewer';
import PoscarViewer from './PoscarViewer';
import KpointsViewer from './KpointsViewer';
import OutcarViewer from './OutcarViewer';
import PotcarViewer from './PotcarViewer';
import StructureViewer from './StructureViewer';
import MonacoEditor from './MonacoEditor';
import { filesApi } from '../../../api/files';
import { useConnectionStore, useUIStore } from '../../../store';
import { useT } from '../../../i18n';
import { useState, useMemo } from 'react';

interface Props {
  fileType: string;
  filename: string;
  content: string;
  filePath: string;
  onContentChange: (v: string) => void;
  onSave: () => void;
  onDiscard: () => void;
}

export default function FileViewer({ fileType, filename, content, filePath, onContentChange, onSave, onDiscard }: Props) {
  const { connectedAlias } = useConnectionStore();
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);
  const [editing, setEditing] = useState(false);
  const [show3D, setShow3D] = useState(false);

  const handleDownload = async () => {
    if (!connectedAlias) return;
    try {
      await filesApi.download(connectedAlias, filePath, filename);
    } catch {
      // Fallback: try direct link
      const a = document.createElement('a');
      a.href = filesApi.downloadUrl(connectedAlias, filePath);
      a.download = filename;
      a.click();
    }
  };

  const renderViewer = () => {
    switch (fileType) {
      case 'incar':
        return <IncarViewer content={content} onChange={onContentChange} />;
      case 'oszicar':
        return <OszicarViewer content={content} />;
      case 'poscar':
        return show3D ? <StructureViewer content={content} /> : <PoscarViewer content={content} />;
      case 'kpoints':
        return <KpointsViewer content={content} />;
      case 'outcar':
        return <OutcarViewer content={content} />;
      case 'potcar':
        return <PotcarViewer content={content} />;
      default:
        return <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>{T('viewer.no_preview')}</div>;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* File info header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px',
        background: '#16162a', borderBottom: '1px solid #333', minHeight: 28,
      }}>
        <FileOutlined style={{ color: '#528bff' }} />
        <span style={{ color: '#e0e0e0', fontSize: 12, fontWeight: 500 }}>{filename}</span>
        <span style={{ color: '#666', fontSize: 10 }}>{(content.length / 1024).toFixed(1)} KB</span>
      </div>

      {/* Viewer area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {editing ? (
          <MonacoEditor
            value={content}
            language={fileType === 'incar' ? 'ini' : 'plaintext'}
            onChange={(v) => onContentChange(v || '')}
            onSave={() => { onSave(); setEditing(false); }}
          />
        ) : (
          renderViewer()
        )}
      </div>

      {/* Action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px',
        background: '#16162a', borderTop: '1px solid #333', minHeight: 32,
      }}>
        <Button size="small" icon={<EditOutlined />}
          onClick={() => setEditing(!editing)}
          type={editing ? 'primary' : 'default'}>
          {editing ? 'Viewer' : T('viewer.edit_source')}
        </Button>
        {fileType === 'poscar' && (
          <Button size="small" type={show3D ? 'primary' : 'default'}
            onClick={() => setShow3D(!show3D)}>
            {show3D ? '📊 Table' : '🔮 3D'}
          </Button>
        )}
        <Space style={{ marginLeft: 'auto' }}>
          <Button size="small" icon={<CloseOutlined />} onClick={onDiscard}>
            {T('viewer.discard')}
          </Button>
          <Button size="small" type="primary" icon={<SaveOutlined />} onClick={onSave}>
            {T('viewer.save')}
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload}>
            {T('viewer.download')}
          </Button>
        </Space>
      </div>
    </div>
  );
}
