// Rapha Guru — Odds Comparison Panel v1.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Compara odds ao vivo (ESPN/DraftKings) com probabilidades calculadas pelo modelo
// Detecta value bets quando há divergência entre odd implícita e probabilidade real

import React, { useMemo } from 'react';
import { cn, traduzirFonteMercado, traduzirTextoMercado } from '@/lib/utils';
import type { MatchOdds } from '@/hooks/useMatchPlayers';
import type { MatchAnalysis } from '@/lib/types';
import { DollarSign, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle } from 'lucide-react';

// ============================================================
// HELPERS
// ============================================================

// Converte moneyline americano para odd decimal
function mlToDecimal(ml: number): number {
  if (ml > 0) return ml / 100 + 1;
  return 100 / Math.abs(ml) + 1;
}

// Converte odd decimal para probabilidade implícita (%)
function decimalToImpliedProb(decimal: number): number {
  if (decimal <= 1) return 0;
  return Math.round((1 / decimal) * 100);
}

// Calcula edge (vantagem) em % entre prob real e implícita
function calcEdge(realProb: number, impliedProb: number): number {
  return Math.round(realProb - impliedProb);
}

// Classifica o edge
function classifyEdge(edge: number): 'strong_value' | 'value' | 'fair' | 'overpriced' {
  if (edge >= 10) return 'strong_value';
  if (edge >= 5) return 'value';
  if (edge >= -5) return 'fair';
  return 'overpriced';
}

// ============================================================
// COMPONENTE DE LINHA DE ODD
// ============================================================

interface OddRowProps {
  label: string;
  icon: string;
  decimal: number | null;
  impliedProb: number | null;
  modelProb: number | null;
  isLive?: boolean;
}

function OddRow({ label, icon, decimal, impliedProb, modelProb, isLive }: OddRowProps) {
  if (!decimal || !impliedProb) return null;

  const edge = modelProb != null ? calcEdge(modelProb, impliedProb) : null;
  const classification = edge != null ? classifyEdge(edge) : null;

  const edgeColor = {
    strong_value: 'text-emerald-400',
    value: 'text-green-400',
    fair: 'text-slate-500',
    overpriced: 'text-red-400',
  };

  const edgeBg = {
    strong_value: 'bg-emerald-500/15 border-emerald-500/30',
    value: 'bg-green-500/10 border-green-500/20',
    fair: 'bg-slate-700/30 border-slate-600/20',
    overpriced: 'bg-red-500/10 border-red-500/20',
  };

  const edgeLabel = {
    strong_value: '🔥 Valor forte',
    value: '✅ Valor',
    fair: 'Justo',
    overpriced: '❌ Caro',
  };

  return (
    <div className={cn(
      'rounded-xl border p-3 transition-all',
      classification ? edgeBg[classification] : 'bg-slate-800/30 border-slate-700/30'
    )}>
      <div className="flex items-center justify-between gap-3">
        {/* Mercado */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-base">{icon}</span>
          <div>
            <div className="text-xs font-semibold text-slate-300">{label}</div>
            {isLive && <div className="text-xs text-red-400">Ao Vivo</div>}
          </div>
        </div>

        {/* Odd decimal */}
        <div className="text-center">
          <div className="text-xs text-slate-600 mb-0.5">Odd</div>
          <div className="text-lg font-black font-mono text-slate-200">{decimal.toFixed(2)}</div>
        </div>

        {/* Prob implícita */}
        <div className="text-center">
          <div className="text-xs text-slate-600 mb-0.5">Implícita</div>
          <div className="text-sm font-bold font-mono text-slate-400">{impliedProb}%</div>
        </div>

        {/* Prob do modelo */}
        {modelProb != null && (
          <div className="text-center">
            <div className="text-xs text-slate-600 mb-0.5">Modelo</div>
            <div className={cn(
              'text-sm font-bold font-mono',
              classification ? edgeColor[classification] : 'text-slate-400'
            )}>
              {modelProb}%
            </div>
          </div>
        )}

        {/* Edge */}
        {edge != null && classification && (
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-slate-600 mb-0.5">Vantagem</div>
            <div className={cn('text-sm font-black font-mono', edgeColor[classification])}>
              {edge > 0 ? '+' : ''}{edge}%
            </div>
          </div>
        )}
      </div>

      {/* Badge de classificação */}
      {classification && classification !== 'fair' && (
        <div className="mt-2 flex items-center gap-1">
          {classification === 'strong_value' || classification === 'value' ? (
            <CheckCircle className="w-3 h-3 text-emerald-400" />
          ) : (
            <AlertCircle className="w-3 h-3 text-red-400" />
          )}
          <span className={cn('text-xs font-semibold', edgeColor[classification])}>
            {edgeLabel[classification]}
          </span>
          {(classification === 'strong_value' || classification === 'value') && (
            <span className="text-xs text-slate-500 ml-1">
              — modelo estima {modelProb}% contra {impliedProb}% implícito
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

interface OddsComparisonPanelProps {
  odds: MatchOdds;
  analysis: MatchAnalysis;
  isLive?: boolean;
}

export function OddsComparisonPanel({ odds, analysis, isLive }: OddsComparisonPanelProps) {
  const { predictions, match } = analysis;

  const processedOdds = useMemo(() => {
    const homeDecimal = odds.homeMoneyline != null ? mlToDecimal(odds.homeMoneyline) : null;
    const awayDecimal = odds.awayMoneyline != null ? mlToDecimal(odds.awayMoneyline) : null;
    const drawDecimal = odds.drawMoneyline != null ? mlToDecimal(odds.drawMoneyline) : null;

    const homeImplied = homeDecimal ? decimalToImpliedProb(homeDecimal) : null;
    const awayImplied = awayDecimal ? decimalToImpliedProb(awayDecimal) : null;
    const drawImplied = drawDecimal ? decimalToImpliedProb(drawDecimal) : null;

    // Normalizar probs do modelo (somam 100%)
    const totalModel = predictions.homeWinProb + predictions.drawProb + predictions.awayWinProb;
    const normHome = totalModel > 0 ? Math.round((predictions.homeWinProb / totalModel) * 100) : null;
    const normDraw = totalModel > 0 ? Math.round((predictions.drawProb / totalModel) * 100) : null;
    const normAway = totalModel > 0 ? Math.round((predictions.awayWinProb / totalModel) * 100) : null;

    // Over/Under
    const overDecimal = odds.overOdds != null ? mlToDecimal(odds.overOdds) : null;
    const underDecimal = odds.underOdds != null ? mlToDecimal(odds.underOdds) : null;
    const overImplied = overDecimal ? decimalToImpliedProb(overDecimal) : null;
    const underImplied = underDecimal ? decimalToImpliedProb(underDecimal) : null;

    // Probabilidade do modelo para a linha disponível
    const line = odds.overUnder ?? 2.5;
    const modelOverMap: Record<string, number> = {
      '0.5': predictions.over05Prob,
      '1.5': predictions.over15Prob,
      '2.5': predictions.over25Prob,
      '3.5': predictions.over35Prob,
      '4.5': predictions.over45Prob,
    };
    const modelUnderMap: Record<string, number> = {
      '1.5': predictions.under15Prob,
      '2.5': predictions.under25Prob,
      '3.5': predictions.under35Prob,
    };
    const modelOver25 = Math.round(modelOverMap[line.toFixed(1)] ?? predictions.over25Prob);
    const modelUnder25 = Math.round(modelUnderMap[line.toFixed(1)] ?? (100 - modelOver25));

    return {
      homeDecimal, awayDecimal, drawDecimal,
      homeImplied, awayImplied, drawImplied,
      normHome, normDraw, normAway,
      overDecimal, underDecimal,
      overImplied, underImplied,
      modelOver25, modelUnder25,
    };
  }, [odds, predictions]);

  // Contar value bets
  const valueBets = useMemo(() => {
    const bets = [];
    if (processedOdds.normHome != null && processedOdds.homeImplied != null) {
      const edge = calcEdge(processedOdds.normHome, processedOdds.homeImplied);
      if (edge >= 5) bets.push(`${match.strHomeTeam} vence`);
    }
    if (processedOdds.normDraw != null && processedOdds.drawImplied != null) {
      const edge = calcEdge(processedOdds.normDraw, processedOdds.drawImplied);
      if (edge >= 5) bets.push('Empate');
    }
    if (processedOdds.normAway != null && processedOdds.awayImplied != null) {
      const edge = calcEdge(processedOdds.normAway, processedOdds.awayImplied);
      if (edge >= 5) bets.push(`${match.strAwayTeam} vence`);
    }
    if (processedOdds.modelOver25 != null && processedOdds.overImplied != null) {
      const edge = calcEdge(processedOdds.modelOver25, processedOdds.overImplied);
      if (edge >= 5) bets.push(`Mais de ${odds.overUnder ?? 2.5}`);
    }
    return bets;
  }, [processedOdds, match, odds.overUnder]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider">
            Cotações ao vivo
          </h4>
          <span className="text-xs text-slate-600">{traduzirFonteMercado(odds.provider)}</span>
        </div>
        {valueBets.length > 0 && (
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
            <TrendingUp className="w-3 h-3" />
            {valueBets.length} value{valueBets.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Resultado */}
      <div className="space-y-2">
        <div className="text-xs text-slate-600 font-medium uppercase tracking-wider">Resultado</div>
        <OddRow
          label={`${match.strHomeTeam} vence`}
          icon="🏠"
          decimal={processedOdds.homeDecimal}
          impliedProb={processedOdds.homeImplied}
          modelProb={processedOdds.normHome}
          isLive={isLive}
        />
        <OddRow
          label="Empate"
          icon="🤝"
          decimal={processedOdds.drawDecimal}
          impliedProb={processedOdds.drawImplied}
          modelProb={processedOdds.normDraw}
          isLive={isLive}
        />
        <OddRow
          label={`${match.strAwayTeam} vence`}
          icon="✈️"
          decimal={processedOdds.awayDecimal}
          impliedProb={processedOdds.awayImplied}
          modelProb={processedOdds.normAway}
          isLive={isLive}
        />
      </div>

      {/* Over/Under */}
      {odds.overUnder != null && (
        <div className="space-y-2 pt-3 border-t border-slate-700/30">
          <div className="text-xs text-slate-600 font-medium uppercase tracking-wider">
            Mais de / Menos de {odds.overUnder}
          </div>
          <OddRow
            label={traduzirTextoMercado(`Over ${odds.overUnder} Gols`)}
            icon="⬆️"
            decimal={processedOdds.overDecimal}
            impliedProb={processedOdds.overImplied}
            modelProb={processedOdds.modelOver25}
            isLive={isLive}
          />
          <OddRow
            label={traduzirTextoMercado(`Under ${odds.overUnder} Gols`)}
            icon="⬇️"
            decimal={processedOdds.underDecimal}
            impliedProb={processedOdds.underImplied}
            modelProb={processedOdds.modelUnder25}
            isLive={isLive}
          />
        </div>
      )}

      {/* Resumo de value bets */}
      {valueBets.length > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Oportunidades de valor detectadas</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {valueBets.map((bet, i) => (
              <span key={i} className="text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-full px-2 py-0.5">
                {bet}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        Cotações via {traduzirFonteMercado(odds.provider)}. Vantagem = probabilidade do modelo − probabilidade implícita da cotação.
      </p>
    </div>
  );
}
