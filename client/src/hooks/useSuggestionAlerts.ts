// Rapha Guru — Suggestion Alerts Hook v2.0
// Detecta mudanças de confiança, movimentos fortes e virada de favorito durante o jogo

import React, { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { MatchAnalysis } from '@/lib/types';
import type { LiveMatchData } from './useLiveMatch';
import { deriveLiveProjection } from '@/lib/liveProjection';
import { usePushNotifications } from './usePushNotifications';
import { useFavorites } from '@/contexts/FavoritesContext';

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface SuggestionSnapshot {
  id: string;
  label: string;
  confidence: ConfidenceLevel;
  probability: number;
}

const CONFIDENCE_WEIGHT: Record<ConfidenceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

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

function calcOverProb(lambda: number, threshold: number): number {
  return Math.round((1 - poissonCumulative(lambda, Math.floor(threshold))) * 100);
}

function calcCurrentSuggestions(
  analysis: MatchAnalysis,
  liveData: LiveMatchData | null,
): SuggestionSnapshot[] {
  const { predictions, match } = analysis;
  const liveProjection = deriveLiveProjection(predictions, liveData);
  const isLive = liveData?.isLive ?? false;
  const minute = liveProjection?.displayMinute ?? 0;
  const homeScore = isLive ? parseInt(liveData!.homeScore) || 0 : 0;
  const awayScore = isLive ? parseInt(liveData!.awayScore) || 0 : 0;
  const currentGoals = homeScore + awayScore;
  const fractionRemaining = Math.max(0, 1 - minute / 90);

  const snapshots: SuggestionSnapshot[] = [];

  let over25Prob = liveProjection?.liveOver25Prob ?? predictions.over25Prob;
  if (isLive && !liveProjection && minute > 0) {
    const xGRem = predictions.expectedTotalGoals * fractionRemaining;
    const adjustedTotal = currentGoals + xGRem;
    over25Prob = currentGoals >= 3 ? 100 : calcOverProb(adjustedTotal, 2.5);
    if (currentGoals === 0 && minute >= 70) over25Prob = Math.min(over25Prob, 20);
  }
  snapshots.push({
    id: 'over25',
    label: 'Over 2.5 Gols',
    confidence: over25Prob >= 65 ? 'high' : over25Prob >= 45 ? 'medium' : 'low',
    probability: over25Prob,
  });

  const bttsProb = liveProjection?.liveBttsYesProb ?? predictions.bttsYesProb;
  snapshots.push({
    id: 'btts',
    label: 'Ambos Marcam',
    confidence: bttsProb >= 65 ? 'high' : bttsProb >= 45 ? 'medium' : 'low',
    probability: Math.round(bttsProb),
  });

  if (isLive && liveData) {
    const cornersProb = liveProjection?.liveOver85CornersProb ?? calcOverProb((liveData.homeStats.corners + liveData.awayStats.corners) + predictions.expectedCorners * fractionRemaining, 8.5);
    snapshots.push({
      id: 'over85corners',
      label: 'Over 8.5 Escanteios',
      confidence: cornersProb >= 65 ? 'high' : cornersProb >= 45 ? 'medium' : 'low',
      probability: Math.round(cornersProb),
    });
  }

  const homeWinLive = Math.round(liveProjection?.liveHomeWinProb ?? predictions.homeWinProb);
  const drawLive = Math.round(liveProjection?.liveDrawProb ?? predictions.drawProb);
  const awayWinLive = Math.round(liveProjection?.liveAwayWinProb ?? predictions.awayWinProb);
  const maxResultProb = Math.max(homeWinLive, drawLive, awayWinLive);
  const resultLabel = homeWinLive === maxResultProb
    ? `Vitória ${match.strHomeTeam}`
    : awayWinLive === maxResultProb
      ? `Vitória ${match.strAwayTeam}`
      : 'Empate';
  snapshots.push({
    id: 'result',
    label: resultLabel,
    confidence: maxResultProb >= 60 ? 'high' : maxResultProb >= 40 ? 'medium' : 'low',
    probability: maxResultProb,
  });

  return snapshots;
}

export function useSuggestionAlerts(
  analysis: MatchAnalysis | null,
  liveData: LiveMatchData | null,
  enabled: boolean = true,
) {
  const prevSnapshotsRef = useRef<Record<string, SuggestionSnapshot>>({});
  const matchIdRef = useRef<string>('');
  const favoriteSwingStateRef = useRef<Record<string, boolean>>({});
  const { sendNotification, isGranted } = usePushNotifications();
  const { isFavorite, hasAlerts } = useFavorites();

  useEffect(() => {
    if (!analysis || !liveData?.isLive || !enabled) return;

    const matchId = analysis.match.idEvent;
    const favoriteNotificationsEnabled = isFavorite(matchId) && hasAlerts(matchId);

    if (matchIdRef.current !== matchId) {
      prevSnapshotsRef.current = {};
      matchIdRef.current = matchId;
      favoriteSwingStateRef.current[matchId] = false;
    }

    const currentSnapshots = calcCurrentSuggestions(analysis, liveData);

    currentSnapshots.forEach((current) => {
      const prev = prevSnapshotsRef.current[current.id];
      if (!prev) {
        prevSnapshotsRef.current[current.id] = current;
        return;
      }

      const prevWeight = CONFIDENCE_WEIGHT[prev.confidence];
      const currWeight = CONFIDENCE_WEIGHT[current.confidence];
      const probDiff = current.probability - prev.probability;

      if (currWeight > prevWeight) {
        const confidenceLabel = current.confidence === 'high' ? 'Alta confiança' : 'Confiança média';
        toast.success(`📈 ${current.label}`, {
          description: `Subiu para ${confidenceLabel} (${current.probability}%) no minuto ${liveData.clock}`,
          duration: 8000,
        });
      }

      if (currWeight < prevWeight) {
        const confidenceLabel = current.confidence === 'medium' ? 'Confiança média' : 'Baixa confiança';
        toast.warning(`📉 ${current.label}`, {
          description: `Caiu para ${confidenceLabel} (${current.probability}%) no minuto ${liveData.clock}`,
          duration: 7000,
        });
      }

      if (currWeight === prevWeight && Math.abs(probDiff) >= 15) {
        toast.info(`${probDiff > 0 ? '⬆️' : '⬇️'} ${current.label}`, {
          description: `A probabilidade ${probDiff > 0 ? 'subiu' : 'caiu'} ${Math.abs(probDiff).toFixed(0)} pontos e está em ${current.probability}% no minuto ${liveData.clock}`,
          duration: 6000,
        });
      }

      if (current.probability === 100 && prev.probability < 100) {
        toast.success(`✅ Confirmarado: ${current.label}`, {
          description: `${analysis.match.strHomeTeam} x ${analysis.match.strAwayTeam}`,
          duration: 9000,
        });
      }

      prevSnapshotsRef.current[current.id] = current;
    });

    const liveProjection = deriveLiveProjection(analysis.predictions, liveData);
    if (!liveProjection) return;

    const preHome = analysis.predictions.homeWinProb;
    const preAway = analysis.predictions.awayWinProb;
    const preFavoriteSide = preHome === preAway ? null : preHome > preAway ? 'home' : 'away';
    const liveFavoriteSide = liveProjection.liveHomeWinProb === liveProjection.liveAwayWinProb
      ? null
      : liveProjection.liveHomeWinProb > liveProjection.liveAwayWinProb
        ? 'home'
        : 'away';

    if (!preFavoriteSide || !liveFavoriteSide) return;

    const flippedToUnderdog = preFavoriteSide !== liveFavoriteSide;
    const underdogLead = liveFavoriteSide === 'home'
      ? liveProjection.liveHomeWinProb - liveProjection.liveAwayWinProb
      : liveProjection.liveAwayWinProb - liveProjection.liveHomeWinProb;
    if (flippedToUnderdog && underdogLead >= 6 && !favoriteSwingStateRef.current[matchId]) {
      const teamName = liveFavoriteSide === 'home' ? analysis.match.strHomeTeam : analysis.match.strAwayTeam;
      const oldFavoriteName = preFavoriteSide === 'home' ? analysis.match.strHomeTeam : analysis.match.strAwayTeam;
      const newProb = liveFavoriteSide === 'home' ? liveProjection.liveHomeWinProb : liveProjection.liveAwayWinProb;

      favoriteSwingStateRef.current[matchId] = true;
      toast.warning('🚨 Inversão de favorito', {
        description: `${teamName} virou o cenário contra ${oldFavoriteName} e agora lidera a projeção com ${newProb.toFixed(1)}% no minuto ${liveProjection.displayMinute}.`,
        duration: 12000,
      });

      if (favoriteNotificationsEnabled && isGranted) {
        sendNotification({
          title: '🚨 Inversão de favorito',
          body: `${teamName} virou o cenário em ${analysis.match.strHomeTeam} x ${analysis.match.strAwayTeam} e agora é o lado mais provável.`,
          tag: `favorite-swing-${matchId}`,
          requireInteraction: true,
        });
      }
    }

    if (!flippedToUnderdog) {
      favoriteSwingStateRef.current[matchId] = false;
    }
  }, [analysis, liveData, enabled, hasAlerts, isFavorite, sendNotification, isGranted]);
}
