// Rapha Guru — Match Players Hook v1.0
// Busca roster, estatísticas individuais e odds ao vivo via ESPN summary API
// Calcula probabilidade de gol e cartão por jogador

import React, { useState, useEffect, useCallback, useRef } from 'react';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const PLAYERS_CACHE_TTL = 60_000; // 60s de cache

// ============================================================
// TIPOS
// ============================================================

export interface PlayerData {
  id: string;
  name: string;
  shortName: string;
  jersey: string;
  position: string;
  positionAbbr: string;
  teamSide: 'home' | 'away';
  isStarter: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
  // Estatísticas do jogo atual
  goalsInGame: number;
  shotsInGame: number;
  shotsOnTargetInGame: number;
  yellowCardsInGame: number;
  redCardsInGame: number;
  foulsCommittedInGame: number;
  assistsInGame: number;
  // Probabilidades calculadas
  preMatchGoalProbability: number;
  preMatchCardProbability: number;
  goalProbability: number;
  cardProbability: number;
  nextGoalProbability: number;
  next15GoalProbability: number;
  involvementIndex: number;
  liveImpactScore: number;
  performanceLabel: string;
  threatBand: 'elite' | 'forte' | 'moderada' | 'baixa';
  disciplineBand: 'alta' | 'moderada' | 'baixa';
}

export interface MatchOdds {
  provider: string;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  drawMoneyline: number | null;
  overUnder: number | null;
  overOdds: number | null;
  underOdds: number | null;
  homeImpliedProb: number | null;  // % implícita da odd
  awayImpliedProb: number | null;
  drawImpliedProb: number | null;
}

export interface MatchPlayersData {
  homePlayers: PlayerData[];
  awayPlayers: PlayerData[];
  odds: MatchOdds | null;
  topScorers: PlayerData[];
  topCardRisks: PlayerData[];
  topLiveImpacts: PlayerData[];
  lastUpdated: number;
}

// ============================================================
// CACHE
// ============================================================

const playersCache = new Map<string, { data: MatchPlayersData; timestamp: number }>();

// ============================================================
// HELPERS DE PROBABILIDADE
// ============================================================

// Probabilidade base de gol por posição (por jogo)
const GOAL_PROB_BY_POSITION: Record<string, number> = {
  'ST': 35,   // Atacante
  'CF': 32,
  'LW': 22,
  'RW': 22,
  'SS': 25,   // Second striker
  'AM': 18,   // Meia ofensivo
  'CM': 10,
  'LM': 12,
  'RM': 12,
  'DM': 6,    // Volante
  'CB': 4,    // Zagueiro
  'CD': 4,
  'LB': 5,    // Lateral
  'RB': 5,
  'WB': 7,    // Ala
  'G': 0.5,   // Goleiro
  'GK': 0.5,
};

// Probabilidade base de cartão por posição
const CARD_PROB_BY_POSITION: Record<string, number> = {
  'ST': 12,
  'CF': 12,
  'LW': 8,
  'RW': 8,
  'SS': 10,
  'AM': 10,
  'CM': 15,
  'LM': 12,
  'RM': 12,
  'DM': 20,   // Volante mais agressivo
  'CB': 18,
  'CD': 18,
  'LB': 14,
  'RB': 14,
  'WB': 12,
  'G': 3,
  'GK': 3,
};

function moneylineToProb(ml: number): number {
  if (ml > 0) return 100 / (ml + 100);
  return Math.abs(ml) / (Math.abs(ml) + 100);
}

function calcPlayerProbabilities(
  player: Omit<PlayerData, 'preMatchGoalProbability' | 'preMatchCardProbability' | 'goalProbability' | 'cardProbability' | 'nextGoalProbability' | 'next15GoalProbability' | 'involvementIndex' | 'liveImpactScore' | 'performanceLabel' | 'threatBand' | 'disciplineBand'>,
  totalTeamShots: number,
  minute: number
): Pick<PlayerData, 'preMatchGoalProbability' | 'preMatchCardProbability' | 'goalProbability' | 'cardProbability' | 'nextGoalProbability' | 'next15GoalProbability' | 'involvementIndex' | 'liveImpactScore' | 'performanceLabel' | 'threatBand' | 'disciplineBand'> {
  const pos = player.positionAbbr.toUpperCase();
  const baseGoalProb = GOAL_PROB_BY_POSITION[pos] ?? 8;
  const baseCardProb = CARD_PROB_BY_POSITION[pos] ?? 10;
  const matchWindow = Math.max(1, minute || 90);
  const shotShare = totalTeamShots > 0 ? player.shotsInGame / totalTeamShots : 0;
  const involvementRate = (
    player.shotsInGame * 8 +
    player.shotsOnTargetInGame * 12 +
    player.assistsInGame * 10 +
    player.goalsInGame * 16 +
    shotShare * 35
  );

  const minuteFactor = player.subbedOut ? 0.32 : player.subbedIn ? 0.82 : 1.0;
  const liveAggression = (player.shotsInGame / matchWindow) * 90 * 1.35 + (player.shotsOnTargetInGame / matchWindow) * 90 * 2.4;
  const liveGoalLift = involvementRate * 0.42 + liveAggression;
  const liveCardLift = player.foulsCommittedInGame * 10 + (player.yellowCardsInGame > 0 ? 18 : 0);

  const preMatchGoalProbability = Math.round(Math.min(78, baseGoalProb * (player.isStarter ? 1.04 : 0.76)));
  const preMatchCardProbability = Math.round(Math.min(72, baseCardProb * (player.isStarter ? 1.02 : 0.82)));

  let goalProb = Math.min(90, (preMatchGoalProbability + liveGoalLift) * minuteFactor);
  let cardProb = Math.min(86, (preMatchCardProbability + liveCardLift) * minuteFactor);

  if (player.redCardsInGame >= 1) {
    goalProb = 0;
    cardProb = 0;
  }
  if (player.yellowCardsInGame >= 1) {
    cardProb = Math.min(cardProb, 58);
  }

  const nextGoalProb = Math.min(68, goalProb * (0.42 + shotShare * 1.95 + (player.shotsOnTargetInGame > 0 ? 0.18 : 0)));
  const next15GoalProbability = Math.min(72, nextGoalProb * (0.68 + Math.min(minute, 75) / 160));
  const involvementIndex = Math.round(Math.min(100, 28 + involvementRate * 0.9));
  const liveImpactScore = Math.round(Math.min(100, involvementIndex * 0.58 + goalProb * 0.22 + cardProb * 0.08 + (player.goalsInGame > 0 ? 10 : 0) + (player.assistsInGame > 0 ? 6 : 0)));

  let performanceLabel = 'Participação discreta';
  if (liveImpactScore >= 78) performanceLabel = 'Dominando o jogo';
  else if (liveImpactScore >= 62) performanceLabel = 'Muito participativo';
  else if (liveImpactScore >= 46) performanceLabel = 'Boa presença no jogo';
  else if (player.shotsInGame > 0 || player.foulsCommittedInGame > 1) performanceLabel = 'Participação ativa';

  const threatBand: PlayerData['threatBand'] =
    goalProb >= 40 || next15GoalProbability >= 28 ? 'elite' :
    goalProb >= 28 || next15GoalProbability >= 20 ? 'forte' :
    goalProb >= 16 ? 'moderada' : 'baixa';

  const disciplineBand: PlayerData['disciplineBand'] =
    cardProb >= 46 ? 'alta' :
    cardProb >= 24 ? 'moderada' : 'baixa';

  return {
    preMatchGoalProbability,
    preMatchCardProbability,
    goalProbability: Math.round(Math.max(0, goalProb)),
    cardProbability: Math.round(Math.max(0, cardProb)),
    nextGoalProbability: Math.round(Math.max(0, nextGoalProb)),
    next15GoalProbability: Math.round(Math.max(0, next15GoalProbability)),
    involvementIndex,
    liveImpactScore,
    performanceLabel,
    threatBand,
    disciplineBand,
  };
}

// ============================================================
// FETCH PRINCIPAL
// ============================================================

async function fetchMatchPlayers(eventId: string): Promise<MatchPlayersData | null> {
  const cached = playersCache.get(eventId);
  if (cached && Date.now() - cached.timestamp < PLAYERS_CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `${ESPN_BASE}/all/summary?event=${eventId}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const rosters: Record<string, unknown>[] = data.rosters || [];
    const oddsRaw: Record<string, unknown>[] = data.odds || data.pickcenter || [];

    // Extrair IDs de time
    const header = data.header || {};
    const comp = (header.competitions || [])[0] || {};
    const competitors: Record<string, unknown>[] = comp.competitors || [];
    const homeComp = competitors.find((c: Record<string, unknown>) => c.homeAway === 'home') || {};
    const awayComp = competitors.find((c: Record<string, unknown>) => c.homeAway === 'away') || {};
    const homeTeamId = String((homeComp.team as Record<string, unknown>)?.id || '');
    const awayTeamId = String((awayComp.team as Record<string, unknown>)?.id || '');

    // Status do jogo
    const status = comp.status || {};
    const statusType = (status as Record<string, unknown>).type as Record<string, unknown> || {};
    const minute = parseInt(String((status as Record<string, unknown>).displayClock || '0')) || 0;

    // Processar rosters
    const homePlayers: PlayerData[] = [];
    const awayPlayers: PlayerData[] = [];

    for (const rosterData of rosters) {
      const teamId = String((rosterData.team as Record<string, unknown>)?.id || '');
      const side: 'home' | 'away' = teamId === homeTeamId ? 'home' : 'away';
      const players: Record<string, unknown>[] = (rosterData.roster as Record<string, unknown>[]) || [];

      // Calcular total de chutes do time para share
      let totalTeamShots = 0;
      for (const p of players) {
        const stats: Record<string, unknown>[] = (p.stats as Record<string, unknown>[]) || [];
        const getStat = (abbr: string) => {
          const s = stats.find(s => String(s.abbreviation || '').toUpperCase() === abbr.toUpperCase());
          return s ? parseFloat(String(s.value || 0)) : 0;
        };
        totalTeamShots += getStat('SH');
      }

      for (const p of players) {
        const athlete = (p.athlete as Record<string, unknown>) || {};
        const position = (p.position as Record<string, unknown>) || {};
        const stats: Record<string, unknown>[] = (p.stats as Record<string, unknown>[]) || [];

        const getStat = (abbr: string) => {
          const s = stats.find(s => String(s.abbreviation || '').toUpperCase() === abbr.toUpperCase());
          return s ? parseFloat(String(s.value || 0)) : 0;
        };

        const basePlayer = {
          id: String(athlete.id || ''),
          name: String(athlete.displayName || athlete.fullName || ''),
          shortName: String(athlete.shortName || athlete.lastName || ''),
          jersey: String(p.jersey || ''),
          position: String(position.displayName || ''),
          positionAbbr: String(position.abbreviation || 'CM'),
          teamSide: side,
          isStarter: Boolean(p.starter),
          subbedIn: Boolean(p.subbedIn),
          subbedOut: Boolean(p.subbedOut),
          goalsInGame: getStat('G'),
          shotsInGame: getStat('SH'),
          shotsOnTargetInGame: getStat('ST'),
          yellowCardsInGame: getStat('YC'),
          redCardsInGame: getStat('RC'),
          foulsCommittedInGame: getStat('FC'),
          assistsInGame: getStat('A'),
        };

        const probs = calcPlayerProbabilities(basePlayer, totalTeamShots, minute);

        const player: PlayerData = { ...basePlayer, ...probs };

        if (side === 'home') homePlayers.push(player);
        else awayPlayers.push(player);
      }
    }

    // Processar odds
    let odds: MatchOdds | null = null;
    if (oddsRaw.length > 0) {
      const o = oddsRaw[0] as Record<string, unknown>;
      const homeOdds = (o.homeTeamOdds as Record<string, unknown>) || {};
      const awayOdds = (o.awayTeamOdds as Record<string, unknown>) || {};
      const drawOdds = (o.drawOdds as Record<string, unknown>) || {};

      const homeML = homeOdds.moneyLine != null ? Number(homeOdds.moneyLine) : null;
      const awayML = awayOdds.moneyLine != null ? Number(awayOdds.moneyLine) : null;
      const drawML = drawOdds.moneyLine != null ? Number(drawOdds.moneyLine) : null;

      odds = {
        provider: String((o.provider as Record<string, unknown>)?.name || 'ESPN'),
        homeMoneyline: homeML,
        awayMoneyline: awayML,
        drawMoneyline: drawML,
        overUnder: o.overUnder != null ? Number(o.overUnder) : null,
        overOdds: o.overOdds != null ? Number(o.overOdds) : null,
        underOdds: o.underOdds != null ? Number(o.underOdds) : null,
        homeImpliedProb: homeML != null ? Math.round(moneylineToProb(homeML) * 100) : null,
        awayImpliedProb: awayML != null ? Math.round(moneylineToProb(awayML) * 100) : null,
        drawImpliedProb: drawML != null ? Math.round(moneylineToProb(drawML) * 100) : null,
      };
    }

    // Top scorers e card risks (excluindo goleiros e expulsos)
    const allPlayers = [...homePlayers, ...awayPlayers].filter(
      p => p.positionAbbr.toUpperCase() !== 'G' && p.positionAbbr.toUpperCase() !== 'GK' && p.redCardsInGame === 0
    );

    const topScorers = [...allPlayers]
      .sort((a, b) => b.goalProbability - a.goalProbability)
      .slice(0, 5);

    const topCardRisks = [...allPlayers]
      .sort((a, b) => b.cardProbability - a.cardProbability)
      .slice(0, 5);

    const topLiveImpacts = [...allPlayers]
      .sort((a, b) => b.liveImpactScore - a.liveImpactScore)
      .slice(0, 5);

    const result: MatchPlayersData = {
      homePlayers,
      awayPlayers,
      odds,
      topScorers,
      topCardRisks,
      topLiveImpacts,
      lastUpdated: Date.now(),
    };

    playersCache.set(eventId, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.error('Erro ao buscar jogadores:', err);
    return null;
  }
}

// ============================================================
// HOOK PRINCIPAL
// ============================================================

export function useMatchPlayers(eventId: string | null, enabled: boolean = true) {
  const [playersData, setPlayersData] = useState<MatchPlayersData | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    const data = await fetchMatchPlayers(eventId);
    if (data) setPlayersData(data);
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !enabled) {
      setPlayersData(null);
      return;
    }

    setLoading(true);
    fetchData().finally(() => setLoading(false));

    // Poll a cada 60s durante jogos ao vivo
    intervalRef.current = setInterval(fetchData, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [eventId, enabled, fetchData]);

  return { playersData, loading };
}
