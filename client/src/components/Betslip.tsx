// Rapha Guru — Bilhete de Apostas v3.0
// Design: flutuante, compacto, drag-to-expand, fluxo direto para automação

import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useBetslip } from '@/contexts/BetslipContext';
import { useTipsHistory } from '@/contexts/TipsHistoryContext';
import { cn, formatLocalISODate, traduzirTextoMercado } from '@/lib/utils';
import {
  X, Trash2, BookOpen, Calculator, Copy, Zap,
  ChevronDown, ChevronUp, Plus, Minus, Check,
  TrendingUp, Target, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Tip } from '@/lib/types';

const CAT_COLOR: Record<Tip['category'], string> = {
  result:   '#3b82f6',
  goals:    '#22c55e',
  corners:  '#f59e0b',
  cards:    '#ef4444',
  btts:     '#a855f7',
  handicap: '#06b6d4',
  halftime: '#f97316',
  special:  '#ec4899',
};

const CAT_LABEL: Record<Tip['category'], string> = {
  result: 'Resultado', goals: 'Gols', corners: 'Escanteios',
  cards: 'Cartões', btts: 'Ambas marcam', handicap: 'Handicap',
  halftime: '1º Tempo', special: 'Especial',
};

const CONF_COLOR = {
  high:   { text: '#22c55e', bg: 'rgba(34,197,94,.12)',   label: 'Alta' },
  medium: { text: '#f59e0b', bg: 'rgba(245,158,11,.12)',  label: 'Média' },
  low:    { text: '#94a3b8', bg: 'rgba(148,163,184,.12)', label: 'Baixa' },
};

const QUICK_STAKES = [5, 10, 25, 50, 100, 200];

// ── Botão flutuante ─────────────────────────────────────────
export function BetslipToggle() {
  const { items, isOpen, setIsOpen, totalOdds, stake, potentialReturn } = useBetslip();
  if (items.length === 0) return null;

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        'fixed bottom-5 right-5 z-50 flex flex-col items-start gap-0.5',
        'rounded-2xl shadow-2xl px-4 py-3 transition-all duration-300',
        'bg-gradient-to-br from-amber-500 to-amber-600',
        isOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'
      )}
      style={{ boxShadow: '0 8px 32px rgba(245,158,11,0.4)' }}
    >
      <div className="flex items-center gap-2.5">
        <BookOpen className="w-4 h-4 text-black/80" />
        <span className="text-sm font-black text-black">
          {items.length} {items.length === 1 ? 'seleção' : 'seleções'}
        </span>
        <span className="ml-1 bg-black/20 text-black rounded-xl px-2 py-0.5 text-xs font-black">
          {totalOdds.toFixed(2)}x
        </span>
      </div>
      <div className="text-[11px] text-black/60 font-semibold pl-6">
        Retorno potencial: R$ {potentialReturn.toFixed(2)}
      </div>
    </button>
  );
}

// ── Painel principal ─────────────────────────────────────────
export function BetslipPanel() {
  const {
    items, stake, setStake, removeBet, clearBetslip,
    totalOdds, potentialReturn, isOpen, setIsOpen,
  } = useBetslip();
  const { addToHistory, simulation } = useTipsHistory();
  const [, setLocation] = useLocation();
  const [stakeInput, setStakeInput] = useState(String(stake));
  const [expanded, setExpanded] = useState(true);
  const [mode, setMode] = useState<'simples' | 'acumulado'>('acumulado');

  useEffect(() => { setStakeInput(String(stake)); }, [stake]);

  const handleStake = (val: string) => {
    setStakeInput(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) setStake(n);
  };

  const adjustStake = (delta: number) => {
    const n = Math.max(1, stake + delta);
    setStake(n); setStakeInput(String(n));
  };

  const copy = useCallback(() => {
    const lines = items.map(b =>
      `${b.matchLabel} — ${traduzirTextoMercado(b.tipLabel)} @ ${b.odds.toFixed(2)}`
    ).join('\n');
    const summary = `\nOdd total: ${totalOdds.toFixed(2)}x | Entrada: R$ ${stake} | Retorno: R$ ${potentialReturn.toFixed(2)}`;
    navigator.clipboard.writeText(lines + summary)
      .then(() => toast.success('Bilhete copiado!'))
      .catch(() => toast.error('Erro ao copiar'));
  }, [items, totalOdds, stake, potentialReturn]);

  const saveToHistory = useCallback(() => {
    if (!items.length) return;
    const perStake = stake / items.length;
    items.forEach(item => {
      addToHistory({
        matchLabel: item.matchLabel,
        matchDate: formatLocalISODate(new Date()),
        league: 'Futebol',
        tipLabel: traduzirTextoMercado(item.tipLabel),
        category: item.category,
        probability: item.probability,
        odds: item.odds,
        stake: perStake,
        result: 'pending',
        profit: 0,
        mode: simulation.enabled ? 'simulado' : 'real',
      });
    });
    toast.success(`${items.length} aposta(s) salva(s) no histórico!`);
    clearBetslip();
    setIsOpen(false);
  }, [items, stake, addToHistory, clearBetslip, setIsOpen, simulation]);

  const goToAutomation = () => {
    setIsOpen(false);
    setLocation('/automacao');
  };

  if (!isOpen) return null;

  const effectiveOdds = mode === 'acumulado'
    ? totalOdds
    : items.length > 0 ? items.reduce((s, b) => s + b.odds, 0) / items.length : 1;

  const effectiveReturn = mode === 'acumulado'
    ? potentialReturn
    : stake * effectiveOdds;

  return (
    <div
      className="fixed bottom-0 right-0 z-50 flex flex-col"
      style={{
        width: 'min(420px, 100vw)',
        maxHeight: '90vh',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{
          background: 'linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%)',
          borderTop: '1px solid rgba(245,158,11,.35)',
          borderLeft: '1px solid rgba(255,255,255,.07)',
          borderRight: '1px solid rgba(255,255,255,.07)',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -4px 24px rgba(0,0,0,.4)',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)' }}>
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="font-bold text-slate-200 text-sm">Bilhete</span>
          {items.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center">
              {items.length}
            </span>
          )}
          {/* Mode toggle */}
          {items.length > 1 && (
            <div className="flex rounded-lg overflow-hidden border border-white/[.07] ml-1">
              {(['simples', 'acumulado'] as const).map(m => (
                <button key={m} onClick={e => { e.stopPropagation(); setMode(m); }}
                  className="px-2.5 py-1 text-[10px] font-bold transition-all"
                  style={{ background: mode === m ? '#f59e0b' : 'transparent', color: mode === m ? '#000' : '#4a5568' }}>
                  {m === 'simples' ? 'Simples' : 'Acumu.'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="text-xs font-black" style={{ color: '#f59e0b' }}>
              {effectiveOdds.toFixed(2)}x
            </span>
          )}
          {expanded
            ? <ChevronDown className="w-4 h-4 text-slate-500" />
            : <ChevronUp className="w-4 h-4 text-slate-500" />
          }
          <button onClick={e => { e.stopPropagation(); setIsOpen(false); }}
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {expanded && (
        <>
          {/* Lista de seleções */}
          <div
            className="overflow-y-auto"
            style={{
              background: '#0d1117',
              borderLeft: '1px solid rgba(255,255,255,.07)',
              borderRight: '1px solid rgba(255,255,255,.07)',
              maxHeight: '35vh',
            }}
          >
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 px-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
                  <BookOpen className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-sm text-slate-500 text-center leading-relaxed">
                  Adicione seleções clicando em <span className="text-amber-400 font-bold">+ Bilhete</span> em qualquer análise
                </p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {items.map((item) => {
                  const col = CAT_COLOR[item.category] ?? '#94a3b8';
                  const conf = CONF_COLOR[item.confidence];
                  return (
                    <div key={item.id}
                      style={{
                        background: 'rgba(255,255,255,.03)',
                        border: `1px solid ${col}25`,
                        borderLeft: `3px solid ${col}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-500 truncate mb-0.5">{item.matchLabel}</p>
                          <p className="text-sm font-semibold text-slate-100 leading-snug">
                            {traduzirTextoMercado(item.tipLabel)}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ color: col, background: `${col}15` }}>
                              {CAT_LABEL[item.category]}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                              style={{ color: conf.text, background: conf.bg }}>
                              {conf.label}
                            </span>
                            <span className="text-[10px] text-slate-500">{item.probability}%</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <button onClick={() => removeBet(item.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <div className="text-right">
                            <div className="text-sm font-black text-amber-400">{item.odds.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          {items.length > 0 && (
            <div
              className="space-y-3 p-4"
              style={{
                background: '#0d1117',
                borderLeft: '1px solid rgba(255,255,255,.07)',
                borderRight: '1px solid rgba(255,255,255,.07)',
                borderBottom: '1px solid rgba(255,255,255,.07)',
              }}
            >
              {/* Stake */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-slate-500 font-semibold">Valor da aposta (R$)</p>
                  <div className="flex gap-1">
                    {QUICK_STAKES.map(v => (
                      <button key={v} onClick={() => { setStake(v); setStakeInput(String(v)); }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold transition-all"
                        style={{
                          background: stake === v ? '#f59e0b' : 'rgba(255,255,255,.05)',
                          color: stake === v ? '#000' : '#4a5568',
                        }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => adjustStake(-5)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#8892b0' }}>
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">R$</span>
                    <input
                      type="number"
                      value={stakeInput}
                      onChange={e => handleStake(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-slate-100 text-sm font-bold text-center rounded-lg outline-none"
                      style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)' }}
                      min={1} step={1}
                    />
                  </div>
                  <button onClick={() => adjustStake(5)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#8892b0' }}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Retorno */}
              <div className="rounded-xl p-3"
                style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-[10px] text-slate-400">
                        {mode === 'acumulado' ? `Acumulado ${items.length}` : `Média ${items.length} simples`}
                      </div>
                      <div className="text-[11px] text-slate-500">Odd: {effectiveOdds.toFixed(2)}x</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-emerald-400">R$ {effectiveReturn.toFixed(2)}</div>
                    <div className="text-[10px] text-emerald-600">
                      lucro: +R$ {(effectiveReturn - stake).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={copy}
                  className="flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition-all"
                  style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#8892b0' }}>
                  <Copy className="w-3 h-3" /> Copiar
                </button>
                <button onClick={saveToHistory}
                  className="flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition-all"
                  style={{ background: 'rgba(168,85,247,.12)', border: '1px solid rgba(168,85,247,.25)', color: '#a855f7' }}>
                  <Check className="w-3 h-3" /> Salvar
                </button>
                <button onClick={() => { clearBetslip(); toast.info('Bilhete limpo'); }}
                  className="flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition-all"
                  style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444' }}>
                  <Trash2 className="w-3 h-3" /> Limpar
                </button>
              </div>

              {/* Botão principal: ir para automação */}
              <button
                onClick={goToAutomation}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black transition-all"
                style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  boxShadow: '0 4px 20px rgba(34,197,94,.35)',
                  color: '#fff',
                }}
              >
                <Zap className="w-4 h-4" />
                Executar apostas automaticamente
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[9px] text-slate-600 text-center">
                Análise por IA · Aposte com responsabilidade · +18 · {new Date().getFullYear()}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
