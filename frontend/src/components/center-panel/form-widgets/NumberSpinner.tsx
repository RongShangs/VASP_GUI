import { InputNumber } from 'antd';

interface Props {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (value: number | null) => void;
}

export default function NumberSpinner({ label, value, min, max, unit, onChange }: Props) {
  return (
    <div className="form-control">
      <label>{label}{unit ? ` (${unit})` : ''}</label>
      <InputNumber size="small" value={value} min={min} max={max} onChange={onChange}
        style={{ width: '100%' }} step={0.01} stringMode={false} />
    </div>
  );
}
