import React, { useMemo } from 'react';
import type { Predictions } from '@/lib/types';
import type { LiveMatchData } from '@/hooks/useLiveMatch';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { cn, formatPercent } from '@/lib/utils';
import { Activity, ShieldAlert } from 'lucide-react';

interface PressureFlowChartProps {
  predictions: Predictions;
  liveData: LiveMatchData | null;
  homeTeam: string;
  awayTeam: string;
}

type SeriesPoint = {
  minuto: string;
  casa: number;
  visitante: number;
  saldo: number;
};

function parseMinute(clock?: string | null) {
  if (!clock) return 0;
  const clean = String(clock).replace(/'/g, '').trim();
  const plus = clean.match(/(\d+)\s*\+\s*(\d+)/);
  if (plus) return Number(plus[1]) + Number(plus[2]);
  const base = clean.match(/(\d+)/);
  return base ? Number(base[1]) : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildSeries(predictions: Predictions, liveData: LiveMatchData | null): SeriesPoint[] {
  if (!liveData?.isLive) return [];

  const minute = clamp(parseMinute(liveData.clock), 1, 90);
  const homeStats = liveData.homeStats;
  const awayStats = liveData.awayStats;
  const step = minute <= 30 ? 5 : 10;
  const marks: number[] = [];
  for (let m = 0; m < minute; m += step) marks.push(m);
  if (!marks.includes(minute)) marks.push(minute);

  const eventImpactAt = (team: 'home' | 'away', mark: number) => {
    return liveData.events.reduce((sum, ev) => {
      const evMinute = parseMinute(ev.minute);
      if (evMinute > mark || ev.teamSide !== team) return sum;
      if (ev.type === 'goal' || ev.type === 'penalty') return sum + 12;
      if (ev.type === 'own_goal') return sum + 9;
      if (ev.type === 'red_card') return sum + 7;
      if (ev.type === 'yellow_card') return sum + 1.8;
      if (ev.type === 'var') return sum + 2.5;
      return sum + 0.5;
    }, 0);
  };

  const homeBase = homeStats.shots * 3.4 + homeStats.shotsOnTarget * 5.6 + homeStats.corners * 2.1 + homeStats.possession * 0.18 + Number(liveData.homeScore || 0) * 7;
  const awayBase = awayStats.shots * 3.4 + awayStats.shotsOnTarget * 5.6 + awayStats.corners * 2.1 + awayStats.possession * 0.18 + Number(liveData.awayScore || 0) * 7;
  const maxRaw = Math.max(homeBase, awayBase, 1);

  return marks.map((mark) => {
    const progress = minute > 0 ? mark / minute : 0;
    const expectedHomeShare = predictions.expectedGoalsHome / Math.max(predictions.expectedTotalGoals, 0.01);
    const expectedAwayShare = 1 - expectedHomeShare;

    const rawHome = (homeBase * progress) + eventImpactAt('home', mark) + expectedHomeShare * 8;
    const rawAway = (awayBase * progress) + eventImpactAt('away', mark) + expectedAwayShare * 8;

    const homePressure = clamp((rawHome / maxRaw) * 78 + 10, 4, 100);
    const awayPressure = clamp((rawAway / maxRaw) * 78 + 10, 4, 100);
    const saldo = clamp(homePressure - awayPressure, -100, 100);

    return {
      minuto: `${mark}'`,
      casa: Math.round(homePressure),
      visitante: Math.round(awayPressure),
      saldo: Math.round(saldo),
    };
  });
}

function classifyDominance(lastPoint: SeriesPoint | undefined, homeTeam: string, awayTeam: string) {
  if (!lastPoint) return { title: 'Jogo equilibrado', subtitle: 'Sem dominância clara até aqui.', tone: 'text-slate-300' };
  if (lastPoint.saldo >= 12) {
    return {
      title: `${homeTeam} controla o jogo`,
      subtitle: `A pressão do mandante está ${Math.abs(lastPoint.saldo)} pontos acima do rival.`,
      tone: 'text-blue-300',
    };
  }
  if (lastPoint.saldo <= -12) {
    return {
      title: `${awayTeam} cresceu no jogo`,
      subtitle: `A pressão do visitante está ${Math.abs(lastPoint.saldo)} pontos acima do rival.`,
      tone: 'text-amber-300',
    };
  }
  return {
    title: 'Jogo parelho',
    subtitle: 'A curva de pressão mostra alternância e domínio dividido.',
    tone: 'text-slate-300',
  };
}

export function PressureFlowChart({ predictions, liveData, homeTeam, awayTeam }: PressureFlowChartProps) {
  const series = useMemo(() => buildSeries(predictions, liveData), [predictions, liveData]);
  const lastPoint = series[series.length - 1];
  const summary = classifyDominance(lastPoint, homeTeam, awayTeam);

  if (!liveData?.isLive || series.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-700/50 bg-slate-900/55 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-500" />
          <div>
            <div className="text-sm font-bold text-slate-200">Gráfico de pressão</div>
            <div className="text-xs text-slate-500 mt-1">Disponível quando a partida estiver ao vivo, com leitura visual de dominância minuto a minuto.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-700/50 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(2,6,23,0.88))] p-4 shadow-[0_18px_50px_-38px_rgba(56,189,248,0.45)]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Pressão do jogo</span>
          </div>
          <div className={cn('mt-2 text-base font-black tracking-tight', summary.tone)}>{summary.title}</div>
          <div className="mt-1 text-xs text-slate-500">{summary.subtitle}</div>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-950/45 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Leitura atual</div>
          <div className="mt-1 text-sm font-black text-slate-100">
            {homeTeam} {lastPoint.casa} <span className="text-slate-600">vs</span> {lastPoint.visitante} {awayTeam}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Saldo {lastPoint.saldo > 0 ? '+' : ''}{lastPoint.saldo} no minuto {series[series.length - 1]?.minuto}</div>
        </div>
      </div>

      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="homePressure" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="awayPressure" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" vertical={false} />
            <XAxis dataKey="minuto" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis stroke="#64748b" tickLine={false} axisLine={false} width={38} fontSize={11} domain={[0, 100]} />
            <ReferenceLine y={50} stroke="rgba(148,163,184,0.18)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                background: 'rgba(2,6,23,0.95)',
                border: '1px solid rgba(148,163,184,0.18)',
                borderRadius: '16px',
                color: '#e2e8f0',
              }}
              formatter={(value: number, name: string) => [`${value}/100`, name === 'casa' ? homeTeam : awayTeam]}
              labelFormatter={(value) => `Momento ${value}`}
            />
            <Area type="monotone" dataKey="casa" stroke="#38bdf8" strokeWidth={2.2} fill="url(#homePressure)" />
            <Area type="monotone" dataKey="visitante" stroke="#f59e0b" strokeWidth={2.2} fill="url(#awayPressure)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <div className="rounded-2xl border border-slate-700/40 bg-slate-950/35 px-3 py-2.5">
          <div className="text-slate-500 uppercase tracking-[0.16em] text-[10px]">Dominância atual</div>
          <div className="mt-1 font-bold text-slate-100">{Math.abs(lastPoint.saldo)} pontos de vantagem</div>
        </div>
        <div className="rounded-2xl border border-slate-700/40 bg-slate-950/35 px-3 py-2.5">
          <div className="text-slate-500 uppercase tracking-[0.16em] text-[10px]">Gol no 1º tempo</div>
          <div className="mt-1 font-bold text-cyan-300">{formatPercent(predictions.firstHalfGoalProb, { digits: 1 })}</div>
        </div>
        <div className="rounded-2xl border border-slate-700/40 bg-slate-950/35 px-3 py-2.5">
          <div className="text-slate-500 uppercase tracking-[0.16em] text-[10px]">Leitura visual</div>
          <div className="mt-1 font-bold text-slate-100">Atualiza conforme posse, chutes, cantos e eventos.</div>
        </div>
      </div>
    </div>
  );
}

export default PressureFlowChart;
