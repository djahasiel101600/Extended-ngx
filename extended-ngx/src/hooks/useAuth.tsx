import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { AuthState } from '@/types';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    user: null,
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = api.getToken();
    if (token) {
      validateToken();
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateToken = async () => {
    try {
      const user = await api.getCurrentUser();
      setAuthState({
        token: api.getToken(),
        user,
        isAuthenticated: true,
      });
    } catch {
      api.clearToken();
      setAuthState({
        token: null,
        user: null,
        isAuthenticated: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const { token } = await api.login(username, password);
    api.setToken(token);
    
    try {
      const user = await api.getCurrentUser();
      setAuthState({
        token,
        user,
        isAuthenticated: true,
      });
    } catch {
      // If we can't get user info, still consider logged in with token
      setAuthState({
        token,
        user: null,
        isAuthenticated: true,
      });
    }
  };

  const loginWithToken = async (token: string) => {
    api.setToken(token);
    
    try {
      const user = await api.getCurrentUser();
      setAuthState({
        token,
        user,
        isAuthenticated: true,
      });
    } catch {
      // If we can't get user info, still consider logged in with token
      setAuthState({
        token,
        user: null,
        isAuthenticated: true,
      });
    }
  };

  const logout = () => {
    api.clearToken();
    setAuthState({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, loginWithToken, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
