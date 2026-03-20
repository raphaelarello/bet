// Rapha Guru — Minha Conta (Dashboard do Assinante)

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth, PLAN_META } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  User, Bell, CreditCard, Settings, ArrowLeft, Flame, TrendingUp,
  Flag, Trophy, Star, Zap, Crown, CheckCircle2, XCircle, Clock,
  LogOut, ChevronRight, RefreshCw, Shield, Eye, EyeOff, Loader2,
} from 'lucide-react';

interface Stats {
  user: Record<string,unknown>;
  subscription: Record<string,unknown> | null;
  usage: {
    total: Record<string,number>;
    last_30d: Record<string,number>;
    today: Record<string,number>;
    chart: { day: string; n: number }[];
  };
  streak_days: number;
  payments: Record<string,unknown>[];
  notifications: Record<string,unknown>[];
  member_since: number | null;
}

// ── Helpers ───────────────────────────────────────────────────
const fmt = (ts: number) => new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtBrl = (v: number) => `R$ ${v.toFixed(2)}`;
const dayLabel = (iso: string) => iso.slice(5); // MM-DD

const ACTION_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  analysis:   { label: 'Análises',   icon: TrendingUp, color: '#3b82f6' },
  favorite:   { label: 'Favoritos',  icon: Star,       color: '#f59e0b' },
  betslip_add:{ label: 'Bilhete',    icon: CreditCard, color: '#a855f7' },
  alert:      { label: 'Alertas',    icon: Bell,       color: '#22c55e' },
  comparison: { label: 'Comparações',icon: Flag,       color: '#06b6d4' },
};

const METHOD_LABELS: Record<string, string> = {
  pix: 'PIX', credit_card: 'Cartão', boleto: 'Boleto',
};

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  paid:    { color: '#22c55e', bg: 'rgba(34,197,94,.1)',  label: 'Pago' },
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,.1)', label: 'Pendente' },
  failed:  { color: '#ef4444', bg: 'rgba(239,68,68,.1)',  label: 'Falhou' },
  refunded:{ color: '#8892b0', bg: 'rgba(136,146,176,.1)',label: 'Estornado' },
};

// ── Componente principal ──────────────────────────────────────
export default function MyAccountPage() {
  const [, go] = useLocation();
  const { user, subscription, logout, token, refresh: refreshCtx } = useAuth();
  const [tab,   setTab]   = useState<'visao'|'uso'|'pagamentos'|'notificacoes'|'conta'>('visao');
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy,  setBusy]  = useState(false);
  const [cancelBusy, setCancelarBusy] = useState(false);

  // Senha
  const [currPwd, setCurrPwd] = useState('');
  const [newPwd,  setNewPwd]  = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg,  setPwdMsg]  = useState('');

  // Perfil
  const [editName,  setEditarName]  = useState('');
  const [editPhone, setEditarPhone] = useState('');

  useEffect(() => { if (user) { setEditarName(user.name); setEditarPhone(user.phone ?? ''); } }, [user]);

  const loadStats = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await fetch('/api/user/stats', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json() as Stats;
      setStats(d);
    } catch { toast.error('Erro ao carregar estatísticas'); }
    setBusy(false);
  };

  useEffect(() => { loadStats(); }, [token]);

  const cancelSub = async () => {
    if (!confirm('Cancelarar assinatura? O acesso continua até o fim do período.')) return;
    setCancelarBusy(true);
    const r = await fetch('/api/payments/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: 'Cancelarado pelo usuário' }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    setCancelarBusy(false);
    if (d.ok) { toast.success('Assinatura cancelada.'); await refreshCtx(); loadStats(); }
    else toast.error(d.error ?? 'Erro');
  };

  const saveProfile = async () => {
    const r = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: editName, phone: editPhone }),
    });
    if (r.ok) { toast.success('Perfil atualizado!'); refreshCtx(); }
    else toast.error('Erro ao salvar');
  };

  const changePassword = async () => {
    setPwdMsg('');
    if (!currPwd || !newPwd) { setPwdMsg('Preencha todos os campos'); return; }
    if (newPwd.length < 8)   { setPwdMsg('Mínimo 8 caracteres'); return; }
    const r = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current: currPwd, novo: newPwd }),
    });
    const d = await r.json() as { ok?: boolean; message?: string; error?: string };
    if (d.ok) { toast.success(d.message ?? 'Senha alterada!'); setCurrPwd(''); setNewPwd(''); }
    else setPwdMsg(d.error ?? 'Erro');
  };

  if (!user) return (
    <div style={{ minHeight: '100vh', background: '#07090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#4a5568', marginBottom: 12 }}>Você precisa estar logado</p>
        <button onClick={() => go('/login')} style={{ padding: '9px 20px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Entrar</button>
      </div>
    </div>
  );

  const meta = PLAN_META[user.role] ?? PLAN_META.free;
  const planColor = meta.color;

  const S = {
    page:   { minHeight: '100vh', background: '#07090f', color: '#e8eeff', fontFamily: "'Space Grotesk',system-ui,sans-serif" } as React.CSSProperties,
    card:   { background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12 } as React.CSSProperties,
    inp:    { width: '100%', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', color: '#e8eeff', fontSize: 13, outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
    btn:    (col: string) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, background: col, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' } as React.CSSProperties),
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ background: '#10141f', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => go('/')} style={{ ...S.btn('rgba(255,255,255,.06)'), color: '#8892b0', fontSize: 12 }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Voltar
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${planColor}20`, border: `2px solid ${planColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{user.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <span style={{ color: planColor, fontWeight: 700 }}>{meta.icon} {meta.name}</span>
              {stats?.streak_days != null && stats.streak_days > 0 && (
                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Flame style={{ width: 11, height: 11 }} /> {stats.streak_days}d seguidos
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {user.role === 'free' && (
          <button onClick={() => go('/planos')} style={{ ...S.btn('#f59e0b'), fontSize: 12 }}>
            <Zap style={{ width: 13, height: 13 }} /> Fazer upgrade
          </button>
        )}

        <button onClick={logout} style={{ ...S.btn('rgba(239,68,68,.12)'), color: '#ef4444', fontSize: 12 }}>
          <LogOut style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.07)', background: '#0b0e17', padding: '0 24px', overflowX: 'auto' }}>
        {([
          { id: 'visao', label: 'Visão Geral', Icon: Trophy, badge: undefined },
          { id: 'uso', label: 'Meu Uso', Icon: TrendingUp, badge: undefined },
          { id: 'pagamentos', label: 'Pagamentos', Icon: CreditCard, badge: undefined },
          { id: 'notificacoes', label: 'Notificações', Icon: Bell, badge: stats?.notifications?.filter((n) => !n.read).length },
          { id: 'conta', label: 'Minha Conta', Icon: Settings, badge: undefined },
        ] as const).map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none', color: tab === id ? planColor : '#4a5568', borderBottom: tab === id ? `2px solid ${planColor}` : '2px solid transparent', position: 'relative', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'color .12s' }}>
            <Icon style={{ width: 13, height: 13 }} /> {label}
            {badge ? <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span> : null}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* ── VISÃO GERAL ── */}
        {tab === 'visao' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Plano atual */}
            <div style={{ ...S.card, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: `0 0 40px -20px ${planColor}` }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `${planColor}20`, border: `2px solid ${planColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {meta.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#4a5568', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>Seu Plano</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: planColor }}>{meta.name}</div>
                {stats?.subscription && (
                  <div style={{ fontSize: 12, color: '#4a5568', marginTop: 2 }}>
                    {stats.subscription.status === 'active' && stats.subscription.period_end
                      ? `Renova em ${fmt(stats.subscription.period_end as number)}`
                      : stats.subscription.status}
                    {stats.subscription.amount_brl as number > 0 && ` · ${fmtBrl(stats.subscription.amount_brl as number)}/mês`}
                  </div>
                )}
              </div>
              {user.role !== 'elite' && user.role !== 'admin' && (
                <button onClick={() => go('/planos')} style={{ ...S.btn(planColor), fontSize: 12 }}>
                  Fazer upgrade <ChevronRight style={{ width: 13, height: 13 }} />
                </button>
              )}
            </div>

            {/* Stats rápidos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              {[
                { label: 'Análises hoje', value: stats?.usage?.today?.analysis ?? 0, icon: TrendingUp, color: '#3b82f6' },
                { label: 'Este mês',      value: stats?.usage?.last_30d?.analysis ?? 0, icon: TrendingUp, color: '#60a5fa' },
                { label: 'Favoritos',     value: stats?.usage?.total?.favorite ?? 0, icon: Star, color: '#f59e0b' },
                { label: 'Streak',        value: `${stats?.streak_days ?? 0}d`, icon: Flame, color: '#ef4444' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{ ...S.card, padding: '14px 16px' }}>
                  <Icon style={{ width: 16, height: 16, color, marginBottom: 8 }} />
                  <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#4a5568', marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Gráfico de uso */}
            {stats?.usage?.chart && stats.usage.chart.length > 0 && (
              <div style={{ ...S.card, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Atividade nos últimos 30 dias</div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={stats.usage.chart} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={planColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={planColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4a5568' }} tickFormatter={dayLabel} />
                    <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#10141f', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#8892b0' }} />
                    <Area type="monotone" dataKey="n" name="Ações" stroke={planColor} fill="url(#gA)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Membro desde */}
            {stats?.member_since && (
              <div style={{ fontSize: 12, color: '#4a5568', textAlign: 'center' }}>
                Membro desde {fmt(stats.member_since)} · {user.login_count} logins realizados
              </div>
            )}
          </div>
        )}

        {/* ── USO ── */}
        {tab === 'uso' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Estatísticas de uso</h2>
              <button onClick={loadStats} style={{ ...S.btn('rgba(255,255,255,.06)'), color: '#8892b0', fontSize: 12 }}>
                <RefreshCw style={{ width: 12, height: 12, animation: busy ? 'spin 1s linear infinite' : 'none' }} /> Atualizar
              </button>
            </div>

            {/* Barras por ação */}
            {stats?.usage?.last_30d && Object.keys(ACTION_LABELS).map(action => {
              const cfg = ACTION_LABELS[action];
              const val30d = stats.usage.last_30d[action] ?? 0;
              const valTotal = stats.usage.total[action] ?? 0;
              const valHoje = stats.usage.today[action] ?? 0;
              if (valTotal === 0) return null;
              return (
                <div key={action} style={{ ...S.card, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <cfg.icon style={{ width: 16, height: 16, color: cfg.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{cfg.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4a5568' }}>
                      Hoje: <strong style={{ color: cfg.color }}>{valHoje}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[{ l: 'Últimos 30 dias', v: val30d }, { l: 'Total histórico', v: valTotal }].map(({ l, v }) => (
                      <div key={l} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, fontFamily: 'monospace' }}>{v}</div>
                        <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Gráfico de barras por dia */}
            {stats?.usage?.chart && (
              <div style={{ ...S.card, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Atividade diária</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={stats.usage.chart} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4a5568' }} tickFormatter={dayLabel} />
                    <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#10141f', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#8892b0' }} />
                    <Bar dataKey="n" name="Ações" fill={planColor} radius={[3,3,0,0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── PAGAMENTOS ── */}
        {tab === 'pagamentos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Histórico de pagamentos</h2>
              <button onClick={() => go('/planos')} style={{ ...S.btn('#3b82f6'), fontSize: 12 }}>
                <Zap style={{ width: 13, height: 13 }} /> Gerenciar plano
              </button>
            </div>

            {!stats?.payments?.length ? (
              <div style={{ ...S.card, padding: 32, textAlign: 'center', color: '#4a5568' }}>
                <CreditCard style={{ width: 28, height: 28, margin: '0 auto 10px', opacity: .4 }} />
                <p style={{ fontSize: 13 }}>Nenhum pagamento registrado</p>
              </div>
            ) : (
              <div style={{ ...S.card, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0b0e17' }}>
                      {['Data', 'Valor', 'Método', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid rgba(255,255,255,.07)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.payments.map((p, i) => {
                      const st = STATUS_STYLE[p.status as string] ?? STATUS_STYLE.pending;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                          <td style={{ padding: '11px 16px', color: '#8892b0', fontFamily: 'monospace', fontSize: 12 }}>{fmt(p.created_at as number)}</td>
                          <td style={{ padding: '11px 16px', fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>{fmtBrl(p.amount_brl as number)}</td>
                          <td style={{ padding: '11px 16px', color: '#8892b0' }}>{METHOD_LABELS[p.method as string] ?? p.method as string}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, padding: '3px 9px', borderRadius: 20 }}>
                                {p.status === 'paid' ? <CheckCircle2 style={{ width: 11, height: 11 }} /> : <Clock style={{ width: 11, height: 11 }} />}
                                {st.label}
                              </span>
                              {p.status === 'paid' && (
                                <button onClick={async () => {
                                  if (!confirm('Solicitar estorno deste pagamento?')) return;
                                  const r = await fetch('/api/payments/refund', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ payment_id: p.id, reason: 'Solicitado pelo usuário' }),
                                  });
                                  const d = await r.json() as { ok?: boolean; error?: string };
                                  if (d.ok) { toast.success('Estorno solicitado! Prazo: 7 dias úteis.'); loadStats(); }
                                  else toast.error(d.error ?? 'Erro');
                                }} style={{ background: 'none', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', borderRadius: 6, padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                                  Estornar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cancelarar assinatura */}
            {subscription && subscription.plan_slug !== 'free' && (
              <div style={{ ...S.card, padding: '16px 18px', borderColor: 'rgba(239,68,68,.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Cancelarar assinatura</div>
                <p style={{ fontSize: 12, color: '#4a5568', marginBottom: 12 }}>O acesso continua ativo até o fim do período atual. Não há reembolso proporcional.</p>
                <button onClick={cancelSub} disabled={cancelBusy}
                  style={{ ...S.btn('rgba(239,68,68,.1)'), color: '#ef4444', fontSize: 12, border: '1px solid rgba(239,68,68,.2)' }}>
                  {cancelBusy ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <XCircle style={{ width: 13, height: 13 }} />}
                  Cancelarar assinatura
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── NOTIFICAÇÕES ── */}
        {tab === 'notificacoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Notificações</h2>
            {!stats?.notifications?.length ? (
              <div style={{ ...S.card, padding: 32, textAlign: 'center', color: '#4a5568' }}>
                <Bell style={{ width: 28, height: 28, margin: '0 auto 10px', opacity: .4 }} />
                <p style={{ fontSize: 13 }}>Nenhuma notificação</p>
              </div>
            ) : (
              stats.notifications.map((n, i) => {
                const typeColor: Record<string, string> = { success: '#22c55e', warning: '#f59e0b', info: '#3b82f6', payment: '#a855f7' };
                const col = typeColor[n.type as string] ?? '#3b82f6';
                return (
                  <div key={i} style={{ ...S.card, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', opacity: n.read ? .6 : 1 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{n.title as string}</div>
                      <div style={{ fontSize: 12, color: '#4a5568', lineHeight: 1.5 }}>{n.body as string}</div>
                      <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>{fmt(n.created_at as number)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── CONTA ── */}
        {tab === 'conta' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Configurações da conta</h2>

            {/* Editarar perfil */}
            <div style={{ ...S.card, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <User style={{ width: 14, height: 14, color: planColor }} /> Perfil
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, display: 'block', marginBottom: 5 }}>Nome</label>
                  <input value={editName} onChange={e => setEditarName(e.target.value)} style={S.inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, display: 'block', marginBottom: 5 }}>E-mail</label>
                  <input value={user.email} disabled style={{ ...S.inp, opacity: .5 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, display: 'block', marginBottom: 5 }}>Telefone</label>
                  <input value={editPhone} onChange={e => setEditarPhone(e.target.value)} placeholder="(11) 9xxxx-xxxx" style={S.inp} />
                </div>
                <button onClick={saveProfile} style={{ ...S.btn(planColor), justifyContent: 'center', marginTop: 4 }}>
                  <CheckCircle2 style={{ width: 14, height: 14 }} /> Salvar alterações
                </button>
              </div>
            </div>

            {/* Alterar senha */}
            <div style={{ ...S.card, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Shield style={{ width: 14, height: 14, color: planColor }} /> Alterar senha
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={currPwd} onChange={e => setCurrPwd(e.target.value)} placeholder="Senha atual" style={S.inp} />
                  <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', display: 'flex' }}>
                    {showPwd ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                  </button>
                </div>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nova senha (mín. 8 caracteres)" style={S.inp} />
                {pwdMsg && <p style={{ fontSize: 12, color: '#ef4444' }}>{pwdMsg}</p>}
                <button onClick={changePassword} style={{ ...S.btn('#ef4444'), justifyContent: 'center' }}>
                  <Shield style={{ width: 14, height: 14 }} /> Alterar senha
                </button>
              </div>
            </div>

            {/* Logout */}
            <button onClick={logout} style={{ ...S.btn('rgba(239,68,68,.1)'), color: '#ef4444', border: '1px solid rgba(239,68,68,.2)', justifyContent: 'center' }}>
              <LogOut style={{ width: 14, height: 14 }} /> Sair da conta
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
