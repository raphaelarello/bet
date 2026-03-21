// Rapha Guru — Match Analysis Hook v5.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Integra ESPN API (histórico + odds) + TheSportsDB + football-data.org

import React, { useState, useCallback } from 'react';
import {
  getTeamLastEvents,
  getTeamHistoryESPN,
  calculateTeamStats,
  calculateH2H,
  calculatePredictions,
  calculateScorePredictions,
  calculateMatchProfile,
  calculateValueBets,
  generateTips,
  fetchMatchMarketOdds,
  buildAnalysisSummary,
} from '@/lib/footballApi';
import {
  enrichMatchData,
  applyEnrichmentToXG,
  getFDOApiKey,
  getSupportedLeaguesFDO,
} from '@/lib/footballDataOrg';
import type { Match, MatchAnalysis, Predictions, AnalysisMarketOdds } from '@/lib/types';

function normalize1X2(predictions: Predictions): Predictions {
  const total = predictions.homeWinProb + predictions.drawProb + predictions.awayWinProb;
  if (total <= 0) return predictions;

  return {
    ...predictions,
    homeWinProb: Math.round((predictions.homeWinProb / total) * 1000) / 10,
    drawProb: Math.round((predictions.drawProb / total) * 1000) / 10,
    awayWinProb: Math.round((predictions.awayWinProb / total) * 1000) / 10,
  };
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

function blendWithMarket(predictions: Predictions, marketOdds: AnalysisMarketOdds | null): Predictions {
  if (!marketOdds?.homeWinOdds || !marketOdds?.drawOdds || !marketOdds?.awayWinOdds) {
    return normalize1X2(predictions);
  }

  const impliedHome = 1 / marketOdds.homeWinOdds;
  const impliedDraw = 1 / marketOdds.drawOdds;
  const impliedAway = 1 / marketOdds.awayWinOdds;
  const totalImplied = impliedHome + impliedDraw + impliedAway;
  if (totalImplied <= 0) return normalize1X2(predictions);

  const marketHome = (impliedHome / totalImplied) * 100;
  const marketDraw = (impliedDraw / totalImplied) * 100;
  const marketAway = (impliedAway / totalImplied) * 100;

  const blended: Predictions = {
    ...predictions,
    // ── 1X2: blend 68% modelo + 32% mercado ──────────────────────────────
    homeWinProb: predictions.homeWinProb * 0.68 + marketHome * 0.32,
    drawProb:    predictions.drawProb    * 0.68 + marketDraw * 0.32,
    awayWinProb: predictions.awayWinProb * 0.68 + marketAway * 0.32,
  };

  // ── Over/Under de gols: calibra com a linha e odds do mercado ────────────
  // Quando temos totalLine + overOdds + underOdds, recalculamos o xG implícito
  // do mercado e blendamos com o nosso expectedTotalGoals (25% mercado).
  if (
    marketOdds.totalLine != null &&
    marketOdds.overOdds != null &&
    marketOdds.underOdds != null &&
    marketOdds.overOdds > 1 &&
    marketOdds.underOdds > 1
  ) {
    const impliedOver  = 1 / marketOdds.overOdds;
    const impliedUnder = 1 / marketOdds.underOdds;
    const vigSum = impliedOver + impliedUnder;

    // Remove o vig para obter a probabilidade de over "justa"
    const fairOverProb = vigSum > 0 ? (impliedOver / vigSum) * 100 : null;

    if (fairOverProb !== null) {
      const line = marketOdds.totalLine;
      // Blend over25Prob com a fair prob do mercado quando a linha é 2.5
      if (Math.abs(line - 2.5) < 0.1) {
        blended.over25Prob = predictions.over25Prob * 0.75 + fairOverProb * 0.25;
        blended.under25Prob = 100 - blended.over25Prob;
      } else if (Math.abs(line - 1.5) < 0.1) {
        blended.over15Prob = predictions.over15Prob * 0.75 + fairOverProb * 0.25;
      } else if (Math.abs(line - 3.5) < 0.1) {
        blended.over35Prob = predictions.over35Prob * 0.75 + fairOverProb * 0.25;
        blended.under35Prob = 100 - blended.over35Prob;
      }

      // xG implícito do mercado: usa a linha como proxy do xG esperado
      // (a linha de over/under é quase sempre o xG total esperado pela casa)
      const marketXGTotal = line;
      const marketXGBlend = 0.20; // 20% do mercado
      const blendedXGTotal = predictions.expectedTotalGoals * (1 - marketXGBlend) + marketXGTotal * marketXGBlend;
      const ratio = blendedXGTotal / Math.max(predictions.expectedTotalGoals, 0.01);
      blended.expectedTotalGoals  = Math.round(blendedXGTotal * 100) / 100;
      blended.expectedGoalsHome   = Math.round(predictions.expectedGoalsHome * ratio * 100) / 100;
      blended.expectedGoalsAway   = Math.round(predictions.expectedGoalsAway * ratio * 100) / 100;
    }
  }

  return normalize1X2(blended);
}

function applyTipValueFlags(
  tips: MatchAnalysis['tips'],
  valueBets: MatchAnalysis['valueBets']
): MatchAnalysis['tips'] {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

  return tips.map((tip) => {
    const matched = valueBets.find((bet) => {
      const betMarket = normalize(bet.market);
      const tipLabel = normalize(tip.label);
      return betMarket === tipLabel || betMarket.includes(tipLabel) || tipLabel.includes(betMarket);
    });

    if (!matched) return tip;

    return {
      ...tip,
      isValueBet: true,
      valueEdge: matched.edge,
      isRecommended: true,
      confidence: matched.confidence === 'high' ? 'high' : tip.confidence,
    };
  }).sort((a, b) => {
    if (a.isValueBet && !b.isValueBet) return -1;
    if (!a.isValueBet && b.isValueBet) return 1;
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return b.probability - a.probability;
  });
}

export function useMatchAnalysis() {
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichmentSource, setEnrichmentSource] = useState<'football-data.org' | 'estimated' | null>(null);

  const analyzeMatch = useCallback(async (match: Match) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    const token = localStorage.getItem('rg_auth_token');
    if (token) {
      fetch('/api/usage/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'analysis',
          meta: { match: `${match.strHomeTeam} vs ${match.strAwayTeam}`, league: match.strLeague },
        }),
      }).catch(() => undefined);
    }

    try {
      const leagueId = match.idLeague || match.espnLeagueId || '';
      const hasESPNIds = !!(match.espnHomeTeamId && match.espnAwayTeamId);
      const apiKey = getFDOApiKey();
      const isLeagueSupported = getSupportedLeaguesFDO().includes(leagueId);

      const [homeLastEvents, awayLastEvents, enrichment, fetchedMarketOdds] = await Promise.all([
        hasESPNIds
          ? getTeamHistoryESPN(match.espnHomeTeamId!, match.espnLeagueId)
          : getTeamLastEvents(match.idHomeTeam || ''),
        hasESPNIds
          ? getTeamHistoryESPN(match.espnAwayTeamId!, match.espnLeagueId)
          : getTeamLastEvents(match.idAwayTeam || ''),
        isLeagueSupported && apiKey
          ? enrichMatchData(match.strHomeTeam, match.strAwayTeam, leagueId, apiKey)
          : Promise.resolve({ homeTeam: null, awayTeam: null, source: 'estimated' as const, lastUpdated: Date.now() }),
        fetchMatchMarketOdds(match.idEvent || ''),
      ]);

      setEnrichmentSource(enrichment.source);
      const marketOdds = normalizeMarketOdds(fetchedMarketOdds, match);

      const effectiveLeagueId = match.espnLeagueId || leagueId;

      const homeTeamStats = calculateTeamStats(
        match.idHomeTeam || match.espnHomeTeamId || '',
        match.strHomeTeam,
        homeLastEvents,
        effectiveLeagueId
      );

      const awayTeamStats = calculateTeamStats(
        match.idAwayTeam || match.espnAwayTeamId || '',
        match.strAwayTeam,
        awayLastEvents,
        effectiveLeagueId
      );

      const combinedHistory = [...homeLastEvents, ...awayLastEvents];
      const headToHead = calculateH2H(
        combinedHistory,
        match.idHomeTeam || match.espnHomeTeamId || '',
        match.idAwayTeam || match.espnAwayTeamId || '',
        match.strHomeTeam,
        match.strAwayTeam,
      );

      const basePredictions = calculatePredictions(homeTeamStats, awayTeamStats, true, effectiveLeagueId, headToHead);
      const enrichedXG = applyEnrichmentToXG(
        basePredictions.expectedGoalsHome,
        basePredictions.expectedGoalsAway,
        enrichment
      );

      let predictions = basePredictions;
      if (
        enrichment.source === 'football-data.org' &&
        (Math.abs(enrichedXG.xGHome - basePredictions.expectedGoalsHome) > 0.05 ||
          Math.abs(enrichedXG.xGAway - basePredictions.expectedGoalsAway) > 0.05)
      ) {
        const enrichedHomeStats = {
          ...homeTeamStats,
          avgGoalsScored: enrichedXG.xGHome,
          avgGoalsScoredHome: enrichedXG.xGHome * 1.1,
          avgGoalsScoredAway: enrichedXG.xGHome * 0.9,
          // Injeta corners reais do FDO quando disponíveis (matchesWithStats > 3)
          ...(enrichedXG.cornersHome > 0 && {
            avgCornersFor: enrichedXG.cornersHome,
            avgCornersForHome: enrichedXG.cornersHome * 1.08,
            avgCornersForAway: enrichedXG.cornersHome * 0.92,
          }),
          // Injeta posse real do FDO
          ...(enrichedXG.possessionHome > 0 && {
            avgPossession: enrichedXG.possessionHome,
          }),
        };
        const enrichedAwayStats = {
          ...awayTeamStats,
          avgGoalsScored: enrichedXG.xGAway,
          avgGoalsScoredHome: enrichedXG.xGAway * 1.1,
          avgGoalsScoredAway: enrichedXG.xGAway * 0.9,
          // Injeta corners reais do FDO
          ...(enrichedXG.cornersAway > 0 && {
            avgCornersFor: enrichedXG.cornersAway,
            avgCornersForHome: enrichedXG.cornersAway * 1.08,
            avgCornersForAway: enrichedXG.cornersAway * 0.92,
          }),
          // Injeta posse real do FDO
          ...(enrichedXG.possessionAway > 0 && {
            avgPossession: enrichedXG.possessionAway,
          }),
        };
        predictions = calculatePredictions(enrichedHomeStats, enrichedAwayStats, true, effectiveLeagueId, headToHead);
      }

      predictions = blendWithMarket(predictions, marketOdds);

      const scorePredictions = calculateScorePredictions(
        predictions.expectedGoalsHome,
        predictions.expectedGoalsAway
      );

      const matchProfile = calculateMatchProfile(homeTeamStats, awayTeamStats, predictions);
      const valueBets = calculateValueBets(predictions, match.strHomeTeam, match.strAwayTeam, marketOdds);
      const summary = buildAnalysisSummary(predictions, homeTeamStats, awayTeamStats, headToHead, valueBets, marketOdds);

      const rawTips = generateTips(predictions, homeTeamStats, awayTeamStats, match.strHomeTeam, match.strAwayTeam, headToHead, marketOdds);
      const tips = applyTipValueFlags(rawTips, valueBets);

      const avgDataQuality = (homeTeamStats.dataQuality + awayTeamStats.dataQuality) / 2;
      const enrichmentBonus = enrichment.source === 'football-data.org' ? 1 : 0;
      const espnBonus = hasESPNIds ? 1 : 0;
      const marketBonus = marketOdds ? 1 : 0;
      const effectiveQuality = avgDataQuality + enrichmentBonus + espnBonus + marketBonus;
      const confidence =
        summary.decisionScore >= 74 || effectiveQuality >= 8 ? 'high' :
        summary.decisionScore >= 58 || effectiveQuality >= 5 ? 'medium' :
        'low';

      const matchAnalysis: MatchAnalysis = {
        match,
        homeTeamStats,
        awayTeamStats,
        predictions,
        tips,
        headToHead,
        confidence,
        valueBets,
        scorePredictions,
        matchProfile,
        marketOdds,
        summary,
      };

      setAnalysis(matchAnalysis);
      return matchAnalysis;
    } catch (err) {
      console.error('Erro ao analisar partida:', err);
      setError('Erro ao analisar a partida. Tente novamente.');
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
    setEnrichmentSource(null);
  }, []);

  return { analysis, loading, error, analyzeMatch, clearAnalysis, enrichmentSource };
}
