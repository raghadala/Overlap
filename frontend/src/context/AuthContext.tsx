import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';

interface User {
  id: number;
  email: string;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('overlap_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('overlap_user');
    return saved ? JSON.parse(saved) : null;
  });

  function persist(newToken: string, newUser: User) {
    localStorage.setItem('overlap_token', newToken);
    localStorage.setItem('overlap_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    persist(res.token, res.user);
  }

  async function signup(email: string, password: string) {
    const res = await api.signup(email, password);
    persist(res.token, res.user);
  }

  async function loginWithGoogle(idToken: string) {
    const res = await api.loginWithGoogle(idToken);
    persist(res.token, res.user);
  }

  function logout() {
    localStorage.removeItem('overlap_token');
    localStorage.removeItem('overlap_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
