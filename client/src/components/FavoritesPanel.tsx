// Rapha Guru — Favorites Panel v1.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Painel lateral com todos os jogos favoritados, status ao vivo e última sugestão

import { cn, getLocalTodayISO, getLocalTomorrowISO } from '@/lib/utils';
import { useFavorites } from '@/contexts/FavoritesContext';
import { Heart, Bell, BellOff, X, Activity, Clock, Trophy, Trash2 } from 'lucide-react';
import type { Match } from '@/lib/types';

// ============================================================
// HELPERS
// ============================================================

function formatDate(dateStr: string): string {
  const today = getLocalTodayISO();
  const tomorrow = getLocalTomorrowISO();
  if (dateStr === today) return 'Hoje';
  if (dateStr === tomorrow) return 'Amanhã';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ============================================================
// CARD DE JOGO FAVORITO
// ============================================================

interface FavoriteCardProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  dateEvent: string;
  alertsEnabled: boolean;
  liveMatch?: Match | null;
  onSelect?: (matchId: string) => void;
  onRemove: (matchId: string) => void;
  onToggleAlerts: (matchId: string) => void;
}

function FavoriteCard({
  matchId,
  homeTeam,
  awayTeam,
  league,
  dateEvent,
  alertsEnabled,
  liveMatch,
  onSelect,
  onRemove,
  onToggleAlerts,
}: FavoriteCardProps) {
  const isLive = liveMatch?.strStatus === 'In Progress';
  const isFinished = liveMatch?.strStatus === 'Match Finished';
  const homeScore = liveMatch?.intHomeScore;
  const awayScore = liveMatch?.intAwayScore;
  const hasScore = homeScore != null && awayScore != null;

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-all cursor-pointer group',
        isLive
          ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
          : isFinished
            ? 'border-slate-600/30 bg-slate-800/30 hover:bg-slate-800/50'
            : 'border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/50'
      )}
      onClick={() => onSelect?.(matchId)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Trophy className="w-3 h-3 text-slate-600 flex-shrink-0" />
          <span className="text-xs text-slate-500 truncate">{league}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Status ao vivo */}
          {isLive && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/30 rounded-full px-1.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Ao Vivo
            </span>
          )}
          {isFinished && (
            <span className="text-xs text-slate-600 bg-slate-700/40 border border-slate-600/30 rounded-full px-1.5 py-0.5">
              Encerrado
            </span>
          )}
          {!isLive && !isFinished && (
            <span className="text-xs text-slate-600">{formatDate(dateEvent)}</span>
          )}
          {/* Botão de alertas */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleAlerts(matchId); }}
            className={cn(
              'p-1 rounded-full transition-all',
              alertsEnabled
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-slate-600 hover:text-slate-400'
            )}
            title={alertsEnabled ? 'Desativar alertas' : 'Ativar alertas'}
          >
            {alertsEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
          </button>
          {/* Remover */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(matchId); }}
            className="p-1 rounded-full text-slate-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
            title="Remover dos favoritos"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Times e placar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-200 truncate">{homeTeam}</div>
          <div className="text-sm font-semibold text-slate-400 truncate mt-0.5">{awayTeam}</div>
        </div>
        {hasScore ? (
          <div className="flex-shrink-0 text-center">
            <div className={cn(
              'text-xl font-black font-mono',
              isLive ? 'text-red-300' : 'text-slate-300'
            )}>
              {homeScore} – {awayScore}
            </div>
            {isLive && liveMatch?.liveDisplayClock && (
              <div className="text-xs text-red-400 font-mono">{liveMatch.liveDisplayClock}'</div>
            )}
          </div>
        ) : (
          <div className="flex-shrink-0 text-center">
            <div className="text-xs text-slate-600">
              {formatDate(dateEvent)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {liveMatch?.strTime || '–'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

interface FavoritesPanelProps {
  matches: Match[];
  onSelectMatch: (matchId: string) => void;
  onClose: () => void;
}

export function FavoritesPanel({ matches, onSelectMatch, onClose }: FavoritesPanelProps) {
  const { favorites, removeFavorite, toggleAlerts, favoritesCount } = useFavorites();

  // Mapeia matches por ID para status ao vivo
  const matchById = new Map(matches.map(m => [m.idEvent, m]));

  // Separa favoritos por status
  const liveFavorites = favorites.filter(f => {
    const m = matchById.get(f.matchId);
    return m?.strStatus === 'In Progress';
  });
  const upcomingFavorites = favorites.filter(f => {
    const m = matchById.get(f.matchId);
    return !m || (m.strStatus !== 'In Progress' && m.strStatus !== 'Match Finished');
  });
  const finishedFavorites = favorites.filter(f => {
    const m = matchById.get(f.matchId);
    return m?.strStatus === 'Match Finished';
  });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Heart className="w-5 h-5 text-yellow-400 fill-current" />
          Favoritos
          {favoritesCount > 0 && (
            <span className="text-sm font-normal text-slate-500">({favoritesCount})</span>
          )}
        </h2>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-700/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Vazio */}
      {favoritesCount === 0 && (
        <div className="text-center py-12">
          <Heart className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Nenhum jogo favoritado</p>
          <p className="text-xs text-slate-600 mt-1">
            Clique no ❤️ em qualquer análise de jogo para favoritar e acompanhar aqui.
          </p>
        </div>
      )}

      {/* Ao Vivo */}
      {liveFavorites.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Ao Vivo</span>
            <span className="flex items-center gap-1 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-400">{liveFavorites.length}</span>
            </span>
          </div>
          {liveFavorites.map(fav => (
            <FavoriteCard
              key={fav.matchId}
              {...fav}
              liveMatch={matchById.get(fav.matchId)}
              onSelect={onSelectMatch}
              onRemove={removeFavorite}
              onToggleAlerts={toggleAlerts}
            />
          ))}
        </div>
      )}

      {/* Próximos */}
      {upcomingFavorites.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Próximos</span>
            <span className="text-xs text-slate-600 ml-auto">{upcomingFavorites.length}</span>
          </div>
          {upcomingFavorites.map(fav => (
            <FavoriteCard
              key={fav.matchId}
              {...fav}
              liveMatch={matchById.get(fav.matchId)}
              onSelect={onSelectMatch}
              onRemove={removeFavorite}
              onToggleAlerts={toggleAlerts}
            />
          ))}
        </div>
      )}

      {/* Encerrados */}
      {finishedFavorites.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Encerrados</span>
            <span className="text-xs text-slate-600 ml-auto">{finishedFavorites.length}</span>
          </div>
          {finishedFavorites.map(fav => (
            <FavoriteCard
              key={fav.matchId}
              {...fav}
              liveMatch={matchById.get(fav.matchId)}
              onSelect={onSelectMatch}
              onRemove={removeFavorite}
              onToggleAlerts={toggleAlerts}
            />
          ))}
        </div>
      )}

      {/* Limpar tudo */}
      {favoritesCount > 0 && (
        <div className="pt-3 border-t border-slate-700/30">
          <button
            onClick={() => {
              favorites.forEach(f => removeFavorite(f.matchId));
            }}
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-red-400 transition-all w-full justify-center py-2 rounded-lg hover:bg-red-500/5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar todos os favoritos
          </button>
        </div>
      )}
    </div>
  );
}
