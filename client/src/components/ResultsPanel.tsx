// Rapha Guru — Painel de Resultados do Dia
// Mostra pitacos do dia, permite marcar acerto/erro rapidamente

import React, { useMemo, useState } from 'react';
import { useTipsHistory } from '@/contexts/TipsHistoryContext';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, XCircle, Clock, TrendingUp, Target,
  ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react';
import { toast } from 'sonner';

export function ResultsPanel() {
  const { history, stats, dailyStats, updateResult } = useTipsHistory();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Pitacos do dia (últimas 24h)
  const todayTips = useMemo(() => {
    const ontem = new Date();
    ontem.setHours(0, 0, 0, 0);
    return history
      .filter(t => new Date(t.addedAt) >= ontem)
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }, [history]);

  const settled  = todayTips.filter(t => t.result !== 'pending' && t.result !== 'void');
  const won      = settled.filter(t => t.result === 'won').length;
  const pending  = todayTips.filter(t => t.result === 'pending').length;
  const taxa     = settled.length > 0 ? Math.round((won / settled.length) * 100) : null;

  const handleMark = (id: string, result: 'won' | 'lost') => {
    updateResult(id, result);
    toast.success(result === 'won' ? '✅ Acerto registrado!' : '❌ Erro registrado');
  };

  return (
    <div className="space-y-3">
      {/* Resumo do dia */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3 text-center">
          <div className="text-[22px] font-black text-white">{todayTips.length}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Pitacos</div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
          <div className="text-[22px] font-black text-emerald-400">{won}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Acertos</div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
          <div className="text-[22px] font-black text-red-400">{settled.length - won}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Erros</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <div className="text-[22px] font-black text-amber-400">{taxa !== null ? `${taxa}%` : '—'}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Acerto %</div>
        </div>
      </div>

      {/* Barra de progresso */}
      {settled.length > 0 && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3">
          <div className="flex items-center justify-between text-[11px] mb-2">
            <span className="text-slate-400 font-medium">Taxa de acerto hoje</span>
            <span className={cn('font-black',
              taxa! >= 65 ? 'text-emerald-400' : taxa! >= 50 ? 'text-amber-400' : 'text-red-400'
            )}>{taxa}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${taxa}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>{won} acertos</span>
            <span>{settled.length - won} erros</span>
            {pending > 0 && <span className="text-amber-400/70">{pending} pendentes</span>}
          </div>
        </div>
      )}

      {/* Lista de pitacos */}
      {todayTips.length === 0 ? (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-center">
          <Target className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Nenhum pitaco registrado hoje.</p>
          <p className="text-xs text-slate-600 mt-1">Clique em um jogo e gere um pitaco para começar a rastrear.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Pitacos de hoje</span>
            <div className="h-px flex-1 bg-slate-800/60" />
            {pending > 0 && (
              <span className="text-[10px] text-amber-400 font-medium">{pending} aguardando resultado</span>
            )}
          </div>

          {todayTips.map(tip => (
            <div key={tip.id}
              className={cn(
                'rounded-xl border p-3 transition-all',
                tip.result === 'won'  ? 'border-emerald-500/25 bg-emerald-500/5'
                : tip.result === 'lost' ? 'border-red-500/25 bg-red-500/5'
                : 'border-slate-800/60 bg-slate-900/40'
              )}>
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {tip.result === 'won'  && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {tip.result === 'lost' && <XCircle className="w-4 h-4 text-red-400" />}
                  {tip.result === 'pending' && <Clock className="w-4 h-4 text-slate-500" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-500 truncate">{tip.matchLabel}</div>
                  <div className="text-[13px] font-semibold text-slate-100 mt-0.5">{tip.tipLabel}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500">{tip.league}</span>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className="text-[10px] text-slate-400 font-mono">{tip.probability}%</span>
                    {tip.result !== 'pending' && (
                      <span className={cn('text-[10px] font-bold',
                        tip.result === 'won' ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {tip.result === 'won' ? 'Acertou' : 'Errou'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Marcar resultado rápido */}
                {tip.result === 'pending' && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => handleMark(tip.id, 'won')}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all">
                      <CheckCircle2 className="w-3 h-3" />
                      Acertou
                    </button>
                    <button onClick={() => handleMark(tip.id, 'lost')}
                      className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition-all">
                      <XCircle className="w-3 h-3" />
                      Errou
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats gerais acumuladas */}
      {stats && stats.totalBets > 0 && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-bold text-slate-400">Acumulado total</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-[16px] font-black text-white">{stats.won}/{stats.settled}</div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wide">Acertos</div>
            </div>
            <div className="text-center">
              <div className={cn('text-[16px] font-black',
                stats.winRate >= 65 ? 'text-emerald-400' : stats.winRate >= 50 ? 'text-amber-400' : 'text-red-400'
              )}>{Math.round(stats.winRate)}%</div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wide">Taxa acerto</div>
            </div>
            <div className="text-center">
              <div className={cn('text-[16px] font-black',
                stats.roi > 0 ? 'text-emerald-400' : stats.roi < 0 ? 'text-red-400' : 'text-slate-400'
              )}>{stats.roi > 0 ? '+' : ''}{Math.round(stats.roi)}%</div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wide">ROI</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
