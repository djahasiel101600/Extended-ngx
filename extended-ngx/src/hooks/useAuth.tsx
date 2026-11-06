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

  // Resolve the profile for the given token. Identity lookup falls back across
  // several Paperless-ngx endpoints (see api.fetchCurrentUser), so a token that
  // authenticates fine for documents but has no readable profile still yields a
  // session — with `user: null` — rather than bouncing the user to /login.
  // A rejected token (401) propagates here and clears the session.
  const establishSession = async (token: string) => {
    const user = await api.fetchCurrentUser();
    setAuthState({ token, user, isAuthenticated: true });
  };

  const validateToken = async () => {
    const token = api.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      await establishSession(token);
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
    await establishSession(token);
  };

  const loginWithToken = async (token: string) => {
    api.setToken(token);
    await establishSession(token);
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
