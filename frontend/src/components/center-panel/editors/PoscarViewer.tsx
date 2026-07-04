import { useMemo } from 'react';
import { Descriptions, Table, Tag } from 'antd';

function parsePoscar(content: string) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 7) return null;
  const comment = lines[0].trim();
  const scale = parseFloat(lines[1]) || 1.0;
  const lattice = [];
  for (let i = 2; i < 5; i++) {
    try {
      lattice.push(lines[i].trim().split(/\s+/).map(Number));
    } catch { lattice.push([0, 0, 0]); }
  }
  const elements = lines[5].trim().split(/\s+/);
  const counts = lines[6].trim().split(/\s+/).map(Number);
  const totalAtoms = counts.reduce((a, b) => a + b, 0);

  let coordType = 'Direct';
  let coordStart = 7;
  if (lines[7] && /^[sS]/.test(lines[7].trim())) coordStart = 8;
  if (lines[coordStart] && /^[a-zA-Z]/.test(lines[coordStart].trim()) && !/\d/.test(lines[coordStart].trim())) {
    const t = lines[coordStart].trim().toLowerCase();
    coordType = t.startsWith('c') || t.startsWith('k') ? 'Cartesian' : 'Direct';
    coordStart++;
  }

  const coords: number[][] = [];
  for (let i = coordStart; i < Math.min(coordStart + totalAtoms, lines.length); i++) {
    try {
      const c = lines[i].trim().split(/\s+/).map(Number);
      if (c.length >= 3) coords.push(c.slice(0, 3));
    } catch {}
  }

  // Build atom list with element labels
  const atoms: { index: number; element: string; x: number; y: number; z: number }[] = [];
  let idx = 0;
  for (let e = 0; e < elements.length; e++) {
    for (let c = 0; c < (counts[e] || 0); c++) {
      if (idx < coords.length) {
        atoms.push({ index: idx + 1, element: elements[e], x: coords[idx][0], y: coords[idx][1], z: coords[idx][2] });
      }
      idx++;
    }
  }

  return { comment, scale, lattice, elements, counts, totalAtoms, coordType, atoms };
}

interface Props {
  content: string;
}

export default function PoscarViewer({ content }: Props) {
  const data = useMemo(() => parsePoscar(content), [content]);

  if (!data) {
    return <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>Unable to parse POSCAR</div>;
  }

  const latticeColumns = [
    { title: '', dataIndex: 'axis', key: 'axis', width: 30, render: (v: string) => <span style={{ color: '#528bff' }}>{v}</span> },
    { title: 'a', dataIndex: 'a', key: 'a', render: (v: number) => v.toFixed(6) },
    { title: 'b', dataIndex: 'b', key: 'b', render: (v: number) => v.toFixed(6) },
    { title: 'c', dataIndex: 'c', key: 'c', render: (v: number) => v.toFixed(6) },
  ];

  const latticeData = data.lattice.map((v, i) => ({
    axis: String.fromCharCode(65 + i),
    a: v[0], b: v[1], c: v[2],
  }));

  const atomColumns = [
    { title: '#', dataIndex: 'index', key: 'index', width: 40 },
    { title: 'Element', dataIndex: 'element', key: 'element', width: 70,
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'X', dataIndex: 'x', key: 'x', render: (v: number) => v.toFixed(8) },
    { title: 'Y', dataIndex: 'y', key: 'y', render: (v: number) => v.toFixed(8) },
    { title: 'Z', dataIndex: 'z', key: 'z', render: (v: number) => v.toFixed(8) },
  ];

  return (
    <div style={{ padding: 12, overflow: 'auto' }}>
      <Descriptions column={2} size="small" bordered
        labelStyle={{ color: '#888', fontSize: 11 }}
        contentStyle={{ color: '#e0e0e0', fontSize: 11, fontFamily: 'monospace' }}
      >
        <Descriptions.Item label="Comment">{data.comment}</Descriptions.Item>
        <Descriptions.Item label="Scale">{data.scale}</Descriptions.Item>
        <Descriptions.Item label="Elements">{data.elements.join(', ')}</Descriptions.Item>
        <Descriptions.Item label="Counts">{data.counts.join(', ')}</Descriptions.Item>
        <Descriptions.Item label="Total Atoms">{data.totalAtoms}</Descriptions.Item>
        <Descriptions.Item label="Coord Type">{data.coordType}</Descriptions.Item>
      </Descriptions>

      <h4 style={{ fontSize: 11, color: '#888', margin: '12px 0 4px' }}>Lattice Vectors (Å)</h4>
      <Table dataSource={latticeData} columns={latticeColumns} size="small" pagination={false} rowKey="axis" />

      <h4 style={{ fontSize: 11, color: '#888', margin: '12px 0 4px' }}>Atomic Coordinates ({data.coordType})</h4>
      <Table dataSource={data.atoms} columns={atomColumns} size="small" pagination={false} rowKey="index"
        scroll={{ y: 300 }} />
    </div>
  );
}
