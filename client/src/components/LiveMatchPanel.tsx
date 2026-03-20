// Design: "Estádio Noturno" — Premium Sports Dark
// Componente: LiveMatchPanel — Painel de dados ao vivo com polling automático

import { motion, AnimatePresence } from 'framer-motion';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import type { Match } from '@/lib/types';
import {
  Activity, Clock, Zap, Target, Flag, AlertTriangle,
  RefreshCw, Wifi, WifiOff, ChevronRight, ArrowLeftRight
} from 'lucide-react';

interface LiveMatchPanelProps {
  match: Match;
}

// Ícone e cor por tipo de evento
function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'goal':
      return <span className="text-lg">⚽</span>;
    case 'penalty':
      return <span className="text-lg">🎯</span>;
    case 'own_goal':
      return <span className="text-lg">😬</span>;
    case 'yellow_card':
      return <span className="inline-block w-3.5 h-4.5 bg-yellow-400 rounded-sm" style={{height:'18px',width:'13px'}} />;
    case 'red_card':
      return <span className="inline-block w-3.5 h-4.5 bg-red-500 rounded-sm" style={{height:'18px',width:'13px'}} />;
    case 'yellow_red_card':
      return (
        <span className="relative inline-block" style={{width:'18px',height:'18px'}}>
          <span className="absolute left-0 top-0 inline-block bg-yellow-400 rounded-sm" style={{width:'11px',height:'16px'}} />
          <span className="absolute right-0 top-0 inline-block bg-red-500 rounded-sm" style={{width:'11px',height:'16px'}} />
        </span>
      );
    case 'substitution':
      return <ArrowLeftRight className="w-4 h-4 text-blue-400" />;
    case 'var':
      return <span className="text-xs font-bold text-purple-400">VAR</span>;
    default:
      return <ChevronRight className="w-4 h-4 text-gray-400" />;
  }
}

// Barra de estatística comparativa
function StatBar({
  label, homeVal, awayVal, unit = '', isPercentage = false
}: {
  label: string;
  homeVal: number;
  awayVal: number;
  unit?: string;
  isPercentage?: boolean;
}) {
  const total = homeVal + awayVal;
  const homePct = total > 0 ? (homeVal / total) * 100 : 50;
  const awayPct = total > 0 ? (awayVal / total) * 100 : 50;

  const displayHome = isPercentage ? `${homeVal.toFixed(1)}%` : `${homeVal}${unit}`;
  const displayAway = isPercentage ? `${awayVal.toFixed(1)}%` : `${awayVal}${unit}`;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-semibold text-blue-300">{displayHome}</span>
        <span className="text-xs text-gray-400 text-center flex-1 mx-2">{label}</span>
        <span className="text-sm font-semibold text-orange-300">{displayAway}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-700/50">
        <motion.div
          className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-l-full"
          initial={{ width: '50%' }}
          animate={{ width: `${homePct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-gradient-to-l from-orange-600 to-orange-400 rounded-r-full"
          initial={{ width: '50%' }}
          animate={{ width: `${awayPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// Status badge do jogo
function StatusBadge({ statusDetail, isLive, isFinished }: { statusDetail: string; isLive: boolean; isFinished: boolean }) {
  if (isLive) {
    return (
      <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 rounded-full px-3 py-1">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-400 text-xs font-bold tracking-wide">{statusDetail || 'Ao Vivo'}</span>
      </div>
    );
  }
  if (isFinished) {
    return (
      <div className="flex items-center gap-1.5 bg-gray-600/30 border border-gray-600/40 rounded-full px-3 py-1">
        <span className="text-slate-400 text-xs font-semibold">Encerrado</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/40 rounded-full px-3 py-1">
      <Clock className="w-3 h-3 text-blue-400" />
      <span className="text-blue-400 text-xs font-semibold">EM BREVE</span>
    </div>
  );
}

export default function LiveMatchPanel({ match }: LiveMatchPanelProps) {
  const isLiveOrRecent = match.strStatus === 'In Progress' || match.strStatus === 'Match Finished';
  const { liveData, loading } = useLiveMatch(match.idEvent, isLiveOrRecent);

  // Traduz descrição de status
  const translateStatus = (desc: string): string => {
    const map: Record<string, string> = {
      'First Half': '1º Tempo',
      'Second Half': '2º Tempo',
      'Halftime': 'Intervalo',
      'Full Time': 'Tempo Normal',
      'Extra Time First Half': 'Prorrogação 1º Tempo',
      'Extra Time Second Half': 'Prorrogação 2º Tempo',
      'Penalty Shootout': 'Pênaltis',
      'Final': 'Encerrado',
      'Scheduled': 'Agendado',
      'In Progress': 'Em Andamento',
      'Postponed': 'Adiado',
      'Suspended': 'Suspenso',
      'Abandoned': 'Abandonado',
    };
    return map[desc] || desc;
  };

  if (loading && !liveData) {
    return (
      <div className="flex items-center justify-center py-8 gap-3">
        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
        <span className="text-gray-400 text-sm">Carregando dados ao vivo...</span>
      </div>
    );
  }

  if (!liveData) {
    // Jogo ainda não começou
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-blue-400" />
        </div>
        <p className="text-gray-300 font-medium mb-1">Jogo ainda não iniciou</p>
        <p className="text-gray-500 text-sm">
          Os dados ao vivo serão carregados automaticamente quando o jogo começar.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-gray-500 text-xs">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Atualização automática a cada 30 segundos</span>
        </div>
      </div>
    );
  }

  const { homeStats, awayStats, events, isLive, isFinished, statusDetail, clock, period } = liveData;

  // Traduz o status detail
  const statusLabel = (() => {
    if (isLive) {
      if (period === 1) return `1º Tempo • ${clock}`;
      if (period === 2) return `2º Tempo • ${clock}`;
      if (period === 3) return `Prorrogação 1T • ${clock}`;
      if (period === 4) return `Prorrogação 2T • ${clock}`;
      if (period === 5) return `Pênaltis`;
      return translateStatus(statusDetail);
    }
    return translateStatus(statusDetail);
  })();

  // Filtra eventos relevantes (sem substituições para não poluir)
  const keyEvents = events.filter(e => e.type !== 'substitution' && e.type !== 'other');
  const allEvents = [...events].reverse(); // Mais recentes primeiro

  return (
    <div className="space-y-5">
      {/* Header: Status e Placar ao vivo */}
      <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-gray-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <StatusBadge statusDetail={statusLabel} isLive={isLive} isFinished={isFinished} />
          <div className="flex items-center gap-1.5 text-gray-500 text-xs">
            <Wifi className="w-3 h-3 text-green-400" />
            <span className="text-green-400">ESPN API</span>
            <span>• atualiza a cada 30s</span>
          </div>
        </div>

        {/* Placar grande */}
        <div className="flex items-center justify-between py-3">
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-2 mb-1">
              {match.strHomeTeamBadge && (
                <img src={match.strHomeTeamBadge} alt={match.strHomeTeam} className="w-8 h-8 object-contain" />
              )}
              <span className="text-sm font-semibold text-white truncate max-w-[100px]">{match.strHomeTeam}</span>
            </div>
            <span className="text-xs text-blue-300 font-medium">Casa</span>
          </div>

          <div className="flex items-center gap-3 px-4">
            <motion.span
              key={liveData.homeScore}
              initial={{ scale: 1.3, color: '#60a5fa' }}
              animate={{ scale: 1, color: '#ffffff' }}
              className="text-4xl font-black tabular-nums"
            >
              {liveData.homeScore || '0'}
            </motion.span>
            <span className="text-2xl text-gray-500 font-light">–</span>
            <motion.span
              key={liveData.awayScore}
              initial={{ scale: 1.3, color: '#fb923c' }}
              animate={{ scale: 1, color: '#ffffff' }}
              className="text-4xl font-black tabular-nums"
            >
              {liveData.awayScore || '0'}
            </motion.span>
          </div>

          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white truncate max-w-[100px]">{match.strAwayTeam}</span>
              {match.strAwayTeamBadge && (
                <img src={match.strAwayTeamBadge} alt={match.strAwayTeam} className="w-8 h-8 object-contain" />
              )}
            </div>
            <span className="text-xs text-orange-300 font-medium">Visitante</span>
          </div>
        </div>

        {/* Eventos chave (gols e cartões) em linha */}
        {keyEvents.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex flex-wrap gap-2 justify-center">
              {keyEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
                    ev.teamSide === 'home'
                      ? 'bg-blue-500/15 text-blue-300'
                      : 'bg-orange-500/15 text-orange-300'
                  }`}
                >
                  <EventIcon type={ev.type} />
                  <span className="font-medium">{ev.minute}'</span>
                  <span className="truncate max-w-[80px]">{ev.playerName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Estatísticas ao vivo */}
      <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-white">Estatísticas ao Vivo</h3>
        </div>

        <div className="flex justify-between text-xs text-gray-400 mb-3">
          <span className="text-blue-300 font-semibold truncate max-w-[100px]">{match.strHomeTeam}</span>
          <span className="text-gray-500">Estatística</span>
          <span className="text-orange-300 font-semibold truncate max-w-[100px]">{match.strAwayTeam}</span>
        </div>

        <StatBar label="Posse de Bola" homeVal={homeStats.possession} awayVal={awayStats.possession} isPercentage />
        <StatBar label="Chutes" homeVal={homeStats.shots} awayVal={awayStats.shots} />
        <StatBar label="Chutes no Gol" homeVal={homeStats.shotsOnTarget} awayVal={awayStats.shotsOnTarget} />
        <StatBar label="Escanteios" homeVal={homeStats.corners} awayVal={awayStats.corners} />
        <StatBar label="Faltas" homeVal={homeStats.fouls} awayVal={awayStats.fouls} />
        <StatBar label="Impedimentos" homeVal={homeStats.offsides} awayVal={awayStats.offsides} />
        <StatBar label="Defesas" homeVal={homeStats.saves} awayVal={awayStats.saves} />

        {/* Cartões */}
        <div className="mt-3 pt-3 border-t border-gray-700/40 grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between bg-yellow-500/10 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="inline-block bg-yellow-400 rounded-sm" style={{width:'10px',height:'14px'}} />
              <span className="text-xs text-gray-300">Amarelos</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-bold">
              <span className="text-blue-300">{homeStats.yellowCards}</span>
              <span className="text-gray-500">–</span>
              <span className="text-orange-300">{awayStats.yellowCards}</span>
            </div>
          </div>
          <div className="flex items-center justify-between bg-red-500/10 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="inline-block bg-red-500 rounded-sm" style={{width:'10px',height:'14px'}} />
              <span className="text-xs text-gray-300">Vermelhos</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-bold">
              <span className="text-blue-300">{homeStats.redCards}</span>
              <span className="text-gray-500">–</span>
              <span className="text-orange-300">{awayStats.redCards}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline de eventos */}
      {allEvents.length > 0 && (
        <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-white">Linha do Tempo</h3>
            <span className="ml-auto text-xs text-gray-500">{allEvents.length} eventos</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            <AnimatePresence>
              {allEvents.map((ev) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: ev.teamSide === 'home' ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 p-2.5 rounded-lg ${
                    ev.teamSide === 'home'
                      ? 'bg-blue-500/8 border border-blue-500/20'
                      : 'bg-orange-500/8 border border-orange-500/20 flex-row-reverse'
                  }`}
                >
                  {/* Minuto */}
                  <div className={`flex-shrink-0 w-10 text-center ${ev.teamSide === 'home' ? 'text-right' : 'text-left'}`}>
                    <span className="text-xs font-bold text-gray-400">{ev.minute}'</span>
                  </div>

                  {/* Ícone */}
                  <div className="flex-shrink-0 w-6 flex justify-center">
                    <EventIcon type={ev.type} />
                  </div>

                  {/* Descrição */}
                  <div className={`flex-1 min-w-0 ${ev.teamSide === 'away' ? 'text-right' : ''}`}>
                    <p className={`text-xs font-medium truncate ${
                      ev.teamSide === 'home' ? 'text-blue-200' : 'text-orange-200'
                    }`}>
                      {ev.description}
                    </p>
                    {ev.type === 'goal' && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ev.teamSide === 'home' ? match.strHomeTeam : match.strAwayTeam}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Aviso de atualização automática */}
      {isLive && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-1">
          <RefreshCw className="w-3 h-3 animate-spin" style={{animationDuration: '3s'}} />
          <span>Dados atualizados automaticamente a cada 30 segundos</span>
        </div>
      )}
    </div>
  );
}
