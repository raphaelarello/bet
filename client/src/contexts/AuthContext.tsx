// Rapha Guru — AuthContext

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';

// ── Tipos ─────────────────────────────────────────────────────
export interface Subscription {
  plan_slug: string; plan_name: string; status: string;
  billing_cycle: string; amount_brl: number;
  period_start: number | null; period_end: number | null;
  features: string[]; limits: Record<string, number>;
  badge_color: string;
}

export interface AuthUser {
  id: number; email: string; name: string; role: string;
  avatar_url?: string | null; phone?: string | null;
  email_verified: number; login_count: number;
  last_login_at: number | null; created_at: number;
}

export const PLAN_RANK: Record<string, number> = Object.freeze({
  free: 0, basic: 1, pro: 2, elite: 3, admin: 99,
});

export const PLAN_META: Record<string, { name: string; color: string; glow: string; icon: string }> = Object.freeze({
  free:  { name: 'Gratuito', color: '#6b7280', glow: 'rgba(107,114,128,.2)',  icon: '🎁' },
  basic: { name: 'Básico',   color: '#3b82f6', glow: 'rgba(59,130,246,.25)',  icon: '⭐' },
  pro:   { name: 'Pro',      color: '#a855f7', glow: 'rgba(168,85,247,.25)',  icon: '⚡' },
  elite: { name: 'Elite',    color: '#f59e0b', glow: 'rgba(245,158,11,.25)',  icon: '👑' },
  admin: { name: 'Admin',    color: '#ef4444', glow: 'rgba(239,68,68,.25)',   icon: '🛡️' },
});

interface AuthCtx {
  user: AuthUser | null;
  subscription: Subscription | null;
  usage30d: Record<string, number>;
  unread: number;
  token: string | null;
  loading: boolean;
  login(email: string, password: string): Promise<boolean>;
  register(email: string, name: string, password: string): Promise<boolean>;
  logout(): void;
  refresh(): Promise<void>;
  hasMinPlan(plan: string): boolean;
  isAdmin: boolean;
  planLevel: number;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = 'rg_auth_token';

async function apiFetch<T>(url: string, token: string | null, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  const data = await r.json() as T & { error?: string };
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [sub,     setSub]     = useState<Subscription | null>(null);
  const [usage,   setUsage]   = useState<Record<string, number>>({});
  const [unread,  setUnread]  = useState(0);
  const [token,   setToken]   = useState<string | null>(() => localStorage.getItem(KEY));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = localStorage.getItem(KEY);
    if (!t) { setLoading(false); return; }
    try {
      const d = await apiFetch<{
        user: AuthUser; subscription: Subscription | null;
        usage_30d: Record<string, number>; unread_notifications: number;
      }>('/api/auth/me', t);
      setUser(d.user); setSub(d.subscription); setUsage(d.usage_30d ?? {}); setUnread(d.unread_notifications ?? 0);
      setToken(t);
    } catch {
      localStorage.removeItem(KEY); setToken(null); setUser(null); setSub(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      const d = await apiFetch<{ token: string; user: AuthUser; subscription: Subscription | null }>(
        '/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email, password }) }
      );
      localStorage.setItem(KEY, d.token); setToken(d.token); setUser(d.user); setSub(d.subscription);
      toast.success(`Bem-vindo, ${d.user.name}! 👋`);
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro no login'); return false; }
    finally { setLoading(false); }
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    try {
      setLoading(true);
      const d = await apiFetch<{ token: string; user: AuthUser }>(
        '/api/auth/register', null, { method: 'POST', body: JSON.stringify({ email, name, password }) }
      );
      localStorage.setItem(KEY, d.token); setToken(d.token); setUser(d.user);
      toast.success('Conta criada! Bem-vindo ao Rapha Guru 🎉');
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao criar conta'); return false; }
    finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    const t = localStorage.getItem(KEY);
    if (t) fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    localStorage.removeItem(KEY); setToken(null); setUser(null); setSub(null);
    toast.info('Sessão encerrada');
  }, []);

  const hasMinPlan = useCallback((plan: string) => {
    return (PLAN_RANK[user?.role ?? 'free'] ?? 0) >= (PLAN_RANK[plan] ?? 0);
  }, [user]);

  return (
    <Ctx.Provider value={{
      user, subscription: sub, usage30d: usage, unread, token, loading,
      login, register, logout, refresh, hasMinPlan,
      isAdmin: user?.role === 'admin',
      planLevel: PLAN_RANK[user?.role ?? 'free'] ?? 0,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do <AuthProvider>');
  return c;
}
