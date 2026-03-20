// Rapha Guru — Fair Price Comparator v2.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Compara odds justas do modelo com odds reais disponíveis do mercado

import React, { useMemo, useState } from 'react';
import { cn, traduzirTextoMercado } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Info, DollarSign } from 'lucide-react';
import type { AnalysisMarketOdds, Predictions } from '@/lib/types';

interface OddsComparatorProps {
  predictions: Predictions;
  homeTeam: string;
  awayTeam: string;
  marketOdds?: AnalysisMarketOdds | null;
}

function fairOdds(prob: number): number {
  if (prob <= 0 || prob >= 100) return 0;
  return Math.round((100 / prob) * 100) / 100;
}

function expectedValue(probPct: number, marketOdd: number | null | undefined): number | null {
  if (!marketOdd) return null;
  return ((probPct / 100) * marketOdd - 1) * 100;
}

function probabilityForLine(predictions: Predictions, totalLine: number, side: 'over' | 'under'): number | null {
  const key = totalLine.toFixed(1);
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

  if (side === 'over') return overMap[key] ?? null;
  if (underMap[key] != null) return underMap[key];
  if (overMap[key] != null) return 100 - overMap[key];
  return null;
}

function OddsRow({
  label,
  prob,
  marketOdd,
}: {
  label: string;
  prob: number;
  marketOdd?: number | null;
}) {
  const ourOdd = fairOdds(prob);
  const ev = expectedValue(prob, marketOdd);
  const hasValue = ev != null && ev >= 2.5;
  const hasNegative = ev != null && ev <= -2.5;

  return (
    <div className={cn(
      'grid grid-cols-5 gap-2 py-2 px-3 rounded-lg text-xs items-center',
      hasValue ? 'bg-emerald-500/5 border border-emerald-500/15' : 'hover:bg-slate-700/20'
    )}>
      <div className="col-span-2 font-medium text-slate-300 truncate">{traduzirTextoMercado(label)}</div>
      <div className="text-center">
        <span className="font-bold text-blue-400">{ourOdd.toFixed(2)}</span>
        <div className="text-[9px] text-slate-600">{prob.toFixed(1)}%</div>
      </div>
      <div className="text-center text-slate-400">{marketOdd ? marketOdd.toFixed(2) : '—'}</div>
      <div className={cn(
        'text-center font-bold flex items-center justify-center gap-0.5',
        hasValue ? 'text-emerald-400' : hasNegative ? 'text-red-400' : 'text-slate-500'
      )}>
        {ev == null ? (
          '—'
        ) : (
          <>
            {hasValue ? <TrendingUp className="w-3 h-3" /> : hasNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {ev > 0 ? '+' : ''}{ev.toFixed(1)}%
          </>
        )}
      </div>
    </div>
  );
}

export function OddsComparator({ predictions, homeTeam, awayTeam, marketOdds }: OddsComparatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const rows = useMemo(() => {
    const baseRows = [
      { label: `Vitória ${homeTeam}`, prob: predictions.homeWinProb, marketOdd: marketOdds?.homeWinOdds ?? null },
      { label: 'Empate', prob: predictions.drawProb, marketOdd: marketOdds?.drawOdds ?? null },
      { label: `Vitória ${awayTeam}`, prob: predictions.awayWinProb, marketOdd: marketOdds?.awayWinOdds ?? null },
      { label: 'Mais de 1,5 gols', prob: predictions.over15Prob, marketOdd: null },
      { label: 'Mais de 2,5 gols', prob: predictions.over25Prob, marketOdd: null },
      { label: 'Ambas marcam — Sim', prob: predictions.bttsYesProb, marketOdd: null },
      { label: 'Mais de 8,5 escanteios', prob: predictions.over85CornersProb, marketOdd: null },
      { label: 'Mais de 2,5 cartões', prob: predictions.over25CardsProb, marketOdd: null },
    ].filter((item) => item.prob > 5 && item.prob < 95);

    if (marketOdds?.totalLine != null) {
      const overProb = probabilityForLine(predictions, marketOdds.totalLine, 'over');
      const underProb = probabilityForLine(predictions, marketOdds.totalLine, 'under');
      if (overProb != null) {
        baseRows.splice(3, 0, {
          label: `Mais de ${marketOdds.totalLine} gols`,
          prob: overProb,
          marketOdd: marketOdds.overOdds ?? null,
        });
      }
      if (underProb != null) {
        baseRows.splice(4, 0, {
          label: `Menos de ${marketOdds.totalLine} gols`,
          prob: underProb,
          marketOdd: marketOdds.underOdds ?? null,
        });
      }
    }

    return baseRows;
  }, [predictions, homeTeam, awayTeam, marketOdds]);

  const valueCount = rows.filter((row) => {
    const ev = expectedValue(row.prob, row.marketOdd);
    return ev != null && ev >= 2.5;
  }).length;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">Preço justo do modelo</span>
          {valueCount > 0 && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">
              {valueCount} vantagem{valueCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-700/50">
          <div className="flex items-start gap-2 px-3 py-2 bg-blue-500/5 border-b border-slate-700/50">
            <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500">
              “Nossa odd” = preço justo do modelo. “Mercado” mostra odds reais disponíveis nesta partida; quando indisponíveis, o painel exibe apenas o preço justo calculado.
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b border-slate-700/30">
            <div className="col-span-2 text-[10px] text-slate-600 font-medium">MERCADO</div>
            <div className="text-[10px] text-slate-600 font-medium text-center">ODD JUSTA</div>
            <div className="text-[10px] text-slate-600 font-medium text-center">MERCADO</div>
            <div className="text-[10px] text-slate-600 font-medium text-center">EV</div>
          </div>

          <div className="p-2 space-y-1">
            {rows.map((row) => (
              <OddsRow
                key={row.label}
                label={row.label}
                prob={row.prob}
                marketOdd={row.marketOdd}
              />
            ))}
          </div>

          <div className="flex items-center gap-4 px-3 py-2 border-t border-slate-700/30">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-slate-600">EV positivo</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[10px] text-slate-600">EV negativo</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
