// Rapha Guru — Betslip Context
// Design: "Estádio Noturno" — Premium Sports Dark
// Manages the betslip state: selected tips, stake, and return calculation

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Tip } from '@/lib/types';

export interface BetslipItem {
  id: string;
  matchId: string;
  matchLabel: string;  // "Arsenal vs Chelsea"
  tipLabel: string;    // "Over 2.5 Gols"
  probability: number;
  odds: number;
  category: Tip['category'];
  confidence: Tip['confidence'];
  addedAt: number;
}

interface BetslipContextValue {
  items: BetslipItem[];
  stake: number;
  setStake: (v: number) => void;
  addBet: (item: BetslipItem) => void;
  removeBet: (id: string) => void;
  clearBetslip: () => void;
  hasBet: (id: string) => boolean;
  totalOdds: number;
  potentialReturn: number;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

const BetslipContext = createContext<BetslipContextValue | null>(null);

export function BetslipProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BetslipItem[]>([]);
  const [stake, setStake] = useState<number>(10);
  const [isOpen, setIsOpen] = useState(false);

  const addBet = useCallback((item: BetslipItem) => {
    setItems(prev => {
      if (prev.find(b => b.id === item.id)) return prev;
      // Max 10 bets
      if (prev.length >= 10) return prev;
      return [...prev, item];
    });
    setIsOpen(true);
  }, []);

  const removeBet = useCallback((id: string) => {
    setItems(prev => prev.filter(b => b.id !== id));
  }, []);

  const clearBetslip = useCallback(() => {
    setItems([]);
  }, []);

  const hasBet = useCallback((id: string) => {
    return items.some(b => b.id === id);
  }, [items]);

  // Accumulator odds = product of all individual odds
  const totalOdds = items.reduce((acc, b) => acc * b.odds, 1);
  const potentialReturn = stake * totalOdds;

  return (
    <BetslipContext.Provider value={{
      items, stake, setStake,
      addBet, removeBet, clearBetslip, hasBet,
      totalOdds, potentialReturn,
      isOpen, setIsOpen,
    }}>
      {children}
    </BetslipContext.Provider>
  );
}

export function useBetslip() {
  const ctx = useContext(BetslipContext);
  if (!ctx) throw new Error('useBetslip must be used within BetslipProvider');
  return ctx;
}
