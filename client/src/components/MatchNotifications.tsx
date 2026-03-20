// Rapha Guru — Match Notifications Component v1.1
// Design: "Estádio Noturno" — Premium Sports Dark
// Painel de alertas e lembretes de jogos próximos

import React, { useMemo } from 'react';
import { Bell, Clock, Info, Zap } from 'lucide-react';
import type { Match } from '@/lib/types';
import { getLocalTodayISO } from '@/lib/utils';

interface MatchNotificationsProps {
  matches: Match[];
  onSelectMatch: (match: Match) => void;
}

export function MatchNotifications({ matches, onSelectMatch }: MatchNotificationsProps) {
  const { upcomingMatches, liveMatches } = useMemo(() => {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const today = getLocalTodayISO();

    const upcoming = matches.filter((m) => {
      if (!m.strTime || m.dateEvent !== today) return false;
      if (m.strStatus === 'Match Finished') return false;
      if (m.strStatus === 'In Progress') return false;

      const [h = '0', min = '0'] = m.strTime.split(':');
      const matchTime = new Date();
      matchTime.setHours(Number(h), Number(min), 0, 0);
      return matchTime >= now && matchTime <= oneHourFromNow;
    }).slice(0, 5);

    const live = matches.filter((m) => m.strStatus === 'In Progress').slice(0, 5);

    return { upcomingMatches: upcoming, liveMatches: live };
  }, [matches]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
        <div className="flex items-start gap-2">
          <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-blue-300">Central de alertas</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Acompanhe partidas que estão para começar e jogos já ao vivo. Para receber notificações persistentes do navegador,
              ative as permissões no bloco abaixo.
            </p>
          </div>
        </div>
      </div>

      {liveMatches.length > 0 && (
        <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Ao vivo agora</span>
            <span className="ml-auto text-xs text-red-300">{liveMatches.length}</span>
          </div>
          <div className="space-y-1.5">
            {liveMatches.map((match) => (
              <button
                key={match.idEvent}
                type="button"
                onClick={() => onSelectMatch(match)}
                className="flex w-full items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-left transition-colors hover:bg-red-500/15"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-200">
                    {match.strHomeTeam} vs {match.strAwayTeam}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">{match.strLeague}</p>
                </div>
                <div className="ml-2 flex items-center gap-1 text-[10px] font-bold text-red-300">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                  {match.liveStatusLabel || match.liveDisplayClock || 'Ao vivo'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Jogos começando em breve</span>
          <span className="ml-auto text-xs text-amber-300">{upcomingMatches.length}</span>
        </div>

        {upcomingMatches.length > 0 ? (
          <div className="space-y-1.5">
            {upcomingMatches.map((match) => {
              const now = new Date();
              const [h = '0', min = '0'] = (match.strTime || '00:00').split(':');
              const matchTime = new Date();
              matchTime.setHours(Number(h), Number(min), 0, 0);
              const minutesLeft = Math.round((matchTime.getTime() - now.getTime()) / 60000);

              return (
                <button
                  key={match.idEvent}
                  type="button"
                  onClick={() => onSelectMatch(match)}
                  className="flex w-full items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-left transition-colors hover:bg-amber-500/15"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-200">
                      {match.strHomeTeam} vs {match.strAwayTeam}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">{match.strLeague}</p>
                  </div>
                  <div className="ml-2 flex items-center gap-1 text-[10px] font-bold text-amber-300">
                    <Clock className="h-3 w-3" />
                    {minutesLeft <= 0 ? 'Agora' : `${minutesLeft} min`}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-slate-700/30 bg-slate-900/30 px-3 py-2 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
            <p>Nenhum jogo do dia está começando na próxima hora. Quando houver partidas próximas, elas vão aparecer aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
