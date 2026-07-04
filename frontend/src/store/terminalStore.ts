import { create } from 'zustand';

interface TerminalState {
  sendCommand: ((cmd: string) => void) | null;
  registerTerminal: (fn: (cmd: string) => void) => void;
  unregisterTerminal: () => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sendCommand: null,
  registerTerminal: (fn) => set({ sendCommand: fn }),
  unregisterTerminal: () => set({ sendCommand: null }),
}));
