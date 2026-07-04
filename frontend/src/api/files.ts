import apiClient from './client';
import type { FileNode, FileContent } from '../types/files';

// Helper: download file with auth headers via fetch + blob
async function downloadWithAuth(url: string, filename: string) {
  const token = localStorage.getItem('access_token') || '';
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export const filesApi = {
  list: (alias: string, path: string = '/') =>
    apiClient.get<FileNode[]>(`/files/${alias}`, { params: { path } }),
  read: (alias: string, path: string) =>
    apiClient.get<FileContent>(`/files/${alias}/read`, { params: { path } }),
  write: (alias: string, path: string, content: string) =>
    apiClient.post(`/files/${alias}/write`, { path, content }),
  mkdir: (alias: string, path: string) =>
    apiClient.post(`/files/${alias}/mkdir`, { path }),
  delete: (alias: string, path: string, isDir: boolean = false) =>
    apiClient.delete(`/files/${alias}`, { params: { path, is_dir: isDir } }),
  rename: (alias: string, oldPath: string, newPath: string) =>
    apiClient.post(`/files/${alias}/rename`, { old_path: oldPath, new_path: newPath }),
  copy: (alias: string, src: string, dst: string) =>
    apiClient.post(`/files/${alias}/copy`, { src, dst }),
  upload: (alias: string, path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`/files/${alias}/upload`, form, { params: { path } });
  },
  downloadUrl: (alias: string, path: string) =>
    (apiClient.defaults.baseURL || '') + `/files/${alias}/download?path=${encodeURIComponent(path)}`,
  download: (alias: string, path: string, filename: string) => {
    const url = (apiClient.defaults.baseURL || '') + `/files/${alias}/download?path=${encodeURIComponent(path)}`;
    return downloadWithAuth(url, filename);
  },
};
