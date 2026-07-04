import { useMemo } from 'react';
import { Table, Tag } from 'antd';

interface PotcarEntry {
  element: string;
  potcarType: string;
  enmax: number;
  enmin: number;
  zval: number;
  atomicMass: number;
  xcType: string;
}

function parsePotcar(content: string): PotcarEntry[] {
  const entries: PotcarEntry[] = [];
  // Split by "End of Dataset" or the VRHFIN/TITEL markers
  const sections = content.split(/End of Dataset/i);

  for (const section of sections) {
    if (!section.trim()) continue;

    const entry: Partial<PotcarEntry> = {};

    // VRHFIN = element info
    const vrhfinMatch = section.match(/VRHFIN\s*=\s*([A-Za-z]+)/);
    if (vrhfinMatch) entry.element = vrhfinMatch[1];

    // TITEL = PAW type
    const titelMatch = section.match(/TITEL\s*=\s*(.+)/);
    if (titelMatch) entry.potcarType = titelMatch[1].trim();

    // ENMAX / ENMIN
    const enmaxMatch = section.match(/ENMAX\s*=\s*([\d.]+)/);
    if (enmaxMatch) entry.enmax = parseFloat(enmaxMatch[1]);

    const enminMatch = section.match(/ENMIN\s*=\s*([\d.]+)/);
    if (enminMatch) entry.enmin = parseFloat(enminMatch[1]);

    // ZVAL
    const zvalMatch = section.match(/ZVAL\s*=\s*([\d.]+)/);
    if (zvalMatch) entry.zval = parseFloat(zvalMatch[1]);

    // POMASS
    const pomassMatch = section.match(/POMASS\s*=\s*([\d.]+)/);
    if (pomassMatch) entry.atomicMass = parseFloat(pomassMatch[1]);

    // LEXCH / exchange-correlation
    const lexchMatch = section.match(/LEXCH\s*=\s*([A-Za-z]+)/);
    if (lexchMatch) entry.xcType = lexchMatch[1];

    if (entry.element) entries.push(entry as PotcarEntry);
  }

  return entries;
}

interface Props {
  content: string;
}

export default function PotcarViewer({ content }: Props) {
  const entries = useMemo(() => parsePotcar(content), [content]);

  const columns = [
    {
      title: 'Element', dataIndex: 'element', key: 'element', width: 80,
      render: (v: string) => <Tag color="blue" style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: 'PAW Type', dataIndex: 'potcarType', key: 'potcarType',
      render: (v: string) => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{v || 'N/A'}</span>,
    },
    {
      title: 'ENMAX (eV)', dataIndex: 'enmax', key: 'enmax', width: 100,
      render: (v: number) => v ? v.toFixed(1) : '-',
    },
    {
      title: 'ENMIN (eV)', dataIndex: 'enmin', key: 'enmin', width: 100,
      render: (v: number) => v ? v.toFixed(1) : '-',
    },
    {
      title: 'ZVAL', dataIndex: 'zval', key: 'zval', width: 70,
      render: (v: number) => v ?? '-',
    },
    {
      title: 'Mass (amu)', dataIndex: 'atomicMass', key: 'mass', width: 90,
      render: (v: number) => v ? v.toFixed(2) : '-',
    },
    {
      title: 'XC', dataIndex: 'xcType', key: 'xc', width: 70,
      render: (v: string) => v ? <Tag>{v}</Tag> : '-',
    },
  ];

  // Find recommended ENCUT = max(ENMAX) * 1.3
  const maxEnmax = Math.max(...entries.map(e => e.enmax || 0));
  const recommendedEncut = maxEnmax > 0 ? Math.ceil(maxEnmax * 1.3) : null;

  return (
    <div style={{ padding: 12, overflow: 'auto' }}>
      {/* Summary */}
      {entries.length > 0 && (
        <div style={{
          padding: '8px 12px', background: '#12122a', borderRadius: 4, marginBottom: 12,
          display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <span style={{ fontSize: 10, color: '#888' }}>Elements: </span>
            <span style={{ fontSize: 12, color: '#e0e0e0', fontWeight: 600 }}>
              {entries.map(e => e.element).join(', ')}
            </span>
          </div>
          <div>
            <span style={{ fontSize: 10, color: '#888' }}>Total ZVAL: </span>
            <span style={{ fontSize: 12, color: '#e0e0e0' }}>
              {entries.reduce((sum, e) => sum + (e.zval || 0), 0).toFixed(1)}
            </span>
          </div>
          {recommendedEncut && (
            <div>
              <span style={{ fontSize: 10, color: '#888' }}>Recommended ENCUT: </span>
              <Tag color="orange">{recommendedEncut} eV</Tag>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <Table dataSource={entries} columns={columns} size="small" pagination={false}
        rowKey="element" locale={{ emptyText: 'No POTCAR data parsed' }} />

      <div style={{ marginTop: 12, fontSize: 10, color: '#666' }}>
        POTCAR summary — ENCUT should be ≥ 1.3 × max(ENMAX) for accurate calculations.
      </div>
    </div>
  );
}
