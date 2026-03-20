// Rapha Guru — Painel Administrativo Completo
// Design: "Command Center" — dark ops, data-dense, professional

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth, PLAN_META } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, DollarSign, TrendingUp, TrendingDown, ArrowLeft,
  RefreshCw, Shield, Search, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, BarChart2, Activity, Loader2,
  Edit2, Trash2, Bell, Download, Zap, Crown, Star,
  MoreVertical, Send, UserCheck, Clock, Package,
  AlertTriangle, Eye, Wifi,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
interface Dashboard {
  users: { total: number; active_today: number; new_today: number; new_week: number; new_month: number; paid_subs: number };
  revenue: { today: number; week: number; month: number; mrr: number; churn_month: number };
  plan_distribution: { plan_slug: string; n: number }[];
  recent_payments: Record<string, unknown>[];
  top_actions: { action: string; n: number }[];
  revenue_chart: { day: string; total: number; n: number }[];
}

interface UserRow {
  id: number; email: string; name: string; role: string;
  is_active: number; email_verified: number;
  last_login_at: number | null; login_count: number; created_at: number;
  plan_slug: string | null; sub_status: string | null; period_end: number | null;
}

interface Realtime {
  active_last_hour: number; actions_last_hour: number;
  pending_payments: number; pending_amount: number;
  recent_signups: { name: string; email: string; created_at: number }[];
  recent_actions: { user_id: number; action: string; created_at: number }[];
}

// ── Helpers ────────────────────────────────────────────────────
const fmt = (ts: number) => new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtBrl = (v: number) => `R$ ${Number(v).toFixed(2)}`;
const fmtK = (v: number) => v >= 1000 ? `R$ ${(v/1000).toFixed(1)}k` : fmtBrl(v);
const dayLabel = (s: string) => s?.slice(5) ?? '';

const PIE_COLORS = ['#6b7280', '#3b82f6', '#a855f7', '#f59e0b'];
const PLAN_COLOR: Record<string, string> = { free: '#6b7280', basic: '#3b82f6', pro: '#a855f7', elite: '#f59e0b', admin: '#ef4444' };
const METHOD_LABEL: Record<string, string> = { pix: 'PIX', credit_card: 'Cartão', boleto: 'Boleto' };
const ACTION_LABEL: Record<string, string> = {
  analysis: 'Análise', favorite: 'Favorito', betslip_add: 'Bilhete',
  alert: 'Alerta', comparison: 'Comparação',
};

// ── Componente principal ───────────────────────────────────────
export default function AdminPanel() {
  const [, go] = useLocation();
  const { user, token, isAdmin } = useAuth();
  const [tab, setTab] = useState<'dashboard' | 'usuarios' | 'planos' | 'comunicacao' | 'relatorios'>('dashboard');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [realtime, setRealtime] = useState<Realtime | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleF, setRoleF] = useState('');
  const [reports, setReports] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState('');
  const [notifyTarget, setNotifyTarget] = useState<'all' | 'plan' | 'user' | null>(null);
  const [notifyPlan, setNotifyPlan] = useState('');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifyUserId, setNotifyUserId] = useState('');
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [editingPlan, setEditingPlan] = useState<Record<string, unknown> | null>(null);
  const [reportsRange, setReportsRange] = useState(30);

  const authH = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadDash = useCallback(async () => {
    setBusy(true);
    const r = await fetch('/api/admin/dashboard', { headers: authH });
    if (r.ok) setDash(await r.json() as Dashboard);
    setBusy(false);
  }, [token]);

  const loadRealtime = useCallback(async () => {
    const r = await fetch('/api/admin/realtime', { headers: authH });
    if (r.ok) setRealtime(await r.json() as Realtime);
  }, [token]);

  const loadUsers = useCallback(async () => {
    setBusy(true);
    const q = new URLSearchParams({ page: String(page), limit: '20', q: search, role: roleF });
    const r = await fetch(`/api/admin/users?${q}`, { headers: authH });
    if (r.ok) {
      const d = await r.json() as { users: UserRow[]; total: number };
      setUsers(d.users); setTotal(d.total);
    }
    setBusy(false);
  }, [token, page, search, roleF]);

  const loadReports = useCallback(async () => {
    setBusy(true);
    const r = await fetch(`/api/admin/reports?days=${reportsRange}`, { headers: authH });
    if (r.ok) setReports(await r.json() as Record<string, unknown>);
    setBusy(false);
  }, [token, reportsRange]);

  const loadPlans = useCallback(async () => {
    const r = await fetch('/api/payments/plans');
    if (r.ok) { const d = await r.json() as { plans: Record<string, unknown>[] }; setPlans(d.plans); }
  }, []);

  useEffect(() => {
    if (tab === 'dashboard') { loadDash(); loadRealtime(); }
    if (tab === 'usuarios') loadUsers();
    if (tab === 'relatorios') loadReports();
    if (tab === 'planos') loadPlans();
  }, [tab]);

  useEffect(() => {
    if (tab === 'usuarios') loadUsers();
  }, [page, search, roleF]);

  useEffect(() => {
    if (tab === 'relatorios') loadReports();
  }, [reportsRange]);

  // Auto-refresh realtime a cada 30s
  useEffect(() => {
    if (tab !== 'dashboard') return;
    const t = setInterval(loadRealtime, 30000);
    return () => clearInterval(t);
  }, [tab, loadRealtime]);

  const patchUser = async () => {
    if (!editing) return;
    const r = await fetch(`/api/admin/users/${editing.id}`, {
      method: 'PATCH', headers: authH,
      body: JSON.stringify({ role: editRole }),
    });
    if (r.ok) { toast.success('Plano atualizado!'); setEditing(null); loadUsers(); }
    else toast.error('Erro ao atualizar');
  };

  const deleteUser = async (u: UserRow) => {
    if (!confirm(`Excluir ${u.name} permanentemente? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE', headers: authH });
    toast.success('Usuário excluído');
    loadUsers();
  };

  const toggleActive = async (u: UserRow) => {
    await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH', headers: authH,
      body: JSON.stringify({ is_active: u.is_active ? 0 : 1 }),
    });
    loadUsers();
  };

  const impersonate = async (u: UserRow) => {
    const r = await fetch(`/api/admin/users/${u.id}/impersonate`, { method: 'POST', headers: authH });
    const d = await r.json() as { token?: string; error?: string };
    if (d.token) {
      const prev = localStorage.getItem('rg_auth_token');
      localStorage.setItem('rg_admin_prev_token', prev ?? '');
      localStorage.setItem('rg_auth_token', d.token);
      toast.success(`Logado como ${u.name}. Recarregando...`);
      setTimeout(() => { window.location.href = '/'; }, 1000);
    } else toast.error(d.error ?? 'Erro');
  };

  const sendNotification = async () => {
    if (!notifyTitle || !notifyBody) { toast.error('Preencha título e mensagem'); return; }
    setBusy(true);
    let url = '/api/admin/notify-all';
    const body: Record<string, unknown> = { title: notifyTitle, body: notifyBody };
    if (notifyTarget === 'plan') body.plan_filter = notifyPlan;
    if (notifyTarget === 'user') url = `/api/admin/users/${notifyUserId}/notify`;
    const r = await fetch(url, { method: 'POST', headers: authH, body: JSON.stringify(body) });
    const d = await r.json() as { ok?: boolean; sent?: number; error?: string };
    if (d.ok) {
      toast.success(d.sent ? `Enviado para ${d.sent} usuários!` : 'Notificação enviada!');
      setNotifyTitle(''); setNotifyBody(''); setNotifyTarget(null);
    } else toast.error(d.error ?? 'Erro');
    setBusy(false);
  };

  const exportCSV = () => {
    window.open('/api/admin/export/users', '_blank');
  };

  const savePlan = async () => {
    if (!editingPlan) return;
    const r = await fetch('/api/admin/plans', {
      method: 'POST', headers: authH, body: JSON.stringify(editingPlan),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) { toast.success('Plano salvo!'); setEditingPlan(null); loadPlans(); }
    else toast.error(d.error ?? 'Erro');
  };

  if (!isAdmin) return (
    <div style={{ minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Shield style={{ width: 40, height: 40, color: '#ef4444', margin: '0 auto 12px' }} />
        <p style={{ color: '#4a5568', marginBottom: 12, fontFamily: 'system-ui' }}>Acesso restrito a administradores</p>
        <button onClick={() => go('/')} style={{ padding: '8px 18px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Voltar</button>
      </div>
    </div>
  );

  const S = {
    page:  { minHeight: '100vh', background: '#060810', color: '#e8eeff', fontFamily: "'DM Sans', system-ui, sans-serif" } as React.CSSProperties,
    card:  { background: '#0d1117', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12 } as React.CSSProperties,
    card2: { background: '#0d1117', border: '1px solid rgba(239,68,68,.15)', borderRadius: 12 } as React.CSSProperties,
    inp:   { width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', color: '#e8eeff', fontSize: 13, outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
    btn:   (c: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, background: c, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' } as React.CSSProperties),
  };

  const TABS = [
    { id: 'dashboard',    label: 'Dashboard',      Icon: BarChart2 },
    { id: 'usuarios',     label: 'Usuários',        Icon: Users },
    { id: 'planos',       label: 'Planos',          Icon: Package },
    { id: 'comunicacao',  label: 'Comunicação',     Icon: Bell },
    { id: 'relatorios',   label: 'Relatórios',      Icon: TrendingUp },
  ] as const;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ background: '#0d1117', borderBottom: '1px solid rgba(239,68,68,.15)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => go('/')} style={{ ...S.btn('rgba(255,255,255,.06)'), color: '#8892b0' }}>
          <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield style={{ width: 14, height: 14, color: '#ef4444' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em' }}>Rapha Guru Admin</div>
            <div style={{ fontSize: 10, color: '#4a5568' }}>superadmin · {user?.email}</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Realtime pill */}
        {realtime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#22c55e', fontWeight: 700 }}>{realtime.active_last_hour} ativos</span>
            <span style={{ color: '#4a5568' }}>última hora</span>
          </div>
        )}
        <button onClick={() => { tab === 'dashboard' ? loadDash() : tab === 'usuarios' ? loadUsers() : loadReports(); }}
          style={{ ...S.btn('rgba(255,255,255,.06)'), color: '#8892b0', padding: '8px' }}>
          <RefreshCw style={{ width: 13, height: 13, animation: busy ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)', background: '#09090f', padding: '0 24px', overflowX: 'auto' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none', color: tab === id ? '#ef4444' : '#4a5568', borderBottom: tab === id ? '2px solid #ef4444' : '2px solid transparent', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'color .12s' }}>
            <Icon style={{ width: 13, height: 13 }} /> {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px' }}>

        {/* ══ DASHBOARD ══ */}
        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* KPIs principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {[
                { label: 'Total usuários',     value: dash?.users.total ?? 0,               color: '#3b82f6', Icon: Users },
                { label: 'Assinaturas pagas',  value: dash?.users.paid_subs ?? 0,           color: '#a855f7', Icon: Zap },
                { label: 'MRR',                value: fmtK(dash?.revenue.mrr ?? 0),         color: '#22c55e', Icon: DollarSign },
                { label: 'Receita mês',        value: fmtK(dash?.revenue.month ?? 0),       color: '#f59e0b', Icon: TrendingUp },
                { label: 'Ativos hoje',        value: dash?.users.active_today ?? 0,        color: '#06b6d4', Icon: Activity },
                { label: 'Novos esta semana',  value: dash?.users.new_week ?? 0,            color: '#60a5fa', Icon: Users },
                { label: 'Churn mês',          value: dash?.revenue.churn_month ?? 0,       color: '#ef4444', Icon: TrendingDown },
                { label: 'Receita hoje',       value: fmtBrl(dash?.revenue.today ?? 0),     color: '#22c55e', Icon: DollarSign },
              ].map(({ label, value, color, Icon: I }) => (
                <div key={label} style={{ ...S.card, padding: '14px 16px' }}>
                  <I style={{ width: 14, height: 14, color, marginBottom: 8 }} />
                  <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#4a5568', marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Gráfico receita + Pie planos */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '.07em' }}>Receita — últimos 30 dias</div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={dash?.revenue_chart ?? []} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4a5568' }} tickFormatter={dayLabel} />
                    <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} tickFormatter={v => `R$${v}`} />
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, 'Receita']} />
                    <Area type="monotone" dataKey="total" stroke="#22c55e" fill="url(#rg)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '.07em' }}>Planos ativos</div>
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={(dash?.plan_distribution ?? []).map(p => ({ name: PLAN_META[p.plan_slug]?.name ?? p.plan_slug, value: p.n }))}
                      cx="50%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={3} dataKey="value">
                      {(dash?.plan_distribution ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#4a5568' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Realtime + Pagamentos recentes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              {/* Realtime */}
              {realtime && (
                <div style={{ ...S.card, padding: '16px 18px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                    Tempo real
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {[
                      { label: 'Online/hora', value: realtime.active_last_hour, color: '#22c55e' },
                      { label: 'Ações/hora', value: realtime.actions_last_hour, color: '#3b82f6' },
                      { label: 'Pag. pendentes', value: realtime.pending_payments, color: '#f59e0b' },
                      { label: 'Valor pendente', value: fmtBrl(realtime.pending_amount), color: '#f59e0b' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
                        <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Últimos cadastros</div>
                  {realtime.recent_signups.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1c2335', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#3b82f6', flexShrink: 0 }}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</div>
                      </div>
                      <div style={{ fontSize: 10, color: '#4a5568', flexShrink: 0 }}>{fmt(s.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Últimos pagamentos */}
              <div style={{ ...S.card, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: 12, fontWeight: 700, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Pagamentos recentes
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#09090f' }}>
                      {['Usuário', 'Valor', 'Método', 'Status', 'Data'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid rgba(255,255,255,.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dash?.recent_payments ?? []).slice(0, 8).map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{p.user_name as string}</div>
                          <div style={{ fontSize: 10, color: '#4a5568' }}>{p.email as string}</div>
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: '#22c55e', fontFamily: 'monospace', fontSize: 13 }}>{fmtBrl(p.amount_brl as number)}</td>
                        <td style={{ padding: '9px 12px', color: '#8892b0' }}>{METHOD_LABEL[p.method as string] ?? p.method as string}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: p.status === 'paid' ? '#22c55e' : p.status === 'pending' ? '#f59e0b' : '#ef4444', background: p.status === 'paid' ? 'rgba(34,197,94,.1)' : p.status === 'pending' ? 'rgba(245,158,11,.1)' : 'rgba(239,68,68,.1)', padding: '2px 8px', borderRadius: 20 }}>
                            {p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Falhou'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', color: '#4a5568', fontFamily: 'monospace', fontSize: 10 }}>{fmt(p.created_at as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ USUÁRIOS ══ */}
        {tab === 'usuarios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#4a5568' }} />
                <input placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  style={{ ...S.inp, paddingLeft: 30 }} />
              </div>
              <select value={roleF} onChange={e => { setRoleF(e.target.value); setPage(1); }}
                style={{ padding: '9px 12px', borderRadius: 8, background: '#0d1117', border: '1px solid rgba(255,255,255,.08)', color: '#e8eeff', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                <option value="">Todos os planos</option>
                {['free','basic','pro','elite'].map(r => <option key={r} value={r}>{PLAN_META[r]?.name ?? r}</option>)}
              </select>
              <button onClick={exportCSV} style={S.btn('rgba(34,197,94,.1)')}>
                <Download style={{ width: 12, height: 12, color: '#22c55e' }} />
                <span style={{ color: '#22c55e' }}>Exportar CSV</span>
              </button>
              <div style={{ fontSize: 12, color: '#4a5568' }}>{total} usuários</div>
            </div>

            <div style={{ ...S.card, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#09090f' }}>
                    {['Usuário', 'Plano', 'Status', 'Logins', 'Último acesso', 'Cadastro', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid rgba(255,255,255,.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const col = PLAN_COLOR[u.role] ?? '#6b7280';
                    const pm = PLAN_META[u.role] ?? PLAN_META.free;
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', opacity: u.is_active ? 1 : .45, transition: 'background .1s' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${col}20`, border: `1px solid ${col}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: col, flexShrink: 0 }}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 12 }}>{u.name}</div>
                              <div style={{ fontSize: 10, color: '#4a5568' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: col, background: `${col}15`, padding: '2px 8px', borderRadius: 20 }}>
                            {pm.icon} {pm.name}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: u.is_active ? '#22c55e' : '#ef4444' }}>
                              {u.is_active ? '● Ativo' : '● Inativo'}
                            </span>
                            {u.email_verified ? <span style={{ fontSize: 9, color: '#4a5568' }}>✓ e-mail verificado</span> : <span style={{ fontSize: 9, color: '#f59e0b' }}>⚠ não verificado</span>}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#8892b0', fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }}>
                          {u.login_count}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#4a5568', fontFamily: 'monospace', fontSize: 11 }}>
                          {u.last_login_at ? fmt(u.last_login_at) : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#4a5568', fontFamily: 'monospace', fontSize: 11 }}>
                          {fmt(u.created_at)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setEditing(u); setEditRole(u.role); }} title="Editar plano"
                              style={{ padding: '5px 7px', borderRadius: 6, background: 'rgba(59,130,246,.12)', color: '#60a5fa', border: 'none', cursor: 'pointer', display: 'flex' }}>
                              <Edit2 style={{ width: 11, height: 11 }} />
                            </button>
                            <button onClick={() => toggleActive(u)} title={u.is_active ? 'Desativar' : 'Ativar'}
                              style={{ padding: '5px 7px', borderRadius: 6, background: u.is_active ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.1)', color: u.is_active ? '#ef4444' : '#22c55e', border: 'none', cursor: 'pointer', display: 'flex' }}>
                              {u.is_active ? <XCircle style={{ width: 11, height: 11 }} /> : <CheckCircle2 style={{ width: 11, height: 11 }} />}
                            </button>
                            <button onClick={() => { setNotifyTarget('user'); setNotifyUserId(String(u.id)); setTab('comunicacao' as typeof tab); }} title="Notificar"
                              style={{ padding: '5px 7px', borderRadius: 6, background: 'rgba(245,158,11,.1)', color: '#f59e0b', border: 'none', cursor: 'pointer', display: 'flex' }}>
                              <Bell style={{ width: 11, height: 11 }} />
                            </button>
                            <button onClick={() => impersonate(u)} title="Logar como usuário"
                              style={{ padding: '5px 7px', borderRadius: 6, background: 'rgba(168,85,247,.1)', color: '#a855f7', border: 'none', cursor: 'pointer', display: 'flex' }}>
                              <UserCheck style={{ width: 11, height: 11 }} />
                            </button>
                            <button onClick={() => deleteUser(u)} title="Excluir"
                              style={{ padding: '5px 7px', borderRadius: 6, background: 'rgba(239,68,68,.08)', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex' }}>
                              <Trash2 style={{ width: 11, height: 11 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <span style={{ fontSize: 11, color: '#4a5568' }}>Página {page} de {Math.ceil(total / 20)} · {total} usuários</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(255,255,255,.05)', color: page === 1 ? '#2d3655' : '#8892b0', border: 'none', cursor: page === 1 ? 'default' : 'pointer', display: 'flex' }}>
                    <ChevronLeft style={{ width: 13, height: 13 }} />
                  </button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                    style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(255,255,255,.05)', color: page * 20 >= total ? '#2d3655' : '#8892b0', border: 'none', cursor: page * 20 >= total ? 'default' : 'pointer', display: 'flex' }}>
                    <ChevronRight style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ PLANOS ══ */}
        {tab === 'planos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Gerenciar Planos</h2>
              <button onClick={() => setEditingPlan({ slug: '', name: '', description: '', price_monthly: 0, price_annual: null, features: [], badge_color: '#3b82f6', sort_order: 0, is_active: 1 })}
                style={S.btn('#3b82f6')}>
                + Novo plano
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {plans.map((plan) => {
                const col = plan.badge_color as string ?? '#3b82f6';
                return (
                  <div key={plan.slug as string} style={{ ...S.card, padding: '18px', borderColor: `${col}25` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${col}20`, border: `1px solid ${col}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Crown style={{ width: 15, height: 15, color: col }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{plan.name as string}</div>
                          <div style={{ fontSize: 10, color: '#4a5568' }}>{plan.slug as string}</div>
                        </div>
                      </div>
                      <button onClick={() => setEditingPlan({ ...plan })}
                        style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(59,130,246,.12)', color: '#60a5fa', border: 'none', cursor: 'pointer', display: 'flex' }}>
                        <Edit2 style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: col, fontFamily: 'monospace' }}>
                      {Number(plan.price_monthly) === 0 ? 'Grátis' : `R$ ${Number(plan.price_monthly).toFixed(2)}`}
                    </div>
                    <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 10 }}>/mês</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(plan.features as string[]).slice(0, 4).map((f, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#8892b0', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <CheckCircle2 style={{ width: 10, height: 10, color: col, flexShrink: 0 }} /> {f}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ COMUNICAÇÃO ══ */}
        {tab === 'comunicacao' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Enviar Notificação</h2>

              {/* Alvo */}
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Destinatários</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 'all', label: 'Todos os usuários', Icon: Users, color: '#3b82f6' },
                    { id: 'plan', label: 'Por plano', Icon: Crown, color: '#a855f7' },
                    { id: 'user', label: 'Usuário específico', Icon: UserCheck, color: '#f59e0b' },
                  ].map(({ id, label, Icon: I, color }) => (
                    <button key={id} onClick={() => setNotifyTarget(id as typeof notifyTarget)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 9, cursor: 'pointer', background: notifyTarget === id ? `${color}12` : 'rgba(255,255,255,.03)', border: `1px solid ${notifyTarget === id ? color + '40' : 'rgba(255,255,255,.07)'}`, textAlign: 'left', fontFamily: 'inherit', transition: 'all .12s' }}>
                      <I style={{ width: 14, height: 14, color }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: notifyTarget === id ? '#e8eeff' : '#8892b0' }}>{label}</span>
                    </button>
                  ))}
                </div>

                {notifyTarget === 'plan' && (
                  <select value={notifyPlan} onChange={e => setNotifyPlan(e.target.value)}
                    style={{ ...S.inp, marginTop: 10 }}>
                    <option value="">Selecione o plano</option>
                    {['free','basic','pro','elite'].map(p => <option key={p} value={p}>{PLAN_META[p]?.name}</option>)}
                  </select>
                )}
                {notifyTarget === 'user' && (
                  <input value={notifyUserId} onChange={e => setNotifyUserId(e.target.value)}
                    placeholder="ID do usuário" style={{ ...S.inp, marginTop: 10 }} />
                )}
              </div>

              {/* Mensagem */}
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Mensagem</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)}
                    placeholder="Título da notificação" style={S.inp} />
                  <textarea value={notifyBody} onChange={e => setNotifyBody(e.target.value)}
                    placeholder="Corpo da mensagem..." rows={4}
                    style={{ ...S.inp, resize: 'vertical', lineHeight: 1.5 }} />
                </div>
                <button onClick={sendNotification} disabled={busy || !notifyTarget || !notifyTitle || !notifyBody}
                  style={{ ...S.btn('#3b82f6'), marginTop: 12, width: '100%', justifyContent: 'center', opacity: (!notifyTarget || !notifyTitle || !notifyBody) ? .5 : 1 }}>
                  {busy ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 13, height: 13 }} />}
                  Enviar notificação
                </button>
              </div>
            </div>

            {/* Templates prontos */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Templates rápidos</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { title: '🎉 Promoção relâmpago', body: 'Aproveite 30% de desconto no plano Elite! Use o cupom ELITE30 até hoje à meia-noite.', target: 'all' },
                  { title: '✨ Nova funcionalidade', body: 'Acabamos de lançar alertas de gol em tempo real! Ative nas configurações do seu perfil.', target: 'all' },
                  { title: '⚡ Upgrade disponível', body: 'Você está usando o plano Free. Faça upgrade para Pro e tenha análises ilimitadas!', target: 'free' },
                  { title: '🏆 Bem-vindo, assinante Elite!', body: 'Seu acesso Elite está ativo. Aproveite automação de apostas, relatórios PDF e suporte VIP.', target: 'elite' },
                  { title: '⚠️ Manutenção programada', body: 'O sistema ficará indisponível das 02:00 às 04:00 de amanhã para manutenção.', target: 'all' },
                ].map((t, i) => (
                  <button key={i} onClick={() => { setNotifyTitle(t.title); setNotifyBody(t.body); setNotifyTarget(t.target as typeof notifyTarget); }}
                    style={{ ...S.card, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', border: '1px solid rgba(255,255,255,.07)', transition: 'border-color .12s', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: '#4a5568', lineHeight: 1.4 }}>{t.body.slice(0, 80)}...</div>
                    <div style={{ fontSize: 10, color: t.target === 'all' ? '#3b82f6' : '#a855f7', marginTop: 5 }}>
                      → {t.target === 'all' ? 'Todos' : PLAN_META[t.target]?.name ?? t.target}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ RELATÓRIOS ══ */}
        {tab === 'relatorios' && reports && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Relatórios</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                {[7, 14, 30, 90].map(d => (
                  <button key={d} onClick={() => setReportsRange(d)}
                    style={{ padding: '6px 12px', borderRadius: 7, background: reportsRange === d ? '#3b82f6' : 'rgba(255,255,255,.05)', color: reportsRange === d ? '#fff' : '#4a5568', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                    {d}d
                  </button>
                ))}
                <button onClick={exportCSV} style={{ ...S.btn('rgba(34,197,94,.1)') }}>
                  <Download style={{ width: 12, height: 12, color: '#22c55e' }} />
                  <span style={{ color: '#22c55e' }}>CSV</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Receita diária</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={reports.revenue_by_day as { day: string; total: number }[]} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4a5568' }} tickFormatter={dayLabel} />
                    <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} tickFormatter={v => `R$${v}`} />
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, 'Receita']} />
                    <Bar dataKey="total" fill="#22c55e" radius={[3,3,0,0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Novos usuários/dia</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={reports.new_users_by_day as { day: string; count: number }[]} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4a5568' }} tickFormatter={dayLabel} />
                    <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {/* Métodos de pagamento */}
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Métodos de pagamento</div>
                {(reports.payment_methods as { method: string; count: number; total: number }[]).map(m => (
                  <div key={m.method} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <span style={{ fontSize: 12, color: '#8892b0' }}>{METHOD_LABEL[m.method] ?? m.method}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>{fmtBrl(m.total)}</div>
                      <div style={{ fontSize: 10, color: '#4a5568' }}>{m.count} transações</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Distribuição planos */}
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Distribuição planos</div>
                {(reports.plan_distribution as { plan_slug: string; count: number }[]).map((p, i) => {
                  const total = (reports.plan_distribution as { plan_slug: string; count: number }[]).reduce((a, x) => a + x.count, 0);
                  return (
                    <div key={p.plan_slug} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: '#8892b0' }}>{PLAN_META[p.plan_slug]?.name ?? p.plan_slug}</span>
                        <span style={{ fontWeight: 700, color: '#e8eeff', fontFamily: 'monospace' }}>{p.count} ({Math.round(p.count/total*100)}%)</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], width: `${p.count/total*100}%`, transition: 'width .4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top ações */}
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Top funcionalidades</div>
                {(reports.top_actions as { action: string; n: number }[] | undefined ?? []).map((a, i) => {
                  const max = ((reports.top_actions as { action: string; n: number }[]) ?? [])[0]?.n ?? 1;
                  return (
                    <div key={a.action} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: '#8892b0' }}>{ACTION_LABEL[a.action] ?? a.action}</span>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#e8eeff' }}>{a.n}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], width: `${(a.n/max)*100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top usuários */}
            <div style={{ ...S.card, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                Top usuários por atividade
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#09090f' }}>
                    {['#', 'Usuário', 'Plano', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid rgba(255,255,255,.06)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(reports.top_users as { id: number; name: string; email: string; role: string; actions: number }[]).slice(0, 10).map((u, i) => {
                    const col = PLAN_COLOR[u.role] ?? '#6b7280';
                    const pm = PLAN_META[u.role] ?? PLAN_META.free;
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <td style={{ padding: '9px 12px', color: '#4a5568', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>#{i+1}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 10, color: '#4a5568' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: col, background: `${col}15`, padding: '2px 8px', borderRadius: 20 }}>{pm.icon} {pm.name}</span>
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 800, fontFamily: 'monospace', color: '#e8eeff', fontSize: 15 }}>{u.actions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal editar plano */}
      {editingPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: '24px 28px', width: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>
              {editingPlan.slug ? `Editar plano: ${editingPlan.name as string}` : 'Novo plano'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Slug (ID único)', key: 'slug', placeholder: 'ex: premium', disabled: !!editingPlan.id },
                { label: 'Nome', key: 'name', placeholder: 'ex: Premium' },
                { label: 'Descrição', key: 'description', placeholder: 'Breve descrição' },
                { label: 'Preço mensal (R$)', key: 'price_monthly', type: 'number' },
                { label: 'Preço anual (R$)', key: 'price_annual', type: 'number', placeholder: '0 = sem opção anual' },
                { label: 'Cor do badge (hex)', key: 'badge_color', placeholder: '#3b82f6' },
              ].map(({ label, key, placeholder, type, disabled }) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, display: 'block', marginBottom: 5 }}>{label}</label>
                  <input type={type ?? 'text'} value={String(editingPlan[key] ?? '')} disabled={disabled}
                    onChange={e => setEditingPlan(p => ({ ...p!, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    placeholder={placeholder}
                    style={{ ...S.inp, opacity: disabled ? .5 : 1 }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, display: 'block', marginBottom: 5 }}>Recursos (1 por linha)</label>
                <textarea rows={4} value={(editingPlan.features as string[]).join('\n')}
                  onChange={e => setEditingPlan(p => ({ ...p!, features: e.target.value.split('\n').filter(Boolean) }))}
                  style={{ ...S.inp, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={savePlan} style={{ ...S.btn('#3b82f6'), flex: 1, justifyContent: 'center' }}>Salvar plano</button>
              <button onClick={() => setEditingPlan(null)} style={{ ...S.btn('rgba(255,255,255,.06)'), color: '#8892b0', flex: 1, justifyContent: 'center' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar usuário */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: '24px 28px', width: 360 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Editar plano</h3>
            <p style={{ fontSize: 12, color: '#4a5568', marginBottom: 16 }}>{editing.name} · {editing.email}</p>
            <label style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, display: 'block', marginBottom: 6 }}>Plano</label>
            <select value={editRole} onChange={e => setEditRole(e.target.value)}
              style={{ ...S.inp, marginBottom: 16 }}>
              {['free','basic','pro','elite'].map(r => <option key={r} value={r}>{PLAN_META[r]?.name ?? r}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={patchUser} style={{ ...S.btn('#3b82f6'), flex: 1, justifyContent: 'center' }}>Salvar</button>
              <button onClick={() => setEditing(null)} style={{ ...S.btn('rgba(255,255,255,.06)'), color: '#8892b0', flex: 1, justifyContent: 'center' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
      `}</style>
    </div>
  );
}
