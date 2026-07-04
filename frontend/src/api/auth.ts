import apiClient from './client';

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),
  register: (username: string, password: string, email?: string) =>
    apiClient.post('/auth/register', { username, password, email }),
  refresh: (refresh_token: string) =>
    apiClient.post('/auth/refresh', { refresh_token }),
  requirePassword: () => apiClient.get('/auth/require-password'),
  me: () => apiClient.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.put('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
  changeUsername: (newUsername: string) =>
    apiClient.put('/auth/change-username', { new_username: newUsername }),
};
