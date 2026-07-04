import { create } from 'zustand';
import type { JobInfo, EnergyStep, JobProgress } from '../types/job';

interface JobState {
  activeJob: JobInfo | null;
  chartData: EnergyStep[];
  consoleLines: string[];
  progress: JobProgress | null;
  setActiveJob: (job: JobInfo | null) => void;
  addChartPoint: (point: EnergyStep) => void;
  addConsoleLine: (line: string) => void;
  setProgress: (p: Partial<JobProgress>) => void;
  clearJob: () => void;
}

export const useJobStore = create<JobState>((set) => ({
  activeJob: null,
  chartData: [],
  consoleLines: [],
  progress: null,
  setActiveJob: (job) => set({ activeJob: job }),
  addChartPoint: (point) => set(s => ({ chartData: [...s.chartData.slice(-5000), point] })),
  addConsoleLine: (line) => set(s => ({ consoleLines: [...s.consoleLines.slice(-2000), line] })),
  setProgress: (p) => set(s => ({
    progress: s.progress ? { ...s.progress, ...p } : {
      ionicCurrent: p.ionicCurrent ?? 0,
      totalIonicSteps: p.totalIonicSteps ?? 0,
      elecCurrent: p.elecCurrent ?? 0,
      maxElectronicSteps: p.maxElectronicSteps ?? 60,
      currentEnergy: p.currentEnergy ?? null,
      currentFreeEnergy: p.currentFreeEnergy ?? null,
      convergenceReached: p.convergenceReached ?? false,
      elapsedSeconds: p.elapsedSeconds ?? 0,
    },
  })),
  clearJob: () => set({ activeJob: null, chartData: [], consoleLines: [], progress: null }),
}));
