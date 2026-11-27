import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { StudentGender } from '../components/StudentGenderField';
import { api, setCsrf, type ApiOne } from '../lib/api';

export type RegistrationResult = { delivered: boolean; resendAfterSeconds: number; delivery?: 'local' };

export type AuthMe = {
  user: { id: string; name: string; email: string; directStudent?: { studentCode: string; gender: StudentGender | null } | null };
  tenant: { id: string; name: string; slug: string } | null;
  roles: string[];
  scope: 'PLATFORM' | 'TENANT' | 'STUDENT';
  csrfToken: string;
};
type AuthContextValue = {
  me: AuthMe | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, phone: string, password: string, confirmPassword: string, gender: string) => Promise<RegistrationResult>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const response = await api<ApiOne<AuthMe>>('/auth/me'); setCsrf(response.data.csrfToken); setMe(response.data); }
    catch { setCsrf(''); setMe(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function login(email: string, password: string, tenantSlug?: string) {
    const response = await api<ApiOne<{ csrfToken: string }>>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password, ...(tenantSlug ? { tenantSlug } : {}) }),
    });
    setCsrf(response.data.csrfToken);
    await refresh();
  }
  async function register(name: string, email: string, phone: string, password: string, confirmPassword: string, gender: string) {
    const response = await api<ApiOne<RegistrationResult>>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, phone, password, confirmPassword, gender }) });
    return response.data;
  }
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); }
    finally { setCsrf(''); setMe(null); }
  }
  return <AuthContext.Provider value={{ me, loading, refresh, login, logout, register }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider missing.');
  return context;
}
