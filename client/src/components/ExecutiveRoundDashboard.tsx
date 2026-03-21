import React, { useMemo } from 'react';
import type { Match } from '@/lib/types';
import type { RoundScanEntry } from '@/hooks/useRoundScanner';
import { cn, formatDecimal, formatPercent, traduzirTextoMercado } from '@/lib/utils';
import { useTipsHistory } from '@/contexts/TipsHistoryContext';
import {
  Activity,
  ArrowRight,
  BellRing,
  Clock3,
  Flag,
  Flame,
  Radar,
  Shield,
  Siren,
  Sparkles,
  TrendingUp,
  Trophy,
  Waves,
} from 'lucide-react';

interface ExecutiveRoundDashboardProps {
  entries: RoundScanEntry[];
  loading: boolean;
  completed: number;
  total: number;
  onSelectMatch: (match: Match) => void;
}

function índiceOverall(entry: RoundScanEntry) {
  return (
    entry.summary.decisionScore * 0.34 +
    entry.goalsHeatScore * 0.18 +
    entry.cornersHeatScore * 0.12 +
    entry.cardsHeatScore * 0.08 +
    entry.topValueEdge * 0.8 +
    (entry.liveState === 'live' ? entry.livePressureScore * 0.18 : 0) +
    (entry.confidence === 'high' ? 8 : entry.confidence === 'medium' ? 4 : 0)
  );
}

function normalizeTime(raw?: string) {
  if (!raw) return 'Sem horário';
  const [hh = '--', mm = '--'] = raw.split(':');
  return `${hh}:${mm}`;
}

function getMetric(entry: RoundScanEntry) {
  const options = [
    {
      label: 'Mais de 2,5 gols',
      probability: entry.predictions.over25Prob,
      subtitle: `${formatDecimal(entry.predictions.expectedTotalGoals)} xG total`,
      tone: 'text-emerald-300',
    },
    {
      label: 'Mais de 8,5 esc.',
      probability: entry.predictions.over85CornersProb,
      subtitle: `${formatDecimal(entry.predictions.expectedCorners, 1)} escanteios`,
      tone: 'text-amber-300',
    },
    {
      label: 'Mais de 3,5 cart.',
      probability: entry.predictions.over35CardsProb,
      subtitle: `${formatDecimal(entry.predictions.expectedCards, 1)} cartões`,
      tone: 'text-red-300',
    },
    {
      label: 'Ambos marcam',
      probability: entry.predictions.bttsYesProb,
      subtitle: `Gol no 1ºT ${formatPercent(entry.predictions.firstHalfGoalProb)}`,
      tone: 'text-fuchsia-300',
    },
  ].sort((a, b) => b.probability - a.probability);

  return options[0];
}

function groupBestBy<T extends string>(entries: RoundScanEntry[], keyFn: (entry: RoundScanEntry) => T) {
  const map = new Map<T, RoundScanEntry>();
  entries.forEach((entry) => {
    const key = keyFn(entry);
    const current = map.get(key);
    if (!current || índiceOverall(entry) > índiceOverall(current)) {
      map.set(key, entry);
    }
  });

  return Array.from(map.entries())
    .map(([key, entry]) => ({ key, entry }))
    .sort((a, b) => índiceOverall(b.entry) - índiceOverall(a.entry));
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(2,6,23,0.82))] p-4 shadow-[0_16px_40px_-36px_rgba(14,165,233,0.55)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
          <div className={cn('mt-2 text-2xl font-black tracking-tight', tone)}>{value}</div>
          <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
        </div>
        <div className={cn('rounded-2xl border border-white/5 bg-white/5 p-2.5', tone)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function PickCard({
  title,
  entry,
  badge,
  icon: Icon,
  onClick,
}: {
  title: string;
  entry: RoundScanEntry;
  badge: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  const metric = getMetric(entry);
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-slate-700/50 bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))] hover:border-blue-500/40 hover:bg-slate-900/80 transition-all p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/50 bg-slate-800/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
              <Icon className="w-3 h-3" />
              {title}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
              {badge}
            </span>
            {entry.liveState === 'live' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                <Activity className="w-3 h-3 animate-pulse" />
                Ao vivo
              </span>
            )}
          </div>
          <div className="mt-3 text-sm font-bold text-slate-100 truncate leading-snug">
            {entry.match.strHomeTeam}
          </div>
          <div className="text-xs text-slate-400 truncate">
            {entry.match.strAwayTeam}
          </div>
          <div className="mt-1 text-xs text-slate-500">{entry.match.strLeague} • {normalizeTime(entry.match.strTime)}</div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0 mt-1" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Mercado</div>
          <div className={cn('mt-1 text-sm font-black', metric.tone)}>{metric.label}</div>
          <div className="text-[11px] text-slate-500 mt-1">{metric.subtitle}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Prob.</div>
          <div className="mt-1 text-sm font-black text-slate-100">{formatPercent(metric.probability, { digits: 1 })}</div>
          <div className="text-[11px] text-slate-500 mt-1">Índice {entry.summary.decisionScore}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Sinal</div>
          <div className="mt-1 text-sm font-black text-emerald-300">{entry.topValueEdge > 0 ? formatPercent(entry.topValueEdge, { digits: 1, signed: true }) : `${entry.goalsHeatScore}`}</div>
          <div className="text-[11px] text-slate-500 mt-1">{entry.topValueEdge > 0 ? 'valor de mercado' : 'força do cenário'}</div>
        </div>
      </div>
    </button>
  );
}

export function ExecutiveRoundDashboard({ entries, loading, completed, total, onSelectMatch }: ExecutiveRoundDashboardProps) {
  const { dailyStats } = useTipsHistory();
  const ordered = useMemo(() => [...entries].sort((a, b) => índiceOverall(b) - índiceOverall(a)), [entries]);
  const bestOverall = ordered[0];
  const bestValue = useMemo(() => [...entries].filter((entry) => entry.topValueEdge > 0).sort((a, b) => b.topValueEdge - a.topValueEdge)[0], [entries]);
  const liveAlerts = useMemo(
    () => [...entries]
      .filter((entry) => entry.liveState === 'live' && (entry.livePressureScore >= 68 || entry.oddsMovement?.strength === 'strong'))
      .sort((a, b) => (b.livePressureScore + (b.oddsMovement?.strongestDelta || 0) * 2) - (a.livePressureScore + (a.oddsMovement?.strongestDelta || 0) * 2))
      .slice(0, 4),
    [entries],
  );
  const byLeague = useMemo(() => groupBestBy(entries, (entry) => entry.match.strLeague || 'Outras').slice(0, 6), [entries]);
  const byTime = useMemo(() => groupBestBy(entries, (entry) => normalizeTime(entry.match.strTime)).slice(0, 6), [entries]);

  const averageDecision = entries.length > 0
    ? Math.round(entries.reduce((sum, entry) => sum + entry.summary.decisionScore, 0) / entries.length)
    : 0;
  const highConfidenceCount = entries.filter((entry) => entry.confidence === 'high').length;
  const liveCount = entries.filter((entry) => entry.liveState === 'live').length;
  const strongMovementCount = entries.filter((entry) => entry.oddsMovement?.strength === 'strong').length;

  return (
    <div className="space-y-4">
      <div className="panel-pro bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(2,6,23,0.92))] shadow-[0_30px_90px_-56px_rgba(59,130,246,0.55)]">
        <div className="px-5 py-4 border-b border-slate-700/40 bg-slate-950/30">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Radar className="w-5 h-5 text-blue-300" />
                <h2 className="text-lg font-black text-slate-50 tracking-tight">Painel executivo da rodada</h2>
              </div>
              <p className="mt-1 text-sm text-slate-400 max-w-3xl">
                Leitura rápida dos cenários mais fortes do dia: tops prontos, pressão ao vivo, movimentos fortes de odds e cortes por liga e horário.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 px-4 py-3 min-w-[220px]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Scanner</div>
              <div className="mt-2 flex items-end gap-2">
                <div className="text-3xl font-black text-slate-100">{completed}</div>
                <div className="text-sm text-slate-500 mb-1">/ {total || entries.length} jogos</div>
              </div>
              <div className="text-xs text-slate-500 mt-1">{loading ? 'Atualizando leitura da rodada…' : 'Scanner pronto para decisão.'}</div>
              {loading && total > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${Math.max(8, (completed / total) * 100)}%` }} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <SummaryCard title="Média decisão" value={`${averageDecision}`} subtitle="índice médio da rodada" icon={Sparkles} tone="text-blue-300" />
          <SummaryCard title="Alta confiança" value={`${highConfidenceCount}`} subtitle="jogos acima do corte premium" icon={Shield} tone="text-emerald-300" />
          <SummaryCard title="Ao vivo" value={`${liveCount}`} subtitle="partidas em monitoramento" icon={Activity} tone="text-red-300" />
          <SummaryCard title="Cotações em movimento" value={`${strongMovementCount}`} subtitle="alertas fortes de mercado" icon={Siren} tone="text-amber-300" />
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-2xl border border-slate-700/50 bg-[linear-gradient(145deg,rgba(2,6,23,0.88),rgba(15,23,42,0.8))] p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Resumo diário das dicas</div>
                <div className="mt-1 text-sm font-bold text-slate-100">Taxa de acerto e ROI do dia em uma leitura rápida</div>
              </div>
              <div className={cn(
                'rounded-full border px-3 py-1 text-xs font-bold',
                dailyStats.roi >= 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'
              )}>
                ROI {dailyStats.roi >= 0 ? '+' : ''}{dailyStats.roi.toFixed(1)}%
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard title="Dicas de hoje" value={`${dailyStats.totalBets}`} subtitle={`${dailyStats.pending} pendente(s)`} icon={BellRing} tone="text-slate-100" />
              <SummaryCard title="Taxa de acerto" value={`${dailyStats.winRate.toFixed(0)}%`} subtitle={`${dailyStats.won} acertos • ${dailyStats.lost} erros`} icon={Trophy} tone={dailyStats.winRate >= 55 ? 'text-emerald-300' : dailyStats.winRate <= 45 && dailyStats.settled > 0 ? 'text-red-300' : 'text-amber-300'} />
              <SummaryCard title="Lucro do dia" value={`${dailyStats.profit >= 0 ? '+' : ''}R$ ${dailyStats.profit.toFixed(0)}`} subtitle={`Stake R$ ${dailyStats.totalStaked.toFixed(0)}`} icon={TrendingUp} tone={dailyStats.profit >= 0 ? 'text-emerald-300' : 'text-red-300'} />
              <SummaryCard title="Retorno" value={`R$ ${dailyStats.totalReturn.toFixed(0)}`} subtitle={dailyStats.settled > 0 ? `${dailyStats.settled} encerrada(s)` : 'Aguardando fechamento'} icon={Sparkles} tone="text-blue-300" />
            </div>
          </div>
        </div>

        {bestOverall && (
          <div className="px-5 pb-5">
            <PickCard
              title="Melhor leitura da rodada"
              badge={`Decisão ${bestOverall.summary.decisionScore}`}
              icon={Trophy}
              entry={bestOverall}
              onClick={() => onSelectMatch(bestOverall.match)}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-4">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/45 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flag className="w-4 h-4 text-purple-300" />
              <div>
                <div className="text-sm font-bold text-slate-100">Melhores por liga</div>
                <div className="text-xs text-slate-500">Um jogo pronto por competição, priorizando decisão, calor do jogo e vantagem.</div>
              </div>
            </div>
            <div className="space-y-2.5">
              {byLeague.length === 0 && (
                <div className="text-sm text-slate-500 rounded-xl border border-slate-700/40 bg-slate-950/25 p-4">Ainda não há ligas suficientes no scanner.</div>
              )}
              {byLeague.map(({ key, entry }) => {
                const metric = getMetric(entry);
                return (
                  <button
                    key={`${key}-${entry.match.idEvent}`}
                    onClick={() => onSelectMatch(entry.match)}
                    className="w-full text-left rounded-xl border border-slate-700/40 bg-slate-950/25 hover:bg-slate-900/45 hover:border-blue-500/30 transition-all p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{key}</div>
                        <div className="text-sm font-semibold text-slate-100 truncate mt-1">{entry.match.strHomeTeam}</div><div className="text-xs text-slate-400 truncate">{entry.match.strAwayTeam}</div>
                        <div className="text-xs text-slate-500 mt-1">{metric.label} • {metric.subtitle}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={cn('text-lg font-black', metric.tone)}>{formatPercent(metric.probability, { digits: 1 })}</div>
                        <div className="text-[11px] text-slate-500">{normalizeTime(entry.match.strTime)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/45 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock3 className="w-4 h-4 text-sky-300" />
              <div>
                <div className="text-sm font-bold text-slate-100">Melhores por horário</div>
                <div className="text-xs text-slate-500">A melhor leitura disponível em cada janela de jogo do dia.</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {byTime.length === 0 && (
                <div className="text-sm text-slate-500 rounded-xl border border-slate-700/40 bg-slate-950/25 p-4">Sem horários suficientes para montar o recorte.</div>
              )}
              {byTime.map(({ key, entry }) => {
                const metric = getMetric(entry);
                return (
                  <button
                    key={`${key}-${entry.match.idEvent}`}
                    onClick={() => onSelectMatch(entry.match)}
                    className="rounded-xl border border-slate-700/40 bg-slate-950/25 hover:bg-slate-900/45 hover:border-sky-500/30 transition-all p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-sky-300">{key}</div>
                        <div className="text-sm font-semibold text-slate-100 mt-1 truncate">{entry.match.strHomeTeam}</div><div className="text-xs text-slate-400 truncate">{entry.match.strAwayTeam}</div>
                      </div>
                      <div className="text-right">
                        <div className={cn('text-base font-black', metric.tone)}>{formatPercent(metric.probability)}</div>
                        <div className="text-[11px] text-slate-500">{metric.label}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/45 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BellRing className="w-4 h-4 text-red-300" />
              <div>
                <div className="text-sm font-bold text-slate-100">Alertas visuais ao vivo</div>
                <div className="text-xs text-slate-500">Pressão forte, movimento de odds e jogos que merecem atenção imediata.</div>
              </div>
            </div>
            <div className="space-y-2.5">
              {liveAlerts.length === 0 && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/25 p-4 text-sm text-slate-500">
                  Ainda não há alertas fortes ao vivo. Quando houver pressão ou mudança relevante de mercado, eles aparecem aqui.
                </div>
              )}
              {liveAlerts.map((entry) => (
                <button
                  key={entry.match.idEvent}
                  onClick={() => onSelectMatch(entry.match)}
                  className="w-full text-left rounded-xl border border-red-500/15 bg-[linear-gradient(140deg,rgba(127,29,29,0.14),rgba(2,6,23,0.9))] hover:border-red-500/35 transition-all p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">{entry.match.strHomeTeam}</div><div className="text-xs text-slate-400 truncate">{entry.match.strAwayTeam}</div>
                      <div className="text-xs text-slate-500 mt-1">{entry.match.strLeague}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                      <Activity className="w-3 h-3 animate-pulse" />
                      Ao Vivo
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-red-500/10 bg-black/20 px-2.5 py-2">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pressão</div>
                      <div className="mt-1 text-base font-black text-orange-300">{entry.livePressureScore}</div>
                    </div>
                    <div className="rounded-lg border border-red-500/10 bg-black/20 px-2.5 py-2">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Cotações</div>
                      <div className="mt-1 text-base font-black text-red-300">{entry.oddsMovement ? formatPercent(entry.oddsMovement.strongestDelta, { digits: 1 }) : '—'}</div>
                    </div>
                    <div className="rounded-lg border border-red-500/10 bg-black/20 px-2.5 py-2">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pressão de gols</div>
                      <div className="mt-1 text-base font-black text-emerald-300">{entry.goalsHeatScore}</div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {entry.oddsMovement && (
                      <span className="inline-flex items-center gap-1 text-red-300"><Siren className="w-3 h-3" />{entry.oddsMovement.strongestLabel} {formatPercent(entry.oddsMovement.strongestDelta, { digits: 1 })}</span>
                    )}
                    <span className="inline-flex items-center gap-1 text-orange-300"><Waves className="w-3 h-3" />pressão {entry.livePressureScore}/100</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {bestValue && (
            <PickCard
              title="Melhor valor do dia"
              badge={traduzirTextoMercado(bestValue.valueBets[0]?.sourceLabel || 'valor real')}
              icon={TrendingUp}
              entry={bestValue}
              onClick={() => onSelectMatch(bestValue.match)}
            />
          )}

          {bestOverall && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/45 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-amber-300" />
                <div>
                  <div className="text-sm font-bold text-slate-100">Leitura executiva</div>
                  <div className="text-xs text-slate-500">Resumo rápido do melhor cenário do scanner.</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700/40 bg-slate-950/25 p-4">
                <div className="text-sm font-semibold text-slate-100 truncate">{bestOverall.match.strHomeTeam}</div><div className="text-xs text-slate-400 truncate">{bestOverall.match.strAwayTeam}</div>
                <div className="text-xs text-slate-500 mt-1">{bestOverall.match.strLeague} • {normalizeTime(bestOverall.match.strTime)}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Melhor mercado</div>
                    <div className="mt-1 text-sm font-black text-emerald-300">{getMetric(bestOverall).label}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{formatPercent(getMetric(bestOverall).probability, { digits: 1 })}</div>
                  </div>
                  <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Ângulo</div>
                    <div className="mt-1 text-sm font-black text-blue-300">{traduzirTextoMercado(bestOverall.summary.bestAngle)}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Dados {bestOverall.summary.dataQualityScore}/100</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
