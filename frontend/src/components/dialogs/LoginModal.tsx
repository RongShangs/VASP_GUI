import { useState } from 'react';
import { Card, Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore, useUIStore } from '../../store';
import { useT } from '../../i18n';

export default function LoginModal() {
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(s => s.login);
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    const ok = await login(values.username, values.password);
    setLoading(false);
    if (!ok) message.error(T('login.failed'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: '#0a0a1a', gap: 16 }}>
      <Card
        style={{ width: 380, background: '#12122a', borderColor: '#333' }}
        styles={{ header: { borderBottom: '1px solid #333' } }}
        title={<span style={{ color: '#e0e0e0' }}>VASP GUI Web — {T('login.title')}</span>}
      >
        <Form onFinish={onFinish} autoComplete="off" initialValues={{ username: 'admin' }}>
          <Form.Item name="username" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined style={{ color: '#888' }} />}
              placeholder={T('login.username')} size="large"
              style={{ background: '#1a1a2e', borderColor: '#444', color: '#e0e0e0' }} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#888' }} />}
              placeholder={T('login.password')} size="large"
              style={{ background: '#1a1a2e', borderColor: '#444', color: '#e0e0e0' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {T('login.submit')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
