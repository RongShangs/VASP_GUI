export interface ChartDataPoint {
  step: number;
  energy: number;
  delta_e?: number;
  step_type: string;
}

// ── DOS ──────────────────────────────────────────────────────

export interface DOSPoint {
  energy: number;
  dos_up: number;
  dos_down: number;
  idos_up: number;
  idos_down: number;
}

export interface DOSData {
  nedos: number;
  e_fermi: number;
  nions: number;
  tdos: DOSPoint[];
  pdos: Array<Array<Record<string, number>>>;
}

// ── Band Structure ───────────────────────────────────────────

export interface KpointInfo {
  x: number;
  y: number;
  z: number;
  weight: number;
  index: number;
}

export interface BandData {
  n_kpoints: number;
  n_bands: number;
  n_electrons: number;
  e_fermi: number;
  kpoints: KpointInfo[];
  bands: number[][];
  occupancies: number[][];
  kpath_labels: string[];
}

// ── Energy ───────────────────────────────────────────────────

export interface IonicBoundary {
  ion_step: number;
  position: number;
}

export interface EnergyData {
  steps: Array<{
    step: number;
    energy: number;
    free_energy: number;
    temperature: number;
    delta_e: number;
    ionic_step: number;
    step_type: string;
  }>;
  ionic_boundaries: IonicBoundary[];
  total_ionic_steps: number;
  nsw: number | null;
}

// ── Optical ──────────────────────────────────────────────────

export interface OpticalData {
  dielectric_tensor: Record<string, number> | null;
  frequency_dependent: {
    energies: number[];
    eps_real_avg: number[];
    eps_imag_avg: number[];
  } | null;
}

// ── Progress (WebSocket) ─────────────────────────────────────

export interface ProgressUpdate {
  event_type: 'ionic_start' | 'electronic_step' | 'convergence' | 'complete' | 'error';
  ionic_step: number | null;
  total_ionic_steps: number | null;
  electronic_step: number | null;
  energy: number | null;
  free_energy: number | null;
  delta_e: number | null;
  convergence_reached: boolean;
  elapsed_seconds: number | null;
}
