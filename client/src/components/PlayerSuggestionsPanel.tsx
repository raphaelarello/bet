import { cn, formatSignedPercentDelta } from '@/lib/utils';
import type { PlayerData, MatchPlayersData } from '@/hooks/useMatchPlayers';
import { User, Target, CreditCard, Zap, Activity, Flame, Shield, Clock3 } from 'lucide-react';

function positionLabel(abbr: string): string {
  const map: Record<string, string> = {
    ST: 'Atacante', CF: 'Centroavante', LW: 'Ponta Esq.', RW: 'Ponta Dir.',
    SS: '2º Atacante', AM: 'Meia Ofensivo', CM: 'Meia', LM: 'Meia Esq.',
    RM: 'Meia Dir.', DM: 'Volante', CB: 'Zagueiro', CD: 'Zagueiro',
    LB: 'Lateral Esq.', RB: 'Lateral Dir.', WB: 'Ala', G: 'Goleiro', GK: 'Goleiro',
  };
  return map[abbr.toUpperCase()] || abbr;
}

function toneForThreat(threat: PlayerData['threatBand']) {
  switch (threat) {
    case 'elite': return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
    case 'forte': return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20';
    case 'moderada': return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
    default: return 'text-slate-400 bg-slate-800/80 border-slate-700/50';
  }
}

function toneForDiscipline(band: PlayerData['disciplineBand']) {
  switch (band) {
    case 'alta': return 'text-red-300 bg-red-500/10 border-red-500/20';
    case 'moderada': return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
    default: return 'text-slate-400 bg-slate-800/80 border-slate-700/50';
  }
}

function deltaLabel(current: number, previous: number) {
  return formatSignedPercentDelta(current - previous, 0);
}

function PlayerCard({
  player,
  mode,
  rank,
  homeTeamName,
  awayTeamName,
  compact,
}: {
  player: PlayerData;
  mode: 'goal' | 'impact' | 'card';
  rank: number;
  homeTeamName: string;
  awayTeamName: string;
  compact?: boolean;
}) {
  const teamName = player.teamSide === 'home' ? homeTeamName : awayTeamName;
  const teamTone = player.teamSide === 'home'
    ? 'text-blue-300 bg-blue-500/10 border-blue-500/20'
    : 'text-amber-300 bg-amber-500/10 border-amber-500/20';

  const headlineValue = mode === 'card' ? player.cardProbability : mode === 'impact' ? player.liveImpactScore : player.goalProbability;
  const headlineLabel = mode === 'card' ? 'risco' : mode === 'impact' ? 'impacto' : 'gol';
  const subDelta = mode === 'card'
    ? deltaLabel(player.cardProbability, player.preMatchCardProbability)
    : deltaLabel(player.goalProbability, player.preMatchGoalProbability);

  const barWidth = Math.min(100, headlineValue);
  const barColor = mode === 'card'
    ? (player.cardProbability >= 46 ? 'bg-red-500' : player.cardProbability >= 24 ? 'bg-amber-500' : 'bg-slate-500')
    : (player.goalProbability >= 36 || player.liveImpactScore >= 72 ? 'bg-emerald-500' : player.goalProbability >= 20 ? 'bg-cyan-500' : 'bg-slate-500');

  return (
    <div className={cn(
      'rounded-2xl border border-slate-700/40 bg-slate-900/45 p-3 transition-all',
      mode === 'impact' && 'border-cyan-500/20 bg-cyan-500/5',
      mode === 'goal' && player.threatBand === 'elite' && 'border-emerald-500/30 bg-emerald-500/5',
      mode === 'card' && player.disciplineBand === 'alta' && 'border-red-500/30 bg-red-500/5',
    )}>
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-950/80 text-xs font-black text-slate-200">
          {rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="truncate text-sm font-bold text-slate-100">{player.shortName}</div>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', teamTone)}>
              {teamName}
            </span>
            <span className="text-[11px] text-slate-500">{positionLabel(player.positionAbbr)}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>{player.performanceLabel}</span>
            {player.goalsInGame > 0 && <span className="text-emerald-300">⚽ {player.goalsInGame}</span>}
            {player.assistsInGame > 0 && <span className="text-cyan-300">🅰️ {player.assistsInGame}</span>}
            {player.shotsInGame > 0 && <span>{player.shotsInGame} chute{player.shotsInGame !== 1 ? 's' : ''}</span>}
            {player.shotsOnTargetInGame > 0 && <span>{player.shotsOnTargetInGame} no gol</span>}
            {player.foulsCommittedInGame > 0 && <span>{player.foulsCommittedInGame} falta{player.foulsCommittedInGame !== 1 ? 's' : ''}</span>}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-black font-mono text-slate-100">{headlineValue}%</div>
          <div className="text-[11px] text-slate-500">{headlineLabel}</div>
          <div className={cn(
            'mt-1 text-[11px] font-semibold',
            subDelta.startsWith('+') ? 'text-emerald-400' : subDelta.startsWith('-') ? 'text-red-400' : 'text-slate-500'
          )}>
            {subDelta}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className={cn('h-full rounded-full transition-all duration-700', barColor)} style={{ width: `${barWidth}%` }} />
        </div>

        <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-4')}>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Pré-jogo</div>
            <div className="mt-0.5 text-sm font-black font-mono text-slate-200">
              {mode === 'card' ? player.preMatchCardProbability : player.preMatchGoalProbability}%
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Próx. gol</div>
            <div className="mt-0.5 text-sm font-black font-mono text-emerald-300">{player.nextGoalProbability}%</div>
          </div>
          {!compact && (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Gol 15 min</div>
                <div className="mt-0.5 text-sm font-black font-mono text-cyan-300">{player.next15GoalProbability}%</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Envolvimento</div>
                <div className="mt-0.5 text-sm font-black font-mono text-slate-100">{player.involvementIndex}</div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-0.5">
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', toneForThreat(player.threatBand))}>
            Ameaça {player.threatBand}
          </span>
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', toneForDiscipline(player.disciplineBand))}>
            Disciplina {player.disciplineBand}
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ icon: Icon, label, value, tone }: { icon: typeof Flame; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/75 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
        <Icon className={cn('h-3.5 w-3.5', tone)} />
        {label}
      </div>
      <div className={cn('mt-1 text-lg font-black tracking-tight', tone)}>{value}</div>
    </div>
  );
}

interface PlayerSuggestionsPanelProps {
  playersData: MatchPlayersData;
  homeTeamName: string;
  awayTeamName: string;
  isLive: boolean;
  compact?: boolean;
}

export function PlayerSuggestionsPanel({
  playersData,
  homeTeamName,
  awayTeamName,
  isLive,
  compact = false,
}: PlayerSuggestionsPanelProps) {
  const { topScorers, topCardRisks, topLiveImpacts } = playersData;

  if (topScorers.length === 0 && topCardRisks.length === 0 && topLiveImpacts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700/30 bg-slate-900/45 p-4 text-center">
        <User className="mx-auto mb-2 h-8 w-8 text-slate-600" />
        <p className="text-xs text-slate-500">Dados de jogadores não disponíveis para este jogo.</p>
      </div>
    );
  }

  const scorersToRender = compact ? topScorers.slice(0, 3) : topScorers.slice(0, 5);
  const impactsToRender = compact ? topLiveImpacts.slice(0, 3) : topLiveImpacts.slice(0, 4);
  const cardsToRender = compact ? topCardRisks.slice(0, 3) : topCardRisks.slice(0, 5);

  return (
    <div className="space-y-4 rounded-[24px] border border-slate-700/40 bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(2,6,23,0.92))] p-4 shadow-[0_18px_60px_-42px_rgba(14,165,233,0.35)]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-300" />
            <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Leitura de jogadores</h4>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Pré-jogo + desempenho em tempo real para apoiar a melhor leitura de gol, criação e disciplina.
          </p>
        </div>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            Atualizando ao vivo
          </span>
        )}
      </div>

      <div className={cn('grid gap-3', compact ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-4')}>
        <SummaryChip icon={Flame} label="Mais quente" value={topLiveImpacts[0]?.shortName || '—'} tone="text-cyan-300" />
        <SummaryChip icon={Target} label="Melhor gol 15 min" value={topScorers[0] ? `${topScorers[0].next15GoalProbability}%` : '—'} tone="text-emerald-300" />
        <SummaryChip icon={Shield} label="Maior risco cartão" value={topCardRisks[0] ? `${topCardRisks[0].cardProbability}%` : '—'} tone="text-amber-300" />
        <SummaryChip icon={Clock3} label="Atualizado" value={new Date(playersData.lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} tone="text-slate-100" />
      </div>

      {impactsToRender.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-300" />
            <h5 className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Jogadores mais influentes agora</h5>
          </div>
          <div className="space-y-2">
            {impactsToRender.map((player, index) => (
              <PlayerCard
                key={`${player.id || player.name}-impact-${index}`}
                player={player}
                mode="impact"
                rank={index + 1}
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
                compact={compact}
              />
            ))}
          </div>
        </section>
      )}

      {scorersToRender.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-300" />
            <h5 className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Ameaça de gol por jogador</h5>
          </div>
          <div className="space-y-2">
            {scorersToRender.map((player, index) => (
              <PlayerCard
                key={`${player.id || player.name}-goal-${index}`}
                player={player}
                mode="goal"
                rank={index + 1}
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
                compact={compact}
              />
            ))}
          </div>
        </section>
      )}

      {!compact && cardsToRender.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-300" />
            <h5 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Leitura disciplinar</h5>
          </div>
          <div className="space-y-2">
            {cardsToRender.map((player, index) => (
              <PlayerCard
                key={`${player.id || player.name}-card-${index}`}
                player={player}
                mode="card"
                rank={index + 1}
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
