// Rapha Guru — Auto Result Tracker Hook
// Monitora jogos ao vivo e registra automaticamente resultados quando terminam
// Compara placar final com as tips pendentes e atualiza won/lost

import React, { useEffect, useRef, useCallback } from 'react';
import { useTipsHistory } from '@/contexts/TipsHistoryContext';
import type { Match } from '@/lib/types';

interface TrackedMatch {
  espnId: string;
  matchLabel: string;
  homeScore: number;
  awayScore: number;
  corners: number;
  cards: number;
  status: string;
}

const TRACKED_KEY = 'ftp-tracked-matches';

function loadTracked(): Record<string, TrackedMatch> {
  try {
    return JSON.parse(localStorage.getItem(TRACKED_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveTracked(data: Record<string, TrackedMatch>) {
  try {
    localStorage.setItem(TRACKED_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

// Avalia se uma tip foi ganha com base no resultado final
function evaluateTip(
  tipLabel: string,
  category: string,
  homeScore: number,
  awayScore: number,
  totalCorners: number,
  totalCards: number,
  homeTeam: string,
  awayTeam: string
): 'won' | 'lost' | null {
  const total = homeScore + awayScore;
  const label = tipLabel.toLowerCase();

  // Resultado
  if (category === 'resultado') {
    if (label.includes('vitória') && label.includes(homeTeam.toLowerCase())) {
      return homeScore > awayScore ? 'won' : 'lost';
    }
    if (label.includes('vitória') && label.includes(awayTeam.toLowerCase())) {
      return awayScore > homeScore ? 'won' : 'lost';
    }
    if (label.includes('empate')) {
      return homeScore === awayScore ? 'won' : 'lost';
    }
    if (label.includes('dupla chance') || label.includes('1x')) {
      return homeScore >= awayScore ? 'won' : 'lost';
    }
    if (label.includes('dupla chance') || label.includes('x2')) {
      return awayScore >= homeScore ? 'won' : 'lost';
    }
  }

  // Gols Over/Under
  if (category === 'gols' || label.includes('gol') || label.includes('over') || label.includes('under')) {
    const overMatch = label.match(/over\s*([\d.]+)/);
    const underMatch = label.match(/under\s*([\d.]+)/);
    if (overMatch) return total > parseFloat(overMatch[1]) ? 'won' : 'lost';
    if (underMatch) return total < parseFloat(underMatch[1]) ? 'won' : 'lost';
    if (label.includes('btts') || label.includes('ambos marcam')) {
      return homeScore > 0 && awayScore > 0 ? 'won' : 'lost';
    }
  }

  // Escanteios
  if (category === 'escanteios' || label.includes('escanteio')) {
    if (totalCorners > 0) {
      const overMatch = label.match(/over\s*([\d.]+)/);
      const underMatch = label.match(/under\s*([\d.]+)/);
      if (overMatch) return totalCorners > parseFloat(overMatch[1]) ? 'won' : 'lost';
      if (underMatch) return totalCorners < parseFloat(underMatch[1]) ? 'won' : 'lost';
    }
    return null; // sem dados de escanteios
  }

  // Cartões
  if (category === 'cartoes' || label.includes('cartão') || label.includes('cartoes')) {
    if (totalCards > 0) {
      const overMatch = label.match(/over\s*([\d.]+)/);
      const underMatch = label.match(/under\s*([\d.]+)/);
      if (overMatch) return totalCards > parseFloat(overMatch[1]) ? 'won' : 'lost';
      if (underMatch) return totalCards < parseFloat(underMatch[1]) ? 'won' : 'lost';
    }
    return null; // sem dados de cartões
  }

  return null; // não conseguiu avaliar
}

export function useAutoResultTracker(liveMatches: Match[]) {
  const { history, updateResult } = useTipsHistory();
  const prevStatusRef = useRef<Record<string, string>>({});

  const checkAndUpdateResults = useCallback((matches: Match[]) => {
    const tracked = loadTracked();

    matches.forEach(match => {
      const espnId = (match as Match & { espnEventId?: string }).espnEventId || match.idEvent;
      if (!espnId) return;

      const prevStatus = prevStatusRef.current[espnId];
      const currStatus = match.strStatus || '';

      // Detecta quando um jogo terminou (mudou de In Progress para Final)
      const justFinished =
        (prevStatus === 'In Progress' || prevStatus === 'Halftime') &&
        (currStatus === 'Final' || currStatus === 'FT' || currStatus === 'Full Time');

      if (justFinished || currStatus === 'Final') {
        const homeScore = typeof match.intHomeScore === 'string' ? parseInt(match.intHomeScore, 10) || 0 : (match.intHomeScore ?? 0);
        const awayScore = typeof match.intAwayScore === 'string' ? parseInt(match.intAwayScore, 10) || 0 : (match.intAwayScore ?? 0);

        // Atualiza tracking
        tracked[espnId] = {
          espnId,
          matchLabel: `${match.strHomeTeam} vs ${match.strAwayTeam}`,
          homeScore,
          awayScore,
          corners: 0,
          cards: 0,
          status: currStatus,
        };
        saveTracked(tracked);

        // Encontra tips pendentes para este jogo
        const pendingTips = history.filter(tip =>
          tip.result === 'pending' &&
          (tip.matchLabel.toLowerCase().includes(match.strHomeTeam.toLowerCase()) ||
           tip.matchLabel.toLowerCase().includes(match.strAwayTeam.toLowerCase()))
        );

        pendingTips.forEach(tip => {
          const result = evaluateTip(
            tip.tipLabel,
            tip.category,
            homeScore as number,
            awayScore as number,
            0, // corners - seria necessário buscar do summary
            0, // cards - seria necessário buscar do summary
            match.strHomeTeam,
            match.strAwayTeam
          );
          if (result) {
            updateResult(tip.id, result);
          }
        });
      }

      prevStatusRef.current[espnId] = currStatus;
    });
  }, [history, updateResult]);

  useEffect(() => {
    if (liveMatches.length > 0) {
      checkAndUpdateResults(liveMatches);
    }
  }, [liveMatches, checkAndUpdateResults]);
}
