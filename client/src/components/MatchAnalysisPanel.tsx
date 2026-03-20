// Football Sugestões Pro — Match Analysis Panel v3.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Tabs corrigidas: sistema de tabs único sem aninhamento problemático

import React, { useEffect, useRef, useState } from 'react';
import { useSuggestionAlerts } from '@/hooks/useSuggestionAlerts';
import { useMatchPlayers, type MatchPlayersData } from '@/hooks/useMatchPlayers';
import { useFavorites } from '@/contexts/FavoritesContext';
import LiveMatchPanel from './LiveMatchPanel';
import PressureFlowChart from './PressureFlowChart';
import { DynamicSuggestionsPanel } from './DynamicSuggestionsPanel';
import { PlayerSuggestionsPanel } from './PlayerSuggestionsPanel';
import { GoalProbabilityMeter } from './GoalProbabilityMeter';
import { LiveEventTimeline } from './LiveEventTimeline';
import { OddsComparisonPanel } from './OddsComparisonPanel';
import { OddsHistoryPanel } from './OddsHistoryPanel';
import { useOddsHistory } from '@/hooks/useOddsHistory';
import { LeagueRankingsPanel } from './LeagueRankingsPanel';
import { useLiveMatch, type LiveMatchData } from '@/hooks/useLiveMatch';
import { useOddsWebhookSync } from '@/hooks/useOddsWebhookSync';
import { cn, formatDecimal, formatPercent, traduzirFonteMercado, traduzirTextoMercado } from '@/lib/utils';
import { deriveLiveProjection } from '@/lib/liveProjection';
import type { MatchAnalysis, Tip, TeamStats, ScorePrediction, ValueBet } from '@/lib/types';
import { ProbabilityBar, TripleProbabilityBar } from './ProbabilityBar';
import { OddsComparator } from './OddsComparator';
import { useBetslip } from '@/contexts/BetslipContext';
import { useTipsHistory } from '@/contexts/TipsHistoryContext';
import {
  Target, Flag, CreditCard, TrendingUp, Users, Star, ChevronRight,
  BarChart2, Activity, Zap, Award, Clock, Shield, Flame, ArrowUp,
  ArrowDown, Minus, TrendingDown, AlertTriangle, CheckCircle2,
  DollarSign, Timer, Layers, Crosshair, Plus, Check, Heart, Bell, BellOff,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// CONSTANTS
// ============================================================
const categoryIcons: Record<string, React.ElementType> = {
  result: Target,
  goals: TrendingUp,
  corners: Flag,
  cards: CreditCard,
  btts: Users,
  handicap: Layers,
  halftime: Timer,
  special: Star,
};

const categoryColors: Record<string, string> = {
  result: 'text-blue-400',
  goals: 'text-emerald-400',
  corners: 'text-amber-400',
  cards: 'text-red-400',
  btts: 'text-purple-400',
  handicap: 'text-cyan-400',
  halftime: 'text-orange-400',
  special: 'text-yellow-400',
};

const categoryBg: Record<string, string> = {
  result: 'bg-blue-500/10',
  goals: 'bg-emerald-500/10',
  corners: 'bg-amber-500/10',
  cards: 'bg-red-500/10',
  btts: 'bg-purple-500/10',
  handicap: 'bg-cyan-500/10',
  halftime: 'bg-orange-500/10',
  special: 'bg-yellow-500/10',
};

const confidenceConfig = {
  high: { label: 'Alta', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  medium: { label: 'Média', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  low: { label: 'Baixa', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
};

// ── Perfil de equipe ──────────────────────────────────────────────────────────
// Deriva um badge descritivo a partir das estatísticas do time
function getTeamProfile(stats: TeamStats): { label: string; color: string; bg: string; icon: string } | null {
  const g  = stats.avgGoalsScored;
  const gc = stats.avgGoalsConceded;
  const cs = stats.cleanSheetRate;
  const bt = stats.bttsRate;
  const o2 = stats.over25Rate;
  const yc = stats.avgTotalCardsPerGame;
  const cr = stats.avgCornersFor;
  const fp = stats.formPoints;
  const wr = stats.winRate;
  const fs = stats.failedToScoreRate;

  // Ordem de prioridade: o perfil mais dominante aparece primeiro
  if (g >= 2.3)
    return { label: '⚽ Equipe artilheira',    color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/25', icon: '⚽' };
  if (gc <= 0.7 && cs >= 0.45)
    return { label: '🧱 Defesa de aço',         color: 'text-blue-300',    bg: 'bg-blue-500/10 border-blue-500/25',    icon: '🧱' };
  if (bt >= 0.65 && o2 >= 0.6)
    return { label: '🔥 Jogos abertos',          color: 'text-orange-300',  bg: 'bg-orange-500/10 border-orange-500/25', icon: '🔥' };
  if (cs >= 0.4 && gc <= 0.9)
    return { label: '🛡️ Defesa sólida',          color: 'text-cyan-300',    bg: 'bg-cyan-500/10 border-cyan-500/25',    icon: '🛡️' };
  if (g >= 1.8 && gc <= 1.1)
    return { label: '💥 Ataque eficiente',        color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/25', icon: '💥' };
  if (fp >= 12 && wr >= 0.6)
    return { label: '📈 Momento excelente',       color: 'text-yellow-300',  bg: 'bg-yellow-500/10 border-yellow-500/25', icon: '📈' };
  if (fp <= 3 && wr <= 0.2)
    return { label: '📉 Fase crítica',            color: 'text-red-300',     bg: 'bg-red-500/10 border-red-500/25',     icon: '📉' };
  if (yc >= 3.5)
    return { label: '🟨 Jogo duro',              color: 'text-amber-300',   bg: 'bg-amber-500/10 border-amber-500/25',  icon: '🟨' };
  if (cr >= 6.5)
    return { label: '🚩 Pressão territorial',    color: 'text-amber-300',   bg: 'bg-amber-500/10 border-amber-500/25',  icon: '🚩' };
  if (fs >= 0.4)
    return { label: '😶 Ataque apagado',          color: 'text-slate-400',   bg: 'bg-slate-700/30 border-slate-600/25',  icon: '😶' };
  if (g >= 1.5 && gc >= 1.5)
    return { label: '⚡ Jogos movimentados',      color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10 border-fuchsia-500/25', icon: '⚡' };
  if (fp >= 8 && wr >= 0.45)
    return { label: '✅ Forma consistente',       color: 'text-green-300',   bg: 'bg-green-500/10 border-green-500/25',  icon: '✅' };
  return null;
}

// All tabs in a flat structure
type TabId = 'live' | 'tips' | 'goals' | 'corners' | 'cards' | 'scores' | 'handicap' | 'value' | 'stats' | 'odds' | 'dynamic' | 'players' | 'timeline' | 'live-odds' | 'odds-history';

// ============================================================
// SUB-COMPONENTS
// ============================================================
function FormBadge({ result }: { result: string }) {
  const config = {
    W: { label: 'V', bg: 'bg-emerald-500', text: 'text-white' },
    D: { label: 'E', bg: 'bg-slate-500', text: 'text-white' },
    L: { label: 'D', bg: 'bg-red-500', text: 'text-white' },
  }[result] || { label: '?', bg: 'bg-slate-600', text: 'text-white' };
  return (
    <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', config.bg, config.text)}>
      {config.label}
    </span>
  );
}

function MomentumArrow({ momentum }: { momentum: number }) {
  if (momentum > 0.2) return <ArrowUp className="w-4 h-4 text-emerald-400" />;
  if (momentum < -0.2) return <ArrowDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-slate-500" />;
}

function StatBox({ value, label, color = 'text-slate-200', sub }: { value: string | number; label: string; color?: string; sub?: string }) {
  return (
    <div className="bg-slate-800/60 rounded-xl p-3 text-center border border-slate-700/30">
      <div className={cn('text-xl font-black font-mono', color)}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, color = 'text-slate-400' }: { icon: React.ElementType; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('w-4 h-4', color)} />
      <h4 className={cn('text-xs font-bold uppercase tracking-wider', color)}>{title}</h4>
    </div>
  );
}

function SummaryScoreCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-3 text-center">
      <div className={cn('text-2xl font-black font-mono', color)}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-1">{label}</div>
    </div>
  );
}

// ============================================================
// TIP CARD
// ============================================================
function TipCard({ tip, matchLabel }: { tip: Tip; matchLabel: string }) {
  const Icon = categoryIcons[tip.category] || Star;
  const conf = confidenceConfig[tip.confidence];
  const iconColor = categoryColors[tip.category] || 'text-slate-400';
  const iconBg = categoryBg[tip.category] || 'bg-slate-700/50';
  const { addBet, removeBet, hasBet } = useBetslip();
  const betId = `${matchLabel}-${tip.id}`;
  const isAdded = hasBet(betId);

  const handleToggleBet = () => {
    if (isAdded) {
      removeBet(betId);
      toast.info(`"${traduzirTextoMercado(tip.label)}" removido do bilhete`);
    } else {
      addBet({
        id: betId,
        matchId: matchLabel,
        matchLabel,
        tipLabel: traduzirTextoMercado(tip.label),
        probability: tip.probability,
        odds: tip.odds,
        category: tip.category,
        confidence: tip.confidence,
        addedAt: Date.now(),
      });
      toast.success(`"${traduzirTextoMercado(tip.label)}" adicionado ao bilhete!`, {
        description: `Odd: ${tip.odds.toFixed(2)} • ${tip.probability}% de probabilidade`,
      });
    }
  };

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all duration-200 group',
      tip.isRecommended
        ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-transparent'
        : 'border-slate-700/50 bg-slate-800/40',
      isAdded && 'ring-1 ring-emerald-500/40'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('p-2 rounded-lg flex-shrink-0', iconBg)}>
            <Icon className={cn('w-4 h-4', iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-200 text-sm">{traduzirTextoMercado(tip.label)}</span>
              {tip.isRecommended && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                  <Star className="w-3 h-3" />
                  Recomendado
                </span>
              )}
              {tip.isValueBet && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                  <DollarSign className="w-3 h-3" />
                  Valor +{tip.valueEdge?.toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{tip.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', conf.bg, conf.color)}>
            {conf.label}
          </span>
          <span className="text-xs text-slate-500">
            Odd: <span className="text-slate-200 font-mono font-bold">{tip.odds.toFixed(2)}</span>
          </span>
          <button
            onClick={handleToggleBet}
            className={cn(
              'flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all duration-200',
              isAdded
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
            )}
          >
            {isAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {isAdded ? 'No bilhete' : '+ Bilhete'}
          </button>
        </div>
      </div>
      <div className="mt-3">
        <ProbabilityBar value={tip.probability} size="sm" animated />
      </div>
    </div>
  );
}

// ============================================================
// SCORE GRID
// ============================================================
function ScoreGrid({ scores, homeTeam, awayTeam }: { scores: ScorePrediction[]; homeTeam: string; awayTeam: string }) {
  const maxProb = Math.max(...scores.map(s => s.probability));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>{homeTeam}</span>
        <span className="font-medium text-slate-400">Placares Mais Prováveis</span>
        <span>{awayTeam}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {scores.map(score => (
          <div
            key={score.label}
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2.5 border transition-all',
              score.probability === maxProb
                ? 'border-amber-500/50 bg-amber-500/10'
                : 'border-slate-700/30 bg-slate-800/40'
            )}
          >
            <span className={cn(
              'text-base font-black font-mono',
              score.probability === maxProb ? 'text-amber-400' : 'text-slate-200'
            )}>
              {score.label}
            </span>
            <div className="text-right">
              <div className={cn(
                'text-sm font-bold',
                score.probability === maxProb ? 'text-amber-400' : 'text-slate-400'
              )}>
                {score.probability}%
              </div>
              <div className="text-xs text-slate-600">
                {(100 / score.probability).toFixed(2)}x
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600 text-center">
        Placar mais provável: <span className="text-amber-400 font-bold">{scores[0]?.label}</span>
      </p>
    </div>
  );
}

// ============================================================
// VALUE BETS PANEL
// ============================================================
function ValueBetsPanel({ valueBets }: { valueBets: ValueBet[] }) {
  if (valueBets.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600">
        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma oportunidade de valor detectada nesta partida</p>
        <p className="text-xs mt-1 text-slate-700">Nenhuma vantagem real confirmada nas cotações disponíveis para esta partida</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {valueBets.map((vb, i) => (
        <div key={i} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-200">{traduzirTextoMercado(vb.market)}</span>
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full border',
                  confidenceConfig[vb.confidence].bg,
                  confidenceConfig[vb.confidence].color
                )}>
                  {confidenceConfig[vb.confidence].label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span>Nossa prob: <span className="text-blue-400 font-bold">{vb.ourProb}%</span></span>
                <span>Prob implícita: <span className="text-slate-400">{vb.impliedProb}%</span></span>
                <span>Fonte: <span className="text-slate-400">{traduzirTextoMercado(vb.sourceLabel)}</span></span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-emerald-400 font-black text-lg">+{vb.edge.toFixed(1)}%</div>
              <div className="text-xs text-slate-500">vantagem</div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-700/30">
            <div className="flex-1 text-center">
              <div className="text-xs text-slate-600">Odd Mercado</div>
              <div className="text-sm font-bold text-slate-400 font-mono">{vb.marketOdds.toFixed(2)}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-xs text-slate-600">Nossa Odd</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">{vb.ourOdds.toFixed(2)}</div>
            </div>
          </div>
        </div>
      ))}
      <div className="bg-slate-800/30 rounded-lg p-2 mt-2">
        <p className="text-xs text-slate-600 text-center">
          EV positivo = quando a probabilidade do modelo gera retorno esperado acima de zero nas odds disponíveis. Não garante lucro no curto prazo.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// CARDS DETAIL PANEL
// ============================================================
function CardsDetailPanel({ predictions, homeTeam, awayTeam, homeStats, awayStats, liveData }: {
  predictions: MatchAnalysis['predictions'];
  homeTeam: string; awayTeam: string;
  homeStats: TeamStats; awayStats: TeamStats;
  liveData?: LiveMatchData | null;
}) {
  const liveProjection = deriveLiveProjection(predictions, liveData ?? null);
  const expectedCardsHome = liveProjection?.liveExpectedCardsHome ?? predictions.expectedCardsHome;
  const expectedCardsAway = liveProjection?.liveExpectedCardsAway ?? predictions.expectedCardsAway;
  const expectedCards = liveProjection?.liveExpectedTotalCards ?? predictions.expectedCards;
  const over35 = liveProjection?.liveOver35CardsProb ?? predictions.over35CardsProb;
  const over45 = liveProjection?.liveOver45CardsProb ?? predictions.over45CardsProb;
  const over55 = liveProjection?.liveOver55CardsProb ?? predictions.over55CardsProb;

  return (
    <div className="space-y-4">
      {liveProjection && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-red-300">Leitura ao vivo de cartões</div>
              <div className="text-xs text-slate-400 mt-1">Min. {liveProjection.displayMinute} • ritmo {liveProjection.cardPaceIndex >= 1.08 ? 'acima' : liveProjection.cardPaceIndex <= 0.9 ? 'abaixo' : 'dentro'} do esperado • atualização há {liveProjection.freshnessSeconds}s</div>
            </div>
            <div className="text-xs text-slate-400">Atual {liveProjection.currentTotalCards} • Final projetado {formatDecimal(liveProjection.liveExpectedTotalCards, 1)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatBox value={formatDecimal(expectedCardsHome, 1)} label={homeTeam} color="text-yellow-400" sub="cartões" />
        <StatBox value={formatDecimal(expectedCards, 1)} label="Total" color="text-orange-400" sub={liveProjection ? 'projetados agora' : 'esperados'} />
        <StatBox value={formatDecimal(expectedCardsAway, 1)} label={awayTeam} color="text-yellow-400" sub="cartões" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-yellow-400 font-mono">{formatDecimal((liveProjection?.liveExpectedTotalCards ?? predictions.expectedCards) * 0.92, 1)}</div>
          <div className="text-xs text-slate-500 mt-1">Amarelos projetados</div>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-red-400 font-mono">{formatDecimal((liveProjection?.liveExpectedTotalCards ?? predictions.expectedCards) * 0.08, 1)}</div>
          <div className="text-xs text-slate-500 mt-1">Vermelhos projetados</div>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={CreditCard} title="Mais de / Menos de cartões" color="text-yellow-400" />
        <ProbabilityBar label="Mais de 0,5 cartões" value={liveProjection ? 100 : predictions.over05CardsProb} color="amber" animated />
        <ProbabilityBar label="Mais de 1,5 cartões" value={liveProjection ? (liveProjection.currentTotalCards >= 2 ? 100 : Math.max(predictions.over15CardsProb - 5, 0)) : predictions.over15CardsProb} color="amber" animated />
        <ProbabilityBar label="Mais de 2,5 cartões" value={liveProjection ? (liveProjection.currentTotalCards >= 3 ? 100 : Math.max(predictions.over25CardsProb - 4, 0)) : predictions.over25CardsProb} color="amber" animated />
        <ProbabilityBar label="Mais de 3,5 cartões" value={over35} color="amber" animated />
        <ProbabilityBar label="Mais de 4,5 cartões" value={over45} color="amber" animated />
        <ProbabilityBar label="Mais de 5,5 cartões" value={over55} color="amber" animated />
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Shield} title="Probabilidade por Time" color="text-slate-400" />
        <ProbabilityBar label={`${homeTeam} leva cartão`} value={liveProjection ? Math.min(100, predictions.homeCardProb + liveProjection.currentHomeCards * 8) : predictions.homeCardProb} color="blue" animated />
        <ProbabilityBar label={`${awayTeam} leva cartão`} value={liveProjection ? Math.min(100, predictions.awayCardProb + liveProjection.currentAwayCards * 8) : predictions.awayCardProb} color="amber" animated />
        <div className="border-t border-slate-700/30 pt-2.5 mt-2.5">
          <ProbabilityBar label="Ambos levam cartão" value={liveProjection ? Math.min(100, predictions.bothTeamsCardProb + Math.min(liveProjection.currentHomeCards, 1) * 18 + Math.min(liveProjection.currentAwayCards, 1) * 18) : predictions.bothTeamsCardProb} color="purple" animated />
        </div>
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-2.5">
        <SectionTitle icon={AlertTriangle} title="Risco de Cartão Vermelho" color="text-red-400" />
        <ProbabilityBar label={`Vermelho — ${homeTeam}`} value={predictions.homeRedCardProb} color="red" animated />
        <ProbabilityBar label={`Vermelho — ${awayTeam}`} value={predictions.awayRedCardProb} color="red" animated />
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Clock} title="Cartões por Período" color="text-slate-400" />
        <ProbabilityBar label="Cartão no 1º Tempo" value={predictions.firstHalfCardProb} color="amber" animated />
        <ProbabilityBar label="Cartão no 2º Tempo" value={predictions.secondHalfCardProb} color="amber" animated />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
          <div className="text-xs text-slate-500 mb-2 font-medium">{homeTeam}</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Amarelos/jogo</span>
              <span className="text-yellow-400 font-mono font-bold">{homeStats.avgYellowCards.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Vermelhos/jogo</span>
              <span className="text-red-400 font-mono font-bold">{homeStats.avgRedCards.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Agressividade</span>
              <span className={cn('font-mono font-bold', homeStats.aggressionIndex > 0.6 ? 'text-red-400' : homeStats.aggressionIndex > 0.4 ? 'text-amber-400' : 'text-emerald-400')}>
                {homeStats.aggressionIndex > 0.6 ? 'Alta' : homeStats.aggressionIndex > 0.4 ? 'Média' : 'Baixa'}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
          <div className="text-xs text-slate-500 mb-2 font-medium">{awayTeam}</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Amarelos/jogo</span>
              <span className="text-yellow-400 font-mono font-bold">{awayStats.avgYellowCards.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Vermelhos/jogo</span>
              <span className="text-red-400 font-mono font-bold">{awayStats.avgRedCards.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Agressividade</span>
              <span className={cn('font-mono font-bold', awayStats.aggressionIndex > 0.6 ? 'text-red-400' : awayStats.aggressionIndex > 0.4 ? 'text-amber-400' : 'text-emerald-400')}>
                {awayStats.aggressionIndex > 0.6 ? 'Alta' : awayStats.aggressionIndex > 0.4 ? 'Média' : 'Baixa'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CORNERS DETAIL PANEL
// ============================================================
function CornersDetailPanel({ predictions, homeTeam, awayTeam, homeStats, awayStats, liveData }: {
  predictions: MatchAnalysis['predictions'];
  homeTeam: string; awayTeam: string;
  homeStats: TeamStats; awayStats: TeamStats;
  liveData?: LiveMatchData | null;
}) {
  const liveProjection = deriveLiveProjection(predictions, liveData ?? null);
  const expectedCornersHome = liveProjection?.liveExpectedCornersHome ?? predictions.expectedCornersHome;
  const expectedCornersAway = liveProjection?.liveExpectedCornersAway ?? predictions.expectedCornersAway;
  const expectedCorners = liveProjection?.liveExpectedTotalCorners ?? predictions.expectedCorners;

  return (
    <div className="space-y-4">
      {liveProjection && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">Leitura ao vivo de escanteios</div>
              <div className="text-xs text-slate-400 mt-1">Min. {liveProjection.displayMinute} • ritmo {liveProjection.cornerPaceIndex >= 1.08 ? 'acima' : liveProjection.cornerPaceIndex <= 0.9 ? 'abaixo' : 'dentro'} do esperado • atualização há {liveProjection.freshnessSeconds}s</div>
            </div>
            <div className="text-xs text-slate-400">Atual {liveProjection.currentTotalCorners} • Final projetado {formatDecimal(liveProjection.liveExpectedTotalCorners, 1)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatBox value={formatDecimal(expectedCornersHome, 1)} label={homeTeam} color="text-blue-400" sub="escanteios" />
        <StatBox value={formatDecimal(expectedCorners, 1)} label="Total" color="text-amber-400" sub={liveProjection ? 'projetados agora' : 'esperados'} />
        <StatBox value={formatDecimal(expectedCornersAway, 1)} label={awayTeam} color="text-amber-400" sub="escanteios" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-cyan-400 font-mono">{liveProjection?.isFirstHalfOpen ? formatDecimal(liveProjection.liveExpectedFirstHalfCorners, 1) : formatDecimal(predictions.expectedFirstHalfCorners, 1)}</div>
          <div className="text-xs text-slate-500 mt-1">{liveProjection?.isFirstHalfOpen ? 'Escanteios finais projetados no 1ºT' : 'Escanteios esperados no 1ºT'}</div>
        </div>
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-orange-400 font-mono">{liveProjection?.isFirstHalfOpen ? formatPercent(liveProjection.liveFirstHalfOver45CornersProb, { digits: 1 }) : formatPercent(predictions.firstHalfOver45CornersProb, { digits: 1 })}</div>
          <div className="text-xs text-slate-500 mt-1">Mais de 4,5 escanteios no 1º tempo</div>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Timer} title="Escanteios até o Intervalo" color="text-cyan-400" />
        {liveProjection && !liveProjection.isFirstHalfOpen ? (
          <div className="rounded-xl border border-slate-700/30 bg-slate-900/35 px-3 py-3 text-xs text-slate-400">
            Mercado de 1º tempo encerrado. Use as leituras de escanteios finais para a partida.
          </div>
        ) : (
          <>
            <ProbabilityBar label="Mais de 3,5 escanteios no 1º tempo" value={liveProjection?.liveFirstHalfOver35CornersProb ?? predictions.firstHalfOver35CornersProb} color="blue" animated />
            <ProbabilityBar label="Mais de 4,5 escanteios no 1º tempo" value={liveProjection?.liveFirstHalfOver45CornersProb ?? predictions.firstHalfOver45CornersProb} color="amber" animated />
            <ProbabilityBar label="Mais de 5,5 escanteios no 1º tempo" value={liveProjection?.liveFirstHalfOver55CornersProb ?? predictions.firstHalfOver55CornersProb} color="red" animated />
          </>
        )}
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Flag} title="Mais de / Menos de escanteios" color="text-amber-400" />
        <ProbabilityBar label="Mais de 5,5 escanteios" value={liveProjection ? Math.max(predictions.over55CornersProb, (liveProjection.liveOver85CornersProb ?? predictions.over85CornersProb) - 12) : predictions.over55CornersProb} color="amber" animated />
        <ProbabilityBar label="Mais de 6,5 escanteios" value={liveProjection ? Math.max(predictions.over65CornersProb, (liveProjection.liveOver85CornersProb ?? predictions.over85CornersProb) - 8) : predictions.over65CornersProb} color="amber" animated />
        <ProbabilityBar label="Mais de 7,5 escanteios" value={liveProjection ? Math.max(predictions.over75CornersProb, (liveProjection.liveOver85CornersProb ?? predictions.over85CornersProb) - 4) : predictions.over75CornersProb} color="amber" animated />
        <ProbabilityBar label="Mais de 8,5 escanteios" value={liveProjection?.liveOver85CornersProb ?? predictions.over85CornersProb} color="amber" animated />
        <ProbabilityBar label="Mais de 9,5 escanteios" value={liveProjection?.liveOver95CornersProb ?? predictions.over95CornersProb} color="amber" animated />
        <ProbabilityBar label="Mais de 10,5 escanteios" value={liveProjection?.liveOver105CornersProb ?? predictions.over105CornersProb} color="amber" animated />
        <ProbabilityBar label="Mais de 11,5 escanteios" value={liveProjection ? Math.max(predictions.over115CornersProb, (liveProjection.liveOver105CornersProb ?? predictions.over105CornersProb) - 8) : predictions.over115CornersProb} color="amber" animated />
        <ProbabilityBar label="Mais de 12,5 escanteios" value={liveProjection ? Math.max(predictions.over125CornersProb, (liveProjection.liveOver105CornersProb ?? predictions.over105CornersProb) - 14) : predictions.over125CornersProb} color="amber" animated />
        <div className="border-t border-slate-700/30 pt-2.5 mt-2">
          <ProbabilityBar label="Menos de 8,5 escanteios" value={liveProjection?.liveUnder85CornersProb ?? predictions.under85CornersProb} color="red" animated />
          <div className="mt-2">
            <ProbabilityBar label="Menos de 10,5 escanteios" value={liveProjection?.liveUnder105CornersProb ?? predictions.under105CornersProb} color="red" animated />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
          <div className="text-xs text-slate-500 mb-2 font-medium">{homeTeam}</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">A favor/jogo</span>
              <span className="text-blue-400 font-mono font-bold">{homeStats.avgCornersFor.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Contra/jogo</span>
              <span className="text-slate-400 font-mono font-bold">{homeStats.avgCornersAgainst.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Força ataque</span>
              <span className={cn('font-mono font-bold', homeStats.attackStrength > 1.1 ? 'text-emerald-400' : homeStats.attackStrength < 0.9 ? 'text-red-400' : 'text-slate-400')}>
                {homeStats.attackStrength.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
          <div className="text-xs text-slate-500 mb-2 font-medium">{awayTeam}</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">A favor/jogo</span>
              <span className="text-amber-400 font-mono font-bold">{awayStats.avgCornersFor.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Contra/jogo</span>
              <span className="text-slate-400 font-mono font-bold">{awayStats.avgCornersAgainst.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Força ataque</span>
              <span className={cn('font-mono font-bold', awayStats.attackStrength > 1.1 ? 'text-emerald-400' : awayStats.attackStrength < 0.9 ? 'text-red-400' : 'text-slate-400')}>
                {awayStats.attackStrength.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
        <p className="text-xs text-amber-400/80">
          {liveProjection
            ? 'Leitura ao vivo recalcula a projeção de escanteios usando minuto, placar, posse, finalizações e ritmo atual do jogo.'
            : 'Escanteios calculados via modelo histórico. Durante o jogo, o sistema passa a reagir ao ritmo real da partida.'}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// GOALS DETAIL PANEL
// ============================================================
function GoalsDetailPanel({ predictions, homeTeam, awayTeam, homeStats, awayStats, liveData }: {
  predictions: MatchAnalysis['predictions'];
  homeTeam: string; awayTeam: string;
  homeStats: TeamStats; awayStats: TeamStats;
  liveData?: LiveMatchData | null;
}) {
  const liveProjection = deriveLiveProjection(predictions, liveData ?? null);
  const expectedGoalsHome = liveProjection?.liveExpectedGoalsHome ?? predictions.expectedGoalsHome;
  const expectedGoalsAway = liveProjection?.liveExpectedGoalsAway ?? predictions.expectedGoalsAway;
  const expectedTotalGoals = liveProjection?.liveExpectedTotalGoals ?? predictions.expectedTotalGoals;

  return (
    <div className="space-y-4">
      {liveProjection && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">Leitura ao vivo de gols</div>
              <div className="text-xs text-slate-400 mt-1">Min. {liveProjection.displayMinute} • pressão {liveProjection.pressureIndex}/100 • ritmo {liveProjection.goalPaceIndex >= 1.08 ? 'acima' : liveProjection.goalPaceIndex <= 0.9 ? 'abaixo' : 'dentro'} do esperado • atualização há {liveProjection.freshnessSeconds}s</div>
            </div>
            <div className="text-xs text-slate-400">Atual {liveProjection.currentTotalGoals} • Final projetado {formatDecimal(liveProjection.liveExpectedTotalGoals)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatBox value={formatDecimal(expectedGoalsHome)} label={`xG ${homeTeam}`} color="text-blue-400" />
        <StatBox value={formatDecimal(expectedTotalGoals)} label="xG Total" color="text-emerald-400" />
        <StatBox value={formatDecimal(expectedGoalsAway)} label={`xG ${awayTeam}`} color="text-amber-400" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-orange-400 font-mono">{liveProjection?.isFirstHalfOpen ? formatDecimal(liveProjection.liveExpectedFirstHalfGoals) : formatDecimal(predictions.expectedFirstHalfGoals)}</div>
          <div className="text-xs text-slate-500 mt-1">{liveProjection?.isFirstHalfOpen ? 'Gols finais projetados no 1ºT' : 'xG esperado no 1ºT'}</div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-amber-400 font-mono">{liveProjection?.isFirstHalfOpen ? formatPercent(liveProjection.liveFirstHalfOver05Prob, { digits: 1 }) : formatPercent(predictions.firstHalfOver05Prob, { digits: 1 })}</div>
          <div className="text-xs text-slate-500 mt-1">Gol antes do intervalo</div>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={TrendingUp} title="Mais de / Menos de gols" color="text-emerald-400" />
        <ProbabilityBar label="Mais de 0,5" value={liveProjection ? 100 : predictions.over05Prob} animated />
        <ProbabilityBar label="Mais de 1,5" value={liveProjection?.liveOver15Prob ?? predictions.over15Prob} animated />
        <ProbabilityBar label="Mais de 2,5" value={liveProjection?.liveOver25Prob ?? predictions.over25Prob} animated />
        <ProbabilityBar label="Mais de 3,5" value={liveProjection?.liveOver35Prob ?? predictions.over35Prob} animated />
        <ProbabilityBar label="Mais de 4,5" value={liveProjection?.liveOver45Prob ?? predictions.over45Prob} animated />
        <div className="border-t border-slate-700/30 pt-2.5 mt-2">
          <ProbabilityBar label="Menos de 1,5" value={liveProjection ? Math.max(0, 100 - (liveProjection.liveOver15Prob ?? predictions.over15Prob)) : predictions.under15Prob} color="red" animated />
          <div className="mt-2">
            <ProbabilityBar label="Menos de 2,5" value={liveProjection?.liveUnder25Prob ?? predictions.under25Prob} color="red" animated />
          </div>
          <div className="mt-2">
            <ProbabilityBar label="Menos de 3,5" value={liveProjection?.liveUnder35Prob ?? predictions.under35Prob} color="red" animated />
          </div>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Users} title="Ambos marcam" color="text-purple-400" />
        <ProbabilityBar label="Ambos marcam — sim" value={liveProjection?.liveBttsYesProb ?? predictions.bttsYesProb} color="green" animated />
        <ProbabilityBar label="Ambos marcam — não" value={liveProjection ? Math.max(0, 100 - liveProjection.liveBttsYesProb) : predictions.bttsNoProb} color="red" animated />
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Target} title="Probabilidade de Marcar" color="text-slate-400" />
        <ProbabilityBar label={`${homeTeam} marca`} value={liveProjection?.liveHomeToScoreProb ?? predictions.homeToScoreProb} color="blue" animated />
        <ProbabilityBar label={`${homeTeam} marca 2+`} value={liveProjection?.liveHome2PlusGoalsProb ?? predictions.home2PlusGoalsProb} color="blue" animated />
        <div className="border-t border-slate-700/30 pt-2.5 mt-2">
          <ProbabilityBar label={`${awayTeam} marca`} value={liveProjection?.liveAwayToScoreProb ?? predictions.awayToScoreProb} color="amber" animated />
          <div className="mt-2">
            <ProbabilityBar label={`${awayTeam} marca 2+`} value={liveProjection?.liveAway2PlusGoalsProb ?? predictions.away2PlusGoalsProb} color="amber" animated />
          </div>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Shield} title="Clean Sheet" color="text-emerald-400" />
        <ProbabilityBar label={`Clean Sheet — ${homeTeam}`} value={liveProjection?.liveCleanSheetHomeProb ?? predictions.cleanSheetHomeProb} color="green" animated />
        <ProbabilityBar label={`Clean Sheet — ${awayTeam}`} value={liveProjection?.liveCleanSheetAwayProb ?? predictions.cleanSheetAwayProb} color="green" animated />
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Timer} title="Gols por Período" color="text-orange-400" />
        {liveProjection && !liveProjection.isFirstHalfOpen ? (
          <div className="rounded-xl border border-slate-700/30 bg-slate-900/35 px-3 py-3 text-xs text-slate-400">
            Mercado de 1º tempo encerrado. A leitura agora prioriza o restante da partida e o 2º tempo.
          </div>
        ) : (
          <>
            <ProbabilityBar label="Gol no 1º Tempo" value={liveProjection?.liveFirstHalfGoalProb ?? predictions.firstHalfGoalProb} color="amber" animated />
            <ProbabilityBar label="Mais de 0,5 no 1º tempo" value={liveProjection?.liveFirstHalfOver05Prob ?? predictions.firstHalfOver05Prob} color="amber" animated />
            <ProbabilityBar label="Mais de 1,5 no 1º tempo" value={liveProjection?.liveFirstHalfOver15Prob ?? predictions.firstHalfOver15Prob} color="amber" animated />
            <ProbabilityBar label="Ambos marcam no 1º tempo" value={predictions.firstHalfBttsProb} color="purple" animated />
          </>
        )}
        <div className="border-t border-slate-700/30 pt-2.5 mt-2">
          <ProbabilityBar label="Gol no 2º Tempo" value={liveProjection?.liveSecondHalfGoalProb ?? predictions.secondHalfGoalProb} color="blue" animated />
        </div>
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
        <p className="text-xs text-emerald-400/80">
          {liveProjection
            ? 'A projeção de gols ao vivo agora reage ao minuto, placar, finalizações, chutes no alvo, posse e escanteios do jogo em andamento.'
            : 'Pré-jogo usa base histórica; durante o jogo, o sistema passa a recalcular a projeção com o que está acontecendo em campo.'}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// HANDICAP PANEL
// ============================================================
function HandicapPanel({ predictions, homeTeam, awayTeam }: {
  predictions: MatchAnalysis['predictions'];
  homeTeam: string; awayTeam: string;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Layers} title="Dupla Chance" color="text-cyan-400" />
        <ProbabilityBar label={`1X — ${homeTeam} ou Empate`} value={predictions.homeOrDraw} color="blue" animated />
        <ProbabilityBar label={`X2 — Empate ou ${awayTeam}`} value={predictions.awayOrDraw} color="amber" animated />
        <ProbabilityBar label={`12 — ${homeTeam} ou ${awayTeam}`} value={predictions.homeOrAway} color="green" animated />
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Crosshair} title={`Handicap Asiático — ${homeTeam}`} color="text-blue-400" />
        <ProbabilityBar label={`${homeTeam} -0.5 (vence)`} value={predictions.handicapHome05} color="blue" animated />
        <ProbabilityBar label={`${homeTeam} -1 (vence por 2+)`} value={predictions.handicapHome1} color="blue" animated />
        <ProbabilityBar label={`${homeTeam} -1.5 (vence por 2+)`} value={predictions.handicapHome15} color="blue" animated />
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 space-y-2.5">
        <SectionTitle icon={Crosshair} title={`Handicap Asiático — ${awayTeam}`} color="text-amber-400" />
        <ProbabilityBar label={`${awayTeam} -0.5 (não perde)`} value={predictions.handicapAway05} color="amber" animated />
        <ProbabilityBar label={`${awayTeam} -1 (empata ou vence)`} value={predictions.handicapAway1} color="amber" animated />
        <ProbabilityBar label={`${awayTeam} -1.5 (vence por 2+)`} value={predictions.handicapAway15} color="amber" animated />
      </div>

      <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
        <p className="text-xs text-slate-600">
          <strong className="text-slate-500">Handicap Asiático:</strong> elimina o empate dividindo a aposta. -0.5 = time deve vencer. -1 = time deve vencer por 2+ gols (se vencer por 1, aposta é devolvida).
        </p>
      </div>
    </div>
  );
}

// ============================================================
// TEAM STATS PANEL
// ============================================================
function TeamStatsPanel({ stats, isHome, headToHead, homeTeam, awayTeam }: {
  stats: TeamStats; isHome: boolean;
  headToHead?: MatchAnalysis['headToHead'];
  homeTeam?: string; awayTeam?: string;
}) {
  const color = isHome ? 'text-blue-400' : 'text-amber-400';
  return (
    <div className="space-y-4">
      {/* H2H (only shown in home stats) */}
      {isHome && headToHead && headToHead.totalMatches > 0 && (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30">
          <SectionTitle icon={Shield} title="Confronto Direto (H2H)" color="text-slate-400" />
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div>
              <div className="text-xl font-bold text-blue-400">{headToHead.homeWins}</div>
              <div className="text-xs text-slate-500">{homeTeam}</div>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-400">{headToHead.draws}</div>
              <div className="text-xs text-slate-500">Empates</div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-400">{headToHead.awayWins}</div>
              <div className="text-xs text-slate-500">{awayTeam}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatBox value={headToHead.avgTotalGoals.toFixed(1)} label="Gols/Jogo" />
            <StatBox value={`${Math.round(headToHead.bttsRate * 100)}%`} label="Ambas marcam" color="text-purple-400" />
            <StatBox value={`${Math.round(headToHead.over25Rate * 100)}%`} label="Mais de 2,5" color="text-emerald-400" />
          </div>
          {headToHead.recentMatches.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {headToHead.recentMatches.map(m => (
                <div key={m.idEvent} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600 flex-shrink-0">{m.dateEvent}</span>
                  <span className="text-slate-400 truncate flex-1 text-center">
                    {m.homeTeam} <span className="font-bold text-slate-200">{m.homeScore}-{m.awayScore}</span> {m.awayTeam}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Forma Recente</span>
          <div className="flex items-center gap-1">
            <MomentumArrow momentum={stats.formMomentum} />
            <span className="text-xs text-slate-500">{stats.formPoints}/15 pts</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {stats.form.length > 0
            ? stats.form.slice(0, 5).map((r, i) => <FormBadge key={i} result={r} />)
            : <span className="text-xs text-slate-600">Sem dados</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatBox value={stats.avgGoalsScored.toFixed(1)} label="Gols marcados/jogo" color={color} />
        <StatBox value={stats.avgGoalsConceded.toFixed(1)} label="Gols sofridos/jogo" color="text-slate-400" />
        <StatBox value={`${Math.round(stats.winRate * 100)}%`} label="Taxa de vitória" color="text-emerald-400" />
        <StatBox value={`${Math.round(stats.bttsRate * 100)}%`} label="Ambas marcam" color="text-purple-400" />
        <StatBox value={`${Math.round(stats.cleanSheetRate * 100)}%`} label="Clean Sheet" color="text-blue-400" />
        <StatBox value={`${Math.round(stats.failedToScoreRate * 100)}%`} label="Não marcou" color="text-red-400" />
      </div>

      <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
        <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Casa vs Fora</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Vitória em casa</span>
            <span className={cn('font-bold', color)}>{Math.round(stats.homeWinRate * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Vitória fora</span>
            <span className="text-amber-400 font-bold">{Math.round(stats.awayWinRate * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Gols em casa</span>
            <span className="text-slate-300 font-bold font-mono">{stats.avgGoalsScoredHome.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Gols fora</span>
            <span className="text-slate-300 font-bold font-mono">{stats.avgGoalsScoredAway.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Mais de / Menos de (histórico)</div>
        <ProbabilityBar label="Mais de 1,5" value={Math.round(stats.over15Rate * 100)} color="blue" size="sm" />
        <ProbabilityBar label="Mais de 2,5" value={Math.round(stats.over25Rate * 100)} color="blue" size="sm" />
        <ProbabilityBar label="Mais de 3,5" value={Math.round(stats.over35Rate * 100)} color="blue" size="sm" />
      </div>

      {(stats.winStreak > 0 || stats.unbeatenStreak > 0 || stats.scoringStreak > 0) && (
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Sequências Atuais</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {stats.winStreak > 0 && (
              <div className="flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-amber-400" />
                <span className="text-slate-400">{stats.winStreak} vitórias seguidas</span>
              </div>
            )}
            {stats.unbeatenStreak > 1 && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-400">{stats.unbeatenStreak} sem perder</span>
              </div>
            )}
            {stats.scoringStreak > 1 && (
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-blue-400" />
                <span className="text-slate-400">{stats.scoringStreak} marcando</span>
              </div>
            )}
            {stats.concedingStreak > 1 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span className="text-slate-400">{stats.concedingStreak} sofrendo</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
        <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Índices</div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Força de Ataque</span>
            <span className={cn('font-bold font-mono', stats.attackStrength > 1.1 ? 'text-emerald-400' : stats.attackStrength < 0.9 ? 'text-red-400' : 'text-slate-400')}>
              {stats.attackStrength.toFixed(2)}x
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Força de Defesa</span>
            <span className={cn('font-bold font-mono', stats.defenseStrength < 0.9 ? 'text-emerald-400' : stats.defenseStrength > 1.1 ? 'text-red-400' : 'text-slate-400')}>
              {stats.defenseStrength.toFixed(2)}x
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Qualidade dos Dados</span>
            <span className={cn('font-bold font-mono', stats.dataQuality >= 7 ? 'text-emerald-400' : stats.dataQuality >= 4 ? 'text-amber-400' : 'text-red-400')}>
              {stats.dataQuality.toFixed(0)}/10
            </span>
          </div>
        </div>
      </div>

      {stats.recentMatches.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Últimas Partidas</div>
          <div className="space-y-1.5">
            {stats.recentMatches.slice(0, 6).map(m => (
              <div key={m.idEvent} className="flex items-center gap-2 text-xs">
                <FormBadge result={m.result} />
                <span className="text-slate-400 truncate flex-1">
                  {m.homeTeam} <span className="font-bold text-slate-200">{m.homeScore}-{m.awayScore}</span> {m.awayTeam}
                </span>
                <span className="text-slate-600 flex-shrink-0">{m.dateEvent}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



type QuickRaphaPick = {
  principal: string;
  principalProb: number;
  conservative: string;
  conservativeProb: number;
  scoreline: string;
  confidence: keyof typeof confidenceConfig;
  notes: string[];
  cornersPick: string;
  cornersProb: number;
  cardsPick: string;
  cardsProb: number;
  scorerHighlights: { name: string; goalProb: number; next15Prob: number; team: string }[];
};

function buildFallbackMarketPick(label: string, probability: number, fallbackLabel: string) {
  return {
    label: label || fallbackLabel,
    probability: Number.isFinite(probability) ? probability : 0,
  };
}

function buildQuickRaphaPick(analysis: MatchAnalysis, playersData?: MatchPlayersData | null): QuickRaphaPick {
  const rankedTips = [...analysis.tips].sort((a, b) => {
    const recDiff = Number(b.isRecommended) - Number(a.isRecommended);
    if (recDiff !== 0) return recDiff;
    return b.probability - a.probability;
  });

  const principal = rankedTips[0] || { label: traduzirTextoMercado(analysis.summary.bestAngle), probability: 62, confidence: analysis.confidence } as Tip;
  const conservative = rankedTips.find((tip) => tip.id !== (principal as Tip).id && tip.category !== (principal as Tip).category)
    || rankedTips.find((tip) => tip.id !== (principal as Tip).id)
    || principal;

  const cornersTip = rankedTips.find((tip) => tip.category === 'corners') || buildFallbackMarketPick(
    analysis.predictions.expectedCorners >= 9.2 ? 'Mais de 8,5 escanteios' : 'Menos de 10,5 escanteios',
    analysis.predictions.expectedCorners >= 9.2 ? analysis.predictions.over85CornersProb : analysis.predictions.under105CornersProb,
    'Escanteios com linha conservadora'
  );

  const cardsTip = rankedTips.find((tip) => tip.category === 'cards') || buildFallbackMarketPick(
    analysis.predictions.expectedCards >= 4.3 ? 'Mais de 3,5 cartões' : 'Mais de 2,5 cartões',
    analysis.predictions.expectedCards >= 4.3 ? analysis.predictions.over35CardsProb : analysis.predictions.over25CardsProb,
    'Mercado de cartões controlado'
  );

  const bestScore = analysis.scorePredictions[0]?.label
    || `${Math.round(analysis.predictions.expectedGoalsHome)}-${Math.round(analysis.predictions.expectedGoalsAway)}`;

  const notes = [
    ...(analysis.summary.strengths || []).slice(0, 2),
    analysis.matchProfile.description || '',
  ].filter(Boolean).slice(0, 3);

  const scorerHighlights = (playersData?.topScorers || [])
    .slice(0, 3)
    .map((player) => ({
      name: player.shortName || player.name,
      goalProb: player.goalProbability,
      next15Prob: player.next15GoalProbability,
      team: player.teamSide === 'home' ? analysis.match.strHomeTeam : analysis.match.strAwayTeam,
    }));

  return {
    principal: principal.label,
    principalProb: principal.probability,
    conservative: conservative.label,
    conservativeProb: conservative.probability,
    scoreline: bestScore,
    confidence: (principal.confidence || analysis.confidence || 'medium') as keyof typeof confidenceConfig,
    notes,
    cornersPick: cornersTip.label,
    cornersProb: cornersTip.probability,
    cardsPick: cardsTip.label,
    cardsProb: cardsTip.probability,
    scorerHighlights,
  };
}

// ============================================================
// MAIN PANEL
// ============================================================
interface MatchAnalysisPanelProps {
  analysis: MatchAnalysis;
  matchLabel?: string;
}

const MAIN_TABS: { id: TabId; label: string; icon: React.ElementType; color: string; badge?: string }[] = [
  { id: 'live', label: 'Ao Vivo', icon: Activity, color: 'text-red-400' },
  { id: 'dynamic', label: 'Pitaco do Rapha', icon: Zap, color: 'text-amber-400' },
  { id: 'players', label: 'Jogadores', icon: Users, color: 'text-purple-400' },
  { id: 'timeline', label: 'Linha do Tempo', icon: Clock, color: 'text-blue-400' },
  { id: 'live-odds', label: 'Mercado ao vivo', icon: DollarSign, color: 'text-green-400' },
  { id: 'odds-history', label: 'Variação de odds', icon: TrendingUp, color: 'text-cyan-400' },
  { id: 'tips', label: 'Sugestões', icon: Star, color: 'text-amber-400' },
  { id: 'goals', label: 'Gols', icon: TrendingUp, color: 'text-emerald-400' },
  { id: 'corners', label: 'Escanteios', icon: Flag, color: 'text-amber-400' },
  { id: 'cards', label: 'Cartões', icon: CreditCard, color: 'text-red-400' },
  { id: 'scores', label: 'Placares', icon: Award, color: 'text-amber-400' },
  { id: 'handicap', label: 'Handicap', icon: Layers, color: 'text-cyan-400' },
  { id: 'value', label: 'Valor', icon: DollarSign, color: 'text-emerald-400' },
  { id: 'odds', label: 'Mercado', icon: BarChart2, color: 'text-blue-400' },
  { id: 'stats', label: 'Estatísticas', icon: BarChart2, color: 'text-slate-400' },
];

const PRIMARY_TABS = MAIN_TABS.slice(0, 7);
const MARKET_TABS = MAIN_TABS.slice(7);


const TAB_HELP_TEXT: Record<TabId, string> = {
  live: 'Pressão, leitura do minuto e resumo em tempo real.',
  dynamic: 'Pitaco objetivo do jogo, leitura principal e opção conservadora.',
  players: 'Nomes quentes, riscos individuais e jogadores relevantes.',
  timeline: 'Eventos do jogo em ordem cronológica com leitura de contexto.',
  'live-odds': 'Preço ao vivo, feed sincronizado e oportunidades do mercado.',
  'odds-history': 'Variação das linhas, movimento e possíveis ajustes.',
  tips: 'Sugestões objetivas do modelo para pré-jogo e ao vivo.',
  goals: 'Mercados de gols, ambas marcam e projeções do confronto.',
  corners: 'Escanteios finais, 1º tempo e pressão territorial.',
  cards: 'Cartões esperados, intensidade e leitura disciplinar.',
  scores: 'Placares prováveis e distribuição de resultados.',
  handicap: 'Linhas de handicap e equilíbrio de forças.',
  value: 'Comparação entre preço justo e preço do mercado.',
  odds: 'Cotações principais e leitura consolidada do mercado.',
  stats: 'Força histórica, forma, H2H e estatísticas do duelo.',
};


export function MatchAnalysisPanel({ analysis, matchLabel }: MatchAnalysisPanelProps) {
  const isLive = analysis.match.strStatus === 'In Progress';

  // ── Bilhete e histórico ──────────────────────────────────
  const { addBet, removeBet, hasBet } = useBetslip();
  const { addToHistory } = useTipsHistory();

  // ── Alertas de gol ──────────────────────────────────────

  const isFinished = analysis.match.strStatus === 'Match Finished';
  const [activeTab, setActiveTab] = useState<TabId>(isLive ? 'dynamic' : 'dynamic');
  const [showQuickPitaco, setShowQuickPitaco] = useState(false);

  // Busca dados ao vivo para a aba de Sugestões Dinâmicas
  const espnEventId = analysis.match.idEvent || null;
  const { liveData, loading: liveLoading } = useLiveMatch(
    espnEventId,
    isLive || isFinished
  );

  // Alertas de sugestão: notifica quando confiança muda durante o jogo
  useSuggestionAlerts(analysis, liveData, isLive);

  // Dados de jogadores e odds ao vivo
  const { playersData, loading: playersLoading } = useMatchPlayers(
    analysis.match.idEvent || null,
    isLive || isFinished || activeTab === 'dynamic' || activeTab === 'players' || activeTab === 'live-odds' || activeTab === 'odds-history'
  );

  const { current: syncedOdds, loading: syncedOddsLoading } = useOddsWebhookSync(analysis.match.idEvent || null, true);
  const quickPitaco = buildQuickRaphaPick(analysis, playersData);
  const syncedOddsSummary = syncedOdds ? {
    provider: traduzirFonteMercado(syncedOdds.provider || syncedOdds.source || 'Integração'),
    homeMoneyline: syncedOdds.homeOdds ?? null,
    drawMoneyline: syncedOdds.drawOdds ?? null,
    awayMoneyline: syncedOdds.awayOdds ?? null,
    overOdds: syncedOdds.over25Odds ?? null,
    underOdds: syncedOdds.under25Odds ?? null,
    overUnder: 2.5,
    homeImpliedProb: null,
    awayImpliedProb: null,
    drawImpliedProb: null,
  } : null;

  // Histórico de odds (depende do feed disponível — ESPN ou webhook)
  const { currentEntry: oddsHistoryEntry } = useOddsHistory(
    analysis.match.idEvent || null,
    playersData?.odds ?? syncedOddsSummary ?? null
  );

  // Favoritos
  const { isFavorite, toggleFavorite, toggleAlerts, hasAlerts } = useFavorites();
  const matchIsFavorite = isFavorite(analysis.match.idEvent);
  const matchHasAlerts = hasAlerts(analysis.match.idEvent);

  const { match, homeTeamStats, awayTeamStats, predictions, tips, headToHead, confidence, valueBets, scorePredictions, matchProfile, marketOdds, summary } = analysis;
  const conf = confidenceConfig[confidence];
  const recommendedSugestões = tips.filter(t => t.isRecommended);
  const otherSugestões = tips.filter(t => !t.isRecommended);
  const label = matchLabel || `${match.strHomeTeam} vs ${match.strAwayTeam}`;
  const liveOddsToDisplay = syncedOddsSummary || playersData?.odds || null;

  return (
    <div className="space-y-4">
      {/* ===== HEADER ===== */}
      <div className="rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-800/60">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-slate-400 bg-slate-700/50 px-2.5 py-1 rounded-full">
                {match.strLeague}
              </span>
              {match.strSeason && <span className="text-xs text-slate-600">{match.strSeason}</span>}
              {match.strRound && <span className="text-xs text-slate-600">Rodada {match.strRound}</span>}
            </div>
            <div className="flex items-center gap-2">
              {/* Botão de alertas (só se favoritado) */}
              {matchIsFavorite && (
                <button
                  type="button"
                  onClick={() => toggleAlerts(match.idEvent)}
                  className={cn(
                    'flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all',
                    matchHasAlerts
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                      : 'bg-slate-700/40 border-slate-600/30 text-slate-500 hover:text-slate-300'
                  )}
                  title={matchHasAlerts ? 'Desativar alertas' : 'Ativar alertas'}
                >
                  {matchHasAlerts ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                  <span>{matchHasAlerts ? 'Alertas ativos' : 'Alertas pausados'}</span>
                </button>
              )}
              {/* Botão de favorito */}
              <button
                type="button"
                onClick={() => toggleFavorite(match)}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all',
                  matchIsFavorite
                    ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
                    : 'bg-slate-700/40 border-slate-600/30 text-slate-500 hover:text-yellow-400 hover:border-yellow-500/30'
                )}
                title={matchIsFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Heart className={cn('w-3 h-3', matchIsFavorite && 'fill-current')} />
                <span>{matchIsFavorite ? 'Favoritado' : 'Favoritar'}</span>
              </button>
              <div className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border', conf.bg, conf.color)}>
                <Activity className="w-3 h-3" />
                Confiança {conf.label}
              </div>
              {syncedOdds && (
                <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <Bell className="w-3 h-3" />
                  Cotações sincronizadas
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">{matchProfile.icon}</span>
            <div>
              <span className="text-sm font-bold text-slate-200">{matchProfile.label}</span>
              <p className="text-xs text-slate-500">{matchProfile.description}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col items-center gap-2 flex-1">
              {match.strHomeTeamBadge
                ? <img src={match.strHomeTeamBadge} alt={match.strHomeTeam} className="w-14 h-14 object-contain" />
                : <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-300">{match.strHomeTeam.charAt(0)}</div>
              }
              <span className="text-sm font-bold text-slate-200 text-center">{match.strHomeTeam}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Casa</span>
                <MomentumArrow momentum={homeTeamStats.formMomentum} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 min-w-[100px]">
              {isLive && liveData ? (
                <>
                  {/* Placar ao vivo */}
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-white tabular-nums">{liveData.homeScore}</span>
                    <span className="text-slate-600 font-bold">–</span>
                    <span className="text-3xl font-black text-white tabular-nums">{liveData.awayScore}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-red-400">
                      {liveData.clock ? `${liveData.clock}'` : 'Ao Vivo'}
                    </span>
                  </div>
                  {/* Eventos de gol */}
                  {liveData.events.filter(e => e.type === 'goal' || e.type === 'own_goal' || e.type === 'penalty').length > 0 && (
                    <div className="mt-1 space-y-0.5 text-center max-w-[140px]">
                      {liveData.events
                        .filter(e => e.type === 'goal' || e.type === 'own_goal' || e.type === 'penalty')
                        .map((e, i) => (
                          <div key={i} className="flex items-center justify-center gap-1 text-[10px]">
                            <span>{e.teamSide === 'home' ? '⚽' : '⚽'}</span>
                            <span className={cn(
                              'font-semibold truncate max-w-[80px]',
                              e.teamSide === 'home' ? 'text-blue-300' : 'text-amber-300'
                            )}>
                              {e.playerName.split(' ').pop()}
                            </span>
                            <span className="text-slate-600 font-mono">{e.minute}'</span>
                            {e.type === 'own_goal' && <span className="text-red-400">(GC)</span>}
                            {e.type === 'penalty' && <span className="text-emerald-400">(P)</span>}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </>
              ) : isFinished && liveData ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-slate-300 tabular-nums">{liveData.homeScore}</span>
                    <span className="text-slate-600 font-bold">–</span>
                    <span className="text-3xl font-black text-slate-300 tabular-nums">{liveData.awayScore}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">Encerrado</span>
                  {liveData.events.filter(e => e.type === 'goal' || e.type === 'own_goal' || e.type === 'penalty').length > 0 && (
                    <div className="mt-1 space-y-0.5 text-center max-w-[140px]">
                      {liveData.events
                        .filter(e => e.type === 'goal' || e.type === 'own_goal' || e.type === 'penalty')
                        .map((e, i) => (
                          <div key={i} className="flex items-center justify-center gap-1 text-[10px]">
                            <span className={cn(
                              'font-semibold truncate max-w-[80px]',
                              e.teamSide === 'home' ? 'text-blue-300' : 'text-amber-300'
                            )}>
                              {e.playerName.split(' ').pop()}
                            </span>
                            <span className="text-slate-600 font-mono">{e.minute}'</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </>
              ) : (
                <>
                  <span className="text-2xl font-black text-slate-600">VS</span>
                  {match.strTime && <span className="text-xs text-slate-500 font-mono">{match.strTime?.slice(0, 5)}</span>}
                  {match.dateEvent && <span className="text-xs text-slate-600">{match.dateEvent}</span>}
                </>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 flex-1">
              {match.strAwayTeamBadge
                ? <img src={match.strAwayTeamBadge} alt={match.strAwayTeam} className="w-14 h-14 object-contain" />
                : <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-300">{match.strAwayTeam.charAt(0)}</div>
              }
              <span className="text-sm font-bold text-slate-200 text-center">{match.strAwayTeam}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Visitante</span>
                <MomentumArrow momentum={awayTeamStats.formMomentum} />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <TripleProbabilityBar
              homeProb={predictions.homeWinProb}
              drawProb={predictions.drawProb}
              awayProb={predictions.awayWinProb}
              homeLabel={match.strHomeTeam}
              awayLabel={match.strAwayTeam}
              animated
            />
          </div>

          {/* ── Painel de decisão: Forma + H2H + Stats chave ─────── */}
          <div className="mt-4 space-y-2">

            {/* Linha 1: Forma recente de cada time */}
            <div className="grid grid-cols-2 gap-2">
              {/* Time da casa */}
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 truncate max-w-[120px]">{match.strHomeTeam}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{homeTeamStats.formPoints}/15pts</span>
                </div>
                {/* Badge de perfil */}
                {(() => { const p = getTeamProfile(homeTeamStats); return p ? (
                  <div className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border mb-2', p.bg, p.color)}>
                    {p.label}
                  </div>
                ) : <div className="mb-2" />; })()}
                {/* Últimos 5 resultados */}
                <div className="flex gap-1 mb-2">
                  {homeTeamStats.form.slice(0, 5).map((r, i) => (
                    <span key={i} className={cn(
                      'w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0',
                      r === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : r === 'D' ? 'bg-slate-600/40 text-slate-400 border border-slate-600/50'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    )}>{r === 'W' ? 'V' : r === 'D' ? 'E' : 'D'}</span>
                  ))}
                </div>
                {/* Últimos placares */}
                <div className="space-y-0.5">
                  {homeTeamStats.recentMatches.slice(0, 3).map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 truncate max-w-[100px]">
                        {m.isHome ? `x ${m.awayTeam.split(' ')[0]}` : `em ${m.homeTeam.split(' ')[0]}`}
                      </span>
                      <span className={cn('font-bold font-mono tabular-nums flex-shrink-0',
                        m.result === 'W' ? 'text-emerald-400' : m.result === 'D' ? 'text-slate-400' : 'text-red-400'
                      )}>
                        {m.homeScore}–{m.awayScore}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Stats rápidos */}
                <div className="mt-2 flex gap-3 border-t border-slate-800/60 pt-2">
                  <div className="text-center flex-1">
                    <div className="text-[13px] font-black text-emerald-300">{homeTeamStats.avgGoalsScored.toFixed(1)}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Gols/j</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-[13px] font-black text-red-300">{homeTeamStats.avgGoalsConceded.toFixed(1)}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Sofre/j</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-[13px] font-black text-blue-300">{Math.round(homeTeamStats.winRate * 100)}%</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">V%</div>
                  </div>
                </div>
              </div>

              {/* Time visitante */}
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 truncate max-w-[120px]">{match.strAwayTeam}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{awayTeamStats.formPoints}/15pts</span>
                </div>
                {/* Badge de perfil */}
                {(() => { const p = getTeamProfile(awayTeamStats); return p ? (
                  <div className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border mb-2', p.bg, p.color)}>
                    {p.label}
                  </div>
                ) : <div className="mb-2" />; })()}
                <div className="flex gap-1 mb-2">
                  {awayTeamStats.form.slice(0, 5).map((r, i) => (
                    <span key={i} className={cn(
                      'w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0',
                      r === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : r === 'D' ? 'bg-slate-600/40 text-slate-400 border border-slate-600/50'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    )}>{r === 'W' ? 'V' : r === 'D' ? 'E' : 'D'}</span>
                  ))}
                </div>
                <div className="space-y-0.5">
                  {awayTeamStats.recentMatches.slice(0, 3).map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 truncate max-w-[100px]">
                        {m.isHome ? `x ${m.awayTeam.split(' ')[0]}` : `em ${m.homeTeam.split(' ')[0]}`}
                      </span>
                      <span className={cn('font-bold font-mono tabular-nums flex-shrink-0',
                        m.result === 'W' ? 'text-emerald-400' : m.result === 'D' ? 'text-slate-400' : 'text-red-400'
                      )}>
                        {m.homeScore}–{m.awayScore}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-3 border-t border-slate-800/60 pt-2">
                  <div className="text-center flex-1">
                    <div className="text-[13px] font-black text-emerald-300">{awayTeamStats.avgGoalsScored.toFixed(1)}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Gols/j</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-[13px] font-black text-red-300">{awayTeamStats.avgGoalsConceded.toFixed(1)}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Sofre/j</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-[13px] font-black text-amber-300">{Math.round(awayTeamStats.awayWinRate * 100)}%</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">V fora%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 2: H2H + Métricas chave lado a lado */}
            <div className="grid grid-cols-3 gap-2">
              {/* H2H */}
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Confrontos diretos</div>
                {headToHead.totalMatches > 0 ? (
                  <>
                    <div className="flex items-center gap-1 mb-2">
                      <div className="flex-1 h-2 rounded-full bg-blue-500/30 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(headToHead.homeWins / headToHead.totalMatches) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono w-8 text-center">{headToHead.draws}</span>
                      <div className="flex-1 h-2 rounded-full bg-amber-500/30 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full ml-auto"
                          style={{ width: `${(headToHead.awayWins / headToHead.totalMatches) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] mb-2">
                      <span className="text-blue-400 font-bold">{headToHead.homeWins}V</span>
                      <span className="text-slate-400">{headToHead.draws}E</span>
                      <span className="text-amber-400 font-bold">{headToHead.awayWins}V</span>
                    </div>
                    <div className="space-y-1">
                      {headToHead.recentMatches.slice(0, 3).map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-mono">{m.dateEvent?.slice(0, 7)}</span>
                          <span className={cn('font-bold font-mono',
                            m.result === 'W' ? 'text-blue-400' : m.result === 'D' ? 'text-slate-400' : 'text-amber-400'
                          )}>{m.homeScore}–{m.awayScore}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-600">Sem dados H2H</span>
                )}
              </div>

              {/* Over/Under tendência */}
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Gols — tendência</div>
                <div className="space-y-2">
                  {[
                    { label: 'Over 2.5', pct: Math.round(((homeTeamStats.over25Rate + awayTeamStats.over25Rate) / 2) * 100), color: 'bg-emerald-500' },
                    { label: 'Over 1.5', pct: Math.round(((homeTeamStats.over15Rate + awayTeamStats.over15Rate) / 2) * 100), color: 'bg-blue-500' },
                    { label: 'Ambos marcam', pct: Math.round(((homeTeamStats.bttsRate + awayTeamStats.bttsRate) / 2) * 100), color: 'bg-purple-500' },
                  ].map(({ label, pct, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-slate-300 font-bold font-mono">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800">
                        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cartões + Escanteios */}
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Médias do confronto</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">⚽ xG total</span>
                    <span className="text-[13px] font-black text-emerald-300 font-mono">{predictions.expectedTotalGoals.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">🟨 Cartões/j</span>
                    <span className="text-[13px] font-black text-amber-300 font-mono">
                      {((homeTeamStats.avgTotalCardsPerGame + awayTeamStats.avgTotalCardsPerGame) / 2).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">🚩 Escanteios</span>
                    <span className="text-[13px] font-black text-blue-300 font-mono">
                      {(homeTeamStats.avgCornersFor + awayTeamStats.avgCornersFor).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">📊 Índice</span>
                    <span className={cn('text-[13px] font-black font-mono',
                      summary.decisionScore >= 75 ? 'text-emerald-400' : summary.decisionScore >= 50 ? 'text-amber-400' : 'text-red-400'
                    )}>{summary.decisionScore}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold mb-1">Melhor ângulo</div>
              <div className="text-sm font-semibold text-slate-100">{traduzirTextoMercado(summary.bestAngle)}</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{marketOdds ? `Mercado coerente com o perfil "${matchProfile.label}". Cotações monitoradas via ${traduzirFonteMercado(marketOdds.provider)}.` : `Ângulo alinhado ao perfil "${matchProfile.label}"; use gestão de risco porque não há linha completa de mercado.`}</p>
            </div>

            <div className="xl:col-span-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="text-[11px] uppercase tracking-wider text-blue-400 font-bold mb-2">Forças do cenário</div>
              <div className="space-y-2">
                {(summary.strengths.length > 0 ? summary.strengths : ['Leitura principal formada por histórico, força ofensiva/defensiva e índice do confronto.']).slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-4 rounded-2xl border border-amber-500/20 bg-[linear-gradient(145deg,rgba(245,158,11,0.08),rgba(15,23,42,0.88))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">Pitaco do Rapha</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">Leitura rápida dentro do jogo</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickPitaco(true);
                    setActiveTab('dynamic');
                    try {
                      if (quickPitaco?.principal) {
                        addToHistory({
                          matchLabel: `${match.strHomeTeam} vs ${match.strAwayTeam}`,
                          matchDate: match.dateEvent || new Date().toISOString().slice(0,10),
                          league: match.strLeague || 'Futebol',
                          tipLabel: traduzirTextoMercado(quickPitaco.principal),
                          category: 'result' as const,
                          probability: Math.round(quickPitaco.principalProb),
                          odds: 1.0, stake: 0, mode: 'simulado' as const,
                        });
                      }
                    } catch {}
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/12 px-3 py-2 text-xs font-black text-amber-200 transition hover:border-amber-300/60 hover:bg-amber-500/18"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {showQuickPitaco ? 'Atualizar pitaco' : 'Gerar pitaco'}
                </button>
              </div>

              {showQuickPitaco ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-2xl border border-amber-400/20 bg-slate-950/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Leitura principal</span>
                      <div className="flex items-center gap-2">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold', confidenceConfig[quickPitaco.confidence].bg, confidenceConfig[quickPitaco.confidence].color)}>
                          {confidenceConfig[quickPitaco.confidence].label}
                        </span>
                        {(() => {
                          const pid = `${label}-pitaco-principal`;
                          const inSlip = hasBet(pid);
                          return (
                            <button
                              onClick={() => {
                                if (inSlip) { removeBet(pid); }
                                else {
                                  addBet({ id: pid, matchId: label, matchLabel: label, tipLabel: traduzirTextoMercado(quickPitaco.principal), probability: Math.round(quickPitaco.principalProb), odds: Math.max(1.1, quickPitaco.principalProb > 0 ? Math.round((100 / quickPitaco.principalProb) * 10) / 10 : 2.0), category: 'result', confidence: quickPitaco.confidence, addedAt: Date.now() });
                                  toast.success('Adicionado ao bilhete!');
                                }
                              }}
                              className={cn('flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all',
                                inSlip ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                              )}>
                              {inSlip ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              {inSlip ? 'No bilhete' : '+ Bilhete'}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="mt-2 text-base font-semibold leading-relaxed text-white">{traduzirTextoMercado(quickPitaco.principal)}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Probabilidade estimada: <span className="font-bold text-amber-200">{formatPercent(quickPitaco.principalProb)}</span></span>
                      {(() => {
                        const pid = `${label}-pitaco-principal`;
                        const inSlip = hasBet(pid);
                        return (
                          <button onClick={() => inSlip ? removeBet(pid) : addBet({ id: pid, matchId: label, matchLabel: label, tipLabel: traduzirTextoMercado(quickPitaco.principal), probability: Math.round(quickPitaco.principalProb), odds: Math.max(1.1, Math.round((100/Math.max(1,quickPitaco.principalProb))*10)/10), category: 'result' as const, confidence: quickPitaco.confidence, addedAt: Date.now() })}
                            className={cn('flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all', inSlip ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20')}>
                            {inSlip ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            {inSlip ? 'No bilhete' : '+ Bilhete'}
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Conservadora</div>
                          <div className="text-[13px] font-semibold leading-snug text-slate-100">{traduzirTextoMercado(quickPitaco.conservative)}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-mono">{formatPercent(quickPitaco.conservativeProb)}</span>
                            {(() => { const pid=`${label}-cons`; const ins=hasBet(pid); return <button onClick={()=>{ins?removeBet(pid):addBet({id:pid,matchId:label,matchLabel:label,tipLabel:traduzirTextoMercado(quickPitaco.conservative),probability:Math.round(quickPitaco.conservativeProb),odds:Math.max(1.1,quickPitaco.conservativeProb>0?Math.round((100/quickPitaco.conservativeProb)*10)/10:2),category:'result',confidence:'medium',addedAt:Date.now()})}} className={cn('text-[10px] font-bold px-2 py-0.5 rounded border transition-all',ins?'bg-emerald-500/20 border-emerald-500/30 text-emerald-400':'bg-slate-700/40 border-slate-600/40 text-slate-400 hover:text-amber-300')}>{ins?'✓':'+Bilhete'}</button>;})()}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Placar provável</div>
                          <div className="text-[13px] font-semibold leading-snug text-slate-100">{quickPitaco.scoreline}</div>
                          <div className="mt-1 text-[11px] text-slate-500">Mais provável</div>
                        </div>
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 mb-1.5">Escanteios</div>
                          <div className="text-[13px] font-semibold leading-snug text-slate-100">{traduzirTextoMercado(quickPitaco.cornersPick)}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-mono">{formatPercent(quickPitaco.cornersProb)}</span>
                            {(() => { const pid=`${label}-esc`; const ins=hasBet(pid); return <button onClick={()=>{ins?removeBet(pid):addBet({id:pid,matchId:label,matchLabel:label,tipLabel:traduzirTextoMercado(quickPitaco.cornersPick),probability:Math.round(quickPitaco.cornersProb),odds:Math.max(1.1,quickPitaco.cornersProb>0?Math.round((100/quickPitaco.cornersProb)*10)/10:1.8),category:'corners',confidence:'medium',addedAt:Date.now()})}} className={cn('text-[10px] font-bold px-2 py-0.5 rounded border transition-all',ins?'bg-emerald-500/20 border-emerald-500/30 text-emerald-400':'bg-slate-700/40 border-slate-600/40 text-slate-400 hover:text-amber-300')}>{ins?'✓':'+Bilhete'}</button>;})()}
                          </div>
                        </div>
                        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-red-400/80 mb-1.5">Cartões</div>
                          <div className="text-[13px] font-semibold leading-snug text-slate-100">{traduzirTextoMercado(quickPitaco.cardsPick)}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-mono">{formatPercent(quickPitaco.cardsProb)}</span>
                            {(() => { const pid=`${label}-cart`; const ins=hasBet(pid); return <button onClick={()=>{ins?removeBet(pid):addBet({id:pid,matchId:label,matchLabel:label,tipLabel:traduzirTextoMercado(quickPitaco.cardsPick),probability:Math.round(quickPitaco.cardsProb),odds:Math.max(1.1,quickPitaco.cardsProb>0?Math.round((100/quickPitaco.cardsProb)*10)/10:1.8),category:'cards',confidence:'medium',addedAt:Date.now()})}} className={cn('text-[10px] font-bold px-2 py-0.5 rounded border transition-all',ins?'bg-emerald-500/20 border-emerald-500/30 text-emerald-400':'bg-slate-700/40 border-slate-600/40 text-slate-400 hover:text-amber-300')}>{ins?'✓':'+Bilhete'}</button>;})()}
                          </div>
                        </div>
                      </div>

                      {quickPitaco.notes.length > 0 && (
                        <div className="rounded-2xl border border-slate-700/60 bg-slate-950/35 p-4">
                          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Base do pitaco</div>
                          <div className="mt-2 space-y-1.5">
                            {quickPitaco.notes.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-300">
                                <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
                                <span>{traduzirTextoMercado(item)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Jogadores — chance de gol</div>
                      </div>
                      {quickPitaco.scorerHighlights.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {quickPitaco.scorerHighlights.map((player) => (
                            <div key={player.name} className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-3">
                              <div className="text-sm font-semibold text-slate-100">{player.name}</div>
                              <div className="mt-1 text-[11px] text-slate-500 truncate">{player.team}</div>
                              <div className="mt-2 flex items-center justify-between text-xs">
                                <span className="text-slate-500">Gol no jogo</span>
                                <span className="font-bold text-emerald-300">{formatPercent(player.goalProb)}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-xs">
                                <span className="text-slate-500">Gol nos próximos 15 min</span>
                                <span className="font-bold text-cyan-300">{formatPercent(player.next15Prob)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs leading-relaxed text-slate-500">Sem feed individual disponível para destacar jogadores nesta partida.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-slate-400">Clique em <span className="font-semibold text-amber-200">Gerar pitaco</span> para montar uma leitura objetiva do jogo com pick principal, opção conservadora e placar provável.</p>
              )}
            </div>
          </div>

          {(summary.warnings.length > 0 || matchProfile.keyFactors.length > 0) && (
            <div className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Radar do jogo</span>
                {summary.warnings.slice(0, 3).map((item, idx) => (
                  <span key={`warning-${idx}`} className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/8 px-2.5 py-1 text-xs text-amber-200">
                    <AlertTriangle className="h-3 w-3" />
                    {item}
                  </span>
                ))}
                {matchProfile.keyFactors.slice(0, 4).map((factor, idx) => (
                  <span key={`factor-${idx}`} className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-950/35 px-2.5 py-1 text-xs text-slate-300">
                    {factor}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== FLAT TABS ===== */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Central</span>
              <div className="h-px flex-1 bg-slate-800/60" />
            </div>
            <div className="tab-grid-pro">
              {PRIMARY_TABS.map(({ id, label: tabLabel, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all',
                    activeTab === id
                      ? 'border-blue-500/40 bg-blue-500/10 text-white'
                      : 'border-slate-800/80 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200',
                    id === 'live' && isLive ? 'border-red-500/30' : ''
                  )}
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0',
                    activeTab === id ? color : 'text-slate-500',
                    id === 'live' && isLive ? 'text-red-400 animate-pulse' : '',
                    id === 'dynamic' && isLive ? 'text-amber-400' : ''
                  )} />
                  <span className="text-[13px] font-semibold leading-tight truncate">{tabLabel}</span>
                  {((id === 'live' && isLive) || (id === 'dynamic' && isLive)) && (
                    <span className={cn('ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0', id === 'live' ? 'bg-red-500' : 'bg-amber-500', 'animate-pulse')} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Mercados</span>
              <div className="h-px flex-1 bg-slate-800/60" />
            </div>
            <div className="tab-grid-secondary">
              {MARKET_TABS.map(({ id, label: tabLabel, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-all',
                    activeTab === id
                      ? 'border-slate-500/50 bg-slate-800 text-white'
                      : 'border-slate-800/70 bg-slate-950/30 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', activeTab === id ? color : 'text-slate-600')} />
                  <span className="text-[12px] font-semibold whitespace-nowrap">{tabLabel}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div className="min-h-[200px]">
        {activeTab === 'live' && (
          <div className="space-y-4">
            <PressureFlowChart
              predictions={predictions}
              liveData={liveData}
              homeTeam={match.strHomeTeam}
              awayTeam={match.strAwayTeam}
            />
            <LiveMatchPanel match={match} />
          </div>
        )}

        {activeTab === 'dynamic' && (
          <div className="space-y-4">
            <GoalProbabilityMeter
              analysis={analysis}
              liveData={liveData}
            />
            {playersData && (
              <PlayerSuggestionsPanel
                playersData={playersData}
                homeTeamName={match.strHomeTeam}
                awayTeamName={match.strAwayTeam}
                isLive={isLive}
                compact
              />
            )}
            <DynamicSuggestionsPanel
              analysis={analysis}
              liveData={liveData}
              liveLoading={liveLoading}
            />
          </div>
        )}

        {/* ===== ABA JOGADORES ===== */}
        {activeTab === 'players' && (
          <div className="space-y-4">
            {/* Medidor de probabilidade de gol */}
            <GoalProbabilityMeter
              analysis={analysis}
              liveData={liveData}
            />
            {/* Sugestões de jogadores */}
            {playersLoading && !playersData && (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-purple-500/50 border-t-purple-500 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Carregando dados dos jogadores...</p>
              </div>
            )}
            {playersData && (
              <PlayerSuggestionsPanel
                playersData={playersData}
                homeTeamName={match.strHomeTeam}
                awayTeamName={match.strAwayTeam}
                isLive={isLive}
              />
            )}
            {!playersLoading && !playersData && (
              <div className="text-center py-8 text-slate-500 text-xs">
                Dados de jogadores não disponíveis para este jogo.
              </div>
            )}
            {/* Classificação da liga */}
            <div className="pt-4 border-t border-slate-700/30">
              <LeagueRankingsPanel
                leagueId={match.idLeague || match.espnLeagueId || ''}
                leagueName={match.strLeague}
                homePlayerNames={playersData?.homePlayers.map(p => p.name) ?? []}
                awayPlayerNames={playersData?.awayPlayers.map(p => p.name) ?? []}
              />
            </div>
          </div>
        )}

        {/* ===== ABA LINHA DO TEMPO ===== */}
        {activeTab === 'timeline' && (
          <div>
            {liveData ? (
              <LiveEventTimeline
                liveData={liveData}
                homeTeamName={match.strHomeTeam}
                awayTeamName={match.strAwayTeam}
              />
            ) : (
              <div className="text-center py-10">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  {isLive ? 'Carregando eventos ao vivo...' : 'Linha do tempo disponível apenas durante e após o jogo.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===== ABA ODDS Ao Vivo ===== */}
        {activeTab === 'live-odds' && (
          <div className="space-y-4">
            {syncedOdds && (
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300 font-bold">Feed sincronizado via webhook</div>
                    <div className="mt-1 text-xs text-slate-400">Fonte {traduzirFonteMercado(syncedOdds.provider || syncedOdds.source || 'Integração')} • recebido às {new Date(syncedOdds.receivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                  </div>
                  <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-200">
                    Atualização externa ativa
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <StatBox value={syncedOdds.homeOdds ?? '—'} label="Casa" color="text-cyan-200" />
                  <StatBox value={syncedOdds.drawOdds ?? '—'} label="Empate" color="text-slate-100" />
                  <StatBox value={syncedOdds.awayOdds ?? '—'} label="Visitante" color="text-cyan-200" />
                  <StatBox value={syncedOdds.over25Odds ?? '—'} label="Mais de 2,5" color="text-emerald-300" />
                </div>
              </div>
            )}
            {playersLoading && !playersData && !syncedOdds && (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-green-500/50 border-t-green-500 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Carregando odds...</p>
              </div>
            )}
            {liveOddsToDisplay ? (
              <OddsComparisonPanel
                odds={liveOddsToDisplay}
                analysis={analysis}
                isLive={isLive}
              />
            ) : !playersLoading && !syncedOddsLoading ? (
              <div className="text-center py-10">
                <DollarSign className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Cotações não disponíveis para este jogo.</p>
                <p className="text-xs text-slate-600 mt-1">Você pode alimentar o sistema pelo endpoint /api/webhooks/odds para sincronizar novas linhas.</p>
              </div>
            ) : null}
          </div>
        )}

        {/* ===== ABA MOVIMENTO DE ODDS ===== */}
        {activeTab === 'odds-history' && (
          <div>
            {oddsHistoryEntry ? (
              <OddsHistoryPanel
                entry={oddsHistoryEntry}
                homeTeam={match.strHomeTeam}
                awayTeam={match.strAwayTeam}
              />
            ) : (
              <div className="text-center py-10">
                <TrendingUp className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Nenhum histórico de odds registrado ainda.</p>
                <p className="text-xs text-slate-600 mt-1">
                  Abra a aba "Mercado ao vivo" ou envie snapshots pelo webhook para começar a registrar o histórico deste jogo.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tips' && (
          <div className="space-y-4">
            {recommendedSugestões.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-amber-400">Sugestões principais ({recommendedSugestões.length})</h3>
                </div>
                <div className="space-y-2">
                  {recommendedSugestões.map(tip => <TipCard key={tip.id} tip={tip} matchLabel={label} />)}
                </div>
              </div>
            )}
            {otherSugestões.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-400">Outras Opções ({otherSugestões.length})</h3>
                </div>
                <div className="space-y-2">
                  {otherSugestões.map(tip => <TipCard key={tip.id} tip={tip} matchLabel={label} />)}
                </div>
              </div>
            )}
            {tips.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Dados insuficientes para gerar sugestões</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'goals' && (
          <GoalsDetailPanel
            predictions={predictions}
            homeTeam={match.strHomeTeam}
            awayTeam={match.strAwayTeam}
            homeStats={homeTeamStats}
            awayStats={awayTeamStats}
            liveData={liveData}
          />
        )}

        {activeTab === 'corners' && (
          <CornersDetailPanel
            predictions={predictions}
            homeTeam={match.strHomeTeam}
            awayTeam={match.strAwayTeam}
            homeStats={homeTeamStats}
            awayStats={awayTeamStats}
            liveData={liveData}
          />
        )}

        {activeTab === 'cards' && (
          <CardsDetailPanel
            predictions={predictions}
            homeTeam={match.strHomeTeam}
            awayTeam={match.strAwayTeam}
            homeStats={homeTeamStats}
            awayStats={awayTeamStats}
            liveData={liveData}
          />
        )}

        {activeTab === 'scores' && (
          <ScoreGrid scores={scorePredictions} homeTeam={match.strHomeTeam} awayTeam={match.strAwayTeam} />
        )}

        {activeTab === 'handicap' && (
          <HandicapPanel predictions={predictions} homeTeam={match.strHomeTeam} awayTeam={match.strAwayTeam} />
        )}

        {activeTab === 'value' && (
          <ValueBetsPanel valueBets={valueBets} />
        )}

        {activeTab === 'odds' && (
          <OddsComparator
            predictions={predictions}
            homeTeam={match.strHomeTeam}
            awayTeam={match.strAwayTeam}
            marketOdds={marketOdds}
          />
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">{match.strHomeTeam} — Casa</h4>
              <TeamStatsPanel
                stats={homeTeamStats}
                isHome={true}
                headToHead={headToHead}
                homeTeam={match.strHomeTeam}
                awayTeam={match.strAwayTeam}
              />
            </div>
            <div className="border-t border-slate-700/30 pt-4">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">{match.strAwayTeam} — Visitante</h4>
              <TeamStatsPanel stats={awayTeamStats} isHome={false} />
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3">
        <p className="text-xs text-slate-600 text-center">
          Análise baseada em dados históricos via ESPN API. Dados ao vivo atualizados a cada 30s. Probabilidades calculadas com modelos de Poisson e Negativo Binomial. Não constitui garantia de resultado. Aposte com responsabilidade. +18.
        </p>
      </div>
    </div>
  );
}
