import { useState } from 'react';
import { Tabs } from 'antd';
import { FormOutlined, CodeOutlined } from '@ant-design/icons';

interface Props {
  formView: React.ReactNode;
  codeView: React.ReactNode;
}

export default function DualEditor({ formView, codeView }: Props) {
  const [activeKey, setActiveKey] = useState('form');

  return (
    <Tabs activeKey={activeKey} onChange={setActiveKey} size="small" tabBarStyle={{ margin: 0, paddingLeft: 8 }}
      items={[
        { key: 'form', label: <span><FormOutlined /> 表单</span>, children: formView },
        { key: 'code', label: <span><CodeOutlined /> 源码</span>, children: codeView },
      ]}
    />
  );
}
