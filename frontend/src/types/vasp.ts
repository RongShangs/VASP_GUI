export interface TagMeta {
  tag: string;
  type: 'enum' | 'int' | 'float' | 'bool' | 'str' | 'list';
  default: any;
  options?: (string | number | null)[];
  option_descriptions?: Record<string, string>;
  min_val?: number;
  max_val?: number;
  unit?: string;
  category: string;
  description: string;
  advanced: boolean;
  dependencies?: Record<string, any>;
}

export interface IncarParam {
  tag: string;
  value: any;
  type: string;
}

export interface CalcPreset {
  key: string;
  category: string;
  name: string;
  description: string;
  incar_params: Record<string, any>;
  kpoints_params: Record<string, any>;
}

export interface VASPCalcType {
  key: string;
  label: string;
  desc: string;
  icon: string;
  category: string;
  category_name?: string;
}
