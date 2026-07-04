import { useState, useMemo } from 'react';
import { Table, Input, InputNumber, Select, Tag, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useUIStore } from '../../../store';
import { useT } from '../../../i18n';

// Simple INCAR parser (mirrors backend logic)
function parseIncar(content: string): Record<string, any> {
  const params: Record<string, any> = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const clean = line.split('#')[0].split('!')[0].trim();
    if (!clean || !clean.includes('=')) continue;
    const [key, ...rest] = clean.split('=');
    const val = rest.join('=').trim();
    if (!key.trim()) continue;
    const k = key.trim();
    if (val.toUpperCase() === '.TRUE.' || val.toUpperCase() === 'T') { params[k] = true; }
    else if (val.toUpperCase() === '.FALSE.' || val.toUpperCase() === 'F') { params[k] = false; }
    else if (/^-?[\d.]+$/.test(val)) { params[k] = val.includes('.') ? parseFloat(val) : parseInt(val); }
    else if (/^[\d.eE+\-\s]+$/.test(val) && val.includes(' ')) {
      params[k] = val.split(/\s+/).map(v => parseFloat(v));
    }
    else { params[k] = val; }
  }
  return params;
}

interface Props {
  content: string;
  onChange: (v: string) => void;
}

// Local INCAR tag descriptions (subset of common tags)
const TAG_DESCRIPTIONS: Record<string, { desc: string; type: string; unit?: string; category?: string }> = {
  SYSTEM: { desc: '体系描述', type: 'str', category: '基础' },
  ENCUT: { desc: '平面波截断能', type: 'float', unit: 'eV', category: '基础' },
  EDIFF: { desc: '电子步收敛标准', type: 'float', unit: 'eV', category: '电子' },
  EDIFFG: { desc: '离子收敛标准 (<0=力; >0=能量)', type: 'float', unit: 'eV/Å', category: '离子' },
  NELM: { desc: '最大电子步数', type: 'int', category: '电子' },
  NELMIN: { desc: '最小电子步数', type: 'int', category: '电子' },
  NSW: { desc: '最大离子步数 (0=静态)', type: 'int', category: '离子' },
  IBRION: { desc: '离子运动算法 (-1=静态, 1=RMM, 2=CG, 3=阻尼MD, 5=频率)', type: 'enum', category: '离子' },
  ISIF: { desc: '弛豫自由度 (2=离子, 3=全, 4=离子+形状)', type: 'enum', category: '离子' },
  ISMEAR: { desc: '展宽方法 (0=Gaussian, 1=MP, -5=四面体)', type: 'enum', category: '电子' },
  SIGMA: { desc: '展宽宽度', type: 'float', unit: 'eV', category: '电子' },
  PREC: { desc: '计算精度', type: 'enum', category: '基础' },
  ALGO: { desc: '电子算法', type: 'enum', category: '基础' },
  ISPIN: { desc: '自旋极化 (1=无, 2=有)', type: 'enum', category: '磁学' },
  MAGMOM: { desc: '初始磁矩', type: 'str', category: '磁学' },
  LORBIT: { desc: '轨道投影输出', type: 'enum', category: '输出' },
  LWAVE: { desc: '写入WAVECAR', type: 'bool', category: '输出' },
  LCHARG: { desc: '写入CHGCAR', type: 'bool', category: '输出' },
  LREAL: { desc: '实空间投影', type: 'enum', category: '基础' },
  ADDGRID: { desc: '附加支持网格', type: 'bool', category: '基础' },
  LDAU: { desc: 'DFT+U开关', type: 'bool', category: '磁学' },
  LDAUTYPE: { desc: 'DFT+U类型', type: 'enum', category: '磁学' },
  LDAUU: { desc: 'U参数 (每个原子)', type: 'list', unit: 'eV', category: '磁学' },
  LDAUJ: { desc: 'J参数 (每个原子)', type: 'list', unit: 'eV', category: '磁学' },
  LHFCALC: { desc: '杂化泛函/HF开关', type: 'bool', category: '杂化' },
  HFSCREEN: { desc: 'HSE屏蔽参数', type: 'float', unit: 'Å⁻¹', category: '杂化' },
  AEXX: { desc: '精确交换比例', type: 'float', category: '杂化' },
  IVDW: { desc: '范德华修正方法', type: 'enum', category: '高级' },
  LSORBIT: { desc: '自旋轨道耦合', type: 'bool', category: '磁学' },
  LNONCOLLINEAR: { desc: '非共线磁性', type: 'bool', category: '磁学' },
  IMAGES: { desc: 'NEB中间像点数', type: 'int', category: 'NEB' },
  SPRING: { desc: 'NEB弹簧常数', type: 'float', unit: 'eV/Å²', category: 'NEB' },
  LCLIMB: { desc: 'CI-NEB开关', type: 'bool', category: 'NEB' },
  POTIM: { desc: '离子步长/时间步长', type: 'float', unit: 'fs', category: '离子' },
  SMASS: { desc: 'MD质量参数', type: 'float', category: '离子' },
  TEBEG: { desc: 'MD起始温度', type: 'float', unit: 'K', category: '离子' },
  TEEND: { desc: 'MD终止温度', type: 'float', unit: 'K', category: '离子' },
  ISTART: { desc: '波函数初始化', type: 'enum', category: '自洽' },
  ICHARG: { desc: '电荷密度初始化', type: 'enum', category: '自洽' },
  LELF: { desc: '电子局域函数', type: 'bool', category: '输出' },
  LVTOT: { desc: '总局域势LOCPOT', type: 'bool', category: '输出' },
  LVHAR: { desc: 'Hartree势', type: 'bool', category: '输出' },
  NEDOS: { desc: 'DOS能量点数', type: 'int', category: '输出' },
  EMIN: { desc: 'DOS能量下限', type: 'float', unit: 'eV', category: '输出' },
  EMAX: { desc: 'DOS能量上限', type: 'float', unit: 'eV', category: '输出' },
  LOPTICS: { desc: '频率相关介电矩阵', type: 'bool', category: '光学' },
  LEPSILON: { desc: '静态介电张量', type: 'bool', category: '介电' },
  EFIELD: { desc: '外电场强度', type: 'float', unit: 'eV/Å', category: '特殊' },
  LDIPOL: { desc: '偶极修正', type: 'bool', category: '特殊' },
  IDIPOL: { desc: '偶极方向', type: 'enum', category: '特殊' },
  METAGGA: { desc: 'Meta-GGA泛函', type: 'enum', category: '高级' },
  LASPH: { desc: '非球面项贡献', type: 'bool', category: '高级' },
  NCORE: { desc: '每个轨道核数', type: 'int', category: '基础' },
  KPAR: { desc: 'k点并行数', type: 'int', category: '基础' },
  NPAR: { desc: '能带并行数', type: 'int', category: '基础' },
  ISYM: { desc: '对称性处理', type: 'enum', category: '基础' },
  GGA: { desc: 'GGA泛函类型', type: 'enum', category: '基础' },
  LSOL: { desc: '隐式溶剂模型', type: 'bool', category: '溶剂' },
  EB: { desc: '溶剂介电常数', type: 'float', category: '溶剂' },
};

const CATEGORY_COLORS: Record<string, string> = {
  '基础': 'blue', '电子': 'cyan', '离子': 'green', '磁学': 'magenta',
  '输出': 'orange', '自洽': 'purple', '杂化': 'red', '高级': 'geekblue',
  '光学': 'gold', '介电': 'lime', 'NEB': 'volcano', '特殊': 'default',
  '溶剂': 'green',
};

export default function IncarViewer({ content, onChange }: Props) {
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('');
  // Local edit state: {tag: currentEditValue} — avoids re-render flicker
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const params = useMemo(() => parseIncar(content), [content]);

  const categories = useMemo(() => {
    const cats = new Set(Object.keys(params).map(k => TAG_DESCRIPTIONS[k]?.category).filter(Boolean) as string[]);
    return Array.from(cats);
  }, [params]);

  const data = useMemo(() => {
    const entries = Object.entries(params).map(([key, value]) => {
      const meta = TAG_DESCRIPTIONS[key];
      const cat = meta?.category || '其他';
      return {
        key,
        tag: key,
        desc: meta?.desc || '',
        value: value,
        type: meta?.type || typeof value,
        unit: meta?.unit || '',
        category: cat,
        isCustom: !meta,
      };
    });

    let filtered = entries;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(e => e.tag.toLowerCase().includes(s) || e.desc.includes(s));
    }
    if (filterCat) {
      filtered = filtered.filter(e => e.category === filterCat);
    }

    // Sort: known tags first, then by category, then alphabetically
    filtered.sort((a, b) => {
      if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.tag.localeCompare(b.tag);
    });

    return filtered;
  }, [params, search, filterCat]);

  // Handle inline edit
  const handleValueChange = (tag: string, newValue: any) => {
    const newParams = { ...params, [tag]: newValue };
    // Rebuild INCAR content
    const lines: string[] = [];
    for (const [k, v] of Object.entries(newParams)) {
      if (typeof v === 'boolean') lines.push(`${k} = .${v ? 'TRUE' : 'FALSE'}.`);
      else if (Array.isArray(v)) lines.push(`${k} = ${v.join(' ')}`);
      else if (v !== null && v !== undefined) lines.push(`${k} = ${v}`);
    }
    onChange(lines.join('\n') + '\n');
    setEditingTag(null);
  };

  // Commit local edit on blur/enter
  const commitEdit = (tag: string, type: string) => {
    if (editingTag !== tag) return;
    if (type === 'bool') {
      handleValueChange(tag, editValue === 'true');
    } else if (type === 'int') {
      const v = parseInt(editValue);
      if (!isNaN(v)) handleValueChange(tag, v);
    } else if (type === 'float') {
      const v = parseFloat(editValue);
      if (!isNaN(v)) handleValueChange(tag, v);
    } else if (type === 'list') {
      const arr = editValue.split(/\s+/).map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (arr.length > 0) handleValueChange(tag, arr);
    } else {
      handleValueChange(tag, editValue);
    }
  };

  const startEdit = (tag: string, currentValue: any) => {
    const displayVal = typeof currentValue === 'boolean' ? String(currentValue) :
      Array.isArray(currentValue) ? currentValue.join(' ') : String(currentValue ?? '');
    setEditingTag(tag);
    setEditValue(displayVal);
  };

  const columns = [
    {
      title: T('viewer.category'),
      dataIndex: 'category',
      key: 'category',
      width: 80,
      render: (cat: string) => (
        <Tag color={CATEGORY_COLORS[cat] || 'default'} style={{ fontSize: 10 }}>{cat}</Tag>
      ),
    },
    {
      title: T('viewer.param_name'),
      dataIndex: 'tag',
      key: 'tag',
      width: 130,
      render: (tag: string, record: any) => (
        <Tooltip title={record.isCustom ? `${T('viewer.no_preview')}` : ''}>
          <span style={{
            fontFamily: 'monospace', fontWeight: 600, fontSize: 11,
            color: record.isCustom ? '#666' : '#528bff',
          }}>{tag}</span>
        </Tooltip>
      ),
    },
    {
      title: T('viewer.chinese_desc'),
      dataIndex: 'desc',
      key: 'desc',
      width: 140,
      ellipsis: true,
      render: (desc: string) => (
        <span style={{ fontSize: 11, color: desc ? '#c0c0c0' : '#555' }}>
          {desc || '-'}
        </span>
      ),
    },
    {
      title: T('viewer.current_value'),
      dataIndex: 'value',
      key: 'value',
      width: 180,
      render: (value: any, record: any) => {
        const isEditing = editingTag === record.tag;
        const displayVal = typeof value === 'boolean' ? (value ? '.TRUE.' : '.FALSE.') :
          Array.isArray(value) ? value.join(' ') : String(value ?? '');

        // ── Boolean: instant toggle ──
        if (record.type === 'bool') {
          return (
            <Select
              size="small"
              value={value}
              onChange={(v) => handleValueChange(record.tag, v)}
              style={{ width: 80 }}
              options={[
                { label: '.TRUE.', value: true },
                { label: '.FALSE.', value: false },
              ]}
            />
          );
        }

        // ── Enum: dropdown ──
        if (record.type === 'enum') {
          const options = (record.tag === 'ISIF' ? [0, 1, 2, 3, 4, 5, 6, 7] :
            record.tag === 'IBRION' ? [-1, 0, 1, 2, 3, 5, 6, 7, 8, 44] :
            record.tag === 'ISMEAR' ? [-5, -4, -3, -2, -1, 0, 1, 2] :
            record.tag === 'PREC' ? ['Low', 'Medium', 'Normal', 'High', 'Accurate'] :
            record.tag === 'ALGO' ? ['Normal', 'VeryFast', 'Fast', 'Conjugate', 'All', 'Damped'] :
            record.tag === 'ISPIN' ? [1, 2] :
            record.tag === 'LORBIT' ? [0, 1, 2, 10, 11, 12] :
            record.tag === 'LREAL' ? ['Auto', '.TRUE.', '.FALSE.'] :
            record.tag === 'LDAUTYPE' ? [1, 2, 4] :
            record.tag === 'ICHARG' ? [0, 1, 2, 4, 11, 12] :
            record.tag === 'ISTART' ? [0, 1, 2, 3] :
            record.tag === 'IDIPOL' ? [1, 2, 3] :
            record.tag === 'METAGGA' ? ['SCAN', 'R2SCAN', 'RSCAN', 'TPSS', 'RTPSS', 'M06L', 'MBJLDA'] :
            record.tag === 'IVDW' ? [0, 1, 2, 3, 4, 10, 11, 12, 20, 21, 202, 30] :
            undefined
          );
          if (options) {
            return (
              <Select
                size="small"
                value={value}
                onChange={(v) => handleValueChange(record.tag, v)}
                style={{ width: 110 }}
                options={options.map(o => ({ label: String(o), value: o }))}
              />
            );
          }
          // Fallback: editable text
          if (isEditing) {
            return (
              <Input size="small" value={editValue} autoFocus
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitEdit(record.tag, 'str')}
                onPressEnter={() => commitEdit(record.tag, 'str')}
                style={{ width: 110, fontFamily: 'monospace', fontSize: 11 }} />
            );
          }
          return (
            <span className="editable-cell" onDoubleClick={() => startEdit(record.tag, value)}
              style={{ fontFamily: 'monospace', fontSize: 11, color: '#e0e0e0', cursor: 'text' }}
              title="Double-click to edit">
              {displayVal} ✎
            </span>
          );
        }

        // ── Editing state for int/float/str/list ──
        if (isEditing) {
          return (
            <Input size="small" value={editValue} autoFocus
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => commitEdit(record.tag, record.type)}
              onPressEnter={() => commitEdit(record.tag, record.type)}
              style={{ width: 130, fontFamily: 'monospace', fontSize: 11 }} />
          );
        }

        // ── Read-only display (double-click to edit) ──
        return (
          <span className="editable-cell" onDoubleClick={() => startEdit(record.tag, value)}
            style={{ fontFamily: 'monospace', fontSize: 11, color: '#e0e0e0', cursor: 'text' }}
            title="Double-click to edit">
            {displayVal} ✎
          </span>
        );
      },
    },
    {
      title: T('viewer.unit'),
      dataIndex: 'unit',
      key: 'unit',
      width: 60,
      render: (unit: string) => (
        <span style={{ fontSize: 10, color: '#888' }}>{unit || ''}</span>
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
        background: '#12122a', borderBottom: '1px solid #2a2a4a',
      }}>
        <Input
          size="small"
          prefix={<SearchOutlined />}
          placeholder={T('viewer.search_tag')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 160 }}
          allowClear
        />
        <Select
          size="small"
          value={filterCat || undefined}
          onChange={(v) => setFilterCat(v || '')}
          placeholder={T('viewer.category')}
          style={{ width: 100 }}
          allowClear
          options={[
            { label: T('viewer.all_categories'), value: '' },
            ...categories.map(c => ({ label: c, value: c })),
          ]}
        />
        <span style={{ fontSize: 10, color: '#666', marginLeft: 'auto' }}>
          {data.length} tags ({Object.keys(params).length} total)
        </span>
      </div>

      {/* Data table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ y: 'calc(100vh - 300px)' }}
          locale={{ emptyText: 'No INCAR tags found' }}
        />
      </div>
    </div>
  );
}
