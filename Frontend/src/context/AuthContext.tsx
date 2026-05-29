import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const BASE_URL = 'https://sentiview-api-j728.onrender.com';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  name: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sentiview_token'));
  const [loading, setLoading] = useState(true);

  // Restore session on load
  useEffect(() => {
    if (token) {
      fetch(`${BASE_URL}/auth/me/`, {
        headers: { Authorization: `Token ${token}` },
      })
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then(setUser)
        .catch(() => { setToken(null); localStorage.removeItem('sentiview_token'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('sentiview_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (name: string, username: string, email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    localStorage.setItem('sentiview_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    if (token) {
      fetch(`${BASE_URL}/auth/logout/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('sentiview_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout,
      isAuthenticated: !!user,
      isAdmin: !!(user?.is_admin),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ✅ Fixed: Don't force Content-Type for FormData (file uploads)
export function authFetch(url: string, token: string | null, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;

  return fetch(url, {
    ...options,
    headers: {
      // ✅ Skip Content-Type for FormData — browser sets multipart/form-data automatically
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}