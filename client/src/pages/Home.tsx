// Rapha Guru — Home Page v4.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Colors: Navy background, amber gold accents, blue electric for actions
// Typography: Playfair Display for titles, system sans for data

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { addLocalDays, cn, getLocalTodayISO } from '@/lib/utils';
import { useMatches } from '@/hooks/useMatches';
import { useMatchAnalysis } from '@/hooks/useMatchAnalysis';
import { MatchCard } from '@/components/MatchCard';
import { MatchAnalysisPanel } from '@/components/MatchAnalysisPanel';
import { TipsHistory } from '@/components/TipsHistory';
import { MatchNotifications } from '@/components/MatchNotifications';
import { NotificationSettings } from '@/components/NotificationSettings';
import { ProbabilityHubPanel } from '@/components/ProbabilityHubPanel';
import { ResultsPanel } from '@/components/ResultsPanel';
import { ExecutiveRoundDashboard } from '@/components/ExecutiveRoundDashboard';
import { RaphaPicksPanel } from '@/components/RaphaPicksPanel';
import type { Match } from '@/lib/types';
import { FEATURED_LEAGUES, getToday, getTomorrow, getYesterday } from '@/lib/footballApi';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  Loader2,
  Trophy,
  TrendingUp,
  Zap,
  X,
  Filter,
  Globe,
  DollarSign,
  BookOpen,
  Sparkles,
  BarChart2,
  CreditCard,
  Flag,
  Bell,
  History,
  Info,
  ArrowLeftRight,
  CheckCircle2,
  Heart,
  Send,
  Target,
  User,
  Crown,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiKeyConfig } from '@/components/ApiKeyConfig';
import { MatchComparison } from '@/components/MatchComparison';
import { FavoritesPanel } from '@/components/FavoritesPanel';
import { UserMenu } from '@/components/saas/UserMenu';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useGoalNotifications } from '@/hooks/useGoalNotifications';
import { useRoundScanner } from '@/hooks/useRoundScanner';
import type { MatchAnalysis } from '@/lib/types';

const HERO_IMAGE = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663235143741/dPbzkLeMzv8mH6ta3GX8qU/hero-stadium-9ne82CwQMwWwncd5NsJLjQ.webp';
const ANALYTICS_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663235143741/dPbzkLeMzv8mH6ta3GX8qU/analytics-bg-HmJfn2CtJCpFLVff42CaoB.webp';

function formatDateDisplay(dateStr: string): string {
  const today = getToday();
  const tomorrow = getTomorrow();
  const yesterday = getYesterday();

  if (dateStr === today) return 'Hoje';
  if (dateStr === tomorrow) return 'Amanhã';
  if (dateStr === yesterday) return 'Ontem';

  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function addDays(dateStr: string, days: number): string {
  return addLocalDays(dateStr, days);
}


function isLiveMatch(match: Match) {
  return match.strStatus === 'In Progress';
}

function isFinishedMatch(match: Match) {
  return match.strStatus === 'Match Finished';
}

function getKickoffDate(match: Match): Date | null {
  if (!match.dateEvent) return null;
  const time = (match.strTime || '12:00:00').slice(0, 8) || '12:00:00';
  const kickoff = new Date(`${match.dateEvent}T${time}`);
  return Number.isNaN(kickoff.getTime()) ? null : kickoff;
}

function isUpcomingMatch(match: Match) {
  return !isLiveMatch(match) && !isFinishedMatch(match);
}

function isStartingSoon(match: Match, hours = 4) {
  if (!isUpcomingMatch(match)) return false;
  const kickoff = getKickoffDate(match);
  if (!kickoff) return false;
  const diff = kickoff.getTime() - Date.now();
  return diff > 0 && diff <= hours * 60 * 60 * 1000;
}

function sortMatchesChronologically(list: Match[]) {
  return [...list].sort((a, b) => {
    const aKickoff = getKickoffDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bKickoff = getKickoffDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aKickoff - bKickoff;
  });
}


type FiltrarMode = 'all' | 'probability' | 'pitacos' | 'value' | 'high-confidence' | 'national';
type SidePanel = 'none' | 'history' | 'notifications' | 'comparison' | 'favorites' | 'results';
type BrowseTab = 'all' | 'favorites' | 'competitions';
type ViewFilter = 'all' | 'live' | 'upcoming' | 'finished';
type NationalSubFilter = 'all' | 'worldcup' | 'continental' | 'qualifiers' | 'friendlies';

// IDs de ligas de seleções nacionais
const NATIONAL_TEAM_LEAGUES = new Set([
  '4', '7', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '20', '26', '27', '28', '29', '30', '31',
]);

// Sub-filtros de seleções nacionais por categoria
const NATIONAL_SUB_FILTERS: Record<NationalSubFilter, { label: string; icon: string; leagueIds: string[]; description: string }> = {
  all: { label: 'Todas', icon: '🌍', leagueIds: [], description: 'Todos os jogos de seleções' },
  worldcup: {
    label: 'Copa do Mundo',
    icon: '🏆',
    leagueIds: ['4', '18', '19'],
    description: 'Copa do Mundo FIFA, Club World Cup, Confederations Cup',
  },
  continental: {
    label: 'Continentais',
    icon: '🌟',
    leagueIds: ['7', '9', '12', '13', '14', '15', '17', '20', '26'],
    description: 'Copa América, UEFA Nations League, Euro, AFCON, AFC Asian Cup, CONCACAF',
  },
  qualifiers: {
    label: 'Eliminatórias',
    icon: '🔥',
    leagueIds: ['10', '11', '28', '29', '30', '31'],
    description: 'Eliminatórias CONMEBOL, UEFA, CONCACAF, CAF, AFC, OFC',
  },
  friendlies: {
    label: 'Amistósos',
    icon: '🤝',
    leagueIds: ['16', '27'],
    description: 'Amistósos FIFA e Copa Intercontinental',
  },
};



const BROWSE_TABS: { id: BrowseTab; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'favorites', label: 'Favoritos' },
  { id: 'competitions', label: 'Competições' },
];

const VIEW_FILTER_OPTIONS: { id: ViewFilter; label: string; icon: React.ElementType; accent: string; description: string }[] = [
  { id: 'all', label: 'Todos', icon: Globe, accent: 'border-slate-600/60 bg-slate-900/70 text-slate-100', description: 'Mostra toda a lista da rodada.' },
  { id: 'live', label: 'Ao vivo', icon: Zap, accent: 'border-red-500/50 bg-red-500/12 text-red-100', description: 'Exibe apenas partidas em andamento.' },
  { id: 'upcoming', label: 'Próximos', icon: Calendar, accent: 'border-amber-500/50 bg-amber-500/12 text-amber-100', description: 'Mostra os jogos que começam em breve.' },
  { id: 'finished', label: 'Encerrados', icon: CheckCircle2, accent: 'border-emerald-500/45 bg-emerald-500/12 text-emerald-100', description: 'Lista somente partidas já finalizadas.' },
];

const FILTER_MODE_OPTIONS: { mode: FiltrarMode; label: string; icon: React.ElementType; description: string; activeClass: string }[] = [
  { mode: 'all', label: 'Todos os jogos', icon: Globe, description: 'Visão geral da rodada com todos os confrontos do dia.', activeClass: 'bg-blue-600 text-white border-blue-500 shadow-[0_16px_38px_-28px_rgba(59,130,246,0.9)]' },
  { mode: 'probability', label: 'Probabilidade', icon: TrendingUp, description: 'Classificações prontas para gols, 1º tempo, cartões e escanteios.', activeClass: 'bg-blue-600 text-white border-blue-500 shadow-[0_16px_38px_-28px_rgba(59,130,246,0.9)]' },
  { mode: 'pitacos', label: 'Pitacos do Rapha', icon: Target, description: 'Sugestões prontas de placar, vencedor, gols, escanteios e cartões.', activeClass: 'bg-cyan-600 text-white border-cyan-500 shadow-[0_16px_38px_-28px_rgba(8,145,178,0.9)]' },
  { mode: 'value', label: 'Valor', icon: DollarSign, description: 'Onde o preço do mercado parece acima do preço justo do modelo.', activeClass: 'bg-emerald-600 text-white border-emerald-500 shadow-[0_16px_38px_-28px_rgba(16,185,129,0.85)]' },
  { mode: 'high-confidence', label: 'Alta confiança', icon: Sparkles, description: 'Leituras com dados mais consistentes e índice mais forte.', activeClass: 'bg-amber-600 text-white border-amber-500 shadow-[0_16px_38px_-28px_rgba(245,158,11,0.8)]' },
  { mode: 'national', label: 'Seleções', icon: Flag, description: 'Acompanhe seleções nacionais e competições internacionais.', activeClass: 'bg-purple-600 text-white border-purple-500 shadow-[0_16px_38px_-28px_rgba(168,85,247,0.8)]' },
];

function StatHighlightCard({ value, label, tone }: { value: React.ReactNode; label: string; tone: string }) {
  return (
    <div className="metric-surface px-4 py-3 text-left">
      <div className={cn('text-2xl font-black tracking-tight', tone)}>{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function HeaderActionButton({
  icon: Icon,
  label,
  description,
  active,
  count,
  accent,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  active?: boolean;
  count?: number | null;
  accent: 'yellow' | 'blue' | 'purple' | 'emerald' | 'amber';
  onClick: () => void;
}) {
  const activeMap = {
    yellow: 'border-yellow-500/60 bg-yellow-500/15 text-yellow-100 shadow-[0_18px_40px_-28px_rgba(234,179,8,0.65)]',
    blue: 'border-blue-500/60 bg-blue-500/15 text-blue-50 shadow-[0_18px_40px_-28px_rgba(59,130,246,0.7)]',
    purple: 'border-purple-500/60 bg-purple-500/15 text-purple-50 shadow-[0_18px_40px_-28px_rgba(168,85,247,0.7)]',
    emerald: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-50 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.7)]',
    amber: 'border-amber-500/60 bg-amber-500/15 text-amber-50 shadow-[0_18px_40px_-28px_rgba(245,158,11,0.7)]',
  } as const;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[64px] min-w-[150px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
        active ? activeMap[accent] : 'glass-button'
      )}
    >
      <div className={cn(
        'rounded-2xl border p-2.5 transition-all',
        active ? 'border-white/10 bg-white/10' : 'border-slate-700/60 bg-slate-900/70 group-hover:border-slate-600/70'
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-tight text-slate-100">{label}</div>
        <div className="mt-1 text-[11px] leading-snug text-slate-400">{description}</div>
      </div>
      {typeof count === 'number' && count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-500 px-1 text-[10px] font-black text-slate-950">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAdmin } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filterMode, setFiltrarMode] = useState<FilterMode>('all');
  const [browseTab, setBrowseTab] = useState<BrowseTab>('all');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [sidePanel, setSidePanel] = useState<SidePanel>('none');
  const [comparisonMatchA, setComparisonMatchA] = useState<Match | null>(null);
  const [comparisonMatchB, setComparisonMatchB] = useState<Match | null>(null);
  const [comparisonAnalysisA, setComparisonAnalysisA] = useState<MatchAnalysis | null>(null);
  const [comparisonAnalysisB, setComparisonAnalysisB] = useState<MatchAnalysis | null>(null);
  const [comparingStep, setComparingStep] = useState<'idle' | 'selectA' | 'selectB'>('idle');
  const [nationalSubFilter, setNationalSubFilter] = useState<NationalSubFilter>('all');
  const [listTopOnly, setListTopOnly] = useState(false);

  // Reseta o sub-filtro de seleções quando muda de modo
  const handleFiltrarModeChange = (mode: FiltrarMode) => {
    setFiltrarMode(mode);
    if (mode !== 'national') setNationalSubFilter('all');
    if (mode === 'all' || mode === 'national') setListTopOnly(false);
  };

  const { matches, loading: matchesLoading, error: matchesError, refetch, progress, loadedLeagues, totalLeagues } = useMatches(selectedDate);

  // Separa jogos ao vivo
  const liveMatches = useMemo(() => matches.filter(m => m.strStatus === 'In Progress'), [matches]);
  const finishedMatches = useMemo(() => matches.filter(m => m.strStatus === 'Match Finished'), [matches]);
  const upcomingMatches = useMemo(() => matches.filter(m => m.strStatus !== 'In Progress' && m.strStatus !== 'Match Finished'), [matches]);
  const [liveLastUpdate, setLiveLastUpdate] = useState<Date | null>(null);

  // Atualiza o timestamp quando há jogos ao vivo
  useEffect(() => {
    if (liveMatches.length > 0) {
      setLiveLastUpdate(new Date());
    }
  }, [liveMatches]);
  const { analysis, loading: analysisLoading, error: analysisError, analyzeMatch, clearAnalysis, enrichmentSource } = useMatchAnalysis();

  // Notificações de gol ao vivo
  useGoalNotifications(matches);

  // Favoritos
  const { favoritesCount, favorites } = useFavorites();

  useEffect(() => {
    if (browseTab === 'competitions') {
      setShowFilters(true);
    }
  }, [browseTab]);

  // Ligas disponíveis no dia (dinâmico)
  const availableLeagues = useMemo(() => {
    const leagueMap: Record<string, string> = {};
    matches.forEach(m => {
      if (m.idLeague && m.strLeague) leagueMap[m.idLeague] = m.strLeague;
    });
    return Object.entries(leagueMap).map(([id, name]) => ({ id, name }));
  }, [matches]);

  const favoriteIds = useMemo(() => new Set(favorites.map((fav) => fav.matchId)), [favorites]);

  // Filtra partidas
  const filteredMatches = useMemo(() => {
    let filtered = matches;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.strHomeTeam.toLowerCase().includes(q) ||
        m.strAwayTeam.toLowerCase().includes(q) ||
        m.strLeague.toLowerCase().includes(q)
      );
    }

    if (selectedLeague !== 'all') {
      filtered = filtered.filter(m => m.idLeague === selectedLeague);
    }

    if (filterMode === 'national') {
      filtered = filtered.filter(m => NATIONAL_TEAM_LEAGUES.has(m.idLeague || ''));
      if (nationalSubFilter !== 'all') {
        const subFiltrar = NATIONAL_SUB_FILTERS[nationalSubFilter];
        filtered = filtered.filter(m => subFiltrar.leagueIds.includes(m.idLeague || ''));
      }
    }

    return filtered;
  }, [matches, searchQuery, selectedLeague, filterMode, nationalSubFilter]);

  const baseMatches = useMemo(() => {
    let scoped = filteredMatches;

    if (browseTab === 'favorites') {
      scoped = scoped.filter((match) => favoriteIds.has(match.idEvent));
    }

    return sortMatchesChronologically(scoped);
  }, [filteredMatches, browseTab, favoriteIds]);

  const upcomingMatchesForView = useMemo(() => {
    if (selectedDate === getLocalTodayISO()) {
      return baseMatches.filter((match) => isStartingSoon(match, 6));
    }
    return baseMatches.filter((match) => isUpcomingMatch(match));
  }, [baseMatches, selectedDate]);

  const viewCounts = useMemo(() => ({
    all: baseMatches.length,
    live: baseMatches.filter((match) => isLiveMatch(match)).length,
    upcoming: upcomingMatchesForView.length,
    finished: baseMatches.filter((match) => isFinishedMatch(match)).length,
  }), [baseMatches, upcomingMatchesForView]);

  // Agrupa por liga
  const { entries: roundEntries, loading: roundLoading, completed: roundCompleted, total: roundTotal } = useRoundScanner(baseMatches);

  const topMatchIds = useMemo(() => {
    const addTop = (list: typeof roundEntries, scoreFn: (entry: typeof roundEntries[number]) => number, limit = 8) =>
      [...list].sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, limit).map((entry) => entry.match.idEvent);

    if (filterMode === 'value') {
      return new Set(addTop(roundEntries.filter((entry) => entry.topValueEdge > 0), (entry) => entry.topValueEdge * 4 + entry.summary.decisionScore));
    }

    if (filterMode === 'high-confidence') {
      return new Set(addTop(roundEntries, (entry) => entry.summary.decisionScore * 1.2 + (entry.confidence === 'high' ? 12 : entry.confidence === 'medium' ? 5 : 0)));
    }

    if (filterMode === 'probability') {
      return new Set([
        ...addTop(roundEntries, (entry) => entry.predictions.over25Prob + entry.goalsHeatScore * 0.6),
        ...addTop(roundEntries, (entry) => entry.predictions.over85CornersProb + entry.cornersHeatScore * 0.6),
        ...addTop(roundEntries, (entry) => entry.predictions.over35CardsProb + entry.cardsHeatScore * 0.6),
        ...addTop(roundEntries, (entry) => entry.predictions.firstHalfOver05Prob + entry.summary.decisionScore * 0.25),
      ]);
    }

    return new Set<string>();
  }, [roundEntries, filterMode]);

  const topScopedMatches = useMemo(() => {
    if (!listTopOnly || topMatchIds.size === 0) return baseMatches;
    return baseMatches.filter((match) => topMatchIds.has(match.idEvent));
  }, [baseMatches, listTopOnly, topMatchIds]);

  const displayedMatches = useMemo(() => {
    if (viewFilter === 'live') return topScopedMatches.filter((match) => isLiveMatch(match));
    if (viewFilter === 'upcoming') return selectedDate === getLocalTodayISO()
      ? topScopedMatches.filter((match) => isStartingSoon(match, 6))
      : topScopedMatches.filter((match) => isUpcomingMatch(match));
    if (viewFilter === 'finished') return topScopedMatches.filter((match) => isFinishedMatch(match));
    return topScopedMatches;
  }, [topScopedMatches, viewFilter, selectedDate]);

  const matchesByLeague = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    displayedMatches.forEach(match => {
      const league = match.strLeague || 'Outros';
      if (!groups[league]) groups[league] = [];
      groups[league].push(match);
    });

    return Object.fromEntries(
      Object.entries(groups).map(([league, leagueMatches]) => [league, sortMatchesChronologically(leagueMatches)])
    );
  }, [displayedMatches]);

  const handleMatchSelect = async (match: Match) => {
    // Se estiver no modo comparação, redireciona
    if (sidePanel === 'comparison' && comparingStep !== 'idle') {
      await handleComparisonMatchSelect(match);
      return;
    }
    if (selectedMatch?.idEvent === match.idEvent) {
      setSelectedMatch(null);
      clearAnalysis();
      return;
    }
    setSelectedMatch(match);
    setSidePanel('none');
    await analyzeMatch(match);
  };

  const handleDateChange = (direction: 'prev' | 'next') => {
    const newDate = addDays(selectedDate, direction === 'next' ? 1 : -1);
    setSelectedDate(newDate);
    setSelectedMatch(null);
    clearAnalysis();
  };

  const handleSidePanel = (panel: SidePanel) => {
    setSidePanel(prev => prev === panel ? 'none' : panel);
    if (panel !== 'none') {
      setSelectedMatch(null);
      clearAnalysis();
    }
  };

  // Modo comparação: seleciona dois jogos
  const handleCompareClick = useCallback(() => {
    setComparingStep('selectA');
    setComparisonMatchA(null);
    setComparisonMatchB(null);
    setComparisonAnalysisA(null);
    setComparisonAnalysisB(null);
    setSidePanel('comparison');
    setSelectedMatch(null);
    clearAnalysis();
  }, [clearAnalysis]);

  const handleComparisonMatchSelect = useCallback(async (match: Match) => {
    if (comparingStep === 'selectA') {
      setComparisonMatchA(match);
      setComparingStep('selectB');
      const result = await analyzeMatch(match);
      setComparisonAnalysisA(result ?? null);
    } else if (comparingStep === 'selectB') {
      setComparisonMatchB(match);
      setComparingStep('idle');
      const result = await analyzeMatch(match);
      setComparisonAnalysisB(result ?? null);
    }
  }, [comparingStep, analyzeMatch]);

  const matchLabel = selectedMatch
    ? `${selectedMatch.strHomeTeam} vs ${selectedMatch.strAwayTeam}`
    : '';

  // Detecta pausa internacional (poucos jogos nas ligas principais)
  const isInternationalBreak = !matchesLoading && matches.length > 0 && matches.length < 8;
  const isToday = selectedDate === getLocalTodayISO();

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-200">
      {/* Hero Header */}
      {/* ── Navbar compacta ─────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0d14]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4">
          {/* Linha principal: logo + nav + user */}
          <div className="flex items-center gap-3 h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
                <Trophy className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-[15px] font-black text-white tracking-tight hidden sm:block">Rapha Guru</span>
            </div>

            {liveMatches.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-300">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                {liveMatches.length} ao vivo
              </span>
            )}

            <span className="hidden md:flex items-center gap-1.5 text-[12px] text-slate-500 font-medium">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateDisplay(selectedDate)}
            </span>

            <div className="flex-1" />

            {/* Ações rápidas */}
            <div className="flex items-center gap-1">
              <button onClick={() => handleSidePanel('favorites')} title="Favoritos"
                className={cn('relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all',
                  sidePanel === 'favorites' ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200')}>
                <Heart className="h-4 w-4" />
                {favoritesCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[9px] font-black text-slate-950">
                    {favoritesCount > 9 ? '9+' : favoritesCount}
                  </span>
                )}
              </button>
              <button onClick={() => handleSidePanel('notifications')} title="Alertas"
                className={cn('flex h-9 w-9 items-center justify-center rounded-lg border transition-all',
                  sidePanel === 'notifications' ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200')}>
                <Bell className="h-4 w-4" />
              </button>
              <button onClick={handleCompareClick} title="Comparar"
                className={cn('flex h-9 w-9 items-center justify-center rounded-lg border transition-all',
                  sidePanel === 'comparison' ? 'border-purple-500/40 bg-purple-500/10 text-purple-300' : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200')}>
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <button onClick={() => handleSidePanel('history')} title="Histórico"
                className={cn('flex h-9 w-9 items-center justify-center rounded-lg border transition-all',
                  sidePanel === 'history' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200')}>
                <History className="h-4 w-4" />
              </button>
              <button onClick={() => handleSidePanel('results')} title="Resultados do dia"
                className={cn('relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all',
                  sidePanel === 'results' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200')}>
                <Target className="h-4 w-4" />
              </button>
              <button onClick={() => setLocation('/executor')} title="Execução manual"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-all">
                <Send className="h-4 w-4" />
              </button>
              <button onClick={() => setLocation('/automacao')} title="Automação"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-all">
                <Sparkles className="h-4 w-4" />
              </button>
              {!user && (
                <button onClick={() => setLocation('/planos')} title="Planos e preços"
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-all text-[12px] font-bold">
                  <Crown className="h-3.5 w-3.5" />
                  Planos
                </button>
              )}
              {user && (
                <button onClick={() => setLocation('/planos')} title="Planos e preços"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-all">
                  <Crown className="h-4 w-4" />
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setLocation('/admin')} title="Admin"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-all">
                  <BarChart2 className="h-4 w-4" />
                </button>
              )}
              <div className="h-6 w-px bg-white/[0.08] mx-1" />
              <UserMenu />
            </div>
          </div>

          {/* Sub-linha: filtros de visualização */}
          <div className="flex items-center gap-1 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {VIEW_FILTER_OPTIONS.map(({ id, label, icon: Icon }) => {
              const count = viewCounts[id];
              const active = viewFilter === id;
              const activeColor = id === 'live' ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : id === 'upcoming' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : id === 'finished' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-blue-500/40 bg-blue-500/10 text-blue-300';
              return (
                <button key={id} onClick={() => setViewFilter(active ? 'all' : id as ViewFilter)}
                  className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all border',
                    active ? activeColor : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700/60')}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-black',
                    active ? 'bg-white/15' : 'bg-slate-800 text-slate-400')}>
                    {count}
                  </span>
                </button>
              );
            })}
            <div className="h-4 w-px bg-white/[0.08] mx-1 flex-shrink-0" />
            {BROWSE_TABS.map((tab) => (
              <button key={tab.id} onClick={() => setBrowseTab(tab.id)}
                className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all border',
                  browseTab === tab.id ? 'border-slate-600/60 bg-slate-800 text-white' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700/60')}>
                {tab.label}
                {tab.id === 'favorites' && favoritesCount > 0 && (
                  <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-black text-yellow-300">{favoritesCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pt-4 pb-6">
        {/* Probability Hub — full width above the match list */}
        {filterMode === 'probability' && (
          <div className="mb-4">
            <ProbabilityHubPanel
              entries={roundEntries}
              loading={roundLoading}
              completed={roundCompleted}
              total={roundTotal}
              onSelectMatch={handleMatchSelect}
            />
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel — Match List */}
          <div className="w-full lg:w-[380px] flex-shrink-0 space-y-3">
            {/* Painel de controle compacto */}
            <div className="space-y-2">

              {/* Navegação de data */}
              <div className="flex items-center gap-2 bg-slate-900/60 border border-white/[0.06] rounded-xl px-3 py-2">
                <button onClick={() => handleDateChange('prev')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 relative text-center">
                  <span className="text-[13px] font-bold text-slate-100">{formatDateDisplay(selectedDate)}</span>
                  <span className="ml-2 text-[11px] text-slate-500">{selectedDate}</span>
                  <input id="date-picker-input" type="date" value={selectedDate}
                    onChange={(e) => { if (e.target.value) { setSelectedDate(e.target.value); setSelectedMatch(null); clearAnalysis(); } }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full" />
                </div>
                <button onClick={() => handleDateChange('next')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/[0.08] mx-1" />
                <button onClick={refetch} disabled={matchesLoading}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all">
                  <RefreshCw className={cn('w-3.5 h-3.5', matchesLoading && 'animate-spin')} />
                </button>
              </div>

              {/* Pills de datas */}
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {[-2, -1, 0, 1, 2, 3, 5, 7, 10, 14].map(d => {
                  const targetDate = d === 0 ? getToday() : addDays(getToday(), d);
                  const isSelected = selectedDate === targetDate;
                  const label = d === -2 ? '-2d' : d === -1 ? 'Ontem' : d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : `+${d}d`;
                  return (
                    <button key={d}
                      onClick={() => { setSelectedDate(targetDate); setSelectedMatch(null); clearAnalysis(); }}
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border flex-shrink-0',
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-blue-500/50 hover:text-slate-200')}>
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Favoritos toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBrowseTab(browseTab === 'favorites' ? 'all' : 'favorites')}
                  className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-all',
                    browseTab === 'favorites' ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' : 'border-slate-700/50 bg-slate-900/40 text-slate-400 hover:text-slate-200')}>
                  <Heart className="h-3.5 w-3.5" />
                  {browseTab === 'favorites' ? 'Ver todos' : 'Só favoritos'}
                  {favoritesCount > 0 && <span className="rounded-full bg-yellow-500/20 px-1.5 text-[10px] font-black text-yellow-300">{favoritesCount}</span>}
                </button>
              </div>

              {/* Modos de leitura — pills compactos */}
              <div className="bg-slate-900/40 border border-white/[0.05] rounded-xl p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2 px-1">Modo de leitura</div>
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_MODE_OPTIONS.map(({ mode, label, icon: Icon }) => (
                    <button key={mode} onClick={() => handleFiltrarModeChange(mode)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-all',
                        filterMode === mode
                          ? mode === 'value' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : mode === 'pitacos' ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                            : mode === 'high-confidence' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            : mode === 'national' ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                            : 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                          : 'border-slate-700/50 bg-slate-950/30 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                      )}>
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>


            {/* Info banners */}
            {filterMode === 'probability' && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-blue-300">Central de probabilidades</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Veja os rankings da rodada para gols, 1º tempo, ambos marcam, menos gols, escanteios, cartões e valor de mercado. O sistema também traz dashboard executivo com cortes por liga, por horário e alertas fortes ao vivo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {filterMode === 'pitacos' && (
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-cyan-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-cyan-300">Pitacos do Rapha</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      O sistema monta pitacos prontos com base em histórico, Poisson, força ofensiva/defensiva e índice da rodada. Depois do jogo, consolida os acertos e a taxa de desempenho por mercado.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {filterMode === 'value' && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">Modo valor</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Clique em qualquer jogo para analisar. O sistema compara o preço justo do modelo com as odds reais quando disponíveis e ranqueia as melhores oportunidades de valor da rodada.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {filterMode === 'high-confidence' && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-300">Alta confiança</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Jogos com dados históricos suficientes e melhor índice de decisão. Use “Só tops” para enxugar a lista e focar nos cenários mais fortes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {filterMode === 'national' && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-purple-400">Seleções Nacionais</p>
                  <span className="ml-auto text-xs text-slate-600">
                    {displayedMatches.length} jogo{displayedMatches.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Sub-filtros de competição */}
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(NATIONAL_SUB_FILTERS) as [NationalSubFilter, typeof NATIONAL_SUB_FILTERS[NationalSubFilter]][]).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setNationalSubFilter(key)}
                      className={cn(
                        'flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all font-medium',
                        nationalSubFilter === key
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                          : 'bg-slate-800/60 border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600/60'
                      )}
                    >
                      <span>{config.icon}</span>
                      <span>{config.label}</span>
                    </button>
                  ))}
                </div>

                {/* Descrição do sub-filtro ativo */}
                <p className="text-xs text-slate-500">
                  {NATIONAL_SUB_FILTERS[nationalSubFilter].description}
                  {filteredMatches.length === 0 && ' — Nenhum jogo encontrado nesta data.'}
                </p>
              </div>
            )}

            {(filterMode === 'probability' || filterMode === 'value' || filterMode === 'high-confidence') && (
              <div className="panel-pro-soft flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-slate-300">Filtro inteligente da lista</p>
                  <p className="text-[11px] text-slate-600">Destaca somente os confrontos com leitura mais forte dentro do modo escolhido.</p>
                </div>
                <button
                  onClick={() => setListTopOnly((prev) => !prev)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all shadow-sm',
                    listTopOnly
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-slate-800/60 border-slate-700/50 text-slate-500 hover:text-slate-300'
                  )}
                >
                  <TrendingUp className="w-3 h-3" />
                  Só tops
                </button>
              </div>
            )}

            {/* Buscar & Filtrar */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Buscar time ou liga..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 bg-slate-900/70 border-slate-700/50 text-slate-100 placeholder:text-slate-500 text-[13px] rounded-xl focus:border-blue-500/60"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  'h-9 w-9 rounded-xl border-slate-700/50',  
                  showFilters
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
                )}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* League filter — dinâmico baseado nas ligas disponíveis no dia */}
            {showFilters && (
              <div className="panel-pro-soft p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500 font-medium">Filtrar por liga ({availableLeagues.length} disponíveis)</p>
                  {browseTab !== 'competitions' ? (
                    <button
                      type="button"
                      onClick={() => setBrowseTab('competitions')}
                      className="text-[11px] font-bold text-blue-400 hover:text-blue-300"
                    >
                      Ir para competições
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  <button
                    onClick={() => setSelectedLeague('all')}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition-all',
                      selectedLeague === 'all'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-700/50 border-slate-600/50 text-slate-400 hover:border-blue-500/50'
                    )}
                  >
                    Todas ({displayedMatches.length})
                  </button>
                  {availableLeagues.map(league => {
                    const count = displayedMatches.filter(m => m.idLeague === league.id).length;
                    return (
                      <button
                        key={league.id}
                        onClick={() => setSelectedLeague(league.id)}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full border transition-all',
                          selectedLeague === league.id
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-slate-700/50 border-slate-600/50 text-slate-400 hover:border-blue-500/50'
                        )}
                      >
                        {league.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* API Key Config */}
            <ApiKeyConfig />

            {/* Loading progress */}
            {matchesLoading && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-300">Buscando jogos nas ligas...</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {loadedLeagues}/{totalLeagues} ligas verificadas
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-400">{progress}%</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* International break warning */}
            {isInternationalBreak && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-blue-400">Pausa Internacional</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Poucos jogos disponíveis nesta data. Provavelmente é período de jogos das seleções nacionais. Tente navegar para outros dias.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {viewFilter !== 'live' && isToday && liveMatches.length > 0 && (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/5 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">Ao vivo agora</p>
                    <p className="mt-1 text-sm text-slate-300">Há {liveMatches.length} jogo(s) em andamento. Clique em <span className="font-bold text-red-300">Ao vivo</span> para mostrar somente eles.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewFilter('live')}
                    className="rounded-xl border border-red-500/35 bg-red-500/12 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/18 transition-all"
                  >
                    Ver ao vivo
                  </button>
                </div>
              </div>
            )}

            {/* Match List */}
            <div className="space-y-1.5">
              {matchesError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                  <p className="text-sm text-red-400">{matchesError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={refetch}
                  >
                    Tentar novamente
                  </Button>
                </div>
              )}

              {!matchesLoading && !matchesError && displayedMatches.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Globe className="w-10 h-10 text-slate-600" />
                  <p className="text-sm text-slate-500 text-center">
                    Nenhuma partida encontrada em {formatDateDisplay(selectedDate)}
                  </p>
                  <p className="text-xs text-slate-600 text-center">
                    Ajuste a data, a liga ou troque a visão da lista para continuar
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {[-1, 1, 2, 3, 5, 7, 10, 14].map(d => (
                      <button
                        key={d}
                        onClick={() => {
                          setSelectedDate(addDays(selectedDate, d));
                          setSelectedMatch(null);
                          clearAnalysis();
                        }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-blue-500/50 transition-all"
                      >
                        {d > 0 ? `+${d}d` : `${d}d`}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 text-center">
                    <p className="text-xs text-slate-600">Ou clique na data acima para escolher diretamente</p>
                  </div>
                </div>
              )}

              {!matchesLoading && Object.entries(matchesByLeague).map(([league, leagueMatches]) => {
                const liveCount = leagueMatches.filter((match) => isLiveMatch(match)).length;
                const upcomingCount = leagueMatches.filter((match) => isUpcomingMatch(match)).length;
                const finishedCount = leagueMatches.filter((match) => isFinishedMatch(match)).length;

                return (
                  <div key={league} className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/50 mb-1.5">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/60 border-b border-slate-800/50">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 flex-shrink-0" />
                        {(() => {
                          const lid = leagueMatches[0]?.idLeague || leagueMatches[0]?.espnLeagueId;
                          if (!lid) return null;
                          return (
                            <img
                              src={`https://a.espncdn.com/i/leaguelogos/soccer/500/${lid}.png`}
                              alt={league}
                              width={18}
                              height={18}
                              style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }}
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          );
                        })()}
                        <span className="truncate text-[11px] font-bold text-slate-300 uppercase tracking-wide">{league}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {liveCount > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                            <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />{liveCount}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 font-medium">{leagueMatches.length}</span>
                      </div>
                    </div>
                    <div>
                      {leagueMatches.map(match => (
                        <MatchCardWithBadge
                          key={match.idEvent}
                          match={match}
                          isSelected={selectedMatch?.idEvent === match.idEvent}
                          onClick={() => handleMatchSelect(match)}
                          filterMode={filterMode}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel — Analysis / History / Notifications */}
          <div className="flex-1 min-w-0 lg:sticky lg:top-[108px] lg:self-start lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar">
            {/* Results Panel */}
            {sidePanel === 'results' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" />
                    Resultados do dia
                  </h2>
                  <button onClick={() => setSidePanel('none')}
                    className="text-slate-500 hover:text-slate-300 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <ResultsPanel />
              </div>
            )}

            {/* History Panel */}
            {sidePanel === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-400" />
                    Histórico de análises
                  </h2>
                  <button
                    onClick={() => setSidePanel('none')}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <TipsHistory />
              </div>
            )}

            {/* Favorites Panel */}
            {sidePanel === 'favorites' && (
              <FavoritesPanel
                matches={matches}
                onSelectMatch={(matchId) => {
                  const m = matches.find(x => x.idEvent === matchId);
                  if (m) {
                    handleMatchSelect(m);
                    setSidePanel('none');
                  }
                }}
                onClose={() => setSidePanel('none')}
              />
            )}

            {/* Comparison Panel */}
            {sidePanel === 'comparison' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-purple-400" />
                    Comparar Jogos
                  </h2>
                  <button
                    onClick={() => { setSidePanel('none'); setComparingStep('idle'); }}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Instrução de seleção */}
                {comparingStep !== 'idle' && (
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <ArrowLeftRight className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-purple-400">
                          {comparingStep === 'selectA' ? 'Passo 1/2: Selecione o Jogo A' : 'Passo 2/2: Selecione o Jogo B'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {comparingStep === 'selectA'
                            ? 'Clique em qualquer jogo da lista para selecionar o primeiro jogo da comparação.'
                            : `Jogo A: ${comparisonMatchA?.strHomeTeam} vs ${comparisonMatchA?.strAwayTeam}. Agora clique no segundo jogo.`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <div className={cn(
                        'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border',
                        comparisonMatchA ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-700/50 border-slate-600/50 text-slate-500'
                      )}>
                        {comparisonMatchA ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-slate-500" />}
                        Jogo A {comparisonMatchA ? `(${comparisonMatchA.strHomeTeam.split(' ')[0]})` : '(aguardando)'}
                      </div>
                      <div className={cn(
                        'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border',
                        comparisonMatchB ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-700/50 border-slate-600/50 text-slate-500'
                      )}>
                        {comparisonMatchB ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-slate-500" />}
                        Jogo B {comparisonMatchB ? `(${comparisonMatchB.strHomeTeam.split(' ')[0]})` : '(aguardando)'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Painel de comparação */}
                {comparisonMatchA && comparisonMatchB && comparingStep === 'idle' && (
                  <MatchComparison
                    matchA={comparisonMatchA}
                    matchB={comparisonMatchB}
                    analysisA={comparisonAnalysisA}
                    analysisB={comparisonAnalysisB}
                    onClose={() => { setSidePanel('none'); setComparingStep('idle'); }}
                  />
                )}

                {/* Botão para nova comparação */}
                {comparingStep === 'idle' && comparisonMatchA && comparisonMatchB && (
                  <button
                    onClick={handleCompareClick}
                    className="w-full text-xs py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all"
                  >
                    Nova Comparação
                  </button>
                )}

                {/* Estado inicial */}
                {!comparisonMatchA && comparingStep === 'idle' && (
                  <div className="text-center py-8">
                    <ArrowLeftRight className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Clique em "Nova Comparação" para selecionar dois jogos</p>
                    <button
                      onClick={handleCompareClick}
                      className="mt-3 text-xs px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all"
                    >
                      Iniciar Comparação
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Notifications Panel */}
            {sidePanel === 'notifications' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-400" />
                    Alertas de Jogos
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSidePanel('none')}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <NotificationSettings />
                <MatchNotifications matches={matches} onSelectMatch={handleMatchSelect} />
              </div>
            )}

            {/* Analysis Panel */}
            {sidePanel === 'none' && (
              <>
                {!selectedMatch && !analysisLoading && (
                  filterMode === 'probability' ? (
                    <ExecutiveRoundDashboard
                      entries={roundEntries}
                      loading={roundLoading}
                      completed={roundCompleted}
                      total={roundTotal}
                      onSelectMatch={handleMatchSelect}
                    />
                  ) : filterMode === 'pitacos' ? (
                    <RaphaPicksPanel
                      entries={roundEntries}
                      loading={roundLoading}
                      completed={roundCompleted}
                      total={roundTotal}
                      onSelectMatch={handleMatchSelect}
                    />
                  ) : (
                    <div
                      className="rounded-2xl overflow-hidden border border-slate-700/30 relative min-h-[400px] flex flex-col items-center justify-center"
                      style={{
                        backgroundImage: `url(${ANALYTICS_BG})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <div className="absolute inset-0 bg-[#0d1117]/80" />
                      <div className="relative text-center px-6 py-12">
                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                          <TrendingUp className="w-8 h-8 text-blue-400" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-200 mb-2">
                          Selecione uma Partida
                        </h2>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                          Escolha um jogo da lista para ver a análise completa com mais de 40 métricas: gols, escanteios, cartões, handicap asiático, valor de mercado, placar provável e bilhete integrado.
                        </p>
                        <div className="mt-6 grid grid-cols-4 gap-3 max-w-md mx-auto">
                          {[
                            { icon: TrendingUp, label: 'Gols & xG', color: 'text-blue-400' },
                            { icon: Flag, label: 'Escanteios', color: 'text-amber-400' },
                            { icon: CreditCard, label: 'Cartões', color: 'text-red-400' },
                            { icon: DollarSign, label: 'Valor', color: 'text-emerald-400' },
                          ].map(({ icon: Icon, label, color }) => (
                            <div key={label} className="flex flex-col items-center gap-2">
                              <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
                                <Icon className={cn('w-5 h-5', color)} />
                              </div>
                              <span className="text-xs text-slate-500">{label}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
                          {[
                            {
                              icon: BookOpen,
                              title: 'Bilhete integrado',
                              desc: 'Adicione pitacos ao bilhete e calcule o retorno potencial do acumulado',
                              color: 'text-amber-400',
                              bg: 'bg-amber-500/10 border-amber-500/20',
                            },
                            {
                              icon: DollarSign,
                              title: 'Valor de mercado',
                              desc: 'Detecta mercados com vantagem sobre a odd implícita do mercado',
                              color: 'text-emerald-400',
                              bg: 'bg-emerald-500/10 border-emerald-500/20',
                            },
                            {
                              icon: BarChart2,
                              title: 'Modelo Poisson',
                              desc: 'xG, handicap, preço justo e placares prováveis com calibração por contexto e mercado',
                              color: 'text-blue-400',
                              bg: 'bg-blue-500/10 border-blue-500/20',
                            },
                          ].map(({ icon: Icon, title, desc, color, bg }) => (
                            <div key={title} className={`rounded-xl border p-3 ${bg}`}>
                              <Icon className={cn('w-4 h-4 mb-1.5', color)} />
                              <p className="text-xs font-semibold text-slate-300">{title}</p>
                              <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
                            </div>
                          ))}
                        </div>

                        {/* Quick access buttons */}
                        <div className="mt-6 flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleSidePanel('history')}
                            className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all"
                          >
                            <History className="w-3.5 h-3.5" />
                            Ver Histórico de análises
                          </button>
                          <button
                            onClick={() => handleSidePanel('notifications')}
                            className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            Alertas de Jogos
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {analysisLoading && (
                  <div className="rounded-2xl border border-slate-700/30 bg-slate-800/40 min-h-[400px] flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-2 border-blue-500/20 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                      </div>
                      <div className="absolute inset-0 rounded-full border-2 border-blue-500/10 animate-ping" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-300">Analisando partida...</p>
                      <p className="text-xs text-slate-500 mt-1">Buscando dados históricos e calculando probabilidades</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-center">
                      {['Histórico', 'Estatísticas', 'Poisson', 'Valor', 'Sugestões'].map((step, i) => (
                        <div key={step} className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-600">{step}</span>
                          {i < 4 && <ChevronRight className="w-3 h-3 text-slate-700" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                    <p className="text-red-400 mb-3">{analysisError}</p>
                    <Button
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => selectedMatch && analyzeMatch(selectedMatch)}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}

                {analysis && !analysisLoading && (
                  <div className="space-y-3">
                    {/* Data source indicator */}
                    {enrichmentSource && (
                      <div className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs',
                        enrichmentSource === 'football-data.org'
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800/40 border-slate-700/30 text-slate-500'
                      )}>
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          enrichmentSource === 'football-data.org' ? 'bg-emerald-400' : 'bg-slate-500'
                        )} />
                        {enrichmentSource === 'football-data.org'
                          ? 'Dados enriquecidos com football-data.org (xG + posse de bola)'
                          : 'Dados: TheSportsDB API — Configure football-data.org para xG mais preciso'
                        }
                      </div>
                    )}
                    <MatchAnalysisPanel
                      analysis={analysis}
                      matchLabel={matchLabel}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* How it works section */}
      <section className="mt-12 border-t border-slate-800/50 pt-8">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg font-bold text-slate-300 mb-6 text-center">Como Funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                step: '01',
                title: 'Escolha a Data',
                desc: 'Navegue entre os dias para ver os jogos disponíveis das principais ligas europeias e sul-americanas.',
                color: 'text-blue-400',
                bg: 'bg-blue-500/10 border-blue-500/20',
              },
              {
                step: '02',
                title: 'Selecione o Jogo',
                desc: 'Clique em qualquer partida para iniciar a análise automática baseada em dados históricos.',
                color: 'text-amber-400',
                bg: 'bg-amber-500/10 border-amber-500/20',
              },
              {
                step: '03',
                title: 'Analise as Probabilidades',
                desc: 'Veja gols, escanteios, cartões, ambas marcam, handicap e placar provável com índice decisório e preço justo.',
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10 border-emerald-500/20',
              },
              {
                step: '04',
                title: 'Monte seu bilhete',
                desc: 'Adicione as melhores sugestões ao bilhete, defina o valor e veja o retorno potencial do acumulado.',
                color: 'text-purple-400',
                bg: 'bg-purple-500/10 border-purple-500/20',
              },
            ].map(({ step, title, desc, color, bg }) => (
              <div key={step} className={`rounded-xl border p-5 ${bg}`}>
                <div className={`text-3xl font-black font-mono ${color} mb-3`}>{step}</div>
                <h3 className="font-bold text-slate-200 mb-2">{title}</h3>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-400">Rapha Guru</span>
          </div>
          <p className="text-xs text-slate-600 text-center">
            Dados fornecidos por ESPN/TheSportsDB. Probabilidades calculadas com Poisson/Negativo Binomial, ajustes contextuais e calibração com mercado quando disponível.
            Aposte com responsabilidade. +18 apenas.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Globe className="w-3.5 h-3.5" />
            <span>TheSportsDB API (gratuita)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// MATCH CARD WITH VALUE BET BADGE
// ============================================================
function MatchCardWithBadge({
  match,
  isSelected,
  onClick,
  filterMode,
}: {
  match: Match;
  isSelected: boolean;
  onClick: () => void;
  filterMode: FiltrarMode;
}) {
  const showProbabilityBadge = filterMode === 'probability';
  const showPitacosBadge = filterMode === 'pitacos';
  const showValueBadge = filterMode === 'value';
  const showConfBadge = filterMode === 'high-confidence';

  const badge = showProbabilityBadge ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-500/15 border border-blue-500/25 rounded-full px-1.5 py-0.5">
      <TrendingUp className="w-2 h-2" />Destaque
    </span>
  ) : showPitacosBadge ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/25 rounded-full px-1.5 py-0.5">
      <Target className="w-2 h-2" />Pitaco
    </span>
  ) : showValueBadge ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-1.5 py-0.5">
      <DollarSign className="w-2 h-2" />Valor
    </span>
  ) : showConfBadge ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25 rounded-full px-1.5 py-0.5">
      <Sparkles className="w-2 h-2" />Top
    </span>
  ) : null;

  return (
    <MatchCard
      match={match}
      isSelected={isSelected}
      onClick={onClick}
      compact
      filterBadge={badge}
    />
  );
}
