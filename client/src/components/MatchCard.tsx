// Rapha Guru — MatchCard v10.0 "Stadium Glass"
// Visual premium: escudos maiores, stats ao vivo (escanteios + cartões) inline
// Mantém toda lógica existente + enrichment de stats ao vivo sem hook (props)

import React from 'react';
import { cn } from '@/lib/utils';
import type { Match } from '@/lib/types';

// ── Logo da liga via ESPN CDN ─────────────────────────────────────────────────
function LeagueBadge({ leagueId, leagueName }: { leagueId?: string; leagueName?: string }) {
  if (!leagueId) return null;
  return (
    <img
      src={`https://a.espncdn.com/i/leaguelogos/soccer/500/${leagueId}.png`}
      alt={leagueName || ''}
      width={13}
      height={13}
      style={{ width: 13, height: 13, objectFit: 'contain', flexShrink: 0, opacity: 0.55 }}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ── Escudo do time ───────────────────────────────────────────────────────────
function Escudo({ url, nome, sz = 22 }: { url?: string; nome: string; sz?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={nome}
        width={sz}
        height={sz}
        style={{ width: sz, height: sz, objectFit: 'contain', flexShrink: 0 }}
        onError={e => {
          const img = e.currentTarget as HTMLImageElement;
          img.style.display = 'none';
          const fb = document.createElement('div');
          fb.style.cssText = `width:${sz}px;height:${sz}px;border-radius:4px;flex-shrink:0;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:${Math.floor(sz * .45)}px;font-weight:800;color:rgba(255,255,255,0.3)`;
          fb.textContent = nome.charAt(0).toUpperCase();
          img.parentElement?.appendChild(fb);
        }}
      />
    );
  }
  return (
    <div style={{
      width: sz, height: sz, borderRadius: 4, flexShrink: 0,
      background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: Math.floor(sz * .45), fontWeight: 800,
      color: 'rgba(255,255,255,0.28)',
    }}>
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtHora(t?: string) {
  if (!t) return '--:--';
  const p = t.split(':');
  return p.length >= 2 ? `${p[0]}:${p[1]}` : t;
}

function getKickoff(match: Match): Date | null {
  if (!match.dateEvent) return null;
  const time = (match.strTime || '12:00:00').slice(0, 8);
  const d = new Date(`${match.dateEvent}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function começaEm(match: Match, horas = 6) {
  if (match.strStatus === 'In Progress' || match.strStatus === 'Match Finished') return false;
  const ko = getKickoff(match);
  if (!ko) return false;
  const diff = ko.getTime() - Date.now();
  return diff > 0 && diff <= horas * 60 * 60 * 1000;
}

// ── Mini pill ─────────────────────────────────────────────────────────────────
function MiniPill({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    red:    'border-red-500/35 bg-red-500/12 text-red-300',
    amber:  'border-amber-500/35 bg-amber-500/12 text-amber-300',
    emerald:'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    blue:   'border-blue-500/30 bg-blue-500/10 text-blue-300',
    slate:  'border-slate-600/50 bg-slate-800/50 text-slate-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] leading-none',
      colors[color] ?? colors.slate,
    )}>
      {children}
    </span>
  );
}

// ── Live stats inline (escanteios + cartões) ──────────────────────────────────
interface LiveInlineStats {
  homeCorners?: number;
  awayCorners?: number;
  homeYellow?: number;
  awayYellow?: number;
  homeRed?: number;
  awayRed?: number;
}

function LiveStatsRow({ stats }: { stats: LiveInlineStats }) {
  const hasCorners = stats.homeCorners != null || stats.awayCorners != null;
  const hasCards = (stats.homeYellow ?? 0) + (stats.awayYellow ?? 0) + (stats.homeRed ?? 0) + (stats.awayRed ?? 0) > 0;

  if (!hasCorners && !hasCards) return null;

  return (
    <div className="flex items-center gap-2.5 mt-1.5 pl-[30px]">
      {hasCorners && (
        <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400/90">
          {/* Corner flag icon SVG inline */}
          <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1 1 L9 1 L9 9" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="1" cy="1" r="1.2"/>
          </svg>
          <span className="text-slate-300">{stats.homeCorners ?? 0}</span>
          <span className="text-slate-600">–</span>
          <span className="text-slate-300">{stats.awayCorners ?? 0}</span>
        </span>
      )}
      {hasCards && (
        <span className="inline-flex items-center gap-1 text-[10px] font-black">
          {/* Yellow card */}
          <span className="inline-block w-2.5 h-3 rounded-[2px] bg-yellow-400" style={{ flexShrink: 0 }} />
          <span className="text-slate-300">{(stats.homeYellow ?? 0) + (stats.awayYellow ?? 0)}</span>
          {((stats.homeRed ?? 0) + (stats.awayRed ?? 0)) > 0 && (
            <>
              <span className="inline-block w-2.5 h-3 rounded-[2px] bg-red-500 ml-0.5" style={{ flexShrink: 0 }} />
              <span className="text-red-300">{(stats.homeRed ?? 0) + (stats.awayRed ?? 0)}</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}

// ── Match Card principal ───────────────────────────────────────────────────────
export interface MatchCardProps {
  match: Match;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  hasValueBet?: boolean;
  hasHighConfidence?: boolean;
  filterBadge?: React.ReactNode;
  liveStats?: LiveInlineStats;
}

export function MatchCard({
  match, isSelected, onClick, hasValueBet, hasHighConfidence, filterBadge, liveStats,
}: MatchCardProps) {
  const aoVivo   = match.strStatus === 'In Progress';
  const encerrou = match.strStatus === 'Match Finished';
  const emBreve  = começaEm(match, 6);
  const temPl    = match.intHomeScore != null && match.intHomeScore !== ''
                && match.intAwayScore != null && match.intAwayScore !== '';
  const gH = temPl ? Number(match.intHomeScore) : null;
  const gA = temPl ? Number(match.intAwayScore) : null;
  const homeLead = gH != null && gA != null && gH > gA;
  const awayLead = gH != null && gA != null && gA > gH;

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        'w-full text-left transition-all duration-100 group',
        'border-b border-white/[0.035] last:border-b-0',
        isSelected
          ? 'bg-blue-500/[0.10] border-l-[3px] border-l-blue-500 pl-0'
          : aoVivo
            ? 'bg-gradient-to-r from-red-950/20 to-transparent border-l-[3px] border-l-red-500/80 hover:from-red-950/30'
            : encerrou
              ? 'border-l-[3px] border-l-slate-700/40 hover:bg-white/[0.02]'
              : 'border-l-[3px] border-l-transparent hover:bg-white/[0.025] hover:border-l-blue-500/30',
      )}
    >
      <div className="flex items-stretch min-h-[58px]">

        {/* Col 1: Hora / Status ─ 56px */}
        <div className="w-[56px] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1">
          <LeagueBadge leagueId={match.idLeague || match.espnLeagueId} leagueName={match.strLeague} />

          {aoVivo ? (
            <div className="flex flex-col items-center gap-0.5 mt-0.5">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                {match.liveDisplayClock && (
                  <span className="text-[11px] font-black text-red-400 font-mono leading-none">
                    {match.liveDisplayClock}'
                  </span>
                )}
              </div>
              {match.liveStatusLabel && (
                <span className="text-[8.5px] text-red-400/60 leading-none text-center w-full truncate px-0.5">
                  {match.liveStatusLabel}
                </span>
              )}
            </div>
          ) : encerrou ? (
            <span className="text-[10px] font-black text-slate-600 mt-0.5">FT</span>
          ) : emBreve ? (
            <div className="flex flex-col items-center gap-0.5 mt-0.5">
              <span className="text-[10px] font-black text-amber-400 font-mono leading-none">
                {fmtHora(match.strTime)}
              </span>
              <span className="text-[8px] text-amber-500/60 leading-none">Em breve</span>
            </div>
          ) : (
            <span className="text-[12px] font-bold text-slate-300 font-mono mt-0.5">
              {fmtHora(match.strTime)}
            </span>
          )}
        </div>

        {/* Col 2: Times + badges ─ flex-1 */}
        <div className="flex-1 min-w-0 py-2 pr-2 flex flex-col justify-center">

          {/* Casa */}
          <div className="flex items-center gap-2 mb-1">
            <Escudo url={match.strHomeTeamBadge} nome={match.strHomeTeam} sz={20} />
            <span className={cn(
              'text-[13px] font-semibold truncate leading-tight transition-colors',
              homeLead ? 'text-white font-bold' : aoVivo ? 'text-slate-100' : 'text-slate-200',
            )}>
              {match.strHomeTeam}
            </span>
            {homeLead && aoVivo && (
              <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </div>

          {/* Visitante */}
          <div className="flex items-center gap-2">
            <Escudo url={match.strAwayTeamBadge} nome={match.strAwayTeam} sz={20} />
            <span className={cn(
              'text-[13px] font-semibold truncate leading-tight transition-colors',
              awayLead ? 'text-white font-bold' : 'text-slate-400',
            )}>
              {match.strAwayTeam}
            </span>
            {awayLead && aoVivo && (
              <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </div>

          {/* Live stats — escanteios e cartões */}
          {aoVivo && liveStats && <LiveStatsRow stats={liveStats} />}

          {/* Filter badge */}
          {filterBadge && <div className="mt-1 pl-[28px]">{filterBadge}</div>}
        </div>

        {/* Col 3: Badges (sem placar) */}
        {!temPl && (hasValueBet || hasHighConfidence || emBreve) && (
          <div className="flex flex-col items-end justify-center gap-1 pr-2 flex-shrink-0">
            {hasValueBet && <MiniPill color="emerald">Valor</MiniPill>}
            {hasHighConfidence && !hasValueBet && <MiniPill color="amber">Top</MiniPill>}
            {emBreve && !hasValueBet && !hasHighConfidence && <MiniPill color="slate">Breve</MiniPill>}
          </div>
        )}

        {/* Col 4: Placar ─ 44px */}
        <div className="w-[44px] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 py-2.5 pr-2">
          {temPl ? (
            <>
              <span className={cn(
                'text-[15px] font-black tabular-nums leading-none',
                aoVivo
                  ? homeLead ? 'text-white' : 'text-red-300'
                  : homeLead ? 'text-white' : 'text-slate-500',
              )}>
                {match.intHomeScore}
              </span>
              <span className="text-[9px] text-slate-700 leading-none my-0.5">–</span>
              <span className={cn(
                'text-[15px] font-black tabular-nums leading-none',
                aoVivo
                  ? awayLead ? 'text-white' : 'text-red-300'
                  : awayLead ? 'text-white' : 'text-slate-500',
              )}>
                {match.intAwayScore}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-bold text-slate-700">vs</span>
          )}
        </div>

      </div>
    </button>
  );
}
