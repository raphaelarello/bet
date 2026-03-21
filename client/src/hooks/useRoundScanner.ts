import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Match, Predictions, TeamStats, AnalysisSummary, AnalysisMarketOdds, ValueBet } from '@/lib/types';
import { FEATURED_LEAGUES } from '@/lib/leagues';
import {
  getTeamHistoryESPN,
  getTeamLastEvents,
  calculateTeamStats,
  calculateH2H,
  calculatePredictions,
  buildAnalysisSummary,
  calculateValueBets,
  fetchMatchMarketOdds,
} from '@/lib/footballApi';

export interface OddsMovementSignal {
  strongestLabel: string;
  strongestDelta: number;
  strength: 'stable' | 'watch' | 'strong';
}

export interface RoundScanEntry {
  match: Match;
  predictions: Predictions;
  summary: AnalysisSummary;
  homeTeamStats: TeamStats;
  awayTeamStats: TeamStats;
  confidence: 'high' | 'medium' | 'low';
  marketOdds: AnalysisMarketOdds | null;
  valueBets: ValueBet[];
  liveState: 'pre' | 'live';
  goalsHeatScore: number;
  cornersHeatScore: number;
  cardsHeatScore: number;
  livePressureScore: number;
  topValueEdge: number;
  oddsMovement: OddsMovementSignal | null;
  scannedAt: number;
}

const FEATURED_LEAGUE_IDS = new Set(FEATURED_LEAGUES.map((league) => league.id));
const MAX_SCAN_MATCHES = 36;
const CONCURRENCY = 4;
const CACHE_TTL_MS = 3 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeMarketOdds(
  fetchedOdds: AnalysisMarketOdds | null,
  match: Match
): AnalysisMarketOdds | null {
  if (fetchedOdds) return fetchedOdds;

  if (match.espnHomeOdds && match.espnDrawOdds && match.espnAwayOdds) {
    return {
      provider: 'ESPN',
      homeWinOdds: match.espnHomeOdds,
      drawOdds: match.espnDrawOdds,
      awayWinOdds: match.espnAwayOdds,
      totalLine: null,
      overOdds: null,
      underOdds: null,
    };
  }

  return null;
}

function rankMatchForScanning(match: Match): number {
  let score = 0;
  if (match.strStatus === 'In Progress') score += 40;
  if (FEATURED_LEAGUE_IDS.has(match.idLeague || '')) score += 18;
  if (match.espnHomeTeamId && match.espnAwayTeamId) score += 12;
  if (match.strStatus !== 'Match Finished') score += 8;
  if (match.strTime) {
    const [hh = '0', mm = '0'] = match.strTime.split(':');
    score += Number(hh) * 0.2 + Number(mm) * 0.003;
  }
  return score;
}

function parseLiveMinute(clock?: string): number | null {
  if (!clock) return null;
  const normalized = String(clock).replace(/[^\d+]/g, '');
  if (!normalized) return null;
  if (normalized.includes('+')) {
    const [base, extra] = normalized.split('+');
    return Number(base || 0) + Number(extra || 0);
  }
  const minute = Number(normalized);
  return Number.isFinite(minute) ? minute : null;
}

function calculateHeatScores(predictions: Predictions, summary: AnalysisSummary, liveState: 'pre' | 'live') {
  const liveBoost = liveState === 'live' ? 6 : 0;

  const goalsHeatScore = Math.round(clamp(
    predictions.over25Prob * 0.52 +
      predictions.firstHalfOver05Prob * 0.14 +
      predictions.expectedTotalGoals * 8.5 +
      summary.decisionScore * 0.16 +
      liveBoost,
    0,
    100,
  ));

  const cornersHeatScore = Math.round(clamp(
    predictions.over85CornersProb * 0.5 +
      predictions.firstHalfOver45CornersProb * 0.16 +
      predictions.expectedCorners * 3.1 +
      summary.stabilityScore * 0.12 +
      liveBoost,
    0,
    100,
  ));

  const cardsHeatScore = Math.round(clamp(
    predictions.over35CardsProb * 0.56 +
      predictions.over45CardsProb * 0.14 +
      predictions.expectedCards * 5.3 +
      summary.marketAlignmentScore * 0.08 +
      liveBoost,
    0,
    100,
  ));

  return { goalsHeatScore, cornersHeatScore, cardsHeatScore };
}

function calculateLivePressureScore(
  match: Match,
  predictions: Predictions,
  summary: AnalysisSummary,
  goalsHeatScore: number,
  cornersHeatScore: number,
  cardsHeatScore: number,
) {
  if (match.strStatus !== 'In Progress') return 0;

  const minute = parseLiveMinute(match.liveDisplayClock);
  const minuteBoost = minute == null ? 8 : minute <= 25 ? 12 : minute <= 45 ? 18 : minute <= 70 ? 14 : 9;
  const firstHalfBias = minute != null && minute <= 45 ? predictions.firstHalfOver05Prob * 0.18 + predictions.firstHalfOver45CornersProb * 0.12 : 0;
  const secondHalfBias = minute != null && minute > 45 ? predictions.over25Prob * 0.12 + predictions.over85CornersProb * 0.08 : 0;

  return Math.round(clamp(
    goalsHeatScore * 0.34 +
      cornersHeatScore * 0.2 +
      cardsHeatScore * 0.08 +
      summary.decisionScore * 0.16 +
      firstHalfBias +
      secondHalfBias +
      minuteBoost,
    0,
    100,
  ));
}

function describeMovement(label: string) {
  switch (label) {
    case '1':
      return 'Mov. Casa';
    case 'X':
      return 'Mov. Empate';
    case '2':
      return 'Mov. Fora';
    case 'Over':
      return 'Mov. Over';
    case 'Under':
      return 'Mov. Under';
    default:
      return 'Mercado';
  }
}

function calculateOddsMovement(current: AnalysisMarketOdds | null, previous: AnalysisMarketOdds | null): OddsMovementSignal | null {
  if (!current || !previous) return null;

  const candidates: Array<{ label: string; current: number | null; previous: number | null }> = [
    { label: '1', current: current.homeWinOdds, previous: previous.homeWinOdds },
    { label: 'X', current: current.drawOdds, previous: previous.drawOdds },
    { label: '2', current: current.awayWinOdds, previous: previous.awayWinOdds },
    { label: 'Over', current: current.overOdds, previous: previous.overOdds },
    { label: 'Under', current: current.underOdds, previous: previous.underOdds },
  ];

  let strongestLabel = '';
  let strongestDelta = 0;

  candidates.forEach((candidate) => {
    if (!candidate.current || !candidate.previous || candidate.previous <= 0) return;
    const delta = Math.abs(((candidate.current - candidate.previous) / candidate.previous) * 100);
    if (delta > strongestDelta) {
      strongestDelta = delta;
      strongestLabel = candidate.label;
    }
  });

  if (!strongestLabel || strongestDelta < 1.2) return null;

  return {
    strongestLabel: describeMovement(strongestLabel),
    strongestDelta: Number(strongestDelta.toFixed(1)),
    strength: strongestDelta >= 7 ? 'strong' : strongestDelta >= 3 ? 'watch' : 'stable',
  };
}

async function scanSingleMatch(match: Match, previousMarketOdds: AnalysisMarketOdds | null = null): Promise<RoundScanEntry> {
  const hasESPNIds = !!(match.espnHomeTeamId && match.espnAwayTeamId);
  const effectiveLeagueId = match.espnLeagueId || match.idLeague || '';

  const [homeLastEvents, awayLastEvents, fetchedMarketOdds] = await Promise.all([
    hasESPNIds
      ? getTeamHistoryESPN(match.espnHomeTeamId!, match.espnLeagueId)
      : getTeamLastEvents(match.idHomeTeam || ''),
    hasESPNIds
      ? getTeamHistoryESPN(match.espnAwayTeamId!, match.espnLeagueId)
      : getTeamLastEvents(match.idAwayTeam || ''),
    fetchMatchMarketOdds(match.idEvent || ''),
  ]);

  const homeTeamStats = calculateTeamStats(
    match.idHomeTeam || match.espnHomeTeamId || '',
    match.strHomeTeam,
    homeLastEvents,
    effectiveLeagueId,
  );

  const awayTeamStats = calculateTeamStats(
    match.idAwayTeam || match.espnAwayTeamId || '',
    match.strAwayTeam,
    awayLastEvents,
    effectiveLeagueId,
  );

  const combinedHistory = [...homeLastEvents, ...awayLastEvents];
  const headToHead = calculateH2H(
    combinedHistory,
    match.idHomeTeam || match.espnHomeTeamId || '',
    match.idAwayTeam || match.espnAwayTeamId || '',
    match.strHomeTeam,
    match.strAwayTeam,
  );

  const predictions = calculatePredictions(homeTeamStats, awayTeamStats, true, effectiveLeagueId, headToHead);
  const marketOdds = normalizeMarketOdds(fetchedMarketOdds, match);
  const valueBets = calculateValueBets(predictions, match.strHomeTeam, match.strAwayTeam, marketOdds);
  const summary = buildAnalysisSummary(predictions, homeTeamStats, awayTeamStats, headToHead, valueBets, marketOdds);

  const avgDataQuality = (homeTeamStats.dataQuality + awayTeamStats.dataQuality) / 2;
  const effectiveQuality = avgDataQuality + (hasESPNIds ? 1 : 0) + (marketOdds ? 1 : 0);
  const confidence: RoundScanEntry['confidence'] =
    summary.decisionScore >= 74 || effectiveQuality >= 8 ? 'high' :
    summary.decisionScore >= 58 || effectiveQuality >= 5 ? 'medium' :
    'low';

  const liveState: RoundScanEntry['liveState'] = match.strStatus === 'In Progress' ? 'live' : 'pre';
  const { goalsHeatScore, cornersHeatScore, cardsHeatScore } = calculateHeatScores(predictions, summary, liveState);
  const livePressureScore = calculateLivePressureScore(match, predictions, summary, goalsHeatScore, cornersHeatScore, cardsHeatScore);
  const oddsMovement = calculateOddsMovement(marketOdds, previousMarketOdds);

  return {
    match,
    predictions,
    summary,
    homeTeamStats,
    awayTeamStats,
    confidence,
    marketOdds,
    valueBets,
    liveState,
    goalsHeatScore,
    cornersHeatScore,
    cardsHeatScore,
    livePressureScore,
    topValueEdge: valueBets[0]?.edge ?? 0,
    oddsMovement,
    scannedAt: Date.now(),
  };
}

export function useRoundScanner(matches: Match[]) {
  const cacheRef = useRef<Map<string, RoundScanEntry>>(new Map());
  const previousOddsRef = useRef<Map<string, AnalysisMarketOdds | null>>(new Map());
  const [entries, setEntries] = useState<RoundScanEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(0);

  const scanTargets = useMemo(() => {
    return [...matches]
      .filter((match) => match.strStatus !== 'Match Finished')
      .sort((a, b) => rankMatchForScanning(b) - rankMatchForScanning(a))
      .slice(0, MAX_SCAN_MATCHES);
  }, [matches]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (scanTargets.length === 0) {
        setEntries([]);
        setLoading(false);
        setCompleted(0);
        return;
      }

      setLoading(true);
      setCompleted(0);

      const initial = scanTargets
        .map((match) => cacheRef.current.get(match.idEvent))
        .filter((entry): entry is RoundScanEntry => Boolean(entry));

      if (!cancelled && initial.length > 0) {
        setEntries(initial);
        setCompleted(initial.length);
      } else if (!cancelled) {
        setEntries([]);
      }

      const now = Date.now();
      const queue = scanTargets.filter((match) => {
        const cached = cacheRef.current.get(match.idEvent);
        if (!cached) return true;
        if (match.strStatus === 'In Progress') return true;
        return now - cached.scannedAt > CACHE_TTL_MS;
      });

      if (queue.length === 0) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      let index = 0;

      async function worker() {
        while (!cancelled && index < queue.length) {
          const current = queue[index++];
          try {
            const previousMarketOdds = previousOddsRef.current.get(current.idEvent) ?? cacheRef.current.get(current.idEvent)?.marketOdds ?? null;
            const result = await scanSingleMatch(current, previousMarketOdds);
            cacheRef.current.set(current.idEvent, result);
            previousOddsRef.current.set(current.idEvent, result.marketOdds);
          } catch (error) {
            console.error('Erro ao escanear jogo da rodada:', current.idEvent, error);
          }

          if (!cancelled) {
            const nextEntries = scanTargets
              .map((match) => cacheRef.current.get(match.idEvent))
              .filter((entry): entry is RoundScanEntry => Boolean(entry));
            setEntries(nextEntries);
            setCompleted(nextEntries.length);
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(queue.length, 1)) }, () => worker()));

      if (!cancelled) {
        const finalEntries = scanTargets
          .map((match) => cacheRef.current.get(match.idEvent))
          .filter((entry): entry is RoundScanEntry => Boolean(entry));
        setEntries(finalEntries);
        setCompleted(finalEntries.length);
        setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [scanTargets]);

  return {
    entries,
    loading,
    completed,
    total: scanTargets.length,
  };
}
