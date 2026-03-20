// useMatches.ts
// Design: "Estádio Noturno" — Premium Sports Dark
// Estratégia: ESPN API como fonte principal (100 jogos/dia, sem rate limiting)
// LIVE: polling a cada 30s, cache de 30s para jogos ao vivo, detecção correta de state='in'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Match } from '@/lib/types';
import { formatLocalISODate } from '@/lib/utils';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Mapeamento de IDs de liga da ESPN para nomes em português
const ESPN_LEAGUE_MAP: Record<string, string> = {
  // Europa — Top 5
  '3918': '🏴 Premier League',
  '740': '🇪🇸 La Liga',
  '720': '🇩🇪 Bundesliga',
  '730': '🇮🇹 Serie A',
  '710': '🇫🇷 Ligue 1',
  // Europa — 2ªs Divisões
  '3919': '🏴 Championship',
  '3927': '🇩🇪 2. Bundesliga',
  '3921': '🇪🇸 Segunda División',
  '3931': '🇫🇷 Ligue 2',
  '3930': '🇮🇹 Serie B',
  // Europa — Outras ligas
  '725': '🇳🇱 Eredivisie',
  '715': '🇵🇹 Primeira Liga',
  '735': '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Premiership',
  '750': '🇹🇷 Süper Lig',
  '755': '🇧🇪 Pro League',
  '745': '🇷🇺 Russian Premier League',
  '20956': '🇪🇸 Primera Federación',
  '3924': '🇦🇹 Bundesliga Áustria',
  '3922': '🇬🇷 Super League Grécia',
  '3923': '🇨🇿 Fortuna Liga',
  '3926': '🇩🇰 Superligaen',
  '3933': '🇵🇱 Ekstraklasa',
  '3936': '🇷🇴 SuperLiga Romênia',
  '3937': '🇷🇸 SuperLiga Sérvia',
  '3938': '🇸🇪 Allsvenskan',
  '3939': '🇨🇭 Super League Suíça',
  '3940': '🇺🇦 Premier League Ucrânia',
  '3941': '🇸🇰 Fortuna liga Eslováquia',
  '3942': '🇸🇮 PrvaLiga Eslovênia',
  '3944': '🇭🇷 Hrvatska nogometna liga',
  '3945': '🇧🇬 Parva Liga',
  '3946': '🇮🇸 Úrvalsdeild',
  '4326': '🇳🇴 Eliteserien',
  '4300': '🏴󠁧󠁢󠁷󠁬󠁳󠁿 Welsh Premier League',
  '4343': '🇫🇮 Veikkausliiga',
  // América
  '4351': '🇧🇷 Brasileirão Série A',
  '4352': '🇧🇷 Brasileirão Série B',
  '4353': '🇧🇷 Brasileirão Série C',
  '4356': '🇦🇷 Argentine Primera',
  '4358': '🇨🇱 Chilean Primera',
  '4357': '🇨🇴 Colombiana Primera',
  '4359': '🇵🇪 Peruvian Primera',
  '770': '🇺🇸 MLS',
  '4002': '🇺🇸 USL Championship',
  '19915': '🇺🇸 USL League One',
  '23633': '🇺🇸 USL Super League',
  '760': '🇲🇽 Liga MX',
  '3932': '🇲🇽 Liga de Expansión MX',
  '3928': '🇬🇹 Liga Nacional Guatemala',
  '3929': '🇭🇳 Liga Nacional Honduras',
  '3934': '🇵🇾 División Profesional Paraguay',
  '3943': '🇸🇻 Primera División El Salvador',
  '660': '🇪🇨 LigaPro Ecuador',
  '650': '🇨🇴 Copa Colombia',
  '4355': '🇺🇾 Primera División Uruguai',
  '4354': '🇻🇪 Primera División Venezuela',
  '4360': '🇧🇴 División Profesional Bolivia',
  // Ásia e Oceania
  '21231': '🇸🇦 Saudi Pro League',
  '8316': '🇮🇳 Indian Super League',
  '3906': '🇦🇺 A-League',
  '18992': '🇦🇺 A-League Women',
  '23537': '🌏 AFC Championship',
  '15': '🌏 AFC Asian Cup',
  '30': '🌏 AFC Eliminatórias',
  '31': '🌊 OFC Eliminatórias',
  '4803': '🇯🇵 J1 League',
  '4804': '🇰🇷 K League 1',
  '4805': '🇨🇳 Super League China',
  '4820': '🇶🇦 Qatar Stars League',
  '4821': '🇦🇪 UAE Pro League',
  '4822': '🇰🇼 Kuwait Premier League',
  // Competições europeias e globais
  '23': '🏆 UEFA Champions League',
  '2': '🏆 UEFA Europa League',
  '40': '🏆 UEFA Conference League',
  '776': '🏆 UEFA Europa League',
  '20296': '🏆 UEFA Conference League',
  '630': '🇧🇷 Copa do Brasil',
  '5699': '🏆 Leagues Cup',
  '8306': '🇧🇷 Campeonato Carioca',
  '8345': '🌍 CAF Champions League',
  '18505': '🇮🇳 Durand Cup',
  '3916': '🏆 FA Cup',
  '3920': '🏆 EFL Trophy',
  '3925': '🏆 DFB-Pokal',
  '3935': '🏆 Copa del Rey',
  '3947': '🏆 Coppa Italia',
  '3948': '🏆 Coupe de France',
  '3949': '🏆 Taça de Portugal',
  '22': '🌎 CONMEBOL Sudamericana',
  '21': '🌎 CONMEBOL Libertadores',
  // Seleções Nacionais
  '4': '🌍 FIFA Copa do Mundo',
  '7': '🌎 Copa América',
  '9': '🌍 UEFA Nations League',
  '10': '🌎 CONMEBOL Eliminatórias',
  '11': '🌍 UEFA Eliminatórias',
  '12': '🌍 CONCACAF Nations League',
  '13': '🌍 CONCACAF Gold Cup',
  '14': '🌍 Africa Cup of Nations',
  '16': '🌍 FIFA Amistosos',
  '17': '🌍 UEFA Euro',
  '18': '🌍 FIFA Club World Cup',
  '19': '🌍 FIFA Confederations Cup',
  '20': '🌍 CONCACAF Champions Cup',
  '26': '🌍 UEFA Super Cup',
  '27': '🌍 FIFA Intercontinental Cup',
  '28': '🌍 CONCACAF Eliminatórias',
  '29': '🌍 CAF Eliminatórias',
};

function decorateLeagueName(rawName: string): string {
  const name = (rawName || '').trim();
  if (!name) return 'Futebol';
  const lower = name.toLowerCase();

  const decorations: Array<[string, string]> = [
    ['j1 league', '🇯🇵 '],
    ['j.league', '🇯🇵 '],
    ['j-league', '🇯🇵 '],
    ['j league', '🇯🇵 '],
    ['k league', '🇰🇷 '],
    ['kleague', '🇰🇷 '],
    ['chinese super league', '🇨🇳 '],
    ['super league china', '🇨🇳 '],
    ['thai league', '🇹🇭 '],
    ['isuzu thai league', '🇹🇭 '],
    ['indian super league', '🇮🇳 '],
    ['saudi pro league', '🇸🇦 '],
    ['qatar stars league', '🇶🇦 '],
    ['uae pro league', '🇦🇪 '],
    ['a-league women', '🇦🇺 '],
    ['a-league', '🇦🇺 '],
    ['new zealand', '🇳🇿 '],
    ['ofc', '🌊 '],
    ['afc champions', '🌏 '],
    ['afc cup', '🌏 '],
  ];

  for (const [term, prefix] of decorations) {
    if (lower.includes(term)) {
      return name.startsWith(prefix.trim()) ? name : `${prefix}${name}`;
    }
  }

  // Check if name starts with emoji (simplified without unicode flag)
  return name.match(/^[\uD800-\uDBFF][\uDC00-\uDFFF]|^[\u2600-\u27BF]|^[\u1F300-\u1F9FF]/) ? name : `⚽ ${name}`;
}

// Ligas prioritárias (aparecem primeiro na lista)
const PRIORITY_LEAGUES = new Set([
  // Seleções nacionais — máxima prioridade
  '4', '7', '9', '10', '11', '12', '13', '14', '15', '16', '17', '21', '22',
  '28', '29', '30', '31',
  // Europa — Top 5 + 2ªs divisões
  '3918', '740', '720', '730', '710', '23', '2', '40',
  '3919', '3927', '3921', '3931', '3930',
  // Europa — Outras ligas
  '725', '715', '750', '755', '735',
  '3924', '3922', '3923', '3926', '3933', '3936', '3937', '3938', '3939',
  '3940', '3941', '3942', '3944', '3945', '4326', '4343',
  // Copas europeias
  '3916', '3920', '3925', '3935', '3947', '3948', '3949',
  '776', '20296',
  // Américas
  '4351', '4352', '4356', '4358', '4357', '4359', '760', '770', '630',
  '4353', '4355', '4354', '4360', '650', '660',
  // Ásia e Oceania
  '21231', '3906', '18992', '8316', '23537',
  '4803', '4804', '4805', '4820', '4821',
  // Extras relevantes
  '8306', '8345', '776', '20296', '5699',
]);

// Estados ao vivo da ESPN (state='in')
const ESPN_LIVE_STATES = new Set(['in']);

// Descrições de status ao vivo da ESPN
const ESPN_LIVE_DESCRIPTIONS = new Set([
  'First Half', 'Second Half', 'Halftime', 'Half Time',
  'Extra Time First Half', 'Extra Time Second Half', 'Extra Time',
  'Penalty Shootout', 'Penalties', 'Added Time',
  'In Progress',
]);

// Descrições de jogo finalizado
const ESPN_FINISHED_DESCRIPTIONS = new Set([
  'Full Time', 'Final', 'FT', 'AET', 'AP',
  'After Extra Time', 'After Penalties',
  'Abandoned', 'Postponed', 'Suspended', 'Cancelarled',
]);

// Converte data YYYY-MM-DD para formato ESPN YYYYMMDD
function toESPNDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

// Extrai o ID da liga do UID do evento ESPN
function getLeagueIdFromUID(uid: string): string {
  for (const part of uid.split('~')) {
    if (part.startsWith('l:')) return part.slice(2);
  }
  return '';
}

// Determina o status do jogo baseado nos campos ESPN
function getMatchStatus(comp: Record<string, unknown>): {
  isLive: boolean;
  isFinished: boolean;
  strStatus: string;
  displayClock: string;
  period: number;
  statusLabel: string;
} {
  const status = comp.status as Record<string, unknown> | undefined;
  if (!status) return { isLive: false, isFinished: false, strStatus: '', displayClock: '', period: 0, statusLabel: '' };

  const statusType = (status.type as Record<string, unknown>) || {};
  const state = (statusType.state as string) || '';
  const description = (statusType.description as string) || '';
  const shortDetail = (status.displayClock as string) || '';
  const period = (status.period as number) || 0;

  // ✅ CORREÇÃO: usar state='in' para detectar jogo ao vivo
  const isLive = ESPN_LIVE_STATES.has(state) || ESPN_LIVE_DESCRIPTIONS.has(description);
  const isFinished = state === 'post' || ESPN_FINISHED_DESCRIPTIONS.has(description);

  // Traduz o período para português
  const periodLabel = (() => {
    if (!isLive) return '';
    if (description === 'Halftime' || description === 'Half Time') return 'Intervalo';
    if (period === 1) return '1º Tempo';
    if (period === 2) return '2º Tempo';
    if (period === 3) return 'Prorrogação 1T';
    if (period === 4) return 'Prorrogação 2T';
    if (period === 5) return 'Pênaltis';
    return description;
  })();

  const statusLabel = isLive
    ? (description === 'Halftime' || description === 'Half Time')
      ? 'Intervalo'
      : `${periodLabel} ${shortDetail}`.trim()
    : isFinished ? 'Encerrado' : '';

  return {
    isLive,
    isFinished,
    strStatus: isLive ? 'In Progress' : isFinished ? 'Match Finished' : '',
    displayClock: shortDetail,
    period,
    statusLabel,
  };
}

// Converte evento ESPN para o formato Match interno
function espnEventToMatch(event: Record<string, unknown>): Match | null {
  try {
    const competitions = (event.competitions as Record<string, unknown>[]) || [];
    if (!competitions.length) return null;
    
    const comp = competitions[0] as Record<string, unknown>;
    const competitors = (comp.competitors as Record<string, unknown>[]) || [];
    
    const homeTeam = competitors.find(t => (t as Record<string, unknown>).homeAway === 'home') as Record<string, unknown> | undefined;
    const awayTeam = competitors.find(t => (t as Record<string, unknown>).homeAway === 'away') as Record<string, unknown> | undefined;
    
    if (!homeTeam || !awayTeam) return null;
    
    const homeTeamData = homeTeam.team as Record<string, unknown>;
    const awayTeamData = awayTeam.team as Record<string, unknown>;
    
    if (!homeTeamData || !awayTeamData) return null;
    
    const uid = (event.uid as string) || '';
    const leagueId = getLeagueIdFromUID(uid);
    const eventLeagueName = (event.league as Record<string, unknown>)?.name as string || '';
    const leagueName = ESPN_LEAGUE_MAP[leagueId] || (eventLeagueName ? decorateLeagueName(eventLeagueName) : 'Futebol');
    
    // Data e hora
    const dateStr = (event.date as string) || '';
    const dateEvent = dateStr.slice(0, 10);
    const timeUTC = dateStr.slice(11, 16) || '';
    
    // Converte UTC para horário local (BRT = UTC-3)
    let strTime = '';
    if (timeUTC) {
      const [h, m] = timeUTC.split(':').map(Number);
      const localH = (h - 3 + 24) % 24;
      strTime = `${String(localH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }
    
    // ✅ CORREÇÃO: usa getMatchStatus para detecção correta de ao vivo
    const { isLive, isFinished, strStatus, displayClock, period, statusLabel } = getMatchStatus(comp);
    
    // Placar — ESPN retorna como string ou objeto
    const getScore = (competitor: Record<string, unknown>): string => {
      const score = competitor.score;
      if (score === null || score === undefined) return '';
      if (typeof score === 'object' && score !== null) {
        return String((score as Record<string, unknown>).displayValue ?? (score as Record<string, unknown>).value ?? '');
      }
      return String(score);
    };
    
    const homeScore = getScore(homeTeam);
    const awayScore = getScore(awayTeam);
    
    // Odds da ESPN (se disponíveis)
    const odds = comp.odds as Record<string, unknown>[] | undefined;
    let homeOdds: number | undefined;
    let drawOdds: number | undefined;
    let awayOdds: number | undefined;
    
    if (odds && odds.length > 0) {
      const mainOdds = odds[0] as Record<string, unknown>;
      const moneyline = mainOdds.moneyline as Record<string, unknown> | undefined;
      if (moneyline) {
        const homeML = ((moneyline.home as Record<string, unknown>)?.close as Record<string, unknown>)?.odds as number | undefined;
        const awayML = ((moneyline.away as Record<string, unknown>)?.close as Record<string, unknown>)?.odds as number | undefined;
        const drawML = ((moneyline.draw as Record<string, unknown>)?.close as Record<string, unknown>)?.odds as number | undefined;
        
        if (homeML) homeOdds = homeML > 0 ? (homeML / 100) + 1 : (100 / Math.abs(homeML)) + 1;
        if (awayML) awayOdds = awayML > 0 ? (awayML / 100) + 1 : (100 / Math.abs(awayML)) + 1;
        if (drawML) drawOdds = drawML > 0 ? (drawML / 100) + 1 : (100 / Math.abs(drawML)) + 1;
      }
    }
    
    const homeTeamId = String(homeTeamData.id || '');
    const awayTeamId = String(awayTeamData.id || '');
    
    return {
      idEvent: String(event.id || uid),
      strEvent: `${homeTeamData.displayName} vs ${awayTeamData.displayName}`,
      strHomeTeam: String(homeTeamData.displayName || ''),
      strAwayTeam: String(awayTeamData.displayName || ''),
      strHomeTeamBadge: String(homeTeamData.logo || ''),
      strAwayTeamBadge: String(awayTeamData.logo || ''),
      strLeague: leagueName,
      strLeagueId: leagueId,
      dateEvent,
      strTime,
      // ✅ Placar sempre preenchido quando ao vivo ou encerrado
      intHomeScore: (isLive || isFinished) ? homeScore : null,
      intAwayScore: (isLive || isFinished) ? awayScore : null,
      strStatus,
      // Campos extras ao vivo
      liveDisplayClock: displayClock,
      livePeriod: period,
      liveStatusLabel: statusLabel,
      strVenue: (comp.venue as Record<string, unknown>)?.fullName as string || '',
      intRound: '',
      idLeague: leagueId,
      idHomeTeam: homeTeamId,
      idAwayTeam: awayTeamId,
      espnHomeTeamId: homeTeamId,
      espnAwayTeamId: awayTeamId,
      espnLeagueId: leagueId,
      espnHomeOdds: homeOdds,
      espnDrawOdds: drawOdds,
      espnAwayOdds: awayOdds,
    } as Match;
  } catch {
    return null;
  }
}

// Cache com TTL diferenciado para jogos ao vivo (30s) vs normais (5min)
const apiCache = new Map<string, { data: unknown; timestamp: number; hasLive: boolean }>();
const CACHE_TTL_NORMAL = 5 * 60 * 1000; // 5 minutos para datas sem jogos ao vivo
const CACHE_TTL_LIVE = 30 * 1000;        // 30 segundos quando há jogos ao vivo

async function fetchESPN<T>(url: string, signal?: AbortSignal, forceRefresh = false): Promise<T | null> {
  const cached = apiCache.get(url);
  if (cached && !forceRefresh) {
    const ttl = cached.hasLive ? CACHE_TTL_LIVE : CACHE_TTL_NORMAL;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
  }
  
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal,
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    // Detecta se há jogos ao vivo para definir o TTL do cache
    const events = (data as Record<string, unknown>).events as Record<string, unknown>[] | undefined;
    const hasLive = events?.some(e => {
      const comp = ((e.competitions as Record<string, unknown>[])?.[0]) as Record<string, unknown> | undefined;
      const state = ((comp?.status as Record<string, unknown>)?.type as Record<string, unknown>)?.state as string;
      return state === 'in';
    }) ?? false;
    
    apiCache.set(url, { data, timestamp: Date.now(), hasLive });
    return data;
  } catch (err) {
    if (signal?.aborted) return null;
    return null;
  }
}

// Busca todos os jogos de uma data via ESPN
async function fetchMatchesByDate(date: string, signal?: AbortSignal, forceRefresh = false): Promise<Match[]> {
  const espnDate = toESPNDate(date);
  
  const data = await fetchESPN<{ events: Record<string, unknown>[] }>(
    `${ESPN_BASE}/all/scoreboard?dates=${espnDate}&limit=200`,
    signal,
    forceRefresh
  );
  
  if (!data?.events) return [];
  
  const matches: Match[] = [];
  for (const event of data.events) {
    const match = espnEventToMatch(event);
    if (match) matches.push(match);
  }
  
  return matches;
}

// Ordena matches: ao vivo primeiro, depois por prioridade de liga e horário
function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    // Jogos ao vivo primeiro
    const aLive = a.strStatus === 'In Progress' ? 0 : a.strStatus === 'Match Finished' ? 2 : 1;
    const bLive = b.strStatus === 'In Progress' ? 0 : b.strStatus === 'Match Finished' ? 2 : 1;
    if (aLive !== bLive) return aLive - bLive;

    const aLeagueId = a.espnLeagueId || '';
    const bLeagueId = b.espnLeagueId || '';
    const aPriority = PRIORITY_LEAGUES.has(aLeagueId) ? 0 : 1;
    const bPriority = PRIORITY_LEAGUES.has(bLeagueId) ? 0 : 1;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    const timeA = a.strTime || '99:99:99';
    const timeB = b.strTime || '99:99:99';
    return timeA.localeCompare(timeB);
  });
}

function getToday(): string {
  return formatLocalISODate(new Date());
}

const LIVE_POLL_MS = 30_000; // 30 segundos

export function useMatches(selectedDate: string) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMatches = useCallback(async (date: string, forceRefresh = false) => {
    // Cancelara requisição anterior
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setProgress(30);

    try {
      const espnMatches = await fetchMatchesByDate(date, controller.signal, forceRefresh);
      
      if (controller.signal.aborted) return;
      
      setProgress(90);
      
      if (espnMatches.length > 0) {
        const sorted = sortMatches(espnMatches);
        setMatches(sorted);
      } else {
        setMatches([]);
      }
      
      setProgress(100);
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Erro ao buscar partidas:', err);
        setError('Erro ao carregar partidas. Verifique sua conexão e tente novamente.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setProgress(100);
      }
    }
  }, []);

  // Busca inicial quando a data muda
  useEffect(() => {
    fetchMatches(selectedDate, false);
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [selectedDate, fetchMatches]);

  // ✅ Polling ao vivo: sempre ativo para hoje, independente de ter jogos ao vivo detectados
  // Isso garante que quando os jogos começarem, eles apareçam automaticamente
  useEffect(() => {
    const isToday = selectedDate === getToday();
    if (!isToday) return;

    // Limpa interval anterior
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
    }

    const startPolling = () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = setInterval(() => {
        // Não busca se a aba está em background — economiza requisições
        if (document.hidden) return;
        const espnDate = toESPNDate(selectedDate);
        const url = `${ESPN_BASE}/all/scoreboard?dates=${espnDate}&limit=200`;
        apiCache.delete(url); // Invalida cache para forçar nova requisição
        fetchMatches(selectedDate, true);
      }, LIVE_POLL_MS);
    };

    startPolling();

    // Quando o usuário volta para a aba, faz fetch imediato
    const handleVisibility = () => {
      if (!document.hidden) {
        const espnDate = toESPNDate(selectedDate);
        const url = `${ESPN_BASE}/all/scoreboard?dates=${espnDate}&limit=200`;
        apiCache.delete(url);
        fetchMatches(selectedDate, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [selectedDate, fetchMatches]);

  const refetch = useCallback(() => {
    const espnDate = toESPNDate(selectedDate);
    const url = `${ESPN_BASE}/all/scoreboard?dates=${espnDate}&limit=200`;
    apiCache.delete(url);
    fetchMatches(selectedDate, true);
  }, [selectedDate, fetchMatches]);

  const uniqueLeagues = new Set(matches.map(m => m.espnLeagueId)).size;

  return {
    matches,
    loading,
    error,
    progress,
    loadedLeagues: uniqueLeagues,
    totalLeagues: 1,
    refetch,
  };
}
