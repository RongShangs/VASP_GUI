import { useState, useCallback } from 'react';
import { filesApi } from '../api/files';
import type { FileNode } from '../types/files';

export function useFileTree(alias: string | null) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async (path: string) => {
    if (!alias) return;
    setLoading(true);
    setError(null);
    try {
      const res = await filesApi.list(alias, path);
      setFiles(res.data);
      setCurrentPath(path);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, [alias]);

  const navigateUp = useCallback(() => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadFiles(parent);
  }, [currentPath, loadFiles]);

  return { files, currentPath, loading, error, loadFiles, navigateUp, setCurrentPath };
}
