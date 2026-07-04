import { Breadcrumb, Input } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export default function BreadcrumbNav({ path, onNavigate }: Props) {
  const [editing, setEditing] = useState(false);
  const [editPath, setEditPath] = useState(path);
  const parts = path.split('/').filter(Boolean);

  const items = [
    { title: <span onClick={() => onNavigate('/')} style={{ cursor: 'pointer' }}><HomeOutlined /></span> },
    ...parts.map((p, i) => {
      const fullPath = '/' + parts.slice(0, i + 1).join('/');
      return { title: <span onClick={() => onNavigate(fullPath)} style={{ cursor: 'pointer' }}>{p}</span> };
    }),
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 12px', background: '#16162a', borderBottom: '1px solid #333' }}>
      {editing ? (
        <Input size="small" value={editPath} onChange={e => setEditPath(e.target.value)}
          onPressEnter={() => { onNavigate(editPath); setEditing(false); }}
          onBlur={() => setEditing(false)} style={{ flex: 1 }} autoFocus />
      ) : (
        <div onClick={() => { setEditPath(path); setEditing(true); }} style={{ cursor: 'pointer', flex: 1 }}>
          <Breadcrumb items={items} style={{ fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}
