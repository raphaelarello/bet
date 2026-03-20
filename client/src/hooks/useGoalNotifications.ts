// Rapha Guru — Goal Notifications Hook v1.0
// Detecta mudanças de placar em jogos ao vivo e dispara notificações toast

import React, { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { Match } from '@/lib/types';

interface ScoreSnapshot {
  home: string | null;
  away: string | null;
}

export function useGoalNotifications(matches: Match[]) {
  const prevScores = useRef<Record<string, ScoreSnapshot>>({});

  useEffect(() => {
    const liveMatches = matches.filter(m => m.strStatus === 'In Progress');

    liveMatches.forEach(match => {
      const prev = prevScores.current[match.idEvent];
      const currentHome = match.intHomeScore ?? null;
      const currentAway = match.intAwayScore ?? null;

      if (prev) {
        const prevHomeNum = prev.home !== null ? Number(prev.home) : 0;
        const prevAwayNum = prev.away !== null ? Number(prev.away) : 0;
        const currHomeNum = currentHome !== null ? Number(currentHome) : 0;
        const currAwayNum = currentAway !== null ? Number(currentAway) : 0;

        // Gol do time da casa
        if (currHomeNum > prevHomeNum) {
          const diff = currHomeNum - prevHomeNum;
          const clock = match.liveDisplayClock;
          toast.success(`⚽ GOL! ${match.strHomeTeam}`, {
            description: `${match.strHomeTeam} ${currHomeNum}–${currAwayNum} ${match.strAwayTeam}${clock ? ` • ${clock}` : ''}`,
            duration: 8000,
            icon: diff > 1 ? '🎯' : '⚽',
          });
        }

        // Gol do time visitante
        if (currAwayNum > prevAwayNum) {
          const diff = currAwayNum - prevAwayNum;
          const clock = match.liveDisplayClock;
          toast.success(`⚽ GOL! ${match.strAwayTeam}`, {
            description: `${match.strHomeTeam} ${currHomeNum}–${currAwayNum} ${match.strAwayTeam}${clock ? ` • ${clock}` : ''}`,
            duration: 8000,
            icon: diff > 1 ? '🎯' : '⚽',
          });
        }
      }

      // Atualiza snapshot
      prevScores.current[match.idEvent] = {
        home: currentHome,
        away: currentAway,
      };
    });

    // Remove jogos que não estão mais ao vivo do snapshot
    const liveIds = new Set(liveMatches.map(m => m.idEvent));
    Object.keys(prevScores.current).forEach(id => {
      if (!liveIds.has(id)) {
        delete prevScores.current[id];
      }
    });
  }, [matches]);
}
