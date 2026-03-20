import React, { useEffect, useMemo, useState } from 'react';
import type { Match, Predictions } from '@/lib/types';
import type { RoundScanEntry } from '@/hooks/useRoundScanner';
import { cn, formatDecimal, formatPercent, traduzirTextoMercado } from '@/lib/utils';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Clock3,
  CreditCard,
  Crown,
  Filter,
  Flag,
  Loader2,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

interface FinalStatsSnapshot {
  totalCorners: number | null;
  totalCards: number | null;
  loaded: boolean;
}

type PickStatus = 'pending' | 'won' | 'lost' | 'unavailable';

type PickCategory = 'vencedor' | 'placar' | 'gols' | 'escanteios' | 'cartoes';

interface RaphaPick {
  category: PickCategory;
  label: string;
  probability: number;
  description: string;
  status: PickStatus;
}

interface GeneratedRaphaMatch {
  entry: RoundScanEntry;
  picks: RaphaPick[];
  primaryPick: RaphaPick | null;
  conservativePick: RaphaPick | null;
  settledCount: number;
  wonCount: number;
  accuracy: number;
  scoreline: { home: number; away: number } | null;
  finalStats?: FinalStatsSnapshot;
}

function poissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i += 1) p *= lambda / i;
  return Math.max(0, Math.min(1, p));
}

function getMostLikelyScore(predictions: Predictions) {
  let best = { home: 1, away: 0, probability: 0 };

  for (let home = 0; home <= 5; home += 1) {
    for (let away = 0; away <= 5; away += 1) {
      const probability = poissonProb(predictions.expectedGoalsHome, home) * poissonProb(predictions.expectedGoalsAway, away) * 100;
      if (probability > best.probability) {
        best = {
          home,
          away,
          probability,
        };
      }
    }
  }

  return {
    ...best,
    probability: Number(best.probability.toFixed(1)),
  };
}

function parseMatchScore(match: Match) {
  const home = Number(match.intHomeScore ?? 0);
  const away = Number(match.intAwayScore ?? 0);

  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return null;
  }

  return { home, away };
}

function buildGoalsPick(predictions: Predictions): Omit<RaphaPick, 'status'> {
  if (predictions.over25Prob >= 64) {
    return {
      category: 'gols',
      label: 'Over 2.5 gols',
      probability: predictions.over25Prob,
      description: `Modelo projeta ${formatDecimal(predictions.expectedTotalGoals, 2)} gols totais.`,
    };
  }

  if (predictions.under25Prob >= 60 && predictions.expectedTotalGoals <= 2.35) {
    return {
      category: 'gols',
      label: 'Under 2.5 gols',
      probability: predictions.under25Prob,
      description: `Confronto mais controlado, com base de ${formatDecimal(predictions.expectedTotalGoals, 2)} gols.`,
    };
  }

  if (predictions.bttsYesProb >= 62) {
    return {
      category: 'gols',
      label: 'Ambos marcam',
      probability: predictions.bttsYesProb,
      description: 'As duas equipes têm boa chance de marcar ao menos uma vez.',
    };
  }

  if (predictions.under35Prob >= 68) {
    return {
      category: 'gols',
      label: 'Under 3.5 gols',
      probability: predictions.under35Prob,
      description: 'Mesmo com gol esperado, o teto projetado segue controlado.',
    };
  }

  return {
    category: 'gols',
    label: 'Over 1.5 gols',
    probability: predictions.over15Prob,
    description: 'Linha mais segura para cenário com pelo menos dois gols.',
  };
}

function buildCornersPick(predictions: Predictions): Omit<RaphaPick, 'status'> {
  if (predictions.expectedCorners <= 7.8 && predictions.under85CornersProb >= 58) {
    return {
      category: 'escanteios',
      label: 'Under 8.5 escanteios',
      probability: predictions.under85CornersProb,
      description: `Leitura controlada de cantos, com base em ${formatDecimal(predictions.expectedCorners, 1)} escanteios totais.`,
    };
  }

  if (predictions.expectedCorners <= 8.8 && predictions.under105CornersProb >= 63) {
    return {
      category: 'escanteios',
      label: 'Under 10.5 escanteios',
      probability: predictions.under105CornersProb,
      description: 'Volume projetado abaixo da faixa muito alta de escanteios.',
    };
  }

  if (predictions.over95CornersProb >= 66 && predictions.expectedCorners >= 10.2) {
    return {
      category: 'escanteios',
      label: 'Over 9.5 escanteios',
      probability: predictions.over95CornersProb,
      description: `Pressão territorial sustentada para cerca de ${formatDecimal(predictions.expectedCorners, 1)} cantos.`,
    };
  }

  if (predictions.over85CornersProb >= 67 && predictions.expectedCorners >= 9.1) {
    return {
      category: 'escanteios',
      label: 'Over 8.5 escanteios',
      probability: predictions.over85CornersProb,
      description: 'Linha principal de cantos com suporte ofensivo e volume dentro da faixa saudável.',
    };
  }

  return {
    category: 'escanteios',
    label: predictions.expectedCorners >= 8.6 ? 'Over 7.5 escanteios' : 'Under 10.5 escanteios',
    probability: predictions.expectedCorners >= 8.6 ? predictions.over75CornersProb : predictions.under105CornersProb,
    description: predictions.expectedCorners >= 8.6
      ? 'Leitura conservadora para cantos sem forçar linhas altas demais.'
      : 'Proteção mais segura quando o volume esperado não pede mercado alto de escanteios.',
  };
}

function buildCardsPick(predictions: Predictions): Omit<RaphaPick, 'status'> {
  if (predictions.over45CardsProb >= 57 || predictions.expectedCards >= 4.6) {
    return {
      category: 'cartoes',
      label: 'Over 4.5 cartões',
      probability: predictions.over45CardsProb,
      description: `Intensidade estimada de ${formatDecimal(predictions.expectedCards, 1)} cartões.`,
    };
  }

  if (predictions.over35CardsProb >= 62) {
    return {
      category: 'cartoes',
      label: 'Over 3.5 cartões',
      probability: predictions.over35CardsProb,
      description: 'Histórico disciplinar sustenta uma linha média-alta.',
    };
  }

  return {
    category: 'cartoes',
    label: 'Over 2.5 cartões',
    probability: predictions.over25CardsProb,
    description: 'Leitura conservadora para mercado de cartões.',
  };
}

function buildWinnerPick(entry: RoundScanEntry): Omit<RaphaPick, 'status'> {
  const { match, predictions, summary } = entry;
  const candidates = [
    {
      label: `${match.strHomeTeam} vence`,
      probability: predictions.homeWinProb,
      description: `Força da casa + índice de decisão ${summary.decisionScore}.`,
    },
    {
      label: 'Empate',
      probability: predictions.drawProb,
      description: 'Modelo vê confronto equilibrado e de margem curta.',
    },
    {
      label: `${match.strAwayTeam} vence`,
      probability: predictions.awayWinProb,
      description: `Visitante chega com cenário competitivo e leitura pró-mercado.`,
    },
  ].sort((a, b) => b.probability - a.probability);

  return {
    category: 'vencedor',
    ...candidates[0],
  };
}

function buildScorePick(predictions: Predictions): Omit<RaphaPick, 'status'> {
  const score = getMostLikelyScore(predictions);
  return {
    category: 'placar',
    label: `Placar exato ${score.home} x ${score.away}`,
    probability: score.probability,
    description: 'Combinação mais provável do modelo de distribuição de gols.',
  };
}

function evaluateGoalsPick(label: string, home: number, away: number): PickStatus {
  const total = home + away;
  const normalized = label.toLowerCase();
  if (normalized.includes('ambos marcam')) return home > 0 && away > 0 ? 'won' : 'lost';

  const overMatch = normalized.match(/over\s*(\d+(?:\.\d+)?)/);
  if (overMatch) return total > Number(overMatch[1]) ? 'won' : 'lost';

  const underMatch = normalized.match(/under\s*(\d+(?:\.\d+)?)/);
  if (underMatch) return total < Number(underMatch[1]) ? 'won' : 'lost';

  return 'unavailable';
}

function evaluatePick(pick: Omit<RaphaPick, 'status'>, entry: RoundScanEntry, finalStats?: FinalStatsSnapshot): PickStatus {
  const score = parseMatchScore(entry.match);
  const isFinished = entry.match.strStatus === 'Match Finished';

  if (!isFinished || !score) return 'pending';

  if (pick.category === 'vencedor') {
    if (pick.label === 'Empate') return score.home === score.away ? 'won' : 'lost';
    if (pick.label.includes(entry.match.strHomeTeam)) return score.home > score.away ? 'won' : 'lost';
    return score.away > score.home ? 'won' : 'lost';
  }

  if (pick.category === 'placar') {
    const exactMatch = pick.label.match(/(\d+)\s*x\s*(\d+)/i);
    if (!exactMatch) return 'unavailable';
    return Number(exactMatch[1]) === score.home && Number(exactMatch[2]) === score.away ? 'won' : 'lost';
  }

  if (pick.category === 'gols') {
    return evaluateGoalsPick(pick.label, score.home, score.away);
  }

  if (pick.category === 'escanteios') {
    if (finalStats?.totalCorners == null) return 'unavailable';
    const total = finalStats.totalCorners;
    const normalized = pick.label.toLowerCase();
    const overMatch = normalized.match(/over\s*(\d+(?:\.\d+)?)/);
    if (overMatch) return total > Number(overMatch[1]) ? 'won' : 'lost';
    const underMatch = normalized.match(/under\s*(\d+(?:\.\d+)?)/);
    if (underMatch) return total < Number(underMatch[1]) ? 'won' : 'lost';
    return 'unavailable';
  }

  if (pick.category === 'cartoes') {
    if (finalStats?.totalCards == null) return 'unavailable';
    const total = finalStats.totalCards;
    const normalized = pick.label.toLowerCase();
    const overMatch = normalized.match(/over\s*(\d+(?:\.\d+)?)/);
    if (overMatch) return total > Number(overMatch[1]) ? 'won' : 'lost';
    const underMatch = normalized.match(/under\s*(\d+(?:\.\d+)?)/);
    if (underMatch) return total < Number(underMatch[1]) ? 'won' : 'lost';
    return 'unavailable';
  }

  return 'unavailable';
}

function rankEntries(entries: RoundScanEntry[]) {
  return [...entries].sort((a, b) => {
    const aLive = a.match.strStatus === 'In Progress' ? 1 : 0;
    const bLive = b.match.strStatus === 'In Progress' ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;

    const aFinished = a.match.strStatus === 'Match Finished' ? 1 : 0;
    const bFinished = b.match.strStatus === 'Match Finished' ? 1 : 0;
    if (aFinished !== bFinished) return aFinished - bFinished;

    const aScore = a.summary.decisionScore * 0.52 + (a.confidence === 'high' ? 10 : a.confidence === 'medium' ? 5 : 0);
    const bScore = b.summary.decisionScore * 0.52 + (b.confidence === 'high' ? 10 : b.confidence === 'medium' ? 5 : 0);
    return bScore - aScore;
  });
}

async function fetchFinalStats(matchId: string): Promise<FinalStatsSnapshot> {
  try {
    const response = await fetch(`${ESPN_BASE}/all/summary?event=${matchId}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { totalCorners: null, totalCards: null, loaded: true };
    }

    const data = await response.json();
    const boxscore = data.boxscore || {};
    const teams = Array.isArray(boxscore.teams) ? boxscore.teams : [];

    const parseValue = (teamData: Record<string, unknown>, label: string) => {
      const stats = Array.isArray(teamData.statistics) ? (teamData.statistics as Record<string, unknown>[]) : [];
      const found = stats.find((item) => String(item.label || item.name || '').toLowerCase().includes(label.toLowerCase()));
      if (!found) return 0;
      const raw = found.displayValue ?? found.value;
      return Number(raw) || 0;
    };

    const totalCorners = teams.reduce((sum: number, teamData: Record<string, unknown>) => sum + parseValue(teamData, 'corner'), 0);
    const totalCards = teams.reduce((sum: number, teamData: Record<string, unknown>) => {
      const yellow = parseValue(teamData, 'yellow');
      const red = parseValue(teamData, 'red');
      return sum + yellow + red;
    }, 0);

    return {
      totalCorners: totalCorners > 0 ? totalCorners : null,
      totalCards: totalCards > 0 ? totalCards : null,
      loaded: true,
    };
  } catch {
    return { totalCorners: null, totalCards: null, loaded: true };
  }
}

function useFinishedStats(entries: RoundScanEntry[]) {
  const finishedIds = useMemo(
    () => entries.filter((entry) => entry.match.strStatus === 'Match Finished').map((entry) => entry.match.idEvent),
    [entries],
  );
  const [map, setMap] = useState<Record<string, FinalStatsSnapshot>>({});

  useEffect(() => {
    let cancelled = false;
    const missingIds = finishedIds.filter((id) => id && !map[id]);

    if (missingIds.length === 0) return;

    Promise.all(
      missingIds.slice(0, 18).map(async (id) => ({
        id,
        data: await fetchFinalStats(id),
      })),
    ).then((results) => {
      if (cancelled) return;
      setMap((current) => {
        const next = { ...current };
        results.forEach(({ id, data }) => {
          next[id] = data;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [finishedIds, map]);

  return map;
}

function ResultBadge({ status }: { status: PickStatus }) {
  if (status === 'pending') {
    return <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Pendente</span>;
  }

  if (status === 'unavailable') {
    return <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Sem dado final</span>;
  }

  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]',
        status === 'won'
          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/35 bg-red-500/10 text-red-300',
      )}
    >
      {status === 'won' ? 'Acertou' : 'Errou'}
    </span>
  );
}

function categoryIcon(category: PickCategory) {
  switch (category) {
    case 'vencedor':
      return Trophy;
    case 'placar':
      return Target;
    case 'gols':
      return Sparkles;
    case 'escanteios':
      return Flag;
    case 'cartoes':
      return CreditCard;
    default:
      return BarChart3;
  }
}

function categoryTone(category: PickCategory) {
  switch (category) {
    case 'vencedor':
      return 'text-blue-300 border-blue-500/20 bg-blue-500/10';
    case 'placar':
      return 'text-violet-300 border-violet-500/20 bg-violet-500/10';
    case 'gols':
      return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
    case 'escanteios':
      return 'text-amber-300 border-amber-500/20 bg-amber-500/10';
    case 'cartoes':
      return 'text-red-300 border-red-500/20 bg-red-500/10';
    default:
      return 'text-slate-300 border-slate-700 bg-slate-800/50';
  }
}

function formatKickoff(match: Match) {
  if (match.strStatus === 'In Progress') return match.liveStatusLabel || match.liveDisplayClock || 'Ao vivo';
  if (match.strStatus === 'Match Finished') return 'Encerrado';
  return (match.strTime || '—').slice(0, 5);
}

const CONFIDENCE_LABELS: Record<RoundScanEntry['confidence'], string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

function confidenceTone(confidence: RoundScanEntry['confidence']) {
  if (confidence === 'high') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (confidence === 'medium') return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  return 'border-slate-600/50 bg-slate-900/70 text-slate-300';
}

type PickRisk = 'baixo' | 'medio' | 'alto';

function getPickRisk(pick: RaphaPick, entry: RoundScanEntry): PickRisk {
  const probability = pick.probability;
  if (pick.category === 'placar') return 'alto';
  if (pick.category === 'escanteios') {
    if (pick.label.toLowerCase().includes('over 9.5') && probability < 68) return 'alto';
    if (entry.predictions.expectedCorners <= 8.1 && pick.label.toLowerCase().includes('over')) return 'alto';
    if (probability >= 66 && (pick.label.toLowerCase().includes('under 10.5') || pick.label.toLowerCase().includes('over 7.5') || pick.label.toLowerCase().includes('over 8.5'))) return 'baixo';
    return probability >= 61 ? 'medio' : 'alto';
  }
  if (probability >= 72) return 'baixo';
  if (probability >= 60) return 'medio';
  return 'alto';
}

function riskTone(risk: PickRisk) {
  if (risk === 'baixo') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (risk === 'medio') return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
}

function riskLabel(risk: PickRisk) {
  if (risk === 'baixo') return 'Risco baixo';
  if (risk === 'medio') return 'Risco médio';
  return 'Risco alto';
}

function pickCategoryBoost(category: PickCategory) {
  switch (category) {
    case 'vencedor':
      return 7;
    case 'gols':
      return 6;
    case 'escanteios':
      return 5;
    case 'cartoes':
      return 4;
    case 'placar':
      return -12;
    default:
      return 0;
  }
}

function conservativeLabelBoost(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('over 1.5')) return 12;
  if (normalized.includes('under 3.5')) return 11;
  if (normalized.includes('over 7.5')) return 10;
  if (normalized.includes('over 2.5 cartões')) return 10;
  if (normalized.includes('over 3.5 cartões')) return 7;
  if (normalized.includes('over 8.5 escanteios')) return 6;
  if (normalized.includes('vence')) return 5;
  if (normalized.includes('ambos marcam')) return 1;
  if (normalized.includes('placar exato')) return -20;
  return 0;
}

function primaryPickScore(pick: RaphaPick, entry: RoundScanEntry) {
  return (pick.probability * 0.72) + (entry.summary.decisionScore * 0.18) + pickCategoryBoost(pick.category);
}

function conservativePickScore(pick: RaphaPick, entry: RoundScanEntry) {
  return (pick.probability * 0.86) + (entry.summary.stabilityScore * 0.14) + conservativeLabelBoost(pick.label);
}

function selectPrimaryPick(picks: RaphaPick[], entry: RoundScanEntry) {
  return [...picks].sort((a, b) => primaryPickScore(b, entry) - primaryPickScore(a, entry))[0] ?? null;
}

function selectConservativePick(picks: RaphaPick[], entry: RoundScanEntry, primaryPick: RaphaPick | null) {
  const pool = picks.filter((pick) => pick.category !== 'placar' && pick.probability >= 52);
  const ranked = [...(pool.length > 0 ? pool : picks)].sort((a, b) => conservativePickScore(b, entry) - conservativePickScore(a, entry));
  const different = ranked.find((pick) => !primaryPick || pick.label !== primaryPick.label);
  return different ?? ranked[0] ?? null;
}


const PICK_CATEGORY_LABELS: Record<PickCategory, string> = {
  vencedor: 'Vencedor',
  placar: 'Placar',
  gols: 'Gols',
  escanteios: 'Escanteios',
  cartoes: 'Cartões',
};

type MarketFiltrar = 'todos' | PickCategory;
type ConfidenceFiltrar = 'todas' | 'alta' | 'media' | 'baixa';
type LeagueFiltrar = 'todas' | string;

const MARKET_FILTERS: Array<{ id: MarketFiltrar; label: string }> = [
  { id: 'todos', label: 'Todos os mercados' },
  { id: 'vencedor', label: 'Vencedor' },
  { id: 'placar', label: 'Placar' },
  { id: 'gols', label: 'Gols' },
  { id: 'escanteios', label: 'Escanteios' },
  { id: 'cartoes', label: 'Cartões' },
];

const CONFIDENCE_FILTERS: Array<{ id: ConfidenceFiltrar; label: string; value?: RoundScanEntry['confidence'] }> = [
  { id: 'todas', label: 'Todas as confianças' },
  { id: 'alta', label: 'Alta', value: 'high' },
  { id: 'media', label: 'Média', value: 'medium' },
  { id: 'baixa', label: 'Baixa', value: 'low' },
];

function getMedalMeta(rank: number) {
  if (rank === 0) {
    return {
      label: 'Ouro',
      cardClass: 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100',
      badgeClass: 'border-yellow-400/45 bg-yellow-400/15 text-yellow-200',
      iconClass: 'text-yellow-300',
    };
  }

  if (rank === 1) {
    return {
      label: 'Prata',
      cardClass: 'border-slate-400/25 bg-slate-400/10 text-slate-100',
      badgeClass: 'border-slate-300/35 bg-slate-300/10 text-slate-200',
      iconClass: 'text-slate-200',
    };
  }

  if (rank === 2) {
    return {
      label: 'Bronze',
      cardClass: 'border-amber-700/35 bg-amber-700/10 text-amber-100',
      badgeClass: 'border-amber-600/35 bg-amber-600/10 text-amber-200',
      iconClass: 'text-amber-300',
    };
  }

  return {
    label: `Top ${rank + 1}`,
    cardClass: 'border-slate-700/80 bg-slate-900/60 text-slate-100',
    badgeClass: 'border-slate-700 bg-slate-900/70 text-slate-300',
    iconClass: 'text-slate-300',
  };
}

export function RaphaPicksPanel({
  entries,
  loading,
  completed,
  total,
  onSelectMatch,
}: {
  entries: RoundScanEntry[];
  loading: boolean;
  completed: number;
  total: number;
  onSelectMatch: (match: Match) => void;
}) {
  const [marketFilter, setMarketFiltrar] = useState<MarketFiltrar>('todos');
  const [confidenceFilter, setConfidenceFiltrar] = useState<ConfidenceFiltrar>('todas');
  const [leagueFilter, setLeagueFiltrar] = useState<LeagueFiltrar>('todas');
  const rankedEntries = useMemo(() => rankEntries(entries), [entries]);
  const finishedStatsMap = useFinishedStats(rankedEntries);

  const generated = useMemo<GeneratedRaphaMatch[]>(() => {
    return rankedEntries.map((entry) => {
      const finalStats = finishedStatsMap[entry.match.idEvent];
      const rawPicks: Array<Omit<RaphaPick, 'status'>> = [
        buildWinnerPick(entry),
        buildScorePick(entry.predictions),
        buildGoalsPick(entry.predictions),
        buildCornersPick(entry.predictions),
        buildCardsPick(entry.predictions),
      ];

      const picks = rawPicks.map((pick) => ({
        ...pick,
        status: evaluatePick(pick, entry, finalStats),
      }));

      const settled = picks.filter((pick) => pick.status === 'won' || pick.status === 'lost');
      const won = settled.filter((pick) => pick.status === 'won').length;

      const primaryPick = selectPrimaryPick(picks, entry);
      const conservativePick = selectConservativePick(picks, entry, primaryPick);

      return {
        entry,
        picks,
        primaryPick,
        conservativePick,
        settledCount: settled.length,
        wonCount: won,
        accuracy: settled.length > 0 ? (won / settled.length) * 100 : 0,
        scoreline: parseMatchScore(entry.match),
        finalStats,
      };
    });
  }, [rankedEntries, finishedStatsMap]);

  const leagueOptions = useMemo(() => {
    return ['todas', ...Array.from(new Set(generated.map((item) => item.entry.match.strLeague || 'Sem liga'))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))] as LeagueFiltrar[];
  }, [generated]);

  const visibleMatches = useMemo(() => {
    const selectedConfidence = CONFIDENCE_FILTERS.find((item) => item.id === confidenceFiltrar)?.value;

    return generated
      .filter((item) => !selectedConfidence || item.entry.confidence === selectedConfidence)
      .filter((item) => leagueFiltrar === 'todas' || (item.entry.match.strLeague || 'Sem liga') === leagueFiltrar)
      .map((item) => ({
        ...item,
        picks: item.picks.filter((pick) => marketFiltrar === 'todos' || pick.category === marketFiltrar),
      }))
      .filter((item) => item.picks.length > 0);
  }, [generated, marketFilter, confidenceFilter, leagueFiltrar]);

  const activeMatches = useMemo(
    () => visibleMatches.filter((item) => item.entry.match.strStatus !== 'Match Finished'),
    [visibleMatches],
  );
  const finishedMatches = useMemo(
    () => visibleMatches.filter((item) => item.entry.match.strStatus === 'Match Finished'),
    [visibleMatches],
  );

  const summary = useMemo(() => {
    const settledPicks = finishedMatches.flatMap((item) => item.picks).filter((pick) => pick.status === 'won' || pick.status === 'lost');
    const wonPicks = settledPicks.filter((pick) => pick.status === 'won').length;
    const byCategory = (['vencedor', 'placar', 'gols', 'escanteios', 'cartoes'] as PickCategory[])
      .map((category) => {
        const categorySettled = settledPicks.filter((pick) => pick.category === category);
        const categoryWon = categorySettled.filter((pick) => pick.status === 'won').length;
        return {
          category,
          settled: categorySettled.length,
          won: categoryWon,
          accuracy: categorySettled.length > 0 ? (categoryWon / categorySettled.length) * 100 : 0,
        };
      })
      .filter((item) => marketFiltrar === 'todos' || item.category === marketFiltrar);

    const bestCategory = [...byCategory]
      .filter((item) => item.settled > 0)
      .sort((a, b) => (b.accuracy - a.accuracy) || (b.won - a.won))[0] || null;

    return {
      totalMatches: visibleMatches.length,
      activeMatches: activeMatches.length,
      finishedMatches: finishedMatches.length,
      settledPicks: settledPicks.length,
      wonPicks,
      accuracy: settledPicks.length > 0 ? (wonPicks / settledPicks.length) * 100 : 0,
      byCategory,
      bestCategory,
    };
  }, [visibleMatches, activeMatches.length, finishedMatches.length, marketFilter, finishedMatches]);

  const podiumCategories = useMemo(
    () => [...summary.byCategory].filter((item) => item.settled > 0).sort((a, b) => (b.accuracy - a.accuracy) || (b.won - a.won)).slice(0, 3),
    [summary.byCategory],
  );

  const leagueRanking = useMemo(() => {
    const grouped = new Map<string, { league: string; matches: number; settled: number; won: number; avgDecision: number; totalDecision: number; high: number }>();

    visibleMatches.forEach((item) => {
      const league = item.entry.match.strLeague || 'Sem liga';
      const current = grouped.get(league) ?? { league, matches: 0, settled: 0, won: 0, avgDecision: 0, totalDecision: 0, high: 0 };
      current.matches += 1;
      current.totalDecision += item.entry.summary.decisionScore;
      if (item.entry.confidence === 'high') current.high += 1;
      const settledPicks = item.picks.filter((pick) => pick.status === 'won' || pick.status === 'lost');
      current.settled += settledPicks.length;
      current.won += settledPicks.filter((pick) => pick.status === 'won').length;
      grouped.set(league, current);
    });

    return [...grouped.values()]
      .map((item) => ({
        ...item,
        avgDecision: item.matches > 0 ? item.totalDecision / item.matches : 0,
        accuracy: item.settled > 0 ? (item.won / item.settled) * 100 : 0,
        classificaçãoScore: (item.settled > 0 ? (item.won / item.settled) * 100 : 0) * 0.62 + (item.matches * 4) + (item.avgDecision * 0.22) + (item.high * 3),
      }))
      .sort((a, b) => b.classificaçãoScore - a.classificaçãoScore)
      .slice(0, 6);
  }, [visibleMatches]);

  const hourRanking = useMemo(() => {
    const grouped = new Map<string, { label: string; matches: number; avgProb: number; totalProb: number; avgDecision: number; totalDecision: number; live: number }>();

    activeMatches.forEach((item) => {
      const rawTime = (item.entry.match.strTime || '').slice(0, 2);
      const label = item.entry.match.strStatus === 'In Progress' ? 'Ao vivo agora' : (/^\d{2}$/.test(rawTime) ? `${rawTime}:00` : 'Sem horário');
      const bestPick = item.primaryPick ?? item.picks[0] ?? null;
      const current = grouped.get(label) ?? { label, matches: 0, avgProb: 0, totalProb: 0, avgDecision: 0, totalDecision: 0, live: 0 };
      current.matches += 1;
      current.totalDecision += item.entry.summary.decisionScore;
      current.totalProb += bestPick?.probability ?? 0;
      if (item.entry.match.strStatus === 'In Progress') current.live += 1;
      grouped.set(label, current);
    });

    return [...grouped.values()]
      .map((item) => ({
        ...item,
        avgProb: item.matches > 0 ? item.totalProb / item.matches : 0,
        avgDecision: item.matches > 0 ? item.totalDecision / item.matches : 0,
        classificaçãoScore: item.live * 8 + item.matches * 3 + (item.matches > 0 ? item.totalProb / item.matches : 0) * 0.46 + (item.matches > 0 ? item.totalDecision / item.matches : 0) * 0.24,
      }))
      .sort((a, b) => b.classificaçãoScore - a.classificaçãoScore)
      .slice(0, 6);
  }, [activeMatches]);

  const topPendingPicks = useMemo(() => {
    return activeMatches
      .flatMap((item) =>
        item.picks.map((pick) => ({
          item,
          pick,
          classificaçãoScore:
            pick.probability * 0.62 +
            item.entry.summary.decisionScore * 0.26 +
            (item.entry.confidence === 'high' ? 8 : item.entry.confidence === 'medium' ? 4 : 0),
        })),
      )
      .sort((a, b) => b.classificaçãoScore - a.classificaçãoScore)
      .slice(0, 6);
  }, [activeMatches]);

  const topResolvedPicks = useMemo(() => {
    return finishedMatches
      .flatMap((item) =>
        item.picks
          .filter((pick) => pick.status === 'won' || pick.status === 'lost')
          .map((pick) => ({
            item,
            pick,
            classificaçãoScore: (pick.status === 'won' ? 100 : 0) + pick.probability * 0.35 + item.accuracy * 0.2,
          })),
      )
      .sort((a, b) => b.classificaçãoScore - a.classificaçãoScore)
      .slice(0, 6);
  }, [finishedMatches]);

  if (loading && entries.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
        <h2 className="mt-4 text-lg font-black text-white">Montando os Pitacos do Rapha</h2>
        <p className="mt-2 text-sm text-slate-400">Analisando histórico, força ofensiva, defesa, probabilidade e mercado da rodada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[30px] border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(2,6,23,0.92))] shadow-[0_24px_60px_-44px_rgba(15,23,42,1)]">
        <div className="border-b border-slate-800/80 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-300">Pitacos do Rapha</p>
              <h2 className="mt-1 text-xl font-black text-white">Pitacos prontos, classificação do dia e desempenho por mercado</h2>
              <p className="mt-2 text-sm text-slate-400">
                A aba agora separa os melhores pitacos do dia, mostra classificação por liga, filtra por confiança e destaca o pitaco principal ao lado de uma leitura conservadora para cada jogo.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-right">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Scanner da rodada</div>
              <div className="mt-1 text-sm font-bold text-slate-200">{completed}/{total || entries.length} análises prontas</div>
              <div className="mt-1 text-xs text-slate-500">Atualiza conforme novas leituras entram no scanner.</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-800/70 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Jogos com pitaco</div>
            <div className="mt-2 text-3xl font-black text-white">{summary.totalMatches}</div>
            <div className="mt-1 text-xs text-slate-500">Rodada atual filtrada</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Ao vivo ou por jogar</div>
            <div className="mt-2 text-3xl font-black text-amber-300">{summary.activeMatches}</div>
            <div className="mt-1 text-xs text-slate-500">Pitacos antes do resultado</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Taxa de acerto</div>
            <div className="mt-2 text-3xl font-black text-emerald-300">{formatPercent(summary.accuracy, { digits: 0 })}</div>
            <div className="mt-1 text-xs text-slate-500">{summary.wonPicks}/{summary.settledPicks} pitacos liquidados</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Mercado mais forte</div>
            <div className="mt-2 text-lg font-black text-blue-300">{summary.bestCategory ? PICK_CATEGORY_LABELS[summary.bestCategory.category] : 'Ainda sem base'}</div>
            <div className="mt-1 text-xs text-slate-500">
              {summary.bestCategory ? `${summary.bestCategory.won}/${summary.bestCategory.settled} • ${formatPercent(summary.bestCategory.accuracy, { digits: 0 })}` : 'Aguardando resultados encerrados'}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-800/70 px-5 py-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                <Filter className="h-3.5 w-3.5 text-cyan-300" />
                Mercado dos pitacos
              </div>
              <p className="mt-1 text-xs text-slate-500">Use o filtro para ver só vencedor, placar, gols, escanteios ou cartões.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MARKET_FILTERS.map((option) => {
                  const active = marketFiltrar === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMarketFiltrar(option.id)}
                      className={cn(
                        'rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition-all',
                        active
                          ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-100 shadow-[0_16px_32px_-26px_rgba(6,182,212,0.85)]'
                          : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-600 hover:text-slate-100'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Faixa de confiança
              </div>
              <p className="mt-1 text-xs text-slate-500">Corte a lista por confiança do scanner para enxergar leituras mais fortes.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CONFIDENCE_FILTERS.map((option) => {
                  const active = confidenceFiltrar === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setConfidenceFiltrar(option.id)}
                      className={cn(
                        'rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition-all',
                        active
                          ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-100 shadow-[0_16px_32px_-26px_rgba(16,185,129,0.85)]'
                          : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-600 hover:text-slate-100'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                <Trophy className="h-3.5 w-3.5 text-violet-300" />
                Liga
              </div>
              <p className="mt-1 text-xs text-slate-500">Filtre os pitacos por competição para enxergar onde o sistema está mais forte.</p>
              <div className="mt-3">
                <select
                  value={leagueFiltrar}
                  onChange={(event) => setLeagueFiltrar(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none transition focus:border-cyan-500"
                >
                  {leagueOptions.map((league) => (
                    <option key={league} value={league} className="bg-slate-950 text-slate-100">
                      {league === 'todas' ? 'Todas as ligas' : league}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr,1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              <Crown className="h-4 w-4 text-yellow-300" />
              Pódio por mercado
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {podiumCategories.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-6 text-sm text-slate-500 md:col-span-3">
                  Ainda não há resultados suficientes para montar o pódio dos mercados.
                </div>
              ) : (
                podiumCategories.map((item, index) => {
                  const medal = getMedalMeta(index);
                  const Icon = categoryIcon(item.category);
                  return (
                    <div key={item.category} className={cn('rounded-2xl border p-4', medal.cardClass)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]', medal.badgeClass)}>
                          <Medal className={cn('h-3.5 w-3.5', medal.iconClass)} />
                          {medal.label}
                        </div>
                        <Icon className="h-4 w-4 text-white/80" />
                      </div>
                      <div className="mt-3 text-sm font-black text-white">{PICK_CATEGORY_LABELS[item.category]}</div>
                      <div className="mt-2 text-2xl font-black text-white">{formatPercent(item.accuracy, { digits: 0 })}</div>
                      <div className="mt-1 text-xs text-slate-300/80">{item.won}/{item.settled} liquidados</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              <Target className="h-4 w-4 text-cyan-300" />
              Recorte atual
            </div>
            <div className="mt-3 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Mercado filtrado</div>
                <div className="mt-1 text-base font-black text-white">{MARKET_FILTERS.find((item) => item.id === marketFiltrar)?.label}</div>
                <div className="mt-1 text-xs text-slate-500">Confiança: {CONFIDENCE_FILTERS.find((item) => item.id === confidenceFiltrar)?.label} • Liga: {leagueFiltrar === 'todas' ? 'Todas' : leagueFiltrar}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Melhor leitura do dia</div>
                <div className="mt-1 text-sm font-black text-white">{topPendingPicks[0] ? topPendingPicks[0].pick.label : 'Sem pitacos em aberto'}</div>
                <div className="mt-1 text-xs text-slate-500">{topPendingPicks[0] ? `${topPendingPicks[0].item.entry.match.strHomeTeam} x ${topPendingPicks[0].item.entry.match.strAwayTeam}` : 'O filtro atual não retornou leitura aberta.'}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Liga mais forte no recorte</div>
                <div className="mt-1 text-base font-black text-white">{leagueRanking[0]?.league ?? 'Ainda sem base'}</div>
                <div className="mt-1 text-xs text-slate-500">{leagueRanking[0] ? `${leagueRanking[0].matches} jogos • ${leagueRanking[0].settled > 0 ? formatPercent(leagueRanking[0].accuracy, { digits: 0 }) : `índice médio ${formatDecimal(leagueRanking[0].avgDecision, 0)}`}` : 'Aguardando volume suficiente.'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-blue-300" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">Classificação por liga</h3>
            <p className="mt-1 text-xs text-slate-500">Veja quais competições estão entregando melhor leitura no recorte atual de mercado e confiança.</p>
          </div>
        </div>

        {leagueRanking.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-6 text-sm text-slate-500">
            Ainda não há ligas suficientes no recorte atual para montar o classificação.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {leagueRanking.map((league, index) => {
              const medal = getMedalMeta(index);
              return (
                <div key={league.league} className={cn('rounded-3xl border p-4', medal.cardClass)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', medal.badgeClass)}>
                      <Medal className={cn('h-3.5 w-3.5', medal.iconClass)} />
                      {medal.label}
                    </div>
                    <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{league.high} alta</span>
                  </div>
                  <div className="mt-3 text-base font-black text-white">{league.league}</div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                    <span className="text-2xl font-black text-white">{league.settled > 0 ? formatPercent(league.accuracy, { digits: 0 }) : formatDecimal(league.avgDecision, 0)}</span>
                    <span className="text-xs text-slate-400">{league.settled > 0 ? 'acerto' : 'índice médio'}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-300/80">{league.matches} jogos • {league.settled > 0 ? `${league.won}/${league.settled} liquidados` : 'aguardando liquidação'}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-amber-300" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">Classificação por horário</h3>
            <p className="mt-1 text-xs text-slate-500">Veja onde o recorte atual concentra os melhores pitacos por faixa de início.</p>
          </div>
        </div>

        {hourRanking.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-6 text-sm text-slate-500">
            Ainda não há jogos em aberto suficientes para montar o classificação por horário.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {hourRanking.map((slot, index) => {
              const medal = getMedalMeta(index);
              return (
                <div key={slot.label} className={cn('rounded-3xl border p-4', medal.cardClass)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', medal.badgeClass)}>
                      <Medal className={cn('h-3.5 w-3.5', medal.iconClass)} />
                      {medal.label}
                    </div>
                    <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{slot.live} ao vivo</span>
                  </div>
                  <div className="mt-3 text-base font-black text-white">{slot.label}</div>
                  <div className="mt-2 text-sm text-slate-200">{slot.matches} jogo(s) • {formatPercent(slot.avgProb, { digits: 0 })} prob. média</div>
                  <div className="mt-1 text-xs text-slate-400">Índice médio {formatDecimal(slot.avgDecision, 0)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-cyan-300" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">Melhores pitacos do dia</h3>
            <p className="mt-1 text-xs text-slate-500">Classificação pronta dos pitacos com maior probabilidade e melhor apoio do índice da rodada.</p>
          </div>
        </div>

        {topPendingPicks.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-6 text-center text-sm text-slate-500">
            Nenhum pitaco em aberto no filtro atual. Tente trocar o mercado para ver mais opções.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {topPendingPicks.map((entry, index) => {
              const medal = getMedalMeta(index);
              const Icon = categoryIcon(entry.pick.category);
              return (
                <button
                  type="button"
                  key={`${entry.item.entry.match.idEvent}-${entry.pick.category}`}
                  onClick={() => onSelectMatch(entry.item.entry.match)}
                  className={cn('rounded-3xl border p-4 text-left transition-all hover:-translate-y-0.5', medal.cardClass)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', medal.badgeClass)}>
                      <Medal className={cn('h-3.5 w-3.5', medal.iconClass)} />
                      {medal.label}
                    </div>
                    <span className="text-lg font-black text-white">{formatPercent(entry.pick.probability, { digits: 0 })}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-300/90">
                    <Icon className="h-3.5 w-3.5" />
                    {PICK_CATEGORY_LABELS[entry.pick.category]}
                  </div>
                  <div className="mt-2 text-base font-black text-white">{traduzirTextoMercado(entry.pick.label)}</div>
                  <div className="mt-1 text-sm text-slate-200">{entry.item.entry.match.strHomeTeam} x {entry.item.entry.match.strAwayTeam}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1">{formatKickoff(entry.item.entry.match)}</span>
                    <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1">Índice {entry.item.entry.summary.decisionScore}</span>
                    <span className={cn('rounded-full border px-2 py-1', confidenceTone(entry.item.entry.confidence))}>{CONFIDENCE_LABELS[entry.item.entry.confidence]}</span>
                    <span className={cn('rounded-full border px-2 py-1', riskTone(getPickRisk(entry.pick, entry.item.entry)))}>{riskLabel(getPickRisk(entry.pick, entry.item.entry))}</span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-300/80">{entry.pick.description}</p>
                  {entry.item.primaryPick && entry.item.conservativePick && (
                    <div className="mt-3 grid gap-2 text-[11px] text-slate-300">
                      <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2"><span className="font-black text-cyan-200">Principal:</span> {entry.item.primaryPick.label}</div>
                      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2"><span className="font-black text-emerald-200">Conservador:</span> {entry.item.conservativePick.label}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-4">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-300" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">Pitacos antes do jogo</h3>
            <p className="mt-1 text-xs text-slate-500">Sugestões que ainda estão em aberto ou em acompanhamento ao vivo.</p>
          </div>
        </div>

        {activeMatches.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-6 text-center text-sm text-slate-500">
            Nenhum jogo pendente nesta data. Role para ver os resultados já encerrados.
          </div>
        ) : (
          <div className="space-y-3">
            {activeMatches.map((item) => (
              <div key={item.entry.match.idEvent} className="rounded-3xl border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(2,6,23,0.88))] p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] font-bold text-slate-300">{item.entry.match.strLeague}</span>
                      {item.entry.match.strStatus === 'In Progress' ? (
                        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-black text-red-300">Ao vivo</span>
                      ) : (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-200">Pré-jogo</span>
                      )}
                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-300">Índice {item.entry.summary.decisionScore}</span>
                      <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-black', confidenceTone(item.entry.confidence))}>{CONFIDENCE_LABELS[item.entry.confidence]}</span>
                      {item.primaryPick && <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-black', riskTone(getPickRisk(item.primaryPick, item.entry)))}>{riskLabel(getPickRisk(item.primaryPick, item.entry))}</span>}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                      <div className="text-lg font-black text-white">{item.entry.match.strHomeTeam}</div>
                      <span className="text-sm font-black text-slate-600">vs</span>
                      <div className="text-lg font-black text-white">{item.entry.match.strAwayTeam}</div>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{formatKickoff(item.entry.match)} • {traduzirTextoMercado(item.entry.summary.bestAngle)}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/15"
                    onClick={() => onSelectMatch(item.entry.match)}
                  >
                    Abrir análise
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">Pitaco principal</div>
                    <div className="mt-2 text-base font-black text-white">{item.primaryPick ? traduzirTextoMercado(item.primaryPick.label) : 'Sem leitura principal'}</div>
                    <div className="mt-1 text-xs text-slate-200/80">{item.primaryPick ? `${formatPercent(item.primaryPick.probability, { digits: 0 })} • leitura mais forte do modelo` : 'Aguardando scanner.'}</div>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Pitaco conservador</div>
                    <div className="mt-2 text-base font-black text-white">{item.conservativePick ? traduzirTextoMercado(item.conservativePick.label) : 'Sem leitura conservadora'}</div>
                    <div className="mt-1 text-xs text-slate-200/80">{item.conservativePick ? `${formatPercent(item.conservativePick.probability, { digits: 0 })} • linha mais segura` : 'Aguardando scanner.'}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {item.picks.map((pick) => {
                    const Icon = categoryIcon(pick.category);
                    return (
                      <div key={`${item.entry.match.idEvent}-${pick.category}`} className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className={cn('flex items-center gap-2 rounded-xl border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]', categoryTone(pick.category))}>
                            <Icon className="h-3.5 w-3.5" />
                            {PICK_CATEGORY_LABELS[pick.category]}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-black text-white">{formatPercent(pick.probability, { digits: 0 })}</span>
                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]', riskTone(getPickRisk(pick, item.entry)))}>{riskLabel(getPickRisk(pick, item.entry))}</span>
                          </div>
                        </div>
                        <div className="mt-3 text-base font-black text-white">{traduzirTextoMercado(pick.label)}</div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{pick.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-4">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">Resultados e acertos</h3>
            <p className="mt-1 text-xs text-slate-500">Depois que o jogo termina, o painel mostra o que bateu e o que ficou fora da leitura.</p>
          </div>
        </div>

        {topResolvedPicks.length > 0 && (
          <div className="mb-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {topResolvedPicks.map((entry, index) => {
              const medal = getMedalMeta(index);
              const Icon = categoryIcon(entry.pick.category);
              return (
                <button
                  type="button"
                  key={`resolved-${entry.item.entry.match.idEvent}-${entry.pick.category}`}
                  onClick={() => onSelectMatch(entry.item.entry.match)}
                  className={cn('rounded-3xl border p-4 text-left transition-all hover:-translate-y-0.5', medal.cardClass)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', medal.badgeClass)}>
                      <Medal className={cn('h-3.5 w-3.5', medal.iconClass)} />
                      {medal.label}
                    </div>
                    <ResultBadge status={entry.pick.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-300/90">
                    <Icon className="h-3.5 w-3.5" />
                    {PICK_CATEGORY_LABELS[entry.pick.category]}
                  </div>
                  <div className="mt-2 text-base font-black text-white">{traduzirTextoMercado(entry.pick.label)}</div>
                  <div className="mt-1 text-sm text-slate-200">{entry.item.entry.match.strHomeTeam} x {entry.item.entry.match.strAwayTeam}</div>
                  <div className="mt-2 text-xs text-slate-300/80">Prob. pré-jogo: {formatPercent(entry.pick.probability, { digits: 0 })}</div>
                </button>
              );
            })}
          </div>
        )}

        {finishedMatches.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-4 py-6 text-center text-sm text-slate-500">
            Ainda não há jogos encerrados para consolidar os pitacos desta data.
          </div>
        ) : (
          <div className="space-y-3">
            {finishedMatches.map((item) => (
              <div key={item.entry.match.idEvent} className="rounded-3xl border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(2,6,23,0.9))] p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] font-bold text-slate-300">{item.entry.match.strLeague}</span>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-300">{item.wonCount}/{item.settledCount || 0} acertos</span>
                      <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[11px] font-black text-blue-300">{formatPercent(item.accuracy, { digits: 0 })}</span>
                      <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-black', confidenceTone(item.entry.confidence))}>{CONFIDENCE_LABELS[item.entry.confidence]}</span>
                      {item.primaryPick && <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-black', riskTone(getPickRisk(item.primaryPick, item.entry)))}>{riskLabel(getPickRisk(item.primaryPick, item.entry))}</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-lg font-black text-white">
                      <span>{item.entry.match.strHomeTeam}</span>
                      <span className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1 text-blue-200">
                        {item.scoreline?.home ?? 0} x {item.scoreline?.away ?? 0}
                      </span>
                      <span>{item.entry.match.strAwayTeam}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>Escanteios finais: {item.finalStats?.loaded ? item.finalStats.totalCorners ?? 'sem dado' : 'carregando...'}</span>
                      <span>Cartões finais: {item.finalStats?.loaded ? item.finalStats.totalCards ?? 'sem dado' : 'carregando...'}</span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">Principal</div>
                        <div className="mt-1 text-sm font-black text-white">{item.primaryPick ? traduzirTextoMercado(item.primaryPick.label) : 'Sem leitura principal'}</div>
                        {item.primaryPick && <div className="mt-1 text-xs text-slate-300">{formatPercent(item.primaryPick.probability, { digits: 0 })} • <ResultBadge status={item.primaryPick.status} /></div>}
                      </div>
                      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Conservador</div>
                        <div className="mt-1 text-sm font-black text-white">{item.conservativePick ? traduzirTextoMercado(item.conservativePick.label) : 'Sem leitura conservadora'}</div>
                        {item.conservativePick && <div className="mt-1 text-xs text-slate-300">{formatPercent(item.conservativePick.probability, { digits: 0 })} • <ResultBadge status={item.conservativePick.status} /></div>}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
                    onClick={() => onSelectMatch(item.entry.match)}
                  >
                    Ver jogo
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {item.picks.map((pick) => {
                    const Icon = categoryIcon(pick.category);
                    return (
                      <div key={`${item.entry.match.idEvent}-${pick.category}`} className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className={cn('flex items-center gap-2 rounded-xl border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]', categoryTone(pick.category))}>
                            <Icon className="h-3.5 w-3.5" />
                            {PICK_CATEGORY_LABELS[pick.category]}
                          </div>
                          <ResultBadge status={pick.status} />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-white">{traduzirTextoMercado(pick.label)}</div>
                            <div className="mt-1 text-xs text-slate-500">{pick.description}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-black text-white">{formatPercent(pick.probability, { digits: 0 })}</div>
                            <div className={cn('mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]', riskTone(getPickRisk(pick, item.entry)))}>{riskLabel(getPickRisk(pick, item.entry))}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
