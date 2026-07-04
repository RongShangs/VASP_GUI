import { useMemo } from 'react';
import { Table } from 'antd';
import ReactEChartsCore from 'echarts-for-react';
import { useUIStore } from '../../../store';
import { useT } from '../../../i18n';

interface EnergyStep {
  step: number;
  energy: number;
  free_energy: number;
  temperature: number;
  delta_e: number;
  step_type: string;
}

// Parse OSZICAR using regex
function parseOszicar(content: string): EnergyStep[] {
  const pattern = /^\s*(\d+)\s+T=\s*([\d.]+)\s+E=\s*([\d.E+\-]+)\s+F=\s*([\d.E+\-]+)\s+E0=\s*([\d.E+\-]+)\s+EK=\s*([\d.E+\-]+)\s+SP=\s*([\d.E+\-]+)\s+SK=\s*([\d.E+\-]+)/gm;
  const steps: EnergyStep[] = [];
  let prevE: number | null = null;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const e = parseFloat(match[3]);
    steps.push({
      step: parseInt(match[1]),
      energy: e,
      free_energy: parseFloat(match[4]),
      temperature: parseFloat(match[2]),
      delta_e: prevE !== null ? e - prevE : 0,
      step_type: 'electronic',
    });
    prevE = e;
  }
  return steps;
}

interface Props {
  content: string;
}

export default function OszicarViewer({ content }: Props) {
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);
  const steps = useMemo(() => parseOszicar(content), [content]);

  const chartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    title: {
      text: T('viewer.energy_chart'),
      textStyle: { fontSize: 12, color: '#888' },
      left: 'center',
    },
    tooltip: { trigger: 'axis' as const },
    legend: {
      data: ['E (total)', 'F (free)', 'ΔE'],
      bottom: 0,
      textStyle: { fontSize: 10, color: '#888' },
    },
    grid: { top: 30, right: 20, bottom: 30, left: 60 },
    xAxis: {
      type: 'value' as const,
      name: T('viewer.step'),
      nameTextStyle: { fontSize: 10, color: '#666' },
      axisLabel: { fontSize: 10, color: '#888' },
    },
    yAxis: [
      {
        type: 'value' as const,
        name: T('viewer.energy'),
        nameTextStyle: { fontSize: 10, color: '#666' },
        axisLabel: { fontSize: 10, color: '#888' },
      },
      {
        type: 'value' as const,
        name: T('viewer.delta_e'),
        nameTextStyle: { fontSize: 10, color: '#666' },
        axisLabel: { fontSize: 10, color: '#888' },
      },
    ],
    series: [
      {
        name: 'E (total)',
        type: 'line' as const,
        data: steps.map(s => [s.step, s.energy]),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#528bff', width: 1.5 },
      },
      {
        name: 'F (free)',
        type: 'line' as const,
        data: steps.map(s => [s.step, s.free_energy]),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#4caf50', width: 1 },
      },
      {
        name: 'ΔE',
        type: 'line' as const,
        yAxisIndex: 1,
        data: steps.map(s => [s.step, Math.abs(s.delta_e)]),
        smooth: false,
        symbol: 'none',
        lineStyle: { color: '#ff9800', width: 0.8, type: 'dashed' as const },
      },
    ],
  }), [steps, T]);

  const columns = [
    { title: T('viewer.step'), dataIndex: 'step', key: 'step', width: 60 },
    {
      title: 'E (eV)', dataIndex: 'energy', key: 'energy',
      render: (v: number) => v.toFixed(8),
    },
    {
      title: 'F (eV)', dataIndex: 'free_energy', key: 'free_energy',
      render: (v: number) => v.toFixed(8),
    },
    {
      title: 'T (K)', dataIndex: 'temperature', key: 'temperature',
      render: (v: number) => v.toFixed(1),
    },
    {
      title: T('viewer.delta_e'), dataIndex: 'delta_e', key: 'delta_e',
      render: (v: number) => (
        <span style={{ color: Math.abs(v) < 1e-4 ? '#4caf50' : '#ff9800' }}>
          {v.toExponential(4)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Chart */}
      <div style={{ height: 220, minHeight: 200, borderBottom: '1px solid #2a2a4a' }}>
        {steps.length > 0 ? (
          <ReactEChartsCore option={chartOption} style={{ height: '100%' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555' }}>
            No energy data found in OSZICAR
          </div>
        )}
      </div>
      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '4px 12px', fontSize: 10, color: '#666' }}>
          {T('viewer.energy_table')} — {steps.length} steps
        </div>
        <Table
          dataSource={steps}
          columns={columns}
          rowKey="step"
          size="small"
          pagination={{ pageSize: 50, size: 'small' }}
        />
      </div>
    </div>
  );
}
