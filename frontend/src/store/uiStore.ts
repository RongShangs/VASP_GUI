import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'zh' | 'en';

interface UIState {
  lang: Lang;
  leftPanelCollapsed: boolean;
  leftPanelWide: boolean;
  rightPanelCollapsed: boolean;
  rightPanelMode: 'idle' | 'running' | 'postprocess';
  setLang: (lang: Lang) => void;
  toggleLeftPanel: () => void;
  toggleLeftPanelWide: () => void;
  toggleRightPanel: () => void;
  setRightPanelMode: (mode: 'idle' | 'running' | 'postprocess') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      lang: 'zh',
      leftPanelCollapsed: false,
      leftPanelWide: false,
      rightPanelCollapsed: false,
      rightPanelMode: 'idle',
      setLang: (lang) => set({ lang }),
      toggleLeftPanel: () => set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
      toggleLeftPanelWide: () => set((s) => ({ leftPanelWide: !s.leftPanelWide })),
      toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
      setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
    }),
    { name: 'vasp-ui-store', partialize: (s) => ({ lang: s.lang }) }
  )
);
