import { Tooltip } from 'antd';
import { useConnectionStore } from '../../store';

export default function VersionInfo() {
  const { vaspVersions } = useConnectionStore();

  return (
    <div style={{ padding: '6px 12px', borderBottom: '1px solid #222240' }}>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>VASP GUI v2.0.0</div>
      {vaspVersions.length > 0 ? (
        <div style={{ marginTop: 4 }}>
          {vaspVersions.map((v, i) => (
            <Tooltip key={i} title={v.path} placement="right">
              <div style={{ fontSize: 10, color: '#528bff', marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4caf50', display: 'inline-block', flexShrink: 0 }} />
                <span>{v.name}</span>
                <span style={{ color: '#555', fontSize: 9 }}>v{v.version}</span>
              </div>
            </Tooltip>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: '#555' }}>VASP not detected</div>
      )}
    </div>
  );
}
