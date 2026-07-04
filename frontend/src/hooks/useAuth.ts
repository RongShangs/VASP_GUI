import { useEffect } from 'react';
import { useAuthStore } from '../store';

/**
 * Hook that verifies authentication status on mount and exposes
 * login/logout/check helpers.
 */
export function useAuth() {
  const { isLoggedIn, loading, requirePassword, username, checkAuth, login, logout } =
    useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isLoggedIn,
    loading,
    requirePassword,
    username,
    login,
    logout,
    refresh: checkAuth,
  };
}
