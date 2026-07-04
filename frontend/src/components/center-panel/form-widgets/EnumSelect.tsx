import { Select } from 'antd';

interface Props {
  label: string;
  value: any;
  options: (string | number | null)[];
  descriptions?: Record<string, string>;
  onChange: (value: any) => void;
}

export default function EnumSelect({ label, value, options, descriptions, onChange }: Props) {
  return (
    <div className="form-control">
      <label>{label}</label>
      <Select size="small" value={value} onChange={onChange} style={{ width: '100%' }}
        options={options.map(o => ({
          value: o, label: descriptions?.[String(o)] || String(o ?? 'None'),
        }))}
      />
    </div>
  );
}
