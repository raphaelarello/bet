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
  SUPPORTED_LEAGUES_FDO,
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
    homeWinProb: predictions.homeWinProb * 0.68 + marketHome * 0.32,
    drawProb: predictions.drawProb * 0.68 + marketDraw * 0.32,
    awayWinProb: predictions.awayWinProb * 0.68 + marketAway * 0.32,
  };

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
      const isLeagueSupported = SUPPORTED_LEAGUES_FDO.includes(leagueId);

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

      const basePredictions = calculatePredictions(homeTeamStats, awayTeamStats, true, effectiveLeagueId);
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
        };
        const enrichedAwayStats = {
          ...awayTeamStats,
          avgGoalsScored: enrichedXG.xGAway,
          avgGoalsScoredHome: enrichedXG.xGAway * 1.1,
          avgGoalsScoredAway: enrichedXG.xGAway * 0.9,
        };
        predictions = calculatePredictions(enrichedHomeStats, enrichedAwayStats, true, effectiveLeagueId);
      }

      predictions = blendWithMarket(predictions, marketOdds);

      const scorePredictions = calculateScorePredictions(
        predictions.expectedGoalsHome,
        predictions.expectedGoalsAway
      );

      const matchProfile = calculateMatchProfile(homeTeamStats, awayTeamStats, predictions);
      const valueBets = calculateValueBets(predictions, match.strHomeTeam, match.strAwayTeam, marketOdds);
      const summary = buildAnalysisSummary(predictions, homeTeamStats, awayTeamStats, headToHead, valueBets, marketOdds);

      const rawTips = generateTips(predictions, homeTeamStats, awayTeamStats, match.strHomeTeam, match.strAwayTeam);
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
