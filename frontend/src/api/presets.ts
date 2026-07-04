import apiClient from './client';
import type { VASPCalcType } from '../types/vasp';

export const presetsApi = {
  list: (params?: { category?: string; search?: string }) =>
    apiClient.get<VASPCalcType[]>('/presets', { params }),
  categories: () => apiClient.get('/presets/categories'),
  get: (key: string) => apiClient.get(`/presets/${key}`),
};
