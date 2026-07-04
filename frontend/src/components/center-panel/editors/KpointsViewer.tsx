import { useMemo } from 'react';
import { Descriptions, Table, Tag } from 'antd';

function parseKpoints(content: string) {
  const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('!'));
  if (lines.length < 4) return null;
  const comment = lines[0].trim();
  const numKpts = parseInt(lines[1]) || 0;
  const styleMap: Record<string, string> = { m: 'Monkhorst-Pack', g: 'Gamma-centered', a: 'Automatic', l: 'Line-mode' };
  const styleChar = lines[2].trim().toLowerCase();
  const style = styleMap[styleChar] || styleChar.toUpperCase();

  let grid: number[] = [];
  try { grid = lines[3].trim().split(/\s+/).map(Number); } catch {}

  let shift: number[] = [];
  if (lines.length > 4 && /^[tT.]/.test(lines[4].trim())) {
    try { shift = lines[4].trim().split(/\s+/).filter((x: string) => isNaN(Number(x)) ? false : true).map(Number); } catch {}
  }
  if (shift.length < 3) shift = [0, 0, 0];

  return { comment, numKpts, style, grid, shift };
}

interface Props {
  content: string;
}

export default function KpointsViewer({ content }: Props) {
  const data = useMemo(() => parseKpoints(content), [content]);

  if (!data) {
    return <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>Unable to parse KPOINTS</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto' }}>
      <Descriptions column={1} size="small" bordered
        labelStyle={{ color: '#888', fontSize: 11, width: 120 }}
        contentStyle={{ color: '#e0e0e0', fontSize: 11, fontFamily: 'monospace' }}
      >
        <Descriptions.Item label="Comment">{data.comment}</Descriptions.Item>
        <Descriptions.Item label="K-points">{data.numKpts || 'Automatic'}</Descriptions.Item>
        <Descriptions.Item label="Style">
          <Tag color={data.style === 'Gamma-centered' ? 'green' : data.style === 'Monkhorst-Pack' ? 'blue' : 'default'}>
            {data.style}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Grid">
          {data.grid[0] || 1} × {data.grid[1] || 1} × {data.grid[2] || 1}
        </Descriptions.Item>
        <Descriptions.Item label="Shift">
          [{data.shift.join(', ')}]
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: 16, padding: 12, background: '#12122a', borderRadius: 4 }}>
        <h4 style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>K-point Density Guide</h4>
        <Table
          dataSource={[
            { type: 'Very coarse', grid: '2×2×2', usage: 'Quick tests' },
            { type: 'Coarse', grid: '4×4×4', usage: 'Basic relaxations' },
            { type: 'Medium', grid: '6×6×6', usage: 'Standard SCF' },
            { type: 'Fine', grid: '8×8×8', usage: 'DOS / Accurate' },
            { type: 'Very fine', grid: '12×12×12', usage: 'Band structure prep' },
          ]}
          columns={[
            { title: 'Level', dataIndex: 'type', key: 'type', width: 100, render: (v: string) => <span style={{ fontSize: 11 }}>{v}</span> },
            { title: 'Grid', dataIndex: 'grid', key: 'grid', width: 120, render: (v: string) => <Tag>{v}</Tag> },
            { title: 'Usage', dataIndex: 'usage', key: 'usage', render: (v: string) => <span style={{ fontSize: 10, color: '#888' }}>{v}</span> },
          ]}
          size="small" pagination={false} rowKey="type"
        />
      </div>
    </div>
  );
}
