import { useState, useEffect, useCallback } from 'react';
import { Tabs, Select, Button, Space, Spin, message, Slider, Empty } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useConnectionStore, useJobStore, useUIStore } from '../../store';
import { jobsApi } from '../../api/jobs';
import { postprocessApi } from '../../api/postprocess';
import { useT } from '../../i18n';
import DosChart from './DosChart';
import BandChart from './BandChart';
import ReactEChartsCore from 'echarts-for-react';
import type { DOSData, BandData, EnergyData, OpticalData } from '../../types/chart';
import type { JobInfo } from '../../types/job';

export default function PostProcessPage() {
  const [activeTab, setActiveTab] = useState('dos');
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [dosData, setDosData] = useState<DOSData | null>(null);
  const [bandData, setBandData] = useState<BandData | null>(null);
  const [energyData, setEnergyData] = useState<EnergyData | null>(null);
  const [opticalData, setOpticalData] = useState<OpticalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [energyWindow, setEnergyWindow] = useState<[number, number]>([-5, 5]);

  const connectedAlias = useConnectionStore(s => s.connectedAlias);
  const activeJob = useJobStore(s => s.activeJob);
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);

  // Load job history
  useEffect(() => {
    jobsApi.list(1, 50).then(r => {
      const finished = r.data.filter(j => j.status === 'finished' || j.status === 'running');
      setJobs(finished);
      // Auto-select active job if applicable
      if (activeJob?.job_id && finished.find(j => j.job_id === activeJob.job_id)) {
        setSelectedJobId(activeJob.job_id);
      }
    }).catch(() => {});
  }, []);

  const selectedJob = jobs.find(j => j.job_id === selectedJobId);

  const loadData = useCallback(async () => {
    if (!selectedJob?.project_path || !connectedAlias) {
      message.warning('Please connect to server and select a job');
      return;
    }
    setLoading(true);
    try {
      if (activeTab === 'dos') {
        const r = await postprocessApi.dos(connectedAlias, selectedJob.project_path);
        setDosData(r.data.data);
      } else if (activeTab === 'band') {
        const r = await postprocessApi.band(connectedAlias, selectedJob.project_path);
        setBandData(r.data.data);
      } else if (activeTab === 'energy') {
        const r = await postprocessApi.energy(connectedAlias, selectedJob.project_path);
        setEnergyData(r.data.data);
      } else if (activeTab === 'optical') {
        const r = await postprocessApi.optical(connectedAlias, selectedJob.project_path);
        setOpticalData(r.data.data);
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed to load data');
    }
    setLoading(false);
  }, [activeTab, selectedJob, connectedAlias]);

  // Auto-load when tab or job changes
  useEffect(() => {
    if (selectedJobId) loadData();
  }, [activeTab, selectedJobId]);

  const handleExport = async (format: string) => {
    if (!selectedJob?.project_path || !connectedAlias) return;
    try {
      const r = await postprocessApi.exportData(
        connectedAlias, selectedJob.project_path, format, activeTab
      );
      if (r.data.format === 'csv' && typeof r.data.data === 'string') {
        const blob = new Blob([r.data.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeTab}_${selectedJob.calc_type}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      message.success(`Exported as ${format.toUpperCase()}`);
    } catch (e: any) {
      message.error('Export failed');
    }
  };

  // Energy convergence chart option
  const energyChartOption = energyData ? {
    backgroundColor: 'transparent',
    grid: { top: 10, right: 50, bottom: 20, left: 60 },
    legend: { data: ['E0', 'F', 'ΔE'], bottom: 0, textStyle: { fontSize: 10, color: '#888' } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'value', name: 'Step', nameTextStyle: { fontSize: 10, color: '#666' },
      axisLabel: { fontSize: 10, color: '#888' },
    },
    yAxis: [
      { type: 'value', name: 'Energy (eV)', nameTextStyle: { fontSize: 10, color: '#666' }, axisLabel: { fontSize: 10, color: '#888' } },
      { type: 'value', name: 'ΔE (eV)', nameTextStyle: { fontSize: 10, color: '#666' }, axisLabel: { fontSize: 10, color: '#888' } },
    ],
    series: [
      {
        name: 'E0', type: 'line',
        data: energyData.steps.map((s, i) => [i, s.energy]),
        smooth: true, symbol: 'none', lineStyle: { color: '#528bff', width: 1.5 },
      },
      {
        name: 'F', type: 'line',
        data: energyData.steps.map((s, i) => [i, s.free_energy]),
        smooth: true, symbol: 'none', lineStyle: { color: '#4caf50', width: 1 },
      },
      {
        name: 'ΔE', type: 'line', yAxisIndex: 1,
        data: energyData.steps.map((s, i) => [i, s.delta_e]),
        smooth: false, symbol: 'none', lineStyle: { color: '#ff9800', width: 0.8, type: 'dashed' },
      },
    ],
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 20 }],
  } : null;

  const tabItems = [
    {
      key: 'dos', label: T('postprocess.dos'),
      children: (
        <div style={{ height: '100%' }}>
          {loading ? <Spin /> : dosData ? (
            <>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                {T('postprocess.fermi_level')}: {dosData.e_fermi.toFixed(4)} eV |
                NEDOS: {dosData.nedos} | NIONS: {dosData.nions}
              </div>
              <div style={{ height: 360 }}>
                <DosChart data={dosData} loading={loading} energyWindow={energyWindow} />
              </div>
            </>
          ) : <Empty description={T('postprocess.no_jobs')} />}
        </div>
      ),
    },
    {
      key: 'band', label: T('postprocess.band'),
      children: (
        <div style={{ height: '100%' }}>
          {loading ? <Spin /> : bandData ? (
            <>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                {T('postprocess.fermi_level')}: {bandData.e_fermi.toFixed(4)} eV |
                Nk: {bandData.n_kpoints} | Nbands: {bandData.n_bands}
              </div>
              <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#666' }}>{T('postprocess.energy_range')}:</span>
                <Slider
                  range
                  min={-20} max={20} step={0.5}
                  defaultValue={[-5, 5]}
                  onChange={(v) => setEnergyWindow(v as [number, number])}
                  style={{ width: 200 }}
                  tooltip={{ formatter: (v) => `${v} eV` }}
                />
              </div>
              <div style={{ height: 360 }}>
                <BandChart data={bandData} loading={loading} energyWindow={energyWindow} />
              </div>
            </>
          ) : <Empty description={T('postprocess.no_jobs')} />}
        </div>
      ),
    },
    {
      key: 'energy', label: T('postprocess.energy'),
      children: (
        <div style={{ height: '100%' }}>
          {loading ? <Spin /> : energyData ? (
            <>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                {T('monitor.ionic_steps')}: {energyData.total_ionic_steps} |
                NSW: {energyData.nsw ?? '?'} |
                Total steps: {energyData.steps.length}
              </div>
              <div style={{ height: 360 }}>
                <ReactEChartsCore option={energyChartOption!} style={{ height: '100%' }} notMerge />
              </div>
            </>
          ) : <Empty description={T('postprocess.no_jobs')} />}
        </div>
      ),
    },
    {
      key: 'optical', label: T('postprocess.optical'),
      children: (
        <div style={{ height: '100%' }}>
          {loading ? <Spin /> : opticalData ? (
            <div style={{ fontSize: 11, color: '#aaa', padding: 16 }}>
              {opticalData.dielectric_tensor ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Static Dielectric Tensor:</div>
                  <pre style={{ fontSize: 10 }}>
                    {JSON.stringify(opticalData.dielectric_tensor, null, 2)}
                  </pre>
                </div>
              ) : (
                <div>No dielectric tensor found. Run with LEPSILON=True.</div>
              )}
              {opticalData.frequency_dependent && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Frequency-dependent ε(ω):</div>
                  <div style={{ fontSize: 10, color: '#666' }}>
                    {opticalData.frequency_dependent.energies.length} data points
                  </div>
                </div>
              )}
            </div>
          ) : <Empty description={T('postprocess.no_jobs')} />}
        </div>
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '6px 10px', borderBottom: '1px solid #333',
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600 }}>
          {T('postprocess.title')}
        </span>
        <Select
          size="small"
          style={{ minWidth: 200 }}
          placeholder={T('postprocess.select_job')}
          value={selectedJobId}
          onChange={(v) => setSelectedJobId(v)}
          options={jobs.map(j => ({
            value: j.job_id,
            label: `${j.calc_type} — ${j.project_path?.split('/').pop() || j.project_path} (${j.status})`,
          }))}
          notFoundContent={T('postprocess.no_jobs')}
        />
        <Button size="small" type="primary" icon={<ReloadOutlined />}
          onClick={loadData} loading={loading}>
          {T('postprocess.load')}
        </Button>
        <Space size={4}>
          <Button size="small" icon={<DownloadOutlined />}
            onClick={() => handleExport('csv')}>{T('postprocess.export_csv')}</Button>
        </Space>
      </div>

      {/* Tabs */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          items={tabItems}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
