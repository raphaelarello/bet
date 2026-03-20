// Rapha Guru — Central de Automação v2.0
// UX: 4 etapas claras → Selecionar contas → Revisar bilhete → Configurar → Executar

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useBetslip } from '@/contexts/BetslipContext';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, LogIn, RefreshCw, Zap, ShieldCheck,
  Eye, EyeOff, AlertTriangle, CheckCircle2, XCircle, Clock,
  Activity, Settings, Play, Loader2, WifiOff, Target,
  DollarSign, TrendingUp, BarChart3, Lock, Unlock,
  ChevronRight, ChevronDown, Info, Wifi, Star,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
interface Account {
  id: string; bookmaker: string; name: string;
  username: string; maxDailyStake: number; maxSingleStake: number; enabled: boolean;
}
interface BookmakerDef { id: string; name: string; url: string; color: string; supported: boolean; }
interface AutoStatus {
  state: 'idle' | 'logging_in' | 'ready' | 'placing_bet' | 'error' | 'banned';
  message: string; updatedAt?: string; balance?: number;
}
interface BetLog { ts: string; bookmaker: string; match: string; market: string; odds: number; stake: number; success: boolean; betId?: string; error?: string; }

// ── Helpers ────────────────────────────────────────────────────
const API = '/api/automation';
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error((e as { error: string }).error); }
  return res.json() as Promise<T>;
}

const BK_COLORS: Record<string, string> = {
  betano: '#e4002b', bet365: '#1d7a00', superbet: '#ff6600', kto: '#00a8e0',
  estrelabet: '#ffd700', brasileirao: '#009c3b', seubet: '#7c3aed',
};

function StatusPill({ s }: { s: AutoStatus | null }) {
  if (!s) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,.05)', color: '#4e5c7a', border: '1px solid rgba(255,255,255,.07)' }}>
      <WifiOff style={{ width: 10, height: 10 }} /> Offline
    </span>
  );
  const cfg = {
    idle:        { bg: 'rgba(255,255,255,.05)', c: '#4e5c7a', label: '● Aguardando' },
    logging_in:  { bg: 'rgba(59,130,246,.12)',  c: '#60a5fa', label: '● Entrando...' },
    ready:       { bg: 'rgba(34,197,94,.12)',   c: '#22c55e', label: '● Pronto' },
    placing_bet: { bg: 'rgba(245,158,11,.12)',  c: '#f59e0b', label: '● Apostando' },
    error:       { bg: 'rgba(239,68,68,.12)',   c: '#ef4444', label: '● Erro' },
    banned:      { bg: 'rgba(168,85,247,.12)',  c: '#a855f7', label: '● Banido' },
  }[s.state] ?? { bg: 'rgba(255,255,255,.05)', c: '#4e5c7a', label: '● Desconhecido' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.c }}>
      {cfg.label}
      {s.balance != null ? ` · R$ ${s.balance.toFixed(2)}` : ''}
    </span>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function AutomationCenter() {
  const [, go] = useLocation();
  const { items: slip, stake, totalOdds } = useBetslip();

  const [step, setStep] = useState<'contas' | 'bilhete' | 'config' | 'executar'>('contas');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bookmakers, setBookmakers] = useState<BookmakerDef[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AutoStatus>>({});
  const [logs, setLogs] = useState<BetLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form nova conta
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bookmaker: 'betano', name: '', username: '', password: '', maxDailyStake: 500, maxSingleStake: 100 });
  const [showPass, setShowPass] = useState(false);

  // Config execução
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [stakeOverride, setStakeOverride] = useState<number | null>(null);
  const [minOdds, setMinOdds] = useState(1.3);
  const [maxOdds, setMaxOdds] = useState(10.0);
  const [delayBetBets, setDelayBetBets] = useState(5);

  const loadAll = useCallback(async () => {
    try {
      const [accRes, bmRes, logRes] = await Promise.all([
        apiFetch<{ accounts: Account[] }>('/accounts'),
        apiFetch<{ bookmakers: BookmakerDef[] }>('/bookmakers'),
        apiFetch<{ entries: BetLog[] }>('/logs'),
      ]);
      setAccounts(accRes.accounts);
      setBookmakers(bmRes.bookmakers);
      setLogs(logRes.entries);
    } catch {
      setBookmakers([
        { id: 'betano', name: 'Betano', url: 'betano.bet.br', color: '#e4002b', supported: true },
        { id: 'bet365', name: 'bet365', url: 'bet365.bet.br', color: '#1d7a00', supported: true },
        { id: 'superbet', name: 'Superbet', url: 'superbet.bet.br', color: '#ff6600', supported: true },
        { id: 'kto', name: 'KTO', url: 'kto.bet.br', color: '#00a8e0', supported: true },
        { id: 'estrelabet', name: 'EstrelaBet', url: 'estrelabet.bet.br', color: '#ffd700', supported: true },
        { id: 'seubet', name: 'Seubet', url: 'seubet.com.br', color: '#7c3aed', supported: true },
        { id: 'brasileirao', name: 'Brasileirão', url: 'brasileiraoapostasesportivas.bet.br', color: '#009c3b', supported: false },
      ]);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const r = await apiFetch<{ status: Record<string, AutoStatus> }>('/status');
      setStatuses(r.status);
    } catch {}
  }, []);

  useEffect(() => { loadAll(); const t = setInterval(loadStatus, 5000); return () => clearInterval(t); }, [loadAll, loadStatus]);

  const saveAccount = async () => {
    if (!form.username || !form.password) { toast.error('Preencha e-mail e senha'); return; }
    setLoading(true);
    try {
      await apiFetch('/accounts', { method: 'POST', body: JSON.stringify(form) });
      await loadAll();
      setShowForm(false);
      setForm({ bookmaker: 'betano', name: '', username: '', password: '', maxDailyStake: 500, maxSingleStake: 100 });
      toast.success('Conta salva com criptografia AES-256 ✓');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); }
    setLoading(false);
  };

  const loginAccount = async (acc: Account) => {
    setLoading(true);
    try {
      const r = await apiFetch<{ success: boolean; message: string }>('/login', {
        method: 'POST', body: JSON.stringify({ accountId: acc.id }),
      });
      if (r.success) toast.success(`${acc.name || acc.bookmaker}: ${r.message}`);
      else toast.error(`${acc.name || acc.bookmaker}: ${r.message}`);
      await loadStatus();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro no login'); }
    setLoading(false);
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Remover conta?')) return;
    await apiFetch(`/accounts/${id}`, { method: 'DELETE' }).catch(() => {});
    await loadAll();
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    toast.info('Conta removida');
  };

  const executeBets = async () => {
    if (!selectedIds.size) { toast.error('Selecione pelo menos uma conta'); return; }
    if (!slip.length) { toast.error('Bilhete vazio'); return; }
    if (!autoConfirm) {
      const total = (stakeOverride ?? stake) * selectedIds.size;
      if (!confirm(`Confirmar execução?\n\n${slip.length} aposta(s) × ${selectedIds.size} conta(s)\nTotal: R$ ${total.toFixed(2)}`)) return;
    }
    setLoading(true);
    let ok = 0, fail = 0;
    for (const item of slip) {
      if (item.odds < minOdds || item.odds > maxOdds) {
        toast.warning(`Pulando "${item.tipLabel}" (odd ${item.odds.toFixed(2)} fora da faixa)`);
        continue;
      }
      const order = {
        matchId: item.matchId, matchLabel: item.matchLabel,
        homeTeam: item.matchLabel.split(' vs ')[0] ?? '',
        awayTeam: item.matchLabel.split(' vs ')[1] ?? '',
        marketLabel: item.tipLabel, marketType: item.category,
        selection: item.tipLabel.toLowerCase().includes('over') ? 'over' : 'home',
        odds: item.odds, stake: stakeOverride ?? (stake / Math.max(slip.length, 1)),
        probability: item.probability, confidence: item.confidence,
        requireConfirmation: !autoConfirm,
      };
      try {
        const r = await apiFetch<{ results: { success: boolean; bookmaker: string; error?: string; betId?: string }[] }>('/bet/multi', {
          method: 'POST', body: JSON.stringify({ accountIds: Array.from(selectedIds), order }),
        });
        for (const res of r.results) {
          if (res.success) { ok++; toast.success(`✓ ${res.bookmaker}: ${item.tipLabel} @ ${item.odds.toFixed(2)}`); }
          else { fail++; toast.error(`✗ ${res.bookmaker}: ${res.error}`); }
        }
      } catch (e) { fail++; toast.error(e instanceof Error ? e.message : 'Erro'); }
      if (slip.indexOf(item) < slip.length - 1)
        await new Promise(r => setTimeout(r, (delayBetBets + Math.random() * 3) * 1000));
    }
    await loadAll();
    setLoading(false);
    if (ok) toast.success(`${ok} aposta(s) realizadas com sucesso!`);
    if (fail) toast.error(`${fail} aposta(s) falharam`);
  };

  // ── Styles ─────────────────────────────────────────────────
  const S = {
    page:  { minHeight: '100vh', background: '#060810', color: '#e8eeff', fontFamily: "'DM Sans', system-ui, sans-serif" } as React.CSSProperties,
    card:  { background: '#0d1117', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12 } as React.CSSProperties,
    inp:   { width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', color: '#e8eeff', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' } as React.CSSProperties,
    btn:   (c: string, tc = '#fff') => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, background: c, color: tc, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' } as React.CSSProperties),
  };

  const STEPS = [
    { id: 'contas',  label: '1. Contas',   done: accounts.length > 0 },
    { id: 'bilhete', label: '2. Bilhete',  done: slip.length > 0 },
    { id: 'config',  label: '3. Config.',  done: true },
    { id: 'executar',label: '4. Executar', done: false },
  ] as const;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ background: '#0d1117', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => go('/')} style={{ ...S.btn('rgba(255,255,255,.06)', '#8892b0'), fontSize: 12 }}>
          <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap style={{ width: 14, height: 14, color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Central de Automação</div>
            <div style={{ fontSize: 10, color: '#4e5c7a' }}>Suas contas · Suas regras · Uso pessoal</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Bilhete resumo */}
        {slip.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 9, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', fontSize: 12 }}>
            <Target style={{ width: 13, height: 13, color: '#22c55e' }} />
            <span style={{ color: '#22c55e', fontWeight: 700 }}>{slip.length} seleções</span>
            <span style={{ color: '#4e5c7a' }}>·</span>
            <span style={{ color: '#22c55e', fontWeight: 700 }}>{totalOdds.toFixed(2)}x</span>
            <span style={{ color: '#4e5c7a' }}>·</span>
            <span style={{ color: '#22c55e', fontWeight: 700 }}>R$ {stake}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.18)', fontSize: 11, color: '#f59e0b' }}>
          <ShieldCheck style={{ width: 12, height: 12 }} /> Uso pessoal
        </div>
      </div>

      {/* Steps nav */}
      <div style={{ display: 'flex', background: '#09090f', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 20px', overflowX: 'auto' }}>
        {STEPS.map(({ id, label, done }, i) => (
          <button key={id} onClick={() => setStep(id as typeof step)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none', color: step === id ? '#f59e0b' : done ? '#22c55e' : '#4e5c7a', borderBottom: step === id ? '2px solid #f59e0b' : '2px solid transparent', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'color .12s' }}>
            {done && step !== id ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : <span style={{ width: 18, height: 18, borderRadius: '50%', background: step === id ? '#f59e0b' : 'rgba(255,255,255,.07)', color: step === id ? '#000' : '#4e5c7a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{i + 1}</span>}
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={loadAll} style={{ ...S.btn('transparent', '#4e5c7a'), padding: '0 12px', border: 'none' }}>
          <RefreshCw style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px' }}>

        {/* ══ STEP 1: CONTAS ══ */}
        {step === 'contas' && (
          <div>
            {/* Aviso */}
            <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', marginBottom: 18 }}>
              <Lock style={{ width: 14, height: 14, color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: '#9ba8c5', lineHeight: 1.5 }}>
                <strong style={{ color: '#f59e0b' }}>Credenciais protegidas com AES-256.</strong> Armazenadas em{' '}
                <code style={{ background: '#161c2a', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>data/accounts.enc.json</code>.
                Use uma senha diferente da do e-mail e banco. Somente você tem a chave de descriptografia.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Contas cadastradas ({accounts.length})</h2>
              <button onClick={() => setShowForm(f => !f)} style={S.btn('rgba(59,130,246,.15)', '#60a5fa')}>
                <Plus style={{ width: 13, height: 13 }} /> Nova conta
              </button>
            </div>

            {/* Form nova conta */}
            {showForm && (
              <div style={{ ...S.card, padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: '#60a5fa' }}>Adicionar conta</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#4e5c7a', fontWeight: 600, display: 'block', marginBottom: 5 }}>Casa de apostas</label>
                    <select value={form.bookmaker} onChange={e => setForm(f => ({ ...f, bookmaker: e.target.value }))}
                      style={{ ...S.inp }}>
                      {bookmakers.filter(b => b.supported).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#4e5c7a', fontWeight: 600, display: 'block', marginBottom: 5 }}>Apelido (opcional)</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Conta principal" style={S.inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#4e5c7a', fontWeight: 600, display: 'block', marginBottom: 5 }}>E-mail / CPF</label>
                    <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="seu@email.com" style={S.inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#4e5c7a', fontWeight: 600, display: 'block', marginBottom: 5 }}>Senha</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" style={{ ...S.inp, paddingRight: 36 }} />
                      <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4e5c7a' }}>
                        {showPass ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#4e5c7a', fontWeight: 600, display: 'block', marginBottom: 5 }}>Limite diário (R$)</label>
                    <input type="number" value={form.maxDailyStake} onChange={e => setForm(f => ({ ...f, maxDailyStake: Number(e.target.value) }))} style={S.inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#4e5c7a', fontWeight: 600, display: 'block', marginBottom: 5 }}>Limite por aposta (R$)</label>
                    <input type="number" value={form.maxSingleStake} onChange={e => setForm(f => ({ ...f, maxSingleStake: Number(e.target.value) }))} style={S.inp} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={saveAccount} disabled={loading} style={S.btn('#3b82f6')}>
                    {loading ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Lock style={{ width: 13, height: 13 }} />}
                    Salvar com criptografia
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ ...S.btn('rgba(255,255,255,.06)', '#8892b0') }}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Lista de contas */}
            {accounts.length === 0 && !showForm && (
              <div style={{ ...S.card, padding: 40, textAlign: 'center', color: '#4e5c7a' }}>
                <WifiOff style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: .4 }} />
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Nenhuma conta cadastrada</p>
                <p style={{ fontSize: 12, marginBottom: 16 }}>Cadastre suas contas das casas de apostas para começar</p>
                <button onClick={() => setShowForm(true)} style={S.btn('#3b82f6')}>
                  <Plus style={{ width: 13, height: 13 }} /> Adicionar primeira conta
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accounts.map(acc => {
                const col = BK_COLORS[acc.bookmaker] ?? '#8892b0';
                const status = statuses[acc.bookmaker] ?? null;
                return (
                  <div key={acc.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{acc.name || acc.bookmaker}</span>
                        <span style={{ fontSize: 11, color: '#4e5c7a', background: 'rgba(255,255,255,.04)', padding: '1px 7px', borderRadius: 4, textTransform: 'capitalize' }}>{acc.bookmaker}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#4e5c7a' }}>
                        {acc.username} · Limite/aposta: R$ {acc.maxSingleStake} · Diário: R$ {acc.maxDailyStake}
                      </div>
                    </div>
                    <StatusPill s={status} />
                    <button onClick={() => loginAccount(acc)} disabled={loading}
                      style={{ ...S.btn('rgba(59,130,246,.12)', '#60a5fa'), fontSize: 11 }}>
                      <LogIn style={{ width: 12, height: 12 }} /> Entrar
                    </button>
                    <button onClick={() => deleteAccount(acc.id)}
                      style={{ ...S.btn('rgba(239,68,68,.1)', '#ef4444'), padding: '9px 10px' }}>
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                );
              })}
            </div>

            {accounts.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button onClick={() => setStep('bilhete')} style={S.btn('#f59e0b', '#000')}>
                  Próximo: Bilhete <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 2: BILHETE ══ */}
        {step === 'bilhete' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
              {/* Seleções */}
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                  Seleções do bilhete ({slip.length})
                </h2>
                {slip.length === 0 ? (
                  <div style={{ ...S.card, padding: 40, textAlign: 'center', color: '#4e5c7a' }}>
                    <Target style={{ width: 28, height: 28, margin: '0 auto 12px', opacity: .4 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Bilhete vazio</p>
                    <p style={{ fontSize: 12, marginBottom: 16 }}>Adicione seleções nos cards de análise dos jogos</p>
                    <button onClick={() => go('/')} style={S.btn('#3b82f6')}>
                      <ArrowLeft style={{ width: 13, height: 13 }} /> Ir para análises
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {slip.map((item, i) => (
                      <div key={item.id} style={{ ...S.card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: '#1c2a3e', minWidth: 24, textAlign: 'center' }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: '#4e5c7a', marginBottom: 3 }}>{item.matchLabel}</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{item.tipLabel}</div>
                          <div style={{ fontSize: 10, color: '#4e5c7a', marginTop: 3, textTransform: 'capitalize' }}>{item.category}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>{item.odds.toFixed(2)}</div>
                          <div style={{ fontSize: 10, color: '#4e5c7a' }}>{item.probability}% prob.</div>
                        </div>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: item.confidence === 'high' ? '#22c55e' : item.confidence === 'medium' ? '#f59e0b' : '#ef4444' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo + contas selecionadas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ ...S.card, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4e5c7a', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Em quais contas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {accounts.filter(a => a.enabled !== false).map(acc => {
                      const sel = selectedIds.has(acc.id);
                      const col = BK_COLORS[acc.bookmaker] ?? '#8892b0';
                      return (
                        <button key={acc.id} onClick={() => setSelectedIds(prev => {
                          const n = new Set(prev); sel ? n.delete(acc.id) : n.add(acc.id); return n;
                        })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: sel ? 'rgba(34,197,94,.08)' : 'rgba(255,255,255,.03)', border: `1px solid ${sel ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.07)'}`, transition: 'all .12s', fontFamily: 'inherit', textAlign: 'left' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: sel ? '#e8eeff' : '#8892b0' }}>{acc.name || acc.bookmaker}</span>
                          {sel && <CheckCircle2 style={{ width: 14, height: 14, color: '#22c55e' }} />}
                        </button>
                      );
                    })}
                    {accounts.length === 0 && (
                      <p style={{ fontSize: 12, color: '#4e5c7a', textAlign: 'center', padding: '12px 0' }}>
                        Cadastre contas na etapa anterior
                      </p>
                    )}
                  </div>
                </div>

                {selectedIds.size > 0 && slip.length > 0 && (
                  <div style={{ ...S.card, padding: '14px 16px', background: 'rgba(34,197,94,.06)', borderColor: 'rgba(34,197,94,.2)' }}>
                    <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, marginBottom: 8 }}>Resumo da execução</div>
                    <div style={{ fontSize: 12, color: '#8892b0', lineHeight: 1.8 }}>
                      <div>{slip.length} aposta(s) × {selectedIds.size} conta(s)</div>
                      <div>Entrada: R$ {(stake / Math.max(slip.length, 1)).toFixed(2)}/aposta</div>
                      <div style={{ fontWeight: 700, color: '#22c55e' }}>Total: R$ {((stake / Math.max(slip.length, 1)) * slip.length * selectedIds.size).toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setStep('contas')} style={{ ...S.btn('rgba(255,255,255,.06)', '#8892b0') }}>
                <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar
              </button>
              <button onClick={() => setStep('config')} disabled={!slip.length} style={{ ...S.btn('#f59e0b', '#000'), opacity: !slip.length ? .5 : 1 }}>
                Próximo: Configurar <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 3: CONFIG ══ */}
        {step === 'config' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Configurações de execução</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Confirmação automática */}
              <div style={{ ...S.card, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Confirmação automática</div>
                  <div style={{ fontSize: 12, color: '#4e5c7a' }}>Executa sem pedir confirmação. Use com cautela.</div>
                </div>
                <button onClick={() => setAutoConfirm(p => !p)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: autoConfirm ? '#22c55e' : '#1c2335', border: `2px solid ${autoConfirm ? '#22c55e' : '#2d3655'}`, cursor: 'pointer', position: 'relative', transition: 'all .2s', flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: autoConfirm ? 22 : 2, transition: 'left .2s' }} />
                </button>
              </div>

              {/* Stake override */}
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Entrada por aposta (R$)</div>
                <div style={{ fontSize: 12, color: '#4e5c7a', marginBottom: 10 }}>Deixe em branco para usar o valor do bilhete dividido pelas seleções.</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#4e5c7a', fontSize: 13 }}>R$</span>
                  <input type="number" value={stakeOverride ?? ''} onChange={e => setStakeOverride(e.target.value ? Number(e.target.value) : null)}
                    placeholder={`Auto (${(stake / Math.max(slip.length, 1)).toFixed(2)})`}
                    style={{ width: 140, ...S.inp }} />
                </div>
              </div>

              {/* Filtro odds */}
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Filtro de cotações</div>
                <div style={{ fontSize: 12, color: '#4e5c7a', marginBottom: 10 }}>Apostas fora desta faixa serão ignoradas.</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#4e5c7a', display: 'block', marginBottom: 4 }}>Mínima</label>
                    <input type="number" step="0.1" value={minOdds} onChange={e => setMinOdds(Number(e.target.value))}
                      style={{ width: 90, ...S.inp }} />
                  </div>
                  <span style={{ color: '#4e5c7a', marginTop: 16 }}>→</span>
                  <div>
                    <label style={{ fontSize: 11, color: '#4e5c7a', display: 'block', marginBottom: 4 }}>Máxima</label>
                    <input type="number" step="0.1" value={maxOdds} onChange={e => setMaxOdds(Number(e.target.value))}
                      style={{ width: 90, ...S.inp }} />
                  </div>
                </div>
              </div>

              {/* Delay entre apostas */}
              <div style={{ ...S.card, padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Intervalo entre apostas</div>
                <div style={{ fontSize: 12, color: '#4e5c7a', marginBottom: 10 }}>Tempo mínimo de espera entre cada aposta para parecer humano.</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" min={3} max={60} value={delayBetBets} onChange={e => setDelayBetBets(Number(e.target.value))}
                    style={{ width: 80, ...S.inp }} />
                  <span style={{ color: '#4e5c7a', fontSize: 13 }}>segundos (+ variação aleatória)</span>
                </div>
              </div>

              {/* Info Playwright */}
              <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Info style={{ width: 14, height: 14, color: '#60a5fa', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: '#8892b0', lineHeight: 1.6 }}>
                    <strong style={{ color: '#60a5fa' }}>Requer servidor com Playwright.</strong> Instale com{' '}
                    <code style={{ background: '#161c2a', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>pnpm add playwright && npx playwright install chromium</code>.
                    Comportamento humano simulado: mouse path, digitação gradual, delays gaussianos, fingerprint realista.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setStep('bilhete')} style={{ ...S.btn('rgba(255,255,255,.06)', '#8892b0') }}>
                <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar
              </button>
              <button onClick={() => setStep('executar')} style={S.btn('#f59e0b', '#000')}>
                Próximo: Executar <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 4: EXECUTAR ══ */}
        {step === 'executar' && (
          <div>
            {/* Resumo final */}
            <div style={{ ...S.card, padding: '20px 22px', marginBottom: 16, background: 'rgba(34,197,94,.05)', borderColor: 'rgba(34,197,94,.2)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 12 }}>Resumo da execução</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Seleções', value: slip.length, color: '#3b82f6' },
                  { label: 'Contas', value: selectedIds.size, color: '#a855f7' },
                  { label: 'Odd total', value: `${totalOdds.toFixed(2)}x`, color: '#f59e0b' },
                  { label: 'Total a apostar', value: `R$ ${((stakeOverride ?? stake / Math.max(slip.length, 1)) * slip.length * selectedIds.size).toFixed(2)}`, color: '#22c55e' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
                    <div style={{ fontSize: 10, color: '#4e5c7a', marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seleções */}
            <div style={{ marginBottom: 16 }}>
              {slip.map((item, i) => (
                <div key={item.id} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1c2a3e', minWidth: 24, textAlign: 'center' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#4e5c7a' }}>{item.matchLabel}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.tipLabel}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>{item.odds.toFixed(2)}</div>
                    {(item.odds < minOdds || item.odds > maxOdds) && (
                      <div style={{ fontSize: 10, color: '#f59e0b' }}>⚠ fora da faixa</div>
                    )}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.confidence === 'high' ? '#22c55e' : item.confidence === 'medium' ? '#f59e0b' : '#ef4444' }} />
                </div>
              ))}
            </div>

            {/* Aviso seleções sem contas */}
            {selectedIds.size === 0 && (
              <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', marginBottom: 16 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#9ba8c5' }}>Nenhuma conta selecionada. Volte ao bilhete e selecione em quais contas apostar.</span>
              </div>
            )}

            {/* BOTÃO EXECUTE */}
            <button
              onClick={executeBets}
              disabled={loading || !slip.length || !selectedIds.size}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 800,
                border: 'none',
                cursor: loading || !slip.length || !selectedIds.size ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontFamily: 'inherit',
                background: loading || !slip.length || !selectedIds.size
                  ? '#1c2335'
                  : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: '#fff',
                boxShadow: !loading && slip.length && selectedIds.size ? '0 6px 24px rgba(34,197,94,.35)' : 'none',
                opacity: !slip.length || !selectedIds.size ? .4 : 1,
                transition: 'all .2s',
              }}
            >
              {loading
                ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Executando apostas...</>
                : <><Zap style={{ width: 18, height: 18 }} /> Executar {slip.length} aposta(s) em {selectedIds.size} conta(s)</>
              }
            </button>

            {/* Histórico recente */}
            {logs.length > 0 && (
              <div style={{ ...S.card, marginTop: 20, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: 12, fontWeight: 700, color: '#4e5c7a', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Histórico recente
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#09090f' }}>
                      {['Hora', 'Casa', 'Partida', 'Mercado', 'Odd', 'Entrada', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#4e5c7a', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid rgba(255,255,255,.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 15).map((log, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <td style={{ padding: '8px 12px', color: '#4e5c7a', fontFamily: 'monospace', fontSize: 11 }}>
                          {new Date(log.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: BK_COLORS[log.bookmaker] ?? '#8892b0' }}>● {log.bookmaker}</span>
                        </td>
                        <td style={{ padding: '8px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8892b0' }}>{log.match}</td>
                        <td style={{ padding: '8px 12px', color: '#8892b0' }}>{log.market}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{log.odds.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#f59e0b' }}>R$ {log.stake}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {log.success
                            ? <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,.1)', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>✓ OK</span>
                            : <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,.1)', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }} title={log.error}>✗ Falha</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 16 }}>
              <button onClick={() => setStep('config')} style={{ ...S.btn('rgba(255,255,255,.06)', '#8892b0') }}>
                <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
