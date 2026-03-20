// Rapha Guru — MatchCard v9.0 "SofaScore Compacto"
// Layout de linha: hora | escudo time | placar | escudo time visitante
// Mantém toda lógica do v38 (isStartingSoon, StatusChip, etc)

import React from 'react';
import { cn } from '@/lib/utils';
import type { Match } from '@/lib/types';
import { Star, TrendingUp, Timer, CalendarClock, Clock3 } from 'lucide-react';

// Logo da liga via ESPN CDN
function LeagueBadge({ leagueId, leagueName }: { leagueId?: string; leagueName?: string }) {
  if (!leagueId) return null;
  const url = `https://a.espncdn.com/i/leaguelogos/soccer/500/${leagueId}.png`;
  return (
    <img
      src={url}
      alt={leagueName || ''}
      width={14}
      height={14}
      style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0, opacity: 0.7 }}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

interface MatchCardProps {
  match: Match;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  hasValueBet?: boolean;
  hasHighConfidence?: boolean;
  filterBadge?: React.ReactNode;
}

// ── Escudo do time ─────────────────────────────────────────────
function Escudo({ url, nome, sz = 18 }: { url?: string; nome: string; sz?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={nome}
        width={sz}
        height={sz}
        style={{ width: sz, height: sz, objectFit: 'contain', flexShrink: 0, borderRadius: 2 }}
        onError={e => {
          const img = e.currentTarget as HTMLImageElement;
          img.style.display = 'none';
          const fb = document.createElement('div');
          fb.style.cssText = `width:${sz}px;height:${sz}px;border-radius:3px;flex-shrink:0;background:#1e2535;display:flex;align-items:center;justify-content:center;font-size:${Math.floor(sz * .48)}px;font-weight:700;color:#4a5568`;
          fb.textContent = nome.charAt(0).toUpperCase();
          img.parentElement?.appendChild(fb);
        }}
      />
    );
  }
  return (
    <div style={{
      width: sz, height: sz, borderRadius: 3, flexShrink: 0,
      background: '#1e2535', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: Math.floor(sz * .48), fontWeight: 700, color: '#4a5568',
    }}>
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Lógica de horário ─────────────────────────────────────────
function formatarHora(timeStr?: string): string {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':');
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return timeStr;
}

function getKickoff(match: Match): Date | null {
  if (!match.dateEvent) return null;
  const time = (match.strTime || '12:00:00').slice(0, 8) || '12:00:00';
  const kickoff = new Date(`${match.dateEvent}T${time}`);
  return Number.isNaN(kickoff.getTime()) ? null : kickoff;
}

function começaEm(match: Match, horas = 6) {
  if (match.strStatus === 'In Progress' || match.strStatus === 'Match Finished') return false;
  const kickoff = getKickoff(match);
  if (!kickoff) return false;
  const diff = kickoff.getTime() - Date.now();
  return diff > 0 && diff <= horas * 60 * 60 * 1000;
}

// ── MatchCard principal ───────────────────────────────────────
export function MatchCard({ match, isSelected, onClick, hasValueBet, hasHighConfidence, filterBadge }: MatchCardProps) {
  const aoVivo   = match.strStatus === 'In Progress';
  const encerrou = match.strStatus === 'Match Finished';
  const emBreve  = começaEm(match, 6);
  const temPl    = match.intHomeScore != null && match.intHomeScore !== ''
                && match.intAwayScore != null && match.intAwayScore !== '';
  const gH = temPl ? Number(match.intHomeScore) : null;
  const gA = temPl ? Number(match.intAwayScore) : null;

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        'w-full text-left transition-colors duration-100',
        'border-b border-white/[0.04] last:border-b-0',
        isSelected
          ? 'bg-blue-500/[0.12] border-l-2 border-l-blue-500'
          : aoVivo
            ? 'bg-red-500/[0.04] border-l-2 border-l-red-500/70 hover:bg-red-500/[0.07]'
            : 'border-l-2 border-l-transparent hover:bg-white/[0.03]'
      )}
    >
      <div className="flex items-center">

        {/* Hora + Logo Liga — 54px fixo */}
        <div className={cn(
          'w-[54px] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 py-3 px-1',
        )}>
          <LeagueBadge leagueId={match.idLeague || match.espnLeagueId} leagueName={match.strLeague} />
          {aoVivo ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {match.liveDisplayClock && (
                <span className="text-[10px] font-black text-red-400 font-mono leading-none mt-0.5">
                  {match.liveDisplayClock}'
                </span>
              )}
            </>
          ) : encerrou ? (
            <span className="text-[11px] font-bold text-slate-600">FT</span>
          ) : emBreve ? (
            <>
              <Timer className="h-3.5 w-3.5 text-amber-500/70" />
              <span className="text-[10px] font-bold text-amber-400 font-mono leading-none mt-0.5">
                {formatarHora(match.strTime)}
              </span>
            </>
          ) : (
            <span className="text-[13px] font-bold text-slate-300 font-mono">
              {formatarHora(match.strTime)}
            </span>
          )}
        </div>

        {/* Times — flex-1 */}
        <div className="flex-1 min-w-0 py-2.5 pr-2">
          {/* Time da casa */}
          <div className="flex items-center gap-2 mb-[5px]">
            <Escudo url={match.strHomeTeamBadge} nome={match.strHomeTeam} sz={16} />
            <span className={cn(
              'text-[13.5px] font-semibold truncate leading-tight',
              temPl && gH != null && gA != null && gH > gA
                ? 'text-white font-bold'
                : aoVivo ? 'text-slate-100' : 'text-slate-200'
            )}>
              {match.strHomeTeam}
            </span>
          </div>

          {/* Time visitante */}
          <div className="flex items-center gap-2">
            <Escudo url={match.strAwayTeamBadge} nome={match.strAwayTeam} sz={16} />
            <span className={cn(
              'text-[13.5px] font-semibold truncate leading-tight',
              temPl && gH != null && gA != null && gA > gH
                ? 'text-white font-bold'
                : 'text-slate-400'
            )}>
              {match.strAwayTeam}
            </span>
          </div>
          {/* Badge de filtro — renderizado no fluxo, sem absolute */}
          {filterBadge && (
            <div className="mt-1 pl-[24px]">{filterBadge}</div>
          )}
        </div>

        {/* Badges — apenas quando não tem placar */}
        {!temPl && (hasValueBet || hasHighConfidence) && (
          <div className="flex flex-col items-end gap-1 pr-1.5">
            {hasValueBet && (
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 rounded px-1.5 py-0.5 leading-none whitespace-nowrap uppercase tracking-wide">
                Valor
              </span>
            )}
            {hasHighConfidence && !hasValueBet && (
              <span className="text-[9px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/25 rounded px-1.5 py-0.5 leading-none whitespace-nowrap uppercase tracking-wide">
                Top
              </span>
            )}
          </div>
        )}

        {/* Em breve badge */}
        {!temPl && emBreve && !hasValueBet && !hasHighConfidence && (
          <div className="pr-2">
            <span className="text-[9px] font-bold text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 whitespace-nowrap">
              Em breve
            </span>
          </div>
        )}

        {/* Placar — 46px fixo */}
        <div className="w-[46px] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 py-2.5 pr-2">
          {temPl ? (
            <>
              <span className={cn(
                'text-[15px] font-black tabular-nums leading-none',
                aoVivo ? 'text-red-300' : gH != null && gA != null && gH > gA ? 'text-white' : 'text-slate-500'
              )}>
                {match.intHomeScore}
              </span>
              <span className="text-[10px] text-slate-700 leading-none">–</span>
              <span className={cn(
                'text-[15px] font-black tabular-nums leading-none',
                aoVivo ? 'text-red-300' : gH != null && gA != null && gA > gH ? 'text-white' : 'text-slate-500'
              )}>
                {match.intAwayScore}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-bold text-slate-700">vs</span>
          )}
        </div>

      </div>
    </button>
  );
}
