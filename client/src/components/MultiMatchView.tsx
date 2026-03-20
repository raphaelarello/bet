// Rapha Guru — Multi Match View v1.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Modo de visualização de 2 ou 4 jogos simultâneos em painéis lado a lado
// Cada painel tem análise completa independente com dados ao vivo

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useMatchAnalysis } from '@/hooks/useMatchAnalysis';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { Match } from '@/lib/types';
import {
  X, Zap, Activity, TrendingUp, Flag, CreditCard, Target,
  LayoutGrid, Columns2, Plus, RefreshCw, Maximize2
} from 'lucide-react';

// ============================================================
// MINI ANÁLISE CARD — exibe resumo de um jogo no painel multi
// ============================================================

interface MiniAnalysisPanelProps {
  match: Match;
  slotIndex: number;
  onRemove: () => void;
  onExpand: () => void;
}

function MiniAnalysisPanel({ match, slotIndex, onRemove, onExpand }: MiniAnalysisPanelProps) {
  const { analysis, loading, analyzeMatch } = useMatchAnalysis();
  const isLive = match.strStatus === 'Match Finished' ? false :
    ['1H', '2H', 'HT', 'ET', 'PEN', 'Live'].includes(match.strStatus || '');

  const { liveData } = useLiveMatch(
    match.idEvent || null,
    isLive
  );

  // Inicia análise automaticamente
  useState(() => {
    if (match.idEvent) {
      analyzeMatch(match);
    }
  });

  const slotColors = [
    { border: 'border-blue-500/40', header: 'bg-blue-500/10', accent: 'text-blue-400' },
    { border: 'border-emerald-500/40', header: 'bg-emerald-500/10', accent: 'text-emerald-400' },
    { border: 'border-amber-500/40', header: 'bg-amber-500/10', accent: 'text-amber-400' },
    { border: 'border-purple-500/40', header: 'bg-purple-500/10', accent: 'text-purple-400' },
  ];
  const colors = slotColors[slotIndex % 4];

  const homeScore = liveData?.homeScore ?? match.intHomeScore ?? null;
  const awayScore = liveData?.awayScore ?? match.intAwayScore ?? null;
  const minute = liveData?.clock ?? null;

  const preds = analysis?.predictions;
  // Aliases para campos com nomes diferentes
  const homeWin = preds ? Math.round(preds.homeWinProb) : 0;
  const draw = preds ? Math.round(preds.drawProb) : 0;
  const awayWin = preds ? Math.round(preds.awayWinProb) : 0;
  const over25 = preds ? Math.round(preds.over25Prob) : 0;
  const btts = preds ? Math.round(preds.bttsYesProb) : 0;
  const over95Corners = preds ? Math.round(preds.over95CornersProb) : 0;
  const over35Cards = preds ? Math.round(preds.over35CardsProb) : 0;

  return (
    <div className={cn(
      'flex flex-col h-full rounded-2xl border bg-[#0d1117] overflow-hidden',
      colors.border
    )}>
      {/* Header do painel */}
      <div className={cn('flex items-center justify-between px-3 py-2 border-b border-slate-700/30', colors.header)}>
        <div className="flex items-center gap-1.5 min-w-0">
          {isLive && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          )}
          <span className={cn('text-xs font-bold truncate', colors.accent)}>
            {match.strLeague}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onExpand}
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
            title="Expandir análise completa"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={onRemove}
            className="text-slate-500 hover:text-red-400 transition-colors p-0.5"
            title="Remover painel"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Placar */}
      <div className="px-3 py-3 border-b border-slate-700/20">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300 truncate flex-1 text-right">
            {match.strHomeTeam}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {homeScore != null && awayScore != null ? (
              <div className="flex items-center gap-1">
                <span className="text-lg font-black text-white tabular-nums">{homeScore}</span>
                <span className="text-slate-600 font-bold">–</span>
                <span className="text-lg font-black text-white tabular-nums">{awayScore}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">
                {match.strTime ? match.strTime.slice(0, 5) : 'vs'}
              </span>
            )}
            {minute && (
              <span className="text-xs text-red-400 font-bold">{minute}'</span>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-300 truncate flex-1 text-left">
            {match.strAwayTeam}
          </span>
        </div>
      </div>

      {/* Conteúdo da análise */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-blue-500/50 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : preds ? (
          <>
            {/* Probabilidades de resultado */}
            <div className="space-y-1">
              <p className="text-xs text-slate-600 font-medium uppercase tracking-wider">Resultado</p>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: '1', value: homeWin, color: 'bg-blue-500' },
                  { label: 'X', value: draw, color: 'bg-slate-500' },
                  { label: '2', value: awayWin, color: 'bg-red-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-800/50 rounded-lg p-1.5 text-center">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="text-sm font-black text-slate-200">{value}%</div>
                    <div className={cn('h-1 rounded-full mt-1 opacity-60', color)}
                      style={{ width: `${value}%`, maxWidth: '100%' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Métricas rápidas */}
            <div className="grid grid-cols-2 gap-1">
              {[
                {
                  icon: TrendingUp,
                  label: 'Mais de 2,5',
                  value: `${over25}%`,
                  color: over25 >= 60 ? 'text-emerald-400' : 'text-slate-400',
                },
                {
                  icon: Zap,
                  label: 'Ambas marcam',
                  value: `${btts}%`,
                  color: btts >= 55 ? 'text-amber-400' : 'text-slate-400',
                },
                {
                  icon: Flag,
                  label: 'Esc. +9.5',
                  value: `${over95Corners}%`,
                  color: 'text-slate-400',
                },
                {
                  icon: CreditCard,
                  label: 'Cart. +3.5',
                  value: `${over35Cards}%`,
                  color: 'text-slate-400',
                },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-slate-800/30 rounded-lg p-2 flex items-center gap-1.5">
                  <Icon className={cn('w-3 h-3 flex-shrink-0', color)} />
                  <div className="min-w-0">
                    <div className="text-xs text-slate-600 truncate">{label}</div>
                    <div className={cn('text-xs font-bold', color)}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Placar mais provável */}
            {analysis?.scorePredictions && analysis.scorePredictions.length > 0 && (
              <div className="bg-slate-800/30 rounded-lg p-2">
                <p className="text-xs text-slate-600 mb-1">Placar provável</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">
                    {analysis.scorePredictions[0].homeGoals}–{analysis.scorePredictions[0].awayGoals}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({analysis.scorePredictions[0].probability}%)
                  </span>
                </div>
              </div>
            )}

            {/* Live stats */}
                {liveData && (
              <div className="bg-slate-800/30 rounded-lg p-2 space-y-1">
                <p className="text-xs text-slate-600 mb-1">Ao Vivo</p>
                {[
                  { label: 'Posse', home: liveData.homeStats.possession, away: liveData.awayStats.possession, suffix: '%' },
                  { label: 'Chutes', home: liveData.homeStats.shots, away: liveData.awayStats.shots, suffix: '' },
                  { label: 'Esc.', home: liveData.homeStats.corners, away: liveData.awayStats.corners, suffix: '' },
                ].map(({ label, home, away, suffix }) => (
                  <div key={label} className="flex items-center gap-1 text-xs">
                    <span className="text-blue-400 font-bold w-6 text-right">{home}{suffix}</span>
                    <span className="flex-1 text-center text-slate-600">{label}</span>
                    <span className="text-red-400 font-bold w-6">{away}{suffix}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Target className="w-6 h-6 text-slate-600" />
            <p className="text-xs text-slate-500 text-center">Analisando...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SLOT VAZIO — para adicionar um jogo
// ============================================================

interface EmptySlotProps {
  slotIndex: number;
  onAddMatch: (slotIndex: number) => void;
}

function EmptySlot({ slotIndex, onAddMatch }: EmptySlotProps) {
  const slotColors = [
    'border-blue-500/20 hover:border-blue-500/40',
    'border-emerald-500/20 hover:border-emerald-500/40',
    'border-amber-500/20 hover:border-amber-500/40',
    'border-purple-500/20 hover:border-purple-500/40',
  ];

  return (
    <button
      onClick={() => onAddMatch(slotIndex)}
      className={cn(
        'flex flex-col items-center justify-center h-full rounded-2xl border-2 border-dashed',
        'bg-slate-800/20 transition-all group',
        slotColors[slotIndex % 4]
      )}
    >
      <Plus className="w-8 h-8 text-slate-600 group-hover:text-slate-400 transition-colors mb-2" />
      <p className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">
        Adicionar Jogo
      </p>
      <p className="text-xs text-slate-700 mt-0.5">Painel {slotIndex + 1}</p>
    </button>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

type LayoutMode = '2' | '4';

interface MultiMatchViewProps {
  availableMatches: Match[];
  onExpandMatch: (match: Match) => void;
  onClose: () => void;
}

export function MultiMatchView({ availableMatches, onExpandMatch, onClose }: MultiMatchViewProps) {
  const [layout, setLayout] = useState<LayoutMode>('2');
  const [slots, setSlots] = useState<(Match | null)[]>([null, null, null, null]);
  const [selectingSlot, setSelectingSlot] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const slotCount = layout === '2' ? 2 : 4;

  const handleAddMatch = useCallback((slotIndex: number) => {
    setSelectingSlot(slotIndex);
    setSearchQuery('');
  }, []);

  const handleSelectMatch = useCallback((match: Match) => {
    if (selectingSlot === null) return;
    setSlots(prev => {
      const updated = [...prev];
      updated[selectingSlot] = match;
      return updated;
    });
    setSelectingSlot(null);
  }, [selectingSlot]);

  const handleRemoveSlot = useCallback((slotIndex: number) => {
    setSlots(prev => {
      const updated = [...prev];
      updated[slotIndex] = null;
      return updated;
    });
  }, []);

  const filteredMatches = availableMatches.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.strHomeTeam.toLowerCase().includes(q) ||
      m.strAwayTeam.toLowerCase().includes(q) ||
      m.strLeague.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-2xl border border-slate-700/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30 bg-slate-800/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-slate-200">Multi-Jogo</span>
          </div>
          {/* Layout switcher */}
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-0.5">
            <button
              onClick={() => setLayout('2')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                layout === '2' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Columns2 className="w-3 h-3" />
              2 Jogos
            </button>
            <button
              onClick={() => setLayout('4')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                layout === '4' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <LayoutGrid className="w-3 h-3" />
              4 Jogos
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Seletor de jogo (quando selectingSlot !== null) */}
      {selectingSlot !== null && (
        <div className="flex-shrink-0 border-b border-slate-700/30 bg-slate-800/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400">
              Selecionar jogo para Painel {selectingSlot + 1}
            </p>
            <button
              onClick={() => setSelectingSlot(null)}
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              Cancelarar
            </button>
          </div>
          <input
            type="text"
            placeholder="Buscar time ou liga..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredMatches.slice(0, 20).map(m => {
              const isLive = ['1H', '2H', 'HT', 'ET', 'PEN', 'Live'].includes(m.strStatus || '');
              return (
                <button
                  key={m.idEvent}
                  onClick={() => handleSelectMatch(m)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-700/50 text-left transition-all"
                >
                  {isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                  <span className="text-xs text-slate-300 truncate flex-1">
                    {m.strHomeTeam} vs {m.strAwayTeam}
                  </span>
                  <span className="text-xs text-slate-600 flex-shrink-0">{m.strLeague}</span>
                </button>
              );
            })}
            {filteredMatches.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-3">Nenhum jogo encontrado</p>
            )}
          </div>
        </div>
      )}

      {/* Grid de painéis */}
      <div className={cn(
        'flex-1 p-3 gap-3 min-h-0',
        layout === '2' ? 'grid grid-cols-2' : 'grid grid-cols-2 grid-rows-2'
      )}>
        {Array.from({ length: slotCount }).map((_, i) => {
          const match = slots[i];
          if (match) {
            return (
              <MiniAnalysisPanel
                key={`${match.idEvent}-${i}`}
                match={match}
                slotIndex={i}
                onRemove={() => handleRemoveSlot(i)}
                onExpand={() => onExpandMatch(match)}
              />
            );
          }
          return (
            <EmptySlot
              key={`empty-${i}`}
              slotIndex={i}
              onAddMatch={handleAddMatch}
            />
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-slate-700/20 flex items-center justify-between">
        <p className="text-xs text-slate-600">
          {slots.filter(Boolean).length} de {slotCount} painéis ativos
        </p>
        <button
          onClick={() => setSlots([null, null, null, null])}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Limpar tudo
        </button>
      </div>
    </div>
  );
}
