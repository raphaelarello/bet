import React, { useEffect, useMemo, useState } from 'react';
import type { Match, Predictions } from '@/lib/types';
import type { RoundScanEntry } from '@/hooks/useRoundScanner';
import { cn, formatDecimal, formatPercent, traduzirTextoMercado } from '@/lib/utils';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
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
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
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
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        <Activity className="h-2.5 w-2.5 animate-pulse" />
        Aguardando
      </span>
    );
  }
  if (status === 'unavailable') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        Sem dado
      </span>
    );
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]',
      status === 'won' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-red-500/40 bg-red-500/15 text-red-300',
    )}>
      {status === 'won' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
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
  const base = (pick.probability * 0.68) + (entry.summary.decisionScore * 0.20) + pickCategoryBoost(pick.category);

  // Bônus de alinhamento com mercado: picks de gols ganham quando modelo e mercado apontam mesma direção
  let marketBonus = 0;
  if (entry.marketOdds?.totalLine != null) {
    const line = entry.marketOdds.totalLine;
    if (Math.abs(line - 2.5) < 0.1) {
      if (pick.label.toLowerCase().includes('over 2.5') && entry.predictions.over25Prob > 60) marketBonus = 8;
      if (pick.label.toLowerCase().includes('under 2.5') && entry.predictions.under25Prob > 58) marketBonus = 7;
    }
  }

  // Bônus de confiança: picks com probabilidade alta + dataQuality alta = mais confiáveis
  const qualityBonus = entry.homeTeamStats
    ? Math.min(5, ((entry.homeTeamStats.dataQuality ?? 0) + (entry.awayTeamStats?.dataQuality ?? 0)) / 4)
    : 0;

  // Bônus de escanteios com dados reais
  const cornersQualityBonus = pick.category === 'escanteios'
    ? Math.round(((entry.homeTeamStats?.cornersDataQuality ?? 0) + (entry.awayTeamStats?.cornersDataQuality ?? 0)) / 2 * 6)
    : 0;

  return base + marketBonus + qualityBonus + cornersQualityBonus;
}

function conservativePickScore(pick: RaphaPick, entry: RoundScanEntry) {
  const base = (pick.probability * 0.84) + (entry.summary.stabilityScore * 0.16) + conservativeLabelBoost(pick.label);

  // Picks conservadores preferem alta probabilidade + mercado alinhado
  const marketAlignBonus = entry.summary.marketAlignmentScore > 70 ? 6 : entry.summary.marketAlignmentScore > 55 ? 3 : 0;

  return base + marketAlignBonus;
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

const MARKET_FILTERS: Array<{ id: MarketFiltrar; label: string; icon: typeof Trophy }> = [
  { id: 'todos', label: 'Todos', icon: BarChart3 },
  { id: 'vencedor', label: 'Vencedor', icon: Trophy },
  { id: 'gols', label: 'Gols', icon: Sparkles },
  { id: 'escanteios', label: 'Escanteios', icon: Flag },
  { id: 'cartoes', label: 'Cartões', icon: CreditCard },
  { id: 'placar', label: 'Placar', icon: Target },
];

const CONFIDENCE_SHORT: Record<RoundScanEntry['confidence'], string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const CONFIDENCE_FILTERS: Array<{ id: ConfidenceFiltrar; label: string; value?: RoundScanEntry['confidence'] }> = [
  { id: 'todas', label: 'Todas as confianças' },
  { id: 'alta', label: 'Alta', value: 'high' },
  { id: 'media', label: 'Média', value: 'medium' },
  { id: 'baixa', label: 'Baixa', value: 'low' },
];

function getMedalMeta(rank: number) {
  if (rank === 0) return {
    label: 'Ouro',
    cardClass: 'border-yellow-500/30 bg-[linear-gradient(145deg,rgba(234,179,8,0.12),rgba(234,179,8,0.04))]',
    badgeClass: 'border-yellow-400/50 bg-yellow-400/15 text-yellow-200',
    iconClass: 'text-yellow-300',
    accentColor: 'text-yellow-300',
  };
  if (rank === 1) return {
    label: 'Prata',
    cardClass: 'border-slate-400/20 bg-[linear-gradient(145deg,rgba(148,163,184,0.10),rgba(148,163,184,0.03))]',
    badgeClass: 'border-slate-300/30 bg-slate-300/8 text-slate-200',
    iconClass: 'text-slate-300',
    accentColor: 'text-slate-300',
  };
  if (rank === 2) return {
    label: 'Bronze',
    cardClass: 'border-amber-700/30 bg-[linear-gradient(145deg,rgba(180,83,9,0.12),rgba(180,83,9,0.04))]',
    badgeClass: 'border-amber-600/35 bg-amber-700/12 text-amber-200',
    iconClass: 'text-amber-400',
    accentColor: 'text-amber-400',
  };
  return {
    label: `Top ${rank + 1}`,
    cardClass: 'border-slate-700/60 bg-slate-900/50',
    badgeClass: 'border-slate-700 bg-slate-900/70 text-slate-300',
    iconClass: 'text-slate-400',
    accentColor: 'text-slate-300',
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
  const [marketFilter, setMarketFilter] = useState<MarketFiltrar>('todos');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFiltrar>('todas');
  const [leagueFilter, setLeagueFilter] = useState<LeagueFiltrar>('todas');
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
    const selectedConfidence = CONFIDENCE_FILTERS.find((item) => item.id === confidenceFilter)?.value;

    return generated
      .filter((item) => !selectedConfidence || item.entry.confidence === selectedConfidence)
      .filter((item) => leagueFilter === 'todas' || (item.entry.match.strLeague || 'Sem liga') === leagueFilter)
      .map((item) => ({
        ...item,
        picks: item.picks.filter((pick) => marketFilter === 'todos' || pick.category === marketFilter),
      }))
      .filter((item) => item.picks.length > 0);
  }, [generated, marketFilter, confidenceFilter, leagueFilter]);

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
      .filter((item) => marketFilter === 'todos' || item.category === marketFilter);

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

  // ── Loading state ──
  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(2,6,23,0.88))] p-14 text-center">
        <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-2xl border border-blue-500/20 bg-blue-500/8 animate-pulse" />
          <Loader2 className="relative h-7 w-7 animate-spin text-blue-400" />
        </div>
        <h2 className="text-xl font-black text-white">Montando os Pitacos do Rapha</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 leading-relaxed">
          Analisando histórico, força ofensiva, defesa, probabilidade e mercado da rodada.
        </p>
        {total > 0 && (
          <div className="mt-6 w-64">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500"
                style={{ width: `${Math.max(4, (completed / total) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">{completed} de {total} análises</p>
          </div>
        )}
      </div>
    );
  }

  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 100;

  return (
    <div className="space-y-4">

      {/* ── Hero header ── */}
      <div className="overflow-hidden rounded-[28px] border border-slate-800/80 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.14),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.10),transparent_35%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] shadow-[0_32px_80px_-50px_rgba(59,130,246,0.4)]">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10">
              <Zap className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">Pitacos do Rapha</p>
              <h2 className="text-lg font-black leading-tight text-white">Melhores leituras da rodada</h2>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {loading && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                <span className="text-xs text-slate-500">Atualizando…</span>
              </div>
            )}
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 px-4 py-2.5 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Scanner</p>
              <p className="mt-0.5 text-sm font-black text-white tabular-nums">{completed}<span className="text-slate-500">/{total || entries.length}</span></p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && progressPct < 100 && (
          <div className="h-0.5 w-full bg-slate-800/80">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-px bg-slate-800/40 sm:grid-cols-4">
          {[
            { label: 'Jogos com pitaco', value: String(summary.totalMatches), sub: 'Rodada filtrada', tone: 'text-white' },
            { label: 'Em aberto / ao vivo', value: String(summary.activeMatches), sub: 'Antes do apito final', tone: 'text-amber-300' },
            {
              label: 'Taxa de acerto',
              value: summary.settledPicks > 0 ? formatPercent(summary.accuracy, { digits: 0 }) : '—',
              sub: summary.settledPicks > 0 ? `${summary.wonPicks}/${summary.settledPicks} liquidados` : 'Aguardando resultados',
              tone: summary.accuracy >= 60 ? 'text-emerald-300' : summary.accuracy > 0 ? 'text-amber-300' : 'text-slate-400',
            },
            {
              label: 'Mercado mais forte',
              value: summary.bestCategory ? PICK_CATEGORY_LABELS[summary.bestCategory.category] : '—',
              sub: summary.bestCategory ? `${summary.bestCategory.won}/${summary.bestCategory.settled} · ${formatPercent(summary.bestCategory.accuracy, { digits: 0 })}` : 'Aguardando base',
              tone: 'text-blue-300',
            },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-slate-950/30 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{kpi.label}</p>
              <p className={cn('mt-2 text-2xl font-black tabular-nums leading-none', kpi.tone)}>{kpi.value}</p>
              <p className="mt-1 text-xs text-slate-500">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-5 border-t border-slate-800/60 px-6 py-5">
          {/* Market filter */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Mercado</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {MARKET_FILTERS.map((option) => {
                const active = marketFilter === option.id;
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMarketFilter(option.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-black uppercase tracking-[0.12em] transition-all duration-150',
                      active
                        ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100 shadow-[0_8px_24px_-12px_rgba(6,182,212,0.7)]'
                        : 'border-slate-700/60 bg-slate-950/60 text-slate-400 hover:border-slate-600/80 hover:text-slate-200',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Confidence + League row */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Confiança</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CONFIDENCE_FILTERS.map((option) => {
                  const active = confidenceFilter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setConfidenceFilter(option.id)}
                      className={cn(
                        'rounded-2xl border px-3.5 py-2 text-xs font-black uppercase tracking-[0.12em] transition-all duration-150',
                        active
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.65)]'
                          : 'border-slate-700/60 bg-slate-950/60 text-slate-400 hover:border-slate-600/80 hover:text-slate-200',
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Liga</span>
              </div>
              <select
                value={leagueFilter}
                onChange={(e) => setLeagueFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-700/60 bg-slate-950/70 px-4 py-2.5 text-sm font-semibold text-slate-100 outline-none transition focus:border-violet-500/60"
              >
                {leagueOptions.map((league) => (
                  <option key={league} value={league} className="bg-slate-950">
                    {league === 'todas' ? 'Todas as ligas' : league}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pódio + Insights */}
        {(podiumCategories.length > 0 || leagueRanking.length > 0 || topPendingPicks.length > 0) && (
          <div className="border-t border-slate-800/60 px-6 py-5">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-300" />
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Pódio por mercado</span>
                </div>
                {podiumCategories.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-500">
                    Aguardando resultados liquidados para montar o pódio.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {podiumCategories.map((item, index) => {
                      const medal = getMedalMeta(index);
                      const Icon = categoryIcon(item.category);
                      return (
                        <div key={item.category} className={cn('rounded-2xl border p-4', medal.cardClass)}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]', medal.badgeClass)}>
                              <Medal className={cn('h-3 w-3', medal.iconClass)} />
                              {medal.label}
                            </span>
                            <Icon className="h-4 w-4 text-white/70" />
                          </div>
                          <p className="mt-3 text-xs font-black uppercase tracking-[0.1em] text-white/80">{PICK_CATEGORY_LABELS[item.category]}</p>
                          <p className={cn('mt-1 text-2xl font-black tabular-nums', medal.accentColor)}>{formatPercent(item.accuracy, { digits: 0 })}</p>
                          <p className="mt-1 text-[10px] text-slate-400">{item.won}/{item.settled} liquidados</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4 text-cyan-300" />
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Insights do recorte</span>
                </div>
                <div className="space-y-2.5">
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Melhor pitaco em aberto</p>
                    {topPendingPicks[0] ? (
                      <>
                        <p className="mt-1.5 text-sm font-black text-white">{traduzirTextoMercado(topPendingPicks[0].pick.label)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{topPendingPicks[0].item.entry.match.strHomeTeam} x {topPendingPicks[0].item.entry.match.strAwayTeam}</p>
                      </>
                    ) : (
                      <p className="mt-1.5 text-sm text-slate-500">Nenhum em aberto no filtro atual.</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Liga mais forte</p>
                    {leagueRanking[0] ? (
                      <>
                        <p className="mt-1.5 text-sm font-black text-white">{leagueRanking[0].league}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {leagueRanking[0].matches} jogos · {leagueRanking[0].settled > 0 ? formatPercent(leagueRanking[0].accuracy, { digits: 0 }) + ' acerto' : 'índice ' + formatDecimal(leagueRanking[0].avgDecision, 0)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1.5 text-sm text-slate-500">Aguardando volume suficiente.</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Filtro ativo</p>
                    <p className="mt-1.5 text-sm font-black text-white">{MARKET_FILTERS.find((f) => f.id === marketFilter)?.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Confiança: {CONFIDENCE_FILTERS.find((f) => f.id === confidenceFilter)?.label} · Liga: {leagueFilter === 'todas' ? 'Todas' : leagueFilter}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Classificação por liga ── */}
      {leagueRanking.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-[linear-gradient(145deg,rgba(15,23,42,0.94),rgba(2,6,23,0.86))]">
          <div className="flex items-center gap-3 border-b border-slate-800/60 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10">
              <Trophy className="h-4 w-4 text-violet-300" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Classificação por liga</h3>
              <p className="text-xs text-slate-500">Competições com melhor leitura no recorte atual</p>
            </div>
          </div>
          <div className="p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {leagueRanking.map((league, index) => {
                const medal = getMedalMeta(index);
                return (
                  <div key={league.league} className={cn('rounded-2xl border p-4 transition-all hover:-translate-y-0.5', medal.cardClass)}>
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]', medal.badgeClass)}>
                        <Medal className={cn('h-2.5 w-2.5', medal.iconClass)} />
                        {medal.label}
                      </span>
                      <span className="rounded-full border border-slate-700/60 bg-slate-900/60 px-2 py-0.5 text-[10px] font-bold text-slate-400">{league.high} alta</span>
                    </div>
                    <p className="mt-3 text-sm font-black leading-snug text-white">{league.league}</p>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className={cn('text-2xl font-black tabular-nums', medal.accentColor)}>
                        {league.settled > 0 ? formatPercent(league.accuracy, { digits: 0 }) : formatDecimal(league.avgDecision, 0)}
                      </span>
                      <span className="text-xs text-slate-400">{league.settled > 0 ? 'acerto' : 'índice'}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{league.matches} jogos · {league.settled > 0 ? `${league.won}/${league.settled} liquidados` : 'aguardando'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Classificação por horário ── */}
      {hourRanking.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-[linear-gradient(145deg,rgba(15,23,42,0.94),rgba(2,6,23,0.86))]">
          <div className="flex items-center gap-3 border-b border-slate-800/60 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10">
              <Clock3 className="h-4 w-4 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Classificação por horário</h3>
              <p className="text-xs text-slate-500">Faixas com os melhores pitacos em aberto</p>
            </div>
          </div>
          <div className="p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {hourRanking.map((slot, index) => {
                const medal = getMedalMeta(index);
                return (
                  <div key={slot.label} className={cn('rounded-2xl border p-4', medal.cardClass)}>
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]', medal.badgeClass)}>
                        <Medal className={cn('h-2.5 w-2.5', medal.iconClass)} />
                        {medal.label}
                      </span>
                      {slot.live > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                          {slot.live} ao vivo
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-black text-white">{slot.label}</p>
                    <p className={cn('mt-1.5 text-2xl font-black tabular-nums', medal.accentColor)}>{formatPercent(slot.avgProb, { digits: 0 })}</p>
                    <p className="mt-1 text-xs text-slate-400">{slot.matches} jogo(s) · índice médio {formatDecimal(slot.avgDecision, 0)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Top pitacos do dia ── */}
      {topPendingPicks.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-[linear-gradient(145deg,rgba(15,23,42,0.94),rgba(2,6,23,0.86))]">
          <div className="flex items-center gap-3 border-b border-slate-800/60 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10">
              <Zap className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Melhores pitacos do dia</h3>
              <p className="text-xs text-slate-500">Picks com maior probabilidade + suporte do índice da rodada</p>
            </div>
          </div>
          <div className="p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topPendingPicks.map((entry, index) => {
                const medal = getMedalMeta(index);
                const Icon = categoryIcon(entry.pick.category);
                const risk = getPickRisk(entry.pick, entry.item.entry);
                return (
                  <button
                    type="button"
                    key={`${entry.item.entry.match.idEvent}-${entry.pick.category}`}
                    onClick={() => onSelectMatch(entry.item.entry.match)}
                    className={cn('group rounded-3xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl', medal.cardClass)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]', medal.badgeClass)}>
                        <Medal className={cn('h-3 w-3', medal.iconClass)} />
                        {medal.label}
                      </span>
                      <span className={cn('text-xl font-black tabular-nums', medal.accentColor)}>{formatPercent(entry.pick.probability, { digits: 0 })}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300/80">
                      <Icon className="h-3 w-3" />
                      {PICK_CATEGORY_LABELS[entry.pick.category]}
                    </div>
                    <p className="mt-1.5 text-sm font-black text-white leading-snug">{traduzirTextoMercado(entry.pick.label)}</p>
                    <p className="mt-1 text-xs text-slate-300/80">{entry.item.entry.match.strHomeTeam} x {entry.item.entry.match.strAwayTeam}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-slate-700/60 bg-slate-900/60 px-2 py-0.5 text-[10px] font-bold text-slate-400">{formatKickoff(entry.item.entry.match)}</span>
                      <span className="rounded-full border border-blue-500/25 bg-blue-500/8 px-2 py-0.5 text-[10px] font-bold text-blue-300">Índice {entry.item.entry.summary.decisionScore}</span>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-black', confidenceTone(entry.item.entry.confidence))}>{CONFIDENCE_SHORT[entry.item.entry.confidence]}</span>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-black', riskTone(risk))}>{riskLabel(risk)}</span>
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-400">{entry.pick.description}</p>
                    {entry.item.primaryPick && entry.item.conservativePick && (
                      <div className="mt-3 grid gap-1.5">
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-3 py-1.5 text-[11px]">
                          <span className="font-black text-cyan-300">Principal: </span>
                          <span className="text-slate-200">{traduzirTextoMercado(entry.item.primaryPick.label)}</span>
                        </div>
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-[11px]">
                          <span className="font-black text-emerald-300">Conservador: </span>
                          <span className="text-slate-200">{traduzirTextoMercado(entry.item.conservativePick.label)}</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-end gap-1 text-[11px] font-black text-slate-500 group-hover:text-slate-300 transition-colors">
                      Ver análise <ArrowRight className="h-3 w-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Pitacos em aberto ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-[linear-gradient(145deg,rgba(15,23,42,0.94),rgba(2,6,23,0.86))]">
        <div className="flex items-center gap-3 border-b border-slate-800/60 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10">
            <CalendarClock className="h-4 w-4 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Pitacos em aberto</h3>
            <p className="text-xs text-slate-500">Jogos ao vivo ou que ainda vão começar</p>
          </div>
          {activeMatches.length > 0 && (
            <div className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
              {activeMatches.length} jogo{activeMatches.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="p-4">
          {activeMatches.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 px-4 py-10 text-center">
              <p className="text-sm text-slate-500">Nenhum jogo em aberto no filtro atual.</p>
              <p className="mt-1 text-xs text-slate-600">Tente remover algum filtro para ver mais pitacos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeMatches.map((item) => {
                const isLive = item.entry.match.strStatus === 'In Progress';
                return (
                  <div key={item.entry.match.idEvent} className={cn('overflow-hidden rounded-3xl border border-slate-800/80 bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(2,6,23,0.88))]', isLive && 'border-red-900/30')}>
                    <div className={cn('px-5 py-4 border-b border-slate-800/60', isLive && 'bg-red-950/15')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">{item.entry.match.strLeague}</span>
                        {isLive ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-[10px] font-black text-red-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />Ao vivo
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black text-amber-200">Pré-jogo</span>
                        )}
                        <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] font-black', confidenceTone(item.entry.confidence))}>{CONFIDENCE_SHORT[item.entry.confidence]}</span>
                        <span className="rounded-full border border-blue-500/25 bg-blue-500/8 px-2.5 py-0.5 text-[10px] font-black text-blue-300">Índice {item.entry.summary.decisionScore}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="text-base font-black text-white">{item.entry.match.strHomeTeam}</span>
                        {isLive && item.scoreline ? (
                          <span className="rounded-xl border border-red-900/40 bg-red-950/40 px-3 py-1 text-lg font-black tabular-nums text-white">{item.scoreline.home} – {item.scoreline.away}</span>
                        ) : (
                          <span className="text-xs font-black text-slate-600">vs</span>
                        )}
                        <span className="text-base font-black text-white">{item.entry.match.strAwayTeam}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatKickoff(item.entry.match)} · {traduzirTextoMercado(item.entry.summary.bestAngle)}</p>
                    </div>
                    {(item.primaryPick || item.conservativePick) && (
                      <div className="grid gap-px border-b border-slate-800/60 md:grid-cols-2">
                        {item.primaryPick && (
                          <div className="bg-cyan-500/5 px-5 py-3 md:border-r md:border-slate-800/40">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">⚡ Principal</p>
                            <p className="mt-1.5 text-sm font-black text-white">{traduzirTextoMercado(item.primaryPick.label)}</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-base font-black text-cyan-300">{formatPercent(item.primaryPick.probability, { digits: 0 })}</span>
                              <ResultBadge status={item.primaryPick.status} />
                            </div>
                          </div>
                        )}
                        {item.conservativePick && (
                          <div className="bg-emerald-500/5 px-5 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">🛡 Conservador</p>
                            <p className="mt-1.5 text-sm font-black text-white">{traduzirTextoMercado(item.conservativePick.label)}</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-base font-black text-emerald-300">{formatPercent(item.conservativePick.probability, { digits: 0 })}</span>
                              <ResultBadge status={item.conservativePick.status} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-4">
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {item.picks.map((pick) => {
                          const Icon = categoryIcon(pick.category);
                          const risk = getPickRisk(pick, item.entry);
                          return (
                            <div key={pick.category} className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]', categoryTone(pick.category))}>
                                  <Icon className="h-2.5 w-2.5" />
                                  {PICK_CATEGORY_LABELS[pick.category]}
                                </div>
                                <span className="text-sm font-black tabular-nums text-white">{formatPercent(pick.probability, { digits: 0 })}</span>
                              </div>
                              <p className="mt-2 text-xs font-black leading-snug text-white">{traduzirTextoMercado(pick.label)}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase', riskTone(risk))}>
                                  {risk === 'baixo' ? 'Baixo' : risk === 'medio' ? 'Médio' : 'Alto'}
                                </span>
                                <ResultBadge status={pick.status} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => onSelectMatch(item.entry.match)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/8 px-3 py-1.5 text-[11px] font-black text-blue-300 transition-all hover:bg-blue-500/15"
                        >
                          Ver análise completa <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Resultados e acertos ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-[linear-gradient(145deg,rgba(15,23,42,0.94),rgba(2,6,23,0.86))]">
        <div className="flex items-center gap-3 border-b border-slate-800/60 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Resultados e acertos</h3>
            <p className="text-xs text-slate-500">Jogos encerrados — veja o que bateu e o que ficou fora</p>
          </div>
          {finishedMatches.length > 0 && (
            <div className="ml-auto rounded-full border border-slate-600/40 bg-slate-800/50 px-3 py-1 text-xs font-black text-slate-400">
              {finishedMatches.length} encerrado{finishedMatches.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="p-4">
          {topResolvedPicks.length > 0 && (
            <div className="mb-5">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Destaques liquidados</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {topResolvedPicks.map((entry, index) => {
                  const medal = getMedalMeta(index);
                  const Icon = categoryIcon(entry.pick.category);
                  return (
                    <button
                      key={`resolved-${entry.item.entry.match.idEvent}-${entry.pick.category}`}
                      type="button"
                      onClick={() => onSelectMatch(entry.item.entry.match)}
                      className={cn('rounded-3xl border p-4 text-left transition-all hover:-translate-y-0.5', medal.cardClass)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]', medal.badgeClass)}>
                          <Medal className={cn('h-2.5 w-2.5', medal.iconClass)} />
                          {medal.label}
                        </span>
                        <ResultBadge status={entry.pick.status} />
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300/80">
                        <Icon className="h-3 w-3" />
                        {PICK_CATEGORY_LABELS[entry.pick.category]}
                      </div>
                      <p className="mt-1.5 text-sm font-black text-white">{traduzirTextoMercado(entry.pick.label)}</p>
                      <p className="mt-0.5 text-xs text-slate-300/80">{entry.item.entry.match.strHomeTeam} x {entry.item.entry.match.strAwayTeam}</p>
                      <p className="mt-2 text-xs text-slate-500">Prob. pré-jogo: {formatPercent(entry.pick.probability, { digits: 0 })}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {finishedMatches.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 px-4 py-10 text-center">
              <p className="text-sm text-slate-500">Nenhum jogo encerrado no filtro atual.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {finishedMatches.map((item) => (
                <div key={item.entry.match.idEvent} className="overflow-hidden rounded-3xl border border-slate-800/80 bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(2,6,23,0.88))]">
                  <div className="px-5 py-4 border-b border-slate-800/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">{item.entry.match.strLeague}</span>
                      <span className="rounded-full border border-slate-600/40 bg-slate-800/60 px-2.5 py-0.5 text-[10px] font-black text-slate-400">Encerrado</span>
                      <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] font-black', confidenceTone(item.entry.confidence))}>{CONFIDENCE_SHORT[item.entry.confidence]}</span>
                      {item.settledCount > 0 && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                          {item.wonCount}/{item.settledCount} acertos
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="text-base font-black text-white">{item.entry.match.strHomeTeam}</span>
                      {item.scoreline && (
                        <span className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-3 py-1 text-lg font-black tabular-nums text-white">{item.scoreline.home} – {item.scoreline.away}</span>
                      )}
                      <span className="text-base font-black text-white">{item.entry.match.strAwayTeam}</span>
                    </div>
                  </div>
                  {(item.primaryPick || item.conservativePick) && (
                    <div className="grid gap-px border-b border-slate-800/60 md:grid-cols-2">
                      {item.primaryPick && (
                        <div className="bg-cyan-500/5 px-5 py-3 md:border-r md:border-slate-800/40">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Principal</p>
                          <p className="mt-1 text-sm font-black text-white">{traduzirTextoMercado(item.primaryPick.label)}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-sm font-black text-cyan-300">{formatPercent(item.primaryPick.probability, { digits: 0 })}</span>
                            <ResultBadge status={item.primaryPick.status} />
                          </div>
                        </div>
                      )}
                      {item.conservativePick && (
                        <div className="bg-emerald-500/5 px-5 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Conservador</p>
                          <p className="mt-1 text-sm font-black text-white">{traduzirTextoMercado(item.conservativePick.label)}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-sm font-black text-emerald-300">{formatPercent(item.conservativePick.probability, { digits: 0 })}</span>
                            <ResultBadge status={item.conservativePick.status} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-4">
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {item.picks.map((pick) => {
                        const Icon = categoryIcon(pick.category);
                        const risk = getPickRisk(pick, item.entry);
                        return (
                          <div key={pick.category} className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]', categoryTone(pick.category))}>
                                <Icon className="h-2.5 w-2.5" />
                                {PICK_CATEGORY_LABELS[pick.category]}
                              </div>
                              <span className="text-sm font-black tabular-nums text-white">{formatPercent(pick.probability, { digits: 0 })}</span>
                            </div>
                            <p className="mt-2 text-xs font-black leading-snug text-white">{traduzirTextoMercado(pick.label)}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <ResultBadge status={pick.status} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onSelectMatch(item.entry.match)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-1.5 text-[11px] font-black text-slate-300 transition-all hover:bg-slate-800/80"
                      >
                        Ver análise <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
