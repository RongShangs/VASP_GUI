import { useState, useEffect, useCallback } from 'react';
import { Input, message, Dropdown, Spin } from 'antd';
import type { MenuProps } from 'antd';
import { SearchOutlined, ThunderboltOutlined, CodeOutlined } from '@ant-design/icons';
import { presetsApi } from '../../api/presets';
import { jobsApi } from '../../api/jobs';
import { filesApi } from '../../api/files';
import { useConnectionStore, useJobStore, useUIStore, useTerminalStore } from '../../store';
import { useT } from '../../i18n';
import JobParamModal, { type JobParams } from '../dialogs/JobParamModal';
import type { VASPCalcType } from '../../types/vasp';

/** Parse INCAR content into key-value pairs */
function parseIncarParams(content: string): Record<string, any> {
  const params: Record<string, any> = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const clean = line.split('#')[0].split('!')[0].trim();
    if (!clean || !clean.includes('=')) continue;
    const eqIdx = clean.indexOf('=');
    const key = clean.substring(0, eqIdx).trim();
    const val = clean.substring(eqIdx + 1).trim();
    if (!key) continue;
    if (val.toUpperCase() === '.TRUE.' || val.toUpperCase() === 'T') params[key] = true;
    else if (val.toUpperCase() === '.FALSE.' || val.toUpperCase() === 'F') params[key] = false;
    else if (/^-?[\d.]+$/.test(val)) params[key] = val.includes('.') ? parseFloat(val) : parseInt(val);
    else params[key] = val;
  }
  return params;
}

export default function FunctionCards() {
  const [categories, setCategories] = useState<any[]>([]);
  const [templates, setTemplates] = useState<VASPCalcType[]>([]);
  const [search, setSearch] = useState('');
  const [paramModal, setParamModal] = useState<{ open: boolean; tmpl: VASPCalcType | null }>({ open: false, tmpl: null });
  const { connectedAlias, workDir } = useConnectionStore();
  const { setActiveJob } = useJobStore();
  const { setRightPanelMode, lang } = useUIStore();
  const sendCommand = useTerminalStore(s => s.sendCommand);
  const T = useT(lang);

  useEffect(() => {
    presetsApi.categories().then(r => setCategories(r.data));
    presetsApi.list().then(r => setTemplates(r.data));
  }, []);

  const handleSearch = async (val: string) => {
    setSearch(val);
    if (val) {
      const r = await presetsApi.list({ search: val });
      setTemplates(r.data);
    } else {
      const r = await presetsApi.list();
      setTemplates(r.data);
    }
  };

  // Map calc type to vaspkit task: main→submenu→option
  // vaspkit menu: 1=Input Generator → 11=INCAR → task_number
  const VASPKIT_TASKS: Record<string, string> = {
    static_scf:     '1 11 101',   // Input → INCAR → Static SCF
    structure_opt:  '1 11 102',   // Input → INCAR → Structure Optimization
    nscf:           '1 11 103',   // Input → INCAR → NSCF
    restart:        '1 11 104',   // Input → INCAR → Restart
    dos:            '1 11 201',   // Input → INCAR → DOS settings
    band_structure: '1 11 202',   // Input → INCAR → Band settings
    md_nvt:         '1 11 203',   // Input → INCAR → MD
    frequencies:    '1 11 301',   // Input → INCAR → Frequencies
    dielectric:     '1 11 401',   // Input → INCAR → Optical
    spin_polarized: '1 11 501',   // Input → INCAR → Magnetic
    vdw:            '1 11 601',   // Input → INCAR → vdW
    neb:            '1 11 701',   // Input → INCAR → NEB
  };

  const buildCommand = useCallback((tmpl: VASPCalcType, params?: JobParams): string => {
    const projectPath = workDir || '/tmp/vasp_test';
    const np = params?.np || 4;
    const kp = params?.kpoints || [4, 4, 4];
    const encutVal = params?.encut || 400;

    const lines = [
      `cd "${projectPath}"`,
      `echo "═══════════════════════════════════════"`,
      `echo "  VASP GUI: ${tmpl.label}"`,
      `echo "  ENCUT=${encutVal}  KPTS=${kp[0]}x${kp[1]}x${kp[2]}  NSW=${params?.nsw || 0}  NP=${np}"`,
      `echo "═══════════════════════════════════════"`,
      ``,
      `# ── Write KPOINTS file directly ──`,
      `cat > KPOINTS << 'KPEnd'`,
      `Auto KPOINTS`,
      `0`,
      `Gamma`,
      `${kp[0]} ${kp[1]} ${kp[2]}`,
      `0 0 0`,
      `KPEnd`,
      `echo "[KPOINTS] ${kp[0]}x${kp[1]}x${kp[2]} Gamma-centered"`,
      ``,
      `# ── Ensure INCAR has key parameters ──`,
      `touch INCAR`,
      `grep -q '^ENCUT' INCAR 2>/dev/null && sed -i "s/^ENCUT.*/ENCUT = ${encutVal}/" INCAR || echo "ENCUT = ${encutVal}" >> INCAR`,
      `grep -q '^NSW' INCAR 2>/dev/null && sed -i "s/^NSW.*/NSW = ${params?.nsw || 0}/" INCAR || echo "NSW = ${params?.nsw || 0}" >> INCAR`,
      ...(params?.sigma != null ? [
        `grep -q '^SIGMA' INCAR 2>/dev/null && sed -i "s/^SIGMA.*/SIGMA = ${params.sigma}/" INCAR || echo "SIGMA = ${params.sigma}" >> INCAR`,
      ] : []),
      ...(params?.precision ? [
        `grep -q '^PREC' INCAR 2>/dev/null && sed -i "s/^PREC.*/PREC = ${params.precision}/" INCAR || echo "PREC = ${params.precision}" >> INCAR`,
      ] : []),
      `echo "[INCAR] Updated"`,
      ``,
      `# ── Find VASP executable ──`,
      `VASP_EXE=$(which vasp_std 2>/dev/null || which vasp 2>/dev/null || ls /bin/vasp_std 2>/dev/null || echo 'vasp_std')`,
      `echo "VASP: $VASP_EXE"`,
      ``,
      `# ── Clear old output, then run VASP directly ──`,
      `> vasp.out`,
      `echo "Launcher: $VASP_EXE (direct)"`,
      `nohup $VASP_EXE >> vasp.out 2>&1 &`,
      `VASP_PID=$!`,
      `echo "PID: $VASP_PID"`,
      `echo "NSW: ${params?.nsw || 0}"`,
      `echo "Monitor: tail -f vasp.out"`,
    ];

    return lines.join('\n');
  }, [workDir]);

  // Show param modal — read INCAR from project first for pre-fill
  const handleCardClick = async (tmpl: VASPCalcType) => {
    if (!connectedAlias) {
      message.warning(T('right.no_server_warn'));
      return;
    }
    if (!sendCommand) {
      message.warning('Terminal not ready — please wait for connection');
      return;
    }
    // Try to read the existing INCAR from the project directory
    let incarParams: Record<string, any> = {};
    try {
      const incarPath = `${workDir || '/'}/INCAR`;
      const r = await filesApi.read(connectedAlias, incarPath);
      incarParams = parseIncarParams(r.data.content);
    } catch {
      // INCAR doesn't exist yet — use defaults from template
    }
    setParamModal({ open: true, tmpl });
    // Store incarParams for the modal to use
    (window as any).__incarPrefill = incarParams;
  };

  // Called when user confirms params in modal
  const handleParamOk = async (params: JobParams) => {
    const tmpl = paramModal.tmpl;
    setParamModal({ open: false, tmpl: null });
    if (!tmpl || !sendCommand) return;

    const cmd = buildCommand(tmpl, params);
    sendCommand(cmd);
    message.success(`📨 ${T('right.command_sent')}: ${tmpl.label}`);

    // Record job via API
    try {
      const res = await jobsApi.submit({
        server_alias: connectedAlias!,
        project_path: workDir || '/tmp/vasp_test',
        calc_type: tmpl.key,
        incar_params: { ENCUT: params.encut, SIGMA: params.sigma, NSW: params.nsw },
        kpoints_params: { grid: params.kpoints },
      });
      setActiveJob({
        job_id: res.data.job_id, status: 'running', remote_pid: null,
        calc_type: tmpl.key, project_path: workDir || '/tmp/vasp_test',
        submitted_at: null, started_at: null, finished_at: null,
        exit_code: null, energy_final: null, error_message: null,
      });
      // Set initial progress with NSW so bars show correctly
      useJobStore.getState().setProgress({
        totalIonicSteps: params.nsw || 0,
        maxElectronicSteps: 60,
      });
      setRightPanelMode('running');
    } catch (e: any) {
      // API failed — job still submitted via terminal, monitoring may not work
      console.warn('Job API submit failed, monitoring may be unavailable:', e);
    }
  };

  const handleDirectSubmit = async (tmpl: VASPCalcType) => {
    if (!connectedAlias) { message.warning(T('right.no_server_warn')); return; }
    try {
      const preset = await presetsApi.get(tmpl.key);
      const res = await jobsApi.submit({
        server_alias: connectedAlias, project_path: workDir || '/tmp/vasp_test',
        calc_type: tmpl.key, incar_params: preset.data.incar, kpoints_params: preset.data.kpoints,
      });
      setActiveJob({
        job_id: res.data.job_id, status: 'running', remote_pid: null, calc_type: tmpl.key,
        project_path: workDir || '/tmp/vasp_test',
        submitted_at: null, started_at: null, finished_at: null, exit_code: null,
        energy_final: null, error_message: null,
      });
      setRightPanelMode('running');
      message.success(`${T('right.submit_success')}: ${tmpl.label}`);
    } catch (e: any) {
      message.error(T('right.submit_failed'));
    }
  };

  const cardMenuItems = (tmpl: VASPCalcType): MenuProps['items'] => [
    {
      key: 'terminal',
      label: `🖥 ${T('right.run_in_terminal')}`,
      icon: <CodeOutlined />,
      onClick: () => handleCardClick(tmpl),
    },
    {
      key: 'direct',
      label: `⚡ ${T('right.submit_success')} (API)`,
      icon: <ThunderboltOutlined />,
      onClick: () => handleDirectSubmit(tmpl),
    },
  ];

  const grouped: Record<string, VASPCalcType[]> = {};
  templates.forEach(t => {
    grouped[t.category] = grouped[t.category] || [];
    grouped[t.category].push(t);
  });

  const catNames: Record<string, string> = {};
  categories.forEach(c => { catNames[c.key] = c.name; });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8 }}>
        <Input prefix={<SearchOutlined />} placeholder={T('right.search_placeholder')} size="small"
          value={search} onChange={e => handleSearch(e.target.value)} allowClear />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="category-collapse">
            <div style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600, color: '#e0e0e0', cursor: 'pointer' }}>
              {catNames[cat] || cat} ({items.length})
            </div>
            <div className="card-grid">
              {items.map(t => (
                <Dropdown key={t.key} menu={{ items: cardMenuItems(t) }} trigger={['contextMenu']}>
                  <div
                    className="calc-card"
                    onClick={() => handleCardClick(t)}
                    title={`${t.label}: ${t.desc}\nClick → Run in Terminal\nRight-click → More options`}
                  >
                    <div className="icon">{t.icon}</div>
                    <div className="label">{t.label}</div>
                    <div className="desc">{t.desc}</div>
                  </div>
                </Dropdown>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Parameter Dialog */}
      <JobParamModal
        open={paramModal.open}
        calcType={paramModal.tmpl?.key || ''}
        calcLabel={paramModal.tmpl?.label || ''}
        onOk={handleParamOk}
        onCancel={() => setParamModal({ open: false, tmpl: null })}
      />
    </div>
  );
}
