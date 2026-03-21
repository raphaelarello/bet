// Rapha Guru — Central de Performance v3.0 BI Edition

import React, { useMemo, useState } from 'react';
import { useTipsHistory } from '@/contexts/TipsHistoryContext';
import type { HistoricalTip, TipSubResult } from '@/contexts/TipsHistoryContext';
import { cn, formatDecimal, formatPercent } from '@/lib/utils';
import { downloadWeeklyPdf } from '@/lib/reportPdf';
import { useOddsWebhookSync } from '@/hooks/useOddsWebhookSync';
import {
  Activity, BellRing, CheckCircle2, ChevronDown, ChevronUp,
  Copy, Download, FileText, FlaskConical, History, Link2,
  RefreshCw, Trash2, Wallet, XCircle, TrendingUp, TrendingDown,
  Target, Award, BarChart2, Zap, Check, X, Clock, Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const CATEGORY_LABELS: Record<string, string> = {
  result: 'Resultado', goals: 'Gols', corners: 'Escanteios', cards: 'Cartões',
  btts: 'Ambos marcam', handicap: 'Handicap', halftime: '1º Tempo', special: 'Especial', value: 'Valor',
};

function getCategoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat;
}

// ── sub-result chip ────────────────────────────────────────────────────────
function SubChip({ sub, onToggle }: { sub: TipSubResult; onToggle: (r: 'hit' | 'miss') => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-slate-400 truncate max-w-[100px]">{sub.market}</span>
      <div className="flex gap-0.5">
        <button
          onClick={() => onToggle('hit')}
          title="Acertou"
          className={cn('w-5 h-5 rounded flex items-center justify-center transition-all',
            sub.result === 'hit' ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40' : 'text-slate-600 hover:text-emerald-400 border border-transparent')}
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={() => onToggle('miss')}
          title="Errou"
          className={cn('w-5 h-5 rounded flex items-center justify-center transition-all',
            sub.result === 'miss' ? 'bg-red-500/25 text-red-400 border border-red-500/40' : 'text-slate-600 hover:text-red-400 border border-transparent')}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, tone, icon: Icon }: {
  label: string; value: string; sub?: string; tone: string; icon?: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 px-4 py-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </div>
      <div className={cn('text-xl font-black tracking-tight', tone)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

// ── mini bar ───────────────────────────────────────────────────────────────
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────
export function TipsHistory() {
  const {
    history, stats, dailyStats, weeklyStats, simulation,
    updateResult, updateSubResult, removeFromHistory, clearHistory,
    setSimulationEnabled, setSimulationInitialBalance, setSimulationDefaultStake, resetSimulation,
  } = useTipsHistory();
  const { entries, loading: oddsLoading, refetch, seedDemoData } = useOddsWebhookSync(null, true);

  const [isOpen, setIsOpen]       = useState(false);
  const [view, setView]           = useState<'dashboard' | 'lista' | 'analytics'>('dashboard');
  const [listTab, setListTab]     = useState<'all' | 'pending' | 'settled'>('all');
  const [reportMode, setReportMode] = useState<'all' | 'real' | 'simulado'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── analytics por categoria ───────────────────────────────────────────
  const categoryStats = useMemo(() => {
    const settled = history.filter(t => t.result !== 'pending' && t.result !== 'void');
    const map: Record<string, { total: number; won: number; subHits: number; subTotal: number }> = {};

    settled.forEach(tip => {
      const cat = tip.category || 'special';
      if (!map[cat]) map[cat] = { total: 0, won: 0, subHits: 0, subTotal: 0 };
      map[cat].total++;
      if (tip.result === 'won') map[cat].won++;

      // sub-results
      if (tip.subResults) {
        tip.subResults.forEach(s => {
          if (s.result !== 'pending') {
            map[cat].subTotal++;
            if (s.result === 'hit') map[cat].subHits++;
          }
        });
      }
    });

    return Object.entries(map)
      .map(([cat, v]) => ({
        cat,
        label: getCategoryLabel(cat),
        total: v.total,
        won: v.won,
        winRate: v.total > 0 ? (v.won / v.total) * 100 : 0,
        subHitRate: v.subTotal > 0 ? (v.subHits / v.subTotal) * 100 : null,
        subHits: v.subHits,
        subTotal: v.subTotal,
      }))
      .sort((a, b) => b.total - a.total);
  }, [history]);

  // ── equity curve (ROI acumulado por dia) ─────────────────────────────
  const equityCurve = useMemo(() => {
    const byDay: Record<string, { staked: number; returned: number }> = {};
    [...history]
      .filter(t => t.result !== 'pending')
      .sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime())
      .forEach(tip => {
        const day = fmtDay(tip.addedAt);
        if (!byDay[day]) byDay[day] = { staked: 0, returned: 0 };
        if (tip.result !== 'void') byDay[day].staked += tip.stake;
        byDay[day].returned += tip.result === 'won' ? tip.stake * tip.odds : tip.result === 'void' ? tip.stake : 0;
      });

    let cumStaked = 0, cumReturned = 0;
    return Object.entries(byDay).map(([day, v]) => {
      cumStaked += v.staked;
      cumReturned += v.returned;
      const roi = cumStaked > 0 ? ((cumReturned - cumStaked) / cumStaked) * 100 : 0;
      return { day, roi: parseFloat(roi.toFixed(1)), profit: parseFloat((cumReturned - cumStaked).toFixed(2)) };
    });
  }, [history]);

  // ── sub-results: totais globais ────────────────────────────────────────
  const globalSubStats = useMemo(() => {
    let hits = 0, misses = 0;
    history.forEach(tip => {
      tip.subResults?.forEach(s => {
        if (s.result === 'hit') hits++;
        if (s.result === 'miss') misses++;
      });
    });
    const total = hits + misses;
    return { hits, misses, total, rate: total > 0 ? (hits / total) * 100 : 0 };
  }, [history]);

  const filtered = useMemo(() => history.filter(tip => {
    if (reportMode !== 'all' && tip.mode !== reportMode) return false;
    if (listTab === 'pending') return tip.result === 'pending';
    if (listTab === 'settled') return tip.result !== 'pending';
    return true;
  }), [history, listTab, reportMode]);

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/odds`);
    toast.success('Endpoint copiado.');
  };

  const sendDemoWebhook = async () => {
    const ok = await seedDemoData();
    if (ok) toast.success('Feed de demonstração carregado.');
    else toast.error('Não foi possível carregar a demonstração.');
  };

  const PIE_COLORS = ['#22c55e', '#ef4444', '#f59e0b'];

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden shadow-[0_24px_70px_-50px_rgba(59,130,246,0.45)]">
      {/* Header toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <History className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-slate-100">Central de performance</span>
          <span className="text-xs rounded-full border border-slate-600/40 bg-slate-950/40 px-2 py-0.5 text-slate-300">{stats.totalBets} palpites</span>
          {globalSubStats.total > 0 && (
            <span className={cn('text-xs font-bold rounded-full px-2 py-0.5 border',
              globalSubStats.rate >= 50 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-red-500/10 text-red-300 border-red-500/20')}>
              {globalSubStats.hits}/{globalSubStats.total} mercados acertados
            </span>
          )}
          <span className={cn('text-xs font-bold rounded-full px-2 py-0.5 border',
            stats.roi >= 0 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-red-500/10 text-red-300 border-red-500/20')}>
            ROI {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-700/50">

          {/* View tabs */}
          <div className="flex border-b border-slate-700/50">
            {([
              { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
              { id: 'analytics', label: 'Análise BI', icon: TrendingUp },
              { id: 'lista',     label: 'Palpites',   icon: FileText },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setView(id)}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2',
                  view === id ? 'text-purple-300 border-purple-500 bg-purple-500/10' : 'text-slate-500 border-transparent hover:text-slate-300')}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {/* ══ DASHBOARD VIEW ══ */}
          {view === 'dashboard' && (
            <div className="p-3 space-y-3">
              {/* KPIs principais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <KpiCard icon={Target} label="Taxa de acerto" value={`${stats.winRate.toFixed(0)}%`}
                  sub={`${stats.won}V · ${stats.lost}D`}
                  tone={stats.winRate >= 55 ? 'text-emerald-300' : stats.winRate >= 40 ? 'text-amber-300' : 'text-red-300'} />
                <KpiCard icon={TrendingUp} label="ROI geral" value={`${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`}
                  sub={`${stats.totalBets} palpites`}
                  tone={stats.roi >= 0 ? 'text-emerald-300' : 'text-red-300'} />
                <KpiCard icon={Wallet} label="Lucro / prejuízo"
                  value={`${stats.roi >= 0 ? '+' : ''}R$ ${formatDecimal(stats.totalReturn - stats.totalStaked, 2)}`}
                  sub={`Investido R$ ${formatDecimal(stats.totalStaked, 0)}`}
                  tone={stats.totalReturn >= stats.totalStaked ? 'text-emerald-300' : 'text-red-300'} />
                {globalSubStats.total > 0 ? (
                  <KpiCard icon={Award} label="Acertos por mercado"
                    value={`${globalSubStats.rate.toFixed(0)}%`}
                    sub={`${globalSubStats.hits} de ${globalSubStats.total} mercados`}
                    tone={globalSubStats.rate >= 55 ? 'text-emerald-300' : 'text-amber-300'} />
                ) : (
                  <KpiCard icon={Clock} label="Pendentes" value={String(stats.pending)}
                    sub="Aguardando resultado" tone="text-amber-300" />
                )}
              </div>

              {/* Equity curve */}
              {equityCurve.length >= 2 && (
                <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">ROI acumulado</span>
                    <span className={cn('text-xs font-bold', equityCurve[equityCurve.length - 1]?.roi >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {equityCurve[equityCurve.length - 1]?.roi >= 0 ? '+' : ''}{equityCurve[equityCurve.length - 1]?.roi}%
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={equityCurve} margin={{ top: 2, right: 0, bottom: 0, left: -28 }}>
                      <defs>
                        <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#4a5568' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} />
                      <Tooltip
                        contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v}%`, 'ROI']}
                      />
                      <Area type="monotone" dataKey="roi" stroke="#a855f7" fill="url(#roiGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Acertos por categoria — ranking */}
              {categoryStats.length > 0 && (
                <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Desempenho por mercado</span>
                    <span className="text-[10px] text-slate-500">{categoryStats.length} categorias</span>
                  </div>
                  <div className="space-y-2.5">
                    {categoryStats.map(c => (
                      <div key={c.cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-medium">{c.label}</span>
                          <div className="flex items-center gap-2">
                            {c.subTotal > 0 && (
                              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border',
                                c.subHitRate! >= 55 ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-amber-400 border-amber-500/20 bg-amber-500/10')}>
                                {c.subHits}/{c.subTotal} mercados
                              </span>
                            )}
                            <span className={cn('font-bold', c.winRate >= 55 ? 'text-emerald-400' : c.winRate >= 40 ? 'text-amber-400' : 'text-red-400')}>
                              {c.winRate.toFixed(0)}%
                            </span>
                            <span className="text-slate-600 text-[10px]">{c.won}/{c.total}</span>
                          </div>
                        </div>
                        <MiniBar pct={c.winRate} color={c.winRate >= 55 ? 'bg-emerald-500' : c.winRate >= 40 ? 'bg-amber-500' : 'bg-red-500'} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pizza de resultados */}
              {stats.totalBets > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Distribuição</div>
                    <div className="flex items-center gap-3">
                      <ResponsiveContainer width={70} height={70}>
                        <PieChart>
                          <Pie data={[
                            { name: 'Acertos', value: stats.won },
                            { name: 'Erros',   value: stats.lost },
                            { name: 'Pend.',   value: stats.pending },
                          ]} cx="50%" cy="50%" innerRadius={20} outerRadius={32} dataKey="value" strokeWidth={0}>
                            {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 flex-1">
                        {[
                          { label: 'Acertos', v: stats.won, color: 'bg-emerald-500' },
                          { label: 'Erros',   v: stats.lost, color: 'bg-red-500' },
                          { label: 'Pend.',   v: stats.pending, color: 'bg-amber-500' },
                        ].map(({ label, v, color }) => (
                          <div key={label} className="flex items-center gap-1.5 text-[11px]">
                            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', color)} />
                            <span className="text-slate-400">{label}</span>
                            <span className="ml-auto font-bold text-slate-200">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4 space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Resumo diário</div>
                    <div className="text-xs text-slate-500">{dailyStats.label}</div>
                    <div className={cn('text-2xl font-black', dailyStats.roi >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                      {dailyStats.roi >= 0 ? '+' : ''}{dailyStats.roi.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-slate-500">{dailyStats.won} acertos de {dailyStats.settled} encerradas</div>
                    <MiniBar pct={dailyStats.winRate} color={dailyStats.winRate >= 55 ? 'bg-emerald-500' : 'bg-amber-500'} />
                  </div>
                </div>
              )}

              {/* Simulação */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Laboratório de simulação</span>
                  </div>
                  <button onClick={() => setSimulationEnabled(!simulation.enabled)}
                    className={cn('rounded-full border px-3 py-1 text-xs font-bold transition-all',
                      simulation.enabled ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200' : 'border-slate-600/40 bg-slate-900/60 text-slate-300')}>
                    {simulation.enabled ? 'Modo ativo' : 'Ativar'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-950/30 border border-slate-700/40 p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Saldo atual</div>
                    <div className={cn('text-lg font-black mt-1', simulation.currentBalance >= simulation.initialBalance ? 'text-emerald-300' : 'text-red-300')}>
                      R$ {formatDecimal(simulation.currentBalance, 2)}
                    </div>
                    <div className="text-[10px] text-slate-600">Inicial R$ {formatDecimal(simulation.initialBalance, 0)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-950/30 border border-slate-700/40 p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">ROI simulado</div>
                    <div className={cn('text-lg font-black mt-1', simulation.roi >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                      {simulation.roi >= 0 ? '+' : ''}{simulation.roi.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-600">{simulation.totalSimulatedBets} entradas</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min={100} value={simulation.initialBalance} onChange={e => setSimulationInitialBalance(Number(e.target.value))}
                    className="bg-slate-950/45 border-slate-700/50 text-slate-100 text-sm" placeholder="Banca inicial" />
                  <Input type="number" min={1} value={simulation.defaultStake} onChange={e => setSimulationDefaultStake(Number(e.target.value))}
                    className="bg-slate-950/45 border-slate-700/50 text-slate-100 text-sm" placeholder="Stake padrão" />
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { resetSimulation(); toast.info('Simulação reiniciada.'); }} className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold">
                    Reiniciar simulação
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ ANALYTICS VIEW ══ */}
          {view === 'analytics' && (
            <div className="p-3 space-y-3">
              <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4 space-y-4">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Ranking de precisão por mercado</div>

                {categoryStats.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">Nenhum palpite encerrado ainda.</p>
                ) : (
                  <>
                    {/* Top performer */}
                    {(() => {
                      const best = [...categoryStats].sort((a, b) => b.winRate - a.winRate)[0];
                      const worst = [...categoryStats].sort((a, b) => a.winRate - b.winRate)[0];
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-3">
                            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">🏆 Melhor mercado</div>
                            <div className="text-sm font-bold text-slate-100">{best.label}</div>
                            <div className="text-xl font-black text-emerald-400">{best.winRate.toFixed(0)}%</div>
                            <div className="text-[10px] text-slate-500">{best.won} acertos de {best.total}</div>
                          </div>
                          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] p-3">
                            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1">📉 A melhorar</div>
                            <div className="text-sm font-bold text-slate-100">{worst.label}</div>
                            <div className="text-xl font-black text-red-400">{worst.winRate.toFixed(0)}%</div>
                            <div className="text-[10px] text-slate-500">{worst.won} acertos de {worst.total}</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Bar chart por categoria */}
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={categoryStats.map(c => ({ name: c.label.slice(0, 8), rate: parseFloat(c.winRate.toFixed(1)), total: c.total }))}
                        margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#4a5568' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }}
                          formatter={(v: number) => [`${v}%`, 'Taxa de acerto']}
                        />
                        <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={32}>
                          {categoryStats.map((c, i) => (
                            <Cell key={i} fill={c.winRate >= 55 ? '#22c55e' : c.winRate >= 40 ? '#f59e0b' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Tabela detalhada */}
                    <div className="rounded-xl overflow-hidden border border-slate-700/50">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-black/30 border-b border-slate-700/50">
                            <th className="text-left px-3 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mercado</th>
                            <th className="text-center px-2 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Palpites</th>
                            <th className="text-center px-2 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Acertos</th>
                            <th className="text-center px-2 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Taxa</th>
                            {globalSubStats.total > 0 && <th className="text-center px-2 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mercados</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {categoryStats.map((c, i) => (
                            <tr key={c.cat} className={cn('border-b border-slate-700/30 transition-colors hover:bg-white/[0.02]', i % 2 === 0 && 'bg-slate-950/20')}>
                              <td className="px-3 py-2 font-medium text-slate-200">{c.label}</td>
                              <td className="px-2 py-2 text-center text-slate-400">{c.total}</td>
                              <td className="px-2 py-2 text-center text-emerald-400 font-bold">{c.won}</td>
                              <td className="px-2 py-2 text-center">
                                <span className={cn('font-black', c.winRate >= 55 ? 'text-emerald-400' : c.winRate >= 40 ? 'text-amber-400' : 'text-red-400')}>
                                  {c.winRate.toFixed(0)}%
                                </span>
                              </td>
                              {globalSubStats.total > 0 && (
                                <td className="px-2 py-2 text-center">
                                  {c.subTotal > 0 ? (
                                    <span className={cn('font-bold', c.subHitRate! >= 55 ? 'text-emerald-400' : 'text-amber-400')}>
                                      {c.subHits}/{c.subTotal}
                                    </span>
                                  ) : <span className="text-slate-600">—</span>}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Webhook sync */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Sincronização de cotações</span>
                  </div>
                  <span className="text-xs text-slate-500">{entries.length} snapshot(s)</span>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-950/35 p-3 font-mono text-sm text-slate-100 break-all">
                  {window.location.origin}/api/webhooks/odds
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-blue-500 hover:bg-blue-400 text-white" onClick={copyWebhookUrl}>
                    <Copy className="w-3.5 h-3.5 mr-1" />Copiar
                  </Button>
                  <Button size="sm" variant="outline" className="border-slate-700/50 text-slate-200 hover:bg-slate-800/60" onClick={() => void refetch()}>
                    <RefreshCw className={cn('w-3.5 h-3.5 mr-1', oddsLoading && 'animate-spin')} />Atualizar
                  </Button>
                  <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" onClick={sendDemoWebhook}>
                    <BellRing className="w-3.5 h-3.5 mr-1" />Demo
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ══ LISTA DE PALPITES ══ */}
          {view === 'lista' && (
            <div>
              {/* filtros */}
              <div className="p-3 border-b border-slate-700/50 flex flex-wrap gap-2 items-center">
                {([
                  { k: 'all', l: 'Todos' }, { k: 'pending', l: 'Pendentes' }, { k: 'settled', l: 'Encerrados' },
                ] as const).map(({ k, l }) => (
                  <button key={k} onClick={() => setListTab(k)}
                    className={cn('rounded-full border px-3 py-1 text-xs font-bold transition-all',
                      listTab === k ? 'border-blue-400/40 bg-blue-500/15 text-white' : 'border-slate-700/50 bg-slate-950/30 text-slate-400 hover:text-slate-200')}>
                    {l}
                  </button>
                ))}
                {([
                  { k: 'all', l: 'Consolidado' }, { k: 'real', l: 'Real' }, { k: 'simulado', l: 'Simulação' },
                ] as const).map(({ k, l }) => (
                  <button key={k} onClick={() => setReportMode(k)}
                    className={cn('rounded-full border px-3 py-1 text-xs font-bold transition-all',
                      reportMode === k ? 'border-purple-400/40 bg-purple-500/15 text-white' : 'border-slate-700/50 bg-slate-950/30 text-slate-400 hover:text-slate-200')}>
                    {l}
                  </button>
                ))}
              </div>

              <div className="max-h-[32rem] overflow-y-auto divide-y divide-slate-700/30">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                    <FileText className="w-8 h-8 text-slate-700" />
                    <p className="text-xs text-slate-500">Nenhuma entrada para este filtro.</p>
                  </div>
                ) : filtered.map(tip => {
                  const isExpanded = expandedId === tip.id;
                  const subHits   = tip.subResults?.filter(s => s.result === 'hit').length ?? 0;
                  const subMisses = tip.subResults?.filter(s => s.result === 'miss').length ?? 0;
                  const subTotal  = subHits + subMisses;

                  return (
                    <div key={tip.id} className="hover:bg-slate-700/10 transition-colors">
                      <div className="p-3">
                        <div className="flex items-start gap-3">
                          {/* Status icon */}
                          <div className="flex-shrink-0 mt-0.5">
                            {tip.result === 'won'     && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            {tip.result === 'lost'    && <XCircle className="w-4 h-4 text-red-400" />}
                            {tip.result === 'pending' && <Clock className="w-4 h-4 text-amber-400" />}
                            {tip.result === 'void'    && <Circle className="w-4 h-4 text-slate-500" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn('text-[10px] font-bold uppercase tracking-wider',
                                tip.result === 'won' ? 'text-emerald-400' : tip.result === 'lost' ? 'text-red-400' : tip.result === 'void' ? 'text-slate-500' : 'text-amber-400')}>
                                {tip.result === 'won' ? 'Ganhou' : tip.result === 'lost' ? 'Perdeu' : tip.result === 'void' ? 'Anulada' : 'Pendente'}
                              </span>
                              <span className="text-[10px] text-slate-600">·</span>
                              <span className="text-[10px] text-slate-500">{getCategoryLabel(tip.category)}</span>
                              <span className="text-[10px] text-slate-600">·</span>
                              <span className="text-[10px] text-slate-500">{tip.mode === 'simulado' ? 'Simulação' : 'Real'}</span>
                              {/* sub-results summary */}
                              {subTotal > 0 && (
                                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border',
                                  subHits > subMisses ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-amber-400 border-amber-500/20 bg-amber-500/10')}>
                                  {subHits}/{subTotal} acertos
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-100 truncate">{tip.tipLabel}</p>
                            <p className="text-xs text-slate-500 truncate">{tip.matchLabel}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                              <span>{fmt(tip.addedAt)}</span>
                              <span>@{tip.odds.toFixed(2)}</span>
                              <span>Entrada R$ {formatDecimal(tip.stake, 2)}</span>
                              <span>Prob. {formatPercent(tip.probability, { digits: 0 })}</span>
                              {tip.result !== 'pending' && (
                                <span className={cn('font-bold', tip.profit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                  {tip.profit >= 0 ? '+' : ''}R$ {formatDecimal(tip.profit, 2)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            {tip.result === 'pending' && (<>
                              <button onClick={() => { updateResult(tip.id, 'won'); toast.success('Marcada como ganhou.'); }}
                                className="p-1.5 rounded-lg border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Ganhou">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => { updateResult(tip.id, 'lost'); toast.error('Marcada como perdeu.'); }}
                                className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors" title="Perdeu">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => { updateResult(tip.id, 'void'); toast.info('Anulada.'); }}
                                className="p-1.5 rounded-lg border border-slate-600/30 text-slate-400 hover:bg-slate-700/20 transition-colors" title="Anular">
                                <Activity className="w-3.5 h-3.5" />
                              </button>
                            </>)}
                            <button onClick={() => setExpandedId(isExpanded ? null : tip.id)}
                              className="p-1.5 rounded-lg border border-slate-700/30 text-slate-500 hover:text-blue-400 hover:border-blue-500/30 transition-colors" title="Detalhar mercados">
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            <button onClick={() => { removeFromHistory(tip.id); toast.info('Removido.'); }}
                              className="p-1.5 rounded-lg border border-slate-700/30 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remover">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Sub-results expandidos */}
                        {isExpanded && (
                          <div className="mt-3 ml-7 rounded-xl border border-slate-700/50 bg-slate-950/40 p-3 space-y-2">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Acertos por mercado</div>
                            {/* Mercados já registrados */}
                            {(tip.subResults ?? []).map(sub => (
                              <SubChip key={sub.market} sub={sub}
                                onToggle={r => updateSubResult(tip.id, sub.market, r)} />
                            ))}
                            {/* Sugestão: criar mercados a partir do tipLabel */}
                            {(tip.subResults ?? []).length === 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] text-slate-500">Marque os acertos individualmente:</p>
                                {tip.tipLabel.split(/[,;+·]/).map(s => s.trim()).filter(Boolean).slice(0, 5).map(part => {
                                  const existing = tip.subResults?.find(s => s.market === part);
                                  const mock: TipSubResult = existing ?? { market: part, prediction: part, result: 'pending' };
                                  return (
                                    <SubChip key={part} sub={mock}
                                      onToggle={r => updateSubResult(tip.id, part, r)} />
                                  );
                                })}
                                {tip.tipLabel.split(/[,;+·]/).length <= 1 && (
                                  <p className="text-[10px] text-slate-600">Use múltiplos mercados separados por vírgula no palpite para detalhar aqui.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {history.length > 0 && (
                <div className="p-3 border-t border-slate-700/50 flex items-center justify-between">
                  <Button size="sm" className="bg-white text-slate-950 hover:bg-slate-200" onClick={() => {
                    const totalStaked = history.filter(t => t.result !== 'void').reduce((s, t) => s + t.stake, 0);
                    const totalReturn = history.reduce((s, t) => s + (t.result === 'won' ? t.stake * t.odds : t.result === 'void' ? t.stake : 0), 0);
                    const won = history.filter(t => t.result === 'won').length;
                    const settled = history.filter(t => t.result !== 'pending' && t.result !== 'void').length;
                    toast.success('PDF em breve — integre com reportPdf.');
                  }}>
                    <Download className="w-3.5 h-3.5 mr-1" />Exportar PDF
                  </Button>
                  <button onClick={() => { if (confirm('Limpar todo o histórico?')) { clearHistory(); toast.info('Histórico limpo.'); } }}
                    className="text-xs text-slate-600 hover:text-red-400 transition-colors flex items-center gap-1">
                    <Trash2 className="w-3 h-3" />Limpar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
