import { create } from 'zustand';

export interface EditorTab {
  id: string;
  path: string;
  filename: string;
  type: 'incar' | 'kpoints' | 'poscar' | 'potcar' | 'outcar' | 'oszicar' | 'vasprun' | 'binary' | 'text';
  dirty: boolean;
  content: string;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  openFile: (tab: EditorTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  markClean: (id: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  openFile: (tab) => {
    const existing = get().tabs.find(t => t.path === tab.path);
    if (existing) {
      set({ activeTabId: existing.id });
    } else {
      set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
    }
  },
  closeTab: (id) => {
    set(s => {
      const idx = s.tabs.findIndex(t => t.id === id);
      const newTabs = s.tabs.filter(t => t.id !== id);
      let newActive = s.activeTabId;
      if (s.activeTabId === id) {
        newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null;
      }
      return { tabs: newTabs, activeTabId: newActive };
    });
  },
  setActiveTab: (id) => set({ activeTabId: id }),
  updateContent: (id, content) => {
    set(s => ({
      tabs: s.tabs.map(t => t.id === id ? { ...t, content, dirty: true } : t),
    }));
  },
  markClean: (id) => {
    set(s => ({
      tabs: s.tabs.map(t => t.id === id ? { ...t, dirty: false } : t),
    }));
  },
}));
