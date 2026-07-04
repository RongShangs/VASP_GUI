import { create } from 'zustand';
import type { ServerNode } from '../types/server';
import { serversApi } from '../api/servers';

const CONNECT_TIMEOUT_MS = 15000;
const LS_KEY_ALIAS = 'vasp_last_alias';
const LS_KEY_DIR = 'vasp_last_dir';

interface ClipboardItem {
  path: string;
  name: string;
  type: 'file' | 'dir';
  operation: 'copy' | 'cut';
}

interface ConnectionState {
  servers: ServerNode[];
  connectedAlias: string | null;
  homePath: string;
  workDir: string;
  currentCwd: string;
  connecting: boolean;
  connectError: string | null;
  vaspVersions: { name: string; path: string; version: string }[];
  clipboard: ClipboardItem | null;
  autoConnecting: boolean;
  setServers: (servers: ServerNode[]) => void;
  connect: (alias: string) => Promise<boolean>;
  disconnect: () => void;
  setHomePath: (path: string) => void;
  setWorkDir: (dir: string) => void;
  setCurrentCwd: (dir: string) => void;
  setClipboard: (item: ClipboardItem | null) => void;
  clearConnectError: () => void;
  autoConnect: () => Promise<boolean>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  servers: [],
  connectedAlias: null,
  homePath: '/',
  workDir: '/',
  currentCwd: '/',
  connecting: false,
  connectError: null,
  vaspVersions: [],
  clipboard: null,
  autoConnecting: false,

  setServers: (servers) => set({ servers }),

  connect: async (alias) => {
    const server = get().servers.find(s => s.alias === alias);
    if (!server) {
      set({ connectError: 'Server not found' });
      return false;
    }

    set({ connecting: true, connectError: null });

    const timeoutId = setTimeout(() => {
      if (get().connecting) {
        set({ connecting: false, connectError: 'Connection timed out' });
      }
    }, CONNECT_TIMEOUT_MS);

    try {
      const r = await serversApi.test(server.id);
      clearTimeout(timeoutId);

      if (r.data.success) {
        // Restore last work dir if available, otherwise use home
        const savedDir = localStorage.getItem(LS_KEY_DIR);
        const initDir = savedDir || r.data.home || '/';
        // Persist last alias
        localStorage.setItem(LS_KEY_ALIAS, alias);
        set({
          connectedAlias: alias,
          homePath: r.data.home || '/',
          workDir: initDir,
          connecting: false,
          vaspVersions: r.data.vasp_versions || [],
          connectError: null,
        });
        return true;
      } else {
        set({ connecting: false, connectError: r.data.message });
        return false;
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      const status = e.response?.status;
      const detail = e.response?.data?.detail;
      if (status === 401) {
        set({ connecting: false, connectError: 'Authentication required — please log in again' });
      } else {
        set({ connecting: false, connectError: detail || e.message || 'Connection failed' });
      }
      return false;
    }
  },

  disconnect: () => {
    const alias = get().connectedAlias;
    if (alias) {
      const server = get().servers.find(s => s.alias === alias);
      if (server) serversApi.disconnect(server.id).catch(() => {});
    }
    set({ connectedAlias: null, homePath: '/', workDir: '/', connectError: null, vaspVersions: [] });
  },

  setHomePath: (path) => set({ homePath: path }),
  setWorkDir: (dir) => {
    localStorage.setItem(LS_KEY_DIR, dir);
    set({ workDir: dir, currentCwd: dir });
  },
  setCurrentCwd: (dir) => set({ currentCwd: dir }),
  setClipboard: (item) => set({ clipboard: item }),
  clearConnectError: () => set({ connectError: null }),

  // Try to reconnect to the last-used server on startup
  autoConnect: async () => {
    const lastAlias = localStorage.getItem(LS_KEY_ALIAS);
    if (!lastAlias) return false;

    // If servers not loaded yet, wait and retry (up to 3s)
    let servers = get().servers;
    if (!servers.length) {
      await new Promise(r => setTimeout(r, 1000));
      servers = get().servers;
    }
    if (!servers.length) {
      // Servers still not loaded — the backend may be unavailable
      set({ autoConnecting: false, connectError: 'Cannot load server list — backend may be down' });
      return false;
    }

    const server = servers.find(s => s.alias === lastAlias);
    if (!server) {
      localStorage.removeItem(LS_KEY_ALIAS);
      localStorage.removeItem(LS_KEY_DIR);
      set({ autoConnecting: false });
      return false;
    }

    set({ autoConnecting: true, connectError: null });
    let ok = await get().connect(lastAlias);

    // If first attempt fails, retry once after 1.5s (server may be starting up)
    if (!ok) {
      set({ autoConnecting: true, connectError: null });
      await new Promise(r => setTimeout(r, 1500));
      ok = await get().connect(lastAlias);
    }

    set({ autoConnecting: false });
    return ok;
  },
}));
