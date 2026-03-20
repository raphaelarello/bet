// Rapha Guru — Odds History Panel v1.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Exibe histórico de odds com gráfico de movimento de mercado e alertas de variação

import React, { useMemo } from 'react';
import { cn, traduzirFonteMercado, traduzirTextoMercado } from '@/lib/utils';
import type { OddsHistoryEntry, OddsMovement } from '@/hooks/useOddsHistory';
import { TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, Info } from 'lucide-react';

// ============================================================
// HELPERS
// ============================================================

function mlToDecimal(ml: number): number {
  if (ml > 0) return ml / 100 + 1;
  return 100 / Math.abs(ml) + 1;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDecimal(ml: number | null): string {
  if (ml == null) return '–';
  return mlToDecimal(ml).toFixed(2);
}

// ============================================================
// COMPONENTE DE MOVIMENTO
// ============================================================

interface MovementBadgeProps {
  movement: OddsMovement;
  label: string;
  firstVal: number | null;
  latestVal: number | null;
}

function MovementBadge({ movement, label, firstVal, latestVal }: MovementBadgeProps) {
  const { direction, change, changePct, isSignificant } = movement;

  const config = {
    up: {
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      label: 'Subiu',
    },
    down: {
      icon: TrendingDown,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      label: 'Caiu',
    },
    stable: {
      icon: Minus,
      color: 'text-slate-500',
      bg: 'bg-slate-700/30 border-slate-600/20',
      label: 'Estável',
    },
  }[direction];

  const Icon = config.icon;

  return (
    <div className={cn(
      'rounded-xl border p-3 transition-all',
      config.bg,
      isSignificant && direction !== 'stable' ? 'ring-1 ring-offset-0' : '',
      isSignificant && direction === 'up' ? 'ring-emerald-500/30' : '',
      isSignificant && direction === 'down' ? 'ring-red-500/30' : '',
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        <div className={cn('flex items-center gap-1 text-xs font-bold', config.color)}>
          <Icon className="w-3 h-3" />
          {config.label}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-slate-600 mb-0.5">Inicial → Atual</div>
          <div className="text-sm font-mono font-bold text-slate-300">
            {formatDecimal(firstVal)} → {formatDecimal(latestVal)}
          </div>
        </div>
        {direction !== 'stable' && (
          <div className={cn('text-right', config.color)}>
            <div className="text-xs font-mono font-bold">
              {change > 0 ? '+' : ''}{change.toFixed(2)}
            </div>
            <div className="text-xs font-mono">
              {changePct.toFixed(1)}%
            </div>
          </div>
        )}
      </div>
      {isSignificant && direction !== 'stable' && (
        <div className={cn('mt-2 flex items-center gap-1 text-xs font-semibold', config.color)}>
          <AlertTriangle className="w-3 h-3" />
          Movimento significativo ({changePct.toFixed(1)}%)
        </div>
      )}
    </div>
  );
}

// ============================================================
// MINI GRÁFICO DE LINHA (SVG)
// ============================================================

interface MiniChartProps {
  values: (number | null)[];
  color: string;
  height?: number;
}

function MiniChart({ values, color, height = 40 }: MiniChartProps) {
  const validValues = values.filter(v => v != null) as number[];
  if (validValues.length < 2) return null;

  const decimals = validValues.map(mlToDecimal);
  const min = Math.min(...decimals);
  const max = Math.max(...decimals);
  const range = max - min || 0.01;
  const width = 120;

  const points = decimals.map((v, i) => {
    const x = (i / (decimals.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Ponto inicial */}
      {decimals.length > 0 && (() => {
        const [x0, y0] = points.split(' ')[0].split(',').map(Number);
        return <circle cx={x0} cy={y0} r="2.5" fill={color} opacity="0.6" />;
      })()}
      {/* Ponto final */}
      {decimals.length > 0 && (() => {
        const last = points.split(' ').pop()!;
        const [xL, yL] = last.split(',').map(Number);
        return <circle cx={xL} cy={yL} r="3" fill={color} />;
      })()}
    </svg>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

interface OddsHistoryPanelProps {
  entry: OddsHistoryEntry;
  homeTeam: string;
  awayTeam: string;
}

export function OddsHistoryPanel({ entry, homeTeam, awayTeam }: OddsHistoryPanelProps) {
  const { snapshots, firstSnapshot, latestSnapshot, movements } = entry;

  // Extrai séries de valores
  const homeSeries = useMemo(() => snapshots.map(s => s.homeMoneyline), [snapshots]);
  const awaySeries = useMemo(() => snapshots.map(s => s.awayMoneyline), [snapshots]);
  const overSeries = useMemo(() => snapshots.map(s => s.overOdds), [snapshots]);

  // Conta movimentos significativos
  const significantMoves = Object.values(movements).filter(
    m => m.isSignificant && m.direction !== 'stable'
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
            Histórico de cotações
          </h4>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{snapshots.length} registros</span>
          {significantMoves > 0 && (
            <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" />
              {significantMoves} mov. significativo{significantMoves !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Período */}
      <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-800/30 rounded-lg px-3 py-2">
        <Info className="w-3 h-3 flex-shrink-0" />
        <span>
          Primeiro registro: {formatTime(firstSnapshot.timestamp)} —
          Último: {formatTime(latestSnapshot.timestamp)} —
          Fonte: {traduzirFonteMercado(latestSnapshot.provider)}
        </span>
      </div>

      {/* Gráficos de linha */}
      {snapshots.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-3 text-center">
            <div className="text-xs text-slate-500 mb-2">{homeTeam}</div>
            <MiniChart values={homeSeries} color="#60a5fa" />
            <div className="text-xs font-mono font-bold text-blue-400 mt-1">
              {formatDecimal(latestSnapshot.homeMoneyline)}
            </div>
          </div>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-3 text-center">
            <div className="text-xs text-slate-500 mb-2">Empate</div>
            <MiniChart values={snapshots.map(s => s.drawMoneyline)} color="#94a3b8" />
            <div className="text-xs font-mono font-bold text-slate-400 mt-1">
              {formatDecimal(latestSnapshot.drawMoneyline)}
            </div>
          </div>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-3 text-center">
            <div className="text-xs text-slate-500 mb-2">{awayTeam}</div>
            <MiniChart values={awaySeries} color="#f87171" />
            <div className="text-xs font-mono font-bold text-red-400 mt-1">
              {formatDecimal(latestSnapshot.awayMoneyline)}
            </div>
          </div>
        </div>
      )}

      {/* Movimentos */}
      <div className="space-y-2">
        <div className="text-xs text-slate-600 font-medium uppercase tracking-wider">Resultado</div>
        <div className="grid grid-cols-1 gap-2">
          <MovementBadge
            movement={movements.home}
            label={`${homeTeam} vence`}
            firstVal={firstSnapshot.homeMoneyline}
            latestVal={latestSnapshot.homeMoneyline}
          />
          <MovementBadge
            movement={movements.draw}
            label="Empate"
            firstVal={firstSnapshot.drawMoneyline}
            latestVal={latestSnapshot.drawMoneyline}
          />
          <MovementBadge
            movement={movements.away}
            label={`${awayTeam} vence`}
            firstVal={firstSnapshot.awayMoneyline}
            latestVal={latestSnapshot.awayMoneyline}
          />
        </div>
      </div>

      {/* Over/Under */}
      {latestSnapshot.overUnder != null && (
        <div className="space-y-2 pt-3 border-t border-slate-700/30">
          <div className="text-xs text-slate-600 font-medium uppercase tracking-wider">
            Mais de / Menos de {latestSnapshot.overUnder}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <MovementBadge
              movement={movements.over}
              label={traduzirTextoMercado(`Over ${latestSnapshot.overUnder}`)}
              firstVal={firstSnapshot.overOdds}
              latestVal={latestSnapshot.overOdds}
            />
            <MovementBadge
              movement={movements.under}
              label={traduzirTextoMercado(`Under ${latestSnapshot.overUnder}`)}
              firstVal={firstSnapshot.underOdds}
              latestVal={latestSnapshot.underOdds}
            />
          </div>
        </div>
      )}

      {/* Tabela de snapshots recentes */}
      {snapshots.length > 1 && (
        <div className="space-y-2 pt-3 border-t border-slate-700/30">
          <div className="text-xs text-slate-600 font-medium uppercase tracking-wider">
            Últimos registros
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-600 border-b border-slate-700/30">
                  <th className="text-left py-1 pr-3 font-medium">Hora</th>
                  <th className="text-center py-1 px-2 font-medium">Casa</th>
                  <th className="text-center py-1 px-2 font-medium">Empate</th>
                  <th className="text-center py-1 px-2 font-medium">Fora</th>
                  <th className="text-center py-1 px-2 font-medium">Mais de</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.slice(-8).reverse().map((snap, i) => {
                  const isLatest = i === 0;
                  return (
                    <tr
                      key={snap.timestamp}
                      className={cn(
                        'border-b border-slate-700/20 transition-colors',
                        isLatest ? 'bg-slate-700/20 text-slate-300' : 'text-slate-500'
                      )}
                    >
                      <td className="py-1 pr-3 font-mono">
                        {formatTime(snap.timestamp)}
                        {isLatest && (
                          <span className="ml-1 text-blue-400 text-xs">(atual)</span>
                        )}
                      </td>
                      <td className="text-center py-1 px-2 font-mono">
                        {formatDecimal(snap.homeMoneyline)}
                      </td>
                      <td className="text-center py-1 px-2 font-mono">
                        {formatDecimal(snap.drawMoneyline)}
                      </td>
                      <td className="text-center py-1 px-2 font-mono">
                        {formatDecimal(snap.awayMoneyline)}
                      </td>
                      <td className="text-center py-1 px-2 font-mono">
                        {formatDecimal(snap.overOdds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        Cotações registradas automaticamente a cada atualização. Variação ≥5% é considerada significativa.
      </p>
    </div>
  );
}
