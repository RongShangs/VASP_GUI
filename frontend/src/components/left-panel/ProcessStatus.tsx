import { useState, useEffect } from 'react';
import { Tag } from 'antd';
import { useConnectionStore, useUIStore } from '../../store';
import { useT } from '../../i18n';

export default function ProcessStatus() {
  const { connectedAlias } = useConnectionStore();
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);
  const [procs, setProcs] = useState<string>('');

  useEffect(() => {
    if (!connectedAlias) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/processes/${connectedAlias}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
        });
        const data = await res.json();
        setProcs(data.processes || '');
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(timer);
  }, [connectedAlias]);

  const hasVasp = procs && procs !== 'none' && procs.includes('vasp');
  const lineCount = procs && procs !== 'none' ? procs.split('\n').filter(Boolean).length : 0;

  return (
    <div style={{ padding: '6px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#aaa' }}>{T('left.process')}</span>
        <Tag color={hasVasp ? 'success' : 'default'} style={{ fontSize: 10, margin: 0 }}>
          {hasVasp ? `${lineCount} VASP` : 'Idle'}
        </Tag>
      </div>
      {hasVasp && (
        <pre style={{
          fontSize: 9, color: '#666', marginTop: 4, marginBottom: 0,
          maxHeight: 80, overflow: 'auto', background: '#0d0d1a',
          padding: '4px 6px', borderRadius: 4, lineHeight: 1.4,
        }}>
          {procs}
        </pre>
      )}
    </div>
  );
}
