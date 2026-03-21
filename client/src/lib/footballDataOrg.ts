// Rapha Guru — football-data.org Integration v2
// Design: "Estádio Noturno" — Premium Sports Dark
//
// football-data.org free tier (API key obrigatória, registro gratuito em football-data.org):
// - 12+ competições (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Brasileirão, etc.)
// - Fixtures com estatísticas reais: gols, chutes, chutes no alvo, escanteios, cartões, posse
// - Rate limit: 10 requests/minuto → cache agressivo de 60min
//
// MELHORIA v2:
// - Mapeamento corrigido para IDs ESPN (não mais TheSportsDB)
// - Busca de fixtures com stats reais (não só standings)
// - Corners e cartões reais quando disponíveis
// - Suporte a mais ligas: Brasileirão, Libertadores, Eredivisie, Primeira Liga
// - Fallback gracioso para modelo Poisson quando sem API key ou liga não suportada

export interface FDOTeamStats {
  teamId: number;
  teamName: string;
  // Atacando
  goalsFor: number;           // média de gols marcados por jogo
  goalsAgainst: number;       // média de gols sofridos por jogo
  shotsPerGame: number;
  shotsOnTargetPerGame: number;
  // Posse
  avgPossession: number;      // 0-100
  // Disciplina
  yellowCardsPerGame: number;
  redCardsPerGame: number;
  // Escanteios (disponível nos fixtures do free tier)
  cornersPerGame: number;
  // xG derivado
  xGPerGame: number;
  xGConcededPerGame: number;
  // Casa/Fora
  goalsForHome: number;
  goalsForAway: number;
  goalsAgainstHome: number;
  goalsAgainstAway: number;
  cornersForHome: number;
  cornersForAway: number;
  // Qualidade
  matchesPlayed: number;
  matchesWithStats: number;   // partidas com dados reais (não estimados)
}

export interface FDOEnrichment {
  homeTeam: FDOTeamStats | null;
  awayTeam: FDOTeamStats | null;
  source: 'football-data.org' | 'estimated';
  lastUpdated: number;
}

// ============================================================
// MAPEAMENTO ESPN league ID → football-data.org competition code
// IDs ESPN (usados no Rapha Guru como idLeague) → código FDO v4
// Free tier cobre: PL, PD, BL1, SA, FL1, DED, PPL, CL, EL, ECL, WC, EC, CLI
// ============================================================
const ESPN_TO_FDO: Record<string, string> = {
  // Europa — Top 5 (cobertura total no free tier)
  '3918': 'PL',    // Premier League
  '740':  'PD',    // La Liga
  '720':  'BL1',   // Bundesliga
  '730':  'SA',    // Serie A
  '710':  'FL1',   // Ligue 1
  // Europa — Outras ligas (free tier)
  '725':  'DED',   // Eredivisie
  '715':  'PPL',   // Primeira Liga (Portugal)
  '735':  'PPL',   // Scottish Premiership — sem código FDO, usa PPL como fallback
  // 2ªs divisões (free tier não cobre — comentado para evitar chamadas desnecessárias)
  // '3919': 'ELC',  // Championship — só paid tier
  // '3927': 'BL2',  // 2. Bundesliga — só paid tier
  // Copas europeias e globais (free tier)
  '23':   'CL',    // UEFA Champions League
  '2':    'EL',    // UEFA Europa League
  '40':   'ECL',   // UEFA Conference League
  // Seleções (free tier)
  '4':    'WC',    // FIFA World Cup
  '17':   'EC',    // UEFA Euro
  '11':   'EC',    // UEFA Euro Qualifiers → mesmo torneio
  // Américas (free tier)
  '4351': 'BSA',   // Brasileirão Série A
  '21':   'CLI',   // CONMEBOL Libertadores
  // Sem suporte FDO free tier — não mapear para evitar chamadas desperdiçadas:
  // Argentine Primera, Chilean Primera, Colombiana, etc.
};

// Cache agressivo — 60 minutos (FDO free tier tem limite de 10 req/min)
const cache = new Map<string, { data: FDOEnrichment; ts: number }>();
const fixtureStatsCache = new Map<string, FDOTeamStats>();
const CACHE_TTL = 60 * 60 * 1000; // 60 minutos

// ============================================================
// BUSCA DE FIXTURES COM STATS REAIS
// GET /v4/competitions/{code}/matches?season={year}&status=FINISHED
// Retorna gols, chutes, escanteios, cartões, posse por jogo
// ============================================================
interface FDOMatch {
  id: number;
  homeTeam: { id: number; name: string; shortName: string };
  awayTeam: { id: number; name: string; shortName: string };
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    fullTime: { home: number | null; away: number | null };
  };
  statistics?: Array<{
    home: number | null;
    away: number | null;
    type: string; // 'SHOTS_ON_GOAL', 'SHOTS_TOTAL', 'CORNER_KICKS', 'YELLOW_CARDS', 'RED_CARDS', etc.
  }>;
  homeTeamStatistics?: Record<string, number>;
  awayTeamStatistics?: Record<string, number>;
  season?: { id: number; startDate: string; endDate: string; currentMatchday: number };
}

interface FDOMatchesResponse {
  matches: FDOMatch[];
  resultSet?: { count: number; first: string; last: string; played: number };
}

function getCurrentSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month < 8 ? year - 1 : year;
}

function getStat(match: FDOMatch, type: string, side: 'home' | 'away'): number {
  if (!match.statistics) return 0;
  const stat = match.statistics.find(s =>
    s.type.toLowerCase().includes(type.toLowerCase()) ||
    type.toLowerCase().includes(s.type.toLowerCase())
  );
  if (!stat) return 0;
  return Number(stat[side] ?? 0) || 0;
}

function buildTeamStatsFromFixtures(
  matches: FDOMatch[],
  teamId: number,
  teamName: string
): FDOTeamStats {
  if (matches.length === 0) return buildDefaultStats(teamId, teamName);

  let goalsFor = 0, goalsAgainst = 0;
  let goalsForHome = 0, goalsForAway = 0;
  let goalsAgainstHome = 0, goalsAgainstAway = 0;
  let totalShots = 0, totalShotsOnTarget = 0;
  let totalCorners = 0, cornersHome = 0, cornersAway = 0;
  let yellowCards = 0, redCards = 0;
  let possessionSum = 0;
  let matchesWithStats = 0;
  let homeGames = 0, awayGames = 0;

  for (const m of matches) {
    const isHome = m.homeTeam.id === teamId;
    const myGoals   = isHome ? (m.score.fullTime.home ?? 0) : (m.score.fullTime.away ?? 0);
    const oppGoals  = isHome ? (m.score.fullTime.away ?? 0) : (m.score.fullTime.home ?? 0);

    goalsFor     += myGoals;
    goalsAgainst += oppGoals;
    if (isHome) { homeGames++; goalsForHome += myGoals; goalsAgainstHome += oppGoals; }
    else         { awayGames++; goalsForAway += myGoals; goalsAgainstAway += oppGoals; }

    if (m.statistics && m.statistics.length > 0) {
      matchesWithStats++;
      const myShots          = getStat(m, 'SHOTS_TOTAL', isHome ? 'home' : 'away');
      const myOnTarget       = getStat(m, 'SHOTS_ON_GOAL', isHome ? 'home' : 'away');
      const myCorners        = getStat(m, 'CORNER_KICKS', isHome ? 'home' : 'away');
      const myYellow         = getStat(m, 'YELLOW_CARDS', isHome ? 'home' : 'away');
      const myRed            = getStat(m, 'RED_CARDS', isHome ? 'home' : 'away');
      const myPossession     = getStat(m, 'BALL_POSSESSION', isHome ? 'home' : 'away');

      totalShots        += myShots;
      totalShotsOnTarget += myOnTarget;
      totalCorners      += myCorners;
      if (isHome) cornersHome += myCorners;
      else        cornersAway += myCorners;
      yellowCards       += myYellow;
      redCards          += myRed;
      possessionSum     += myPossession;
    }
  }

  const n = matches.length;
  const ns = matchesWithStats || 1;

  // Estima o que não tem dados reais usando ratios históricos
  const avgGoalsFor   = goalsFor / n;
  const avgGoalsAgainst = goalsAgainst / n;
  const convRate = 0.11;
  const estimatedShots = avgGoalsFor / convRate;

  return {
    teamId,
    teamName,
    goalsFor:               avgGoalsFor,
    goalsAgainst:           avgGoalsAgainst,
    shotsPerGame:           matchesWithStats > 0 ? totalShots / ns : estimatedShots,
    shotsOnTargetPerGame:   matchesWithStats > 0 ? totalShotsOnTarget / ns : estimatedShots * 0.38,
    avgPossession:          matchesWithStats > 0 ? possessionSum / ns : 50,
    yellowCardsPerGame:     matchesWithStats > 0 ? yellowCards / ns : 1.5,
    redCardsPerGame:        matchesWithStats > 0 ? redCards / ns : 0.07,
    cornersPerGame:         matchesWithStats > 0 ? totalCorners / ns : estimatedShots * 0.35,
    xGPerGame:              matchesWithStats > 0 ? totalShotsOnTarget / ns * 0.30 : avgGoalsFor * 0.95,
    xGConcededPerGame:      avgGoalsAgainst * 0.95,
    goalsForHome:           homeGames > 0 ? goalsForHome / homeGames : avgGoalsFor * 1.1,
    goalsForAway:           awayGames > 0 ? goalsForAway / awayGames : avgGoalsFor * 0.9,
    goalsAgainstHome:       homeGames > 0 ? goalsAgainstHome / homeGames : avgGoalsAgainst * 0.9,
    goalsAgainstAway:       awayGames > 0 ? goalsAgainstAway / awayGames : avgGoalsAgainst * 1.1,
    cornersForHome:         homeGames > 0 ? cornersHome / homeGames : (totalCorners / ns) * 0.54,
    cornersForAway:         awayGames > 0 ? cornersAway / awayGames : (totalCorners / ns) * 0.46,
    matchesPlayed:          n,
    matchesWithStats,
  };
}

function buildDefaultStats(teamId: number, teamName: string): FDOTeamStats {
  return {
    teamId, teamName,
    goalsFor: 1.4, goalsAgainst: 1.2,
    shotsPerGame: 12.7, shotsOnTargetPerGame: 4.8,
    avgPossession: 50, yellowCardsPerGame: 1.5, redCardsPerGame: 0.07,
    cornersPerGame: 5.2, xGPerGame: 1.44, xGConcededPerGame: 1.14,
    goalsForHome: 1.6, goalsForAway: 1.2,
    goalsAgainstHome: 1.1, goalsAgainstAway: 1.3,
    cornersForHome: 5.5, cornersForAway: 4.9,
    matchesPlayed: 0, matchesWithStats: 0,
  };
}

function normalizeTeamName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamNamesMatch(a: string, b: string): boolean {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (na === nb) return true;
  // Verifica se um contém o outro (ex: "Manchester City" vs "Man City")
  const wordsA = na.split(' ').filter(w => w.length > 2);
  const wordsB = nb.split(' ').filter(w => w.length > 2);
  const commonWords = wordsA.filter(w => wordsB.includes(w));
  return commonWords.length >= Math.min(1, Math.min(wordsA.length, wordsB.length));
}

// ============================================================
// FUNÇÃO PRINCIPAL DE ENRIQUECIMENTO
// ============================================================
export async function enrichMatchData(
  homeTeamName: string,
  awayTeamName: string,
  leagueId: string,
  apiKey?: string
): Promise<FDOEnrichment> {
  const cacheKey = `${homeTeamName}__${awayTeamName}__${leagueId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const competitionCode = ESPN_TO_FDO[leagueId];

  if (!apiKey || !competitionCode) {
    const estimated = { homeTeam: null, awayTeam: null, source: 'estimated' as const, lastUpdated: Date.now() };
    cache.set(cacheKey, { data: estimated, ts: Date.now() });
    return estimated;
  }

  try {
    const season = getCurrentSeason();

    // Busca os fixtures da temporada atual + anterior em paralelo
    const [res1, res2] = await Promise.allSettled([
      fetch(`https://api.football-data.org/v4/competitions/${competitionCode}/matches?season=${season}&status=FINISHED`, {
        headers: { 'X-Auth-Token': apiKey },
      }),
      fetch(`https://api.football-data.org/v4/competitions/${competitionCode}/matches?season=${season - 1}&status=FINISHED`, {
        headers: { 'X-Auth-Token': apiKey },
      }),
    ]);

    const allMatches: FDOMatch[] = [];

    for (const r of [res1, res2]) {
      if (r.status !== 'fulfilled' || !r.value.ok) continue;
      const data = await r.value.json() as FDOMatchesResponse;
      if (data.matches) allMatches.push(...data.matches);
    }

    if (allMatches.length === 0) throw new Error('Sem fixtures');

    // Filtra jogos dos dois times
    const homeMatches = allMatches.filter(m =>
      teamNamesMatch(m.homeTeam.name, homeTeamName) || teamNamesMatch(m.homeTeam.shortName, homeTeamName) ||
      teamNamesMatch(m.awayTeam.name, homeTeamName) || teamNamesMatch(m.awayTeam.shortName, homeTeamName)
    ).slice(-30); // últimos 30

    const awayMatches = allMatches.filter(m =>
      teamNamesMatch(m.homeTeam.name, awayTeamName) || teamNamesMatch(m.homeTeam.shortName, awayTeamName) ||
      teamNamesMatch(m.awayTeam.name, awayTeamName) || teamNamesMatch(m.awayTeam.shortName, awayTeamName)
    ).slice(-30);

    // Identifica o ID numérico de cada time
    const homeTeamEntry = homeMatches[0]
      ? (teamNamesMatch(homeMatches[0].homeTeam.name, homeTeamName) || teamNamesMatch(homeMatches[0].homeTeam.shortName, homeTeamName)
        ? homeMatches[0].homeTeam : homeMatches[0].awayTeam)
      : null;

    const awayTeamEntry = awayMatches[0]
      ? (teamNamesMatch(awayMatches[0].homeTeam.name, awayTeamName) || teamNamesMatch(awayMatches[0].homeTeam.shortName, awayTeamName)
        ? awayMatches[0].homeTeam : awayMatches[0].awayTeam)
      : null;

    const homeStats = homeTeamEntry
      ? buildTeamStatsFromFixtures(homeMatches, homeTeamEntry.id, homeTeamName)
      : null;

    const awayStats = awayTeamEntry
      ? buildTeamStatsFromFixtures(awayMatches, awayTeamEntry.id, awayTeamName)
      : null;

    const enrichment: FDOEnrichment = {
      homeTeam: homeStats,
      awayTeam: awayStats,
      source: 'football-data.org',
      lastUpdated: Date.now(),
    };

    cache.set(cacheKey, { data: enrichment, ts: Date.now() });
    return enrichment;

  } catch {
    const estimated = { homeTeam: null, awayTeam: null, source: 'estimated' as const, lastUpdated: Date.now() };
    cache.set(cacheKey, { data: estimated, ts: Date.now() });
    return estimated;
  }
}

// ============================================================
// APLICA ENRIQUECIMENTO AO MODELO POISSON
// Blend: 55% modelo histórico ESPN + 45% dados reais FDO
// Quando FDO tem stats reais (corners/posse), o blend sobe para 60% FDO
// ============================================================
export function applyEnrichmentToXG(
  baseXGHome: number,
  baseXGAway: number,
  enrichment: FDOEnrichment
): { xGHome: number; xGAway: number; possessionHome: number; possessionAway: number; cornersHome: number; cornersAway: number } {
  const noData = {
    xGHome: baseXGHome, xGAway: baseXGAway,
    possessionHome: 50, possessionAway: 50,
    cornersHome: 0, cornersAway: 0,
  };

  if (enrichment.source === 'estimated' || !enrichment.homeTeam || !enrichment.awayTeam) return noData;

  const h = enrichment.homeTeam;
  const a = enrichment.awayTeam;

  // Blend mais alto quando temos dados reais de chutes/corners
  const hasRealStats = h.matchesWithStats > 3 && a.matchesWithStats > 3;
  const blendFDO = hasRealStats ? 0.50 : 0.35;
  const blendBase = 1 - blendFDO;

  const xGHome = Math.max(0.2, baseXGHome * blendBase + h.xGPerGame * blendFDO);
  const xGAway = Math.max(0.2, baseXGAway * blendBase + a.xGPerGame * blendFDO);

  const totalPoss = h.avgPossession + a.avgPossession;
  const possessionHome = totalPoss > 0 ? Math.round((h.avgPossession / totalPoss) * 100) : 50;

  // Corners reais quando disponíveis
  const cornersHome = hasRealStats ? h.cornersForHome : 0;
  const cornersAway = hasRealStats ? a.cornersForAway : 0;

  return {
    xGHome,
    xGAway,
    possessionHome,
    possessionAway: 100 - possessionHome,
    cornersHome,
    cornersAway,
  };
}

// ============================================================
// API KEY MANAGEMENT
// ============================================================
const FDO_API_KEY_STORAGE = 'fdo_api_key';

export function getFDOApiKey(): string | null {
  try { return localStorage.getItem(FDO_API_KEY_STORAGE); } catch { return null; }
}
export function setFDOApiKey(key: string): void {
  try { localStorage.setItem(FDO_API_KEY_STORAGE, key); } catch {}
}
export function removeFDOApiKey(): void {
  try { localStorage.removeItem(FDO_API_KEY_STORAGE); } catch {}
}
export function getSupportedLeaguesFDO(): string[] { return Object.keys(ESPN_TO_FDO); }
