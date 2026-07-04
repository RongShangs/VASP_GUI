export interface JobInfo {
  job_id: string;
  status: string;
  remote_pid: number | null;
  calc_type: string;
  project_path: string;
  submitted_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  energy_final: number | null;
  error_message: string | null;
}

export interface EnergyStep {
  step: number;
  energy: number;
  free_energy: number | null;
  temperature: number | null;
  delta_e: number | null;
  ionic_step: number | null;
  step_type: 'electronic' | 'ionic';
}

export interface JobProgress {
  ionicCurrent: number;
  totalIonicSteps: number;
  elecCurrent: number;
  maxElectronicSteps: number;
  currentEnergy: number | null;
  currentFreeEnergy: number | null;
  convergenceReached: boolean;
  elapsedSeconds: number;
}
