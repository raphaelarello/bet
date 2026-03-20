// Design: "Estádio Noturno" — Premium Sports Dark
// Hook: useLiveMatch — Dados ao vivo via ESPN API com polling automático

import React, { useState, useEffect, useCallback, useRef } from 'react';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const LIVE_POLL_INTERVAL = 30_000; // 30 segundos
const LIVE_CACHE_TTL = 25_000;     // Cache de 25s (um pouco menos que o poll)

// ===== Tipos de dados ao vivo =====

export interface LiveEvent {
  id: string;
  type: 'goal' | 'yellow_card' | 'red_card' | 'yellow_red_card' | 'substitution' | 'penalty' | 'own_goal' | 'var' | 'other';
  minute: string;
  teamId: string;
  teamSide: 'home' | 'away';
  playerName: string;
  playerName2?: string; // Para substituições: jogador que entra
  description: string;
  period: number;
}

export interface LiveTeamStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  offsides: number;
  saves: number;
  onTargetPct: number;
}

export interface LiveMatchData {
  eventId: string;
  status: 'pre' | 'in' | 'post';
  statusDescription: string;
  statusDetail: string;
  clock: string;
  period: number;
  homeScore: string;
  awayScore: string;
  homeTeamId: string;
  awayTeamId: string;
  homeStats: LiveTeamStats;
  awayStats: LiveTeamStats;
  events: LiveEvent[];
  lastUpdated: number;
  isLive: boolean;
  isFinished: boolean;
}

// Cache em memória para dados ao vivo
const liveCache = new Map<string, { data: LiveMatchData; timestamp: number }>();

// Converte texto do tipo de evento ESPN para tipo interno
function parseEventType(espnType: string, isYellow: boolean, isRed: boolean, isOwn: boolean): LiveEvent['type'] {
  if (isOwn) return 'own_goal';
  if (isRed && isYellow) return 'yellow_red_card';
  if (isRed) return 'red_card';
  if (isYellow) return 'yellow_card';
  
  const t = espnType.toLowerCase();
  if (t.includes('goal') || t.includes('gol')) return 'goal';
  if (t.includes('penalty') || t.includes('pênalti')) return 'penalty';
  if (t.includes('substitut') || t.includes('subst')) return 'substitution';
  if (t.includes('var')) return 'var';
  return 'other';
}

// Busca dados ao vivo de um jogo específico via ESPN summary
async function fetchLiveMatchData(eventId: string): Promise<LiveMatchData | null> {
  const cached = liveCache.get(eventId);
  if (cached && Date.now() - cached.timestamp < LIVE_CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `${ESPN_BASE}/all/summary?event=${eventId}`,
      {
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();

    // Extrair header (status e placar)
    const header = data.header || {};
    const competitions = header.competitions || [];
    const comp = competitions[0] || {};
    const status = comp.status || {};
    const statusType = status.type || {};
    const competitors = comp.competitors || [];

    const homeComp = competitors.find((c: Record<string, unknown>) => c.homeAway === 'home') || {};
    const awayComp = competitors.find((c: Record<string, unknown>) => c.homeAway === 'away') || {};

    const homeTeamId = String((homeComp.team as Record<string, unknown>)?.id || '');
    const awayTeamId = String((awayComp.team as Record<string, unknown>)?.id || '');

    // Extrair estatísticas do boxscore
    const boxscore = data.boxscore || {};
    const teams = boxscore.teams || [];

    const parseTeamStats = (teamData: Record<string, unknown>): LiveTeamStats => {
      const stats = (teamData.statistics as Record<string, unknown>[]) || [];
      const get = (label: string): number => {
        const s = stats.find((s: Record<string, unknown>) =>
          String(s.label || s.name || '').toLowerCase().includes(label.toLowerCase())
        );
        if (!s) return 0;
        const val = s.displayValue || s.value;
        return parseFloat(String(val)) || 0;
      };

      return {
        possession: get('possession') || get('POSSESSION'),
        shots: get('shots') || get('SHOTS'),
        shotsOnTarget: get('on goal') || get('ON GOAL'),
        corners: get('corner') || get('Corner'),
        fouls: get('foul') || get('Foul'),
        yellowCards: get('yellow') || get('Yellow'),
        redCards: get('red') || get('Red'),
        offsides: get('offside') || get('Offside'),
        saves: get('save') || get('Salvar'),
        onTargetPct: get('on target') || get('On Target'),
      };
    };

    const homeTeamStats = teams.find((t: Record<string, unknown>) => t.homeAway === 'home');
    const awayTeamStats = teams.find((t: Record<string, unknown>) => t.homeAway === 'away');

    const homeStats = homeTeamStats ? parseTeamStats(homeTeamStats as Record<string, unknown>) : {
      possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0,
      yellowCards: 0, redCards: 0, offsides: 0, saves: 0, onTargetPct: 0,
    };
    const awayStats = awayTeamStats ? parseTeamStats(awayTeamStats as Record<string, unknown>) : {
      possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0,
      yellowCards: 0, redCards: 0, offsides: 0, saves: 0, onTargetPct: 0,
    };

    // Extrair eventos (gols, cartões) do scoreboard
    const scoreboardComp = (data.header?.competitions || [])[0] || {};
    const details = (scoreboardComp.details as Record<string, unknown>[]) || [];

    const events: LiveEvent[] = details.map((d: Record<string, unknown>, idx: number) => {
      const eventType = (d.type as Record<string, unknown>) || {};
      const typeText = String(eventType.text || eventType.name || '');
      const clock = (d.clock as Record<string, unknown>) || {};
      const minute = String(clock.displayValue || clock.value || '?');
      const teamId = String((d.team as Record<string, unknown>)?.id || '');
      const isYellow = Boolean(d.yellowCard);
      const isRed = Boolean(d.redCard);
      const isOwn = Boolean(d.ownGoal);
      const isPenalty = Boolean(d.penaltyKick);
      const athletes = (d.athletesInvolved as Record<string, unknown>[]) || [];
      const player1 = String((athletes[0] as Record<string, unknown>)?.displayName || '');
      const player2 = String((athletes[1] as Record<string, unknown>)?.displayName || '');
      const period = Number(d.period || 1);

      let parsedType = parseEventType(typeText, isYellow, isRed, isOwn);
      if (isPenalty && parsedType === 'goal') parsedType = 'penalty';

      // Determinar lado (home/away) pelo teamId
      const teamSide: 'home' | 'away' = teamId === homeTeamId ? 'home' : 'away';

      // Descrição em português
      let description = '';
      switch (parsedType) {
        case 'goal': description = `Gol de ${player1}`; break;
        case 'penalty': description = `Pênalti convertido por ${player1}`; break;
        case 'own_goal': description = `Gol contra de ${player1}`; break;
        case 'yellow_card': description = `Cartão amarelo para ${player1}`; break;
        case 'red_card': description = `Cartão vermelho para ${player1}`; break;
        case 'yellow_red_card': description = `Segundo amarelo (vermelho) para ${player1}`; break;
        case 'substitution': description = `Substituição: entra ${player2 || '?'}, sai ${player1}`; break;
        case 'var': description = `Revisão VAR — ${typeText}`; break;
        default: description = typeText || 'Evento';
      }

      return {
        id: `${eventId}-${idx}`,
        type: parsedType,
        minute,
        teamId,
        teamSide,
        playerName: player1,
        playerName2: player2 || undefined,
        description,
        period,
      };
    });

    const isLiveState = statusType.state === 'in';
    const isFinished = statusType.state === 'post';

    const liveData: LiveMatchData = {
      eventId,
      status: statusType.state as 'pre' | 'in' | 'post',
      statusDescription: String(statusType.description || ''),
      statusDetail: String(statusType.detail || statusType.shortDetail || ''),
      clock: String(status.displayClock || ''),
      period: Number(status.period || 0),
      homeScore: String(homeComp.score || ''),
      awayScore: String(awayComp.score || ''),
      homeTeamId,
      awayTeamId,
      homeStats,
      awayStats,
      events,
      lastUpdated: Date.now(),
      isLive: isLiveState,
      isFinished,
    };

    liveCache.set(eventId, { data: liveData, timestamp: Date.now() });
    return liveData;
  } catch (err) {
    console.error('Erro ao buscar dados ao vivo:', err);
    return null;
  }
}

// Hook principal para dados ao vivo
export function useLiveMatch(eventId: string | null, isLiveOrRecent: boolean) {
  const [liveData, setLiveData] = useState<LiveMatchData | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    const data = await fetchLiveMatchData(eventId);
    if (data) setLiveData(data);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setLiveData(null);
      return;
    }

    // Busca inicial
    setLoading(true);
    fetchData().finally(() => setLoading(false));

    // Polling apenas para jogos ao vivo
    if (isLiveOrRecent) {
      intervalRef.current = setInterval(fetchData, LIVE_POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [eventId, isLiveOrRecent, fetchData]);

  return { liveData, loading };
}

// Hook para buscar todos os jogos ao vivo agora
export function useLiveScores() {
  const [liveMatches, setLiveMatches] = useState<{
    eventId: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: string;
    awayScore: string;
    clock: string;
    period: number;
    statusDetail: string;
  }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`${ESPN_BASE}/all/scoreboard?limit=200`);
      if (!res.ok) return;
      const data = await res.json();
      const events = data.events || [];

      const live = events
        .filter((e: Record<string, unknown>) => {
          const comp = (e.competitions as Record<string, unknown>[])?.[0] || {};
          const status = (comp.status as Record<string, unknown>) || {};
          const statusType = (status.type as Record<string, unknown>) || {};
          return statusType.state === 'in';
        })
        .map((e: Record<string, unknown>) => {
          const comp = (e.competitions as Record<string, unknown>[])?.[0] || {};
          const status = (comp.status as Record<string, unknown>) || {};
          const statusType = (status.type as Record<string, unknown>) || {};
          const competitors = (comp.competitors as Record<string, unknown>[]) || [];
          const home = competitors.find((c: Record<string, unknown>) => c.homeAway === 'home') || {};
          const away = competitors.find((c: Record<string, unknown>) => c.homeAway === 'away') || {};

          return {
            eventId: String(e.id || ''),
            homeTeam: String((home.team as Record<string, unknown>)?.displayName || ''),
            awayTeam: String((away.team as Record<string, unknown>)?.displayName || ''),
            homeScore: String(home.score || '0'),
            awayScore: String(away.score || '0'),
            clock: String(status.displayClock || ''),
            period: Number(status.period || 0),
            statusDetail: String(statusType.detail || statusType.shortDetail || ''),
          };
        });

      setLiveMatches(live);
    } catch (err) {
      console.error('Erro ao buscar placar ao vivo:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLive().finally(() => setLoading(false));

    const interval = setInterval(fetchLive, LIVE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLive]);

  return { liveMatches, loading };
}
