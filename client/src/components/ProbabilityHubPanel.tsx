// Rapha Guru — Central de Probabilidades v2
// Design limpo, focado, profissional

import React, { useMemo, useState } from 'react';
import type { Match } from '@/lib/types';
import type { RoundScanEntry } from '@/hooks/useRoundScanner';
import { cn, formatDecimal, formatPercent, traduzirTextoMercado } from '@/lib/utils';
import {
  TrendingUp, Timer, GitCompareArrows, Shield,
  Flag, CreditCard, DollarSign, Zap, Flame,
  Radio, Sparkles, Target, ChevronRight, Trophy,
} from 'lucide-react';

interface ProbabilityHubPanelProps {
  entries: RoundScanEntry[];
  loading: boolean;
  completed: number;
  total: number;
  onSelectMatch: (match: Match) => void;
}

type ProbTab = 'goals' | 'ht' | 'btts' | 'under' | 'corners' | 'cards' | 'value';
type Stage = 'all' | 'pre' | 'live';

const TABS: { id: ProbTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'goals',   label: 'Gols',        icon: TrendingUp,      color: 'text-emerald-400' },
  { id: 'ht',      label: '1º Tempo',    icon: Timer,           color: 'text-orange-400'  },
  { id: 'btts',    label: 'Ambos marcam',icon: GitCompareArrows, color: 'text-fuchsia-400' },
  { id: 'under',   label: 'Under',       icon: Shield,          color: 'text-cyan-400'    },
  { id: 'corners', label: 'Escanteios',  icon: Flag,            color: 'text-amber-400'   },
  { id: 'cards',   label: 'Cartões',     icon: CreditCard,      color: 'text-red-400'     },
  { id: 'value',   label: 'Valor',       icon: DollarSign,      color: 'text-emerald-300' },
];

function getScore(entry: RoundScanEntry, tab: ProbTab): number {
  const p = entry.predictions;
  const q = entry.summary.decisionScore;
  switch (tab) {
    case 'goals':   return p.over25Prob * 0.72 + q * 0.18 + p.expectedTotalGoals * 3.2;
    case 'ht':      return p.firstHalfOver05Prob * 0.55 + p.firstHalfOver15Prob * 0.28 + q * 0.08 + p.expectedFirstHalfGoals * 5;
    case 'btts':    return p.bttsYesProb * 0.78 + q * 0.12 + p.expectedTotalGoals * 2.4;
    case 'under':   return p.under35Prob * 0.7 + p.under25Prob * 0.16 + q * 0.12;
    case 'corners': return p.over85CornersProb * 0.68 + q * 0.14 + p.expectedCorners * 1.5;
    case 'cards':   return p.over35CardsProb * 0.66 + q * 0.14 + p.expectedCards * 2.3;
    case 'value':   return entry.topValueEdge * 4 + q * 0.24;
    default:        return 0;
  }
}

function getMetric(entry: RoundScanEntry, tab: ProbTab) {
  const p = entry.predictions;
  switch (tab) {
    case 'goals':   return { main: formatPercent(p.over25Prob),            label: 'Mais de 2,5 gols',         sub: `xG ${formatDecimal(p.expectedTotalGoals)}` };
    case 'ht':      return { main: formatPercent(p.firstHalfOver05Prob),    label: 'Gol no 1ºT',               sub: `1,5+ 1ºT ${formatPercent(p.firstHalfOver15Prob)}` };
    case 'btts':    return { main: formatPercent(p.bttsYesProb),            label: 'Ambos marcam',             sub: `Casa ${formatPercent(p.homeToScoreProb)} · Fora ${formatPercent(p.awayToScoreProb)}` };
    case 'under':   return { main: formatPercent(p.under35Prob),            label: 'Menos de 3,5 gols',        sub: `Menos de 2,5 ${formatPercent(p.under25Prob)}` };
    case 'corners': return { main: formatPercent(p.over85CornersProb),      label: 'Mais de 8,5 esc.',         sub: `${formatDecimal(p.expectedCorners, 1)} esperados` };
    case 'cards':   return { main: formatPercent(p.over35CardsProb),        label: 'Mais de 3,5 cartões',      sub: `${formatDecimal(p.expectedCards, 1)} esperados` };
    case 'value':   return { main: formatPercent(entry.topValueEdge, { digits: 1, signed: true }), label: traduzirTextoMercado(entry.valueBets[0]?.market || '—'), sub: entry.valueBets[0] ? `Odd ${formatDecimal(entry.valueBets[0].marketOdds)}` : '—' };
    default:        return { main: '—', label: '—', sub: '—' };
  }
}

export function ProbabilityHubPanel({ entries, loading, completed, total, onSelectMatch }: ProbabilityHubPanelProps) {
  const [tab, setTab]     = useState<ProbTab>('goals');
  const [stage, setStage] = useState<Stage>('all');
  const [tops, setTops]   = useState(true);

  const filtered = useMemo(() =>
    stage === 'all' ? entries : entries.filter(e => e.liveState === stage),
    [entries, stage]
  );

  const ranked = useMemo(() =>
    filtered
      .map(e => ({ entry: e, score: getScore(e, tab) }))
      .filter(({ entry }) => tab !== 'value' || entry.topValueEdge > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, tops ? 5 : 10),
    [filtered, tab, tops]
  );

  const tabCfg = TABS.find(t => t.id === tab)!;
  const TabIcon = tabCfg.icon;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/50">

      {/* Header compacto */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-[13px] font-bold text-slate-100">Central de probabilidades</span>
          {loading && total > 0 && (
            <span className="text-[11px] text-slate-500">{completed}/{total} jogos</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Filtro de estágio */}
          {(['all', 'pre', 'live'] as Stage[]).map(s => (
            <button key={s} onClick={() => setStage(s)}
              className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all',
                stage === s
                  ? s === 'live' ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-slate-600 bg-slate-700/60 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              )}>
              {s === 'all' ? 'Todos' : s === 'pre' ? 'Pré' : <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Ao vivo</span>}
            </button>
          ))}
          <div className="w-px h-4 bg-white/[0.08] mx-1" />
          <button onClick={() => setTops(p => !p)}
            className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all',
              tops ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-transparent text-slate-500 hover:text-slate-300'
            )}>
            <Flame className="w-3 h-3 inline mr-1" />
            {tops ? 'Top 5' : 'Top 10'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {loading && total > 0 && (
        <div className="h-0.5 bg-slate-800">
          <div className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.max(4, (completed / total) * 100)}%` }} />
        </div>
      )}

      {/* Tabs — pills compactos em linha */}
      <div className="flex gap-1.5 px-3 py-2.5 border-b border-slate-800/50 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(({ id, label, icon: Icon, color }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-semibold border transition-all flex-shrink-0',
              tab === id
                ? `border-slate-600/60 bg-slate-800 ${color}`
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700/50'
            )}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Lista de jogos rankeados */}
      <div className="divide-y divide-slate-800/40">
        {ranked.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">
            Aguardando escaneamento dos jogos...
          </div>
        )}

        {ranked.map(({ entry }, i) => {
          const metric   = getMetric(entry, tab);
          const isLive   = entry.liveState === 'live';
          const conf     = entry.confidence;
          const confColor = conf === 'high' ? 'text-emerald-400' : conf === 'medium' ? 'text-amber-400' : 'text-slate-500';

          return (
            <button key={entry.match.idEvent} onClick={() => onSelectMatch(entry.match)}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors group">
              <div className="flex items-center gap-3">

                {/* Rank + probabilidade */}
                <div className="flex-shrink-0 text-center w-12">
                  <div className="text-[10px] text-slate-600 font-bold">{i + 1}º</div>
                  <div className={cn('text-[18px] font-black tabular-nums leading-none', tabCfg.color)}>
                    {metric.main}
                  </div>
                </div>

                {/* Times + info */}
                <div className="flex-1 min-w-0">
                  {/* Liga + status */}
                  <div className="flex items-center gap-1.5 mb-1">
                    {isLive && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Ao vivo
                      </span>
                    )}
                    <span className="text-[10px] text-slate-600 truncate">{entry.match.strLeague}</span>
                  </div>

                  {/* Times — duas linhas separadas para não misturar */}
                  <div className="text-[13px] font-semibold text-slate-200 truncate leading-snug">
                    {entry.match.strHomeTeam}
                  </div>
                  <div className="text-[12px] text-slate-400 truncate leading-snug">
                    {entry.match.strAwayTeam}
                  </div>

                  {/* Mercado + detalhe */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-semibold text-slate-300">{metric.label}</span>
                    <span className="text-[10px] text-slate-600 truncate">{metric.sub}</span>
                  </div>
                </div>

                {/* Confiança + seta */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className={cn('text-[11px] font-bold', confColor)}>
                    {conf === 'high' ? 'Alta' : conf === 'medium' ? 'Média' : 'Baixa'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-500 transition-colors" />
                </div>

              </div>

              {/* Estatísticas de suporte — grid fixo, sem quebrar */}
              <div className="mt-2 grid grid-cols-6 gap-x-2 border-t border-slate-800/40 pt-2">
                <span className="text-[10px] text-slate-500">
                  <span className="text-slate-400 font-medium block">xG</span>
                  {formatDecimal(entry.predictions.expectedTotalGoals, 2)}
                </span>
                <span className="text-[10px] text-slate-500">
                  <span className="text-slate-400 font-medium block">+2,5</span>
                  {Math.round(entry.predictions.over25Prob)}%
                </span>
                <span className="text-[10px] text-slate-500">
                  <span className="text-slate-400 font-medium block">Esc.</span>
                  {formatDecimal(entry.predictions.expectedCorners, 1)}
                </span>
                <span className="text-[10px] text-slate-500">
                  <span className="text-slate-400 font-medium block">Cart.</span>
                  {formatDecimal(entry.predictions.expectedCards, 1)}
                </span>
                <span className="text-[10px] text-slate-500">
                  <span className="text-slate-400 font-medium block">BTTS</span>
                  {Math.round(entry.predictions.bttsYesProb)}%
                </span>
                <span className="text-[10px] text-slate-500">
                  <span className="text-slate-400 font-medium block">1ºT</span>
                  {Math.round(entry.predictions.firstHalfOver05Prob)}%
                </span>
              </div>

              {/* Alertas de mercado / pressão ao vivo */}
              {(isLive && entry.livePressureScore > 60) || entry.oddsMovement?.strength === 'strong' ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {isLive && entry.livePressureScore > 60 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-orange-500/25 bg-orange-500/8 text-orange-300">
                      ⚡ Pressão {entry.livePressureScore}
                    </span>
                  )}
                  {entry.oddsMovement?.strength === 'strong' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/20 bg-red-500/8 text-red-300">
                      🔴 Mercado em ajuste forte
                    </span>
                  )}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Footer — horário mais quente */}
      {filtered.length >= 3 && (
        <div className="px-4 py-2.5 border-t border-slate-800/50 bg-slate-900/30">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>{filtered.length} jogos no filtro</span>
            <span>Clique em um jogo para análise completa</span>
          </div>
        </div>
      )}
    </div>
  );
}
