import { useState, useEffect, useRef, useCallback } from 'react';
import { useConnectionStore, useEditorStore, useUIStore, useTerminalStore } from '../../store';
import { useFileTree } from '../../hooks/useFileTree';
import { filesApi } from '../../api/files';
import { Input, Button, message, Alert, Spin, Tooltip, Breadcrumb, Modal, Tag, Typography } from 'antd';
import {
  HomeOutlined, PushpinOutlined, ReloadOutlined, ArrowUpOutlined,
  FolderAddOutlined, FileAddOutlined, UploadOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import FileListTable from './FileListTable';
import MonacoEditor from './editors/MonacoEditor';
import FileViewer from './editors/FileViewer';
import { getVaspFileType } from '../../types/files';
import { useT } from '../../i18n';

const VISUALIZABLE_TYPES = ['incar', 'poscar', 'kpoints', 'potcar', 'outcar', 'oszicar'];

// File type descriptions
const FILE_DESCRIPTIONS: Record<string, { zh: string; en: string }> = {
  incar: {
    zh: 'INCAR — VASP 核心输入文件，定义计算参数（截断能、收敛标准、算法选择等）。所有电子结构计算的关键配置都在此文件中。',
    en: 'INCAR — Central VASP input file defining calculation parameters (cutoff energy, convergence criteria, algorithm selection, etc.).',
  },
  poscar: {
    zh: 'POSCAR — 晶体结构文件，定义晶格矢量、原子种类、原子数量及坐标。是结构优化的输入和输出目标。',
    en: 'POSCAR — Crystal structure file defining lattice vectors, atomic species, counts, and coordinates.',
  },
  kpoints: {
    zh: 'KPOINTS — K点采样文件，定义布里渊区积分网格密度或能带计算的高对称路径。直接影响计算精度和成本。',
    en: 'KPOINTS — K-point sampling file defining Brillouin zone integration mesh or band structure path.',
  },
  potcar: {
    zh: 'POTCAR — 赝势文件，包含每种元素的 PAW 赝势信息（ENMAX、价电子数等）。由多段拼接，不可编辑。',
    en: 'POTCAR — Pseudopotential file containing PAW data for each element (ENMAX, valence electrons). Concatenated, not editable.',
  },
  outcar: {
    zh: 'OUTCAR — VASP 主输出文件，包含能量、力、应力、CPU时间、收敛详情等全部计算结果。计算完成后查看。',
    en: 'OUTCAR — Main VASP output file with energies, forces, stresses, CPU time, and convergence details.',
  },
  oszicar: {
    zh: 'OSZICAR — 能量收敛记录文件，每个电子步的能量和温度信息。用于绘制能量收敛曲线，监控计算进度。',
    en: 'OSZICAR — Energy convergence log with per-step energy and temperature. Used for convergence monitoring.',
  },
  contcar: {
    zh: 'CONTCAR — 优化后的结构文件（POSCAR 格式）。离子弛豫完成后输出，可作为下次计算的 POSCAR 使用。',
    en: 'CONTCAR — Optimized structure (POSCAR format). Output after ionic relaxation, can be used as POSCAR for next run.',
  },
  chgcar: {
    zh: 'CHGCAR — 电荷密度文件（二进制），存储自洽计算的电荷密度。用于 NSCF、DOS、能带计算或电荷密度差分析。',
    en: 'CHGCAR — Charge density file (binary). Used for NSCF, DOS, band structure, or charge density difference analysis.',
  },
  wavecar: {
    zh: 'WAVECAR — 波函数文件（二进制，通常很大），存储 Kohn-Sham 轨道波函数。用于断点续算或能带展开。',
    en: 'WAVECAR — Wavefunction file (binary, usually large). Used for restart or band unfolding.',
  },
  vasprun: {
    zh: 'vasprun.xml — VASP 综合输出 XML 文件，包含完整的计算信息（结构、能量、力、DOS、能带等）。后处理主要数据源。',
    en: 'vasprun.xml — Comprehensive VASP output XML with full calculation information for post-processing.',
  },
};

function getFileDescription(fileType: string, lang: string): string | null {
  const info = FILE_DESCRIPTIONS[fileType];
  if (!info) return null;
  return lang === 'zh' ? info.zh : info.en;
}

export default function CenterPanel() {
  const { connectedAlias, homePath, workDir, setWorkDir, connecting, connectError } = useConnectionStore();
  const { tabs, activeTabId, openFile, closeTab, setActiveTab, updateContent, markClean } = useEditorStore();
  const { files, currentPath, loading, error, loadFiles, navigateUp } = useFileTree(connectedAlias);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<string>('text');
  const [editingPath, setEditingPath] = useState(false);
  const pathInputRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);

  // New folder/file modal
  const [newItemModal, setNewItemModal] = useState<{ open: boolean; type: 'file' | 'dir' }>({ open: false, type: 'dir' });
  const [newItemName, setNewItemName] = useState('');

  const refreshFiles = useCallback(() => {
    loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  // Navigate to work-dir or home on connect
  useEffect(() => {
    if (connectedAlias) {
      const startPath = workDir || homePath || '/';
      loadFiles(startPath);
    }
  }, [connectedAlias]);

  const goToPath = (p: string) => {
    const clean = p.trim() || '/';
    loadFiles(clean);
    setEditingPath(false);
    // Also cd in terminal when navigating directories
    if (sendCommand) {
      sendCommand(`cd "${clean}"`);
    }
  };

  const sendCommand = useTerminalStore(s => s.sendCommand);

  const handleSetWorkDir = () => {
    setWorkDir(currentPath);
    // Also cd in the terminal so the shell follows
    if (sendCommand) {
      sendCommand(`cd "${currentPath}" && echo "📌 CWD: $(pwd)"`);
    }
    message.success(`📌 ${T('terminal.cwd_label')}: ${currentPath}`);
  };

  const handleFileClick = async (file: any) => {
    if (file.type === 'dir') {
      loadFiles(file.path);
    } else {
      setSelectedFile(file.path);
      const vaspType = getVaspFileType(file.name);
      setSelectedFileType(vaspType);
      try {
        const res = await filesApi.read(connectedAlias!, file.path);
        openFile({
          id: file.path, path: file.path, filename: file.name,
          type: vaspType as any, dirty: false, content: res.data.content,
        });
      } catch (e: any) {
        message.error(e.response?.data?.detail || T('center.read_failed'));
      }
    }
  };

  const handleSave = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !connectedAlias) return;
    try {
      await filesApi.write(connectedAlias, tab.path, tab.content);
      markClean(tabId);
      message.success(T('center.save_success'));
    } catch {
      message.error(T('center.save_failed'));
    }
  };

  const handleCreateItem = async () => {
    if (!newItemName.trim() || !connectedAlias) return;
    const itemPath = `${currentPath}/${newItemName.trim()}`;
    try {
      if (newItemModal.type === 'dir') {
        await filesApi.mkdir(connectedAlias, itemPath);
      } else {
        await filesApi.write(connectedAlias, itemPath, '');
      }
      message.success(newItemModal.type === 'dir' ? 'Folder created' : 'File created');
      setNewItemModal({ open: false, type: 'dir' });
      setNewItemName('');
      refreshFiles();
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Create failed');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !connectedAlias) return;
    try {
      await filesApi.upload(connectedAlias, currentPath, file);
      message.success('Uploaded');
      refreshFiles();
    } catch {
      message.error('Upload failed');
    }
    e.target.value = '';
  };

  const activeTab = tabs.find(t => t.id === activeTabId);
  const showViewer = activeTab && VISUALIZABLE_TYPES.includes(activeTab.type) && activeTab.content;
  const fileDesc = activeTab ? getFileDescription(activeTab.type, lang) : null;

  const parts = currentPath.split('/').filter(Boolean);

  if (connecting) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <Spin /> <span style={{ color: '#888' }}>{T('center.connecting')}</span>
      </div>
    );
  }

  if (connectError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message={T('center.connection_failed')} description={connectError} showIcon />
      </div>
    );
  }

  if (!connectedAlias) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#555', fontSize: 14 }}>
        {T('center.select_server')}
      </div>
    );
  }

  return (
    <>
      {/* ===== Top toolbar: work-directory controls ===== */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
        background: '#16162a', borderBottom: '1px solid #2a2a4a', minHeight: 34,
      }}>
        <Button size="small" icon={<HomeOutlined />} onClick={() => goToPath(homePath)}
          style={{ color: '#aaa' }} type="text" />
        <Button size="small" icon={<ArrowUpOutlined />} onClick={navigateUp}
          style={{ color: '#aaa' }} type="text" />
        <Button size="small" icon={<ReloadOutlined />} onClick={refreshFiles}
          style={{ color: '#aaa' }} type="text" loading={loading} />

        {/* Set Work Dir — prominent button */}
        <Tooltip title={T('terminal.cwd_label')}>
          <Button
            size="small"
            type={workDir === currentPath ? 'primary' : 'default'}
            icon={<PushpinOutlined />}
            onClick={handleSetWorkDir}
            style={{
              fontWeight: 500, fontSize: 11,
              borderColor: workDir === currentPath ? undefined : '#444',
            }}
          >
            {workDir === currentPath ? T('center.work_dir_set') : T('center.set_work_dir')}
          </Button>
        </Tooltip>

        {/* Breadcrumb path */}
        {editingPath ? (
          <Input ref={pathInputRef} size="small" defaultValue={currentPath}
            onPressEnter={(e) => goToPath((e.target as HTMLInputElement).value)}
            onBlur={() => setEditingPath(false)}
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
            autoFocus
          />
        ) : (
          <div onClick={() => setEditingPath(true)}
            style={{ flex: 1, cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}>
            <Breadcrumb
              items={[
                { title: <HomeOutlined style={{ fontSize: 11 }} />, onClick: () => goToPath(homePath) },
                ...parts.map((p, i) => ({
                  title: <span style={{ fontSize: 11 }}>{p}</span>,
                  onClick: () => goToPath('/' + parts.slice(0, i + 1).join('/')),
                })),
              ]}
              style={{ fontSize: 11, whiteSpace: 'nowrap' }}
            />
          </div>
        )}
      </div>

      {/* ===== Bottom toolbar: file operations ===== */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '3px 8px',
        background: '#12122a', borderBottom: '1px solid #2a2a4a', minHeight: 30,
      }}>
        <span style={{ fontSize: 10, color: '#666', marginRight: 8, fontWeight: 600 }}>{T('center.files')}</span>
        <Tooltip title={T('file.new_folder')}>
          <Button type="text" size="small" icon={<FolderAddOutlined />}
            style={{ color: '#aaa' }}
            onClick={() => { setNewItemName(''); setNewItemModal({ open: true, type: 'dir' }); }} />
        </Tooltip>
        <Tooltip title={T('file.new_file')}>
          <Button type="text" size="small" icon={<FileAddOutlined />}
            style={{ color: '#aaa' }}
            onClick={() => { setNewItemName(''); setNewItemModal({ open: true, type: 'file' }); }} />
        </Tooltip>
        <Tooltip title={T('file.upload')}>
          <Button type="text" size="small" icon={<UploadOutlined />}
            style={{ color: '#aaa' }}
            onClick={() => fileInputRef.current?.click()} />
        </Tooltip>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
        <span style={{ fontSize: 10, color: '#555', marginLeft: 'auto' }}>
          {files.length} items
        </span>
      </div>

      {/* ===== File list + Editor ===== */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* File list panel */}
        <div style={{ width: 240, borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {error ? (
              <Alert type="error" message={T('center.list_failed')} description={error} showIcon style={{ margin: 8 }} />
            ) : (
              <FileListTable
                files={files}
                loading={loading}
                onFileClick={handleFileClick}
                selectedPath={selectedFile}
                onNavigateUp={navigateUp}
                currentPath={currentPath}
                onRefresh={refreshFiles}
                onNavigate={goToPath}
              />
            )}
          </div>
        </div>

        {/* Editor / Viewer area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab bar */}
          {tabs.length > 0 && (
            <div className="editor-tabs">
              {tabs.map(tab => (
                <div key={tab.id} className={`editor-tab${tab.id === activeTabId ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}>
                  <span className={tab.dirty ? 'dirty' : ''}>{tab.filename}</span>
                  <span onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    style={{ cursor: 'pointer', color: '#666', fontSize: 10 }}>✕</span>
                </div>
              ))}
            </div>
          )}

          {/* File description banner */}
          {fileDesc && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: '6px 12px', background: '#0a1628', borderBottom: '1px solid #1a3350',
            }}>
              <InfoCircleOutlined style={{ color: '#528bff', fontSize: 13, marginTop: 1 }} />
              <Typography.Text style={{ color: '#94b8e0', fontSize: 11, lineHeight: '17px' }}>
                {fileDesc}
              </Typography.Text>
            </div>
          )}

          <div className="editor-content">
            {showViewer ? (
              <FileViewer
                fileType={activeTab!.type}
                filename={activeTab!.filename}
                content={activeTab!.content}
                filePath={activeTab!.path}
                onContentChange={(v) => updateContent(activeTab!.id, v)}
                onSave={() => handleSave(activeTab!.id)}
                onDiscard={() => {
                  filesApi.read(connectedAlias!, activeTab!.path).then(res => {
                    updateContent(activeTab!.id, res.data.content);
                    markClean(activeTab!.id);
                  });
                }}
              />
            ) : activeTab ? (
              <MonacoEditor
                value={activeTab.content}
                language={activeTab.type === 'incar' ? 'ini' : 'plaintext'}
                onChange={(v) => updateContent(activeTab.id, v || '')}
                onSave={() => handleSave(activeTab.id)}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: '#555', fontSize: 14 }}>
                {T('center.select_file')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New folder/file modal */}
      <Modal
        title={newItemModal.type === 'dir' ? T('file.new_folder') : T('file.new_file')}
        open={newItemModal.open}
        onOk={handleCreateItem}
        onCancel={() => setNewItemModal({ open: false, type: 'dir' })}
        okText={T('file.ok')}
        cancelText={T('file.cancel')}
      >
        <Input
          value={newItemName}
          onChange={e => setNewItemName(e.target.value)}
          onPressEnter={handleCreateItem}
          placeholder={newItemModal.type === 'dir' ? T('file.enter_folder_name') : T('file.enter_file_name')}
          autoFocus
        />
      </Modal>
    </>
  );
}
