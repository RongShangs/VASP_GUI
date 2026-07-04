import { useState, useEffect, useMemo } from 'react';
import { Modal, Form, InputNumber, Select, Space, Tag, Tooltip } from 'antd';
import { useUIStore } from '../../store';
import { useT } from '../../i18n';

export interface JobParams {
  encut: number;
  kpoints: [number, number, number];
  sigma: number;
  nsw: number;
  precision: string;
  np: number;
}

interface Props {
  open: boolean;
  calcType: string;
  calcLabel: string;
  onOk: (params: JobParams) => void;
  onCancel: () => void;
}

const PRESETS: Record<string, Partial<JobParams>> = {
  static_scf:    { encut: 400, kpoints: [4, 4, 4], sigma: 0.05, nsw: 0, precision: 'Normal' },
  structure_opt: { encut: 450, kpoints: [4, 4, 4], sigma: 0.05, nsw: 60, precision: 'Normal' },
  nscf:          { encut: 400, kpoints: [6, 6, 6], sigma: 0.05, nsw: 0, precision: 'Normal' },
  dos:           { encut: 400, kpoints: [8, 8, 8], sigma: 0.1, nsw: 0, precision: 'Normal' },
  band_structure:{ encut: 400, kpoints: [1, 1, 1], sigma: 0.05, nsw: 0, precision: 'Normal' },
  md_nvt:        { encut: 400, kpoints: [2, 2, 2], sigma: 0.05, nsw: 1000, precision: 'Normal' },
};

export default function JobParamModal({ open, calcType, calcLabel, onOk, onCancel }: Props) {
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);

  // Read INCAR pre-fill values from the global store that FunctionCards set
  const incarPrefill = useMemo(() => {
    return (window as any).__incarPrefill || {};
  }, [open]); // re-read when modal opens

  // Merge: INCAR values > template preset > defaults
  const initial = useMemo(() => {
    const preset = PRESETS[calcType] || { encut: 400, kpoints: [4, 4, 4], sigma: 0.05, nsw: 0, precision: 'Normal' };
    return {
      encut: incarPrefill.ENCUT ?? preset.encut!,
      kp1: incarPrefill.KPOINTS_gamma?.[0] ?? preset.kpoints![0],
      kp2: incarPrefill.KPOINTS_gamma?.[1] ?? preset.kpoints![1],
      kp3: incarPrefill.KPOINTS_gamma?.[2] ?? preset.kpoints![2],
      sigma: incarPrefill.SIGMA ?? preset.sigma!,
      nsw: incarPrefill.NSW ?? preset.nsw!,
      precision: incarPrefill.PREC ?? preset.precision!,
      hasIncar: Object.keys(incarPrefill).length > 0,
      incarKeys: Object.keys(incarPrefill),
    };
  }, [incarPrefill, calcType]);

  const [encut, setEncut] = useState(initial.encut);
  const [kp1, setKp1] = useState(initial.kp1);
  const [kp2, setKp2] = useState(initial.kp2);
  const [kp3, setKp3] = useState(initial.kp3);
  const [sigma, setSigma] = useState(initial.sigma);
  const [nsw, setNsw] = useState(initial.nsw);
  const [precision, setPrecision] = useState(initial.precision);

  // Reset form when modal opens with new INCAR data
  useEffect(() => {
    setEncut(initial.encut);
    setKp1(initial.kp1);
    setKp2(initial.kp2);
    setKp3(initial.kp3);
    setSigma(initial.sigma);
    setNsw(initial.nsw);
    setPrecision(initial.precision);
  }, [open, initial.encut, initial.kp1, initial.kp2, initial.kp3, initial.sigma, initial.nsw, initial.precision]);

  const handleOk = () => {
    onOk({ encut, kpoints: [kp1, kp2, kp3], sigma, nsw, precision, np: 4 });
  };

  const fromLabel = initial.hasIncar ? ' (from INCAR)' : ' (default)';

  return (
    <Modal
      title={<span>⚙ {calcLabel} — {lang === 'zh' ? '计算参数' : 'Parameters'}
        {initial.hasIncar && <Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>📄 INCAR detected</Tag>}
      </span>}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText={lang === 'zh' ? '提交到终端' : 'Submit to Terminal'}
      cancelText={T('file.cancel')}
      width={420}
    >
      <Form layout="vertical" size="small">
        <Form.Item label={<span>ENCUT (eV) <Tooltip title={fromLabel}><Tag style={{ fontSize: 9 }}>{initial.hasIncar ? 'INCAR' : '预设'}</Tag></Tooltip></span>}>
          <InputNumber value={encut} onChange={v => setEncut(v || 400)} min={100} max={2000} step={50} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label={<span>{lang === 'zh' ? 'K点网格' : 'K-point Grid'} <Tooltip title={fromLabel}><Tag style={{ fontSize: 9 }}>{initial.hasIncar ? 'INCAR' : '预设'}</Tag></Tooltip></span>}>
          <Space>
            <InputNumber value={kp1} onChange={v => setKp1(v || 1)} min={1} max={20} style={{ width: 70 }} placeholder="kx" />
            <span style={{ color: '#888' }}>×</span>
            <InputNumber value={kp2} onChange={v => setKp2(v || 1)} min={1} max={20} style={{ width: 70 }} placeholder="ky" />
            <span style={{ color: '#888' }}>×</span>
            <InputNumber value={kp3} onChange={v => setKp3(v || 1)} min={1} max={20} style={{ width: 70 }} placeholder="kz" />
          </Space>
        </Form.Item>
        <Form.Item label={`SIGMA (eV) — ${lang === 'zh' ? '展宽' : 'Smearing'}`}>
          <InputNumber value={sigma} onChange={v => setSigma(v || 0.05)} min={0.001} max={5} step={0.01} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label={`NSW — ${lang === 'zh' ? '最大离子步数' : 'Max Ionic Steps'}`}>
          <InputNumber value={nsw} onChange={v => setNsw(v || 0)} min={0} max={10000} step={10} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label={`PREC — ${lang === 'zh' ? '计算精度' : 'Precision'}`}>
          <Select value={precision} onChange={v => setPrecision(v)} options={[
            { label: 'Low', value: 'Low' },
            { label: 'Medium', value: 'Medium' },
            { label: 'Normal', value: 'Normal' },
            { label: 'High', value: 'High' },
            { label: 'Accurate', value: 'Accurate' },
          ]} style={{ width: '100%' }} />
        </Form.Item>
        {initial.hasIncar && (
          <div style={{ fontSize: 10, color: '#888', borderTop: '1px solid #333', paddingTop: 8, marginTop: 4 }}>
            📄 INCAR parameters detected: {initial.incarKeys.slice(0, 8).join(', ')}{initial.incarKeys.length > 8 ? '...' : ''}
          </div>
        )}
      </Form>
    </Modal>
  );
}
