// Rapha Guru — Odds History Hook v1.0
// Rastreia histórico de odds ao longo do tempo para detectar movimento de mercado
// Persiste em localStorage e atualiza automaticamente quando novas odds chegam

import React, { useState, useEffect, useCallback } from 'react';
import type { MatchOdds } from './useMatchPlayers';

// ============================================================
// TIPOS
// ============================================================

export interface OddsSnapshot {
  timestamp: number;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  drawMoneyline: number | null;
  overOdds: number | null;
  underOdds: number | null;
  overUnder: number | null;
  provider: string;
}

export interface OddsMovement {
  direction: 'up' | 'down' | 'stable';
  change: number;       // Diferença em pontos de odd decimal
  changePct: number;    // Variação percentual
  isSignificant: boolean; // > 5% de variação
}

export interface OddsHistoryEntry {
  matchId: string;
  snapshots: OddsSnapshot[];
  firstSnapshot: OddsSnapshot;
  latestSnapshot: OddsSnapshot;
  movements: {
    home: OddsMovement;
    away: OddsMovement;
    draw: OddsMovement;
    over: OddsMovement;
    under: OddsMovement;
  };
}

// ============================================================
// HELPERS
// ============================================================

const STORAGE_KEY = 'football-tips-odds-history';
const MAX_SNAPSHOTS_PER_MATCH = 50;
const MAX_MATCHES = 30;

function normalizeOdds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) >= 100) {
    if (value > 0) return value / 100 + 1;
    return 100 / Math.abs(value) + 1;
  }
  return value;
}

function calcMovement(
  firstVal: number | null,
  latestVal: number | null
): OddsMovement {
  if (!firstVal || !latestVal) {
    return { direction: 'stable', change: 0, changePct: 0, isSignificant: false };
  }
  const firstDec = normalizeOdds(firstVal);
  const latestDec = normalizeOdds(latestVal);
  const change = latestDec - firstDec;
  const changePct = Math.abs(change / firstDec) * 100;
  const direction: OddsMovement['direction'] =
    change > 0.02 ? 'up' : change < -0.02 ? 'down' : 'stable';
  return {
    direction,
    change: Math.round(change * 100) / 100,
    changePct: Math.round(changePct * 10) / 10,
    isSignificant: changePct >= 5,
  };
}

function loadHistory(): Record<string, OddsHistoryEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveHistory(history: Record<string, OddsHistoryEntry>) {
  try {
    // Limita número de jogos para não encher o storage
    const entries = Object.entries(history);
    if (entries.length > MAX_MATCHES) {
      // Remove os mais antigos
      const sorted = entries.sort((a, b) =>
        (b[1].latestSnapshot?.timestamp ?? 0) - (a[1].latestSnapshot?.timestamp ?? 0)
      );
      const trimmed = Object.fromEntries(sorted.slice(0, MAX_MATCHES));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  } catch {
    // Ignora erros de storage cheio
  }
}

function buildEntry(matchId: string, snapshots: OddsSnapshot[]): OddsHistoryEntry {
  const first = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  return {
    matchId,
    snapshots,
    firstSnapshot: first,
    latestSnapshot: latest,
    movements: {
      home: calcMovement(first.homeMoneyline, latest.homeMoneyline),
      away: calcMovement(first.awayMoneyline, latest.awayMoneyline),
      draw: calcMovement(first.drawMoneyline, latest.drawMoneyline),
      over: calcMovement(first.overOdds, latest.overOdds),
      under: calcMovement(first.underOdds, latest.underOdds),
    },
  };
}

// ============================================================
// HOOK
// ============================================================

export function useOddsHistory(matchId: string | null, currentOdds: MatchOdds | null) {
  const [history, setHistory] = useState<Record<string, OddsHistoryEntry>>(loadHistory);

  // Registra snapshot quando odds chegam
  useEffect(() => {
    if (!matchId || !currentOdds) return;

    // Só registra se há pelo menos uma odd
    const hasOdds = currentOdds.homeMoneyline != null ||
      currentOdds.awayMoneyline != null ||
      currentOdds.overOdds != null;
    if (!hasOdds) return;

    const snapshot: OddsSnapshot = {
      timestamp: Date.now(),
      homeMoneyline: currentOdds.homeMoneyline ?? null,
      awayMoneyline: currentOdds.awayMoneyline ?? null,
      drawMoneyline: currentOdds.drawMoneyline ?? null,
      overOdds: currentOdds.overOdds ?? null,
      underOdds: currentOdds.underOdds ?? null,
      overUnder: currentOdds.overUnder ?? null,
      provider: currentOdds.provider,
    };

    setHistory(prev => {
      const existing = prev[matchId];
      let snapshots: OddsSnapshot[];

      if (!existing) {
        snapshots = [snapshot];
      } else {
        // Evita duplicatas (mesmas odds em menos de 5 min)
        const last = existing.snapshots[existing.snapshots.length - 1];
        const timeDiff = snapshot.timestamp - last.timestamp;
        if (timeDiff < 5 * 60 * 1000) {
          // Verifica se as odds mudaram
          const changed =
            snapshot.homeMoneyline !== last.homeMoneyline ||
            snapshot.awayMoneyline !== last.awayMoneyline ||
            snapshot.overOdds !== last.overOdds;
          if (!changed) return prev;
        }
        snapshots = [...existing.snapshots, snapshot].slice(-MAX_SNAPSHOTS_PER_MATCH);
      }

      const entry = buildEntry(matchId, snapshots);
      const updated = { ...prev, [matchId]: entry };
      saveHistory(updated);
      return updated;
    });
  }, [matchId, currentOdds]);

  const getHistory = useCallback(
    (id: string): OddsHistoryEntry | null => history[id] ?? null,
    [history]
  );

  const clearHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = { ...prev };
      delete updated[id];
      saveHistory(updated);
      return updated;
    });
  }, []);

  const currentEntry = matchId ? history[matchId] ?? null : null;

  return {
    currentEntry,
    getHistory,
    clearHistory,
    snapshotCount: currentEntry?.snapshots.length ?? 0,
  };
}
