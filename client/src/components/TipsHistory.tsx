// Rapha Guru — Central de Performance v2.0
// Histórico + laboratório de simulação + sincronização via webhook + relatório semanal em PDF

import React, { useMemo, useState } from 'react';
import { useTipsHistory } from '@/contexts/TipsHistoryContext';
import { cn, formatDecimal, formatPercent } from '@/lib/utils';
import { downloadWeeklyPdf } from '@/lib/reportPdf';
import { useOddsWebhookSync } from '@/hooks/useOddsWebhookSync';
import {
  Activity,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  FlaskConical,
  History,
  Link2,
  RefreshCw,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function TipsHistory() {
  const {
    history,
    stats,
    dailyStats,
    weeklyStats,
    simulation,
    updateResult,
    removeFromHistory,
    clearHistory,
    setSimulationEnabled,
    setSimulationInitialBalance,
    setSimulationDefaultStake,
    resetSimulation,
  } = useTipsHistory();
  const { entries, loading: oddsLoading, refetch, seedDemoData } = useOddsWebhookSync(null, true);

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'settled'>('all');
  const [reportMode, setReportMode] = useState<'all' | 'real' | 'simulado'>('all');

  const filtered = useMemo(() => history.filter((tip) => {
    if (reportMode !== 'all' && tip.mode !== reportMode) return false;
    if (activeTab === 'pending') return tip.result === 'pending';
    if (activeTab === 'settled') return tip.result !== 'pending';
    return true;
  }), [history, activeTab, reportMode]);

  const weeklyFiltrared = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return history.filter((tip) => new Date(tip.addedAt).getTime() >= start.getTime() && (reportMode === 'all' || tip.mode === reportMode));
  }, [history, reportMode]);

  const exportWeeklyReport = () => {
    const totalStaked = weeklyFiltrared.filter((tip) => tip.result !== 'void').reduce((sum, tip) => sum + tip.stake, 0);
    const totalReturn = weeklyFiltrared.reduce((sum, tip) => sum + (tip.result === 'won' ? tip.stake * tip.odds : tip.result === 'void' ? tip.stake : 0), 0);
    const won = weeklyFiltrared.filter((tip) => tip.result === 'won').length;
    const lost = weeklyFiltrared.filter((tip) => tip.result === 'lost').length;
    const settled = weeklyFiltrared.filter((tip) => tip.result !== 'pending' && tip.result !== 'void').length;
    const pending = weeklyFiltrared.filter((tip) => tip.result === 'pending').length;
    const roi = totalStaked > 0 ? ((totalReturn - totalStaked) / totalStaked) * 100 : 0;
    const winRate = settled > 0 ? (won / settled) * 100 : 0;

    downloadWeeklyPdf({
      title: 'Rapha Guru — Relatório Semanal de Desempenho',
      subtitle: `Recorte: ${reportMode === 'all' ? 'consolidado' : reportMode === 'simulado' ? 'simulação' : 'histórico real'}`,
      generatedAt: new Date().toLocaleString('pt-BR'),
      sections: [
        {
          heading: 'Resumo semanal',
          lines: [
            { title: 'Apostas registradas', value: String(weeklyFiltrared.length) },
            { title: 'Encerradas', value: String(settled) },
            { title: 'Pendentes', value: String(pending) },
            { title: 'Taxa de acerto', value: formatPercent(winRate, { digits: 1 }) },
            { title: 'ROI', value: formatPercent(roi, { digits: 1, signed: true }) },
            { title: 'Investido', value: `R$ ${formatDecimal(totalStaked, 2)}` },
            { title: 'Retorno', value: `R$ ${formatDecimal(totalReturn, 2)}` },
            { title: 'Lucro / prejuízo', value: `R$ ${formatDecimal(totalReturn - totalStaked, 2)}` },
          ],
        },
        {
          heading: 'Fechamento',
          lines: [
            { title: 'Acertos', value: String(won) },
            { title: 'Erros', value: String(lost) },
            { title: 'Saldo fictício atual', value: `R$ ${formatDecimal(simulation.currentBalance, 2)}` },
            { title: 'ROI simulado', value: formatPercent(simulation.roi, { digits: 1, signed: true }) },
          ],
        },
        {
          heading: 'Últimas entradas',
          lines: weeklyFiltrared.slice(0, 8).map((tip) => ({
            title: `${tip.matchLabel} — ${tip.tipLabel}`,
            value: `${tip.mode === 'simulado' ? 'sim.' : 'real'} • @${tip.odds.toFixed(2)} • ${tip.result}`,
          })),
        },
      ],
      footer: 'Relatório exportado pelo módulo de performance do Rapha Guru.',
    }, `rapha-guru-relatorio-semanal-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Relatório semanal em PDF gerado.');
  };

  const copyWebhookUrl = async () => {
    const url = `${window.location.origin}/api/webhooks/odds`;
    await navigator.clipboard.writeText(url);
    toast.success('Endpoint de webhook copiado.');
  };

  const sendDemoWebhook = async () => {
    const ok = await seedDemoData();
    if (ok) toast.success('Feed de demonstração carregado.');
    else toast.error('Não foi possível carregar a demonstração.');
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const resultColor = (r: string) => {
    if (r === 'won') return 'text-emerald-400';
    if (r === 'lost') return 'text-red-400';
    if (r === 'void') return 'text-slate-500';
    return 'text-amber-400';
  };

  const resultLabel = (r: string) => {
    if (r === 'won') return 'Ganhou';
    if (r === 'lost') return 'Perdeu';
    if (r === 'void') return 'Anulada';
    return 'Pendente';
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden shadow-[0_24px_70px_-50px_rgba(59,130,246,0.45)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <History className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-slate-100">Central de performance</span>
          <span className="text-xs rounded-full border border-slate-600/40 bg-slate-950/40 px-2 py-0.5 text-slate-300">{stats.totalBets} entradas</span>
          <span className={cn('text-xs font-bold rounded-full px-2 py-0.5 border', stats.roi >= 0 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-red-500/10 text-red-300 border-red-500/20')}>
            ROI {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-700/50">
          <div className="p-3 border-b border-slate-700/50 bg-[linear-gradient(145deg,rgba(15,23,42,0.8),rgba(2,6,23,0.65))]">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-blue-300 font-bold">Resumo diário</div>
                    <div className="text-xs text-slate-500 mt-1">Fechamento operacional de {dailyStats.label}</div>
                  </div>
                  <div className={cn('rounded-full border px-3 py-1 text-xs font-bold', dailyStats.roi >= 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300')}>
                    {dailyStats.roi >= 0 ? '+' : ''}{dailyStats.roi.toFixed(1)}%
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MetricCard label="Dicas" value={String(dailyStats.totalBets)} sub={`${dailyStats.pending} pendente(s)`} tone="text-slate-100" />
                  <MetricCard label="Taxa de acerto" value={`${dailyStats.winRate.toFixed(0)}%`} sub={`${dailyStats.won} acertos`} tone={dailyStats.winRate >= 55 ? 'text-emerald-300' : 'text-amber-300'} />
                  <MetricCard label="Lucro" value={`R$ ${formatDecimal(dailyStats.profit, 2)}`} sub={`Entrada R$ ${formatDecimal(dailyStats.totalStaked, 0)}`} tone={dailyStats.profit >= 0 ? 'text-emerald-300' : 'text-red-300'} />
                  <MetricCard label="Retorno" value={`R$ ${formatDecimal(dailyStats.totalReturn, 2)}`} sub={`${dailyStats.settled} encerrada(s)`} tone="text-blue-300" />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300 font-bold"><FlaskConical className="w-3.5 h-3.5" /> Laboratório de simulação</div>
                    <div className="text-xs text-slate-500 mt-1">Saldo fictício para testar estratégias antes de executar.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimulationEnabled(!simulation.enabled)}
                    className={cn('rounded-full border px-3 py-1 text-xs font-bold transition-all', simulation.enabled ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200' : 'border-slate-600/40 bg-slate-900/60 text-slate-300')}
                  >
                    {simulation.enabled ? 'Modo ativo' : 'Ativar modo'}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MetricCard label="Saldo atual" value={`R$ ${formatDecimal(simulation.currentBalance, 2)}`} sub={`Inicial R$ ${formatDecimal(simulation.initialBalance, 0)}`} tone="text-emerald-200" />
                  <MetricCard label="ROI simulado" value={`${simulation.roi >= 0 ? '+' : ''}${simulation.roi.toFixed(1)}%`} sub={`${simulation.totalSimulatedBets} entrada(s)`} tone={simulation.roi >= 0 ? 'text-emerald-300' : 'text-red-300'} />
                  <MetricCard label="Entrada reservada" value={`R$ ${formatDecimal(simulation.reservedStake, 2)}`} sub="Apostas pendentes" tone="text-amber-200" />
                  <MetricCard label="Taxa de acerto" value={`${simulation.winRate.toFixed(0)}%`} sub="Encerradas" tone="text-slate-100" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Input type="number" min={100} value={simulation.initialBalance} onChange={(e) => setSimulationInitialBalance(Number(e.target.value))} className="bg-slate-950/45 border-slate-700/50 text-slate-100" />
                  <Input type="number" min={1} value={simulation.defaultStake} onChange={(e) => setSimulationDefaultStake(Number(e.target.value))} className="bg-slate-950/45 border-slate-700/50 text-slate-100" />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Campos: banca inicial e stake padrão.</span>
                  <button type="button" onClick={() => { resetSimulation(); toast.info('Histórico de simulação reiniciado.'); }} className="text-amber-300 hover:text-amber-200 font-semibold">
                    Reiniciar simulação
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-blue-300 font-bold"><Link2 className="w-3.5 h-3.5" /> Sincronização de cotações</div>
                    <div className="text-xs text-slate-500 mt-1">Recebe snapshots por webhook e centraliza o monitoramento em tempo real.</div>
                  </div>
                  <div className="text-xs text-slate-400">{entries.length} snapshot(s)</div>
                </div>
                <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-950/35 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Endpoint</div>
                  <div className="mt-1 text-sm font-mono text-slate-100 break-all">{window.location.origin}/api/webhooks/odds</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="bg-blue-500 hover:bg-blue-400 text-white" onClick={copyWebhookUrl}><Copy className="w-3.5 h-3.5 mr-1" />Copiar endpoint</Button>
                    <Button size="sm" variant="outline" className="border-slate-700/50 text-slate-200 hover:bg-slate-800/60" onClick={() => void refetch()}><RefreshCw className={cn('w-3.5 h-3.5 mr-1', oddsLoading && 'animate-spin')} />Atualizar</Button>
                    <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" onClick={sendDemoWebhook}><BellRing className="w-3.5 h-3.5 mr-1" />Demo</Button>
                  </div>
                </div>
                <div className="mt-3 space-y-2 max-h-36 overflow-y-auto pr-1">
                  {entries.length === 0 ? (
                    <div className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-700/50 px-3 py-3">Sem snapshots recebidos ainda. Você pode usar o endpoint acima ou testar com o botão Demo.</div>
                  ) : entries.slice(0, 4).map((entry) => (
                    <div key={`${entry.matchId}-${entry.receivedAt}`} className="rounded-xl border border-slate-700/50 bg-slate-950/35 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-100 truncate">{entry.homeTeam || entry.matchId} {entry.awayTeam ? `x ${entry.awayTeam}` : ''}</div>
                        <span className="text-[10px] text-slate-500">{new Date(entry.receivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">1 {entry.homeOdds ?? '—'} • X {entry.drawOdds ?? '—'} • 2 {entry.awayOdds ?? '—'} • O2.5 {entry.over25Odds ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[{ key: 'all', label: 'Consolidado' }, { key: 'real', label: 'Histórico real' }, { key: 'simulado', label: 'Simulação' }].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setReportMode(item.key as typeof reportMode)}
                  className={cn('rounded-full border px-3 py-1.5 text-xs font-bold transition-all', reportMode === item.key ? 'border-blue-400/40 bg-blue-500/15 text-white' : 'border-slate-700/50 bg-slate-950/30 text-slate-400 hover:text-slate-200')}
                >
                  {item.label}
                </button>
              ))}
              <Button size="sm" className="ml-auto bg-white text-slate-950 hover:bg-slate-200" onClick={exportWeeklyReport}><Download className="w-3.5 h-3.5 mr-1" />Exportar PDF semanal</Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-0 border-b border-slate-700/50">
            {[
              { label: 'Total', value: weeklyStats.totalBets, color: 'text-slate-200' },
              { label: 'Acertos', value: weeklyStats.won, color: 'text-emerald-400' },
              { label: 'Erros', value: weeklyStats.lost, color: 'text-red-400' },
              { label: 'Pendentes', value: weeklyStats.pending, color: 'text-amber-400' },
            ].map((item) => (
              <div key={item.label} className="text-center py-3 border-r border-slate-700/30 last:border-r-0">
                <div className={cn('text-lg font-black', item.color)}>{item.value}</div>
                <div className="text-[10px] text-slate-600 uppercase tracking-[0.16em]">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 p-3 border-b border-slate-700/50">
            <MetricCard label="Taxa de acerto" value={`${weeklyStats.winRate.toFixed(0)}%`} sub="Últimos 7 dias" tone={weeklyStats.winRate >= 50 ? 'text-emerald-300' : 'text-red-300'} />
            <MetricCard label="Investido" value={`R$ ${formatDecimal(weeklyStats.totalStaked, 0)}`} sub="Recorte semanal" tone="text-slate-100" />
            <MetricCard label="Lucro / prejuízo" value={`${weeklyStats.profit >= 0 ? '+' : ''}R$ ${formatDecimal(weeklyStats.profit, 2)}`} sub={`ROI ${weeklyStats.roi >= 0 ? '+' : ''}${weeklyStats.roi.toFixed(1)}%`} tone={weeklyStats.profit >= 0 ? 'text-emerald-300' : 'text-red-300'} />
          </div>

          <div className="flex border-b border-slate-700/50">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'pending', label: 'Pendentes' },
              { key: 'settled', label: 'Encerradas' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={cn('flex-1 py-3 text-xs font-bold uppercase tracking-[0.16em] transition-all border-b-2', activeTab === key ? 'text-white border-blue-400 bg-blue-500/10' : 'text-slate-500 border-transparent hover:text-slate-200 hover:bg-slate-800/30')}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                <FileText className="w-8 h-8 text-slate-700" />
                <p className="text-xs text-slate-500">Nenhuma entrada encontrada para este recorte.</p>
                <p className="text-xs text-slate-700">Salve apostas no betslip para medir ROI e testar estratégias.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {filtered.map((tip) => (
                  <div key={tip.id} className="p-3 hover:bg-slate-700/15 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-[10px] font-bold uppercase tracking-[0.16em]', resultColor(tip.result))}>{resultLabel(tip.result)}</span>
                          <span className="text-[10px] text-slate-600">•</span>
                          <span className="text-[10px] text-slate-500">{tip.mode === 'simulado' ? 'Simulação' : 'Real'}</span>
                          <span className="text-[10px] text-slate-600">•</span>
                          <span className="text-[10px] text-slate-500 truncate">{tip.league}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-100 truncate">{tip.tipLabel}</p>
                        <p className="text-xs text-slate-500 truncate">{tip.matchLabel}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span>{formatDate(tip.addedAt)}</span>
                          <span>@{tip.odds.toFixed(2)}</span>
                          <span>Entrada R$ {formatDecimal(tip.stake, 2)}</span>
                          <span>Prob. {formatPercent(tip.probability, { digits: 0 })}</span>
                          {tip.result !== 'pending' && <span className={cn('font-bold', tip.profit >= 0 ? 'text-emerald-400' : 'text-red-400')}>{tip.profit >= 0 ? '+' : ''}R$ {formatDecimal(tip.profit, 2)}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {tip.result === 'pending' && (
                          <>
                            <button onClick={() => { updateResult(tip.id, 'won'); toast.success('Marcada como ganhou.'); }} className="p-1.5 rounded-lg border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Marcar como ganhou"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { updateResult(tip.id, 'lost'); toast.error('Marcada como perdeu.'); }} className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors" title="Marcar como perdeu"><XCircle className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { updateResult(tip.id, 'void'); toast.info('Marcada como anulada.'); }} className="p-1.5 rounded-lg border border-slate-600/30 text-slate-400 hover:bg-slate-700/20 transition-colors" title="Anular"><Activity className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                        <button onClick={() => { removeFromHistory(tip.id); toast.info('Entrada removida.'); }} className="p-1.5 rounded-lg border border-slate-700/30 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remover"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="p-3 border-t border-slate-700/50 flex justify-end">
              <button
                onClick={() => {
                  if (confirm('Limpar todo o histórico?')) {
                    clearHistory();
                    toast.info('Histórico limpo');
                  }
                }}
                className="text-xs text-slate-600 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Limpar histórico
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-950/35 px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={cn('mt-2 text-lg font-black tracking-tight', tone)}>{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
