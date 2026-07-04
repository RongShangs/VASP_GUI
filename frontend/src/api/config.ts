import apiClient from './client';

export const configApi = {
  get: () => apiClient.get('/config'),
};
