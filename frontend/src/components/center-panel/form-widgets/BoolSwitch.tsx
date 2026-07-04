import { Switch } from 'antd';

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function BoolSwitch({ label, value, onChange }: Props) {
  return (
    <div className="form-control">
      <label>{label}</label>
      <div><Switch size="small" checked={value} onChange={onChange} /></div>
    </div>
  );
}
