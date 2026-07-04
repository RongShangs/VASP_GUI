import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button, Progress, message, Tag, Switch } from 'antd';
import {
  CloseOutlined, StopOutlined, FileTextOutlined, ReloadOutlined,
  VerticalAlignBottomOutlined, PauseCircleOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react';
import { useJobStore, useUIStore, useTerminalStore, useConnectionStore, useEditorStore } from '../../store';
import { jobsApi } from '../../api/jobs';
import { filesApi } from '../../api/files';
import { useT } from '../../i18n';
import type { EnergyStep } from '../../types/job';
import type { ProgressUpdate } from '../../types/chart';
import '@xterm/xterm/css/xterm.css';

/** Strip ANSI escape codes (e.g. \x1b[33m → '') */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

export default function RuntimeMonitor() {
  const {
    activeJob, chartData, consoleLines, progress,
    addChartPoint, addConsoleLine, setProgress, clearJob,
  } = useJobStore();
  const lang = useUIStore(s => s.lang);
  const setRightPanelMode = useUIStore(s => s.setRightPanelMode);
  const sendCommand = useTerminalStore(s => s.sendCommand);
  const connectedAlias = useConnectionStore(s => s.connectedAlias);
  const openFile = useEditorStore(s => s.openFile);
  const T = useT(lang);

  const [jobStatus, setJobStatus] = useState<string>('running');
  const [autoScroll, setAutoScroll] = useState(true);
  const [cmdCooldown, setCmdCooldown] = useState(false); // prevent duplicate terminal sends
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const wsConsoleRef = useRef<WebSocket | null>(null);
  const wsChartRef = useRef<WebSocket | null>(null);
  const wsProgressRef = useRef<WebSocket | null>(null);

  // ── Elapsed time ticker ─────────────────────────────────────
  useEffect(() => {
    if (!activeJob?.job_id) return;
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setProgress({ elapsedSeconds: elapsed });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeJob?.job_id]);

  // ── Auto-scroll console ─────────────────────────────────────
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLines, autoScroll]);

  // ── Poll job status ─────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    if (!activeJob?.job_id) return;
    try {
      const r = await jobsApi.status(activeJob.job_id);
      const s = r.data.status;
      setJobStatus(s);
      if (s === 'finished' || s === 'error' || s === 'cancelled') {
        message.success(s === 'finished'
          ? `${T('right.job_finished')}: ${activeJob.calc_type}`
          : `Job ${s}`);
        setProgress({ convergenceReached: true });
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch { /* silent */ }
  }, [activeJob?.job_id]);

  useEffect(() => {
    if (!activeJob?.job_id) return;
    pollRef.current = setInterval(pollStatus, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeJob?.job_id, pollStatus]);

  // ── Console WebSocket (raw vasp.out lines) ──────────────────
  useEffect(() => {
    if (!activeJob?.job_id) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/console/${activeJob.job_id}`);
    wsConsoleRef.current = ws;

    ws.onopen = () => {
      addConsoleLine('═══ VASP Console Connected ═══');
    };

    ws.onmessage = (e) => {
      const raw = typeof e.data === 'string' ? e.data : '';
      if (!raw) return; // heartbeat
      const text = stripAnsi(raw);

      // Show ERROR lines prominently
      if (text.startsWith('ERROR:')) {
        addConsoleLine(`❌ ${text}`);
        return;
      }

      addConsoleLine(text);

      // Detect convergence
      if (text.includes('reached required accuracy') || text.includes('EDIFF is reached')) {
        setProgress({ convergenceReached: true });
      }
    };

    ws.onclose = () => { addConsoleLine('─── Console Disconnected ───'); };
    ws.onerror = () => { ws.close(); };

    return () => { ws.close(); wsConsoleRef.current = null; };
  }, [activeJob?.job_id]);

  // ── Chart WebSocket (structured energy data) ─────────────────
  useEffect(() => {
    if (!activeJob?.job_id) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chart/${activeJob.job_id}`);
    wsChartRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const point = JSON.parse(e.data);
        if (point.error) {
          console.warn('Chart WS error:', point.error);
          return;
        }
        // Ionic step marker
        if (point.step_type === 'ionic') {
          setProgress({ ionicCurrent: point.ionic_step, elecCurrent: 0 });
          return;
        }
        // Electronic step data
        addChartPoint(point);
        setProgress({
          ionicCurrent: point.ionic_step || 1,
          elecCurrent: point.step,
          currentEnergy: point.energy,
          currentFreeEnergy: point.free_energy,
        });
      } catch {
        // ignore non-JSON
      }
    };

    ws.onerror = () => ws.close();
    return () => { ws.close(); wsChartRef.current = null; };
  }, [activeJob?.job_id]);

  // ── Progress WebSocket ──────────────────────────────────────
  useEffect(() => {
    if (!activeJob?.job_id) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/progress/${activeJob.job_id}`);
    wsProgressRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const update: ProgressUpdate = JSON.parse(e.data);
        setProgress({
          ionicCurrent: update.ionic_step ?? undefined,
          totalIonicSteps: update.total_ionic_steps ?? undefined,
          elecCurrent: update.electronic_step ?? undefined,
          currentEnergy: update.energy ?? undefined,
          currentFreeEnergy: update.free_energy ?? undefined,
          convergenceReached: update.convergence_reached,
          elapsedSeconds: update.elapsed_seconds ?? undefined,
        });
      } catch { /* ignore invalid JSON */ }
    };

    ws.onerror = () => ws.close();
    return () => { ws.close(); wsProgressRef.current = null; };
  }, [activeJob?.job_id]);

  // ── Build chart option ──────────────────────────────────────
  const chartOption = useMemo(() => {
    const eData: [number, number][] = [];
    const fData: [number, number][] = [];
    const dData: [number, number][] = [];

    chartData.forEach((p, i) => {
      if (p.step_type === 'ionic') return; // Skip ionic markers in line chart
      const idx = p.ionic_step ? (p.ionic_step - 1) * 100 + p.step : i;
      eData.push([idx, p.energy]);
      if (p.free_energy != null) fData.push([idx, p.free_energy]);
      if (p.delta_e != null) dData.push([idx, p.delta_e]);
    });

    return {
      backgroundColor: 'transparent',
      grid: { top: 10, right: 45, bottom: 20, left: 55 },
      legend: {
        data: ['E0', 'F', 'ΔE'],
        bottom: 0,
        textStyle: { fontSize: 10, color: '#888' },
      },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#888' }, name: 'Step', nameTextStyle: { fontSize: 10, color: '#666' } },
      yAxis: [
        {
          type: 'value', scale: true,
          name: 'Energy (eV)',
          nameTextStyle: { fontSize: 10, color: '#666' },
          axisLabel: { fontSize: 10, color: '#888' },
          splitLine: { lineStyle: { color: '#1a1a3a' } },
        },
        {
          type: 'value', scale: true,
          name: 'ΔE (eV)',
          nameTextStyle: { fontSize: 10, color: '#666' },
          axisLabel: { fontSize: 10, color: '#888' },
        },
      ],
      series: [
        {
          name: 'E0', type: 'line',
          data: eData, smooth: true,
          symbol: eData.length < 3 ? 'circle' : 'none',
          symbolSize: 3,
          lineStyle: { color: '#528bff', width: 1.5 },
        },
        {
          name: 'F', type: 'line',
          data: fData, smooth: true,
          symbol: fData.length < 3 ? 'circle' : 'none',
          symbolSize: 2,
          lineStyle: { color: '#4caf50', width: 1 },
        },
        {
          name: 'ΔE', type: 'line',
          data: dData, yAxisIndex: 1,
          smooth: false,
          symbol: dData.length < 3 ? 'circle' : 'none',
          symbolSize: 2,
          lineStyle: { color: '#ff9800', width: 0.8, type: 'dashed' },
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
      ],
    };
  }, [chartData]);

  // ── Terminal command sender (with 2s cooldown) ──────────────
  const sendTerminalCmd = useCallback((cmd: string, label: string) => {
    if (!sendCommand || cmdCooldown) {
      if (cmdCooldown) message.info('Please wait before sending another command');
      return;
    }
    sendCommand(cmd);
    message.success(`📨 ${label}`);
    setCmdCooldown(true);
    setTimeout(() => setCmdCooldown(false), 2000);
  }, [sendCommand, cmdCooldown]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleStop = async () => {
    if (!activeJob?.job_id) return;
    try {
      await jobsApi.cancel(activeJob.job_id);
      message.info('Job cancelled');
      setJobStatus('cancelled');
    } catch {
      message.error('Failed to cancel job');
    }
  };

  const handleViewFile = async (filename: string) => {
    if (!connectedAlias || !activeJob?.project_path) return;
    try {
      const path = `${activeJob.project_path}/${filename}`;
      const r = await filesApi.read(connectedAlias, path);
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const typeMap: Record<string, string> = {
        outcar: 'outcar', oszicar: 'oszicar', incar: 'incar',
        poscar: 'poscar', kpoints: 'kpoints', potcar: 'potcar',
      };
      openFile({
        id: `monitor-${filename}`,
        path,
        filename,
        type: (typeMap[ext] || 'text') as any,
        dirty: false,
        content: r.data.content,
      });
    } catch {
      message.error(`Failed to read ${filename}`);
    }
  };

  const handleBack = () => {
    [wsConsoleRef, wsChartRef, wsProgressRef].forEach(ref => ref.current?.close());
    if (pollRef.current) clearInterval(pollRef.current);
    clearJob();
    setRightPanelMode('idle');
  };

  const ionicPct = progress && progress.totalIonicSteps > 0
    ? Math.round((progress.ionicCurrent / progress.totalIonicSteps) * 100)
    : 0;
  const elecPct = progress && progress.maxElectronicSteps > 0
    ? Math.round((progress.elecCurrent / progress.maxElectronicSteps) * 100)
    : 0;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderBottom: '1px solid #333', background: '#16162a',
      }}>
        <div>
          <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600 }}>
            {T('monitor.title')}
          </span>
          <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>
            {activeJob?.calc_type}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color={
            jobStatus === 'finished' ? 'success' :
            jobStatus === 'error' ? 'error' :
            jobStatus === 'cancelled' ? 'warning' : 'processing'
          }>
            {jobStatus}
          </Tag>
          <Button size="small" type="text" icon={<CloseOutlined />}
            onClick={handleBack} style={{ color: '#888' }} />
        </div>
      </div>

      {/* ── Step Progress ── */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #2a2a4a' }}>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>
          {T('monitor.job_id')}: {activeJob?.job_id?.slice(0, 8)}…
          {activeJob?.remote_pid && <span> | {T('monitor.pid')}: {activeJob.remote_pid}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#888', width: 50 }}>{T('monitor.ionic_steps')}</span>
          <Progress
            percent={ionicPct}
            size="small"
            strokeColor="#528bff"
            style={{ flex: 1, margin: 0 }}
            format={() => `${progress?.ionicCurrent ?? 0}/${progress?.totalIonicSteps || '?'}`}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#888', width: 50 }}>{T('monitor.elec_steps')}</span>
          <Progress
            percent={elecPct}
            size="small"
            strokeColor="#4caf50"
            style={{ flex: 1, margin: 0 }}
            format={() => `${progress?.elecCurrent ?? 0}/${progress?.maxElectronicSteps || '?'}`}
          />
        </div>

        {/* Energy info line */}
        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: '#aaa' }}>
          <span>{T('monitor.current_energy')}: <b style={{ color: '#64b5f6' }}>{progress?.currentEnergy?.toFixed(6) ?? '—'}</b> eV</span>
          {progress?.currentFreeEnergy != null && (
            <span>{T('monitor.free_energy')}: <b style={{ color: '#66bb6a' }}>{progress.currentFreeEnergy.toFixed(6)}</b> eV</span>
          )}
          <span>
            {progress?.convergenceReached
              ? <Tag color="success" style={{ fontSize: 9, margin: 0 }}>✓ {T('monitor.converged')}</Tag>
              : <span style={{ color: '#888' }}>{T('monitor.not_converged')}</span>
            }
          </span>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ display: 'flex', gap: 4, padding: '4px 10px', borderBottom: '1px solid #2a2a4a', flexWrap: 'wrap' }}>
        <Button size="small" danger icon={<StopOutlined />} onClick={handleStop}
          disabled={jobStatus !== 'running'} style={{ fontSize: 10 }}>
          {T('monitor.stop_job')}
        </Button>
        <Button size="small" icon={<FileTextOutlined />} onClick={() => handleViewFile('OUTCAR')}
          style={{ fontSize: 10 }}>{T('monitor.view_outcar')}</Button>
        <Button size="small" icon={<FileTextOutlined />} onClick={() => handleViewFile('OSZICAR')}
          style={{ fontSize: 10 }}>{T('monitor.view_oszicar')}</Button>
        <Button size="small" onClick={() => sendTerminalCmd(
          'ps aux | grep -E "vasp_std|vasp_gam|vasp_ncl|mpirun" | grep -v grep || echo "No VASP processes"',
          'Process check'
        )} style={{ fontSize: 10 }}>
          ps aux | grep vasp
        </Button>
        <Button size="small" onClick={() => sendTerminalCmd(
          'grep -E "EDIFF|reached|convergence" OUTCAR 2>/dev/null | tail -5 || echo "No OUTCAR"',
          'Convergence check'
        )} style={{ fontSize: 10 }}>
          grep EDIFF OUTCAR
        </Button>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => pollStatus()}
          style={{ fontSize: 10 }}>{T('monitor.refresh')}</Button>
      </div>

      {/* ── Energy Convergence Chart ── */}
      <div style={{ height: 200, flexShrink: 0 }}>
        {chartData.length > 0 ? (
          <ReactEChartsCore option={chartOption} style={{ height: '100%' }} notMerge />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#555', fontSize: 11, flexDirection: 'column',
          }}>
            <span>{T('right.waiting_data')}</span>
            <span style={{ fontSize: 10, marginTop: 4 }}>{T('right.monitor_hint')}</span>
          </div>
        )}
      </div>

      {/* ── Console Output ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        borderTop: '1px solid #333', minHeight: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '2px 10px', borderBottom: '1px solid #2a2a4a', background: '#12122a',
        }}>
          <span style={{ fontSize: 10, color: '#666' }}>{T('right.console_output')}</span>
          <Switch
            size="small"
            checked={autoScroll}
            onChange={setAutoScroll}
            checkedChildren={<VerticalAlignBottomOutlined />}
            unCheckedChildren={<PauseCircleOutlined />}
          />
        </div>
        <div style={{
          flex: 1, overflow: 'auto', padding: '4px 8px',
          background: '#0a0a1a', fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 10, color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {consoleLines.length === 0 ? (
            <span style={{ color: '#555' }}>{T('right.no_output')}</span>
          ) : (
            consoleLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>

      {/* ── Return Button ── */}
      <div style={{ padding: '4px 10px', borderTop: '1px solid #333' }}>
        <Button size="small" block onClick={handleBack}>
          {T('right.return_cards')}
        </Button>
      </div>
    </div>
  );
}
