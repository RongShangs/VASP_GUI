import apiClient from './client';
import type { JobInfo } from '../types/job';

export const jobsApi = {
  submit: (data: any) => apiClient.post<{ job_id: string }>('/jobs/submit', data),
  cancel: (jobId: string) => apiClient.post(`/jobs/${jobId}/cancel`),
  status: (jobId: string) => apiClient.get<JobInfo>(`/jobs/${jobId}/status`),
  list: (page: number = 1, limit: number = 20) =>
    apiClient.get<JobInfo[]>('/jobs', { params: { page, limit } }),
};
