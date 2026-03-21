// Rapha Guru — Tips History Context v2.0
// Histórico + modo simulação + métricas semanais

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type TipMode = 'real' | 'simulado';

export interface TipSubResult {
  market: string;       // ex: "Escanteios", "Vencedor", "Gols"
  prediction: string;   // ex: "+8.5 escanteios", "Vitória Time A"
  result: 'hit' | 'miss' | 'pending';
}

export interface HistoricalTip {
  id: string;
  addedAt: string;
  matchLabel: string;
  matchDate: string;
  league: string;
  tipLabel: string;
  category: string;
  probability: number;
  odds: number;
  stake: number;
  result: 'pending' | 'won' | 'lost' | 'void';
  profit: number;
  mode: TipMode;
  subResults?: TipSubResult[];  // acertos/erros por mercado individual
}

interface PeriodStats {
  totalBets: number;
  settled: number;
  won: number;
  lost: number;
  pending: number;
  totalStaked: number;
  totalReturn: number;
  profit: number;
  roi: number;
  winRate: number;
  label: string;
}

interface SimulationConfig {
  enabled: boolean;
  initialBalance: number;
  defaultStake: number;
}

interface TipsHistoryContextValue {
  history: HistoricalTip[];
  addToHistory: (tip: Omit<HistoricalTip, 'id' | 'addedAt'>) => void;
  updateResult: (id: string, result: 'won' | 'lost' | 'void') => void;
  updateSubResult: (tipId: string, market: string, result: 'hit' | 'miss') => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  stats: {
    totalBets: number;
    won: number;
    lost: number;
    pending: number;
    totalStaked: number;
    totalReturn: number;
    roi: number;
    winRate: number;
  };
  dailyStats: PeriodStats;
  weeklyStats: PeriodStats;
  simulation: {
    enabled: boolean;
    initialBalance: number;
    defaultStake: number;
    currentBalance: number;
    reservedStake: number;
    settledProfit: number;
    roi: number;
    winRate: number;
    totalSimulatedBets: number;
  };
  setSimulationEnabled: (value: boolean) => void;
  setSimulationInitialBalance: (value: number) => void;
  setSimulationDefaultStake: (value: number) => void;
  resetSimulation: () => void;
}

const TipsHistoryContext = createContext<TipsHistoryContextValue | null>(null);

const STORAGE_KEY = 'football-tips-pro-history';
const SIM_STORAGE_KEY = 'football-tips-pro-simulation';

function computePeriodStats(history: HistoricalTip[], filter: (tip: HistoricalTip) => boolean, label: string): PeriodStats {
  const items = history.filter(filter);
  const settled = items.filter((tip) => tip.result !== 'pending' && tip.result !== 'void');
  const won = items.filter((tip) => tip.result === 'won').length;
  const lost = items.filter((tip) => tip.result === 'lost').length;
  const pending = items.filter((tip) => tip.result === 'pending').length;
  const totalStaked = items.filter((tip) => tip.result !== 'void').reduce((sum, tip) => sum + tip.stake, 0);
  const totalReturn = items.reduce((sum, tip) => sum + (tip.result === 'won' ? tip.stake * tip.odds : tip.result === 'void' ? tip.stake : 0), 0);
  const profit = totalReturn - totalStaked;
  const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
  const winRate = settled.length > 0 ? (won / settled.length) * 100 : 0;

  return {
    totalBets: items.length,
    settled: settled.length,
    won,
    lost,
    pending,
    totalStaked,
    totalReturn,
    profit,
    roi,
    winRate,
    label,
  };
}

function loadSimulationConfig(): SimulationConfig {
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY);
    if (!raw) return { enabled: false, initialBalance: 1000, defaultStake: 20 };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      initialBalance: Number(parsed.initialBalance) > 0 ? Number(parsed.initialBalance) : 1000,
      defaultStake: Number(parsed.defaultStake) > 0 ? Number(parsed.defaultStake) : 20,
    };
  } catch {
    return { enabled: false, initialBalance: 1000, defaultStake: 20 };
  }
}

export function TipsHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<HistoricalTip[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>(() => loadSimulationConfig());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(simulationConfig));
    } catch {
      // ignore
    }
  }, [simulationConfig]);

  const addToHistory = useCallback((tip: Omit<HistoricalTip, 'id' | 'addedAt'>) => {
    const newTip: HistoricalTip = {
      ...tip,
      id: `tip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      addedAt: new Date().toISOString(),
      mode: tip.mode ?? 'real',
    };
    setHistory(prev => [newTip, ...prev]);
  }, []);

  const updateResult = useCallback((id: string, result: 'won' | 'lost' | 'void') => {
    setHistory(prev => prev.map(tip => {
      if (tip.id !== id) return tip;
      const profit = result === 'won'
        ? tip.stake * tip.odds - tip.stake
        : result === 'void'
          ? 0
          : -tip.stake;
      return { ...tip, result, profit };
    }));
  }, []);

  const updateSubResult = useCallback((tipId: string, market: string, result: 'hit' | 'miss') => {
    setHistory(prev => prev.map(tip => {
      if (tip.id !== tipId) return tip;
      const existing = tip.subResults ?? [];
      const updated = existing.map(s => s.market === market ? { ...s, result } : s);
      if (!existing.find(s => s.market === market)) {
        updated.push({ market, prediction: market, result });
      }
      return { ...tip, subResults: updated };
    }));
  }, []);

  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const stats = useMemo(() => {
    const settled = history.filter(t => t.result !== 'pending' && t.result !== 'void');
    const won = history.filter(t => t.result === 'won').length;
    const lost = history.filter(t => t.result === 'lost').length;
    const pending = history.filter(t => t.result === 'pending').length;
    const totalStaked = history.filter(t => t.result !== 'void').reduce((s, t) => s + t.stake, 0);
    const totalReturn = history.reduce((s, t) => s + (t.result === 'won' ? t.stake * t.odds : t.result === 'void' ? t.stake : 0), 0);
    const roi = totalStaked > 0 ? ((totalReturn - totalStaked) / totalStaked) * 100 : 0;
    const winRate = settled.length > 0 ? (won / settled.length) * 100 : 0;

    return {
      totalBets: history.length,
      won,
      lost,
      pending,
      totalStaked,
      totalReturn,
      roi,
      winRate,
    };
  }, [history]);

  const dailyStats = useMemo(() => {
    const today = new Date();
    const todayKey = today.toLocaleDateString('sv-SE');
    return computePeriodStats(
      history,
      (tip) => new Date(tip.addedAt).toLocaleDateString('sv-SE') === todayKey,
      today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    );
  }, [history]);

  const weeklyStats = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return computePeriodStats(
      history,
      (tip) => new Date(tip.addedAt).getTime() >= start.getTime(),
      'Últimos 7 dias'
    );
  }, [history]);

  const simulation = useMemo(() => {
    const simulated = history.filter((tip) => tip.mode === 'simulado');
    const settled = simulated.filter((tip) => tip.result !== 'pending');
    const reservedStake = simulated.filter((tip) => tip.result === 'pending').reduce((sum, tip) => sum + tip.stake, 0);
    const settledProfit = simulated.reduce((sum, tip) => sum + tip.profit, 0);
    const totalReturn = simulated.reduce((sum, tip) => sum + (tip.result === 'won' ? tip.stake * tip.odds : tip.result === 'void' ? tip.stake : 0), 0);
    const totalStaked = simulated.filter((tip) => tip.result !== 'void').reduce((sum, tip) => sum + tip.stake, 0);
    const currentBalance = simulationConfig.initialBalance - reservedStake + settledProfit;
    const won = simulated.filter((tip) => tip.result === 'won').length;
    const winRate = settled.length > 0 ? (won / settled.length) * 100 : 0;
    const roi = totalStaked > 0 ? ((totalReturn - totalStaked) / totalStaked) * 100 : 0;

    return {
      enabled: simulationConfig.enabled,
      initialBalance: simulationConfig.initialBalance,
      defaultStake: simulationConfig.defaultStake,
      currentBalance,
      reservedStake,
      settledProfit,
      roi,
      winRate,
      totalSimulatedBets: simulated.length,
    };
  }, [history, simulationConfig]);

  const setSimulationEnabled = useCallback((value: boolean) => {
    setSimulationConfig((prev) => ({ ...prev, enabled: value }));
  }, []);

  const setSimulationInitialBalance = useCallback((value: number) => {
    setSimulationConfig((prev) => ({ ...prev, initialBalance: value > 0 ? value : prev.initialBalance }));
  }, []);

  const setSimulationDefaultStake = useCallback((value: number) => {
    setSimulationConfig((prev) => ({ ...prev, defaultStake: value > 0 ? value : prev.defaultStake }));
  }, []);

  const resetSimulation = useCallback(() => {
    setHistory((prev) => prev.filter((tip) => tip.mode !== 'simulado'));
  }, []);

  return (
    <TipsHistoryContext.Provider value={{
      history,
      addToHistory,
      updateResult,
      updateSubResult,
      removeFromHistory,
      clearHistory,
      stats,
      dailyStats,
      weeklyStats,
      simulation,
      setSimulationEnabled,
      setSimulationInitialBalance,
      setSimulationDefaultStake,
      resetSimulation,
    }}>
      {children}
    </TipsHistoryContext.Provider>
  );
}

export function useTipsHistory() {
  const ctx = useContext(TipsHistoryContext);
  if (!ctx) throw new Error('useTipsHistory must be used within TipsHistoryProvider');
  return ctx;
}
