// Rapha Guru — Live Event Timeline v1.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Linha do tempo vertical de eventos ao vivo: gols, cartões, substituições, VAR

import { cn } from '@/lib/utils';
import type { LiveEvent, LiveMatchData } from '@/hooks/useLiveMatch';
import { Activity } from 'lucide-react';

// ============================================================
// HELPERS
// ============================================================

const EVENT_CONFIG: Record<LiveEvent['type'], {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  goal: {
    icon: '⚽',
    label: 'Gol',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/40',
  },
  penalty: {
    icon: '🎯',
    label: 'Pênalti',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/40',
  },
  own_goal: {
    icon: '⚽',
    label: 'Gol Contra',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  yellow_card: {
    icon: '🟨',
    label: 'Amarelo',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  red_card: {
    icon: '🟥',
    label: 'Vermelho',
    color: 'text-red-500',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/40',
  },
  yellow_red_card: {
    icon: '🟨🟥',
    label: '2º Amarelo',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  substitution: {
    icon: '🔄',
    label: 'Substituição',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  var: {
    icon: '📺',
    label: 'VAR',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
  other: {
    icon: '•',
    label: 'Evento',
    color: 'text-slate-500',
    bgColor: 'bg-slate-700/30',
    borderColor: 'border-slate-600/20',
  },
};

// ============================================================
// COMPONENTE DE EVENTO
// ============================================================

function EventItem({
  event,
  homeTeamName,
  awayTeamName,
  isLast,
}: {
  event: LiveEvent;
  homeTeamName: string;
  awayTeamName: string;
  isLast: boolean;
}) {
  const config = EVENT_CONFIG[event.type];
  const isHome = event.teamSide === 'home';
  const isGoal = event.type === 'goal' || event.type === 'penalty' || event.type === 'own_goal';

  return (
    <div className={cn(
      'flex items-start gap-3',
      isHome ? 'flex-row' : 'flex-row-reverse'
    )}>
      {/* Minuto */}
      <div className="flex-shrink-0 w-10 text-center">
        <span className={cn(
          'text-xs font-bold font-mono',
          isGoal ? config.color : 'text-slate-500'
        )}>
          {event.minute}'
        </span>
      </div>

      {/* Linha vertical */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center border text-sm flex-shrink-0',
          config.bgColor, config.borderColor,
          isGoal && 'ring-2 ring-offset-1 ring-offset-slate-900',
          isGoal && event.type !== 'own_goal' ? 'ring-emerald-500/40' : isGoal ? 'ring-red-500/40' : ''
        )}>
          {config.icon}
        </div>
        {!isLast && (
          <div className="w-px flex-1 min-h-[20px] bg-slate-700/40 mt-1" />
        )}
      </div>

      {/* Conteúdo */}
      <div className={cn(
        'flex-1 pb-3 min-w-0',
        isHome ? 'text-left' : 'text-right'
      )}>
        <div className={cn(
          'inline-flex flex-col rounded-lg px-3 py-2 border max-w-full',
          config.bgColor, config.borderColor,
          isGoal && 'shadow-sm'
        )}>
          {/* Tipo do evento */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('text-xs font-bold uppercase tracking-wide', config.color)}>
              {config.label}
            </span>
            <span className="text-xs text-slate-600">
              {isHome ? homeTeamName.split(' ')[0] : awayTeamName.split(' ')[0]}
            </span>
          </div>
          {/* Jogador */}
          {event.playerName && (
            <span className="text-xs font-semibold text-slate-300 mt-0.5">
              {event.playerName}
            </span>
          )}
          {/* Substituição: jogador que entra */}
          {event.type === 'substitution' && event.playerName2 && (
            <span className="text-xs text-slate-500">
              ↑ {event.playerName2}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

interface LiveEventTimelineProps {
  liveData: LiveMatchData;
  homeTeamName: string;
  awayTeamName: string;
}

export function LiveEventTimeline({
  liveData,
  homeTeamName,
  awayTeamName,
}: LiveEventTimelineProps) {
  const { events, homeScore, awayScore, clock, isLive, isFinished } = liveData;

  // Filtra apenas eventos relevantes (gols, cartões, substituições, VAR)
  const relevantEvents = events.filter(e =>
    e.type !== 'other' && e.playerName
  );

  // Separa gols para destaque
  const goals = relevantEvents.filter(e =>
    e.type === 'goal' || e.type === 'penalty' || e.type === 'own_goal'
  );

  const cards = relevantEvents.filter(e =>
    e.type === 'yellow_card' || e.type === 'red_card' || e.type === 'yellow_red_card'
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-red-400" />
          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">
            Linha do Tempo
          </h4>
          {isLive && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {clock}'
            </span>
          )}
          {isFinished && (
            <span className="text-xs text-slate-500 bg-slate-700/50 border border-slate-600/30 rounded-full px-2 py-0.5">
              Encerrado
            </span>
          )}
        </div>
        {/* Resumo rápido */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {goals.length > 0 && <span>⚽ {goals.length}</span>}
          {cards.length > 0 && <span>🟨 {cards.length}</span>}
        </div>
      </div>

      {/* Placar atual */}
      <div className="flex items-center justify-center gap-4 bg-slate-900/40 rounded-xl p-3 border border-slate-700/30">
        <div className="text-center flex-1">
          <div className="text-xs text-blue-400 font-medium truncate mb-1">{homeTeamName}</div>
          <div className="text-3xl font-black text-slate-200 font-mono">{homeScore || '0'}</div>
        </div>
        <div className="text-center">
          <div className="text-slate-600 text-lg font-bold">–</div>
          <div className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full mt-1',
            isLive ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/50 text-slate-500'
          )}>
            {isLive ? `${clock}'` : isFinished ? 'FT' : 'HT'}
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="text-xs text-amber-400 font-medium truncate mb-1">{awayTeamName}</div>
          <div className="text-3xl font-black text-slate-200 font-mono">{awayScore || '0'}</div>
        </div>
      </div>

      {/* Linha do tempo */}
      {relevantEvents.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">⏱️</div>
          <p className="text-xs text-slate-500">
            {isLive ? 'Aguardando eventos...' : 'Nenhum evento registrado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {/* Legenda */}
          <div className="flex items-center gap-3 text-xs text-slate-600 mb-3">
            <span className="flex items-center gap-1">
              <span className="w-3 h-px bg-blue-500/50" /> {homeTeamName.split(' ')[0]}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-px bg-amber-500/50" /> {awayTeamName.split(' ')[0]}
            </span>
          </div>

          {/* Eventos */}
          <div className="space-y-0">
            {relevantEvents.map((event, i) => (
              <EventItem
                key={event.id}
                event={event}
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
                isLast={i === relevantEvents.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resumo de cartões */}
      {cards.length > 0 && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/20 p-3">
          <div className="text-xs text-slate-600 font-medium uppercase tracking-wider mb-2">Cartões</div>
          <div className="flex flex-wrap gap-1.5">
            {cards.map((card, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border',
                  EVENT_CONFIG[card.type].bgColor,
                  EVENT_CONFIG[card.type].borderColor
                )}
              >
                <span>{EVENT_CONFIG[card.type].icon}</span>
                <span className="text-slate-400">{card.playerName}</span>
                <span className="text-slate-600 font-mono">{card.minute}'</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
