import apiClient from './client';
import type { DOSData, BandData, EnergyData, OpticalData } from '../types/chart';

export const postprocessApi = {
  dos: (serverAlias: string, projectPath: string) =>
    apiClient.post<{ status: string; data: DOSData }>('/postprocess/dos', {
      server_alias: serverAlias, project_path: projectPath,
    }),

  band: (serverAlias: string, projectPath: string) =>
    apiClient.post<{ status: string; data: BandData }>('/postprocess/band', {
      server_alias: serverAlias, project_path: projectPath,
    }),

  energy: (serverAlias: string, projectPath: string) =>
    apiClient.post<{ status: string; data: EnergyData }>('/postprocess/energy', {
      server_alias: serverAlias, project_path: projectPath,
    }),

  optical: (serverAlias: string, projectPath: string) =>
    apiClient.post<{ status: string; data: OpticalData }>('/postprocess/optical', {
      server_alias: serverAlias, project_path: projectPath,
    }),

  exportData: (serverAlias: string, projectPath: string, format: string, type: string) =>
    apiClient.post<{ status: string; format: string; data: any }>('/postprocess/export', {
      server_alias: serverAlias, project_path: projectPath, format, type,
    }),
};
