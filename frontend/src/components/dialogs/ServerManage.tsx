import { useState, useEffect } from 'react';
import { Modal, Table, Button, Form, Input, InputNumber, Select, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { serversApi } from '../../api/servers';
import { useConnectionStore, useUIStore } from '../../store';
import { useT } from '../../i18n';
import type { ServerNode } from '../../types/server';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ServerManage({ open, onClose }: Props) {
  const [servers, setServers] = useState<ServerNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const { setServers: setStoreServers, connect, connectedAlias } = useConnectionStore();
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);

  const loadServers = async () => {
    const r = await serversApi.list();
    setServers(r.data);
    setStoreServers(r.data);
  };

  useEffect(() => { if (open) loadServers(); }, [open]);

  const handleAdd = () => { form.resetFields(); setEditingId(null); setEditing(true); };
  const handleEdit = (server: ServerNode) => { form.setFieldsValue(server); setEditingId(server.id); setEditing(true); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await serversApi.update(editingId, values);
      } else {
        await serversApi.create(values);
      }
      message.success(T('msg.server_added'));
      setEditing(false);
      setEditingId(null);
      loadServers();
    } catch (e: any) {
      if (e.response?.data?.detail) message.error(e.response.data.detail);
      else if (e.errorFields) return;
      else message.error(String(e));
    }
  };

  const handleDelete = async (id: number) => {
    await serversApi.delete(id);
    message.success(T('msg.deleted'));
    loadServers();
  };

  const handleConnect = async (server: ServerNode) => {
    setLoading(true);
    try {
      const ok = await connect(server.alias);
      if (ok) {
        message.success(`${T('msg.connected')}: ${server.alias}`);
        onClose();
      }
    } catch {
      message.error(T('msg.connect_failed'));
    }
    setLoading(false);
  };

  const handleDisconnect = async (server: ServerNode) => {
    try {
      await serversApi.disconnect(server.id);
      message.success(T('msg.deleted'));
      useConnectionStore.getState().disconnect();
      loadServers();
    } catch { /* */ }
  };

  return (
    <Modal open={open} onCancel={onClose} title={T('server.title')} footer={null} width={700}>
      {editing ? (
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="alias" label={T('server.alias')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="host" label={T('server.host')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="port" label={T('server.port')} initialValue={22}><InputNumber min={1} max={65535} style={{width:'100%'}} /></Form.Item>
          <Form.Item name="username" label={T('server.username')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="auth_type" label={T('server.auth_type')} initialValue="password">
            <Select options={[{ label: T('settings.password_auth'), value: 'password' }, { label: T('settings.key_auth'), value: 'key' }]} />
          </Form.Item>
          <Form.Item name="password" label={T('server.password')}><Input.Password /></Form.Item>
          <Space><Button type="primary" htmlType="submit">{T('server.save')}</Button>
            <Button onClick={() => { setEditing(false); setEditingId(null); }}>{T('server.cancel')}</Button></Space>
        </Form>
      ) : (
        <>
          <Button icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 12 }}>{T('server.add')}</Button>
          <Table dataSource={servers} rowKey="id" size="small" pagination={false}
            columns={[
              { title: T('server.alias'), dataIndex: 'alias' },
              { title: T('server.host'), dataIndex: 'host' },
              { title: T('server.port'), dataIndex: 'port', width: 60 },
              { title: T('server.username'), dataIndex: 'username' },
              { title: T('server.actions'), width: 220, render: (_, r: ServerNode) => (
                <Space>
                  {connectedAlias === r.alias ? (
                    <Button size="small" onClick={() => handleDisconnect(r)}>{T('header.logout')}</Button>
                  ) : (
                    <Button size="small" icon={<LinkOutlined />} loading={loading} onClick={() => handleConnect(r)}>{T('server.connect')}</Button>
                  )}
                  <Button size="small" onClick={() => handleEdit(r)}>{T('server.edit')}</Button>
                  <Popconfirm title={T('msg.confirm_delete')} onConfirm={() => handleDelete(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )},
            ]}
          />
        </>
      )}
    </Modal>
  );
}
