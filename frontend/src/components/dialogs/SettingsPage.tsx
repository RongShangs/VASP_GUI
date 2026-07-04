import { useState, useEffect } from 'react';
import { Modal, Tabs, Table, Button, Form, Input, InputNumber, Select, message, Space, Popconfirm, Descriptions, Tag, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import { serversApi } from '../../api/servers';
import { authApi } from '../../api/auth';
import { useConnectionStore, useUIStore, useAuthStore } from '../../store';
import { useT, type Lang } from '../../i18n';
import type { ServerNode } from '../../types/server';
import axios from 'axios';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPage({ open, onClose }: Props) {
  const { lang, setLang } = useUIStore();
  const T = useT(lang);
  const { username: currentUsername } = useAuthStore();
  const [servers, setServers] = useState<ServerNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingServer, setEditingServer] = useState(false);
  const [editingServerId, setEditingServerId] = useState<number | null>(null);
  const [serverForm] = Form.useForm();
  const { setServers: setStoreServers, connect } = useConnectionStore();
  const [passwordForm] = Form.useForm();
  const [usernameForm] = Form.useForm();
  const [savingPwd, setSavingPwd] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  const loadServers = async () => {
    try {
      const r = await serversApi.list();
      setServers(r.data);
      setStoreServers(r.data);
    } catch { /* */ }
  };

  const checkPassword = async () => {
    try {
      const r = await axios.get('/api/auth/require-password');
      setHasPassword(r.data.require_password);
    } catch { /* */ }
  };

  useEffect(() => { if (open) { loadServers(); checkPassword(); } }, [open]);

  const handleAddServer = () => { serverForm.resetFields(); setEditingServerId(null); setEditingServer(true); };
  const handleEditServer = (s: ServerNode) => {
    serverForm.setFieldsValue(s);
    setEditingServerId(s.id);
    setEditingServer(true);
  };

  const handleSaveServer = async () => {
    try {
      const values = await serverForm.validateFields();
      if (editingServerId) {
        // Update existing server
        await serversApi.update(editingServerId, values);
      } else {
        // Check for duplicate alias
        const dup = servers.find(s => s.alias === values.alias);
        if (dup) { message.error('Alias "' + values.alias + '" already exists'); return; }
        await serversApi.create(values);
      }
      message.success(T('msg.saved'));
      setEditingServer(false);
      setEditingServerId(null);
      loadServers();
    } catch (e: any) {
      if (e.response?.data?.detail) message.error(e.response.data.detail);
      else if (e.errorFields) return; // validation error, form shows it
      else message.error(String(e));
    }
  };

  const handleDeleteServer = async (id: number) => {
    try {
      await serversApi.delete(id);
      message.success(T('msg.deleted'));
      loadServers();
    } catch (e: any) { message.error(e.response?.data?.detail || String(e)); }
  };

  const handleConnect = async (server: ServerNode) => {
    setLoading(true);
    try {
      const ok = await connect(server.alias);
      if (ok) {
        message.success(T('msg.connected') + ': ' + server.alias);
        onClose();
      }
    } catch { message.error(T('msg.connect_failed')); }
    setLoading(false);
  };

  const handleSetPassword = async (values: { currentPassword?: string; newPassword: string; confirm: string }) => {
    if (values.newPassword !== values.confirm) { message.error(T('msg.pwd_mismatch')); return; }
    setSavingPwd(true);
    try {
      await authApi.changePassword(values.currentPassword || '', values.newPassword);
      message.success(T('msg.pwd_set'));
      setHasPassword(true);
      passwordForm.resetFields();
    } catch (e: any) {
      if (e.response?.data?.detail) {
        message.error(e.response.data.detail);
      } else {
        message.error(T('msg.pwd_failed'));
      }
    }
    setSavingPwd(false);
  };

  const handleChangeUsername = async (values: { newUsername: string }) => {
    setSavingUser(true);
    try {
      await authApi.changeUsername(values.newUsername);
      message.success(T('msg.saved'));
      usernameForm.resetFields();
      // Update auth store with new username
      useAuthStore.getState().setUsername(values.newUsername);
    } catch (e: any) {
      message.error(e.response?.data?.detail || T('msg.pwd_failed'));
    }
    setSavingUser(false);
  };

  return (
    <Modal open={open} onCancel={onClose} title={<><SettingOutlined /> {T('settings.title')}</>} footer={null} width={720}>
      <Tabs items={[
        {
          key: 'servers', label: T('settings.servers'),
          children: (
            <div>
              {editingServer ? (
                <Form form={serverForm} layout="vertical" onFinish={handleSaveServer}>
                  <Form.Item name="alias" label={T('settings.alias')} rules={[{ required: true }]}><Input /></Form.Item>
                  <Form.Item name="host" label={T('settings.host')} rules={[{ required: true }]}><Input /></Form.Item>
                  <Form.Item name="port" label={T('settings.port')} initialValue={22}><InputNumber min={1} max={65535} style={{width:'100%'}} /></Form.Item>
                  <Form.Item name="username" label={T('settings.username')} rules={[{ required: true }]}><Input /></Form.Item>
                  <Form.Item name="auth_type" label={T('settings.auth_type')} initialValue="password">
                    <Select options={[{label:T('settings.password_auth'),value:'password'},{label:T('settings.key_auth'),value:'key'}]} />
                  </Form.Item>
                  <Form.Item name="password" label={T('settings.password')}><Input.Password /></Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">{T('settings.save')}</Button>
                    <Button onClick={() => { setEditingServer(false); setEditingServerId(null); }}>{T('settings.cancel')}</Button>
                  </Space>
                </Form>
              ) : (
                <>
                  <Button icon={<PlusOutlined />} onClick={handleAddServer} style={{marginBottom:12}}>{T('settings.add_server')}</Button>
                  <Table dataSource={servers} rowKey="id" size="small" pagination={false}
                    columns={[
                      { title: T('settings.alias'), dataIndex: 'alias' },
                      { title: T('settings.host'), dataIndex: 'host' },
                      { title: T('settings.port'), dataIndex: 'port', width: 60 },
                      { title: T('settings.username'), dataIndex: 'username' },
                      { title: T('settings.actions'), width: 200, render: (_: any, r: ServerNode) => (
                        <Space>
                          <Button size="small" icon={<LinkOutlined />} loading={loading} onClick={() => handleConnect(r)}>{T('settings.connect')}</Button>
                          <Button size="small" onClick={() => handleEditServer(r)}>{T('settings.edit_server')}</Button>
                          <Popconfirm title={T('msg.confirm_delete')} onConfirm={() => handleDeleteServer(r.id)}>
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      )},
                    ]}
                  />
                </>
              )}
            </div>
          ),
        },
        {
          key: 'account', label: T('settings.account'),
          children: (
            <div style={{ maxWidth: 400 }}>
              <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label={T('settings.status')}>
                  <Tag color={hasPassword ? 'green' : 'orange'}>
                    {hasPassword ? T('settings.password_protected') : T('settings.no_password')}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={T('settings.username')}>{currentUsername || 'admin'}</Descriptions.Item>
              </Descriptions>

              <h4 style={{ marginBottom: 8 }}>{T('settings.change_username')}</h4>
              <Form form={usernameForm} layout="vertical" onFinish={handleChangeUsername}>
                <Form.Item name="newUsername" label={T('settings.new_username')} rules={[{ required: true, min: 2, message: T('msg.pwd_min') }]}>
                  <Input />
                </Form.Item>
                <Form.Item>
                  <Button type="default" htmlType="submit" loading={savingUser}>{T('settings.save_username')}</Button>
                </Form.Item>
              </Form>

              <h4 style={{ marginBottom: 8, marginTop: 16 }}>{T('settings.set_password')}</h4>
              <Form form={passwordForm} layout="vertical" onFinish={handleSetPassword}>
                {hasPassword && (
                  <Form.Item name="currentPassword" label={T('settings.current_password')} rules={[{ required: true, message: T('msg.pwd_min') }]}>
                    <Input.Password />
                  </Form.Item>
                )}
                <Form.Item name="newPassword" label={T('settings.new_password')} rules={[{ required: true, min: 4, message: T('msg.pwd_min') }]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item name="confirm" label={T('settings.confirm_password')} rules={[{ required: true }, ({ getFieldValue }) => ({
                  validator(_: any, value: string) {
                    if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                    return Promise.reject(new Error(T('msg.pwd_mismatch')));
                  },
                })]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={savingPwd}>{T('settings.save_password')}</Button>
                </Form.Item>
              </Form>
            </div>
          ),
        },
        {
          key: 'lang', label: T('settings.lang'),
          children: (
            <div style={{ maxWidth: 400 }}>
              <p style={{ marginBottom: 12, color: '#888' }}>{T('settings.lang')}</p>
              <Radio.Group value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                <Space direction="vertical">
                  <Radio value="zh">{T('settings.lang_zh')}</Radio>
                  <Radio value="en">{T('settings.lang_en')}</Radio>
                </Space>
              </Radio.Group>
            </div>
          ),
        },
        {
          key: 'about', label: T('settings.about'),
          children: (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={T('settings.about_app')}>VASP GUI Web</Descriptions.Item>
              <Descriptions.Item label={T('settings.about_version')}>v2.0.0</Descriptions.Item>
              <Descriptions.Item label={T('settings.about_backend')}>FastAPI + Python 3.11+</Descriptions.Item>
              <Descriptions.Item label={T('settings.about_frontend')}>React 18 + TypeScript + Ant Design 5</Descriptions.Item>
              <Descriptions.Item label={T('settings.about_ssh')}>asyncssh</Descriptions.Item>
              <Descriptions.Item label={T('settings.about_terminal')}>xterm.js</Descriptions.Item>
              <Descriptions.Item label={T('settings.about_charts')}>ECharts 5</Descriptions.Item>
              <Descriptions.Item label={T('settings.about_editor')}>Monaco Editor</Descriptions.Item>
              <Descriptions.Item label={T('settings.about_port')}>1691</Descriptions.Item>
            </Descriptions>
          ),
        },
      ]} />
    </Modal>
  );
}
