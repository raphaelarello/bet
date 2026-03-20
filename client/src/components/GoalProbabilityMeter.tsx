import React, { useMemo } from 'react';
import { cn, formatPercent } from '@/lib/utils';
import type { MatchAnalysis } from '@/lib/types';
import type { LiveMatchData } from '@/hooks/useLiveMatch';
import { deriveLiveProjection, parseLiveClockToMinute } from '@/lib/liveProjection';
import { Zap, Activity, TrendingUp, TrendingDown, Minus, Shield, Target, ShieldAlert } from 'lucide-react';

function poissonAtLeastOne(lambda: number): number {
  if (lambda <= 0) return 0;
  return 1 - Math.exp(-lambda);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function calcTeamPulse(stats: LiveMatchData['homeStats'], minute: number) {
  const safeMinute = Math.max(1, minute);
  const shotsRate = (stats.shots / safeMinute) * 90;
  const shotsOnTargetRate = (stats.shotsOnTarget / safeMinute) * 90;
  const cornersRate = (stats.corners / safeMinute) * 90;
  const pressure = shotsRate * 0.28 + shotsOnTargetRate * 0.46 + cornersRate * 0.18 + (stats.possession - 50) * 0.22;
  return clamp(pressure, 0, 100);
}

interface GoalProbabilityMeterProps {
  analysis: MatchAnalysis;
  liveData: LiveMatchData | null;
}

function FormPill({ r }: { r: string }) {
  return (
    <span className={cn(
      'w-5 h-5 rounded text-[10px] font-black flex items-center justify-center flex-shrink-0',
      r === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      : r === 'D' ? 'bg-slate-600/40 text-slate-400 border border-slate-600/50'
      : 'bg-red-500/20 text-red-400 border border-red-500/30'
    )}>{r === 'W' ? 'V' : r === 'D' ? 'E' : 'D'}</span>
  );
}

function StrengthBar({ value, label, isHome }: { value: number; label: string; isHome: boolean }) {
  const pct = Math.min(100, Math.round((value / 2) * 100));
  const barColor = isHome ? 'bg-blue-500' : 'bg-amber-500';
  const textColor = isHome ? 'text-blue-400' : 'text-amber-400';
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-slate-500">{label}</span>
        <span className={cn('font-bold font-mono', textColor)}>{value.toFixed(2)}x</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function GoalProbabilityMeter({ analysis, liveData }: GoalProbabilityMeterProps) {
  const { predictions, match, homeTeamStats, awayTeamStats } = analysis;

  const data = useMemo(() => {
    const liveProjection = deriveLiveProjection(predictions, liveData);
    const isLive = !!liveProjection;
    const minute = isLive ? liveProjection.displayMinute : 0;
    const minutesRemaining = Math.max(0, 90 - minute);

    if (!isLive || !liveData || !liveProjection) {
      const home5  = poissonAtLeastOne((predictions.expectedGoalsHome / 90) * 5);
      const home10 = poissonAtLeastOne((predictions.expectedGoalsHome / 90) * 10);
      const home15 = poissonAtLeastOne((predictions.expectedGoalsHome / 90) * 15);
      const away5  = poissonAtLeastOne((predictions.expectedGoalsAway / 90) * 5);
      const away10 = poissonAtLeastOne((predictions.expectedGoalsAway / 90) * 10);
      const away15 = poissonAtLeastOne((predictions.expectedGoalsAway / 90) * 15);
      return {
        isLive: false, minute: 0, minutesRemaining: 90,
        homeProb5: Math.round(home5 * 100), homeProb10: Math.round(home10 * 100), homeProb15: Math.round(home15 * 100),
        awayProb5: Math.round(away5 * 100), awayProb10: Math.round(away10 * 100), awayProb15: Math.round(away15 * 100),
        anyGoal5: Math.round((1-(1-home5)*(1-away5))*100),
        anyGoal10: Math.round((1-(1-home10)*(1-away10))*100),
        anyGoal15: Math.round((1-(1-home15)*(1-away15))*100),
        homePulse: 50, awayPulse: 50, pressureIndex: 50, paceIndex: 1,
        homeReason: '', awayReason: '', liveProjection,
      };
    }

    const minuteNow = parseLiveClockToMinute(liveData.clock);
    const pulseHome = calcTeamPulse(liveData.homeStats, minuteNow);
    const pulseAway = calcTeamPulse(liveData.awayStats, minuteNow);
    const pressureIndex = liveProjection.pressureIndex;
    const paceIndex = liveProjection.goalPaceIndex;
    const goalDiff = Number(liveData.homeScore || 0) - Number(liveData.awayScore || 0);

    const homeRemaining = Math.max(0.02, liveProjection.liveExpectedGoalsHome - Number(liveData.homeScore || 0));
    const awayRemaining = Math.max(0.02, liveProjection.liveExpectedGoalsAway - Number(liveData.awayScore || 0));
    const homeBoost = clamp(0.82 + pulseHome/180 + (goalDiff<0?0.12:goalDiff>0?-0.04:0) + (liveData.homeStats.shotsOnTarget>liveData.awayStats.shotsOnTarget?0.05:0), 0.55, 1.55);
    const awayBoost = clamp(0.82 + pulseAway/180 + (goalDiff>0?0.12:goalDiff<0?-0.04:0) + (liveData.awayStats.shotsOnTarget>liveData.homeStats.shotsOnTarget?0.05:0), 0.55, 1.55);
    const lhpm = (homeRemaining/Math.max(1,minutesRemaining))*homeBoost;
    const lapm = (awayRemaining/Math.max(1,minutesRemaining))*awayBoost;
    const home5=poissonAtLeastOne(lhpm*Math.min(5,minutesRemaining));
    const home10=poissonAtLeastOne(lhpm*Math.min(10,minutesRemaining));
    const home15=poissonAtLeastOne(lhpm*Math.min(15,minutesRemaining));
    const away5=poissonAtLeastOne(lapm*Math.min(5,minutesRemaining));
    const away10=poissonAtLeastOne(lapm*Math.min(10,minutesRemaining));
    const away15=poissonAtLeastOne(lapm*Math.min(15,minutesRemaining));
    const homeReason = pulseHome>=pulseAway
      ? `${match.strHomeTeam} pressiona: ${liveData.homeStats.shotsOnTarget} chutes no gol, ${liveData.homeStats.corners} esc., posse ${liveData.homeStats.possession.toFixed(0)}%.`
      : `${match.strHomeTeam} com menos volume ofensivo agora.`;
    const awayReason = pulseAway>=pulseHome
      ? `${match.strAwayTeam} acelera: ${liveData.awayStats.shotsOnTarget} chutes no gol, ${liveData.awayStats.corners} esc., posse ${liveData.awayStats.possession.toFixed(0)}%.`
      : `${match.strAwayTeam} está recuado no momento.`;
    return {
      isLive:true, minute:minuteNow, minutesRemaining,
      homeProb5:Math.round(home5*100), homeProb10:Math.round(home10*100), homeProb15:Math.round(home15*100),
      awayProb5:Math.round(away5*100), awayProb10:Math.round(away10*100), awayProb15:Math.round(away15*100),
      anyGoal5:Math.round((1-(1-home5)*(1-away5))*100),
      anyGoal10:Math.round((1-(1-home10)*(1-away10))*100),
      anyGoal15:Math.round((1-(1-home15)*(1-away15))*100),
      homePulse:Math.round(pulseHome), awayPulse:Math.round(pulseAway),
      pressureIndex, paceIndex, homeReason, awayReason, liveProjection,
    };
  }, [analysis, liveData, match.strAwayTeam, match.strHomeTeam, predictions]);

  const dominantSide = data.homePulse > data.awayPulse + 8 ? 'home' : data.awayPulse > data.homePulse + 8 ? 'away' : 'balanced';
  const threatLevel = data.anyGoal15 >= 46 ? 'alto' : data.anyGoal15 >= 28 ? 'médio' : 'baixo';

  // ── Dados pré-jogo úteis para decisão ─────────────────────
  const homeForm = homeTeamStats?.form?.slice(0,5) ?? [];
  const awayForm = awayTeamStats?.form?.slice(0,5) ?? [];
  const homeWinStreak = homeTeamStats?.winStreak ?? 0;
  const awayWinStreak = awayTeamStats?.winStreak ?? 0;
  const homeScoringStreak = homeTeamStats?.scoringStreak ?? 0;
  const awayScoringStreak = awayTeamStats?.scoringStreak ?? 0;
  const homeAttack = homeTeamStats?.attackStrength ?? 1;
  const awayAttack = awayTeamStats?.attackStrength ?? 1;
  const homeDef = homeTeamStats?.defenseStrength ?? 1;
  const awayDef = awayTeamStats?.defenseStrength ?? 1;

  const xGHome = predictions.expectedGoalsHome;
  const xGAway = predictions.expectedGoalsAway;
  const over25 = predictions.over25Prob;
  const btts = predictions.bttsYesProb;



  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-300" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            {data.isLive ? 'Probabilidade ao vivo' : 'Probabilidade de gols por janela'}
          </span>
        </div>
        <div className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold',
          threatLevel==='alto'?'border-red-500/25 bg-red-500/10 text-red-300'
          :threatLevel==='médio'?'border-amber-500/25 bg-amber-500/10 text-amber-300'
          :'border-slate-700/40 bg-slate-900/70 text-slate-400'
        )}>
          <Activity className={cn('h-3 w-3', threatLevel==='alto'&&'animate-pulse')} />
          15 min: {threatLevel}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">

        {/* Coluna esquerda: tabela de probabilidades por janela */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-3">
          <div className="grid grid-cols-4 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-2">
            <div>Time</div>
            <div className="text-center">5 min</div>
            <div className="text-center">10 min</div>
            <div className="text-center">15 min</div>
          </div>
          {[
            { name: match.strHomeTeam.split(' ')[0], probs:[data.homeProb5,data.homeProb10,data.homeProb15], tone:'text-blue-300', bar:'bg-blue-500' },
            { name: match.strAwayTeam.split(' ')[0], probs:[data.awayProb5,data.awayProb10,data.awayProb15], tone:'text-amber-300', bar:'bg-amber-500' },
          ].map(team => (
            <div key={team.name} className="grid grid-cols-4 items-center gap-1 mb-2">
              <div className={cn('text-[12px] font-bold truncate', team.tone)}>{team.name}</div>
              {team.probs.map((prob, i) => (
                <div key={i} className="text-center">
                  <div className={cn('text-[13px] font-black font-mono', prob>=34?'text-emerald-300':prob>=18?'text-amber-300':'text-slate-400')}>{prob}%</div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className={cn('h-full rounded-full', team.bar)} style={{width:`${prob}%`}} />
                  </div>
                </div>
              ))}
            </div>
          ))}
          {/* Qualquer gol */}
          <div className="mt-2 pt-2 border-t border-slate-800/50">
            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wide mb-1.5">Qualquer gol</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[{l:'5 min',v:data.anyGoal5},{l:'10 min',v:data.anyGoal10},{l:'15 min',v:data.anyGoal15}].map(item => (
                <div key={item.l} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center">
                  <div className="text-[10px] text-slate-600">{item.l}</div>
                  <div className={cn('text-[16px] font-black font-mono', item.v>=46?'text-red-300':item.v>=28?'text-amber-300':'text-slate-200')}>{item.v}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ao vivo: estatísticas reais */}
          {data.isLive && liveData && (
            <div className="mt-3 pt-2 border-t border-slate-800/50 space-y-1.5">
              <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wide mb-1">Ao vivo agora</div>
              {[
                { label: 'Chutes',       home: liveData.homeStats.shots,          away: liveData.awayStats.shots },
                { label: 'No gol',       home: liveData.homeStats.shotsOnTarget,  away: liveData.awayStats.shotsOnTarget },
                { label: 'Escanteios',  home: liveData.homeStats.corners,        away: liveData.awayStats.corners },
                { label: 'Posse',        home: liveData.homeStats.possession,     away: liveData.awayStats.possession, suffix: '%' },
              ].map(({label,home,away,suffix=''}) => {
                const total = home + away;
                const pctHome = total > 0 ? Math.round((home/total)*100) : 50;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-blue-400 font-mono">{home}{suffix}</span>
                      <span className="text-slate-600">{label}</span>
                      <span className="text-amber-400 font-mono">{away}{suffix}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                      <div className="h-full bg-blue-500/60 rounded-l-full transition-all" style={{width:`${pctHome}%`}} />
                      <div className="h-full bg-amber-500/60 rounded-r-full transition-all" style={{width:`${100-pctHome}%`}} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna direita: dados de decisão pré-jogo / ao vivo */}
        <div className="space-y-2">
          {data.isLive ? (
            /* AO VIVO: dominância + interpretação */
            <>
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Quem domina agora</div>
                <div className={cn('text-[13px] font-bold mb-1',
                  dominantSide==='home'?'text-blue-300':dominantSide==='away'?'text-amber-300':'text-slate-300'
                )}>
                  {dominantSide==='home'?`${match.strHomeTeam.split(' ')[0]} pressiona mais`:
                   dominantSide==='away'?`${match.strAwayTeam.split(' ')[0]} pressiona mais`:
                   'Jogo equilibrado'}
                </div>
                <p className="text-[11px] text-slate-400">{dominantSide==='home'?data.homeReason:dominantSide==='away'?data.awayReason:data.homeReason}</p>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Leitura ao vivo</div>
                <ul className="space-y-1.5 text-[11px] text-slate-400">
                  <li>• <span className="text-slate-200 font-semibold">{formatPercent(data.anyGoal15,{digits:0})}</span> de chance de gol nos próximos 15 min</li>
                  <li>• Casa: <span className="text-blue-300 font-semibold">{data.homeProb15}%</span> · Visitante: <span className="text-amber-300 font-semibold">{data.awayProb15}%</span></li>
                  <li>• Pressão: <span className={cn('font-semibold',data.pressureIndex>60?'text-red-300':data.pressureIndex>40?'text-amber-300':'text-slate-300')}>{data.pressureIndex}/100</span></li>
                </ul>
              </div>
            </>
          ) : (
            /* PRÉ-JOGO: forma + força + mercados */
            <>
              {/* Forma recente dos dois times */}
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Forma recente</div>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-blue-300 truncate max-w-[110px]">{match.strHomeTeam.split(' ')[0]}</span>
                      {homeWinStreak > 1 && <span className="text-[10px] text-emerald-400">🔥 {homeWinStreak}V seguidas</span>}
                    </div>
                    <div className="flex gap-1">{homeForm.map((r,i)=><FormPill key={i} r={r}/>)}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-amber-300 truncate max-w-[110px]">{match.strAwayTeam.split(' ')[0]}</span>
                      {awayWinStreak > 1 && <span className="text-[10px] text-emerald-400">🔥 {awayWinStreak}V seguidas</span>}
                    </div>
                    <div className="flex gap-1">{awayForm.map((r,i)=><FormPill key={i} r={r}/>)}</div>
                  </div>
                </div>
              </div>

              {/* Força de ataque e defesa */}
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Força dos ataques</div>
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-500 font-semibold">{match.strHomeTeam.split(' ')[0]}</div>
                  <StrengthBar value={homeAttack} label="Ataque" isHome={true} />
                  <StrengthBar value={1/Math.max(0.1,homeDef)} label="Defesa sólida" isHome={true} />
                  <div className="text-[10px] text-slate-500 font-semibold mt-2">{match.strAwayTeam.split(' ')[0]}</div>
                  <StrengthBar value={awayAttack} label="Ataque" isHome={false} />
                  <StrengthBar value={1/Math.max(0.1,awayDef)} label="Defesa sólida" isHome={false} />
                </div>
              </div>

              {/* Mercados chave */}
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Mercados chave</div>
                <div className="space-y-2">
                  {[
                    { label: 'Over 2.5 gols',   pct: over25,                      txt: over25>=60?'text-emerald-400':'text-slate-400', bar: over25>=60?'bg-emerald-500':'bg-slate-600' },
                    { label: 'Ambos marcam',     pct: btts,                        txt: btts>=60?'text-emerald-400':'text-slate-400',   bar: btts>=60?'bg-emerald-500':'bg-slate-600' },
                    { label: `xG ${match.strHomeTeam.split(' ')[0]}`, pct: Math.min(100,xGHome*25), display: `${xGHome.toFixed(2)}`, txt: 'text-blue-300',  bar: 'bg-blue-500' },
                    { label: `xG ${match.strAwayTeam.split(' ')[0]}`, pct: Math.min(100,xGAway*25), display: `${xGAway.toFixed(2)}`, txt: 'text-amber-300', bar: 'bg-amber-500' },
                  ].map(({label,pct,display,txt,bar})=>(
                    <div key={label}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-500">{label}</span>
                        <span className={cn('font-bold font-mono',txt)}>{display??`${Math.round(pct)}%`}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className={cn('h-full rounded-full',bar)} style={{width:`${pct}%`,opacity:0.7}} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
