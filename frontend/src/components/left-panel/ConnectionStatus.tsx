import { Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useConnectionStore, useUIStore } from '../../store';
import { useT } from '../../i18n';

export default function ConnectionStatus() {
  const { connectedAlias, connecting } = useConnectionStore();
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);
  const online = !!connectedAlias;

  return (
    <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222240' }}>
      <span style={{ fontSize: 11, color: '#aaa' }}>{T('left.connection')}</span>
      {connecting ? (
        <Tag color="processing" style={{ fontSize: 10, margin: 0 }}>{T('msg.connecting')}</Tag>
      ) : online ? (
        <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 10, margin: 0 }}>{connectedAlias}</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="default" style={{ fontSize: 10, margin: 0, color: '#888' }}>{T('left.disconnected')}</Tag>
      )}
    </div>
  );
}
