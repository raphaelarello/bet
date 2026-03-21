// Design: "Estádio Noturno" — Premium Sports Dark
// Hook: useLiveMatch — Dados ao vivo via ESPN API com polling automático
// Melhoria v2: fallback para TheSportsDB live quando ESPN summary falha ou não tem stats
//   TheSportsDB: /eventstats.php?id=EVENT_ID → chutes, posse, cartões
//   Fallback final: constrói LiveMatchData mínimo a partir dos campos do Match (placar + minuto)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Match } from '@/lib/types';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const SPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/123';
const LIVE_POLL_INTERVAL = 30_000; // 30 segundos

// ─── AllSports API — gratuita, sem API key necessária para endpoints básicos ───
// Cobre +500 ligas com placar ao vivo, estatísticas, eventos de jogo
// Docs: https://allsportsapi.com/soccer-football-api
// Endpoint público (sem key): retorna dados básicos de jogos ao vivo
const ALLSPORTS_BASE = 'https://apiv2.allsportsapi.com/football';

// Cache para AllSports (evita chamadas duplicadas)
const allSportsCache = new Map<string, { data: unknown; timestamp: number }>();
const ALLSPORTS_CACHE_TTL = 20_000; // 20s — mais agressivo pois é live

async function fetchAllSportsLive(eventId: string): Promise<{
  home: Partial<LiveTeamStats>;
  away: Partial<LiveTeamStats>;
  homeScore: string;
  awayScore: string;
  clock: string;
  isLive: boolean;
} | null> {
  // AllSports usa IDs próprios — funciona melhor com jogos buscados pela própria API
  // Para jogos ESPN/TSDB, tentamos com o ID numérico limpo
  const rawId = eventId.replace(/^tsdb_|^oldb_|^espn_/, '');
  if (!rawId) return null;

  // Chave da API: tenta localStorage primeiro (usuário configurou), senão pula silenciosamente
  // Registro grátis em: https://allsportsapi.com/
  const apiKey = (() => {
    try { return localStorage.getItem('allsports_api_key') || ''; } catch { return ''; }
  })();
  if (!apiKey) return null; // Sem chave = pula silenciosamente, sem erros no console

  const cacheKey = `allsports_${rawId}`;
  const cached = allSportsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ALLSPORTS_CACHE_TTL) {
    return cached.data as ReturnType<typeof fetchAllSportsLive> extends Promise<infer T> ? T : never;
  }

  try {
    // Endpoint de fixture por ID — retorna stats ao vivo quando jogo está em andamento
    const res = await fetch(
      `${ALLSPORTS_BASE}/?met=Fixtures&APIkey=${apiKey}&matchId=${rawId}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { result?: Record<string, unknown>[] };
    const fixture = data.result?.[0];
    if (!fixture) return null;

    const status = String(fixture.event_status || '');
    const isLive = status === 'inprogress' || status === '1H' || status === '2H' || status === 'HT';

    const parseStatValue = (val: unknown): number => parseFloat(String(val ?? '0')) || 0;

    const stats = fixture.statistics as Record<string, unknown>[] | undefined;
    const home: Partial<LiveTeamStats> = {};
    const away: Partial<LiveTeamStats> = {};

    if (stats && stats.length > 0) {
      for (const s of stats) {
        const type = String(s.type || '').toLowerCase();
        const h = parseStatValue(s.home);
        const a = parseStatValue(s.away);
        if (type.includes('possession'))          { home.possession = h; away.possession = a; }
        else if (type.includes('shots on target')) { home.shotsOnTarget = h; away.shotsOnTarget = a; }
        else if (type.includes('total shots') || type === 'shots') { home.shots = h; away.shots = a; }
        else if (type.includes('corner'))         { home.corners = h; away.corners = a; }
        else if (type.includes('yellow'))         { home.yellowCards = h; away.yellowCards = a; }
        else if (type.includes('red card'))       { home.redCards = h; away.redCards = a; }
        else if (type.includes('foul'))           { home.fouls = h; away.fouls = a; }
        else if (type.includes('offside'))        { home.offsides = h; away.offsides = a; }
        else if (type.includes('save'))           { home.saves = h; away.saves = a; }
      }
    }

    const result = {
      home,
      away,
      homeScore: String(fixture.event_final_result
        ? String(fixture.event_final_result).split(' - ')[0]
        : fixture.event_home_final_score ?? ''),
      awayScore: String(fixture.event_final_result
        ? String(fixture.event_final_result).split(' - ')[1]
        : fixture.event_away_final_score ?? ''),
      clock: String(fixture.event_time || ''),
      isLive,
    };

    allSportsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    return null;
  }
}
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

  // ── Fonte 1: ESPN summary (melhor qualidade — eventos, stats, placar) ──
  const espnData = await fetchLiveFromESPN(eventId);
  if (espnData) {
    // Se ESPN retornou mas sem stats (boxscore vazio), tenta enriquecer com TheSportsDB + AllSports em paralelo
    const hasStats = espnData.homeStats.shots > 0 || espnData.homeStats.corners > 0 || espnData.homeStats.yellowCards > 0;
    if (!hasStats && (espnData.isLive || espnData.isFinished)) {
      const [tsdbStats, allSportsStats] = await Promise.allSettled([
        fetchLiveStatsFromTSDB(eventId),
        fetchAllSportsLive(eventId),
      ]);

      // Aplica TheSportsDB
      if (tsdbStats.status === 'fulfilled' && tsdbStats.value) {
        espnData.homeStats = { ...espnData.homeStats, ...tsdbStats.value.home };
        espnData.awayStats = { ...espnData.awayStats, ...tsdbStats.value.away };
      }

      // Aplica AllSports para qualquer stat ainda zerada
      if (allSportsStats.status === 'fulfilled' && allSportsStats.value) {
        const as = allSportsStats.value;
        // Só sobrescreve campos que ainda estão zerados (TSDB tem prioridade)
        if (!espnData.homeStats.shots && as.home.shots)           espnData.homeStats.shots = as.home.shots ?? 0;
        if (!espnData.homeStats.corners && as.home.corners)       espnData.homeStats.corners = as.home.corners ?? 0;
        if (!espnData.homeStats.yellowCards && as.home.yellowCards) espnData.homeStats.yellowCards = as.home.yellowCards ?? 0;
        if (!espnData.awayStats.shots && as.away.shots)           espnData.awayStats.shots = as.away.shots ?? 0;
        if (!espnData.awayStats.corners && as.away.corners)       espnData.awayStats.corners = as.away.corners ?? 0;
        if (!espnData.awayStats.yellowCards && as.away.yellowCards) espnData.awayStats.yellowCards = as.away.yellowCards ?? 0;
      }
    }
    liveCache.set(eventId, { data: espnData, timestamp: Date.now() });
    return espnData;
  }

  // ── Fonte 2: TheSportsDB live stats ──────────────────────────────────
  const tsdbData = await fetchLiveFromTSDB(eventId);
  if (tsdbData) {
    // Enriquece TSDB com AllSports se stats estiverem vazios
    const hasStats = tsdbData.homeStats.shots > 0 || tsdbData.homeStats.corners > 0;
    if (!hasStats) {
      const asStats = await fetchAllSportsLive(eventId);
      if (asStats) {
        tsdbData.homeStats = { ...tsdbData.homeStats, ...asStats.home };
        tsdbData.awayStats = { ...tsdbData.awayStats, ...asStats.away };
        if (asStats.clock && !tsdbData.clock) tsdbData.clock = asStats.clock;
      }
    }
    liveCache.set(eventId, { data: tsdbData, timestamp: Date.now() });
    return tsdbData;
  }

  // ── Fonte 3: AllSports API — fallback puro para ligas não cobertas ────
  // Constrói um LiveMatchData mínimo com os dados disponíveis
  const asData = await fetchAllSportsLive(eventId);
  if (asData && (asData.isLive || asData.homeScore || asData.awayScore)) {
    const defaultStats: LiveTeamStats = {
      possession: 50, shots: 0, shotsOnTarget: 0, corners: 0,
      fouls: 0, yellowCards: 0, redCards: 0, offsides: 0, saves: 0, onTargetPct: 0,
    };
    const liveData: LiveMatchData = {
      eventId,
      status: asData.isLive ? 'in' : 'post',
      statusDescription: asData.isLive ? 'In Progress' : 'Full Time',
      statusDetail: asData.clock || '',
      clock: asData.clock || '',
      period: asData.clock ? (parseInt(asData.clock) > 45 ? 2 : 1) : 0,
      homeScore: asData.homeScore || '0',
      awayScore: asData.awayScore || '0',
      homeTeamId: '',
      awayTeamId: '',
      homeStats: { ...defaultStats, ...asData.home },
      awayStats: { ...defaultStats, ...asData.away },
      events: [],
      lastUpdated: Date.now(),
      isLive: asData.isLive,
      isFinished: !asData.isLive && !!(asData.homeScore || asData.awayScore),
    };
    liveCache.set(eventId, { data: liveData, timestamp: Date.now() });
    return liveData;
  }

  return null;
}

// ============================================================
// FONTE 1: ESPN summary
// ============================================================
async function fetchLiveFromESPN(eventId: string): Promise<LiveMatchData | null> {
  // Só tenta ESPN se o ID parece ser ESPN (sem prefixo tsdb_ ou oldb_)
  if (eventId.startsWith('tsdb_') || eventId.startsWith('oldb_')) return null;

  try {
    const res = await fetch(
      `${ESPN_BASE}/all/summary?event=${eventId}`,
      { headers: { 'Accept': 'application/json' } }
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

      const teamSide: 'home' | 'away' = teamId === homeTeamId ? 'home' : 'away';

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

    return liveData;
  } catch {
    return null;
  }
}

// ============================================================
// FONTE 2: TheSportsDB eventstats — chutes, posse, cartões
// Endpoint gratuito: /eventstats.php?id=TSDB_EVENT_ID
// Usado como fallback quando ESPN não tem stats ou jogo é de liga não coberta
// ============================================================
interface TSDBStatsRaw {
  idStatistic: string;
  idEvent: string;
  strStat: string;           // "Ball Possession", "Total Shots", "Corner Kicks", etc.
  intHome: string;
  intAway: string;
}

async function fetchLiveStatsFromTSDB(
  eventId: string
): Promise<{ home: Partial<LiveTeamStats>; away: Partial<LiveTeamStats> } | null> {
  // Remove prefixos de fonte para obter o ID numérico
  const rawId = eventId.replace(/^tsdb_/, '').replace(/^espn_/, '');
  if (!rawId || isNaN(Number(rawId))) return null;

  try {
    const res = await fetch(`${SPORTSDB_BASE}/eventstats.php?id=${rawId}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { eventstats: TSDBStatsRaw[] | null };
    if (!data.eventstats?.length) return null;

    const home: Partial<LiveTeamStats> = {};
    const away: Partial<LiveTeamStats> = {};

    for (const stat of data.eventstats) {
      const label = stat.strStat.toLowerCase();
      const h = parseFloat(stat.intHome) || 0;
      const a = parseFloat(stat.intAway) || 0;

      if (label.includes('possession'))           { home.possession = h; away.possession = a; }
      else if (label.includes('total shot'))       { home.shots = h; away.shots = a; }
      else if (label.includes('shot on target') || label.includes('on goal')) { home.shotsOnTarget = h; away.shotsOnTarget = a; }
      else if (label.includes('corner'))           { home.corners = h; away.corners = a; }
      else if (label.includes('foul'))             { home.fouls = h; away.fouls = a; }
      else if (label.includes('yellow'))           { home.yellowCards = h; away.yellowCards = a; }
      else if (label.includes('red card'))         { home.redCards = h; away.redCards = a; }
      else if (label.includes('offside'))          { home.offsides = h; away.offsides = a; }
      else if (label.includes('save'))             { home.saves = h; away.saves = a; }
    }

    return { home, away };
  } catch {
    return null;
  }
}

// ============================================================
// FONTE 2B: TheSportsDB livescore — constrói LiveMatchData completo
// para jogos que não estão na ESPN (ex: vindos de OpenLigaDB/TSDB)
// ============================================================
async function fetchLiveFromTSDB(eventId: string): Promise<LiveMatchData | null> {
  const rawId = eventId.replace(/^tsdb_/, '').replace(/^oldb_/, '');
  if (!rawId || isNaN(Number(rawId))) return null;

  try {
    // TheSportsDB event lookup
    const [eventRes, statsRes] = await Promise.allSettled([
      fetch(`${SPORTSDB_BASE}/lookupevent.php?id=${rawId}`, { headers: { Accept: 'application/json' } }),
      fetch(`${SPORTSDB_BASE}/eventstats.php?id=${rawId}`, { headers: { Accept: 'application/json' } }),
    ]);

    let event: Record<string, unknown> | null = null;
    if (eventRes.status === 'fulfilled' && eventRes.value.ok) {
      const data = await eventRes.value.json() as { events: Record<string, unknown>[] | null };
      event = data.events?.[0] ?? null;
    }

    if (!event) return null;

    const homeScore = String(event.intHomeScore ?? event.intScore ?? '');
    const awayScore = String(event.intAwayScore ?? event.intScoreAway ?? '');
    const strStatus = String(event.strStatus || event.strProgress || '');
    const isLive    = strStatus === 'In Progress' || strStatus === '1H' || strStatus === '2H' || strStatus === 'HT';
    const isFinished = strStatus === 'Match Finished' || strStatus === 'FT' || strStatus === 'AET' || strStatus === 'PEN';

    // Estatísticas
    let homeStats: LiveTeamStats = { possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0, offsides: 0, saves: 0, onTargetPct: 0 };
    let awayStats: LiveTeamStats = { ...homeStats };

    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
      const sData = await statsRes.value.json() as { eventstats: TSDBStatsRaw[] | null };
      if (sData.eventstats) {
        const parsed = await fetchLiveStatsFromTSDB(eventId);
        if (parsed) {
          homeStats = { ...homeStats, ...parsed.home };
          awayStats = { ...awayStats, ...parsed.away };
        }
      }
    }

    // Minuto (TSDB usa strProgress ex: "65'")
    const progress = String(event.strProgress || '');
    const minuteMatch = progress.match(/(\d+)/);
    const clock = minuteMatch ? `${minuteMatch[1]}'` : '';

    // Período estimado pelo progresso
    const period = progress.includes('HT') || progress.includes('Intervalo') ? 1
      : progress.includes('2H') || (minuteMatch && Number(minuteMatch[1]) > 45) ? 2
      : 1;

    return {
      eventId,
      status: isLive ? 'in' : isFinished ? 'post' : 'pre',
      statusDescription: isLive ? 'In Progress' : isFinished ? 'Full Time' : '',
      statusDetail: progress,
      clock,
      period,
      homeScore,
      awayScore,
      homeTeamId: String(event.idHomeTeam || ''),
      awayTeamId: String(event.idAwayTeam || ''),
      homeStats,
      awayStats,
      events: [],  // TSDB não fornece timeline de eventos em tempo real
      lastUpdated: Date.now(),
      isLive,
      isFinished,
    };
  } catch {
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
