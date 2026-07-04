import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import type { DOSData } from '../../types/chart';

interface Props {
  data: DOSData | null;
  loading: boolean;
  energyWindow?: [number, number];
}

const COLORS = ['#528bff', '#4caf50', '#ff9800', '#e91e63', '#9c27b0',
  '#00bcd4', '#ff5722', '#795548', '#607d8b', '#cddc39'];

export default function DosChart({ data, loading, energyWindow }: Props) {
  const option = useMemo(() => {
    if (!data?.tdos?.length) {
      return {
        backgroundColor: 'transparent',
        title: { text: loading ? 'Loading...' : 'No DOS data', textStyle: { color: '#888', fontSize: 12 } },
      };
    }

    const series: any[] = [];
    const energies = data.tdos.map(d => d.energy - data.e_fermi);

    // TDOS (filled area)
    series.push({
      name: 'TDOS ↑',
      type: 'line',
      data: energies.map((e, i) => [e, data.tdos[i].dos_up]),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#528bff', width: 1.5 },
      areaStyle: { color: 'rgba(82, 139, 255, 0.15)' },
    });

    if (data.tdos.some(d => d.dos_down !== 0)) {
      series.push({
        name: 'TDOS ↓',
        type: 'line',
        data: energies.map((e, i) => [e, -data.tdos[i].dos_down]),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#ff5252', width: 1.5 },
        areaStyle: { color: 'rgba(255, 82, 82, 0.15)' },
      });
    }

    // PDOS per ion (first 5 ions for readability)
    if (data.pdos?.length) {
      data.pdos.slice(0, 5).forEach((ionPdos, ionIdx) => {
        if (!ionPdos?.length) return;
        const color = COLORS[ionIdx % COLORS.length];
        // Sum all orbitals for this ion
        const p = ionPdos.map(row => {
          let sum = 0;
          for (const key of Object.keys(row)) {
            if (key !== 'energy' && !key.endsWith('_down') && typeof row[key] === 'number') {
              sum += row[key] as number;
            }
          }
          return sum;
        });
        series.push({
          name: `Ion ${ionIdx + 1}`,
          type: 'line',
          data: energies.slice(0, p.length).map((e, i) => [e, p[i]]),
          smooth: true,
          symbol: 'none',
          lineStyle: { color, width: 1, type: 'dashed' },
        });
      });
    }

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: {
        data: series.map(s => s.name),
        bottom: 0,
        textStyle: { fontSize: 10, color: '#888' },
      },
      grid: { top: 20, right: 10, bottom: 40, left: 55 },
      xAxis: {
        type: 'value',
        name: 'E − Eₐ (eV)',
        nameTextStyle: { fontSize: 10, color: '#666' },
        axisLabel: { fontSize: 10, color: '#888' },
        min: energyWindow?.[0] ?? 'dataMin',
        max: energyWindow?.[1] ?? 'dataMax',
      },
      yAxis: {
        type: 'value',
        name: 'DOS (states/eV)',
        nameTextStyle: { fontSize: 10, color: '#666' },
        axisLabel: { fontSize: 10, color: '#888' },
      },
      series,
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'slider', xAxisIndex: 0, height: 16, bottom: 20 },
      ],
    };
  }, [data, loading, energyWindow]);

  return <ReactEChartsCore option={option} style={{ height: '100%', minHeight: 300 }} notMerge />;
}
