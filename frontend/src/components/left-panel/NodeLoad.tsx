import { useState, useEffect } from 'react';
import { Progress } from 'antd';
import { useConnectionStore, useUIStore } from '../../store';

function parseSize(s: string): number {
  s = s.trim().toUpperCase();
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  if (s.includes('TI')) return num * 1024;
  if (s.includes('GI')) return num;
  if (s.includes('MI')) return num / 1024;
  if (s.includes('KI')) return num / 1048576;
  if (s.includes('G')) return num;
  if (s.includes('M')) return num / 1024;
  if (s.includes('K')) return num / 1048576;
  if (s.includes('B')) return num / 1073741824;
  return num / 1048576;
}

export default function NodeLoad() {
  const { connectedAlias } = useConnectionStore();
  const [cpu, setCpu] = useState<number>(0);
  const [mem, setMem] = useState<{ used: string; total: string; pct: number }>({ used: '-', total: '-', pct: 0 });
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!connectedAlias) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status/nodes/' + connectedAlias, {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('access_token') }
        });
        if (!res.ok) { setError(true); return; }
        const data = await res.json();
        setError(false);
        const cpuMatch = data.cpu?.match(/(\d+\.?\d*)\s*%/);
        if (cpuMatch) setCpu(Math.min(100, parseFloat(cpuMatch[1])));
        const lines = (data.memory || '').split('\n');
        for (const line of lines) {
          const m = line.match(/Mem:\s+(\S+)\s+(\S+)\s+(\S+)/);
          if (m) {
            const total = parseSize(m[1]);
            const used = parseSize(m[2]);
            setMem({ used: m[2], total: m[1], pct: total > 0 ? (used / total) * 100 : 0 });
            break;
          }
        }
      } catch { setError(true); }
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [connectedAlias]);

  const cpuColor = cpu > 80 ? '#f44336' : cpu > 50 ? '#faad14' : '#528bff';
  const memColor = mem.pct > 80 ? '#f44336' : mem.pct > 50 ? '#faad14' : '#4caf50';

  return (
    <div style={{ padding: '6px 12px', borderBottom: '1px solid #222240' }}>
      {error ? (
        <div style={{ fontSize: 10, color: '#f44336' }}>Unable to fetch</div>
      ) : (
        <>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#888' }}>CPU</span>
              <span style={{ fontSize: 10, color: cpuColor, fontWeight: 600 }}>{cpu.toFixed(0)}%</span>
            </div>
            <Progress percent={cpu} size="small" strokeColor={cpuColor} showInfo={false}
              trailColor="#2a2a4a" strokeWidth={4} style={{ marginBottom: 0 }} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#888' }}>MEM</span>
              <span style={{ fontSize: 10, color: '#aaa' }}>{mem.used}/{mem.total}</span>
            </div>
            <Progress percent={Math.min(100, mem.pct)} size="small" strokeColor={memColor} showInfo={false}
              trailColor="#2a2a4a" strokeWidth={4} />
          </div>
        </>
      )}
    </div>
  );
}
