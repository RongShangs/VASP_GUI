import apiClient from './client';
import type { ServerNode } from '../types/server';

export const serversApi = {
  list: () => apiClient.get<ServerNode[]>('/servers'),
  create: (data: any) => apiClient.post<ServerNode>('/servers', data),
  update: (id: number, data: any) => apiClient.put<ServerNode>(`/servers/${id}`, data),
  delete: (id: number) => apiClient.delete(`/servers/${id}`),
  test: (id: number) => apiClient.post<{ success: boolean; message: string; home?: string; vasp_versions?: { name: string; path: string; version: string }[] }>(`/servers/${id}/test`),
  disconnect: (id: number) => apiClient.post(`/servers/${id}/disconnect`),
};
