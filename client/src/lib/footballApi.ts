// Rapha Guru — API Service v2.0 (Ultra Detailed)
// Design: "Estádio Noturno" — Premium Sports Dark
// Uses TheSportsDB free API (key: 123)

import { formatLocalISODate } from '@/lib/utils';
import type {
  Match, RecentMatch, TeamStats, HeadToHead,
  Predictions, Tip, ValueBet, ScorePrediction, MatchProfile,
  AnalysisMarketOdds, AnalysisSummary,
} from './types';

const SPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/123';
const CORS_PROXY = 'https://corsproxy.io/?';
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Cache ESPN
const espnCache = new Map<string, { data: unknown; timestamp: number }>();
const ESPN_CACHE_TTL = 10 * 60 * 1000;

async function fetchESPN<T>(url: string): Promise<T | null> {
  const cached = espnCache.get(url);
  if (cached && Date.now() - cached.timestamp < ESPN_CACHE_TTL) {
    return cached.data as T;
  }
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    espnCache.set(url, { data, timestamp: Date.now() });
    return data;
  } catch {
    return null;
  }
}


function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function americanToDecimal(odds: number | null | undefined): number | null {
  if (odds == null || odds === 0) return null;
  return odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
}

function decimalToProb(decimal: number | null | undefined): number {
  if (!decimal || decimal <= 1) return 0;
  return 1 / decimal;
}

function normalizeProbabilities(probs: number[]): number[] {
  const sum = probs.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return probs.map(() => 0);
  return probs.map((value) => value / sum);
}

function getTotalMarketModelProb(predictions: Predictions, totalLine: number | null | undefined, side: 'over' | 'under'): number | null {
  if (totalLine == null) return null;
  const line = Number(totalLine);
  const overMap: Record<string, number> = {
    '0.5': predictions.over05Prob,
    '1.5': predictions.over15Prob,
    '2.5': predictions.over25Prob,
    '3.5': predictions.over35Prob,
    '4.5': predictions.over45Prob,
  };
  const underMap: Record<string, number> = {
    '1.5': predictions.under15Prob,
    '2.5': predictions.under25Prob,
    '3.5': predictions.under35Prob,
  };
  const key = line.toFixed(1);
  if (side === 'over') return overMap[key] ?? null;
  if (underMap[key] != null) return underMap[key];
  if (overMap[key] != null) return clamp(100 - overMap[key], 0, 100);
  return null;
}

export async function fetchMatchMarketOdds(eventId: string): Promise<AnalysisMarketOdds | null> {
  if (!eventId) return null;

  const data = await fetchESPN<Record<string, unknown>>(`${ESPN_BASE}/all/summary?event=${eventId}`);
  if (!data) return null;

  const oddsRaw = (data.odds as Record<string, unknown>[] | undefined) ||
    (data.pickcenter as Record<string, unknown>[] | undefined) ||
    [];

  if (!oddsRaw.length) return null;

  const o = oddsRaw[0] as Record<string, unknown>;
  const homeOdds = (o.homeTeamOdds as Record<string, unknown>) || {};
  const awayOdds = (o.awayTeamOdds as Record<string, unknown>) || {};
  const drawOdds = (o.drawOdds as Record<string, unknown>) || {};

  return {
    provider: String((o.provider as Record<string, unknown>)?.name || 'ESPN'),
    homeWinOdds: americanToDecimal(homeOdds.moneyLine != null ? Number(homeOdds.moneyLine) : null),
    awayWinOdds: americanToDecimal(awayOdds.moneyLine != null ? Number(awayOdds.moneyLine) : null),
    drawOdds: americanToDecimal(drawOdds.moneyLine != null ? Number(drawOdds.moneyLine) : null),
    totalLine: o.overUnder != null ? Number(o.overUnder) : null,
    overOdds: americanToDecimal(o.overOdds != null ? Number(o.overOdds) : null),
    underOdds: americanToDecimal(o.underOdds != null ? Number(o.underOdds) : null),
  };
}

// Busca histórico de um time via ESPN
// ============================================================
// HISTÓRICO MULTI-TEMPORADA ESPN
// Busca até 3 temporadas em paralelo (atual + 2 anteriores) e
// extrai corners e cartões do summary de cada evento (quando disponível no cache).
// Retorna os 30 jogos mais recentes para alimentar calculateTeamStats.
// ============================================================

// Cache de stats por evento (corners/cartões do summary)
const eventStatsCache = new Map<string, { corners: number; yellowCards: number; redCards: number }>();

async function fetchESPNEventStats(eventId: string, teamId: string): Promise<{ corners: number; yellowCards: number; redCards: number }> {
  const cached = eventStatsCache.get(`${eventId}_${teamId}`);
  if (cached) return cached;

  try {
    const data = await fetchESPN<Record<string, unknown>>(`${ESPN_BASE}/all/summary?event=${eventId}`);
    if (!data) return { corners: 0, yellowCards: 0, redCards: 0 };

    const boxscore = data.boxscore as Record<string, unknown> | undefined;
    const teams = (boxscore?.teams as Record<string, unknown>[]) || [];

    const get = (teamData: Record<string, unknown>, label: string): number => {
      const stats = (teamData.statistics as Record<string, unknown>[]) || [];
      const s = stats.find(s => String(s.label || s.name || '').toLowerCase().includes(label.toLowerCase()));
      if (!s) return 0;
      return parseFloat(String(s.displayValue || s.value || '0')) || 0;
    };

    let corners = 0;
    let yellowCards = 0;
    let redCards = 0;

    for (const teamData of teams) {
      const td = teamData as Record<string, unknown>;
      const tTeam = td.team as Record<string, unknown> | undefined;
      const isMyTeam = String(tTeam?.id || '') === teamId;
      if (!isMyTeam) continue;
      corners    = get(td, 'corner');
      yellowCards = get(td, 'yellow');
      redCards   = get(td, 'red');
    }

    const stats = { corners, yellowCards, redCards };
    eventStatsCache.set(`${eventId}_${teamId}`, stats);
    return stats;
  } catch {
    return { corners: 0, yellowCards: 0, redCards: 0 };
  }
}

function parseESPNScheduleEvents(
  events: Record<string, unknown>[],
  espnTeamId: string,
): RecentMatch[] {
  const results: RecentMatch[] = [];

  for (const event of events) {
    const competitions = (event.competitions as Record<string, unknown>[]) || [];
    if (!competitions.length) continue;
    const comp = competitions[0] as Record<string, unknown>;
    const statusType = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>) || {};
    const statusDesc = (statusType.description as string) || '';
    if (statusDesc !== 'Full Time' && statusDesc !== 'Final') continue;

    const competitors = (comp.competitors as Record<string, unknown>[]) || [];
    const homeTeam = competitors.find(t => (t as Record<string, unknown>).homeAway === 'home') as Record<string, unknown> | undefined;
    const awayTeam = competitors.find(t => (t as Record<string, unknown>).homeAway === 'away') as Record<string, unknown> | undefined;
    if (!homeTeam || !awayTeam) continue;

    const getScore = (c: Record<string, unknown>): number => {
      const s = c.score;
      if (!s) return 0;
      if (typeof s === 'object' && s !== null) return Number((s as Record<string, unknown>).value || 0);
      return Number(s) || 0;
    };

    const homeScore = getScore(homeTeam);
    const awayScore = getScore(awayTeam);
    const homeTeamData = homeTeam.team as Record<string, unknown>;
    const awayTeamData = awayTeam.team as Record<string, unknown>;
    const isHome = String(homeTeamData?.id || '') === espnTeamId;
    const myScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    let result: 'W' | 'D' | 'L' = 'D';
    if (myScore > oppScore) result = 'W';
    else if (myScore < oppScore) result = 'L';

    const dateStr = (event.date as string || '').slice(0, 10);
    const eventId = String(event.id || '');

    // Tenta extrair corners/cartões inline (quando ESPN inclui no schedule)
    const stats = (comp.statistics as Record<string, unknown>[]) || [];
    const getInlineStat = (label: string) => {
      const s = stats.find(s => String((s as Record<string, unknown>).label || '').toLowerCase().includes(label));
      return s ? parseFloat(String((s as Record<string, unknown>).value || '0')) || 0 : 0;
    };

    results.push({
      idEvent: eventId,
      strEvent: `${homeTeamData?.displayName} vs ${awayTeamData?.displayName}`,
      dateEvent: dateStr,
      homeTeam: String(homeTeamData?.displayName || ''),
      awayTeam: String(awayTeamData?.displayName || ''),
      homeScore,
      awayScore,
      isHome,
      result,
      totalGoals: homeScore + awayScore,
      corners: getInlineStat('corner'),
      yellowCards: getInlineStat('yellow'),
      redCards: getInlineStat('red'),
    });
  }

  return results;
}

export async function getTeamHistoryESPN(espnTeamId: string, espnLeagueId?: string): Promise<RecentMatch[]> {
  if (!espnTeamId) return [];

  // Calcula as 3 temporadas a buscar (atual + 2 anteriores)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  // Temporada europeia começa em agosto — se antes de agosto, temporada atual = ano-1
  const baseSeason = currentMonth < 8 ? currentYear - 1 : currentYear;
  const seasons = [baseSeason, baseSeason - 1, baseSeason - 2];

  try {
    // Busca todas as temporadas em paralelo
    const seasonPromises = seasons.map(season =>
      fetchESPN<{ events: Record<string, unknown>[] }>(
        `${ESPN_BASE}/all/teams/${espnTeamId}/schedule?season=${season}`
      )
    );

    const seasonResults = await Promise.allSettled(seasonPromises);

    const allEvents: Record<string, unknown>[] = [];
    for (const r of seasonResults) {
      if (r.status === 'fulfilled' && r.value?.events) {
        allEvents.push(...r.value.events);
      }
    }

    if (allEvents.length === 0) return [];

    // Ordena por data DESC (mais recente primeiro) e remove duplicatas
    const seenIds = new Set<string>();
    const uniqueEvents = allEvents
      .filter(e => {
        const id = String(e.id || '');
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .sort((a, b) => {
        const da = (a.date as string || '').slice(0, 10);
        const db = (b.date as string || '').slice(0, 10);
        return db.localeCompare(da);
      });

    // Converte para RecentMatch (extrai corners/cartões inline quando disponível)
    const parsed = parseESPNScheduleEvents(uniqueEvents, espnTeamId);

    // Enriquece os 15 mais recentes com corners/cartões do ESPN summary
    // Executa em lotes de 4 paralelos para não saturar a API
    // Bloqueia até os primeiros 8 (dados críticos para o modelo), demais são fire-and-forget
    const needEnrich = parsed.slice(0, 15).filter(m => m.corners === 0 && m.yellowCards === 0);
    if (needEnrich.length > 0) {
      const batchSize = 4;
      const criticalBatch  = needEnrich.slice(0, 8);   // aguarda estes
      const remainingBatch = needEnrich.slice(8);       // fire-and-forget

      const applyStats = (m: RecentMatch) =>
        fetchESPNEventStats(m.idEvent, espnTeamId).then(stats => {
          if (stats.corners > 0 || stats.yellowCards > 0) {
            m.corners     = stats.corners;
            m.yellowCards = stats.yellowCards;
            m.redCards    = stats.redCards;
          }
        });

      // Processa em lotes para não abrir 8 conexões simultâneas
      for (let i = 0; i < criticalBatch.length; i += batchSize) {
        await Promise.allSettled(criticalBatch.slice(i, i + batchSize).map(applyStats));
      }

      // Fire-and-forget para os demais
      if (remainingBatch.length > 0) {
        Promise.allSettled(remainingBatch.map(applyStats)).catch(() => undefined);
      }
    }

    // Retorna os 30 mais recentes — com stats enriquecidos para os 15 primeiros
    return parsed.slice(0, 30);
  } catch {
    return [];
  }
}

async function fetchWithProxy<T>(url: string): Promise<T> {
  const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
  const response = await fetch(proxiedUrl, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchDirect<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchApi<T>(url: string): Promise<T> {
  try {
    return await fetchDirect<T>(url);
  } catch {
    return await fetchWithProxy<T>(url);
  }
}

// ============================================================
// LEAGUE CONFIGURATION
// ============================================================
// FEATURED_LEAGUES moved to leagues.ts to prevent cross-chunk TDZ in Rollup
export { FEATURED_LEAGUES } from './leagues';

// League-specific averages for better calibration
// homeAdv = multiplicador de vantagem em casa por liga (baseado em dados históricos reais)
// Ligas físicas (Sul América, Turquia, Grécia) = 1.18-1.22 | Top 5 = 1.10-1.14
const LEAGUE_PROFILES: Record<string, { avgGoals: number; avgCards: number; avgCorners: number; aggressionFactor: number; homeAdv: number }> = {
  // Europa — Top 5
  '3918': { avgGoals: 2.82, avgCards: 3.2, avgCorners: 10.5, aggressionFactor: 0.85, homeAdv: 1.14 }, // EPL
  '740':  { avgGoals: 2.52, avgCards: 4.1, avgCorners: 9.8,  aggressionFactor: 1.10, homeAdv: 1.15 }, // La Liga
  '720':  { avgGoals: 3.05, avgCards: 3.0, avgCorners: 10.2, aggressionFactor: 0.80, homeAdv: 1.12 }, // Bundesliga
  '730':  { avgGoals: 2.65, avgCards: 4.3, avgCorners: 9.5,  aggressionFactor: 1.15, homeAdv: 1.16 }, // Serie A
  '710':  { avgGoals: 2.71, avgCards: 3.8, avgCorners: 9.7,  aggressionFactor: 1.00, homeAdv: 1.13 }, // Ligue 1
  // Europa — 2ªs divisões
  '3919': { avgGoals: 2.60, avgCards: 3.5, avgCorners: 10.1, aggressionFactor: 0.92, homeAdv: 1.13 }, // Championship
  '3927': { avgGoals: 2.88, avgCards: 3.2, avgCorners: 9.9,  aggressionFactor: 0.85, homeAdv: 1.11 }, // 2. Bundesliga
  '3921': { avgGoals: 2.41, avgCards: 4.4, avgCorners: 9.3,  aggressionFactor: 1.12, homeAdv: 1.16 }, // Segunda División
  '3931': { avgGoals: 2.55, avgCards: 4.0, avgCorners: 9.4,  aggressionFactor: 1.05, homeAdv: 1.14 }, // Ligue 2
  '3930': { avgGoals: 2.48, avgCards: 4.5, avgCorners: 9.1,  aggressionFactor: 1.18, homeAdv: 1.17 }, // Serie B
  // Europa — Outras ligas
  '725':  { avgGoals: 3.10, avgCards: 3.1, avgCorners: 10.3, aggressionFactor: 0.82, homeAdv: 1.12 }, // Eredivisie
  '715':  { avgGoals: 2.58, avgCards: 3.9, avgCorners: 9.6,  aggressionFactor: 1.05, homeAdv: 1.14 }, // Primeira Liga
  '750':  { avgGoals: 2.77, avgCards: 4.6, avgCorners: 9.4,  aggressionFactor: 1.20, homeAdv: 1.20 }, // Süper Lig
  '755':  { avgGoals: 2.92, avgCards: 3.6, avgCorners: 10.0, aggressionFactor: 0.92, homeAdv: 1.12 }, // Pro League
  '735':  { avgGoals: 2.68, avgCards: 3.5, avgCorners: 9.8,  aggressionFactor: 0.90, homeAdv: 1.13 }, // Scottish Prem
  '745':  { avgGoals: 2.61, avgCards: 4.2, avgCorners: 9.2,  aggressionFactor: 1.08, homeAdv: 1.16 }, // Russian PL
  '3924': { avgGoals: 2.85, avgCards: 3.4, avgCorners: 9.7,  aggressionFactor: 0.90, homeAdv: 1.13 }, // Áustria
  '3922': { avgGoals: 2.55, avgCards: 4.5, avgCorners: 9.0,  aggressionFactor: 1.18, homeAdv: 1.18 }, // Grécia
  '3923': { avgGoals: 2.60, avgCards: 3.8, avgCorners: 9.3,  aggressionFactor: 1.00, homeAdv: 1.14 }, // Chéquia
  '3926': { avgGoals: 2.72, avgCards: 3.5, avgCorners: 9.5,  aggressionFactor: 0.92, homeAdv: 1.12 }, // Dinamarca
  '3933': { avgGoals: 2.58, avgCards: 3.9, avgCorners: 9.2,  aggressionFactor: 1.02, homeAdv: 1.15 }, // Polônia
  '3936': { avgGoals: 2.50, avgCards: 4.1, avgCorners: 9.0,  aggressionFactor: 1.08, homeAdv: 1.16 }, // Romênia
  '3937': { avgGoals: 2.48, avgCards: 4.3, avgCorners: 9.1,  aggressionFactor: 1.10, homeAdv: 1.17 }, // Sérvia
  '3938': { avgGoals: 2.78, avgCards: 3.3, avgCorners: 9.6,  aggressionFactor: 0.88, homeAdv: 1.11 }, // Suécia
  '3939': { avgGoals: 2.85, avgCards: 3.2, avgCorners: 9.8,  aggressionFactor: 0.85, homeAdv: 1.11 }, // Suíça
  '3940': { avgGoals: 2.55, avgCards: 4.2, avgCorners: 9.1,  aggressionFactor: 1.10, homeAdv: 1.17 }, // Ucrânia
  '4326': { avgGoals: 2.90, avgCards: 3.2, avgCorners: 9.7,  aggressionFactor: 0.86, homeAdv: 1.12 }, // Noruega
  '4343': { avgGoals: 2.82, avgCards: 3.1, avgCorners: 9.5,  aggressionFactor: 0.87, homeAdv: 1.11 }, // Finlândia
  // Competições europeias e globais
  '23':   { avgGoals: 2.95, avgCards: 3.3, avgCorners: 10.8, aggressionFactor: 0.90, homeAdv: 1.10 }, // UCL
  '2':    { avgGoals: 2.80, avgCards: 3.5, avgCorners: 10.3, aggressionFactor: 0.93, homeAdv: 1.10 }, // UEL
  '40':   { avgGoals: 2.75, avgCards: 3.4, avgCorners: 10.1, aggressionFactor: 0.94, homeAdv: 1.09 }, // UECL
  '776':  { avgGoals: 2.80, avgCards: 3.5, avgCorners: 10.3, aggressionFactor: 0.93, homeAdv: 1.10 },
  '20296':{ avgGoals: 2.75, avgCards: 3.4, avgCorners: 10.1, aggressionFactor: 0.94, homeAdv: 1.09 },
  '21':   { avgGoals: 2.72, avgCards: 4.1, avgCorners: 9.6,  aggressionFactor: 1.05, homeAdv: 1.14 }, // Libertadores
  '22':   { avgGoals: 2.60, avgCards: 4.2, avgCorners: 9.3,  aggressionFactor: 1.08, homeAdv: 1.14 }, // Sudamericana
  // Américas
  '4351': { avgGoals: 2.45, avgCards: 4.5, avgCorners: 9.0,  aggressionFactor: 1.20, homeAdv: 1.20 }, // Brasileirão A
  '4352': { avgGoals: 2.38, avgCards: 4.6, avgCorners: 8.8,  aggressionFactor: 1.22, homeAdv: 1.22 }, // Série B
  '4353': { avgGoals: 2.30, avgCards: 4.7, avgCorners: 8.5,  aggressionFactor: 1.25, homeAdv: 1.24 }, // Série C
  '4356': { avgGoals: 2.68, avgCards: 4.4, avgCorners: 9.1,  aggressionFactor: 1.18, homeAdv: 1.21 }, // Argentina
  '4358': { avgGoals: 2.52, avgCards: 4.3, avgCorners: 8.9,  aggressionFactor: 1.15, homeAdv: 1.19 }, // Chile
  '4357': { avgGoals: 2.60, avgCards: 4.5, avgCorners: 8.8,  aggressionFactor: 1.20, homeAdv: 1.21 }, // Colômbia
  '4359': { avgGoals: 2.55, avgCards: 4.4, avgCorners: 8.7,  aggressionFactor: 1.18, homeAdv: 1.20 }, // Peru
  '4355': { avgGoals: 2.62, avgCards: 4.3, avgCorners: 8.9,  aggressionFactor: 1.15, homeAdv: 1.19 }, // Uruguai
  '4354': { avgGoals: 2.58, avgCards: 4.5, avgCorners: 8.8,  aggressionFactor: 1.20, homeAdv: 1.20 }, // Venezuela
  '4360': { avgGoals: 2.48, avgCards: 4.6, avgCorners: 8.6,  aggressionFactor: 1.22, homeAdv: 1.22 }, // Bolívia
  '770':  { avgGoals: 2.85, avgCards: 3.1, avgCorners: 10.0, aggressionFactor: 0.90, homeAdv: 1.13 }, // MLS
  '760':  { avgGoals: 2.60, avgCards: 4.2, avgCorners: 9.3,  aggressionFactor: 1.10, homeAdv: 1.17 }, // Liga MX
  '630':  { avgGoals: 2.50, avgCards: 4.4, avgCorners: 9.0,  aggressionFactor: 1.18, homeAdv: 1.18 }, // Copa do Brasil
  '660':  { avgGoals: 2.55, avgCards: 4.5, avgCorners: 8.8,  aggressionFactor: 1.20, homeAdv: 1.20 }, // Ecuador
  '8306': { avgGoals: 2.65, avgCards: 4.3, avgCorners: 8.9,  aggressionFactor: 1.15, homeAdv: 1.20 }, // Carioca
  // Ásia e Oceania
  '21231':{ avgGoals: 2.87, avgCards: 4.0, avgCorners: 9.7,  aggressionFactor: 1.00, homeAdv: 1.15 }, // Saudi
  '8316': { avgGoals: 2.54, avgCards: 3.7, avgCorners: 8.9,  aggressionFactor: 0.96, homeAdv: 1.14 }, // ISL
  '3906': { avgGoals: 2.96, avgCards: 3.4, avgCorners: 10.6, aggressionFactor: 0.88, homeAdv: 1.12 }, // A-League
  '18992':{ avgGoals: 3.08, avgCards: 2.9, avgCorners: 10.1, aggressionFactor: 0.82, homeAdv: 1.10 }, // A-League W
  '23537':{ avgGoals: 2.73, avgCards: 4.0, avgCorners: 9.4,  aggressionFactor: 1.02, homeAdv: 1.13 }, // AFC
  '4803': { avgGoals: 2.80, avgCards: 3.2, avgCorners: 10.1, aggressionFactor: 0.85, homeAdv: 1.12 }, // J1 League
  '4804': { avgGoals: 2.65, avgCards: 3.5, avgCorners: 9.8,  aggressionFactor: 0.92, homeAdv: 1.13 }, // K League
  '4805': { avgGoals: 2.72, avgCards: 4.0, avgCorners: 9.5,  aggressionFactor: 1.05, homeAdv: 1.16 }, // China SL
  '4820': { avgGoals: 2.80, avgCards: 4.1, avgCorners: 9.3,  aggressionFactor: 1.05, homeAdv: 1.18 }, // Qatar
  '4821': { avgGoals: 2.75, avgCards: 4.0, avgCorners: 9.2,  aggressionFactor: 1.03, homeAdv: 1.17 }, // UAE
  // Eliminatórias e seleções
  '15':   { avgGoals: 2.58, avgCards: 3.9, avgCorners: 8.8,  aggressionFactor: 0.98, homeAdv: 1.12 },
  '30':   { avgGoals: 2.47, avgCards: 3.8, avgCorners: 8.7,  aggressionFactor: 0.99, homeAdv: 1.11 },
  '31':   { avgGoals: 2.64, avgCards: 3.6, avgCorners: 8.9,  aggressionFactor: 0.94, homeAdv: 1.11 },
  '10':   { avgGoals: 2.55, avgCards: 4.2, avgCorners: 8.8,  aggressionFactor: 1.10, homeAdv: 1.15 }, // CONMEBOL Elim
  '11':   { avgGoals: 2.45, avgCards: 3.5, avgCorners: 9.0,  aggressionFactor: 0.95, homeAdv: 1.11 }, // UEFA Elim
  '8345': { avgGoals: 2.55, avgCards: 4.5, avgCorners: 8.7,  aggressionFactor: 1.18, homeAdv: 1.19 }, // CAF CL
  // ── Seleções nacionais e torneios FIFA ───────────────────────────────────
  '4':    { avgGoals: 2.48, avgCards: 3.2, avgCorners: 9.4,  aggressionFactor: 0.92, homeAdv: 1.08 }, // FIFA World Cup
  '7':    { avgGoals: 2.55, avgCards: 4.1, avgCorners: 8.9,  aggressionFactor: 1.10, homeAdv: 1.14 }, // Copa América
  '9':    { avgGoals: 2.50, avgCards: 3.4, avgCorners: 9.2,  aggressionFactor: 0.95, homeAdv: 1.10 }, // UEFA Nations League
  '12':   { avgGoals: 2.48, avgCards: 3.6, avgCorners: 8.8,  aggressionFactor: 0.98, homeAdv: 1.12 }, // CONCACAF Nations League
  '13':   { avgGoals: 2.52, avgCards: 3.8, avgCorners: 8.6,  aggressionFactor: 1.02, homeAdv: 1.13 }, // CONCACAF Gold Cup
  '14':   { avgGoals: 2.42, avgCards: 4.3, avgCorners: 8.4,  aggressionFactor: 1.12, homeAdv: 1.16 }, // Africa Cup of Nations
  '16':   { avgGoals: 2.70, avgCards: 3.0, avgCorners: 9.1,  aggressionFactor: 0.88, homeAdv: 1.06 }, // FIFA Amistosos
  '17':   { avgGoals: 2.44, avgCards: 3.3, avgCorners: 9.1,  aggressionFactor: 0.93, homeAdv: 1.09 }, // UEFA Euro
  '18':   { avgGoals: 2.90, avgCards: 3.0, avgCorners: 10.2, aggressionFactor: 0.85, homeAdv: 1.07 }, // FIFA Club World Cup
  '19':   { avgGoals: 2.55, avgCards: 3.2, avgCorners: 9.3,  aggressionFactor: 0.90, homeAdv: 1.08 }, // FIFA Confederations Cup
  '20':   { avgGoals: 2.60, avgCards: 3.5, avgCorners: 9.0,  aggressionFactor: 0.95, homeAdv: 1.10 }, // CONCACAF Champions Cup
  '26':   { avgGoals: 2.85, avgCards: 3.1, avgCorners: 9.8,  aggressionFactor: 0.88, homeAdv: 1.05 }, // UEFA Super Cup
  '27':   { avgGoals: 2.75, avgCards: 3.0, avgCorners: 9.5,  aggressionFactor: 0.87, homeAdv: 1.05 }, // FIFA Intercontinental Cup
  '28':   { avgGoals: 2.48, avgCards: 3.8, avgCorners: 8.8,  aggressionFactor: 1.00, homeAdv: 1.12 }, // CONCACAF Eliminatórias
  '29':   { avgGoals: 2.42, avgCards: 4.0, avgCorners: 8.6,  aggressionFactor: 1.05, homeAdv: 1.14 }, // CAF Eliminatórias
  // ── Copas nacionais europeias ─────────────────────────────────────────────
  '3916': { avgGoals: 2.75, avgCards: 3.0, avgCorners: 9.8,  aggressionFactor: 0.85, homeAdv: 1.10 }, // FA Cup
  '3920': { avgGoals: 2.85, avgCards: 3.2, avgCorners: 9.5,  aggressionFactor: 0.88, homeAdv: 1.10 }, // EFL Trophy
  '3925': { avgGoals: 2.70, avgCards: 3.0, avgCorners: 9.7,  aggressionFactor: 0.85, homeAdv: 1.10 }, // DFB-Pokal
  '3935': { avgGoals: 2.60, avgCards: 3.8, avgCorners: 9.5,  aggressionFactor: 1.05, homeAdv: 1.12 }, // Copa del Rey
  '3947': { avgGoals: 2.62, avgCards: 4.0, avgCorners: 9.3,  aggressionFactor: 1.10, homeAdv: 1.12 }, // Coppa Italia
  '3948': { avgGoals: 2.68, avgCards: 3.6, avgCorners: 9.4,  aggressionFactor: 0.98, homeAdv: 1.10 }, // Coupe de France
  '3949': { avgGoals: 2.55, avgCards: 3.8, avgCorners: 9.2,  aggressionFactor: 1.02, homeAdv: 1.12 }, // Taça de Portugal
  // ── Ligas europeias menores ───────────────────────────────────────────────
  '3941': { avgGoals: 2.58, avgCards: 3.8, avgCorners: 9.1,  aggressionFactor: 1.00, homeAdv: 1.14 }, // Fortuna Liga Eslováquia
  '3942': { avgGoals: 2.55, avgCards: 3.6, avgCorners: 9.0,  aggressionFactor: 0.96, homeAdv: 1.13 }, // PrvaLiga Eslovênia
  '3943': { avgGoals: 2.50, avgCards: 4.0, avgCorners: 8.8,  aggressionFactor: 1.08, homeAdv: 1.16 }, // Primera División El Salvador
  '3944': { avgGoals: 2.55, avgCards: 4.0, avgCorners: 9.0,  aggressionFactor: 1.06, homeAdv: 1.15 }, // Hrvatska liga (Croácia)
  '3945': { avgGoals: 2.48, avgCards: 4.2, avgCorners: 8.8,  aggressionFactor: 1.10, homeAdv: 1.16 }, // Parva Liga (Bulgária)
  '3946': { avgGoals: 2.60, avgCards: 3.2, avgCorners: 9.0,  aggressionFactor: 0.88, homeAdv: 1.12 }, // Úrvalsdeild (Islândia)
  '20956':{ avgGoals: 2.42, avgCards: 4.3, avgCorners: 9.1,  aggressionFactor: 1.12, homeAdv: 1.16 }, // Primera Federación (Espanha 3ª)
  '4300': { avgGoals: 2.55, avgCards: 3.3, avgCorners: 9.5,  aggressionFactor: 0.90, homeAdv: 1.12 }, // Welsh Premier League
  // ── Américas adicionais ───────────────────────────────────────────────────
  '650':  { avgGoals: 2.50, avgCards: 4.4, avgCorners: 8.9,  aggressionFactor: 1.18, homeAdv: 1.18 }, // Copa Colombia
  '3928': { avgGoals: 2.55, avgCards: 4.5, avgCorners: 8.6,  aggressionFactor: 1.22, homeAdv: 1.20 }, // Liga Nacional Guatemala
  '3929': { avgGoals: 2.50, avgCards: 4.6, avgCorners: 8.5,  aggressionFactor: 1.24, homeAdv: 1.22 }, // Liga Nacional Honduras
  '3932': { avgGoals: 2.58, avgCards: 4.2, avgCorners: 9.1,  aggressionFactor: 1.12, homeAdv: 1.18 }, // Liga de Expansión MX
  '3934': { avgGoals: 2.55, avgCards: 4.5, avgCorners: 8.7,  aggressionFactor: 1.20, homeAdv: 1.20 }, // División Profesional Paraguay
  '4399': { avgGoals: 2.45, avgCards: 4.5, avgCorners: 9.0,  aggressionFactor: 1.20, homeAdv: 1.20 }, // Brasileirão Série A (ID alt.)
  '4002': { avgGoals: 2.72, avgCards: 3.3, avgCorners: 9.8,  aggressionFactor: 0.92, homeAdv: 1.12 }, // USL Championship
  '19915':{ avgGoals: 2.65, avgCards: 3.4, avgCorners: 9.5,  aggressionFactor: 0.94, homeAdv: 1.12 }, // USL League One
  '23633':{ avgGoals: 2.68, avgCards: 3.2, avgCorners: 9.6,  aggressionFactor: 0.92, homeAdv: 1.11 }, // USL Super League
  '5699': { avgGoals: 2.88, avgCards: 3.0, avgCorners: 10.0, aggressionFactor: 0.88, homeAdv: 1.10 }, // Leagues Cup (MLS vs Liga MX)
  // ── Ásia adicionais ───────────────────────────────────────────────────────
  '4822': { avgGoals: 2.72, avgCards: 4.0, avgCorners: 9.1,  aggressionFactor: 1.05, homeAdv: 1.18 }, // Kuwait Premier League
  '18505':{ avgGoals: 2.65, avgCards: 3.5, avgCorners: 8.8,  aggressionFactor: 0.95, homeAdv: 1.14 }, // Durand Cup (Índia)
};

type LeagueProfile = { avgGoals: number; avgCards: number; avgCorners: number; aggressionFactor: number; homeAdv: number };
const DEFAULT_LEAGUE_PROFILE: LeagueProfile = { avgGoals: 2.65, avgCards: 3.5, avgCorners: 9.8, aggressionFactor: 1.0, homeAdv: 1.12 };

function getLeagueProfile(leagueId?: string): LeagueProfile {
  if (!leagueId) return DEFAULT_LEAGUE_PROFILE;
  return (LEAGUE_PROFILES as Record<string, LeagueProfile>)[leagueId] ?? DEFAULT_LEAGUE_PROFILE;
}

// ============================================================
// API CALLS
// ============================================================
export async function getMatchesByDate(date: string): Promise<Match[]> {
  try {
    const url = `${SPORTSDB_BASE}/eventsday.php?d=${date}&s=Soccer`;
    const data = await fetchApi<{ events: Match[] | null }>(url);
    return data.events || [];
  } catch (error) {
    console.error('Error fetching matches by date:', error);
    return [];
  }
}

export async function getTeamLastEvents(teamId: string): Promise<Match[]> {
  try {
    const url = `${SPORTSDB_BASE}/eventslast.php?id=${teamId}`;
    const data = await fetchApi<{ results: Match[] | null }>(url);
    return data.results || [];
  } catch (error) {
    console.error('Error fetching team last events:', error);
    return [];
  }
}

export async function getTeamPróximoEvents(teamId: string): Promise<Match[]> {
  try {
    const url = `${SPORTSDB_BASE}/eventsnext.php?id=${teamId}`;
    const data = await fetchApi<{ events: Match[] | null }>(url);
    return data.events || [];
  } catch (error) {
    return [];
  }
}

// ============================================================
// MATH UTILITIES
// ============================================================

// Dixon-Coles (1997) tau correction for low-score cell adjustment.
// Corrects systematic over/under-prediction of 0-0, 1-0, 0-1, 1-1 by independent Poisson.
// rho = -0.13 is calibrated on large historical football datasets.
const DC_RHO = -0.13;
function dixonColesTau(x: number, y: number, lH: number, lA: number): number {
  if (x === 0 && y === 0) return 1 - lH * lA * DC_RHO;
  if (x === 1 && y === 0) return 1 + lA * DC_RHO;
  if (x === 0 && y === 1) return 1 + lH * DC_RHO;
  if (x === 1 && y === 1) return 1 - DC_RHO;
  return 1;
}

// Poisson probability P(X = k)
function poissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let result = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) result *= lambda / i;
  return Math.max(0, result);
}

// Cumulative Poisson P(X <= k)
function poissonCDF(lambda: number, k: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) sum += poissonProb(lambda, i);
  return Math.min(1, sum);
}

// P(X > k) = 1 - P(X <= k)
function poissonOver(lambda: number, k: number): number {
  return Math.max(0, 1 - poissonCDF(lambda, k));
}

// Negative Binomial for overdispersed counts (cards, corners)
function negBinomProb(mu: number, r: number, k: number): number {
  if (mu <= 0) return k === 0 ? 1 : 0;
  const p = r / (r + mu);
  let coeff = 1;
  for (let i = 0; i < k; i++) coeff *= (r + i) / (i + 1);
  return coeff * Math.pow(p, r) * Math.pow(1 - p, k);
}

function negBinomOver(mu: number, r: number, threshold: number): number {
  let cdf = 0;
  for (let k = 0; k <= threshold; k++) cdf += negBinomProb(mu, r, k);
  return Math.max(0, 1 - cdf);
}

// Round to 1 decimal
function r1(v: number): number { return Math.round(v * 10) / 10; }
// Round to 2 decimals
function r2(v: number): number { return Math.round(v * 100) / 100; }
// Clamp to [0,100]
function pct(v: number): number { return Math.max(0, Math.min(100, Math.round(v * 1000) / 10)); }

// ============================================================
// TEAM STATS CALCULATION
// ============================================================
function parseMatchToRecent(match: Match, teamId: string): RecentMatch | null {
  if (match.intHomeScore === null || match.intHomeScore === undefined ||
      match.intAwayScore === null || match.intAwayScore === undefined) return null;
  const hs = parseInt(String(match.intHomeScore));
  const as_ = parseInt(String(match.intAwayScore));
  if (isNaN(hs) || isNaN(as_)) return null;
  const isHome = match.idHomeTeam === teamId;
  let result: 'W' | 'D' | 'L';
  if (hs === as_) result = 'D';
  else if (isHome) result = hs > as_ ? 'W' : 'L';
  else result = as_ > hs ? 'W' : 'L';
  return {
    idEvent: match.idEvent,
    strEvent: match.strEvent,
    dateEvent: match.dateEvent,
    homeTeam: match.strHomeTeam,
    awayTeam: match.strAwayTeam,
    homeScore: hs,
    awayScore: as_,
    isHome,
    result,
    totalGoals: hs + as_,
    league: match.strLeague,
  };
}

export function calculateTeamStats(teamId: string, teamName: string, recentMatches: (Match | RecentMatch)[], leagueId?: string): TeamStats {
  const lp = getLeagueProfile(leagueId);
  const parsed = recentMatches
    .map(m => {
      // Se já é um RecentMatch (tem campo 'result'), usa diretamente
      if ('result' in m && 'homeScore' in m) return m as RecentMatch;
      // Senão, converte de Match para RecentMatch
      return parseMatchToRecent(m as Match, teamId);
    })
    .filter((m): m is RecentMatch => m !== null);

  if (parsed.length === 0) return getDefaultStats(teamId, teamName, lp);

  const n = parsed.length;
  const blend = Math.min(n / 6, 1); // Blend factor: full weight at 6+ matches

  // Split home/away
  const homeM = parsed.filter(m => m.isHome);
  const awayM = parsed.filter(m => !m.isHome);

  // Goals
  const goalsScored = parsed.map(m => m.isHome ? m.homeScore : m.awayScore);
  const goalsConceded = parsed.map(m => m.isHome ? m.awayScore : m.homeScore);
  const avgGS = goalsScored.reduce((a, b) => a + b, 0) / n;
  const avgGC = goalsConceded.reduce((a, b) => a + b, 0) / n;
  const leagueAvgGoals = lp.avgGoals / 2;

  const avgGSHome = homeM.length > 0 ? homeM.reduce((s, m) => s + m.homeScore, 0) / homeM.length : leagueAvgGoals * 1.1;
  const avgGSAway = awayM.length > 0 ? awayM.reduce((s, m) => s + m.awayScore, 0) / awayM.length : leagueAvgGoals * 0.9;
  const avgGCHome = homeM.length > 0 ? homeM.reduce((s, m) => s + m.awayScore, 0) / homeM.length : leagueAvgGoals * 0.9;
  const avgGCAway = awayM.length > 0 ? awayM.reduce((s, m) => s + m.homeScore, 0) / awayM.length : leagueAvgGoals * 1.1;

  // Results
  const wins = parsed.filter(m => m.result === 'W').length;
  const draws = parsed.filter(m => m.result === 'D').length;
  const losses = parsed.filter(m => m.result === 'L').length;
  const homeWins = homeM.filter(m => m.result === 'W').length;
  const awayWins = awayM.filter(m => m.result === 'W').length;
  const homeDraws = homeM.filter(m => m.result === 'D').length;
  const awayDraws = awayM.filter(m => m.result === 'D').length;

  // Special stats
  const btts = parsed.filter(m => m.homeScore > 0 && m.awayScore > 0).length;
  const over05 = parsed.filter(m => m.totalGoals > 0.5).length;
  const over15 = parsed.filter(m => m.totalGoals > 1.5).length;
  const over25 = parsed.filter(m => m.totalGoals > 2.5).length;
  const over35 = parsed.filter(m => m.totalGoals > 3.5).length;
  const over45 = parsed.filter(m => m.totalGoals > 4.5).length;
  const cleanSheets = parsed.filter(m => m.isHome ? m.awayScore === 0 : m.homeScore === 0).length;
  const failedToScore = parsed.filter(m => m.isHome ? m.homeScore === 0 : m.awayScore === 0).length;

  // Form (last 5)
  const form = parsed.slice(0, 5).map(m => m.result);

  // Form points (W=3, D=1, L=0) with recency weighting
  const weights = [3, 2.5, 2, 1.5, 1];
  let formPoints = 0;
  let maxPoints = 0;
  form.slice(0, 5).forEach((r, i) => {
    const w = weights[i] || 1;
    maxPoints += 3 * w;
    formPoints += (r === 'W' ? 3 : r === 'D' ? 1 : 0) * w;
  });
  const formScore = maxPoints > 0 ? formPoints / maxPoints : 0.5;

  // Momentum: compare last 3 vs previous 3
  const recent3 = parsed.slice(0, 3);
  const prev3 = parsed.slice(3, 6);
  const pts3 = (m: RecentMatch[]) => m.reduce((s, r) => s + (r.result === 'W' ? 3 : r.result === 'D' ? 1 : 0), 0);
  const momentum = prev3.length > 0 ? (pts3(recent3) - pts3(prev3)) / 9 : 0;

  // Streaks
  let scoringStreak = 0, concedingStreak = 0, winStreak = 0, unbeatenStreak = 0;
  for (const m of parsed) {
    const scored = m.isHome ? m.homeScore : m.awayScore;
    const conceded = m.isHome ? m.awayScore : m.homeScore;
    if (scored > 0) scoringStreak++; else break;
  }
  for (const m of parsed) {
    if (m.isHome ? m.awayScore > 0 : m.homeScore > 0) concedingStreak++; else break;
  }
  for (const m of parsed) {
    if (m.result === 'W') winStreak++; else break;
  }
  for (const m of parsed) {
    if (m.result !== 'L') unbeatenStreak++; else break;
  }

  // ── Corners: usa dados reais quando disponíveis, estima quando não ────────
  // Dados reais vêm do enriquecimento ESPN summary (fetchESPNEventStats)
  const cornersBase = lp.avgCorners;
  const teamCornerBase = cornersBase / 2;

  const matchesWithRealCorners = parsed.filter(m => (m.corners ?? 0) > 0);
  const realCornersBlend = Math.min(matchesWithRealCorners.length / 6, 1); // peso total com 6+ jogos

  // Corners reais separados por casa/fora
  const homeMWithCorners = matchesWithRealCorners.filter(m => m.isHome);
  const awayMWithCorners = matchesWithRealCorners.filter(m => !m.isHome);

  const realCornersForHome = homeMWithCorners.length > 0
    ? homeMWithCorners.reduce((s, m) => s + (m.corners ?? 0), 0) / homeMWithCorners.length
    : 0;
  const realCornersForAway = awayMWithCorners.length > 0
    ? awayMWithCorners.reduce((s, m) => s + (m.corners ?? 0), 0) / awayMWithCorners.length
    : 0;
  const realCornersForAvg = matchesWithRealCorners.length > 0
    ? matchesWithRealCorners.reduce((s, m) => s + (m.corners ?? 0), 0) / matchesWithRealCorners.length
    : 0;

  // Estimativa baseada em estilo de ataque (fallback quando não há dados reais)
  const goalAttackRatio = clamp(avgGS / Math.max(lp.avgGoals / 2, 0.8), 0.65, 1.35);
  const goalDefenseRatio = clamp(avgGC / Math.max(lp.avgGoals / 2, 0.8), 0.7, 1.3);
  const estimatedCornersFor = clamp(teamCornerBase * (0.74 + goalAttackRatio * 0.26), teamCornerBase * 0.68, teamCornerBase * 1.34);
  const estimatedCornersAgainst = clamp(teamCornerBase * (0.76 + goalDefenseRatio * 0.24), teamCornerBase * 0.7, teamCornerBase * 1.3);

  // Blend: real * peso + estimado * (1 - peso)
  const cornersFor = realCornersBlend > 0
    ? clamp(realCornersForAvg * realCornersBlend + estimatedCornersFor * (1 - realCornersBlend), teamCornerBase * 0.5, teamCornerBase * 1.5)
    : estimatedCornersFor;
  const cornersAgainst = estimatedCornersAgainst; // cornersAgainst não temos dado direto (são os corners DO adversário)

  // ── Cartões: usa dados reais quando disponíveis ───────────────────────────
  const matchesWithRealCards = parsed.filter(m => (m.yellowCards ?? 0) > 0 || (m.redCards ?? 0) > 0);
  const realCardsBlend = Math.min(matchesWithRealCards.length / 6, 1);

  const realAvgYellow = matchesWithRealCards.length > 0
    ? matchesWithRealCards.reduce((s, m) => s + (m.yellowCards ?? 0), 0) / matchesWithRealCards.length
    : 0;
  const realAvgRed = matchesWithRealCards.length > 0
    ? matchesWithRealCards.reduce((s, m) => s + (m.redCards ?? 0), 0) / matchesWithRealCards.length
    : 0;

  // Estimativa de cartões por resultado + agressividade da liga (fallback)
  const lossRate = losses / n;
  const aggressionBase = lp.avgCards / 2;
  const estimatedYellow = (aggressionBase + lossRate * 1.2) * lp.aggressionFactor;
  const estimatedRed = estimatedYellow * 0.06;

  const avgYellow = realCardsBlend > 0
    ? realAvgYellow * realCardsBlend + estimatedYellow * (1 - realCardsBlend)
    : estimatedYellow;
  const avgRed = realCardsBlend > 0
    ? realAvgRed * realCardsBlend + estimatedRed * (1 - realCardsBlend)
    : estimatedRed;

  const avgYellowHome = avgYellow * 0.85; // Menos cartões em casa
  const avgYellowAway = avgYellow * 1.15; // Mais cartões fora

  // Attack/Defense strength (relative to league average)
  const attackStrength = avgGS / leagueAvgGoals;
  const defenseStrength = avgGC / leagueAvgGoals;

  // First/second half goal rates (estimated)
  const goalsFirstHalfRate = 0.42 + (avgGS > leagueAvgGoals ? 0.03 : -0.03);
  const goalsSecondHalfRate = 0.58 + (avgGS > leagueAvgGoals ? 0.03 : -0.03);

  // Data quality: base pelo número de jogos + bônus por dados reais de escanteios/cartões
  // Máximo 10, onde: 6+ jogos = base 9, + até 1 ponto pelo share de dados reais de corners
  const baseQuality = Math.min(9, n * 1.5);
  const realDataBonus = Math.min(1, (realCornersBlend * 0.6 + realCardsBlend * 0.4));
  const dataQuality = Math.min(10, baseQuality + realDataBonus);

  return {
    idTeam: teamId,
    strTeam: teamName,
    recentMatches: parsed,
    avgGoalsScored: avgGS * blend + leagueAvgGoals * (1 - blend),
    avgGoalsConceded: avgGC * blend + leagueAvgGoals * (1 - blend),
    avgGoalsScoredHome: avgGSHome * blend + leagueAvgGoals * 1.1 * (1 - blend),
    avgGoalsScoredAway: avgGSAway * blend + leagueAvgGoals * 0.9 * (1 - blend),
    avgGoalsConcededHome: avgGCHome * blend + leagueAvgGoals * 0.9 * (1 - blend),
    avgGoalsConcededAway: avgGCAway * blend + leagueAvgGoals * 1.1 * (1 - blend),
    avgCornersFor: cornersFor,
    avgCornersAgainst: cornersAgainst,
    avgCornersForHome: realCornersForHome > 0
      ? clamp(realCornersForHome * realCornersBlend + estimatedCornersFor * 1.08 * (1 - realCornersBlend), teamCornerBase * 0.5, teamCornerBase * 1.6)
      : cornersFor * 1.06,
    avgCornersForAway: realCornersForAway > 0
      ? clamp(realCornersForAway * realCornersBlend + estimatedCornersFor * 0.94 * (1 - realCornersBlend), teamCornerBase * 0.4, teamCornerBase * 1.5)
      : cornersFor * 0.94,
    cornersDataQuality: realCornersBlend,
    avgYellowCards: avgYellow,
    avgRedCards: avgRed,
    avgYellowCardsHome: avgYellowHome,
    avgYellowCardsAway: avgYellowAway,
    avgTotalCardsPerGame: avgYellow + avgRed,
    winRate: (wins / n) * blend + 0.4 * (1 - blend),
    drawRate: (draws / n) * blend + 0.25 * (1 - blend),
    lossRate: (losses / n) * blend + 0.35 * (1 - blend),
    homeWinRate: homeM.length > 0 ? (homeWins / homeM.length) * blend + 0.5 * (1 - blend) : 0.5,
    awayWinRate: awayM.length > 0 ? (awayWins / awayM.length) * blend + 0.3 * (1 - blend) : 0.3,
    homeDrawRate: homeM.length > 0 ? (homeDraws / homeM.length) * blend + 0.25 * (1 - blend) : 0.25,
    awayDrawRate: awayM.length > 0 ? (awayDraws / awayM.length) * blend + 0.25 * (1 - blend) : 0.25,
    bttsRate: (btts / n) * blend + 0.5 * (1 - blend),
    over05Rate: (over05 / n) * blend + 0.9 * (1 - blend),
    over15Rate: (over15 / n) * blend + 0.7 * (1 - blend),
    over25Rate: (over25 / n) * blend + 0.5 * (1 - blend),
    over35Rate: (over35 / n) * blend + 0.3 * (1 - blend),
    over45Rate: (over45 / n) * blend + 0.15 * (1 - blend),
    cleanSheetRate: (cleanSheets / n) * blend + 0.28 * (1 - blend),
    failedToScoreRate: (failedToScore / n) * blend + 0.22 * (1 - blend),
    form,
    formPoints: Math.round(formScore * 15),
    formMomentum: momentum,
    goalsFirstHalfRate,
    goalsSecondHalfRate,
    scoringStreak,
    concedingStreak,
    winStreak,
    unbeatenStreak,
    attackStrength,
    defenseStrength,
    aggressionIndex: clamp(
      lossRate * 0.35 +
      (avgYellow / Math.max(lp.avgCards / 2, 1)) * 0.45 +
      (avgRed / 0.12) * 0.20,   // avgRed normalizado por taxa típica
      0, 1
    ),
    dataQuality,
  };
}

function getDefaultStats(teamId: string, teamName: string, lp: ReturnType<typeof getLeagueProfile>): TeamStats {
  const leagueAvgGoals = lp.avgGoals / 2;
  return {
    idTeam: teamId, strTeam: teamName, recentMatches: [],
    avgGoalsScored: leagueAvgGoals, avgGoalsConceded: leagueAvgGoals,
    avgGoalsScoredHome: leagueAvgGoals * 1.1, avgGoalsScoredAway: leagueAvgGoals * 0.9,
    avgGoalsConcededHome: leagueAvgGoals * 0.9, avgGoalsConcededAway: leagueAvgGoals * 1.1,
    avgCornersFor: lp.avgCorners / 2, avgCornersAgainst: lp.avgCorners / 2,
    avgCornersForHome: lp.avgCorners / 2 * 1.06,
    avgCornersForAway: lp.avgCorners / 2 * 0.94,
    cornersDataQuality: 0,
    avgYellowCards: lp.avgCards / 2, avgRedCards: 0.08,
    avgYellowCardsHome: lp.avgCards * 0.42, avgYellowCardsAway: lp.avgCards * 0.58,
    avgTotalCardsPerGame: lp.avgCards / 2,
    winRate: 0.4, drawRate: 0.25, lossRate: 0.35,
    homeWinRate: 0.5, awayWinRate: 0.3, homeDrawRate: 0.25, awayDrawRate: 0.25,
    bttsRate: 0.5, over05Rate: 0.9, over15Rate: 0.7, over25Rate: 0.5,
    over35Rate: 0.3, over45Rate: 0.15, cleanSheetRate: 0.28, failedToScoreRate: 0.22,
    form: [], formPoints: 7, formMomentum: 0,
    goalsFirstHalfRate: 0.42, goalsSecondHalfRate: 0.58,
    scoringStreak: 0, concedingStreak: 0, winStreak: 0, unbeatenStreak: 0,
    attackStrength: 1.0, defenseStrength: 1.0, aggressionIndex: 0.5, dataQuality: 0,
  };
}

// ============================================================
// H2H CALCULATION
// ============================================================
export function calculateH2H(
  allMatches: (Match | RecentMatch)[],
  homeTeamId: string,
  awayTeamId: string,
  homeTeamName?: string,
  awayTeamName?: string
): HeadToHead {
  const normalizedHome = homeTeamName?.trim().toLowerCase();
  const normalizedAway = awayTeamName?.trim().toLowerCase();

  // Fuzzy match helper — strips accents, punctuation, short words
  const fuzzy = (s?: string) =>
    (s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ').filter(w => w.length > 2).join(' ');

  const fHome = fuzzy(homeTeamName);
  const fAway = fuzzy(awayTeamName);

  const nameMatchesHome = (a: string, b: string) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const fa = fuzzy(a), fb = fuzzy(b);
    if (fa === fb) return true;
    // Word overlap — at least one meaningful word in common
    const wa = fa.split(' '), wb = fb.split(' ');
    return wa.some(w => w.length > 3 && wb.includes(w));
  };

  const h2h = allMatches.filter(m => {
    if ('idHomeTeam' in m && m.idHomeTeam) {
      // Match by ID (exact)
      const byId =
        (m.idHomeTeam === homeTeamId && m.idAwayTeam === awayTeamId) ||
        (m.idHomeTeam === awayTeamId && m.idAwayTeam === homeTeamId);
      if (byId) return true;
    }

    // Fallback: fuzzy name match (catches cross-source duplicates)
    const rm = m as RecentMatch;
    if (!normalizedHome || !normalizedAway) return false;
    const mHome = rm.homeTeam?.trim().toLowerCase() || '';
    const mAway = rm.awayTeam?.trim().toLowerCase() || '';
    return (
      (nameMatchesHome(mHome, normalizedHome) && nameMatchesHome(mAway, normalizedAway)) ||
      (nameMatchesHome(mHome, normalizedAway) && nameMatchesHome(mAway, normalizedHome))
    );
  });

  const parsed: RecentMatch[] = h2h.map(m => {
    if ('intHomeScore' in m) return parseMatchToRecent(m as Match, homeTeamId);
    return m as RecentMatch;
  }).filter((m): m is RecentMatch => m !== null);

  if (parsed.length === 0) return {
    totalMatches: 0, homeWins: 0, draws: 0, awayWins: 0,
    homeGoals: 0, awayGoals: 0, avgTotalGoals: 2.5, bttsRate: 0.5,
    over25Rate: 0.5, avgCards: 3.5, recentMatches: [],
  };

  const homeWins = parsed.filter(m =>
    (nameMatchesHome(m.homeTeam, normalizedHome ?? '') && m.homeScore > m.awayScore) ||
    (nameMatchesHome(m.awayTeam, normalizedHome ?? '') && m.awayScore > m.homeScore)
  ).length;
  const draws = parsed.filter(m => m.result === 'D').length;
  const awayWins = parsed.filter(m =>
    (nameMatchesHome(m.homeTeam, normalizedAway ?? '') && m.homeScore > m.awayScore) ||
    (nameMatchesHome(m.awayTeam, normalizedAway ?? '') && m.awayScore > m.homeScore)
  ).length;

  const totalGoals = parsed.reduce((s, m) => s + m.totalGoals, 0);
  const btts = parsed.filter(m => m.homeScore > 0 && m.awayScore > 0).length;
  const over25 = parsed.filter(m => m.totalGoals > 2.5).length;

  // avgCards: usa dados reais de cartões quando disponíveis no histórico H2H
  const matchesWithCards = parsed.filter(m => (m.yellowCards ?? 0) > 0 || (m.redCards ?? 0) > 0);
  const realAvgCards = matchesWithCards.length > 0
    ? matchesWithCards.reduce((s, m) => s + (m.yellowCards ?? 0) + (m.redCards ?? 0) * 2, 0) / matchesWithCards.length
    : null;
  const avgCards = realAvgCards !== null
    ? Math.round(realAvgCards * 10) / 10
    : 3.5; // default liga média

  const homeGoals = parsed.reduce((sum, m) => {
    if (nameMatchesHome(m.homeTeam, normalizedHome ?? '')) return sum + m.homeScore;
    if (nameMatchesHome(m.awayTeam, normalizedHome ?? '')) return sum + m.awayScore;
    return sum;
  }, 0);

  const awayGoals = parsed.reduce((sum, m) => {
    if (nameMatchesHome(m.homeTeam, normalizedAway ?? '')) return sum + m.homeScore;
    if (nameMatchesHome(m.awayTeam, normalizedAway ?? '')) return sum + m.awayScore;
    return sum;
  }, 0);

  return {
    totalMatches: parsed.length,
    homeWins, draws, awayWins,
    homeGoals, awayGoals,
    avgTotalGoals: totalGoals / parsed.length,
    bttsRate: btts / parsed.length,
    over25Rate: over25 / parsed.length,
    avgCards,
    recentMatches: parsed.slice(0, 6),
  };
}

// ============================================================
// PREDICTIONS ENGINE (ULTRA DETAILED)
// ============================================================
export function calculatePredictions(
  homeStats: TeamStats,
  awayStats: TeamStats,
  isHomeGame: boolean = true,
  leagueId?: string,
  headToHead?: { avgTotalGoals: number; bttsRate: number; over25Rate: number; totalMatches: number }
): Predictions {
  const lp = getLeagueProfile(leagueId);
  const leagueAvgGoals = lp.avgGoals / 2;

  // ---- EXPECTED GOALS (Dixon-Coles model with per-league home advantage) ----
  const homeAdv = isHomeGame ? lp.homeAdv : 1.0;

  // Use home/away specific stats when available
  const homeAttack  = (isHomeGame ? homeStats.avgGoalsScoredHome  : homeStats.avgGoalsScoredAway)  / leagueAvgGoals;
  const homeDefense = (isHomeGame ? homeStats.avgGoalsConcededHome : homeStats.avgGoalsConcededAway) / leagueAvgGoals;
  const awayAttack  = (isHomeGame ? awayStats.avgGoalsScoredAway  : awayStats.avgGoalsScoredHome)  / leagueAvgGoals;
  const awayDefense = (isHomeGame ? awayStats.avgGoalsConcededAway : awayStats.avgGoalsConcededHome) / leagueAvgGoals;

  let xGHome = Math.max(0.25, homeAttack * awayDefense * leagueAvgGoals * homeAdv);
  let xGAway = Math.max(0.25, awayAttack * homeDefense * leagueAvgGoals);

  // ---- AJUSTE 1: Forma recente (formMomentum) ─────────────────────────────
  // formMomentum: -1 (em queda) a +1 (em alta), calculado por pts3 vs prev3
  // Impacto: até ±6% no xG do time, suavizado para não exagerar curto prazo
  const homeMomentumAdj = clamp(1 + homeStats.formMomentum * 0.06, 0.92, 1.08);
  const awayMomentumAdj = clamp(1 + awayStats.formMomentum * 0.06, 0.92, 1.08);
  xGHome = xGHome * homeMomentumAdj;
  xGAway = xGAway * awayMomentumAdj;

  // ---- AJUSTE 2: Over25Rate e BttsRate históricos do time ─────────────────
  // Se o time tem histórico forte de jogos com muitos gols (over25Rate alto),
  // calibramos o xG para cima levemente. Isso captura estilo de jogo.
  // Blend de 15% para não sobreponderar curto prazo.
  const homeOver25Signal = clamp((homeStats.over25Rate - 0.5) * 0.15 + 1, 0.94, 1.06);
  const awayOver25Signal = clamp((awayStats.over25Rate - 0.5) * 0.15 + 1, 0.94, 1.06);
  const over25Blend = (homeOver25Signal + awayOver25Signal) / 2;
  xGHome = xGHome * over25Blend;
  xGAway = xGAway * over25Blend;

  // ---- AJUSTE 3: H2H — média histórica de gols entre estes dois times ─────
  // Quando temos H2H com 3+ jogos, blendamos 20% do xG total com a média H2H.
  // Confrontos diretos capturam dinâmicas específicas entre os times.
  if (headToHead && headToHead.totalMatches >= 3) {
    const h2hAvgPerTeam = headToHead.avgTotalGoals / 2;
    const h2hBlend = Math.min(headToHead.totalMatches / 15, 0.20); // máx 20%

    const h2hHomeGoals = h2hAvgPerTeam * (xGHome / Math.max(xGHome + xGAway, 0.1));
    const h2hAwayGoals = h2hAvgPerTeam * (xGAway / Math.max(xGHome + xGAway, 0.1));

    xGHome = xGHome * (1 - h2hBlend) + h2hHomeGoals * h2hBlend;
    xGAway = xGAway * (1 - h2hBlend) + h2hAwayGoals * h2hBlend;
  }

  // ---- AJUSTE 4: BttsRate histórico do H2H calibra probabilidade de gol ──
  // Sem alterar xG, mas será usado no bttsYes depois via ajuste direto.
  const h2hBttsRate = headToHead && headToHead.totalMatches >= 3 ? headToHead.bttsRate : null;
  const h2hOver25Rate = headToHead && headToHead.totalMatches >= 3 ? headToHead.over25Rate : null;

  // Clamp final de xG
  xGHome = clamp(xGHome, 0.20, 4.5);
  xGAway = clamp(xGAway, 0.20, 4.0);
  const xGTotal = xGHome + xGAway;

  // ---- RESULT PROBABILITIES (Dixon-Coles bivariate Poisson + tau correction) ----
  let homeWin = 0, draw = 0, awayWin = 0;
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      const p = poissonProb(xGHome, i) * poissonProb(xGAway, j) * dixonColesTau(i, j, xGHome, xGAway);
      if (i > j) homeWin += p;
      else if (i === j) draw += p;
      else awayWin += p;
    }
  }
  const total = homeWin + draw + awayWin;
  homeWin /= total; draw /= total; awayWin /= total;

  // ---- HANDICAP ASIAN ----
  // AH -0.5: home wins outright
  const handicapHome05 = pct(homeWin);
  const handicapAway05 = pct(awayWin + draw);
  // AH -1: home wins by 2+
  let homeWin2 = 0, awayWin1 = 0;
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      const p = poissonProb(xGHome, i) * poissonProb(xGAway, j) * dixonColesTau(i, j, xGHome, xGAway);
      if (i - j >= 2) homeWin2 += p;
      if (j >= i) awayWin1 += p;
    }
  }
  const handicapHome1 = pct(homeWin2);
  const handicapAway1 = pct(awayWin1);
  // AH -1.5
  let homeWin3 = 0, awayWin15 = 0;
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      const p = poissonProb(xGHome, i) * poissonProb(xGAway, j) * dixonColesTau(i, j, xGHome, xGAway);
      if (i - j >= 2) homeWin3 += p;
      if (j - i >= 0) awayWin15 += p;
    }
  }
  const handicapHome15 = pct(homeWin3 * 0.85);
  const handicapAway15 = pct(awayWin + draw + homeWin * 0.15);

  // ---- DOUBLE CHANCE ----
  const homeOrDraw = pct(homeWin + draw);
  const awayOrDraw = pct(awayWin + draw);
  const homeOrAway = pct(homeWin + awayWin);

  // ---- OVER/UNDER GOALS ----
  const over05 = pct(poissonOver(xGTotal, 0));
  const over15 = pct(poissonOver(xGTotal, 1));
  let over25 = pct(poissonOver(xGTotal, 2));
  const over35 = pct(poissonOver(xGTotal, 3));
  const over45 = pct(poissonOver(xGTotal, 4));

  // ---- BTTS ----
  const homeScores = 1 - poissonProb(xGHome, 0);
  const awayScores = 1 - poissonProb(xGAway, 0);
  let bttsYes = pct(homeScores * awayScores);

  // ---- CALIBRAÇÃO H2H em over25 e BTTS ───────────────────────────────────
  // Quando temos ≥3 H2H, blendamos com as taxas reais observadas entre estes times.
  // Máx blend 25% para preservar poder preditivo do modelo Poisson.
  if (h2hOver25Rate !== null) {
    const h2hBlend = Math.min((headToHead?.totalMatches ?? 0) / 12, 0.25);
    over25 = clamp(over25 * (1 - h2hBlend) + (h2hOver25Rate * 100) * h2hBlend, 5, 95);
  }
  if (h2hBttsRate !== null) {
    const h2hBlend = Math.min((headToHead?.totalMatches ?? 0) / 12, 0.25);
    bttsYes = clamp(bttsYes * (1 - h2hBlend) + (h2hBttsRate * 100) * h2hBlend, 5, 95);
  }
  const bttsNo = 100 - bttsYes;

  // ---- TEAM SCORING ----
  const home2Plus = pct(poissonOver(xGHome, 1));
  const away2Plus = pct(poissonOver(xGAway, 1));

  // ---- FIRST HALF GOALS ----
  // First half typically has ~42% of total goals
  const xGH1 = xGTotal * 0.42;
  const xGH1Home = xGHome * 0.42;
  const xGH1Away = xGAway * 0.42;
  const firstHalfGoalProb = pct(poissonOver(xGH1, 0));
  const firstHalfOver05 = pct(poissonOver(xGH1, 0));
  const firstHalfOver15 = pct(poissonOver(xGH1, 1));
  const firstHalfBtts = pct((1 - poissonProb(xGH1Home, 0)) * (1 - poissonProb(xGH1Away, 0)));
  const secondHalfGoalProb = pct(poissonOver(xGTotal * 0.58, 0));

  // ---- CORNERS (Negative Binomial for overdispersion) ----
  // Quando temos dados reais de escanteios por casa/fora (cornersDataQuality > 0),
  // usamos diretamente em vez de forçar via força de ataque.
  // Blend proporcional à qualidade dos dados: mais real = menos estimado.
  const cornersBase = lp.avgCorners;
  const teamCornerBase = cornersBase / 2;

  const homeRealQuality = homeStats.cornersDataQuality ?? 0;
  const awayRealQuality = awayStats.cornersDataQuality ?? 0;

  // avgCornersForHome/Away: corners produzidos pelo time quando joga em casa/fora
  const homeCornerForReal = isHomeGame
    ? (homeStats.avgCornersForHome ?? homeStats.avgCornersFor)
    : (homeStats.avgCornersForAway ?? homeStats.avgCornersFor);
  const awayCornerForReal = isHomeGame
    ? (awayStats.avgCornersForAway ?? awayStats.avgCornersFor)
    : (awayStats.avgCornersForHome ?? awayStats.avgCornersFor);

  // Estimativa via força de ataque (fallback)
  const homeCornerForStrength = clamp(homeStats.avgCornersFor / Math.max(teamCornerBase, 0.1), 0.72, 1.28);
  const awayCornerForStrength = clamp(awayStats.avgCornersFor / Math.max(teamCornerBase, 0.1), 0.72, 1.28);
  const homeCornerAgainstStrength = clamp(homeStats.avgCornersAgainst / Math.max(teamCornerBase, 0.1), 0.74, 1.26);
  const awayCornerAgainstStrength = clamp(awayStats.avgCornersAgainst / Math.max(teamCornerBase, 0.1), 0.74, 1.26);
  const homeCornerContext = isHomeGame ? 1.05 : 0.97;
  const awayCornerContext = isHomeGame ? 0.97 : 1.05;

  const xCHomeEstimated = teamCornerBase * Math.pow(homeCornerForStrength, 0.62) * Math.pow(awayCornerAgainstStrength, 0.38) * homeCornerContext;
  const xCAwayEstimated = teamCornerBase * Math.pow(awayCornerForStrength, 0.62) * Math.pow(homeCornerAgainstStrength, 0.38) * awayCornerContext;

  // Blend: real ganha peso quando cornersDataQuality é alto
  let xCHomeRaw = homeRealQuality > 0
    ? homeCornerForReal * homeRealQuality + xCHomeEstimated * (1 - homeRealQuality)
    : xCHomeEstimated;
  let xCAwayRaw = awayRealQuality > 0
    ? awayCornerForReal * awayRealQuality + xCAwayEstimated * (1 - awayRealQuality)
    : xCAwayEstimated;

  xCHomeRaw = clamp(xCHomeRaw, 2.7, cornersBase * 0.72);
  xCAwayRaw = clamp(xCAwayRaw, 2.3, cornersBase * 0.68);

  const xCTotalRaw = xCHomeRaw + xCAwayRaw;
  const totalCornerFloor = Math.max(6.2, cornersBase * 0.72);
  const totalCornerCeiling = Math.min(13.6, cornersBase * 1.28);
  const xCTotal = clamp(xCTotalRaw, totalCornerFloor, totalCornerCeiling);
  const homeCornerShare = xCTotalRaw > 0 ? xCHomeRaw / xCTotalRaw : 0.52;
  const xCHome = xCTotal * homeCornerShare;
  const xCAway = xCTotal * (1 - homeCornerShare);
  const cornersR = 8; // Dispersion parameter

  const over55C = pct(negBinomOver(xCTotal, cornersR, 5));
  const over65C = pct(negBinomOver(xCTotal, cornersR, 6));
  const over75C = pct(negBinomOver(xCTotal, cornersR, 7));
  const over85C = pct(negBinomOver(xCTotal, cornersR, 8));
  const over95C = pct(negBinomOver(xCTotal, cornersR, 9));
  const over105C = pct(negBinomOver(xCTotal, cornersR, 10));
  const over115C = pct(negBinomOver(xCTotal, cornersR, 11));
  const over125C = pct(negBinomOver(xCTotal, cornersR, 12));

  // First half corners (~46% of total corners)
  const xCH1 = xCTotal * 0.46;
  const firstHalfOver35C = pct(negBinomOver(xCH1, cornersR, 3));
  const firstHalfOver45C = pct(negBinomOver(xCH1, cornersR, 4));
  const firstHalfOver55C = pct(negBinomOver(xCH1, cornersR, 5));

  // ---- CARDS (Negative Binomial) ----
  // Cards depend on: match intensity, rivalry, league aggression, result importance
  const homeAggrFactor = homeStats.aggressionIndex;
  const awayAggrFactor = awayStats.aggressionIndex;
  const matchIntensity = (homeAggrFactor + awayAggrFactor) / 2;

  const xCardsHome = Math.max(0.8, homeStats.avgYellowCards + homeStats.avgRedCards * 2);
  const xCardsAway = Math.max(0.8, awayStats.avgYellowCards + awayStats.avgRedCards * 2);
  const xCardsTotal = xCardsHome + xCardsAway;
  const cardsR = 5; // Dispersion

  const over05Cards = pct(negBinomOver(xCardsTotal, cardsR, 0));
  const over15Cards = pct(negBinomOver(xCardsTotal, cardsR, 1));
  const over25Cards = pct(negBinomOver(xCardsTotal, cardsR, 2));
  const over35Cards = pct(negBinomOver(xCardsTotal, cardsR, 3));
  const over45Cards = pct(negBinomOver(xCardsTotal, cardsR, 4));
  const over55Cards = pct(negBinomOver(xCardsTotal, cardsR, 5));

  // Individual team card probs
  const homeCardProb = pct(1 - negBinomProb(xCardsHome, cardsR, 0));
  const awayCardProb = pct(1 - negBinomProb(xCardsAway, cardsR, 0));
  const homeRedCardProb = pct(Math.min(0.35, homeStats.avgRedCards * 1.2 + matchIntensity * 0.05));
  const awayRedCardProb = pct(Math.min(0.4, awayStats.avgRedCards * 1.3 + matchIntensity * 0.06));
  const bothTeamsCard = pct(homeCardProb / 100 * awayCardProb / 100);

  // Cards by period (roughly 40% 1st half, 60% 2nd half)
  const firstHalfCard = pct(negBinomOver(xCardsTotal * 0.4, cardsR, 0));
  const secondHalfCard = pct(negBinomOver(xCardsTotal * 0.6, cardsR, 0));

  return {
    homeWinProb: pct(homeWin),
    drawProb: pct(draw),
    awayWinProb: pct(awayWin),
    handicapHome05, handicapAway05,
    handicapHome1, handicapAway1,
    handicapHome15, handicapAway15,
    homeOrDraw, awayOrDraw, homeOrAway,
    over05Prob: over05, over15Prob: over15, over25Prob: over25,
    over35Prob: over35, over45Prob: over45,
    under15Prob: 100 - over15, under25Prob: 100 - over25, under35Prob: 100 - over35,
    bttsYesProb: bttsYes, bttsNoProb: bttsNo,
    expectedGoalsHome: r2(xGHome), expectedGoalsAway: r2(xGAway), expectedTotalGoals: r2(xGTotal),
    homeToScoreProb: pct(homeScores), awayToScoreProb: pct(awayScores),
    cleanSheetHomeProb: pct(1 - awayScores), cleanSheetAwayProb: pct(1 - homeScores),
    home2PlusGoalsProb: home2Plus, away2PlusGoalsProb: away2Plus,
    expectedFirstHalfGoals: r2(xGH1),
    firstHalfGoalProb, secondHalfGoalProb,
    firstHalfOver05Prob: firstHalfOver05, firstHalfOver15Prob: firstHalfOver15,
    firstHalfBttsProb: firstHalfBtts,
    expectedCorners: r1(xCTotal), expectedFirstHalfCorners: r1(xCH1), expectedCornersHome: r1(xCHome), expectedCornersAway: r1(xCAway),
    over55CornersProb: over55C, over65CornersProb: over65C, over75CornersProb: over75C,
    over85CornersProb: over85C, over95CornersProb: over95C, over105CornersProb: over105C,
    over115CornersProb: over115C, over125CornersProb: over125C,
    under85CornersProb: 100 - over85C, under105CornersProb: 100 - over105C,
    firstHalfOver35CornersProb: firstHalfOver35C, firstHalfOver45CornersProb: firstHalfOver45C, firstHalfOver55CornersProb: firstHalfOver55C,
    expectedCards: r1(xCardsTotal), expectedCardsHome: r1(xCardsHome), expectedCardsAway: r1(xCardsAway),
    expectedYellowCards: r1(xCardsTotal * 0.92), expectedRedCards: r1(xCardsTotal * 0.08),
    over05CardsProb: over05Cards, over15CardsProb: over15Cards, over25CardsProb: over25Cards,
    over35CardsProb: over35Cards, over45CardsProb: over45Cards, over55CardsProb: over55Cards,
    homeCardProb, awayCardProb, homeRedCardProb, awayRedCardProb, bothTeamsCardProb: bothTeamsCard,
    firstHalfCardProb: firstHalfCard, secondHalfCardProb: secondHalfCard,
  };
}

// ============================================================
// SCORE PREDICTIONS — com Dixon-Coles tau correction
// ============================================================
export function calculateScorePredictions(xGHome: number, xGAway: number): ScorePrediction[] {
  const scores: ScorePrediction[] = [];

  // Calcula probabilidades brutas com tau correction (mesmo modelo do calculatePredictions)
  let totalProb = 0;
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      const p = poissonProb(xGHome, i) * poissonProb(xGAway, j) * dixonColesTau(i, j, xGHome, xGAway);
      totalProb += p;
      if (p > 0.003) {
        let label = `${i} - ${j}`;
        // Tags contextuais nos placares mais prováveis
        if (i === j) label += ' (Empate)';
        scores.push({
          homeGoals: i,
          awayGoals: j,
          probability: p, // bruto — normalizamos abaixo
          label,
        });
      }
    }
  }

  // Normaliza para que a soma seja 100%
  return scores
    .map(s => ({ ...s, probability: Math.round((s.probability / Math.max(totalProb, 0.01)) * 1000) / 10 }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 8);
}

// ============================================================
// MATCH PROFILE
// ============================================================
export function calculateMatchProfile(
  homeStats: TeamStats,
  awayStats: TeamStats,
  predictions: Predictions
): MatchProfile {
  const xGTotal = predictions.expectedTotalGoals;
  const homeWin = predictions.homeWinProb;
  const awayWin = predictions.awayWinProb;
  const btts = predictions.bttsYesProb;
  const cards = predictions.expectedCards;
  const corners = predictions.expectedCorners;
  const over25 = predictions.over25Prob;
  const under25 = predictions.under25Prob;
  const under35 = predictions.under35Prob;

  const keyFactors: string[] = [];

  // Determine type with softer narrative bands to avoid UX contradictions.
  let type: MatchProfile['type'];
  if (xGTotal >= 3.35 || (over25 >= 64 && btts >= 60)) type = 'high-scoring';
  else if (xGTotal <= 2.05 && under25 >= 58) type = 'defensive';
  else if (cards >= 5.3 && xGTotal < 3.3) type = 'aggressive';
  else if (Math.abs(homeWin - awayWin) < 10 && xGTotal >= 2.2 && xGTotal <= 3.0) type = 'balanced';
  else type = 'low-scoring';

  // Dominant team
  let dominantTeam: MatchProfile['dominantTeam'];
  if (homeWin > awayWin + 15) dominantTeam = 'home';
  else if (awayWin > homeWin + 15) dominantTeam = 'away';
  else dominantTeam = 'balanced';

  // Intensity
  let expectedIntensity: MatchProfile['expectedIntensity'];
  if (cards > 5 || corners > 12) expectedIntensity = 'high';
  else if (cards < 3 && corners < 8) expectedIntensity = 'low';
  else expectedIntensity = 'medium';

  // Key factors
  if (homeStats.winStreak >= 3) keyFactors.push(`${homeStats.strTeam} em série de ${homeStats.winStreak} vitórias`);
  if (awayStats.winStreak >= 3) keyFactors.push(`${awayStats.strTeam} em série de ${awayStats.winStreak} vitórias`);
  if (homeStats.formMomentum > 0.3) keyFactors.push(`${homeStats.strTeam} em ascensão de forma`);
  if (awayStats.formMomentum > 0.3) keyFactors.push(`${awayStats.strTeam} em ascensão de forma`);
  if (homeStats.cleanSheetRate > 0.45) keyFactors.push(`${homeStats.strTeam} defesa consistente (${Math.round(homeStats.cleanSheetRate * 100)}% clean sheets)`);
  if (awayStats.cleanSheetRate > 0.45) keyFactors.push(`${awayStats.strTeam} defesa consistente`);
  if (btts > 67) keyFactors.push('Ambos os lados mantêm ameaça ofensiva relevante');
  if (xGTotal >= 3.25) keyFactors.push('Partida com potencial real de 3+ gols');
  if (xGTotal >= 2.35 && xGTotal < 3.25) keyFactors.push('Cenário-base aponta faixa de 2 a 3 gols');
  if (cards > 5) keyFactors.push('Jogo tende a ser intenso em faltas e cartões');
  if (homeStats.aggressionIndex > 0.7) keyFactors.push(`${homeStats.strTeam} costuma elevar a intensidade física do jogo`);
  if (keyFactors.length === 0) keyFactors.push('Partida equilibrada sem tendência extrema dominante');

  const profileMap: Record<MatchProfile['type'], { label: string; description: string; icon: string }> = {
    'high-scoring': {
      label: 'Jogo Aberto',
      description: `Projeção ofensiva forte (${xGTotal.toFixed(2)} xG total). Cenário favorece linhas de over mais altas.`,
      icon: '🔥',
    },
    'low-scoring': {
      label: 'Ritmo Controlado',
      description: under35 >= 62
        ? `Cenário-base mais compatível com 2 a 3 gols do que com goleada. Under 3.5 segue coerente.`
        : `Partida sem tendência clara de explosão ofensiva. Mercado pede leitura mais seletiva.`,
      icon: '🎯',
    },
    'defensive': {
      label: 'Jogo Travado',
      description: `Ataques projetam pouco volume (${xGTotal.toFixed(2)} xG total). Linhas de under baixas ganham força.`,
      icon: '🛡️',
    },
    'aggressive': {
      label: 'Jogo Intenso',
      description: 'Alta fricção esperada, com tendência acima da média para faltas e cartões.',
      icon: '⚡',
    },
    'balanced': {
      label: 'Equilíbrio Total',
      description: 'Forças parecidas dos dois lados. Resultado pede gestão de risco maior no 1X2.',
      icon: '⚖️',
    },
  };

  return {
    type,
    ...profileMap[type],
    dominantTeam,
    expectedIntensity,
    keyFactors: keyFactors.slice(0, 4),
  };
}

// ============================================================
// VALUE BETS DETECTION
// ============================================================
export function calculateValueBets(
  predictions: Predictions,
  homeTeam: string,
  awayTeam: string,
  marketOdds: AnalysisMarketOdds | null = null
): ValueBet[] {
  const valueBets: ValueBet[] = [];

  // Kelly Criterion: f* = (bp - q) / b  where b=decimal_odds-1, p=our_prob, q=1-p
  // Half-Kelly for safety (reduces variance without much loss of EV)
  function kellyFraction(prob: number, decimalOdds: number): number {
    const b = decimalOdds - 1;
    const p = prob / 100;
    const q = 1 - p;
    const k = (b * p - q) / b;
    return Math.max(0, Math.round(k * 50 * 10) / 10); // Half-Kelly as % of bankroll
  }

  const pushValueBet = (market: string, ourProb: number, marketOddsDecimal: number | null | undefined, impliedProbPct: number, sourceLabel: string) => {
    if (!marketOddsDecimal || ourProb <= 0 || ourProb >= 100) return;

    const ourOdds = 100 / ourProb;
    const evPct   = ((ourProb / 100) * marketOddsDecimal - 1) * 100;
    const kelly   = kellyFraction(ourProb, marketOddsDecimal);

    if (evPct >= 2.5) {
      valueBets.push({
        market,
        ourProb:     Math.round(ourProb * 10) / 10,
        impliedProb: Math.round(impliedProbPct * 10) / 10,
        marketOdds:  Math.round(marketOddsDecimal * 100) / 100,
        ourOdds:     Math.round(ourOdds * 100) / 100,
        edge:        Math.round(evPct * 10) / 10,
        kellyPct:    kelly,
        confidence:  evPct >= 8 ? 'high' : evPct >= 4 ? 'medium' : 'low',
        sourceLabel,
      });
    }
  };

  if (marketOdds?.homeWinOdds && marketOdds?.drawOdds && marketOdds?.awayWinOdds) {
    const noVig = normalizeProbabilities([
      decimalToProb(marketOdds.homeWinOdds),
      decimalToProb(marketOdds.drawOdds),
      decimalToProb(marketOdds.awayWinOdds),
    ]);

    pushValueBet(`Vitória ${homeTeam}`, predictions.homeWinProb, marketOdds.homeWinOdds, noVig[0] * 100, `${marketOdds.provider} 1X2`);
    pushValueBet('Empate', predictions.drawProb, marketOdds.drawOdds, noVig[1] * 100, `${marketOdds.provider} 1X2`);
    pushValueBet(`Vitória ${awayTeam}`, predictions.awayWinProb, marketOdds.awayWinOdds, noVig[2] * 100, `${marketOdds.provider} 1X2`);
  }

  if (marketOdds?.totalLine != null && marketOdds?.overOdds && marketOdds?.underOdds) {
    const modelOverProb = getTotalMarketModelProb(predictions, marketOdds.totalLine, 'over');
    const modelUnderProb = getTotalMarketModelProb(predictions, marketOdds.totalLine, 'under');
    const noVig = normalizeProbabilities([
      decimalToProb(marketOdds.overOdds),
      decimalToProb(marketOdds.underOdds),
    ]);

    if (modelOverProb != null) {
      pushValueBet(`Over ${marketOdds.totalLine} Gols`, modelOverProb, marketOdds.overOdds, noVig[0] * 100, `${marketOdds.provider} Totals`);
    }
    if (modelUnderProb != null) {
      pushValueBet(`Under ${marketOdds.totalLine} Gols`, modelUnderProb, marketOdds.underOdds, noVig[1] * 100, `${marketOdds.provider} Totals`);
    }
  }

  return valueBets.sort((a, b) => b.edge - a.edge).slice(0, 6);
}

function chooseBestAngle(predictions: Predictions, valueBets: ValueBet[]): string {
  const candidates: Array<{ label: string; probability: number; bonus: number }> = [
    { label: 'Under 3.5 Gols', probability: predictions.under35Prob, bonus: predictions.expectedTotalGoals <= 3.1 ? 6 : -4 },
    { label: 'Under 2.5 Gols', probability: predictions.under25Prob, bonus: predictions.expectedTotalGoals <= 2.35 ? 8 : -6 },
    { label: 'Over 1.5 Gols', probability: predictions.over15Prob, bonus: predictions.expectedTotalGoals >= 2.1 ? 5 : -3 },
    { label: 'Over 2.5 Gols', probability: predictions.over25Prob, bonus: predictions.expectedTotalGoals >= 2.85 ? 6 : -6 },
    { label: 'Ambos Marcam — Sim', probability: predictions.bttsYesProb, bonus: predictions.expectedGoalsHome >= 1.05 && predictions.expectedGoalsAway >= 0.9 ? 4 : -4 },
    { label: 'Dupla Chance 1X', probability: predictions.homeOrDraw, bonus: predictions.homeWinProb >= predictions.awayWinProb ? 3 : -6 },
    { label: 'Dupla Chance X2', probability: predictions.awayOrDraw, bonus: predictions.awayWinProb >= predictions.homeWinProb ? 3 : -6 },
  ];

  if (valueBets[0]) {
    const topValue = valueBets[0];
    const market = topValue.market;
    const probability = topValue.ourProb;
    const scenarioPenalty =
      (market.includes('Over 2.5') && predictions.expectedTotalGoals < 2.55 ? 14 : 0) +
      (market.includes('Over 3.5') && predictions.expectedTotalGoals < 3.1 ? 18 : 0) +
      (market.includes('Under 2.5') && predictions.expectedTotalGoals > 2.65 ? 14 : 0) +
      (market.includes('Under 3.5') && predictions.expectedTotalGoals > 3.45 ? 10 : 0);

    if (probability >= 54 && scenarioPenalty <= 10) {
      return market;
    }
  }

  return candidates
    .sort((a, b) => (b.probability + b.bonus) - (a.probability + a.bonus))[0]
    .label;
}

export function buildAnalysisSummary(
  predictions: Predictions,
  homeStats: TeamStats,
  awayStats: TeamStats,
  headToHead: HeadToHead,
  valueBets: ValueBet[],
  marketOdds: AnalysisMarketOdds | null
): AnalysisSummary {
  // dataQuality base: 0–10 por time (escala de 0–20 total), mapeado para 0–80
  const avgDataQuality = ((homeStats.dataQuality + awayStats.dataQuality) / 20) * 80;
  const h2hScore = clamp(headToHead.totalMatches * 8, 0, 20);

  // Bônus por dados reais de escanteios (até +10 pontos)
  const homeCornersQuality = homeStats.cornersDataQuality ?? 0;
  const awayCornersQuality = awayStats.cornersDataQuality ?? 0;
  const cornersDataBonus = Math.round(((homeCornersQuality + awayCornersQuality) / 2) * 10);

  const dataQualityScore = Math.round(clamp(avgDataQuality + h2hScore + cornersDataBonus, 0, 100));

  let marketAlignmentScore = 52;
  if (marketOdds?.homeWinOdds && marketOdds?.drawOdds && marketOdds?.awayWinOdds) {
    const noVig = normalizeProbabilities([
      decimalToProb(marketOdds.homeWinOdds),
      decimalToProb(marketOdds.drawOdds),
      decimalToProb(marketOdds.awayWinOdds),
    ]).map((v) => v * 100);
    const diffs = [
      Math.abs(predictions.homeWinProb - noVig[0]),
      Math.abs(predictions.drawProb - noVig[1]),
      Math.abs(predictions.awayWinProb - noVig[2]),
    ];
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    marketAlignmentScore = Math.round(clamp(100 - avgDiff * 4.5, 0, 100));
  }

  const topResultGap = Math.max(predictions.homeWinProb, predictions.drawProb, predictions.awayWinProb) -
    [...[predictions.homeWinProb, predictions.drawProb, predictions.awayWinProb]].sort((a, b) => b - a)[1];
  const formBalance = Math.abs(homeStats.formMomentum - awayStats.formMomentum) * 100;
  const volatilityPenalty = predictions.drawProb > 30 ? 8 : 0;
  const stabilityScore = Math.round(clamp(50 + topResultGap * 1.2 + formBalance * 0.15 - volatilityPenalty, 0, 100));

  const decisionScore = Math.round(clamp(
    dataQualityScore * 0.38 + marketAlignmentScore * 0.27 + stabilityScore * 0.25 + Math.min(valueBets[0]?.edge ?? 0, 12) * 0.8,
    0,
    100
  ));

  const bestAngle = chooseBestAngle(predictions, valueBets);

  const strengths: string[] = [];
  const warnings: string[] = [];

  if (valueBets[0]) strengths.push(`Melhor edge atual: ${valueBets[0].market} (${valueBets[0].edge.toFixed(1)}% EV)`);
  if (predictions.expectedTotalGoals >= 3.25) strengths.push(`Projeção ofensiva alta (${predictions.expectedTotalGoals.toFixed(2)} xG total)`);
  else if (predictions.expectedTotalGoals >= 2.35) strengths.push(`Faixa-base do jogo aponta algo próximo de 2 a 3 gols (${predictions.expectedTotalGoals.toFixed(2)} xG)`);
  else strengths.push(`Volume de gols projetado é contido (${predictions.expectedTotalGoals.toFixed(2)} xG total)`);
  if (cornersDataBonus >= 7) strengths.push('Escanteios calculados com dados históricos reais (alta precisão)');
  else if (cornersDataBonus >= 4) strengths.push('Escanteios com blend de dados reais e estimativa por contexto');
  if (predictions.expectedCards >= 4.8) strengths.push(`Tendência de intensidade alta em cartões (${predictions.expectedCards.toFixed(1)})`);
  if (Math.abs(homeStats.formMomentum - awayStats.formMomentum) >= 0.35) strengths.push('Diferença de momento recente relevante entre os times');
  if (headToHead.totalMatches >= 3) strengths.push(`H2H aproveitável com ${headToHead.totalMatches} confronto(s) recente(s)`);
  if (strengths.length === 0) strengths.push('Modelo enxerga cenário equilibrado, com poucas distorções extremas');

  if (!marketOdds) warnings.push('Sem odds completas de mercado para validar value real nesta partida');
  if (dataQualityScore < 60) warnings.push('Base histórica curta ou incompleta para um jogo desta liga');
  if (cornersDataBonus < 3) warnings.push('Escanteios estimados por proxy — dados reais de escanteios indisponíveis');
  if (marketAlignmentScore < 45) warnings.push('Modelo e mercado estão bem desalinhados — cenário de maior variância');
  if (predictions.drawProb >= 30) warnings.push('Chance de empate relativamente alta reduz previsibilidade do 1X2');
  if (headToHead.totalMatches === 0) warnings.push('Sem confrontos diretos recentes confirmados entre os times');

  return {
    decisionScore,
    dataQualityScore,
    marketAlignmentScore,
    stabilityScore,
    bestAngle,
    strengths: strengths.slice(0, 4),
    warnings: warnings.slice(0, 4),
  };
}

// ============================================================
// TIPS GENERATION (Ultra Detailed)
// ============================================================
export function generateTips(
  predictions: Predictions,
  homeStats: TeamStats,
  awayStats: TeamStats,
  homeTeam: string,
  awayTeam: string,
  headToHead?: { totalMatches: number; homeWins: number; draws: number; awayWins: number; avgTotalGoals: number; bttsRate: number; over25Rate: number; avgCards: number },
  marketOdds?: { totalLine?: number | null; overOdds?: number | null; underOdds?: number | null } | null
): Tip[] {
  const tips: Tip[] = [];

  const add = (
    id: string,
    category: Tip['category'],
    label: string,
    description: string,
    probability: number,
    confidence: Tip['confidence'],
    recommended: boolean,
    isValue = false,
    edge = 0
  ) => {
    if (probability < 10) return;
    tips.push({
      id, category, label, description, probability,
      odds: probToOdds(probability),
      confidence, isRecommended: recommended,
      isValueBet: isValue, valueEdge: edge,
    });
  };

  // ---- RESULTADO ----
  if (predictions.homeWinProb > 40) {
    add('home-win', 'result', `Vitória ${homeTeam}`,
      `${homeStats.strTeam} tem ${predictions.homeWinProb}% de chance. Forma: ${homeStats.form.slice(0,5).join('')}`,
      predictions.homeWinProb,
      predictions.homeWinProb > 60 ? 'high' : 'medium',
      predictions.homeWinProb > 55);
  }
  if (predictions.awayWinProb > 35) {
    add('away-win', 'result', `Vitória ${awayTeam}`,
      `${awayStats.strTeam} tem ${predictions.awayWinProb}% de chance. xG visitante: ${predictions.expectedGoalsAway}`,
      predictions.awayWinProb,
      predictions.awayWinProb > 55 ? 'high' : 'medium',
      predictions.awayWinProb > 50);
  }
  if (predictions.drawProb > 22) {
    add('draw', 'result', 'Empate',
      `Equilíbrio entre os times. Prob. empate: ${predictions.drawProb}%`,
      predictions.drawProb,
      predictions.drawProb > 33 ? 'medium' : 'low',
      predictions.drawProb > 32);
  }

  // ---- DUPLA CHANCE ----
  if (predictions.homeOrDraw > 65) {
    add('1x', 'result', `1X — ${homeTeam} ou Empate`,
      `Dupla chance: ${predictions.homeOrDraw}% de probabilidade`,
      predictions.homeOrDraw, 'high', predictions.homeOrDraw > 75);
  }
  if (predictions.awayOrDraw > 65) {
    add('x2', 'result', `X2 — Empate ou ${awayTeam}`,
      `Dupla chance: ${predictions.awayOrDraw}% de probabilidade`,
      predictions.awayOrDraw, 'high', predictions.awayOrDraw > 75);
  }

  // ---- HANDICAP ----
  if (predictions.handicapHome05 > 55) {
    add('ah-home-05', 'handicap', `${homeTeam} -0.5 (Handicap)`,
      `Casa vence com qualquer placar. Prob: ${predictions.handicapHome05}%`,
      predictions.handicapHome05,
      predictions.handicapHome05 > 65 ? 'high' : 'medium',
      predictions.handicapHome05 > 62);
  }
  if (predictions.handicapAway05 > 55) {
    add('ah-away-05', 'handicap', `${awayTeam} -0.5 (Handicap)`,
      `Visitante não perde. Prob: ${predictions.handicapAway05}%`,
      predictions.handicapAway05,
      predictions.handicapAway05 > 65 ? 'high' : 'medium',
      predictions.handicapAway05 > 62);
  }
  if (predictions.handicapHome1 > 40) {
    add('ah-home-1', 'handicap', `${homeTeam} -1 (Handicap)`,
      `Casa vence por 2+ gols. Prob: ${predictions.handicapHome1}%`,
      predictions.handicapHome1,
      predictions.handicapHome1 > 50 ? 'medium' : 'low',
      predictions.handicapHome1 > 50);
  }

  // ---- GOLS ----
  if (predictions.over15Prob > 72) {
    add('over15', 'goals', 'Over 1.5 Gols',
      `${predictions.over15Prob}% de chance de pelo menos 2 gols. xG total: ${predictions.expectedTotalGoals}`,
      predictions.over15Prob,
      predictions.over15Prob > 82 ? 'high' : 'medium',
      predictions.over15Prob > 80);
  }
  if (predictions.over25Prob > 52) {
    add('over25', 'goals', 'Over 2.5 Gols',
      `${predictions.over25Prob}% de chance de 3+ gols. Média de gols: ${predictions.expectedTotalGoals}`,
      predictions.over25Prob,
      predictions.over25Prob > 65 ? 'high' : 'medium',
      predictions.over25Prob > 62);
  }
  if (predictions.under25Prob > 52) {
    add('under25', 'goals', 'Under 2.5 Gols',
      `${predictions.under25Prob}% de chance de máximo 2 gols`,
      predictions.under25Prob,
      predictions.under25Prob > 65 ? 'high' : 'medium',
      predictions.under25Prob > 62);
  }
  if (predictions.over35Prob > 35) {
    add('over35', 'goals', 'Over 3.5 Gols',
      `${predictions.over35Prob}% de chance de 4+ gols na partida`,
      predictions.over35Prob,
      predictions.over35Prob > 50 ? 'medium' : 'low',
      predictions.over35Prob > 48);
  }
  if (predictions.under15Prob > 35) {
    add('under15', 'goals', 'Under 1.5 Gols',
      `${predictions.under15Prob}% de chance de máximo 1 gol`,
      predictions.under15Prob,
      predictions.under15Prob > 50 ? 'medium' : 'low',
      predictions.under15Prob > 48);
  }

  // ---- BTTS ----
  if (predictions.bttsYesProb > 52) {
    add('btts-yes', 'btts', 'Ambos Marcam — Sim',
      `${predictions.bttsYesProb}% de chance. Casa marca: ${predictions.homeToScoreProb}%, Visitante: ${predictions.awayToScoreProb}%`,
      predictions.bttsYesProb,
      predictions.bttsYesProb > 65 ? 'high' : 'medium',
      predictions.bttsYesProb > 60);
  }
  if (predictions.bttsNoProb > 52) {
    add('btts-no', 'btts', 'Ambos Marcam — Não',
      `${predictions.bttsNoProb}% de chance de pelo menos um time não marcar`,
      predictions.bttsNoProb,
      predictions.bttsNoProb > 65 ? 'medium' : 'low',
      predictions.bttsNoProb > 62);
  }

  // ---- PRIMEIRO TEMPO ----
  if (predictions.firstHalfOver05Prob > 65) {
    add('ht-over05', 'halftime', 'Gol no 1º Tempo',
      `${predictions.firstHalfOver05Prob}% de chance de gol antes do intervalo`,
      predictions.firstHalfOver05Prob,
      predictions.firstHalfOver05Prob > 75 ? 'high' : 'medium',
      predictions.firstHalfOver05Prob > 72);
  }
  if (predictions.firstHalfOver15Prob > 35) {
    add('ht-over15', 'halftime', 'Over 1.5 no 1º Tempo',
      `${predictions.firstHalfOver15Prob}% de chance de 2+ gols no 1º tempo`,
      predictions.firstHalfOver15Prob,
      predictions.firstHalfOver15Prob > 50 ? 'medium' : 'low',
      predictions.firstHalfOver15Prob > 48);
  }

  // ---- ESCANTEIOS ----
  if (predictions.over65CornersProb > 60) {
    add('corners-over65', 'corners', 'Over 6.5 Escanteios',
      `${predictions.over65CornersProb}% de chance. Esperado: ${predictions.expectedCorners} escanteios`,
      predictions.over65CornersProb,
      predictions.over65CornersProb > 72 ? 'high' : 'medium',
      predictions.over65CornersProb > 70);
  }
  if (predictions.over85CornersProb > 50) {
    add('corners-over85', 'corners', 'Over 8.5 Escanteios',
      `${predictions.over85CornersProb}% de chance de 9+ escanteios`,
      predictions.over85CornersProb,
      predictions.over85CornersProb > 62 ? 'medium' : 'low',
      predictions.over85CornersProb > 60);
  }
  if (predictions.over105CornersProb > 35) {
    add('corners-over105', 'corners', 'Over 10.5 Escanteios',
      `${predictions.over105CornersProb}% de chance de 11+ escanteios`,
      predictions.over105CornersProb,
      predictions.over105CornersProb > 50 ? 'medium' : 'low',
      predictions.over105CornersProb > 48);
  }
  if (predictions.under85CornersProb > 45) {
    add('corners-under85', 'corners', 'Under 8.5 Escanteios',
      `${predictions.under85CornersProb}% de chance de máximo 8 escanteios`,
      predictions.under85CornersProb,
      predictions.under85CornersProb > 58 ? 'medium' : 'low',
      predictions.under85CornersProb > 55);
  }

  // ---- CARTÕES ----
  if (predictions.over15CardsProb > 70) {
    add('cards-over15', 'cards', 'Over 1.5 Cartões',
      `${predictions.over15CardsProb}% de chance de 2+ cartões`,
      predictions.over15CardsProb,
      predictions.over15CardsProb > 82 ? 'high' : 'medium',
      predictions.over15CardsProb > 80);
  }
  if (predictions.over25CardsProb > 55) {
    add('cards-over25', 'cards', 'Over 2.5 Cartões',
      `${predictions.over25CardsProb}% de chance de 3+ cartões. Esperado: ${predictions.expectedCards}`,
      predictions.over25CardsProb,
      predictions.over25CardsProb > 68 ? 'high' : 'medium',
      predictions.over25CardsProb > 65);
  }
  if (predictions.over35CardsProb > 45) {
    add('cards-over35', 'cards', 'Over 3.5 Cartões',
      `${predictions.over35CardsProb}% de chance de 4+ cartões`,
      predictions.over35CardsProb,
      predictions.over35CardsProb > 58 ? 'medium' : 'low',
      predictions.over35CardsProb > 55);
  }
  if (predictions.over45CardsProb > 35) {
    add('cards-over45', 'cards', 'Over 4.5 Cartões',
      `${predictions.over45CardsProb}% de chance de 5+ cartões`,
      predictions.over45CardsProb,
      predictions.over45CardsProb > 48 ? 'medium' : 'low',
      predictions.over45CardsProb > 45);
  }
  if (predictions.homeRedCardProb > 15) {
    add('home-red', 'cards', `Cartão Vermelho — ${homeTeam}`,
      `${predictions.homeRedCardProb}% de chance de expulsão no time da casa`,
      predictions.homeRedCardProb,
      predictions.homeRedCardProb > 25 ? 'medium' : 'low',
      predictions.homeRedCardProb > 22);
  }
  if (predictions.awayRedCardProb > 15) {
    add('away-red', 'cards', `Cartão Vermelho — ${awayTeam}`,
      `${predictions.awayRedCardProb}% de chance de expulsão no visitante`,
      predictions.awayRedCardProb,
      predictions.awayRedCardProb > 25 ? 'medium' : 'low',
      predictions.awayRedCardProb > 22);
  }

  // ---- ESPECIAIS ----
  if (predictions.cleanSheetHomeProb > 30) {
    add('cs-home', 'special', `Clean Sheet — ${homeTeam}`,
      `${predictions.cleanSheetHomeProb}% de chance do visitante não marcar`,
      predictions.cleanSheetHomeProb,
      predictions.cleanSheetHomeProb > 42 ? 'medium' : 'low',
      predictions.cleanSheetHomeProb > 40);
  }
  if (predictions.cleanSheetAwayProb > 25) {
    add('cs-away', 'special', `Clean Sheet — ${awayTeam}`,
      `${predictions.cleanSheetAwayProb}% de chance do time da casa não marcar`,
      predictions.cleanSheetAwayProb,
      predictions.cleanSheetAwayProb > 38 ? 'medium' : 'low',
      predictions.cleanSheetAwayProb > 35);
  }
  if (predictions.home2PlusGoalsProb > 45) {
    add('home-2plus', 'special', `${homeTeam} marca 2+`,
      `${predictions.home2PlusGoalsProb}% de chance da casa marcar 2 ou mais gols`,
      predictions.home2PlusGoalsProb,
      predictions.home2PlusGoalsProb > 58 ? 'medium' : 'low',
      predictions.home2PlusGoalsProb > 55);
  }
  if (predictions.away2PlusGoalsProb > 40) {
    add('away-2plus', 'special', `${awayTeam} marca 2+`,
      `${predictions.away2PlusGoalsProb}% de chance do visitante marcar 2 ou mais gols`,
      predictions.away2PlusGoalsProb,
      predictions.away2PlusGoalsProb > 52 ? 'medium' : 'low',
      predictions.away2PlusGoalsProb > 50);
  }

  // ---- TIPS BASEADAS EM H2H ────────────────────────────────────────────────
  if (headToHead && headToHead.totalMatches >= 4) {
    const h2hBtts = headToHead.bttsRate * 100;
    const h2hOver25 = headToHead.over25Rate * 100;
    const h2hAvgGoals = headToHead.avgTotalGoals;
    const h2hAvgCards = headToHead.avgCards;
    const h2hHomeWinRate = (headToHead.homeWins / headToHead.totalMatches) * 100;

    if (h2hBtts >= 65 && predictions.bttsYesProb >= 50) {
      add('h2h-btts-yes', 'btts', 'Ambos Marcam — H2H confirma',
        `Em ${headToHead.totalMatches} confrontos diretos, ambos marcaram em ${Math.round(h2hBtts)}% das vezes`,
        Math.round(predictions.bttsYesProb * 0.7 + h2hBtts * 0.3), 'high', true);
    } else if (h2hBtts <= 30 && predictions.bttsNoProb >= 45) {
      add('h2h-btts-no', 'btts', 'Ambos Marcam — Não (H2H baixo)',
        `Apenas ${Math.round(h2hBtts)}% dos últimos ${headToHead.totalMatches} confrontos tiveram ambos marcando`,
        Math.round(predictions.bttsNoProb * 0.7 + (100 - h2hBtts) * 0.3), 'medium', true);
    }
    if (h2hOver25 >= 65 && predictions.over25Prob >= 50) {
      add('h2h-over25', 'goals', 'Over 2.5 Gols — H2H confirma',
        `${Math.round(h2hOver25)}% dos confrontos diretos tiveram 3+ gols (média: ${h2hAvgGoals.toFixed(1)})`,
        Math.round(predictions.over25Prob * 0.7 + h2hOver25 * 0.3), 'high', true);
    } else if (h2hOver25 <= 30 && predictions.under25Prob >= 45) {
      add('h2h-under25', 'goals', 'Under 2.5 Gols — H2H histórico',
        `Só ${Math.round(h2hOver25)}% dos confrontos tiveram 3+ gols. Média H2H: ${h2hAvgGoals.toFixed(1)}`,
        Math.round(predictions.under25Prob * 0.7 + (100 - h2hOver25) * 0.3), 'medium', true);
    }
    if (h2hAvgCards >= 4.5 && predictions.over35CardsProb >= 42) {
      add('h2h-cards', 'cards', 'Confronto Tenso — H2H histórico',
        `Média de ${h2hAvgCards.toFixed(1)} cartões nos últimos ${headToHead.totalMatches} confrontos diretos`,
        predictions.over35CardsProb, 'medium', predictions.over35CardsProb > 50);
    }
    if (h2hHomeWinRate >= 65 && predictions.homeWinProb >= 45) {
      add('h2h-home-dom', 'result', `${homeTeam} — Histórico favorável`,
        `${homeTeam} venceu ${headToHead.homeWins} de ${headToHead.totalMatches} confrontos diretos`,
        Math.round(predictions.homeWinProb * 0.75 + h2hHomeWinRate * 0.25), 'medium', true);
    }
  }

  // ---- TIPS DE FORMA E MOMENTO ─────────────────────────────────────────────
  if (homeStats.formMomentum > 0.4 && predictions.homeWinProb > 50) {
    add('form-home', 'special', `${homeTeam} — Momentum positivo`,
      `${homeTeam} em ascensão: ${homeStats.form.slice(0,5).join('')}. xG casa: ${predictions.expectedGoalsHome}`,
      predictions.homeWinProb, predictions.homeWinProb > 60 ? 'high' : 'medium', true);
  }
  if (awayStats.formMomentum > 0.4 && predictions.awayWinProb > 40) {
    add('form-away', 'special', `${awayTeam} — Momentum positivo`,
      `${awayTeam} em ascensão: ${awayStats.form.slice(0,5).join('')}. xG fora: ${predictions.expectedGoalsAway}`,
      predictions.awayWinProb, predictions.awayWinProb > 52 ? 'medium' : 'low', predictions.awayWinProb > 48);
  }
  if (homeStats.scoringStreak >= 5 && awayStats.concedingStreak >= 4) {
    add('streak-home-score', 'goals', `${homeTeam} marca — Sequência ativa`,
      `${homeTeam} marcou nos últimos ${homeStats.scoringStreak} jogos. ${awayTeam} sofreu nos últimos ${awayStats.concedingStreak}`,
      predictions.homeToScoreProb, 'medium', predictions.homeToScoreProb > 80);
  }
  if (awayStats.scoringStreak >= 5 && homeStats.concedingStreak >= 4) {
    add('streak-away-score', 'goals', `${awayTeam} marca — Sequência ativa`,
      `${awayTeam} marcou nos últimos ${awayStats.scoringStreak} jogos. ${homeTeam} sofreu nos últimos ${homeStats.concedingStreak}`,
      predictions.awayToScoreProb, 'medium', predictions.awayToScoreProb > 72);
  }

  // ---- TIPS CALIBRADAS PELO MERCADO ────────────────────────────────────────
  if (marketOdds?.totalLine != null) {
    const line = marketOdds.totalLine;
    if (Math.abs(line - 2.5) < 0.1) {
      if (predictions.over25Prob > 62 && predictions.expectedTotalGoals > 2.5) {
        add('market-over25', 'goals', 'Over 2.5 — Linha do mercado alinhada',
          `Linha: ${line}. Modelo: ${predictions.expectedTotalGoals.toFixed(2)} xG (${predictions.over25Prob}%)`,
          predictions.over25Prob, 'high', true);
      } else if (predictions.under25Prob > 58 && predictions.expectedTotalGoals < 2.5) {
        add('market-under25', 'goals', 'Under 2.5 — Linha do mercado alinhada',
          `Linha: ${line}. Modelo: ${predictions.expectedTotalGoals.toFixed(2)} xG (${predictions.under25Prob}%)`,
          predictions.under25Prob, 'high', true);
      }
    }
  }

  return tips.sort((a, b) => {
    // Sort: recommended first, then by probability
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return b.probability - a.probability;
  });
}

// ============================================================
// UTILITIES
// ============================================================
export function probToOdds(prob: number): number {
  if (prob <= 0 || prob >= 100) return 0;
  return Math.round((100 / prob) * 100) / 100;
}

export function formatDate(date: Date): string {
  return formatLocalISODate(date);
}

export function getToday(): string { return formatDate(new Date()); }

export function getTomorrow(): string {
  const d = new Date(); d.setDate(d.getDate() + 1); return formatDate(d);
}

export function getYesterday(): string {
  const d = new Date(); d.setDate(d.getDate() - 1); return formatDate(d);
}
