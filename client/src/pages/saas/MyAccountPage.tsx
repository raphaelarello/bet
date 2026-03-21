// Rapha Guru — My Account Page v2 (Tailwind)

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth, PLAN_META } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import {
  User, Bell, CreditCard, Settings, ArrowLeft, Flame, TrendingUp,
  Flag, Trophy, Star, Zap, Crown, CheckCircle2, XCircle, Clock,
  LogOut, ChevronRight, RefreshCw, Shield, Eye, EyeOff, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stats {
  user: Record<string,unknown>;
  subscription: Record<string,unknown> | null;
  usage: { total: Record<string,number>; last_30d: Record<string,number>; today: Record<string,number>; chart: { day: string; n: number }[] };
  streak_days: number;
  payments: Record<string,unknown>[];
  notifications: Record<string,unknown>[];
  member_since: number | null;
}

const fmt = (ts: number) => new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtBrl = (v: number) => `R$ ${v.toFixed(2)}`;
const dayLabel = (iso: string) => iso.slice(5);

const ACTION_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  analysis:    { label: 'Análises',    icon: TrendingUp, color: '#3b82f6' },
  favorite:    { label: 'Favoritos',   icon: Star,       color: '#f59e0b' },
  betslip_add: { label: 'Bilhete',     icon: CreditCard, color: '#a855f7' },
  alert:       { label: 'Alertas',     icon: Bell,       color: '#22c55e' },
  comparison:  { label: 'Comparações', icon: Flag,       color: '#06b6d4' },
};
const METHOD_LABELS: Record<string, string> = { pix: 'PIX', credit_card: 'Cartão', boleto: 'Boleto' };
const STATUS_CFG: Record<string, { color: string; label: string; cls: string }> = {
  paid:     { color: 'text-emerald-400', label: 'Pago',      cls: 'bg-emerald-500/10 border-emerald-500/20' },
  pending:  { color: 'text-amber-400',   label: 'Pendente',  cls: 'bg-amber-500/10 border-amber-500/20' },
  failed:   { color: 'text-red-400',     label: 'Falhou',    cls: 'bg-red-500/10 border-red-500/20' },
  refunded: { color: 'text-slate-400',   label: 'Estornado', cls: 'bg-slate-700/30 border-slate-600/20' },
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-slate-900/60 border border-white/[0.07] rounded-2xl', className)}>{children}</div>
);

const Input = ({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) => (
  <input type={type} value={value} placeholder={placeholder} disabled={disabled}
    onChange={e => onChange?.(e.target.value)}
    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors disabled:opacity-40" />
);

export default function MyAccountPage() {
  const [, go] = useLocation();
  const { user, subscription, logout, token, refresh: refreshCtx } = useAuth();
  const [tab,   setTab]   = useState<'visao'|'uso'|'pagamentos'|'notificacoes'|'conta'>('visao');
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy,  setBusy]  = useState(false);
  const [cancelBusy, setCancelarBusy] = useState(false);
  const [currPwd, setCurrPwd] = useState('');
  const [newPwd,  setNewPwd]  = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg,  setPwdMsg]  = useState('');
  const [editName,  setEditarName]  = useState('');
  const [editPhone, setEditarPhone] = useState('');

  useEffect(() => { if (user) { setEditarName(user.name); setEditarPhone(user.phone ?? ''); } }, [user]);

  const loadStats = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await fetch('/api/user/stats', { headers: { Authorization: `Bearer ${token}` } });
      setStats(await r.json() as Stats);
    } catch { toast.error('Erro ao carregar estatísticas'); }
    setBusy(false);
  };

  useEffect(() => { loadStats(); }, [token]);

  const cancelSub = async () => {
    if (!confirm('Cancelar assinatura? O acesso continua até o fim do período.')) return;
    setCancelarBusy(true);
    const r = await fetch('/api/payments/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ reason: 'Cancelado pelo usuário' }) });
    const d = await r.json() as { ok?: boolean; error?: string };
    setCancelarBusy(false);
    if (d.ok) { toast.success('Assinatura cancelada.'); await refreshCtx(); loadStats(); }
    else toast.error(d.error ?? 'Erro');
  };

  const saveProfile = async () => {
    const r = await fetch('/api/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: editName, phone: editPhone }) });
    if (r.ok) { toast.success('Perfil atualizado!'); refreshCtx(); }
    else toast.error('Erro ao salvar');
  };

  const changePassword = async () => {
    setPwdMsg('');
    if (!currPwd || !newPwd) { setPwdMsg('Preencha todos os campos'); return; }
    if (newPwd.length < 8)   { setPwdMsg('Mínimo 8 caracteres'); return; }
    const r = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ current: currPwd, novo: newPwd }) });
    const d = await r.json() as { ok?: boolean; message?: string; error?: string };
    if (d.ok) { toast.success(d.message ?? 'Senha alterada!'); setCurrPwd(''); setNewPwd(''); }
    else setPwdMsg(d.error ?? 'Erro');
  };

  if (!user) return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-sm text-slate-500">Você precisa estar logado</p>
        <button onClick={() => go('/login')} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors">Entrar</button>
      </div>
    </div>
  );

  const meta = PLAN_META[user.role] ?? PLAN_META.free;
  const planColor = meta.color;
  const tooltipStyle = { background: '#10141f', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 };

  const TABS = [
    { id: 'visao',        label: 'Visão Geral',   Icon: Trophy },
    { id: 'uso',          label: 'Meu Uso',       Icon: TrendingUp },
    { id: 'pagamentos',   label: 'Pagamentos',    Icon: CreditCard },
    { id: 'notificacoes', label: 'Notificações',  Icon: Bell, badge: stats?.notifications?.filter(n => !n.read).length },
    { id: 'conta',        label: 'Minha Conta',   Icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-[#07090f] text-slate-100">

      {/* Header */}
      <div className="bg-slate-900/80 border-b border-white/[0.07] px-6 py-3 flex items-center gap-3">
        <button onClick={() => go('/')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="w-px h-5 bg-white/[0.08]" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2"
            style={{ background: planColor + '20', borderColor: planColor + '55' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{user.name}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold" style={{ color: planColor }}>{meta.icon} {meta.name}</span>
              {stats?.streak_days != null && stats.streak_days > 0 && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Flame className="w-3 h-3" />{stats.streak_days}d seguidos
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1" />
        {user.role === 'free' && (
          <button onClick={() => go('/planos')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors text-xs font-bold">
            <Zap className="w-3 h-3" /> Upgrade
          </button>
        )}
        <button onClick={logout} className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/[0.08] border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-colors">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.07] bg-[#07090f] px-6 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className={cn('flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all',
              tab === id ? 'border-current' : 'border-transparent text-slate-500 hover:text-slate-300')}
            style={tab === id ? { color: planColor, borderColor: planColor } : undefined}>
            <Icon className="w-3.5 h-3.5" />{label}
            {badge ? <span className="w-4 h-4 rounded-full bg-red-500 text-[9px] font-black text-white flex items-center justify-center">{badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* VISÃO GERAL */}
        {tab === 'visao' && (<>
          <Card className="p-5 flex items-center gap-4" style={{ boxShadow: `0 0 40px -20px ${planColor}` }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: planColor + '20', border: `2px solid ${planColor}40` }}>
              {meta.icon}
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Seu Plano</div>
              <div className="text-lg font-black" style={{ color: planColor }}>{meta.name}</div>
              {stats?.subscription && (
                <div className="text-xs text-slate-500 mt-0.5">
                  {stats.subscription.status === 'active' && stats.subscription.period_end
                    ? `Renova em ${fmt(stats.subscription.period_end as number)}`
                    : String(stats.subscription.status)}
                  {(stats.subscription.amount_brl as number) > 0 && ` · ${fmtBrl(stats.subscription.amount_brl as number)}/mês`}
                </div>
              )}
            </div>
            {user.role !== 'elite' && user.role !== 'admin' && (
              <button onClick={() => go('/planos')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors"
                style={{ color: planColor, borderColor: planColor + '40', background: planColor + '10' }}>
                Upgrade <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Análises hoje', value: stats?.usage?.today?.analysis ?? 0, Icon: TrendingUp, color: '#3b82f6' },
              { label: 'Este mês',      value: stats?.usage?.last_30d?.analysis ?? 0, Icon: TrendingUp, color: '#60a5fa' },
              { label: 'Favoritos',     value: stats?.usage?.total?.favorite ?? 0, Icon: Star, color: '#f59e0b' },
              { label: 'Streak',        value: `${stats?.streak_days ?? 0}d`, Icon: Flame, color: '#ef4444' },
            ].map(({ label, value, Icon, color }) => (
              <Card key={label} className="p-4 space-y-1">
                <Icon className="w-4 h-4 mb-2" style={{ color }} />
                <div className="text-2xl font-black font-mono" style={{ color }}>{value}</div>
                <div className="text-[11px] text-slate-500">{label}</div>
              </Card>
            ))}
          </div>

          {stats?.usage?.chart && stats.usage.chart.length > 0 && (
            <Card className="p-5">
              <div className="text-sm font-semibold mb-4 text-slate-300">Atividade — últimos 30 dias</div>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={stats.usage.chart} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={planColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={planColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4a5568' }} tickFormatter={dayLabel} />
                  <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#8892b0' }} />
                  <Area type="monotone" dataKey="n" name="Ações" stroke={planColor} fill="url(#gA)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {stats?.member_since && (
            <p className="text-xs text-slate-600 text-center">
              Membro desde {fmt(stats.member_since)} · {user.login_count} logins realizados
            </p>
          )}
        </>)}

        {/* USO */}
        {tab === 'uso' && (<>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">Estatísticas de uso</h2>
            <button onClick={loadStats} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-slate-400 hover:text-slate-200 transition-colors">
              <RefreshCw className={cn('w-3 h-3', busy && 'animate-spin')} /> Atualizar
            </button>
          </div>
          {stats?.usage?.last_30d && Object.keys(ACTION_LABELS).map(action => {
            const cfg = ACTION_LABELS[action];
            const val30d = stats.usage.last_30d[action] ?? 0;
            const valTotal = stats.usage.total[action] ?? 0;
            const valHoje = stats.usage.today[action] ?? 0;
            if (valTotal === 0) return null;
            return (
              <Card key={action} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <cfg.icon className="w-4 h-4" style={{ color: cfg.color }} />
                  <span className="text-sm font-semibold text-slate-200">{cfg.label}</span>
                  <span className="ml-auto text-xs text-slate-500">Hoje: <strong style={{ color: cfg.color }}>{valHoje}</strong></span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ l: 'Últimos 30 dias', v: val30d }, { l: 'Total histórico', v: valTotal }].map(({ l, v }) => (
                    <div key={l} className="bg-white/[0.03] rounded-xl p-3 text-center">
                      <div className="text-xl font-black font-mono" style={{ color: cfg.color }}>{v}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{l}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
          {stats?.usage?.chart && (
            <Card className="p-5">
              <div className="text-sm font-semibold mb-4 text-slate-300">Atividade diária</div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={stats.usage.chart} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4a5568' }} tickFormatter={dayLabel} />
                  <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#8892b0' }} />
                  <Bar dataKey="n" name="Ações" fill={planColor} radius={[3,3,0,0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>)}

        {/* PAGAMENTOS */}
        {tab === 'pagamentos' && (<>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">Histórico de pagamentos</h2>
            <button onClick={() => go('/planos')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors">
              <Zap className="w-3 h-3" /> Gerenciar plano
            </button>
          </div>
          {!stats?.payments?.length ? (
            <Card className="p-10 text-center text-slate-500 space-y-2">
              <CreditCard className="w-7 h-7 mx-auto opacity-30" />
              <p className="text-sm">Nenhum pagamento registrado</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-black/20">
                    {['Data','Valor','Método','Status',''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.payments.map((p, i) => {
                    const st = STATUS_CFG[p.status as string] ?? STATUS_CFG.pending;
                    return (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">{fmt(p.created_at as number)}</td>
                        <td className="px-4 py-3 font-bold text-emerald-400 font-mono">{fmtBrl(p.amount_brl as number)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{METHOD_LABELS[p.method as string] ?? p.method as string}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border', st.cls, st.color)}>
                            {p.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.status === 'paid' && (
                            <button onClick={async () => {
                              if (!confirm('Solicitar estorno deste pagamento?')) return;
                              const r = await fetch('/api/payments/refund', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ payment_id: p.id, reason: 'Solicitado pelo usuário' }) });
                              const d = await r.json() as { ok?: boolean; error?: string };
                              if (d.ok) { toast.success('Estorno solicitado!'); loadStats(); } else toast.error(d.error ?? 'Erro');
                            }} className="text-[11px] text-red-400 border border-red-500/25 rounded-lg px-2 py-1 hover:bg-red-500/10 transition-colors">
                              Estornar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
          {subscription && subscription.plan_slug !== 'free' && (
            <Card className="p-5 border-red-500/15 space-y-3">
              <div className="text-sm font-semibold text-slate-200">Cancelar assinatura</div>
              <p className="text-xs text-slate-500">O acesso continua ativo até o fim do período atual. Não há reembolso proporcional.</p>
              <button onClick={cancelSub} disabled={cancelBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 hover:bg-red-500/15 text-xs font-semibold transition-colors">
                {cancelBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Cancelar assinatura
              </button>
            </Card>
          )}
        </>)}

        {/* NOTIFICAÇÕES */}
        {tab === 'notificacoes' && (<>
          <h2 className="text-sm font-bold text-slate-200">Notificações</h2>
          {!stats?.notifications?.length ? (
            <Card className="p-10 text-center text-slate-500 space-y-2">
              <Bell className="w-7 h-7 mx-auto opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {stats.notifications.map((n, i) => {
                const dotColor: Record<string, string> = { success: 'bg-emerald-400', warning: 'bg-amber-400', info: 'bg-blue-400', payment: 'bg-purple-400' };
                return (
                  <Card key={i} className={cn('p-4 flex gap-3 items-start', n.read && 'opacity-50')}>
                    <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', dotColor[n.type as string] ?? 'bg-blue-400')} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-100">{n.title as string}</div>
                      <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body as string}</div>
                      <div className="text-[11px] text-slate-600 mt-1">{fmt(n.created_at as number)}</div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>)}

        {/* CONTA */}
        {tab === 'conta' && (
          <div className="max-w-md space-y-4">
            <h2 className="text-sm font-bold text-slate-200">Configurações da conta</h2>

            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <User className="w-4 h-4" style={{ color: planColor }} /> Perfil
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold block mb-1.5">Nome</label>
                  <Input value={editName} onChange={setEditarName} />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold block mb-1.5">E-mail</label>
                  <Input value={user.email} disabled />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold block mb-1.5">Telefone</label>
                  <Input value={editPhone} onChange={setEditarPhone} placeholder="(11) 9xxxx-xxxx" />
                </div>
                <button onClick={saveProfile} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors" style={{ background: planColor }}>
                  <CheckCircle2 className="w-4 h-4" /> Salvar alterações
                </button>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Shield className="w-4 h-4" style={{ color: planColor }} /> Alterar senha
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Input type={showPwd ? 'text' : 'password'} value={currPwd} onChange={setCurrPwd} placeholder="Senha atual" />
                  <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Input type="password" value={newPwd} onChange={setNewPwd} placeholder="Nova senha (mín. 8 caracteres)" />
                {pwdMsg && <p className="text-xs text-red-400">{pwdMsg}</p>}
                <button onClick={changePassword} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-sm font-bold transition-colors">
                  <Shield className="w-4 h-4" /> Alterar senha
                </button>
              </div>
            </Card>

            <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 hover:bg-red-500/15 text-sm font-semibold transition-colors">
              <LogOut className="w-4 h-4" /> Sair da conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
