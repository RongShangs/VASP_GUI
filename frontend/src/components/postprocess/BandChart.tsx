import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import type { BandData } from '../../types/chart';

interface Props {
  data: BandData | null;
  loading: boolean;
  energyWindow?: [number, number];
}

export default function BandChart({ data, loading, energyWindow }: Props) {
  const option = useMemo(() => {
    if (!data?.bands?.length) {
      return {
        backgroundColor: 'transparent',
        title: { text: loading ? 'Loading...' : 'No band data', textStyle: { color: '#888', fontSize: 12 } },
      };
    }

    const nk = data.n_kpoints;
    const nbands = data.n_bands;
    const ef = data.e_fermi;

    // Build k-point x-axis labels
    const labels = data.kpath_labels || [];
    const kpointLabels: string[] = [];
    const kpointMarks: { xAxis: number; label: { show: boolean; formatter: string } }[] = [];

    for (let ik = 0; ik < nk; ik++) {
      kpointLabels.push('');
    }

    // Place high-symmetry labels at approximate positions
    if (labels.length > 0) {
      const perLabel = labels.length > 1 ? Math.floor(nk / (labels.length - 1)) : nk;
      for (let i = 0; i < labels.length; i++) {
        const pos = Math.min(i * perLabel, nk - 1);
        kpointMarks.push({
          xAxis: pos,
          label: { show: true, formatter: labels[i] || '?' },
        });
      }
    }

    // One series per band
    const series = [];
    const maxBands = Math.min(nbands, 50); // Limit for performance
    for (let ib = 0; ib < maxBands; ib++) {
      const band = data.bands[ib];
      if (!band || band.length === 0) continue;
      series.push({
        name: `Band ${ib + 1}`,
        type: 'line',
        data: band.map((e, ik) => [ik, e - ef]),
        smooth: false,
        symbol: 'none',
        lineStyle: { color: '#528bff', width: 1 },
      });
    }

    const yMin = energyWindow?.[0] ?? -8;
    const yMax = energyWindow?.[1] ?? 8;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `k-pt: ${p.data[0]}<br/>E − Eₐ: ${p.data[1].toFixed(4)} eV`;
        },
      },
      grid: { top: 10, right: 10, bottom: 40, left: 55 },
      xAxis: {
        type: 'value',
        name: 'k-point',
        nameTextStyle: { fontSize: 10, color: '#666' },
        axisLabel: { fontSize: 10, color: '#888' },
        min: 0,
        max: nk - 1,
        interval: 1,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'E − Eₐ (eV)',
        nameTextStyle: { fontSize: 10, color: '#666' },
        axisLabel: { fontSize: 10, color: '#888' },
        min: yMin,
        max: yMax,
      },
      series,
      markLine: kpointMarks.length > 0 ? {
        silent: true,
        symbol: 'none',
        lineStyle: { color: '#555', type: 'dashed', width: 1 },
        data: kpointMarks,
      } : undefined,
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'slider', xAxisIndex: 0, height: 16, bottom: 20 },
      ],
    };
  }, [data, loading, energyWindow]);

  return <ReactEChartsCore option={option} style={{ height: '100%', minHeight: 300 }} notMerge />;
}
