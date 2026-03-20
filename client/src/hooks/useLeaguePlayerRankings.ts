// Rapha Guru — League Player Rankings Hook v1.0
// Busca ranking de artilheiros e líderes em cartões da temporada via ESPN API
// Usa o endpoint de roster dos times para agregar estatísticas da temporada

import React, { useState, useEffect } from 'react';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// ============================================================
// TIPOS
// ============================================================

export interface PlayerSeasonStats {
  id: string;
  name: string;
  shortName: string;
  position: string;
  positionAbbr: string;
  teamName: string;
  teamId: string;
  jersey: string;
  // Estatísticas da temporada
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  totalShots: number;
  shotsOnTarget: number;
  foulsCommitted: number;
  appearances: number;
  goalsPerGame: number;
  cardsPerGame: number;
  // Ranking calculado
  scorerRank: number;
  cardRisk: number; // 0-100
}

export interface LeagueRankings {
  leagueSlug: string;
  topScorers: PlayerSeasonStats[];
  topAssists: PlayerSeasonStats[];
  mostYellowCards: PlayerSeasonStats[];
  mostFouls: PlayerSeasonStats[];
  lastUpdated: number;
}

// ============================================================
// MAPEAMENTO DE LIGA ESPN
// ============================================================

// Mapa de idLeague (ESPN) → slug ESPN para a API
const LEAGUE_SLUG_MAP: Record<string, string> = {
  // Europa — principais
  '3918': 'eng.1',
  '740': 'esp.1',
  '720': 'ger.1',
  '730': 'ita.1',
  '710': 'fra.1',
  '725': 'ned.1',
  '715': 'por.1',
  '755': 'bel.1',
  '750': 'tur.1',
  // América
  '4351': 'bra.1',
  '4356': 'arg.1',
  '770': 'usa.1',
  '760': 'mex.1',
  // Ásia e Oceania
  '21231': 'sau.1',
  '3906': 'aus.1',
  '8316': 'ind.1',
  '4452': 'jpn.1',
  '4436': 'chn.1',
  // Competições europeias
  '23': 'uefa.champions',
  '2': 'uefa.europa',
  '40': 'uefa.europa.conf',
};

// ============================================================
// CACHE
// ============================================================

const rankingsCache = new Map<string, { data: LeagueRankings; timestamp: number }>();

// ============================================================
// FETCH
// ============================================================

async function fetchLeagueRankings(leagueSlug: string): Promise<LeagueRankings | null> {
  const cacheKey = leagueSlug;
  const cached = rankingsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Busca os times da liga para depois buscar os rosters
    const teamsRes = await fetch(
      `${ESPN_BASE}/${leagueSlug}/teams`,
      { headers: { Accept: 'application/json' } }
    );
    if (!teamsRes.ok) return null;
    const teamsData = await teamsRes.json();

    const teams: { id: string; displayName: string }[] =
      (teamsData.sports?.[0]?.leagues?.[0]?.teams || []).map((t: Record<string, unknown>) => ({
        id: (t.team as Record<string, unknown>)?.id as string,
        displayName: (t.team as Record<string, unknown>)?.displayName as string,
      })).filter((t: { id: string }) => t.id);

    if (teams.length === 0) return null;

    // Busca rosters de até 10 times em paralelo (para não sobrecarregar)
    const teamsToFetch = teams.slice(0, 10);
    const rosterPromises = teamsToFetch.map(async (team) => {
      try {
        const res = await fetch(
          `${ESPN_BASE}/${leagueSlug}/teams/${team.id}/roster`,
          { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const athletes: Record<string, unknown>[] = data.athletes || [];

        return athletes.map((a): PlayerSeasonStats | null => {
          const splits = (a.statistics as Record<string, unknown>)?.splits as Record<string, unknown> || {};
          const cats: Record<string, unknown>[] =
            (splits.categories as Record<string, unknown>[]) || [];
          if (cats.length === 0) return null;

          const statsMap: Record<string, number> = {};
          cats.forEach((cat: Record<string, unknown>) => {
            const statsList: Record<string, unknown>[] = cat.stats as Record<string, unknown>[] || [];
            statsList.forEach((s: Record<string, unknown>) => {
              if (s.name && s.value != null) {
                statsMap[s.name as string] = Number(s.value);
              }
            });
          });

          const goals = statsMap['totalGoals'] ?? 0;
          const assists = statsMap['goalAssists'] ?? 0;
          const yellow = statsMap['yellowCards'] ?? 0;
          const red = statsMap['redCards'] ?? 0;
          const shots = statsMap['totalShots'] ?? 0;
          const shotsOT = statsMap['shotsOnTarget'] ?? 0;
          const fouls = statsMap['foulsCommitted'] ?? 0;
          const appearances = statsMap['appearances'] ?? statsMap['gamesPlayed'] ?? 1;

          // Só inclui jogadores com pelo menos 1 aparição
          if (appearances === 0 && goals === 0 && yellow === 0) return null;

          const pos = (a.position as Record<string, unknown>)?.abbreviation as string || '';
          const apps = Math.max(1, appearances);

          return {
            id: a.id as string,
            name: a.displayName as string || a.fullName as string || '',
            shortName: a.shortName as string || '',
            position: (a.position as Record<string, unknown>)?.displayName as string || '',
            positionAbbr: pos,
            teamName: team.displayName,
            teamId: team.id,
            jersey: a.jersey as string || '',
            goals,
            assists,
            yellowCards: yellow,
            redCards: red,
            totalShots: shots,
            shotsOnTarget: shotsOT,
            foulsCommitted: fouls,
            appearances: apps,
            goalsPerGame: Math.round((goals / apps) * 100) / 100,
            cardsPerGame: Math.round(((yellow + red * 2) / apps) * 100) / 100,
            scorerRank: 0,
            cardRisk: Math.min(100, Math.round(((yellow * 15 + fouls * 3) / apps))),
          };
        }).filter(Boolean) as PlayerSeasonStats[];
      } catch {
        return [];
      }
    });

    const allPlayersNested = await Promise.all(rosterPromises);
    const allPlayers = allPlayersNested.flat();

    if (allPlayers.length === 0) return null;

    // Ordena e ranqueia
    const topScorers = [...allPlayers]
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
      .slice(0, 15)
      .map((p, i) => ({ ...p, scorerRank: i + 1 }));

    const topAssists = [...allPlayers]
      .sort((a, b) => b.assists - a.assists)
      .slice(0, 10)
      .map((p, i) => ({ ...p, scorerRank: i + 1 }));

    const mostYellowCards = [...allPlayers]
      .sort((a, b) => b.yellowCards - a.yellowCards || b.foulsCommitted - a.foulsCommitted)
      .slice(0, 10)
      .map((p, i) => ({ ...p, scorerRank: i + 1 }));

    const mostFouls = [...allPlayers]
      .sort((a, b) => b.foulsCommitted - a.foulsCommitted)
      .slice(0, 10)
      .map((p, i) => ({ ...p, scorerRank: i + 1 }));

    const result: LeagueRankings = {
      leagueSlug,
      topScorers,
      topAssists,
      mostYellowCards,
      mostFouls,
      lastUpdated: Date.now(),
    };

    rankingsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    return null;
  }
}

// ============================================================
// HOOK
// ============================================================

export function useLeaguePlayerRankings(leagueId: string | null) {
  const [rankings, setRankings] = useState<LeagueRankings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leagueSlug = leagueId ? LEAGUE_SLUG_MAP[leagueId] ?? null : null;

  useEffect(() => {
    if (!leagueSlug) {
      setRankings(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchLeagueRankings(leagueSlug).then(data => {
      if (cancelled) return;
      if (data) {
        setRankings(data);
      } else {
        setError('Dados de ranking não disponíveis para esta liga.');
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [leagueSlug]);

  return { rankings, loading, error, leagueSlug };
}
