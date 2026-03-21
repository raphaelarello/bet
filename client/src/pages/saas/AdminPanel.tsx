// Rapha Guru — Painel Administrativo Completo
// Design: "Command Center" — dark ops, data-dense, professional

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth, PLAN_META } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  AlertTriangle, Eye, Wifi, Mail, MessageCircle, Bot,
  Megaphone, Target, Calendar, Plus, Play, Pause,
  TrendingDown as TDown, AlertCircle, BadgeDollarSign,
  PhoneCall, Tag, Filter, Check, X, Smartphone,
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
  const [tab, setTab] = useState<'dashboard' | 'usuarios' | 'planos' | 'comunicacao' | 'relatorios' | 'marketing'>('dashboard');
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

  // Marketing & Financeiro
  const [mktView, setMktView]           = useState<'financeiro' | 'campanhas' | 'crm' | 'reguas'>('financeiro');
  const [finData,  setFinData]          = useState<Record<string, unknown> | null>(null);
  const [campaigns, setCampaigns]       = useState<Record<string, unknown>[]>([]);
  const [crmContacts, setCrmContacts]   = useState<Record<string, unknown>[]>([]);
  const [crmTotal, setCrmTotal]         = useState(0);
  const [rules, setRules]               = useState<Record<string, unknown>[]>([]);
  const [campForm, setCampForm]         = useState({ title: '', type: 'email', audience: 'all', audience_filter: '{}', subject: '', body: '', art_url: '', scheduled_at: '' });
  const [crmForm, setCrmForm]           = useState({ name: '', email: '', phone: '', telegram_id: '', status: 'prospect', plan_interest: '', notes: '' });
  const [ruleForm, setRuleForm]         = useState({ name: '', trigger_type: 'expiring', days_before: '7', channel: 'email', audience: 'expiring' });
  const [showCampForm, setShowCampForm] = useState(false);
  const [showCrmForm, setShowCrmForm]   = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [crmSearch, setCrmSearch]       = useState('');
  const [crmStatus, setCrmStatus]       = useState('');
  const [sendingCamp, setSendingCamp]   = useState<number | null>(null);

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
    if (tab === 'marketing') { loadFinancial(); loadCampaigns(); loadCrm(); loadRules(); }
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

  // ── Marketing & Financeiro ────────────────────────────────
  const loadFinancial = useCallback(async () => {
    const r = await fetch('/api/admin/financial/overview', { headers: authH });
    if (r.ok) setFinData(await r.json());
  }, [token]);

  const loadCampaigns = useCallback(async () => {
    const r = await fetch('/api/admin/campaigns', { headers: authH });
    if (r.ok) setCampaigns(((await r.json()) as { campaigns: Record<string, unknown>[] }).campaigns);
  }, [token]);

  const loadCrm = useCallback(async () => {
    const params = new URLSearchParams({ limit: '50' });
    if (crmSearch) params.set('q', crmSearch);
    if (crmStatus) params.set('status', crmStatus);
    const r = await fetch(`/api/admin/crm/contacts?${params}`, { headers: authH });
    if (r.ok) { const d = await r.json() as { contacts: Record<string, unknown>[]; total: number }; setCrmContacts(d.contacts); setCrmTotal(d.total); }
  }, [token, crmSearch, crmStatus]);

  const loadRules = useCallback(async () => {
    const r = await fetch('/api/admin/financial/rules', { headers: authH });
    if (r.ok) setRules(((await r.json()) as { rules: Record<string, unknown>[] }).rules);
  }, [token]);

  const createCampaign = async () => {
    const r = await fetch('/api/admin/campaigns', { method: 'POST', headers: authH, body: JSON.stringify(campForm) });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) { toast.success('Campanha criada!'); setShowCampForm(false); loadCampaigns(); setCampForm({ title: '', type: 'email', audience: 'all', audience_filter: '{}', subject: '', body: '', art_url: '', scheduled_at: '' }); }
    else toast.error(d.error ?? 'Erro');
  };

  const sendCampaign = async (id: number) => {
    setSendingCamp(id);
    const r = await fetch(`/api/admin/campaigns/${id}/send`, { method: 'POST', headers: authH });
    const d = await r.json() as { ok?: boolean; sent?: number; total?: number; error?: string };
    setSendingCamp(null);
    if (d.ok) { toast.success(`Enviado para ${d.sent} de ${d.total} destinatários!`); loadCampaigns(); }
    else toast.error(d.error ?? 'Erro ao enviar');
  };

  const createCrmContact = async () => {
    const r = await fetch('/api/admin/crm/contacts', { method: 'POST', headers: authH, body: JSON.stringify(crmForm) });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) { toast.success('Contato adicionado!'); setShowCrmForm(false); loadCrm(); setCrmForm({ name: '', email: '', phone: '', telegram_id: '', status: 'prospect', plan_interest: '', notes: '' }); }
    else toast.error(d.error ?? 'Erro');
  };

  const deleteCrmContact = async (id: number) => {
    if (!confirm('Remover contato?')) return;
    await fetch(`/api/admin/crm/contacts/${id}`, { method: 'DELETE', headers: authH });
    loadCrm();
  };

  const createRule = async () => {
    const r = await fetch('/api/admin/financial/rules', { method: 'POST', headers: authH, body: JSON.stringify(ruleForm) });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) { toast.success('Régua criada!'); setShowRuleForm(false); loadRules(); }
    else toast.error(d.error ?? 'Erro');
  };

  const toggleRule = async (id: number, is_active: number) => {
    await fetch(`/api/admin/financial/rules/${id}`, { method: 'PATCH', headers: authH, body: JSON.stringify({ is_active: is_active ? 0 : 1 }) });
    loadRules();
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

  const saveUser = patchUser;

  if (!isAdmin) return (
    <div className="min-h-screen bg-[#060810] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-slate-500 mb-4 text-sm">Acesso restrito a administradores</p>
        <button onClick={() => go('/')} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors">Voltar</button>
      </div>
    </div>
  );

  const TABS = [
    { id: 'dashboard',   label: 'Dashboard',      Icon: BarChart2 },
    { id: 'usuarios',    label: 'Usuários',       Icon: Users },
    { id: 'planos',      label: 'Planos',         Icon: Package },
    { id: 'comunicacao', label: 'Comunicação',    Icon: Bell },
    { id: 'marketing',   label: 'Mkt & Finance',  Icon: Megaphone },
    { id: 'relatorios',  label: 'Relatórios',     Icon: TrendingUp },
  ] as const;

  return (
    <div className="min-h-screen bg-[#060810] text-slate-100" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-50 bg-[#07080f]/95 backdrop-blur-md border-b border-white/[0.06] px-6 py-3 flex items-center gap-4">
        <button onClick={() => go('/')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.07] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] text-xs font-semibold transition-all">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/25 flex items-center justify-center">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <div className="text-sm font-black tracking-tight text-slate-100">Rapha Guru <span className="text-red-400">Admin</span></div>
            <div className="text-[10px] text-slate-600 font-mono">{user?.email}</div>
          </div>
        </div>
        <div className="flex-1" />
        {realtime && (
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-black">{realtime.active_last_hour}</span>
              <span className="text-slate-600 text-xs">online agora</span>
            </div>
            {realtime.pending_payments > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/[0.08] border border-amber-500/20">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-amber-400 text-xs font-black">{realtime.pending_payments} pagamentos pendentes</span>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => { tab === 'dashboard' ? loadDash() : tab === 'usuarios' ? loadUsers() : loadReports(); }}
          className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-slate-300 flex items-center justify-center transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-[#08090e] border-b border-white/[0.05] px-6 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all',
              tab === id
                ? 'text-red-400 border-red-500 bg-red-500/[0.04]'
                : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.02]',
            )}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="max-w-[1280px] mx-auto px-5 py-6 space-y-5">

        {/* ══════════════════ DASHBOARD ══════════════════ */}
        {tab === 'dashboard' && (
          <div className="space-y-5">

            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              {[
                { label: 'Usuários',      value: dash?.users.total ?? 0,            color: 'text-blue-400',    border: 'border-blue-500/20',    bg: 'bg-blue-500/5',    Icon: Users },
                { label: 'Assinaturas',   value: dash?.users.paid_subs ?? 0,        color: 'text-violet-400',  border: 'border-violet-500/20',  bg: 'bg-violet-500/5',  Icon: Zap },
                { label: 'MRR',           value: fmtK(dash?.revenue.mrr ?? 0),      color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', Icon: DollarSign },
                { label: 'Receita mês',   value: fmtK(dash?.revenue.month ?? 0),    color: 'text-amber-400',   border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   Icon: TrendingUp },
                { label: 'Ativos hoje',   value: dash?.users.active_today ?? 0,     color: 'text-cyan-400',    border: 'border-cyan-500/20',    bg: 'bg-cyan-500/5',    Icon: Activity },
                { label: 'Novos/semana',  value: dash?.users.new_week ?? 0,         color: 'text-sky-400',     border: 'border-sky-500/20',     bg: 'bg-sky-500/5',     Icon: Users },
                { label: 'Churn mês',     value: dash?.revenue.churn_month ?? 0,    color: 'text-rose-400',    border: 'border-rose-500/20',    bg: 'bg-rose-500/5',    Icon: TrendingDown },
                { label: 'Receita hoje',  value: fmtBrl(dash?.revenue.today ?? 0),  color: 'text-green-400',   border: 'border-green-500/20',   bg: 'bg-green-500/5',   Icon: DollarSign },
              ].map(({ label, value, color, border, bg, Icon: I }) => (
                <div key={label} className={cn('rounded-2xl border p-4 space-y-2', border, bg, 'bg-[linear-gradient(145deg,rgba(13,17,23,0.9),rgba(2,6,23,0.7))]')}>
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', bg, 'border', border)}>
                    <I className={cn('w-3.5 h-3.5', color)} />
                  </div>
                  <div className={cn('text-2xl font-black tabular-nums leading-none', color)}>{value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{label}</div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid xl:grid-cols-[2fr_1fr] gap-4">
              <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Receita</p>
                    <p className="text-sm font-black text-slate-200">Últimos 30 dias</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-400 tabular-nums">{fmtK(dash?.revenue.month ?? 0)}</p>
                    <p className="text-[10px] text-slate-600">mês atual</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={dash?.revenue_chart ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#374151' }} tickFormatter={dayLabel} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#374151' }} tickFormatter={v => `R$${v}`} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }}
                      formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, 'Receita']}
                    />
                    <Area type="monotone" dataKey="total" stroke="#22c55e" fill="url(#rg)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Distribuição</p>
                <p className="text-sm font-black text-slate-200 mb-4">Planos ativos</p>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={(dash?.plan_distribution ?? []).map(p => ({ name: PLAN_META[p.plan_slug]?.name ?? p.plan_slug, value: p.n }))}
                      cx="50%" cy="50%" innerRadius={32} outerRadius={50} paddingAngle={4} dataKey="value"
                    >
                      {(dash?.plan_distribution ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#4b5563' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Realtime + Recent payments */}
            <div className="grid xl:grid-cols-[1fr_2fr] gap-4">
              {realtime && (
                <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tempo real</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    {[
                      { label: 'Online/hora',     value: realtime.active_last_hour,              color: 'text-emerald-400' },
                      { label: 'Ações/hora',      value: realtime.actions_last_hour,             color: 'text-blue-400' },
                      { label: 'Pag. pendentes',  value: realtime.pending_payments,              color: 'text-amber-400' },
                      { label: 'Valor pendente',  value: fmtBrl(realtime.pending_amount),        color: 'text-amber-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                        <div className={cn('text-xl font-black tabular-nums', color)}>{value}</div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600 mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 mb-2">Últimos cadastros</p>
                  <div className="space-y-1.5">
                    {realtime.recent_signups.slice(0, 4).map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                        <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-[11px] font-black text-blue-400 flex-shrink-0">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-slate-200 truncate">{s.name}</div>
                          <div className="text-[10px] text-slate-600 truncate">{s.email}</div>
                        </div>
                        <div className="text-[9px] text-slate-700 font-mono flex-shrink-0">{fmt(s.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pagamentos recentes</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-black/20">
                      {['Usuário', 'Valor', 'Método', 'Status', 'Data'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.04]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dash?.recent_payments ?? []).slice(0, 8).map((p, i) => (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-[12px] font-semibold text-slate-200">{p.user_name as string}</div>
                          <div className="text-[10px] text-slate-600">{p.email as string}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-black text-emerald-400 tabular-nums">{fmtBrl(p.amount_brl as number)}</td>
                        <td className="px-4 py-3 text-[11px] text-slate-400">{METHOD_LABEL[p.method as string] ?? p.method as string}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border',
                            p.status === 'paid'    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : p.status === 'pending' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                            : 'text-red-400 border-red-500/30 bg-red-500/10',
                          )}>
                            {p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Falhou'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-600 font-mono">{fmt(p.created_at as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top actions */}
            {dash?.top_actions && dash.top_actions.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Ações mais usadas</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {dash.top_actions.map((a) => {
                    const maxN = Math.max(...dash.top_actions.map(x => x.n));
                    const pct = maxN > 0 ? (a.n / maxN) * 100 : 0;
                    return (
                      <div key={a.action} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-semibold">{ACTION_LABEL[a.action] ?? a.action}</span>
                          <span className="text-blue-400 font-black tabular-nums">{a.n}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ USUÁRIOS ══════════════════ */}
        {tab === 'usuarios' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                <input
                  placeholder="Buscar por nome ou e-mail…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <select
                value={roleF}
                onChange={e => { setRoleF(e.target.value); setPage(1); }}
                className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 outline-none focus:border-blue-500/50"
              >
                <option value="">Todos os planos</option>
                {['free', 'basic', 'pro', 'elite'].map(r => (
                  <option key={r} value={r}>{PLAN_META[r]?.name ?? r}</option>
                ))}
              </select>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black hover:bg-emerald-500/15 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Exportar CSV
              </button>
              <div className="text-xs text-slate-600 font-semibold">{total} usuários</div>
            </div>

            {/* Users table */}
            <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-black/30">
                    {['Usuário', 'Plano', 'Status', 'Logins', 'Último acesso', 'Cadastro', 'Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.16em] text-slate-600 border-b border-white/[0.05] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const col = PLAN_COLOR[u.role] ?? '#6b7280';
                    const pm = PLAN_META[u.role] ?? PLAN_META.free;
                    return (
                      <tr key={u.id} className={cn('border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors', !u.is_active && 'opacity-40')}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: `${col}20`, border: `1px solid ${col}35`, color: col }}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold text-slate-100">{u.name}</div>
                              <div className="text-[10px] text-slate-600">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: `${col}18`, color: col, border: `1px solid ${col}30` }}>
                            {pm.icon} {pm.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <div className={cn('text-[11px] font-bold flex items-center gap-1', u.is_active ? 'text-emerald-400' : 'text-red-400')}>
                              <span className={cn('w-1.5 h-1.5 rounded-full', u.is_active ? 'bg-emerald-400' : 'bg-red-400')} />
                              {u.is_active ? 'Ativo' : 'Inativo'}
                            </div>
                            <div className={cn('text-[9px]', u.email_verified ? 'text-slate-600' : 'text-amber-500/70')}>
                              {u.email_verified ? '✓ e-mail verificado' : '⚠ não verificado'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-black tabular-nums text-slate-300">{u.login_count}</td>
                        <td className="px-4 py-3 text-[11px] text-slate-600 font-mono">{u.last_login_at ? fmt(u.last_login_at) : '—'}</td>
                        <td className="px-4 py-3 text-[11px] text-slate-600 font-mono">{fmt(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {[
                              { onClick: () => { setEditing(u); setEditRole(u.role); }, Icon: Edit2,      color: 'text-blue-400    bg-blue-500/10    border-blue-500/20',    title: 'Editar plano' },
                              { onClick: () => toggleActive(u),                         Icon: u.is_active ? XCircle : CheckCircle2, color: u.is_active ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', title: u.is_active ? 'Desativar' : 'Ativar' },
                              { onClick: () => { setNotifyTarget('user'); setNotifyUserId(String(u.id)); setTab('comunicacao' as typeof tab); }, Icon: Bell, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', title: 'Notificar' },
                              { onClick: () => impersonate(u),                          Icon: UserCheck,  color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', title: 'Logar como' },
                              { onClick: () => deleteUser(u),                           Icon: Trash2,     color: 'text-rose-400   bg-rose-500/10   border-rose-500/20',   title: 'Excluir' },
                            ].map(({ onClick, Icon, color, title }, idx) => (
                              <button key={idx} onClick={onClick} title={title} className={cn('w-7 h-7 rounded-lg border flex items-center justify-center transition-all hover:scale-110', color)}>
                                <Icon className="w-3 h-3" />
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.05]">
                <span className="text-xs text-slate-600">Página {page} de {Math.ceil(total / 20)} · {total} usuários</span>
                <div className="flex gap-1.5">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-white/[0.08] transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                    className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-white/[0.08] transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Edit plan modal */}
            {editing && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0d1117] p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-100">Editar plano — {editing.name}</h3>
                    <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500 mb-1.5">Plano / Papel</label>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-slate-200 outline-none focus:border-blue-500/50">
                      {['free', 'basic', 'pro', 'elite', 'admin'].map(r => (
                        <option key={r} value={r}>{PLAN_META[r]?.name ?? r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-sm text-slate-400 font-semibold hover:bg-white/[0.07] transition-colors">Cancelar</button>
                    <button onClick={saveUser} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-500 disabled:opacity-50 transition-colors">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ PLANOS ══════════════════ */}
        {tab === 'planos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Configuração</p>
                <h2 className="text-lg font-black text-slate-100">Gerenciar Planos</h2>
              </div>
              <button
                onClick={() => setEditingPlan({ slug: '', name: '', description: '', price_monthly: 0, price_annual: null, features: [], badge_color: '#3b82f6', sort_order: 0, is_active: 1 })}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Novo plano
              </button>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const col = plan.badge_color as string ?? '#3b82f6';
                return (
                  <div key={plan.slug as string} className="rounded-2xl border p-5 space-y-4" style={{ borderColor: `${col}25`, background: `linear-gradient(145deg, rgba(13,17,23,0.95), rgba(2,6,23,0.8))` }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">PLANO</div>
                        <div className="text-lg font-black mt-0.5" style={{ color: col }}>{plan.name as string}</div>
                      </div>
                      <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border', plan.is_active ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-500 border-slate-700 bg-slate-800/50')}>
                        {plan.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div>
                      <span className="text-3xl font-black tabular-nums" style={{ color: col }}>R${Number(plan.price_monthly).toFixed(0)}</span>
                      <span className="text-slate-600 text-xs ml-1">/mês</span>
                      {plan.price_annual && <div className="text-xs text-slate-600 mt-0.5">ou R${Number(plan.price_annual).toFixed(0)}/ano</div>}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{plan.description as string}</p>
                    {Array.isArray(plan.features) && plan.features.length > 0 && (
                      <ul className="space-y-1">
                        {(plan.features as string[]).slice(0, 4).map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Check className="w-3 h-3 flex-shrink-0" style={{ color: col }} />{f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button onClick={() => setEditingPlan(plan)} className="w-full py-2 rounded-xl text-xs font-black border transition-all hover:opacity-80" style={{ borderColor: `${col}30`, color: col, background: `${col}12` }}>
                      <Edit2 className="w-3 h-3 inline mr-1" /> Editar
                    </button>
                  </div>
                );
              })}
            </div>

            {editingPlan && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0d1117] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between sticky top-0 bg-[#0d1117] pb-2">
                    <h3 className="text-base font-black text-slate-100">{editingPlan.slug ? `Editar: ${editingPlan.name as string}` : 'Novo plano'}</h3>
                    <button onClick={() => setEditingPlan(null)} className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Slug', key: 'slug', type: 'text' },
                      { label: 'Nome', key: 'name', type: 'text' },
                      { label: 'Preço mensal (R$)', key: 'price_monthly', type: 'number' },
                      { label: 'Preço anual (R$)', key: 'price_annual', type: 'number' },
                      { label: 'Cor do badge (hex)', key: 'badge_color', type: 'text' },
                      { label: 'Ordem', key: 'sort_order', type: 'number' },
                    ].map(({ label, key, type }) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</label>
                        <input
                          type={type}
                          value={String(editingPlan[key] ?? '')}
                          onChange={e => setEditingPlan({ ...editingPlan, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Descrição</label>
                    <textarea
                      rows={2}
                      value={String(editingPlan.description ?? '')}
                      onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-400">Ativo</span>
                    <button onClick={() => setEditingPlan({ ...editingPlan, is_active: editingPlan.is_active ? 0 : 1 })}
                      className={cn('w-10 h-5 rounded-full border transition-all relative', editingPlan.is_active ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-slate-800 border-slate-700')}>
                      <span className={cn('absolute top-0.5 w-4 h-4 rounded-full transition-all', editingPlan.is_active ? 'left-5 bg-emerald-400' : 'left-0.5 bg-slate-600')} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingPlan(null)} className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-sm text-slate-400 font-semibold">Cancelar</button>
                    <button onClick={savePlan} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-500 disabled:opacity-50">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Salvar plano'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ COMUNICAÇÃO ══════════════════ */}
        {tab === 'comunicacao' && (
          <div className="space-y-4 max-w-2xl">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Push & In-App</p>
              <h2 className="text-lg font-black text-slate-100">Enviar Notificação</h2>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] p-6 space-y-4">
              <div className="grid sm:grid-cols-3 gap-2">
                {[
                  { id: 'all',   label: 'Todos',       Icon: Users },
                  { id: 'plan',  label: 'Por plano',   Icon: Package },
                  { id: 'user',  label: 'Usuário',     Icon: UserCheck },
                ].map(({ id, label, Icon: I }) => (
                  <button
                    key={id}
                    onClick={() => setNotifyTarget(id as typeof notifyTarget)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all',
                      notifyTarget === id
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                        : 'border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-slate-300',
                    )}
                  >
                    <I className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              {notifyTarget === 'plan' && (
                <select value={notifyPlan} onChange={e => setNotifyPlan(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 outline-none focus:border-blue-500/50">
                  <option value="">Selecione o plano…</option>
                  {['free', 'basic', 'pro', 'elite'].map(r => <option key={r} value={r}>{PLAN_META[r]?.name ?? r}</option>)}
                </select>
              )}
              {notifyTarget === 'user' && (
                <input placeholder="ID do usuário" value={notifyUserId} onChange={e => setNotifyUserId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors" />
              )}

              <div className="space-y-2">
                <input placeholder="Título da notificação" value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors placeholder-slate-600" />
                <textarea rows={4} placeholder="Mensagem…" value={notifyBody} onChange={e => setNotifyBody(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors resize-none placeholder-slate-600" />
              </div>

              <button onClick={sendNotification} disabled={busy || !notifyTarget || !notifyTitle || !notifyBody}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {busy ? 'Enviando…' : 'Enviar notificação'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════ MARKETING ══════════════════ */}
        {tab === 'marketing' && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'financeiro', label: 'Financeiro',  Icon: DollarSign },
                { id: 'campanhas',  label: 'Campanhas',   Icon: Megaphone },
                { id: 'crm',        label: 'CRM',         Icon: Users },
                { id: 'reguas',     label: 'Réguas',      Icon: Zap },
              ].map(({ id, label, Icon: I }) => (
                <button key={id} onClick={() => setMktView(id as typeof mktView)}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition-all',
                    mktView === id ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-slate-300')}>
                  <I className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>

            {/* Financeiro */}
            {mktView === 'financeiro' && finData && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { label: 'MRR',          value: fmtK((finData.mrr as number) ?? 0),                  color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
                    { label: 'ARR',          value: fmtK(((finData.mrr as number) ?? 0) * 12),           color: 'text-blue-400',    border: 'border-blue-500/20',    bg: 'bg-blue-500/5' },
                    { label: 'Churn Rate',   value: `${((finData.churn_rate as number) ?? 0).toFixed(1)}%`, color: 'text-rose-400',  border: 'border-rose-500/20',    bg: 'bg-rose-500/5' },
                    { label: 'LTV médio',    value: fmtK((finData.avg_ltv as number) ?? 0),              color: 'text-amber-400',   border: 'border-amber-500/20',   bg: 'bg-amber-500/5' },
                    { label: 'CAC estimado', value: fmtK((finData.cac as number) ?? 0),                  color: 'text-cyan-400',    border: 'border-cyan-500/20',    bg: 'bg-cyan-500/5' },
                    { label: 'LTV/CAC',      value: `${((finData.ltv_cac_ratio as number) ?? 0).toFixed(1)}x`, color: 'text-violet-400', border: 'border-violet-500/20', bg: 'bg-violet-500/5' },
                  ].map(({ label, value, color, border, bg }) => (
                    <div key={label} className={cn('rounded-2xl border p-5', border, bg, 'bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))]')}>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-2">{label}</div>
                      <div className={cn('text-3xl font-black tabular-nums', color)}>{value}</div>
                    </div>
                  ))}
                </div>
                {finData.revenue_by_plan && (
                  <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Receita por plano</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={Object.entries(finData.revenue_by_plan as Record<string, number>).map(([k, v]) => ({ name: PLAN_META[k]?.name ?? k, value: v }))} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} tickFormatter={v => `R$${v}`} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }} formatter={v => [`R$ ${Number(v).toFixed(2)}`, 'Receita']} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                          {Object.keys(finData.revenue_by_plan as Record<string, number>).map((k, i) => <Cell key={i} fill={PLAN_COLOR[k] ?? '#3b82f6'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Campanhas */}
            {mktView === 'campanhas' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => setShowCampForm(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-black hover:bg-violet-500 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Nova campanha
                  </button>
                </div>
                <div className="space-y-3">
                  {campaigns.map((c) => (
                    <div key={c.id as number} className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-sm font-black text-slate-100">{c.title as string}</span>
                            <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-[0.1em]',
                              c.status === 'sent' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : c.status === 'scheduled' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                              : 'text-slate-400 border-slate-600/50 bg-slate-800/50')}>
                              {c.status as string}
                            </span>
                            <span className="text-[10px] text-slate-600 uppercase tracking-[0.1em] font-bold">{c.type as string} · {c.audience as string}</span>
                          </div>
                          {c.status === 'sent' && (
                            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                              <span><span className="text-emerald-400 font-black">{c.sent_count as number}</span> enviados</span>
                              <span><span className="text-blue-400 font-black">{c.open_count as number}</span> abertos</span>
                              <span><span className="text-amber-400 font-black">{c.click_count as number}</span> cliques</span>
                            </div>
                          )}
                        </div>
                        {c.status !== 'sent' && (
                          <button onClick={() => sendCampaign(c.id as number)} disabled={sendingCamp === c.id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-500 disabled:opacity-50 flex-shrink-0 transition-colors">
                            {sendingCamp === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Enviar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {campaigns.length === 0 && (
                    <div className="text-center py-12 text-slate-600 text-sm">Nenhuma campanha criada.</div>
                  )}
                </div>

                {showCampForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0d1117] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-slate-100">Nova campanha</h3>
                        <button onClick={() => setShowCampForm(false)} className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {[
                          { label: 'Título', key: 'title', type: 'text' },
                          { label: 'Assunto', key: 'subject', type: 'text' },
                        ].map(({ label, key, type }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</label>
                            <input type={type} value={campForm[key as keyof typeof campForm]} onChange={e => setCampForm({ ...campForm, [key]: e.target.value })}
                              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-200 outline-none focus:border-blue-500/50" />
                          </div>
                        ))}
                        {[
                          { label: 'Tipo', key: 'type', options: [{ v: 'email', l: 'E-mail' }, { v: 'push', l: 'Push' }, { v: 'sms', l: 'SMS' }] },
                          { label: 'Audiência', key: 'audience', options: [{ v: 'all', l: 'Todos' }, { v: 'paid', l: 'Pagantes' }, { v: 'free', l: 'Gratuitos' }, { v: 'expiring', l: 'Expirando' }] },
                        ].map(({ label, key, options }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</label>
                            <select value={campForm[key as keyof typeof campForm]} onChange={e => setCampForm({ ...campForm, [key]: e.target.value })}
                              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 outline-none focus:border-blue-500/50">
                              {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Mensagem</label>
                        <textarea rows={4} value={campForm.body} onChange={e => setCampForm({ ...campForm, body: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-200 outline-none focus:border-blue-500/50 resize-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowCampForm(false)} className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-sm text-slate-400 font-semibold">Cancelar</button>
                        <button onClick={createCampaign} className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-black hover:bg-violet-500 transition-colors">Criar campanha</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CRM */}
            {mktView === 'crm' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                    <input placeholder="Buscar contato…" value={crmSearch} onChange={e => { setCrmSearch(e.target.value); loadCrm(); }}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-200 outline-none focus:border-blue-500/50 placeholder-slate-600" />
                  </div>
                  <select value={crmStatus} onChange={e => { setCrmStatus(e.target.value); loadCrm(); }}
                    className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 outline-none">
                    <option value="">Todos os status</option>
                    {['prospect', 'active', 'churned', 'vip'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setShowCrmForm(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-black hover:bg-cyan-500 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Novo contato
                  </button>
                  <span className="text-xs text-slate-600 font-semibold">{crmTotal} contatos</span>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-black/30">
                        {['Nome', 'E-mail', 'Telefone', 'Status', 'Interesse', 'Ações'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.05]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {crmContacts.map(c => (
                        <tr key={c.id as number} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-200">{c.name as string}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">{c.email as string}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{c.phone as string || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-[0.1em]',
                              c.status === 'active' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : c.status === 'vip'  ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
                              : c.status === 'churned' ? 'text-red-400 border-red-500/30 bg-red-500/10'
                              : 'text-slate-400 border-slate-600/40 bg-slate-800/50')}>
                              {c.status as string}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{c.plan_interest as string || '—'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteCrmContact(c.id as number)}
                              className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Réguas */}
            {mktView === 'reguas' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => setShowRuleForm(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-black hover:bg-amber-500 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Nova régua
                  </button>
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {rules.map(r => (
                    <div key={r.id as number} className={cn('rounded-2xl border p-5 space-y-3', r.is_active ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/[0.06] bg-white/[0.02]')}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-slate-100">{r.name as string}</span>
                        <button onClick={() => toggleRule(r.id as number, r.is_active as number)}
                          className={cn('w-8 h-4 rounded-full border transition-all relative', r.is_active ? 'bg-amber-500/20 border-amber-500/40' : 'bg-slate-800 border-slate-700')}>
                          <span className={cn('absolute top-0.5 w-3 h-3 rounded-full transition-all', r.is_active ? 'left-4 bg-amber-400' : 'left-0.5 bg-slate-600')} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400">{r.trigger_type as string}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400">{r.channel as string}</span>
                        {r.days_before && <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400">{r.days_before as number}d antes</span>}
                      </div>
                    </div>
                  ))}
                  {rules.length === 0 && <div className="col-span-3 text-center py-12 text-slate-600 text-sm">Nenhuma régua cadastrada.</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ RELATÓRIOS ══════════════════ */}
        {tab === 'relatorios' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Analytics</p>
                <h2 className="text-lg font-black text-slate-100">Relatórios de uso</h2>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {[7, 14, 30, 90].map(d => (
                  <button key={d} onClick={() => { setReportsRange(d); loadReports(); }}
                    className={cn('px-3 py-1.5 rounded-lg border text-xs font-bold transition-all',
                      reportsRange === d ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-slate-300')}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {reports ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Novos usuários / dia</p>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={(reports.daily_signups as { day: string; n: number }[]) ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#374151' }} tickFormatter={dayLabel} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#374151' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }} />
                        <Bar dataKey="n" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Ações por dia</p>
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={(reports.daily_actions as { day: string; n: number }[]) ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#374151' }} tickFormatter={dayLabel} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#374151' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }} />
                        <Area type="monotone" dataKey="n" stroke="#a855f7" fill="url(#ag)" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {reports.top_users && (
                  <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(13,17,23,0.95),rgba(2,6,23,0.8))] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06]">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Top usuários por ações</p>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-black/20">
                          {['#', 'Usuário', 'Ações', 'Plano'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.04]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(reports.top_users as { rank: number; name: string; email: string; action_count: number; plan_slug: string }[]).map((u, i) => (
                          <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-sm font-black text-slate-500 tabular-nums">{u.rank}</td>
                            <td className="px-4 py-3">
                              <div className="text-[13px] font-semibold text-slate-200">{u.name}</div>
                              <div className="text-[10px] text-slate-600">{u.email}</div>
                            </td>
                            <td className="px-4 py-3 text-sm font-black text-blue-400 tabular-nums">{u.action_count}</td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ color: PLAN_COLOR[u.plan_slug] ?? '#6b7280', background: `${PLAN_COLOR[u.plan_slug] ?? '#6b7280'}18`, border: `1px solid ${PLAN_COLOR[u.plan_slug] ?? '#6b7280'}28` }}>
                                {PLAN_META[u.plan_slug]?.name ?? u.plan_slug}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
