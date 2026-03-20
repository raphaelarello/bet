// Rapha Guru — DynamicSuggestionsPanel v1.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Aba de Sugestões Dinâmicas: análise pré-jogo + atualização em tempo real durante a partida
// Combina dados históricos (casa/fora, forma, H2H) com estatísticas ao vivo

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { clampNumber, cn, formatDecimal, formatPercent, formatSignedPercentDelta, roundNumber, traduzirFonteMercado, traduzirTextoMercado } from '@/lib/utils';
import { deriveLiveProjection } from '@/lib/liveProjection';
import type { MatchAnalysis } from '@/lib/types';
import type { LiveMatchData } from '@/hooks/useLiveMatch';
import {
  TrendingUp, TrendingDown, Minus, Activity, Flag, CreditCard,
  Target, Zap, AlertTriangle, CheckCircle2, Clock, BarChart2,
  ArrowUp, ArrowDown, Flame, Shield, Star, RefreshCw,
} from 'lucide-react';

// ============================================================
// TIPOS INTERNOS
// ============================================================

interface DynamicSuggestion {
  id: string;
  category: 'goals' | 'corners' | 'cards' | 'result' | 'btts' | 'special';
  label: string;
  description: string;
  probability: number;
  confidence: 'high' | 'medium' | 'low';
  trend: 'up' | 'down' | 'stable';
  trendReason?: string;
  isLiveAdjusted: boolean;
  baseProb: number;  // probabilidade pré-jogo
  liveProb: number;  // probabilidade ajustada ao vivo
}

interface LiveScoreSuggestion {
  homeGoals: number;
  awayGoals: number;
  probability: number;
  label: string;
  isCurrentScore: boolean;
  isMostLikely: boolean;
  trend: 'up' | 'down' | 'stable';
  baseProbability: number; // probabilidade pré-jogo
}

interface LiveAdjustment {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  magnitude: number; // 0-1
}

// ============================================================
// HELPERS
// ============================================================

function poissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return Math.max(0, Math.min(1, p));
}

function poissonCumulative(lambda: number, maxK: number): number {
  let sum = 0;
  for (let k = 0; k <= maxK; k++) sum += poissonProb(lambda, k);
  return Math.min(1, sum);
}

function buildTrendReason(baseProb: number, liveProb: number) {
  const delta = roundNumber(liveProb - baseProb, 1);
  if (Math.abs(delta) < 1) return 'Variação pequena em relação ao pré-jogo.';
  return `${formatSignedPercentDelta(delta)} vs pré-jogo`;
}

// Calcula gols esperados restantes baseado no minuto e placar atual
function calcRemainingGoals(
  baseXG: number,
  currentGoals: number,
  minutePlayed: number,
  totalMinutes: number = 90
): { expectedRemaining: number; adjustedTotal: number } {
  const fractionPlayed = Math.min(minutePlayed / totalMinutes, 1);
  const fractionRemaining = 1 - fractionPlayed;
  
  // Gols esperados para o tempo restante (proporcional)
  const expectedRemaining = baseXG * fractionRemaining;
  
  // Total ajustado = gols já marcados + esperados restantes
  const adjustedTotal = currentGoals + expectedRemaining;
  
  return { expectedRemaining, adjustedTotal };
}

// Calcula probabilidade de Over X.5 com base nos gols restantes esperados
function calcOverProb(totalGoalsExpected: number, threshold: number): number {
  // P(total > threshold) = 1 - P(total <= threshold)
  // Usando Poisson com lambda = totalGoalsExpected
  return Math.round((1 - poissonCumulative(totalGoalsExpected, Math.floor(threshold))) * 100);
}

// Analisa momentum ao vivo baseado em estatísticas
function analyzeLiveMomentum(
  homeStats: LiveMatchData['homeStats'],
  awayStats: LiveMatchData['awayStats'],
  homeScore: number,
  awayScore: number,
  minute: number
): {
  dominantTeam: 'home' | 'away' | 'balanced';
  pressureIndex: number; // 0-100
  goalThreat: 'low' | 'medium' | 'high';
  adjustments: LiveAdjustment[];
} {
  const adjustments: LiveAdjustment[] = [];
  
  // Posse de bola
  const possessionDiff = homeStats.possession - awayStats.possession;
  if (Math.abs(possessionDiff) > 15) {
    const team = possessionDiff > 0 ? 'casa' : 'visitante';
    adjustments.push({
      factor: 'Posse de Bola',
      impact: possessionDiff > 0 ? 'positive' : 'negative',
      description: `${team} domina a posse (${Math.max(homeStats.possession, awayStats.possession).toFixed(0)}%)`,
      magnitude: Math.abs(possessionDiff) / 100,
    });
  }
  
  // Chutes a gol
  const shotsDiff = homeStats.shotsOnTarget - awayStats.shotsOnTarget;
  if (Math.abs(shotsDiff) >= 2) {
    const team = shotsDiff > 0 ? 'casa' : 'visitante';
    adjustments.push({
      factor: 'Chutes a Gol',
      impact: shotsDiff > 0 ? 'positive' : 'negative',
      description: `${team} com mais finalizações no alvo (${Math.max(homeStats.shotsOnTarget, awayStats.shotsOnTarget)})`,
      magnitude: Math.min(Math.abs(shotsDiff) / 10, 1),
    });
  }
  
  // Escanteios
  const cornersDiff = homeStats.corners - awayStats.corners;
  if (Math.abs(cornersDiff) >= 3) {
    const team = cornersDiff > 0 ? 'casa' : 'visitante';
    adjustments.push({
      factor: 'Escanteios',
      impact: cornersDiff > 0 ? 'positive' : 'negative',
      description: `${team} com muito mais escanteios (${Math.max(homeStats.corners, awayStats.corners)} vs ${Math.min(homeStats.corners, awayStats.corners)})`,
      magnitude: Math.min(Math.abs(cornersDiff) / 10, 1),
    });
  }
  
  // Cartões (indicador de jogo intenso)
  const totalCards = homeStats.yellowCards + awayStats.yellowCards + (homeStats.redCards + awayStats.redCards) * 2;
  if (totalCards >= 4) {
    adjustments.push({
      factor: 'Intensidade',
      impact: 'neutral',
      description: `Jogo muito disputado (${totalCards} cartões)`,
      magnitude: Math.min(totalCards / 10, 1),
    });
  }
  
  // Placar
  const scoreDiff = homeScore - awayScore;
  if (Math.abs(scoreDiff) >= 2) {
    const leader = scoreDiff > 0 ? 'casa' : 'visitante';
    const loser = scoreDiff > 0 ? 'visitante' : 'casa';
    adjustments.push({
      factor: 'Placar',
      impact: 'neutral',
      description: `${leader} vencendo por ${Math.abs(scoreDiff)} gols — ${loser} pode atacar mais`,
      magnitude: Math.min(Math.abs(scoreDiff) / 3, 1),
    });
  }
  
  // Determinar time dominante
  const homeScore2 = (possessionDiff > 0 ? 1 : 0) + (shotsDiff > 0 ? 1 : 0) + (cornersDiff > 0 ? 1 : 0);
  const awayScore2 = (possessionDiff < 0 ? 1 : 0) + (shotsDiff < 0 ? 1 : 0) + (cornersDiff < 0 ? 1 : 0);
  
  let dominantTeam: 'home' | 'away' | 'balanced' = 'balanced';
  if (homeScore2 > awayScore2 + 1) dominantTeam = 'home';
  else if (awayScore2 > homeScore2 + 1) dominantTeam = 'away';
  
  // Índice de pressão (0-100): baseado em chutes totais e escanteios
  const totalShots = homeStats.shots + awayStats.shots;
  const totalCorners = homeStats.corners + awayStats.corners;
  const pressureIndex = Math.min(
    ((totalShots / Math.max(minute, 1)) * 90 * 3 + (totalCorners / Math.max(minute, 1)) * 90 * 2) / 5,
    100
  );
  
  // Ameaça de gol
  const onTargetRate = totalShots > 0 ? (homeStats.shotsOnTarget + awayStats.shotsOnTarget) / totalShots : 0;
  let goalThreat: 'low' | 'medium' | 'high' = 'low';
  if (pressureIndex > 60 || onTargetRate > 0.4) goalThreat = 'high';
  else if (pressureIndex > 30 || onTargetRate > 0.25) goalThreat = 'medium';
  
  return { dominantTeam, pressureIndex, goalThreat, adjustments };
}

// ============================================================
// GERADOR DE PLACAR SUGERIDO Ao Vivo
// ============================================================

function generateLiveScoreSuggestions(
  analysis: MatchAnalysis,
  liveData: LiveMatchData | null
): LiveScoreSuggestion[] {
  const { predictions, match } = analysis;
  const isLive = liveData?.isLive ?? false;
  const minute = isLive ? parseInt(liveData!.clock) || 0 : 0;
  const currentHomeScore = isLive ? parseInt(liveData!.homeScore) || 0 : 0;
  const currentAwayScore = isLive ? parseInt(liveData!.awayScore) || 0 : 0;

  // xG restante baseado no minuto atual
  const fractionRemaining = isLive ? Math.max(0, 1 - minute / 90) : 1;
  const xGHomeRemaining = predictions.expectedGoalsHome * fractionRemaining;
  const xGAwayRemaining = predictions.expectedGoalsAway * fractionRemaining;

  // Gera combinações de placar final (placar atual + gols restantes)
  const scores: LiveScoreSuggestion[] = [];

  for (let addHome = 0; addHome <= 4; addHome++) {
    for (let addAway = 0; addAway <= 4; addAway++) {
      const finalHome = currentHomeScore + addHome;
      const finalAway = currentAwayScore + addAway;

      // Probabilidade de marcar exatamente addHome e addAway gols no tempo restante
      const probHome = poissonProb(xGHomeRemaining, addHome);
      const probAway = poissonProb(xGAwayRemaining, addAway);
      const prob = Math.round(probHome * probAway * 1000) / 10;

      if (prob < 0.5) continue;

      // Probabilidade pré-jogo do mesmo placar final
      const baseProbHome = poissonProb(predictions.expectedGoalsHome, finalHome);
      const baseProbAway = poissonProb(predictions.expectedGoalsAway, finalAway);
      const baseProb = Math.round(baseProbHome * baseProbAway * 1000) / 10;

      const trend: LiveScoreSuggestion['trend'] =
        prob > baseProb + 2 ? 'up' : prob < baseProb - 2 ? 'down' : 'stable';

      scores.push({
        homeGoals: finalHome,
        awayGoals: finalAway,
        probability: prob,
        label: `${finalHome} – ${finalAway}`,
        isCurrentScore: finalHome === currentHomeScore && finalAway === currentAwayScore,
        isMostLikely: false,
        trend,
        baseProbability: baseProb,
      });
    }
  }

  // Ordena por probabilidade e marca o mais provável
  scores.sort((a, b) => b.probability - a.probability);
  if (scores.length > 0) scores[0].isMostLikely = true;

  return scores.slice(0, 8);
}

// ============================================================
// GERADOR DE SUGESTÕES DINÂMICAS
// ============================================================

function generateDynamicSuggestions(
  analysis: MatchAnalysis,
  liveData: LiveMatchData | null
): DynamicSuggestion[] {
  const { predictions, homeTeamStats, awayTeamStats, match } = analysis;
  const suggestions: DynamicSuggestion[] = [];

  const liveProjection = deriveLiveProjection(predictions, liveData);
  const isLive = Boolean(liveProjection);
  const minute = liveProjection?.displayMinute ?? 0;
  const homeScore = liveProjection?.currentHomeGoals ?? 0;
  const awayScore = liveProjection?.currentAwayGoals ?? 0;

  const baseOver25 = predictions.over25Prob;
  const liveOver25 = liveProjection?.liveOver25Prob ?? baseOver25;
  const over25Trend: DynamicSuggestion['trend'] =
    liveOver25 > baseOver25 + 5 ? 'up' :
    liveOver25 < baseOver25 - 5 ? 'down' : 'stable';

  suggestions.push({
    id: 'over25',
    category: 'goals',
    label: 'Mais de 2,5 gols',
    description: isLive && liveProjection
      ? `${liveProjection.currentTotalGoals} gol(s) no min. ${minute}. Projeção final atual: ${formatDecimal(liveProjection.liveExpectedTotalGoals)} gols. ${liveProjection.goalPaceIndex >= 1.08 ? 'Pressão ofensiva acima do pré-jogo.' : liveProjection.goalPaceIndex <= 0.9 ? 'Ritmo ofensivo abaixo do esperado.' : 'Jogo dentro da faixa prevista.'}`
      : `Média de ${predictions.expectedTotalGoals.toFixed(1)} gols esperados. ${homeTeamStats.over25Rate > 0.5 ? 'Casa tem histórico de jogos com muitos gols.' : ''}`,
    probability: liveOver25,
    confidence: liveOver25 >= 65 ? 'high' : liveOver25 >= 45 ? 'medium' : 'low',
    trend: over25Trend,
    trendReason: isLive && over25Trend !== 'stable' ? buildTrendReason(baseOver25, liveOver25) : undefined,
    isLiveAdjusted: isLive,
    baseProb: baseOver25,
    liveProb: liveOver25,
  });

  const baseBtts = predictions.bttsYesProb;
  const liveBtts = liveProjection?.liveBttsYesProb ?? baseBtts;
  const bttsTrend: DynamicSuggestion['trend'] =
    liveBtts > baseBtts + 5 ? 'up' :
    liveBtts < baseBtts - 5 ? 'down' : 'stable';

  suggestions.push({
    id: 'btts',
    category: 'btts',
    label: 'Ambos Marcam — Sim',
    description: isLive && liveProjection
      ? (homeScore > 0 && awayScore > 0
          ? `✅ Já confirmado. O modelo agora foca no desfecho final a partir do placar ${homeScore}–${awayScore}.`
          : homeScore > 0
            ? `${match.strHomeTeam} já marcou. Chance atual de ${match.strAwayTeam} também marcar: ${formatPercent(liveProjection.liveAwayToScoreProb, { digits: 1 })}.`
            : awayScore > 0
              ? `${match.strAwayTeam} já marcou. Chance atual de ${match.strHomeTeam} também marcar: ${formatPercent(liveProjection.liveHomeToScoreProb, { digits: 1 })}.`
              : `Sem gols no min. ${minute}. Projeção de gols finais agora está em ${formatDecimal(liveProjection.liveExpectedTotalGoals)}.`)
      : `${match.strHomeTeam} marca em ${homeTeamStats.over05Rate > 0 ? Math.round(homeTeamStats.over05Rate * 100) : '?'}% dos jogos. ${match.strAwayTeam} em ${awayTeamStats.over05Rate > 0 ? Math.round(awayTeamStats.over05Rate * 100) : '?'}%.`,
    probability: liveBtts,
    confidence: liveBtts >= 65 ? 'high' : liveBtts >= 45 ? 'medium' : 'low',
    trend: bttsTrend,
    trendReason: isLive && bttsTrend !== 'stable' ? buildTrendReason(baseBtts, liveBtts) : undefined,
    isLiveAdjusted: isLive,
    baseProb: baseBtts,
    liveProb: liveBtts,
  });

  const baseOver85Corners = predictions.over85CornersProb;
  const liveOver85Corners = liveProjection?.liveOver85CornersProb ?? baseOver85Corners;
  const cornersTrend: DynamicSuggestion['trend'] =
    liveOver85Corners > baseOver85Corners + 5 ? 'up' :
    liveOver85Corners < baseOver85Corners - 5 ? 'down' : 'stable';

  suggestions.push({
    id: 'over85corners',
    category: 'corners',
    label: 'Mais de 8,5 escanteios',
    description: isLive && liveProjection
      ? `${liveProjection.currentTotalCorners} escanteio(s) no min. ${minute}. Projeção final atual: ${formatDecimal(liveProjection.liveExpectedTotalCorners, 1)}. Ritmo ${liveProjection.cornerPaceIndex >= 1.08 ? 'acima' : liveProjection.cornerPaceIndex <= 0.9 ? 'abaixo' : 'dentro'} do esperado.`
      : `Média de ${predictions.expectedCorners.toFixed(1)} escanteios esperados. Casa: ${predictions.expectedCornersHome.toFixed(1)}, Visitante: ${predictions.expectedCornersAway.toFixed(1)}.`,
    probability: liveOver85Corners,
    confidence: liveOver85Corners >= 65 ? 'high' : liveOver85Corners >= 45 ? 'medium' : 'low',
    trend: cornersTrend,
    trendReason: isLive && cornersTrend !== 'stable' ? buildTrendReason(baseOver85Corners, liveOver85Corners) : undefined,
    isLiveAdjusted: isLive,
    baseProb: baseOver85Corners,
    liveProb: liveOver85Corners,
  });

  const baseOver35Cards = predictions.over35CardsProb;
  const liveOver35Cards = liveProjection?.liveOver35CardsProb ?? baseOver35Cards;
  const cardsTrend: DynamicSuggestion['trend'] =
    liveOver35Cards > baseOver35Cards + 5 ? 'up' :
    liveOver35Cards < baseOver35Cards - 5 ? 'down' : 'stable';

  suggestions.push({
    id: 'over35cards',
    category: 'cards',
    label: 'Mais de 3,5 cartões',
    description: isLive && liveProjection
      ? `${liveProjection.currentTotalCards} cartão(ões) ponderados no min. ${minute}. Projeção final atual: ${formatDecimal(liveProjection.liveExpectedTotalCards, 1)}. Intensidade ${liveProjection.cardPaceIndex >= 1.08 ? 'acima' : liveProjection.cardPaceIndex <= 0.9 ? 'abaixo' : 'dentro'} do esperado.`
      : `Média de ${predictions.expectedCards.toFixed(1)} cartões esperados. Índice de agressividade: ${((homeTeamStats.aggressionIndex + awayTeamStats.aggressionIndex) / 2 * 100).toFixed(0)}%.`,
    probability: liveOver35Cards,
    confidence: liveOver35Cards >= 65 ? 'high' : liveOver35Cards >= 45 ? 'medium' : 'low',
    trend: cardsTrend,
    trendReason: isLive && cardsTrend !== 'stable' ? buildTrendReason(baseOver35Cards, liveOver35Cards) : undefined,
    isLiveAdjusted: isLive,
    baseProb: baseOver35Cards,
    liveProb: liveOver35Cards,
  });

  const homeWinLive = liveProjection?.liveHomeWinProb ?? predictions.homeWinProb;
  const drawLive = liveProjection?.liveDrawProb ?? predictions.drawProb;
  const awayWinLive = liveProjection?.liveAwayWinProb ?? predictions.awayWinProb;
  const maxProb = Math.max(homeWinLive, drawLive, awayWinLive);
  let resultLabel = '';
  let resultProb = 0;
  let resultDesc = '';
  let baseResultProb = predictions.drawProb;

  if (homeWinLive === maxProb) {
    resultLabel = `Vitória ${match.strHomeTeam}`;
    resultProb = homeWinLive;
    baseResultProb = predictions.homeWinProb;
    resultDesc = isLive && liveProjection
      ? `${match.strHomeTeam} agora aparece com ${formatPercent(homeWinLive, { digits: 1 })}. Projeção de gols da casa: ${formatDecimal(liveProjection.liveExpectedGoalsHome)}.`
      : `Casa com ${homeTeamStats.homeWinRate > 0 ? Math.round(homeTeamStats.homeWinRate * 100) : '?'}% de vitória em casa.`;
  } else if (awayWinLive === maxProb) {
    resultLabel = `Vitória ${match.strAwayTeam}`;
    resultProb = awayWinLive;
    baseResultProb = predictions.awayWinProb;
    resultDesc = isLive && liveProjection
      ? `${match.strAwayTeam} agora aparece com ${formatPercent(awayWinLive, { digits: 1 })}. Projeção de gols do visitante: ${formatDecimal(liveProjection.liveExpectedGoalsAway)}.`
      : `Visitante com ${awayTeamStats.awayWinRate > 0 ? Math.round(awayTeamStats.awayWinRate * 100) : '?'}% de vitória fora.`;
  } else {
    resultLabel = 'Empate';
    resultProb = drawLive;
    baseResultProb = predictions.drawProb;
    resultDesc = isLive && liveProjection
      ? `Placar atual ${homeScore}–${awayScore}. O modelo ainda mantém equilíbrio relevante para o desfecho.`
      : `Histórico de empates: casa ${Math.round(homeTeamStats.drawRate * 100)}%, visitante ${Math.round(awayTeamStats.drawRate * 100)}%.`;
  }

  const resultTrend: DynamicSuggestion['trend'] =
    resultProb > baseResultProb + 5 ? 'up' :
    resultProb < baseResultProb - 5 ? 'down' : 'stable';

  suggestions.push({
    id: 'result',
    category: 'result',
    label: resultLabel,
    description: resultDesc,
    probability: resultProb,
    confidence: resultProb >= 60 ? 'high' : resultProb >= 40 ? 'medium' : 'low',
    trend: resultTrend,
    trendReason: isLive && resultTrend !== 'stable' ? buildTrendReason(baseResultProb, resultProb) : undefined,
    isLiveAdjusted: isLive,
    baseProb: baseResultProb,
    liveProb: resultProb,
  });

  if (isLive && liveProjection && minute > 0 && minute < 85) {
    const nextGoalHome = clampNumber(
      (liveProjection.liveExpectedGoalsHome - liveProjection.currentHomeGoals) /
        Math.max((liveProjection.liveExpectedTotalGoals - liveProjection.currentTotalGoals), 0.01) * 100,
      5,
      95,
    );
    const nextGoalProb = Math.max(nextGoalHome, 100 - nextGoalHome);
    const nextGoalTeam = nextGoalHome >= 50 ? match.strHomeTeam : match.strAwayTeam;

    suggestions.push({
      id: 'next_goal',
      category: 'special',
      label: `Próximo Gol: ${nextGoalTeam}`,
      description: `Modelo ao vivo combina placar, minuto, finalizações, posse e escanteios. Pressão atual ${liveProjection.pressureIndex}/100.`,
      probability: roundNumber(nextGoalProb, 1),
      confidence: nextGoalProb >= 65 ? 'high' : 'medium',
      trend: 'stable',
      isLiveAdjusted: true,
      baseProb: 50,
      liveProb: roundNumber(nextGoalProb, 1),
    });
  }

  return suggestions.sort((a, b) => b.probability - a.probability);
}

// ============================================================
// SUB-COMPONENTES
// ============================================================

const categoryIcons: Record<string, React.ElementType> = {
  goals: TrendingUp,
  corners: Flag,
  cards: CreditCard,
  result: Target,
  btts: Activity,
  special: Star,
};

const categoryColors: Record<string, string> = {
  goals: 'text-emerald-400',
  corners: 'text-amber-400',
  cards: 'text-red-400',
  result: 'text-blue-400',
  btts: 'text-purple-400',
  special: 'text-yellow-400',
};

const categoryBg: Record<string, string> = {
  goals: 'bg-emerald-500/10',
  corners: 'bg-amber-500/10',
  cards: 'bg-red-500/10',
  result: 'bg-blue-500/10',
  btts: 'bg-purple-500/10',
  special: 'bg-yellow-500/10',
};

const confidenceConfig = {
  high: { label: 'Alta', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  medium: { label: 'Média', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  low: { label: 'Baixa', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
};

function TrendIcon({ trend }: { trend: DynamicSuggestion['trend'] }) {
  if (trend === 'up') return <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (trend === 'down') return <ArrowDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-500" />;
}

function ProbabilityMeter({ value, color = 'emerald' }: { value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };
  const barColor = colorMap[color] || 'bg-emerald-500';
  const safeValue = Math.max(0, Math.min(value, 100));

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${safeValue}%` }}
        />
      </div>
      <span className="text-xs font-bold font-mono text-slate-200 w-12 text-right">{formatPercent(value, { digits: 1 })}</span>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: DynamicSuggestion }) {
  const Icon = categoryIcons[suggestion.category] || Star;
  const iconColor = categoryColors[suggestion.category] || 'text-slate-400';
  const iconBg = categoryBg[suggestion.category] || 'bg-slate-700/50';
  const conf = confidenceConfig[suggestion.confidence];
  const probColor = suggestion.probability >= 65 ? 'emerald' : suggestion.probability >= 45 ? 'amber' : 'red';
  const delta = suggestion.liveProb - suggestion.baseProb;
  const showDelta = suggestion.isLiveAdjusted && Math.abs(delta) >= 1;

  return (
    <div className={cn(
      'rounded-xl border p-3 transition-all duration-300 shadow-[0_18px_50px_-34px_rgba(59,130,246,0.35)]',
      suggestion.isLiveAdjusted
        ? 'border-red-500/25 bg-[linear-gradient(135deg,rgba(239,68,68,0.08),rgba(15,23,42,0.82))]'
        : 'border-slate-700/50 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))]',
      suggestion.probability >= 65 && 'ring-1 ring-emerald-500/20 shadow-emerald-500/5'
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('p-2.5 rounded-xl flex-shrink-0 border border-white/5', iconBg)}>
            <Icon className={cn('w-4 h-4', iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-50 text-[15px] leading-tight">{suggestion.label}</span>
              {suggestion.isLiveAdjusted && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-red-300 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5">
                  <Activity className="w-3 h-3 animate-pulse" />
                  Atualizado ao vivo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{suggestion.description}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[88px]">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', conf.bg, conf.color)}>
            {conf.label}
          </span>
          <div className={cn(
            'text-lg font-black tabular-nums',
            suggestion.probability >= 65 ? 'text-emerald-300' : suggestion.probability >= 45 ? 'text-amber-300' : 'text-red-300'
          )}>
            {formatPercent(suggestion.probability, { digits: 1 })}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">probabilidade atual</div>
        </div>
      </div>

      <ProbabilityMeter value={suggestion.probability} color={probColor} />

      {suggestion.trendReason && (
        <div className="mt-3 rounded-xl border border-slate-700/40 bg-slate-950/30 px-3 py-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Leitura rápida:</span> {suggestion.trendReason}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 px-3 py-2">
          <div className="text-slate-500 uppercase tracking-[0.16em] mb-1">Pré-jogo</div>
          <div className="text-slate-200 font-semibold tabular-nums">{formatPercent(suggestion.baseProb, { digits: 1 })}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 px-3 py-2">
          <div className="text-slate-500 uppercase tracking-[0.16em] mb-1">Agora</div>
          <div className="text-slate-200 font-semibold tabular-nums">{formatPercent(suggestion.liveProb, { digits: 1 })}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 px-3 py-2">
          <div className="text-slate-500 uppercase tracking-[0.16em] mb-1">Variação</div>
          <div className={cn(
            'font-semibold tabular-nums flex items-center gap-1',
            delta > 0.5 ? 'text-emerald-300' : delta < -0.5 ? 'text-red-300' : 'text-slate-300'
          )}>
            {delta > 0.5 ? <ArrowUp className="w-3.5 h-3.5" /> : delta < -0.5 ? <ArrowDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {formatSignedPercentDelta(delta)}
          </div>
        </div>
      </div>

      {showDelta && (
        <div className={cn(
          'mt-3 rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-3',
          delta > 0
            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
            : 'border-red-500/20 bg-red-500/5 text-red-300'
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <TrendIcon trend={suggestion.trend} />
            <span className="truncate">
              {delta > 0 ? 'O mercado ganhou força em relação à leitura inicial.' : 'O mercado perdeu força em relação à leitura inicial.'}
            </span>
          </div>
          <span className="font-bold tabular-nums">{formatSignedPercentDelta(delta)}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PAINEL DE FATORES Ao Vivo
// ============================================================

function LiveFactorsPanel({ liveData, homeTeam, awayTeam }: {
  liveData: LiveMatchData;
  homeTeam: string;
  awayTeam: string;
}) {
  const minute = parseInt(liveData.clock) || 0;
  const homeScore = parseInt(liveData.homeScore) || 0;
  const awayScore = parseInt(liveData.awayScore) || 0;
  
  const momentum = analyzeLiveMomentum(
    liveData.homeStats,
    liveData.awayStats,
    homeScore,
    awayScore,
    minute
  );
  
  const dominantTeamName = momentum.dominantTeam === 'home' ? homeTeam : momentum.dominantTeam === 'away' ? awayTeam : 'Equilibrado';
  
  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-4 h-4 text-red-400 animate-pulse" />
        <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Análise em Tempo Real</h4>
        <span className="ml-auto text-xs text-slate-600 font-mono">min. {minute}'</span>
      </div>
      
      {/* Placar atual */}
      <div className="flex items-center justify-between bg-slate-900/40 rounded-lg p-3">
        <div className="text-center flex-1">
          <div className="text-xs text-slate-500 mb-1 truncate">{homeTeam}</div>
          <div className="text-3xl font-black text-slate-200 font-mono">{homeScore}</div>
        </div>
        <div className="text-center px-4">
          <div className="text-xs text-slate-600 font-mono">{minute}'</div>
          <div className="text-lg font-bold text-slate-600">–</div>
          <div className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            momentum.goalThreat === 'high' ? 'bg-red-500/20 text-red-400' :
            momentum.goalThreat === 'medium' ? 'bg-amber-500/20 text-amber-400' :
            'bg-slate-700/50 text-slate-500'
          )}>
            {momentum.goalThreat === 'high' ? '🔥 Alta' : momentum.goalThreat === 'medium' ? '⚡ Média' : '💤 Baixa'}
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="text-xs text-slate-500 mb-1 truncate">{awayTeam}</div>
          <div className="text-3xl font-black text-slate-200 font-mono">{awayScore}</div>
        </div>
      </div>
      
      {/* Estatísticas comparativas */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="text-center">
          <div className="text-slate-200 font-bold font-mono">{liveData.homeStats.possession.toFixed(0)}%</div>
          <div className="text-slate-600">Posse</div>
          <div className="text-slate-200 font-bold font-mono">{liveData.awayStats.possession.toFixed(0)}%</div>
        </div>
        <div className="text-center text-slate-500 flex flex-col justify-center">
          <div>Posse</div>
          <div>Chutes</div>
          <div>Escanteios</div>
        </div>
        <div className="text-center">
          <div className="text-slate-200 font-bold font-mono">{liveData.homeStats.shots}</div>
          <div className="text-slate-600">Chutes</div>
          <div className="text-slate-200 font-bold font-mono">{liveData.awayStats.shots}</div>
        </div>
      </div>
      
      {/* Dominância */}
      <div className="flex items-center gap-2 text-xs">
        <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-500">Dominando:</span>
        <span className={cn(
          'font-bold',
          momentum.dominantTeam === 'home' ? 'text-blue-400' :
          momentum.dominantTeam === 'away' ? 'text-amber-400' :
          'text-slate-400'
        )}>
          {dominantTeamName}
        </span>
        <span className="ml-auto text-slate-600">
          Pressão: {momentum.pressureIndex.toFixed(0)}/100
        </span>
      </div>
      
      {/* Fatores de ajuste */}
      {momentum.adjustments.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-700/30">
          <div className="text-xs text-slate-600 font-medium uppercase tracking-wider">Fatores de Ajuste</div>
          {momentum.adjustments.map((adj, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {adj.impact === 'positive' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : adj.impact === 'negative' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
              )}
              <span className="text-slate-400">{adj.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PAINEL DE PLACAR SUGERIDO Ao Vivo
// ============================================================

function LiveScorePanel({
  analysis,
  liveData,
}: {
  analysis: MatchAnalysis;
  liveData: LiveMatchData | null;
}) {
  const isLive = liveData?.isLive ?? false;
  const minute = isLive ? parseInt(liveData!.clock) || 0 : 0;
  const currentHomeScore = isLive ? parseInt(liveData!.homeScore) || 0 : 0;
  const currentAwayScore = isLive ? parseInt(liveData!.awayScore) || 0 : 0;

  const scoreSuggestions = useMemo(
    () => generateLiveScoreSuggestions(analysis, liveData),
    [analysis, liveData]
  );

  const topScore = scoreSuggestions[0];

  return (
    <div className="bg-slate-800/40 rounded-xl border border-amber-500/20 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Placares mais prováveis</h4>
          {isLive && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Ao Vivo
            </span>
          )}
        </div>
        {isLive && (
          <span className="text-xs text-slate-600 font-mono">min. {minute}'</span>
        )}
      </div>

      {/* Placar atual vs mais provável */}
      {isLive && topScore && (
        <div className="grid grid-cols-2 gap-3">
          {/* Placar atual */}
          <div className="bg-slate-900/50 rounded-xl p-3 text-center border border-slate-700/30">
            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Atual</div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-black text-slate-200 font-mono">{currentHomeScore}</span>
              <span className="text-slate-600 font-bold">–</span>
              <span className="text-2xl font-black text-slate-200 font-mono">{currentAwayScore}</span>
            </div>
            <div className="text-xs text-slate-600 mt-1 truncate">
              {analysis.match.strHomeTeam.split(' ')[0]} vs {analysis.match.strAwayTeam.split(' ')[0]}
            </div>
          </div>
          {/* Placar mais provável */}
          <div className="bg-amber-500/10 rounded-xl p-3 text-center border border-amber-500/30">
            <div className="text-xs text-amber-400 mb-1 uppercase tracking-wider font-bold">Mais Provável</div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-black text-amber-300 font-mono">{topScore.homeGoals}</span>
              <span className="text-amber-600 font-bold">–</span>
              <span className="text-2xl font-black text-amber-300 font-mono">{topScore.awayGoals}</span>
            </div>
            <div className="text-xs text-amber-500 mt-1 font-mono font-bold">{formatPercent(topScore.probability, { digits: 1 })}</div>
          </div>
        </div>
      )}

      {/* Placar mais provável pré-jogo (quando não ao vivo) */}
      {!isLive && topScore && (
        <div className="bg-amber-500/10 rounded-xl p-4 text-center border border-amber-500/30">
          <div className="text-xs text-amber-400 mb-2 uppercase tracking-wider font-bold">Placar Mais Provável</div>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1 truncate max-w-[80px]">{analysis.match.strHomeTeam.split(' ')[0]}</div>
              <span className="text-4xl font-black text-amber-300 font-mono">{topScore.homeGoals}</span>
            </div>
            <span className="text-amber-600 font-bold text-2xl">–</span>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1 truncate max-w-[80px]">{analysis.match.strAwayTeam.split(' ')[0]}</div>
              <span className="text-4xl font-black text-amber-300 font-mono">{topScore.awayGoals}</span>
            </div>
          </div>
          <div className="text-sm text-amber-500 mt-2 font-mono font-bold">{formatPercent(topScore.probability, { digits: 1 })} de probabilidade</div>
        </div>
      )}

      {/* Grade de placares possíveis */}
      <div className="space-y-1.5">
        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Mapa de placares</div>
        {scoreSuggestions.map((score, i) => (
          <div
            key={score.label}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 transition-all',
              score.isMostLikely
                ? 'bg-amber-500/10 border border-amber-500/30'
                : score.isCurrentScore
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'bg-slate-800/30 border border-slate-700/20'
            )}
          >
            {/* Rank */}
            <span className="text-xs text-slate-600 font-mono w-4 text-center">{i + 1}</span>

            {/* Placar */}
            <div className="flex items-center gap-2 flex-1">
              <span className={cn(
                'text-sm font-black font-mono',
                score.isMostLikely ? 'text-amber-300' : score.isCurrentScore ? 'text-blue-300' : 'text-slate-300'
              )}>
                {score.label}
              </span>
              {score.isMostLikely && (
                <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5">Mais provável</span>
              )}
              {score.isCurrentScore && !score.isMostLikely && (
                <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-1.5 py-0.5">Atual</span>
              )}
            </div>

            {/* Tendência vs pré-jogo */}
            {isLive && Math.abs(score.probability - score.baseProbability) >= 1 && (
              <div className={cn(
                'flex items-center gap-0.5 text-xs font-mono',
                score.trend === 'up' ? 'text-emerald-400' : score.trend === 'down' ? 'text-red-400' : 'text-slate-500'
              )}>
                {score.trend === 'up' ? <ArrowUp className="w-3 h-3" /> : score.trend === 'down' ? <ArrowDown className="w-3 h-3" /> : null}
                {score.trend !== 'stable' && formatSignedPercentDelta(score.probability - score.baseProbability)}
              </div>
            )}

            {/* Barra de probabilidade */}
            <div className="flex items-center gap-1.5 w-24">
              <div className="flex-1 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    score.isMostLikely ? 'bg-amber-500' : score.isCurrentScore ? 'bg-blue-500' : 'bg-slate-500'
                  )}
                  style={{ width: `${Math.min(score.probability / (scoreSuggestions[0]?.probability || 1) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-400 w-12 text-right">{formatPercent(score.probability, { digits: 1 })}</span>
            </div>
          </div>
        ))}
      </div>

      {isLive && (
        <p className="text-xs text-slate-600 text-center">
          Placares calculados com xG restante ({formatPercent(Math.max(0, (1 - minute / 90) * 100))} do jogo restante)
        </p>
      )}
    </div>
  );
}

// ============================================================
// PAINEL DE FORMA E HISTÓRICO
// ============================================================

function FormHistoryPanel({ analysis }: { analysis: MatchAnalysis }) {
  const { homeTeamStats, awayTeamStats, headToHead, match } = analysis;
  
  return (
    <div className="space-y-4">
      {/* Forma recente */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-3">
          <div className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-2">{match.strHomeTeam}</div>
          <div className="flex gap-1 mb-2">
            {homeTeamStats.form.slice(0, 5).map((r, i) => (
              <span key={i} className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                r === 'W' ? 'bg-emerald-500 text-white' :
                r === 'D' ? 'bg-slate-500 text-white' :
                'bg-red-500 text-white'
              )}>
                {r === 'W' ? 'V' : r === 'D' ? 'E' : 'D'}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>
              <span className="text-slate-600">Gols/jogo:</span>
              <span className="text-slate-300 font-mono ml-1">{homeTeamStats.avgGoalsScored.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-slate-600">Sofridos:</span>
              <span className="text-slate-300 font-mono ml-1">{homeTeamStats.avgGoalsConceded.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-slate-600">Casa V%:</span>
              <span className="text-emerald-400 font-mono ml-1">{Math.round(homeTeamStats.homeWinRate * 100)}%</span>
            </div>
            <div>
              <span className="text-slate-600">Ambos marcam:</span>
              <span className="text-purple-400 font-mono ml-1">{Math.round(homeTeamStats.bttsRate * 100)}%</span>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-3">
          <div className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-2">{match.strAwayTeam}</div>
          <div className="flex gap-1 mb-2">
            {awayTeamStats.form.slice(0, 5).map((r, i) => (
              <span key={i} className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                r === 'W' ? 'bg-emerald-500 text-white' :
                r === 'D' ? 'bg-slate-500 text-white' :
                'bg-red-500 text-white'
              )}>
                {r === 'W' ? 'V' : r === 'D' ? 'E' : 'D'}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>
              <span className="text-slate-600">Gols/jogo:</span>
              <span className="text-slate-300 font-mono ml-1">{awayTeamStats.avgGoalsScored.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-slate-600">Sofridos:</span>
              <span className="text-slate-300 font-mono ml-1">{awayTeamStats.avgGoalsConceded.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-slate-600">Fora V%:</span>
              <span className="text-emerald-400 font-mono ml-1">{Math.round(awayTeamStats.awayWinRate * 100)}%</span>
            </div>
            <div>
              <span className="text-slate-600">Ambos marcam:</span>
              <span className="text-purple-400 font-mono ml-1">{Math.round(awayTeamStats.bttsRate * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* H2H */}
      {headToHead.totalMatches > 0 && (
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-3">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">
            Histórico H2H ({headToHead.totalMatches} jogos)
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 text-center">
              <div className="text-lg font-black text-blue-400">{headToHead.homeWins}</div>
              <div className="text-xs text-slate-600">{match.strHomeTeam}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-lg font-black text-slate-400">{headToHead.draws}</div>
              <div className="text-xs text-slate-600">Empates</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-lg font-black text-amber-400">{headToHead.awayWins}</div>
              <div className="text-xs text-slate-600">{match.strAwayTeam}</div>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-slate-500">
            <span>Média gols: <span className="text-slate-300 font-mono">{headToHead.avgTotalGoals.toFixed(1)}</span></span>
            <span>Ambos marcam: <span className="text-purple-400 font-mono">{Math.round(headToHead.bttsRate * 100)}%</span></span>
            <span>Mais de 2,5: <span className="text-emerald-400 font-mono">{Math.round(headToHead.over25Rate * 100)}%</span></span>
          </div>
        </div>
      )}
      
      {/* Sequências */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {homeTeamStats.winStreak > 1 && (
          <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">{match.strHomeTeam}: {homeTeamStats.winStreak} vitórias seguidas</span>
          </div>
        )}
        {awayTeamStats.winStreak > 1 && (
          <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">{match.strAwayTeam}: {awayTeamStats.winStreak} vitórias seguidas</span>
          </div>
        )}
        {homeTeamStats.scoringStreak > 2 && (
          <div className="flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 rounded-lg p-2">
            <Target className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">{match.strHomeTeam}: marca há {homeTeamStats.scoringStreak} jogos</span>
          </div>
        )}
        {awayTeamStats.scoringStreak > 2 && (
          <div className="flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 rounded-lg p-2">
            <Target className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">{match.strAwayTeam}: marca há {awayTeamStats.scoringStreak} jogos</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

function LiveStatTile({
  label,
  homeValue,
  awayValue,
  suffix = '',
}: {
  label: string;
  homeValue: number;
  awayValue: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">{label}</div>
      <div className="flex items-center justify-between gap-3 text-sm font-semibold tabular-nums">
        <span className="text-blue-300">{homeValue}{suffix}</span>
        <span className="text-slate-600">—</span>
        <span className="text-amber-300">{awayValue}{suffix}</span>
      </div>
    </div>
  );
}

function buildProfessionalHeadline(analysis: MatchAnalysis, resultLabel?: string, marketLabel?: string) {
  const dominant = analysis.matchProfile.dominantTeam;
  const home = analysis.match.strHomeTeam;
  const away = analysis.match.strAwayTeam;
  const xg = analysis.predictions.expectedTotalGoals;

  if (analysis.matchProfile.type === 'defensive') {
    return {
      title: 'Jogo travado e de margem curta',
      subtitle: `A leitura-base aponta pouca produção ofensiva (${xg.toFixed(2)} xG total) e mais força para linhas de menos gols em linhas baixas.`,
    };
  }

  if (analysis.matchProfile.type === 'low-scoring') {
    return {
      title: dominant === 'home'
        ? `${home} favorito em cenário controlado`
        : dominant === 'away'
          ? `${away} favorito em cenário controlado`
          : 'Cenário controlado, sem cara de goleada',
      subtitle: `A projeção-base fica mais perto de 2 a 3 gols do que de um jogo totalmente aberto. Mercado principal: ${traduzirTextoMercado(marketLabel || analysis.summary.bestAngle)}.`,
    };
  }

  if (analysis.matchProfile.type === 'high-scoring') {
    return {
      title: 'Jogo aberto com boa produção ofensiva esperada',
      subtitle: `O modelo projeta volume forte na frente (${xg.toFixed(2)} xG total) e sustenta mercados pró-gols.`,
    };
  }

  if (analysis.matchProfile.type === 'aggressive') {
    return {
      title: 'Partida intensa, com fricção alta',
      subtitle: `Além do resultado, cartões e ritmo físico ganham peso nesta leitura. Resultado base: ${resultLabel || 'equilíbrio'}.`,
    };
  }

  return {
    title: resultLabel ? `${resultLabel} aparece como desfecho-base` : 'Leitura equilibrada do confronto',
    subtitle: `Mercado principal: ${traduzirTextoMercado(marketLabel || analysis.summary.bestAngle)}. Resultado e mercado foram separados para reduzir leitura ambígua.`,
  };
}

function ReadyGamePanel({
  analysis,
  liveData,
  suggestions,
}: {
  analysis: MatchAnalysis;
  liveData: LiveMatchData | null;
  suggestions: DynamicSuggestion[];
}) {
  const liveProjection = deriveLiveProjection(analysis.predictions, liveData);
  const isLive = Boolean(liveProjection);
  const minute = liveProjection?.displayMinute ?? 0;
  const topScore = generateLiveScoreSuggestions(analysis, liveData)[0];
  const resultSuggestion = suggestions.find((item) => item.category === 'result') ?? suggestions[0];
  const marketSuggestion = suggestions.find((item) => item.category !== 'result') ?? suggestions[0];
  const topChanges = [...suggestions]
    .filter((item) => item.isLiveAdjusted)
    .sort((a, b) => Math.abs(b.liveProb - b.baseProb) - Math.abs(a.liveProb - a.baseProb))
    .slice(0, 3);
  const currentHomeScore = liveProjection?.currentHomeGoals ?? (parseInt(liveData?.homeScore || '0') || 0);
  const currentAwayScore = liveProjection?.currentAwayGoals ?? (parseInt(liveData?.awayScore || '0') || 0);
  const liveCards = liveProjection?.currentTotalCards ?? (liveData
    ? liveData.homeStats.yellowCards + liveData.homeStats.redCards + liveData.awayStats.yellowCards + liveData.awayStats.redCards
    : 0);
  const headline = buildProfessionalHeadline(analysis, resultSuggestion?.label, marketSuggestion?.label);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 p-3">
      <div className="flex flex-col gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-300 uppercase tracking-[0.16em]">
              <Zap className="w-3.5 h-3.5" />
              Jogo pronto
            </span>
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]',
              isLive
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            )}>
              {isLive ? <Activity className="w-3.5 h-3.5 animate-pulse" /> : <Clock className="w-3.5 h-3.5" />}
              {isLive ? `Ao vivo • ${minute}'` : 'Pré-jogo'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 uppercase tracking-[0.16em]">
              <Shield className="w-3.5 h-3.5" />
              Índice de decisão {analysis.summary.decisionScore}
            </span>
            {liveProjection && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-300 uppercase tracking-[0.16em]">
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizado há {Math.max(0, liveProjection.freshnessSeconds)}s
              </span>
            )}
          </div>
          <h3 className="text-xl md:text-2xl font-black text-slate-50 leading-tight">
            {headline.title}
          </h3>
          <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
            {isLive && liveProjection
              ? `${analysis.match.strHomeTeam} ${currentHomeScore} x ${currentAwayScore} ${analysis.match.strAwayTeam}. ${headline.subtitle} Projeção ao vivo recalculada com minuto, placar, finalizações, posse e escanteios.`
              : headline.subtitle}
          </p>
          {liveProjection?.notes?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {liveProjection.notes.slice(0, 3).map((item, idx) => (
                <span key={idx} className="text-[11px] bg-slate-800/70 text-slate-300 px-2 py-1 rounded-full border border-slate-700/40">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">Mercado principal</div>
          <div className="text-3xl font-black text-emerald-300 tabular-nums">
            {marketSuggestion ? formatPercent(marketSuggestion.probability, { digits: 1 }) : formatPercent(analysis.predictions.over25Prob, { digits: 1 })}
          </div>
          <div className="text-sm text-slate-200 font-semibold mt-1">{traduzirTextoMercado(marketSuggestion?.label || analysis.summary.bestAngle)}</div>
          <div className="text-xs text-slate-500 mt-1">
            variação {marketSuggestion ? formatSignedPercentDelta(marketSuggestion.liveProb - marketSuggestion.baseProb) : '—'}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/35 p-2.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">Resultado provável</div>
          <div className="text-sm font-bold text-slate-100">{resultSuggestion?.label || '—'}</div>
          <div className="text-xs text-slate-400 mt-1">{formatPercent(resultSuggestion?.probability, { digits: 1 })} de chance • leitura separada do mercado principal</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/35 p-2.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">Placar provável</div>
          <div className="text-sm font-bold text-slate-100">{topScore?.label || '—'}</div>
          <div className="text-xs text-slate-400 mt-1">{topScore ? formatPercent(topScore.probability, { digits: 1 }) : '—'}</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/35 p-2.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">Melhor ângulo</div>
          <div className="text-sm font-bold text-slate-100">{traduzirTextoMercado(analysis.summary.bestAngle)}</div>
          <div className="text-xs text-slate-400 mt-1">Mercado sugerido de forma coerente com o cenário do jogo • qualidade {analysis.summary.dataQualityScore}/100</div>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/35 p-2.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">Mercado</div>
          <div className="text-sm font-bold text-slate-100">{traduzirFonteMercado(analysis.marketOdds?.provider || 'Modelo interno')}</div>
          <div className="text-xs text-slate-400 mt-1">Alinhamento {analysis.summary.marketAlignmentScore}/100</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1  gap-3">
        <div className="rounded-2xl border border-slate-700/40 bg-slate-900/35 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-blue-300" />
            <div>
              <div className="text-sm font-bold text-slate-100">Atualização das estatísticas</div>
              <div className="text-xs text-slate-500">Painel executivo com estatística atual e projeção final recalculada.</div>
            </div>
          </div>

          {isLive && liveData && liveProjection ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-700/40 bg-slate-950/45 p-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 mb-1">Placar atual</div>
                  <div className="text-lg font-black text-slate-50 tabular-nums">
                    {analysis.match.strHomeTeam} {currentHomeScore} x {currentAwayScore} {analysis.match.strAwayTeam}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 mb-1">Pressão do jogo</div>
                  <div className="text-lg font-black text-cyan-300 tabular-nums">{liveProjection.pressureIndex}/100</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <LiveStatTile label="Posse" homeValue={Math.round(liveData.homeStats.possession)} awayValue={Math.round(liveData.awayStats.possession)} suffix="%" />
                <LiveStatTile label="Chutes" homeValue={liveData.homeStats.shots} awayValue={liveData.awayStats.shots} />
                <LiveStatTile label="Escanteios" homeValue={liveData.homeStats.corners} awayValue={liveData.awayStats.corners} />
                <LiveStatTile label="Cartões" homeValue={liveData.homeStats.yellowCards + liveData.homeStats.redCards} awayValue={liveData.awayStats.yellowCards + liveData.awayStats.redCards} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Gols finais projetados</div>
                  <div className="text-lg font-black text-emerald-300">{formatDecimal(liveProjection.liveExpectedTotalGoals)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">pré-jogo {formatDecimal(analysis.predictions.expectedTotalGoals)}</div>
                </div>
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Escanteios finais</div>
                  <div className="text-lg font-black text-amber-300">{formatDecimal(liveProjection.liveExpectedTotalCorners, 1)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">pré-jogo {formatDecimal(analysis.predictions.expectedCorners, 1)}</div>
                </div>
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Cartões finais</div>
                  <div className="text-lg font-black text-red-300">{formatDecimal(liveProjection.liveExpectedTotalCards, 1)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">pré-jogo {formatDecimal(analysis.predictions.expectedCards, 1)}</div>
                </div>
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Gol até o intervalo</div>
                  <div className="text-lg font-black text-blue-300">{liveProjection.isFirstHalfOpen ? formatPercent(liveProjection.liveFirstHalfGoalProb, { digits: 1 }) : 'Fechado'}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{liveProjection.isFirstHalfOpen ? `projeção Intervalo ${formatDecimal(liveProjection.liveExpectedFirstHalfGoals)}` : 'mercado de 1º tempo encerrado'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Gols esperados</div>
                <div className="text-lg font-black text-emerald-300">{formatDecimal(analysis.predictions.expectedTotalGoals)}</div>
              </div>
              <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Escanteios</div>
                <div className="text-lg font-black text-amber-300">{formatDecimal(analysis.predictions.expectedCorners, 1)}</div>
              </div>
              <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Cartões</div>
                <div className="text-lg font-black text-red-300">{formatDecimal(analysis.predictions.expectedCards, 1)}</div>
              </div>
              <div className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Gol no HT</div>
                <div className="text-lg font-black text-blue-300">{formatPercent(analysis.predictions.firstHalfGoalProb, { digits: 1 })}</div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700/40 bg-slate-900/35 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-300" />
            <div>
              <div className="text-sm font-bold text-slate-100">Mudanças de probabilidades</div>
              <div className="text-xs text-slate-500">Mostra o que mais mudou desde a leitura pré-jogo.</div>
            </div>
          </div>

          <div className="space-y-2">
            {(topChanges.length > 0 ? topChanges : suggestions.slice(0, 3)).map((item) => {
              const delta = item.liveProb - item.baseProb;
              return (
                <div key={item.id} className="rounded-xl border border-slate-700/40 bg-slate-950/35 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">{item.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        pré-jogo {formatPercent(item.baseProb, { digits: 1 })} → agora {formatPercent(item.liveProb, { digits: 1 })}
                      </div>
                    </div>
                    <div className={cn(
                      'text-sm font-black tabular-nums',
                      delta > 0.5 ? 'text-emerald-300' : delta < -0.5 ? 'text-red-300' : 'text-slate-300'
                    )}>
                      {formatSignedPercentDelta(delta)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


interface DynamicSuggestionsPanelProps {
  analysis: MatchAnalysis;
  liveData: LiveMatchData | null;
  liveLoading?: boolean;
}

export function DynamicSuggestionsPanel({ analysis, liveData, liveLoading }: DynamicSuggestionsPanelProps) {
  const isLive = liveData?.isLive ?? false;
  const isFinished = liveData?.isFinished ?? false;

  const suggestions = useMemo(
    () => generateDynamicSuggestions(analysis, liveData),
    [analysis, liveData]
  );

  const liveAdjustedCount = suggestions.filter(s => s.isLiveAdjusted).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-base font-black text-amber-300">Sugestões profissionais</h3>
          {isLive && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Ao Vivo
            </span>
          )}
          {isFinished && (
            <span className="text-xs font-bold text-slate-500 bg-slate-700/50 border border-slate-600/30 rounded-full px-2 py-0.5">
              Encerrado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {isLive && liveAdjustedCount > 0 && (
            <div className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-amber-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>{liveAdjustedCount} ajustes ao vivo</span>
            </div>
          )}
          <div className="rounded-full border border-slate-700/40 bg-slate-900/20 px-2.5 py-1">
            Índice de decisão {analysis.summary.decisionScore}
          </div>
        </div>
      </div>

      <ReadyGamePanel analysis={analysis} liveData={liveData} suggestions={suggestions} />

      {isLive && liveData && (
        <LiveFactorsPanel
          liveData={liveData}
          homeTeam={analysis.match.strHomeTeam}
          awayTeam={analysis.match.strAwayTeam}
        />
      )}

      {liveLoading && !liveData && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Buscando dados ao vivo...</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold text-slate-300">Sugestões principais</div>
            <div className="text-[11px] text-slate-600">
              {isLive
                ? `Probabilidades recalculadas no minuto ${parseInt(liveData?.clock || '0') || '?'} com base em placar, ritmo e estatísticas de jogo.`
                : 'Leitura pré-jogo pronta para execução, ordenada pela relevância atual do mercado.'}
            </div>
          </div>
        </div>
        {suggestions.map(suggestion => (
          <SuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </div>

      <div className="border-t border-slate-700/30 pt-4">
        <LiveScorePanel analysis={analysis} liveData={liveData} />
      </div>

      <div className="border-t border-slate-700/30 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-slate-500" />
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Base Histórica</h4>
        </div>
        <FormHistoryPanel analysis={analysis} />
      </div>

      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3">
        <p className="text-xs text-slate-500 text-center leading-relaxed">
          Sugestões calculadas com distribuição de Poisson, ajuste bayesiano e leitura contextual em tempo real.
          {isLive ? ' Atualização automática a cada 30s durante o jogo.' : ' Leitura baseada no histórico recente, qualidade de dados e alinhamento com mercado.'}
          {' '}Use como apoio de decisão, não como garantia de resultado.
        </p>
      </div>
    </div>
  );
}
