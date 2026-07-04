import { Dropdown, Modal, Input, message } from 'antd';
import {
  FolderOpenOutlined, CopyOutlined, SnippetsOutlined,
  EditOutlined, DeleteOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { filesApi } from '../../api/files';
import { useConnectionStore, useUIStore } from '../../store';
import { useT } from '../../i18n';
import type { FileNode } from '../../types/files';
import { useState } from 'react';

interface Props {
  file: FileNode;
  currentPath: string;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export default function FileContextMenu({ file, currentPath, onRefresh, onNavigate, children }: Props) {
  const { connectedAlias, clipboard, setClipboard } = useConnectionStore();
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newName, setNewName] = useState('');

  if (!connectedAlias) return <>{children}</>;

  const handleOpen = () => {
    if (file.type === 'dir') {
      onNavigate(file.path);
    }
  };

  const handleCopy = () => {
    setClipboard({ path: file.path, name: file.name, type: file.type, operation: 'copy' });
    message.success(T('file.copied'));
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    const dst = `${currentPath}/${clipboard.name}`;
    try {
      await filesApi.copy(connectedAlias, clipboard.path, dst);
      message.success(T('file.pasted'));
      onRefresh();
    } catch {
      message.error(T('file.copy_failed'));
    }
  };

  const handleRename = () => {
    setNewName(file.name);
    setRenameModalOpen(true);
  };

  const doRename = async () => {
    if (!newName.trim() || newName === file.name) {
      setRenameModalOpen(false);
      return;
    }
    const newPath = file.path.replace(/[^/]+$/, newName.trim());
    try {
      await filesApi.rename(connectedAlias, file.path, newPath);
      message.success(T('file.renamed'));
      setRenameModalOpen(false);
      onRefresh();
    } catch {
      message.error(T('file.rename_failed'));
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: T('file.confirm_delete_title'),
      content: `${T('file.confirm_delete')}\n\n"${file.name}"`,
      okText: T('file.delete'),
      okType: 'danger',
      cancelText: T('file.cancel'),
      onOk: async () => {
        try {
          await filesApi.delete(connectedAlias, file.path, file.type === 'dir');
          message.success(T('msg.deleted'));
          onRefresh();
        } catch {
          message.error('Delete failed');
        }
      },
    });
  };

  const handleDownload = async () => {
    if (file.type !== 'file' || !connectedAlias) return;
    try {
      await filesApi.download(connectedAlias, file.path, file.name);
    } catch {
      // Fallback
      const a = document.createElement('a');
      a.href = filesApi.downloadUrl(connectedAlias, file.path);
      a.download = file.name;
      a.click();
    }
  };

  const isVaspDir = file.type === 'dir';

  const menuItems: any[] = [
    {
      key: 'open',
      label: T('file.open'),
      icon: <FolderOpenOutlined />,
      onClick: handleOpen,
    },
    { type: 'divider' },
    {
      key: 'copy',
      label: T('file.copy'),
      icon: <CopyOutlined />,
      onClick: handleCopy,
    },
  ];

  if (clipboard) {
    menuItems.push({
      key: 'paste',
      label: `${T('file.paste')} (${clipboard.name})`,
      icon: <SnippetsOutlined />,
      onClick: handlePaste,
    });
  }

  menuItems.push(
    {
      key: 'rename',
      label: T('file.rename'),
      icon: <EditOutlined />,
      onClick: handleRename,
    },
    { type: 'divider' },
  );

  if (file.type === 'file') {
    menuItems.push({
      key: 'download',
      label: T('file.download'),
      icon: <DownloadOutlined />,
      onClick: handleDownload,
    });
  }

  menuItems.push({
    key: 'delete',
    label: T('file.delete'),
    icon: <DeleteOutlined />,
    danger: true,
    onClick: handleDelete,
  });

  return (
    <>
      <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
        <div>{children}</div>
      </Dropdown>
      <Modal
        title={T('file.rename')}
        open={renameModalOpen}
        onOk={doRename}
        onCancel={() => setRenameModalOpen(false)}
        okText={T('file.ok')}
        cancelText={T('file.cancel')}
      >
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onPressEnter={doRename}
          placeholder={T('file.enter_new_name')}
        />
      </Modal>
    </>
  );
}
