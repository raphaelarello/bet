// useMatches.ts
// Design: "Estádio Noturno" — Premium Sports Dark
// Estratégia MULTI-FONTE:
//   1. ESPN /all/scoreboard (limit=500 + paginação automática)
//   2. ESPN por slug de liga (~80 ligas em paralelo — garante cobertura total)
//   3. OpenLigaDB (gratuita, sem API key — Bundesliga, 2. Bundesliga, DFB-Pokal)
//   4. TheSportsDB (gratuita, key=123 — Brasileirão, Sul-Americanas, Ásia)
//   Deduplicação inteligente por ID e por times+data (cross-fonte)
// LIVE: polling a cada 30s, cache diferenciado ao vivo vs normal

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

// ============================================================
// ESTRATÉGIA MULTI-FONTE
// Fonte 1: ESPN /all/scoreboard (limit=500 + paginação)
// Fonte 2: ESPN por slug de liga (todas as ligas prioritárias em paralelo)
// Fonte 3: OpenLigaDB (gratuita, sem API key — cobre ligas alemãs + outras europeias)
// Fonte 4: TheSportsDB (gratuita, key=123 — fallback para ligas não cobertas pelas anteriores)
// Deduplicação: Map por idEvent, com preferência por dado ao vivo sobre dado pré-jogo
// ============================================================

// Todos os slugs ESPN conhecidos — buscados em paralelo para garantir cobertura total
const ESPN_LEAGUE_SLUGS: string[] = [
  // Europa — Top 5
  'eng.1',       // Premier League
  'esp.1',       // La Liga
  'ger.1',       // Bundesliga
  'ita.1',       // Serie A
  'fra.1',       // Ligue 1
  // Europa — 2ªs divisões
  'eng.2',       // Championship
  'ger.2',       // 2. Bundesliga
  'esp.2',       // Segunda División
  'fra.2',       // Ligue 2
  'ita.2',       // Serie B
  // Europa — Outras ligas top
  'ned.1',       // Eredivisie
  'por.1',       // Primeira Liga
  'sco.1',       // Scottish Premiership
  'tur.1',       // Süper Lig
  'bel.1',       // Pro League
  'rus.1',       // Russian Premier League
  'gre.1',       // Super League Grécia
  'den.1',       // Superligaen
  'pol.1',       // Ekstraklasa
  'swe.1',       // Allsvenskan
  'sui.1',       // Super League Suíça
  'nor.1',       // Eliteserien
  'aut.1',       // Bundesliga Áustria
  'cze.1',       // Fortuna Liga
  'rom.1',       // SuperLiga Romênia
  'srb.1',       // SuperLiga Sérvia
  'ukr.1',       // Premier League Ucrânia
  'cro.1',       // Hrvatska liga
  'bul.1',       // Parva Liga
  'fin.1',       // Veikkausliiga
  'svk.1',       // Fortuna liga Eslováquia
  'slo.1',       // PrvaLiga Eslovênia
  // Copas europeias e globais
  'uefa.champions',      // UEFA Champions League
  'uefa.europa',         // UEFA Europa League
  'uefa.europa.conf',    // UEFA Conference League
  'eng.fa',              // FA Cup
  'esp.copa_del_rey',    // Copa del Rey
  'ger.dfb_pokal',       // DFB-Pokal
  'ita.coppa_italia',    // Coppa Italia
  'fra.coupe_de_france', // Coupe de France
  // Américas — Brasil
  'bra.1',       // Brasileirão Série A
  'bra.2',       // Brasileirão Série B
  'bra.3',       // Brasileirão Série C
  'bra.copa',    // Copa do Brasil
  'bra.se',      // Estaduais (Carioca, Paulista, etc.)
  // Américas — Sul
  'conmebol.libertadores',   // Libertadores
  'conmebol.sudamericana',   // Sudamericana
  'arg.1',       // Argentine Primera
  'chi.1',       // Chilean Primera
  'col.1',       // Colombiana Primera
  'per.1',       // Peruvian Primera
  'uru.1',       // Uruguay Primera
  'ven.1',       // Venezuela Primera
  'bol.1',       // Bolivia División Profesional
  'par.1',       // Paraguay División Profesional
  'ecu.1',       // Ecuador LigaPro
  // Américas — Norte/Centro
  'usa.1',       // MLS
  'usa.2',       // USL Championship
  'mex.1',       // Liga MX
  'mex.2',       // Liga de Expansión
  'concacaf.champions',  // CONCACAF Champions Cup
  // Ásia e Oceania
  'sau.1',       // Saudi Pro League
  'jpn.1',       // J1 League
  'kor.1',       // K League 1
  'chn.1',       // Chinese Super League
  'qat.1',       // Qatar Stars League
  'uae.league',  // UAE Pro League
  'ind.1',       // Indian Super League
  'aus.1',       // A-League
  // África
  'caf.champions',  // CAF Champions League
  // Seleções
  'fifa.worldq.conmebol',    // CONMEBOL Eliminatórias
  'fifa.worldq.uefa',        // UEFA Eliminatórias
  'fifa.worldq.concacaf',    // CONCACAF Eliminatórias
  'fifa.worldq.caf',         // CAF Eliminatórias
  'fifa.worldq.afc',         // AFC Eliminatórias
  'conmebol.america',        // Copa América
  'uefa.nations',            // UEFA Nations League
  'uefa.euro',               // UEFA Euro
];

// ============================================================
// OPENLIGADB — API gratuita, sem API key, sem rate limit
// Cobre Bundesliga, 2. Bundesliga e ligas alemãs
// Docs: https://www.openligadb.de/
// ============================================================
const OPENLIGADB_BASE = 'https://api.openligadb.de';

// Ligas suportadas pelo OpenLigaDB (liga → { leagueShortcut, season })
// O season é dinâmico: se estamos em jan-jun, é o ano anterior; jul-dez é o ano atual
function getOpenLigaSeason(date: string): string {
  const year = parseInt(date.slice(0, 4));
  const month = parseInt(date.slice(5, 7));
  // Temporada europeia: começa em agosto → se antes de agosto, usa ano-1
  return month < 8 ? String(year - 1) : String(year);
}

const OPENLIGADB_LEAGUES: Array<{ shortcut: string; leagueName: string; leagueId: string }> = [
  { shortcut: 'bl1',   leagueName: '🇩🇪 Bundesliga',    leagueId: '720'  },
  { shortcut: 'bl2',   leagueName: '🇩🇪 2. Bundesliga',  leagueId: '3927' },
  { shortcut: 'bl3',   leagueName: '🇩🇪 3. Liga',        leagueId: 'ger.3'},
  { shortcut: 'dfb',   leagueName: '🏆 DFB-Pokal',       leagueId: '3925' },
];

interface OpenLigaMatch {
  MatchID: number;
  MatchDateTime: string;  // ISO 8601
  Team1: { TeamName: string; TeamIconUrl: string; ShortName: string };
  Team2: { TeamName: string; TeamIconUrl: string; ShortName: string };
  MatchIsFinished: boolean;
  MatchResults?: Array<{ ResultTypeID: number; PointsTeam1: number; PointsTeam2: number }>;
  Group?: { GroupName: string };
}

async function fetchOpenLigaDBMatches(date: string, signal?: AbortSignal): Promise<Match[]> {
  const season = getOpenLigaSeason(date);
  const matches: Match[] = [];

  const promises = OPENLIGADB_LEAGUES.map(async ({ shortcut, leagueName, leagueId }) => {
    try {
      const url = `${OPENLIGADB_BASE}/getmatchdata/${shortcut}/${season}`;
      const cached = apiCache.get(url);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_NORMAL) {
        return cached.data as OpenLigaMatch[];
      }
      const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = (await res.json()) as OpenLigaMatch[];
      apiCache.set(url, { data, timestamp: Date.now(), hasLive: false });
      return data;
    } catch {
      return [] as OpenLigaMatch[];
    }
  });

  const results = await Promise.allSettled(promises);

  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const { leagueName, leagueId } = OPENLIGADB_LEAGUES[i];
    const dayMatches = (r.value as OpenLigaMatch[]).filter(m => m.MatchDateTime?.slice(0, 10) === date);

    for (const m of dayMatches) {
      const finalResult = m.MatchResults?.find(r => r.ResultTypeID === 2);
      const htResult    = m.MatchResults?.find(r => r.ResultTypeID === 1);
      const isFinished  = m.MatchIsFinished;

      // Hora local (OpenLigaDB retorna em CET/CEST = UTC+1/+2, convertemos para BRT = UTC-3)
      let strTime = '';
      try {
        const d = new Date(m.MatchDateTime);
        // O horário já vem em UTC via Z ou offset — usamos getUTCHours
        const localH = (d.getUTCHours() - 3 + 24) % 24;
        const localM = d.getUTCMinutes();
        strTime = `${String(localH).padStart(2, '0')}:${String(localM).padStart(2, '0')}:00`;
      } catch { /* */ }

      const match: Match = {
        idEvent:         `oldb_${m.MatchID}`,
        strEvent:        `${m.Team1.TeamName} vs ${m.Team2.TeamName}`,
        strLeague:       leagueName,
        idLeague:        leagueId,
        strLeagueId:     leagueId,
        espnLeagueId:    leagueId,
        strHomeTeam:     m.Team1.TeamName,
        strAwayTeam:     m.Team2.TeamName,
        idHomeTeam:      `oldb_t_${m.Team1.ShortName}`,
        idAwayTeam:      `oldb_t_${m.Team2.ShortName}`,
        strHomeTeamBadge: m.Team1.TeamIconUrl,
        strAwayTeamBadge: m.Team2.TeamIconUrl,
        dateEvent:       date,
        strTime,
        strStatus:       isFinished ? 'Match Finished' : '',
        intHomeScore:    finalResult != null ? String(finalResult.PointsTeam1) : (htResult != null ? String(htResult.PointsTeam1) : null),
        intAwayScore:    finalResult != null ? String(finalResult.PointsTeam2) : (htResult != null ? String(htResult.PointsTeam2) : null),
      };
      matches.push(match);
    }
  });

  return matches;
}

// ============================================================
// THESPORTSDB — API gratuita (key=123), boa cobertura global
// Usada como fallback para ligas não cobertas pela ESPN
// ============================================================
const SPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json/123';

// Ligas TheSportsDB não bem cobertas pela ESPN
const SPORTSDB_EXTRA_LEAGUES: Array<{ id: string; name: string }> = [
  { id: '4351', name: '🇧🇷 Brasileirão Série A'   },
  { id: '4352', name: '🇧🇷 Brasileirão Série B'   },
  { id: '4399', name: '🇧🇷 Brasileirão Série A'   }, // ID alternativo no TSDB
  { id: '630',  name: '🇧🇷 Copa do Brasil'         },
  { id: '4356', name: '🇦🇷 Argentine Primera'      },
  { id: '4358', name: '🇨🇱 Chilean Primera'        },
  { id: '4357', name: '🇨🇴 Colombiana Primera'     },
  { id: '4355', name: '🇺🇾 Primera División Uruguai'},
  { id: '4354', name: '🇻🇪 Primera División Venezuela'},
  { id: '4360', name: '🇧🇴 División Profesional Bolivia'},
  { id: '21',   name: '🌎 CONMEBOL Libertadores'   },
  { id: '22',   name: '🌎 CONMEBOL Sudamericana'   },
  { id: '4803', name: '🇯🇵 J1 League'              },
  { id: '4804', name: '🇰🇷 K League 1'             },
  { id: '21231',name: '🇸🇦 Saudi Pro League'        },
  { id: '8306', name: '🇧🇷 Campeonato Carioca'      },
  { id: '8345', name: '🌍 CAF Champions League'    },
];

interface TSDBEvent {
  idEvent: string;
  strEvent: string;
  strLeague: string;
  idLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string;
  idAwayTeam: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  dateEvent: string;
  strTime: string;
  strStatus?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strVenue?: string;
}

async function fetchTheSportsDBMatches(date: string, signal?: AbortSignal): Promise<Match[]> {
  const matches: Match[] = [];
  const seenEvents = new Set<string>();

  const promises = SPORTSDB_EXTRA_LEAGUES.map(async ({ id, name }) => {
    try {
      const url = `${SPORTSDB_BASE_URL}/eventsday.php?d=${date}&l=${id}`;
      const cached = apiCache.get(url);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_NORMAL) {
        return { events: (cached.data as { events: TSDBEvent[] | null }).events, name, id };
      }
      const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!res.ok) return { events: null, name, id };
      const data = await res.json() as { events: TSDBEvent[] | null };
      apiCache.set(url, { data, timestamp: Date.now(), hasLive: false });
      return { events: data.events, name, id };
    } catch {
      return { events: null, name, id };
    }
  });

  const results = await Promise.allSettled(promises);

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value.events) continue;
    for (const e of r.value.events) {
      if (!e.idEvent || seenEvents.has(e.idEvent)) continue;
      seenEvents.add(e.idEvent);

      // Converte horário UTC para BRT (UTC-3)
      let strTime = e.strTime || '';
      if (strTime && strTime.length >= 5) {
        const [h, m] = strTime.split(':').map(Number);
        const localH = (h - 3 + 24) % 24;
        strTime = `${String(localH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      }

      const isFinished = e.strStatus === 'Match Finished';
      const isLive     = e.strStatus === 'In Progress';

      matches.push({
        idEvent:         `tsdb_${e.idEvent}`,
        strEvent:        e.strEvent || `${e.strHomeTeam} vs ${e.strAwayTeam}`,
        strLeague:       r.value.name,
        idLeague:        e.idLeague || r.value.id,
        strLeagueId:     e.idLeague || r.value.id,
        espnLeagueId:    e.idLeague || r.value.id,
        strHomeTeam:     e.strHomeTeam,
        strAwayTeam:     e.strAwayTeam,
        idHomeTeam:      e.idHomeTeam || '',
        idAwayTeam:      e.idAwayTeam || '',
        strHomeTeamBadge: e.strHomeTeamBadge,
        strAwayTeamBadge: e.strAwayTeamBadge,
        dateEvent:       date,
        strTime,
        strStatus:       isFinished ? 'Match Finished' : isLive ? 'In Progress' : '',
        intHomeScore:    (isFinished || isLive) ? (e.intHomeScore ?? null) : null,
        intAwayScore:    (isFinished || isLive) ? (e.intAwayScore ?? null) : null,
        strVenue:        e.strVenue,
      });
    }
  }

  return matches;
}

// ============================================================
// DEDUPLICAÇÃO INTELIGENTE
// Prioridade: ESPN (ao vivo) > ESPN (dados) > OpenLigaDB > TheSportsDB
// Lógica: se dois registros representam o mesmo jogo, mantém o que tem strStatus ao vivo
// ============================================================
function deduplicateMatches(lists: Match[][]): Match[] {
  // Chave de normalização: times + data (para cruzar diferentes IDs de fontes)
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  const byId   = new Map<string, Match>();
  const byTeams = new Map<string, Match>();

  const priority = (m: Match) => {
    if (m.strStatus === 'In Progress') return 10;
    if (m.strStatus === 'Match Finished') return 5;
    if (m.idEvent.startsWith('tsdb_')) return 1;
    if (m.idEvent.startsWith('oldb_')) return 2;
    return 3; // ESPN
  };

  for (const list of lists) {
    for (const m of list) {
      // Deduplicação por ID exato
      const existing = byId.get(m.idEvent);
      if (existing) {
        if (priority(m) > priority(existing)) byId.set(m.idEvent, m);
        continue;
      }

      // Deduplicação cross-fonte por times + data
      const teamKey = `${normalize(m.strHomeTeam)}_${normalize(m.strAwayTeam)}_${m.dateEvent}`;
      const existingByTeams = byTeams.get(teamKey);
      if (existingByTeams) {
        if (priority(m) > priority(existingByTeams)) {
          // Remove o registro antigo pelo seu ID e substitui
          byId.delete(existingByTeams.idEvent);
          byTeams.set(teamKey, m);
          byId.set(m.idEvent, m);
        }
        continue;
      }

      byId.set(m.idEvent, m);
      byTeams.set(teamKey, m);
    }
  }

  return Array.from(byId.values());
}

// ============================================================
// FETCH PRINCIPAL — orquestra todas as fontes em paralelo
// ============================================================
async function fetchMatchesByDate(date: string, signal?: AbortSignal, forceRefresh = false): Promise<Match[]> {
  const espnDate = toESPNDate(date);

  // ── Fonte 1: ESPN /all/scoreboard com limit=500 + paginação ──────────────
  const espnAllMatches: Match[] = [];

  const addEspnEvents = (events: Record<string, unknown>[]) => {
    for (const event of events) {
      const match = espnEventToMatch(event);
      if (match) espnAllMatches.push(match);
    }
  };

  const page1Promise = fetchESPN<{ events: Record<string, unknown>[]; pageCount?: number }>(
    `${ESPN_BASE}/all/scoreboard?dates=${espnDate}&limit=500`,
    signal,
    forceRefresh
  );

  // ── Fonte 2: ESPN por slug de liga (todos em paralelo) ───────────────────
  const slugPromises = ESPN_LEAGUE_SLUGS.map(slug =>
    fetchESPN<{ events: Record<string, unknown>[] }>(
      `${ESPN_BASE}/${slug}/scoreboard?dates=${espnDate}&limit=100`,
      signal,
      forceRefresh
    )
  );

  // ── Fonte 3: OpenLigaDB (alemãs) ─────────────────────────────────────────
  const openLigaPromise = fetchOpenLigaDBMatches(date, signal);

  // ── Fonte 4: TheSportsDB (ligas extras) ──────────────────────────────────
  const tsdbPromise = fetchTheSportsDBMatches(date, signal);

  // Aguarda página 1 da ESPN primeiro (mais importante para ao vivo)
  const page1 = await page1Promise;
  if (page1?.events) {
    addEspnEvents(page1.events);

    // Paginação: busca páginas extras se necessário
    const totalPages = page1.pageCount ?? 1;
    if (totalPages > 1) {
      const extraCount = Math.min(totalPages, 5); // até 5 páginas (2500 jogos)
      const extraPagePromises = [];
      for (let p = 2; p <= extraCount; p++) {
        extraPagePromises.push(
          fetchESPN<{ events: Record<string, unknown>[] }>(
            `${ESPN_BASE}/all/scoreboard?dates=${espnDate}&limit=500&page=${p}`,
            signal,
            forceRefresh
          )
        );
      }
      const extraPages = await Promise.allSettled(extraPagePromises);
      for (const r of extraPages) {
        if (r.status === 'fulfilled' && r.value?.events) addEspnEvents(r.value.events);
      }
    }
  }

  // Aguarda todos os slugs ESPN em paralelo
  const slugResults = await Promise.allSettled(slugPromises);
  for (const r of slugResults) {
    if (r.status === 'fulfilled' && r.value?.events) addEspnEvents(r.value.events);
  }

  // Aguarda as fontes complementares
  const [openLigaResult, tsdbResult] = await Promise.allSettled([openLigaPromise, tsdbPromise]);
  const openLigaMatches = openLigaResult.status === 'fulfilled' ? openLigaResult.value : [];
  const tsdbMatches     = tsdbResult.status === 'fulfilled'     ? tsdbResult.value     : [];

  // Deduplicação inteligente: ESPN primeiro (maior prioridade), depois complementares
  return deduplicateMatches([espnAllMatches, openLigaMatches, tsdbMatches]);
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
