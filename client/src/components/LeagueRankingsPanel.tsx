// Rapha Guru — League Rankings Panel v1.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Exibe ranking de artilheiros e líderes em cartões da temporada
// Destaca jogadores que estão no jogo atual

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLeaguePlayerRankings } from '@/hooks/useLeaguePlayerRankings';
import type { PlayerSeasonStats } from '@/hooks/useLeaguePlayerRankings';
import { Trophy, CreditCard, Target, Zap, Users, Loader2, AlertCircle } from 'lucide-react';

// ============================================================
// COMPONENTE DE LINHA DE JOGADOR
// ============================================================

interface PlayerRowProps {
  player: PlayerSeasonStats;
  rank: number;
  isInGame?: boolean;
  statValue: number;
  statLabel: string;
  statColor: string;
  secondaryValue?: number;
  secondaryLabel?: string;
}

function PlayerRow({
  player,
  rank,
  isInGame,
  statValue,
  statLabel,
  statColor,
  secondaryValue,
  secondaryLabel,
}: PlayerRowProps) {
  const rankColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
  const rankBg = ['bg-yellow-500/10 border-yellow-500/20', 'bg-slate-600/20 border-slate-600/20', 'bg-amber-700/10 border-amber-700/20'];

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all',
      isInGame
        ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20'
        : rank <= 3
          ? rankBg[rank - 1]
          : 'bg-slate-800/30 border-slate-700/20 hover:bg-slate-800/50'
    )}>
      {/* Rank */}
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0',
        rank <= 3 ? rankColors[rank - 1] : 'text-slate-600'
      )}>
        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
      </div>

      {/* Info do jogador */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-sm font-semibold truncate',
            isInGame ? 'text-blue-300' : 'text-slate-200'
          )}>
            {player.shortName || player.name}
          </span>
          {isInGame && (
            <span className="flex-shrink-0 text-xs bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-full px-1.5 py-0.5 font-medium">
              Em campo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500 truncate">{player.teamName}</span>
          {player.positionAbbr && (
            <span className="text-xs text-slate-600 bg-slate-700/40 rounded px-1">{player.positionAbbr}</span>
          )}
          {player.appearances > 0 && (
            <span className="text-xs text-slate-600">{player.appearances} jogos</span>
          )}
        </div>
      </div>

      {/* Estatística principal */}
      <div className="text-right flex-shrink-0">
        <div className={cn('text-lg font-black font-mono', statColor)}>
          {statValue}
        </div>
        <div className="text-xs text-slate-600">{statLabel}</div>
        {secondaryValue != null && secondaryLabel && (
          <div className="text-xs text-slate-500 font-mono mt-0.5">
            {secondaryValue} {secondaryLabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

type RankingTab = 'scorers' | 'assists' | 'yellow' | 'fouls';

interface LeagueRankingsPanelProps {
  leagueId: string;
  leagueName: string;
  // Jogadores em campo (para destacar)
  homePlayerNames?: string[];
  awayPlayerNames?: string[];
}

export function LeagueRankingsPanel({
  leagueId,
  leagueName,
  homePlayerNames = [],
  awayPlayerNames = [],
}: LeagueRankingsPanelProps) {
  const [activeTab, setActiveTab] = useState<RankingTab>('scorers');
  const { rankings, loading, error, leagueSlug } = useLeaguePlayerRankings(leagueId);

  const allPlayerNames = new Set([
    ...homePlayerNames.map(n => n.toLowerCase()),
    ...awayPlayerNames.map(n => n.toLowerCase()),
  ]);

  function isInGame(player: PlayerSeasonStats): boolean {
    const name = player.name.toLowerCase();
    const shortName = player.shortName.toLowerCase();
    return allPlayerNames.has(name) || allPlayerNames.has(shortName) ||
      Array.from(allPlayerNames).some(n => name.includes(n) || n.includes(shortName));
  }

  const tabs: { id: RankingTab; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'scorers', label: 'Artilheiros', icon: Trophy, color: 'text-yellow-400' },
    { id: 'assists', label: 'Assistências', icon: Zap, color: 'text-blue-400' },
    { id: 'yellow', label: 'Cartões', icon: CreditCard, color: 'text-red-400' },
    { id: 'fouls', label: 'Faltas', icon: Target, color: 'text-orange-400' },
  ];

  if (!leagueSlug) {
    return (
      <div className="text-center py-10">
        <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Classificação não disponível para esta liga.</p>
        <p className="text-xs text-slate-600 mt-1">
          Rankings estão disponíveis para as principais ligas europeias e sul-americanas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
            Classificação da temporada
          </h4>
        </div>
        <span className="text-xs text-slate-500">{leagueName}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/40 rounded-xl p-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0',
              activeTab === id
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Icon className={cn('w-3 h-3', activeTab === id ? color : '')} />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading && (
        <div className="text-center py-10">
          <Loader2 className="w-6 h-6 text-yellow-400/50 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Carregando ranking da temporada...</p>
          <p className="text-xs text-slate-600 mt-1">Isso pode levar alguns segundos.</p>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-8">
          <AlertCircle className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      )}

      {rankings && !loading && (
        <div className="space-y-2">
          {/* Destaque de jogadores em campo */}
          {allPlayerNames.size > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2">
              <Users className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Jogadores com borda azul estão em campo neste jogo</span>
            </div>
          )}

          {/* Lista por tab ativa */}
          {activeTab === 'scorers' && (
            <div className="space-y-1.5">
              {rankings.topScorers.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">Nenhum dado disponível.</p>
              ) : (
                rankings.topScorers.map((p, i) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    rank={i + 1}
                    isInGame={isInGame(p)}
                    statValue={p.goals}
                    statLabel="gols"
                    statColor="text-yellow-400"
                    secondaryValue={p.assists}
                    secondaryLabel="ass."
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'assists' && (
            <div className="space-y-1.5">
              {rankings.topAssists.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">Nenhum dado disponível.</p>
              ) : (
                rankings.topAssists.map((p, i) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    rank={i + 1}
                    isInGame={isInGame(p)}
                    statValue={p.assists}
                    statLabel="assist."
                    statColor="text-blue-400"
                    secondaryValue={p.goals}
                    secondaryLabel="gols"
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'yellow' && (
            <div className="space-y-1.5">
              {rankings.mostYellowCards.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">Nenhum dado disponível.</p>
              ) : (
                rankings.mostYellowCards.map((p, i) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    rank={i + 1}
                    isInGame={isInGame(p)}
                    statValue={p.yellowCards}
                    statLabel="amarelos"
                    statColor="text-yellow-500"
                    secondaryValue={p.redCards}
                    secondaryLabel="verm."
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'fouls' && (
            <div className="space-y-1.5">
              {rankings.mostFouls.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">Nenhum dado disponível.</p>
              ) : (
                rankings.mostFouls.map((p, i) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    rank={i + 1}
                    isInGame={isInGame(p)}
                    statValue={p.foulsCommitted}
                    statLabel="faltas"
                    statColor="text-orange-400"
                    secondaryValue={p.yellowCards}
                    secondaryLabel="amarelos"
                  />
                ))
              )}
            </div>
          )}

          <p className="text-xs text-slate-600 text-center pt-2">
            Estatísticas da temporada atual. Atualizado a cada 10 minutos.
          </p>
        </div>
      )}
    </div>
  );
}
