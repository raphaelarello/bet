// Rapha Guru — Match Comparison Component v1.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Compara dois jogos lado a lado com probabilidades e tips

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Match, MatchAnalysis } from '@/lib/types';
import { X, ArrowLeftRight, TrendingUp, Target, Flag, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MatchComparisonProps {
  matchA: Match;
  matchB: Match;
  analysisA: MatchAnalysis | null;
  analysisB: MatchAnalysis | null;
  onClose: () => void;
}

interface ComparisonMetric {
  label: string;
  valueA: string | number;
  valueB: string | number;
  higherIsBetter?: boolean;
  format?: 'percent' | 'number' | 'text';
}

function MetricRow({ label, valueA, valueB, higherIsBetter = true, format = 'number' }: ComparisonMetric) {
  const numA = typeof valueA === 'number' ? valueA : parseFloat(String(valueA));
  const numB = typeof valueB === 'number' ? valueB : parseFloat(String(valueB));
  const isValid = !isNaN(numA) && !isNaN(numB);

  const aBetter = isValid && (higherIsBetter ? numA > numB : numA < numB);
  const bBetter = isValid && (higherIsBetter ? numB > numA : numB < numA);

  const formatVal = (v: string | number) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (isNaN(n)) return String(v);
    if (format === 'percent') return `${n.toFixed(1)}%`;
    if (format === 'number') return n.toFixed(2);
    return String(v);
  };

  return (
    <div className="grid grid-cols-3 items-center gap-2 py-2 border-b border-slate-700/30">
      <div className={cn(
        'text-right text-sm font-semibold transition-colors',
        aBetter ? 'text-emerald-400' : bBetter ? 'text-slate-400' : 'text-slate-300'
      )}>
        {formatVal(valueA)}
        {aBetter && <span className="ml-1 text-xs">✓</span>}
      </div>
      <div className="text-center text-xs text-slate-500 font-medium">{label}</div>
      <div className={cn(
        'text-left text-sm font-semibold transition-colors',
        bBetter ? 'text-emerald-400' : aBetter ? 'text-slate-400' : 'text-slate-300'
      )}>
        {bBetter && <span className="mr-1 text-xs">✓</span>}
        {formatVal(valueB)}
      </div>
    </div>
  );
}

function TipBadge({ label, confidence }: { label: string; confidence: number }) {
  const level = confidence >= 75 ? 'high' : confidence >= 60 ? 'medium' : 'low';
  return (
    <span className={cn(
      'text-xs px-2 py-1 rounded-lg border font-medium',
      level === 'high' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
      level === 'medium' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
      'bg-slate-700/50 border-slate-600/50 text-slate-400'
    )}>
      {label} <span className="opacity-60">{confidence.toFixed(0)}%</span>
    </span>
  );
}

export function MatchComparison({ matchA, matchB, analysisA, analysisB, onClose }: MatchComparisonProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'goals' | 'corners' | 'cards'>('overview');

  const predA = analysisA?.predictions;
  const predB = analysisB?.predictions;

  const sections = [
    { id: 'overview' as const, label: 'Visão Geral', icon: ArrowLeftRight },
    { id: 'goals' as const, label: 'Gols', icon: Target },
    { id: 'corners' as const, label: 'Escanteios', icon: Flag },
    { id: 'cards' as const, label: 'Cartões', icon: Zap },
  ];

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-slate-200">Comparação de Jogos</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-500 hover:text-slate-200"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Match Headers */}
      <div className="grid grid-cols-2 gap-px bg-slate-700/30">
        {[{ match: matchA, analysis: analysisA }, { match: matchB, analysis: analysisB }].map(({ match, analysis }, i) => (
          <div key={i} className="bg-slate-800/40 p-3 text-center">
            <div className="text-xs text-slate-500 mb-1 truncate">{match.strLeague}</div>
            <div className="text-xs font-bold text-slate-200 leading-tight">
              <span className="text-slate-300">{match.strHomeTeam}</span>
              <span className="text-slate-600 mx-1">vs</span>
              <span className="text-slate-300">{match.strAwayTeam}</span>
            </div>
            {match.strStatus === 'In Progress' && (
              <div className="mt-1 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-xs text-red-400 font-bold">
                  {match.intHomeScore}–{match.intAwayScore} • {match.liveDisplayClock}
                </span>
              </div>
            )}
            {analysis && (
              <div className="mt-1.5 flex items-center justify-center gap-2 text-xs">
                <span className="text-blue-400 font-bold">{analysis.predictions.homeWinProb.toFixed(0)}%</span>
                <span className="text-slate-500">Emp {analysis.predictions.drawProb.toFixed(0)}%</span>
                <span className="text-amber-400 font-bold">{analysis.predictions.awayWinProb.toFixed(0)}%</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Section Tabs */}
      <div className="flex border-b border-slate-700/50">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all',
              activeSection === id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Column headers */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="text-right text-xs font-bold text-slate-400 truncate">
            {matchA.strHomeTeam.split(' ')[0]}
          </div>
          <div className="text-center text-xs text-slate-600">Métrica</div>
          <div className="text-left text-xs font-bold text-slate-400 truncate">
            {matchB.strHomeTeam.split(' ')[0]}
          </div>
        </div>

        {activeSection === 'overview' && predA && predB && (
          <div>
            <MetricRow label="Vitória Casa" valueA={predA.homeWinProb} valueB={predB.homeWinProb} format="percent" />
            <MetricRow label="Empate" valueA={predA.drawProb} valueB={predB.drawProb} format="percent" higherIsBetter={false} />
            <MetricRow label="Vitória Fora" valueA={predA.awayWinProb} valueB={predB.awayWinProb} format="percent" />
            <MetricRow label="Ambas marcam" valueA={predA.bttsYesProb} valueB={predB.bttsYesProb} format="percent" />
            <MetricRow label="Mais de 2,5" valueA={predA.over25Prob} valueB={predB.over25Prob} format="percent" />
            <MetricRow label="xG Total" valueA={predA.expectedTotalGoals} valueB={predB.expectedTotalGoals} format="number" />
          </div>
        )}

        {activeSection === 'goals' && predA && predB && (
          <div>
            <MetricRow label="xG Casa" valueA={predA.expectedGoalsHome} valueB={predB.expectedGoalsHome} format="number" />
            <MetricRow label="xG Fora" valueA={predA.expectedGoalsAway} valueB={predB.expectedGoalsAway} format="number" />
            <MetricRow label="Mais de 1,5" valueA={predA.over15Prob} valueB={predB.over15Prob} format="percent" />
            <MetricRow label="Mais de 2,5" valueA={predA.over25Prob} valueB={predB.over25Prob} format="percent" />
            <MetricRow label="Mais de 3,5" valueA={predA.over35Prob} valueB={predB.over35Prob} format="percent" />
            <MetricRow label="Ambas marcam" valueA={predA.bttsYesProb} valueB={predB.bttsYesProb} format="percent" />
            <MetricRow label="1º Tempo Gol" valueA={predA.firstHalfGoalProb} valueB={predB.firstHalfGoalProb} format="percent" />
          </div>
        )}

        {activeSection === 'corners' && predA && predB && (
          <div>
            <MetricRow label="Total Esp." valueA={predA.expectedCorners} valueB={predB.expectedCorners} format="number" />
            <MetricRow label="Mais de 6,5" valueA={predA.over65CornersProb} valueB={predB.over65CornersProb} format="percent" />
            <MetricRow label="Mais de 8,5" valueA={predA.over85CornersProb} valueB={predB.over85CornersProb} format="percent" />
            <MetricRow label="Mais de 10,5" valueA={predA.over105CornersProb} valueB={predB.over105CornersProb} format="percent" />
            <MetricRow label="Menos de 8,5" valueA={predA.under85CornersProb} valueB={predB.under85CornersProb} format="percent" />
          </div>
        )}

        {activeSection === 'cards' && predA && predB && (
          <div>
            <MetricRow label="Total Esp." valueA={predA.expectedCards} valueB={predB.expectedCards} format="number" />
            <MetricRow label="Amarelos" valueA={predA.expectedYellowCards} valueB={predB.expectedYellowCards} format="number" />
            <MetricRow label="Vermelhos" valueA={predA.expectedRedCards} valueB={predB.expectedRedCards} format="number" />
            <MetricRow label="Mais de 2,5" valueA={predA.over25CardsProb} valueB={predB.over25CardsProb} format="percent" />
            <MetricRow label="Mais de 3,5" valueA={predA.over35CardsProb} valueB={predB.over35CardsProb} format="percent" />
            <MetricRow label="Ambos Levam" valueA={predA.bothTeamsCardProb} valueB={predB.bothTeamsCardProb} format="percent" />
          </div>
        )}

        {(!predA || !predB) && (
          <div className="text-center py-8 text-slate-500 text-sm">
            {!predA && !predB
              ? 'Clique em dois jogos para comparar'
              : !predA
                ? 'Aguardando análise do Jogo A...'
                : 'Aguardando análise do Jogo B...'}
          </div>
        )}

        {/* Top Tips Comparison */}
        {predA && predB && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[{ pred: predA, match: matchA }, { pred: predB, match: matchB }].map(({ pred, match }, i) => (
              <div key={i} className="bg-slate-800/40 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-2 font-medium truncate">
                  {match.strHomeTeam.split(' ')[0]} vs {match.strAwayTeam.split(' ')[0]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pred.over25Prob > 60 && <TipBadge label="Mais de 2,5" confidence={pred.over25Prob} />}
                  {pred.bttsYesProb > 60 && <TipBadge label="Ambas marcam" confidence={pred.bttsYesProb} />}
                  {pred.over85CornersProb > 65 && <TipBadge label="Esc. +8.5" confidence={pred.over85CornersProb} />}
                  {pred.over25CardsProb > 65 && <TipBadge label="Cart. +2.5" confidence={pred.over25CardsProb} />}
                  {pred.homeWinProb > 65 && <TipBadge label={`${match.strHomeTeam.split(' ')[0]} Vence`} confidence={pred.homeWinProb} />}
                  {pred.awayWinProb > 65 && <TipBadge label={`${match.strAwayTeam.split(' ')[0]} Vence`} confidence={pred.awayWinProb} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Value indicator */}
      {predA && predB && (
        <div className="px-4 pb-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-blue-400">Dica:</span> Os valores em{' '}
              <span className="text-emerald-400">verde</span> indicam qual jogo tem a métrica mais favorável.
              Use para decidir qual jogo tem mais valor para apostar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
