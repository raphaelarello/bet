// Rapha Guru — Probability Bar Component
// Design: "Estádio Noturno" — Premium Sports Dark

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProbabilityBarProps {
  value: number; // 0-100
  label?: string;
  showValue?: boolean;
  color?: 'green' | 'blue' | 'amber' | 'red' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const colorMap = {
  green: {
    bar: 'bg-emerald-500',
    glow: 'shadow-emerald-500/30',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  blue: {
    bar: 'bg-blue-500',
    glow: 'shadow-blue-500/30',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  amber: {
    bar: 'bg-amber-500',
    glow: 'shadow-amber-500/30',
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  red: {
    bar: 'bg-red-500',
    glow: 'shadow-red-500/30',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  purple: {
    bar: 'bg-purple-500',
    glow: 'shadow-purple-500/30',
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
};

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

function getColorByValue(value: number): keyof typeof colorMap {
  if (value >= 70) return 'green';
  if (value >= 55) return 'blue';
  if (value >= 40) return 'amber';
  return 'red';
}

export function ProbabilityBar({
  value,
  label,
  showValue = true,
  color,
  size = 'md',
  animated = true,
  className,
}: ProbabilityBarProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number | null>(null);
  const resolvedColor = color || getColorByValue(value);
  const colors = colorMap[resolvedColor];

  useEffect(() => {
    if (!animated) {
      setDisplayValue(value);
      return;
    }

    const startTime = performance.now();
    const duration = 800;
    const startValue = 0;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing function
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + (value - startValue) * eased));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value, animated]);

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && (
            <span className="text-xs text-slate-400 font-medium">{label}</span>
          )}
          {showValue && (
            <span className={cn('text-sm font-bold tabular-nums', colors.text)}>
              {displayValue}%
            </span>
          )}
        </div>
      )}
      <div className={cn('w-full rounded-full bg-slate-800/60', sizeMap[size])}>
        <div
          className={cn(
            'rounded-full transition-all duration-100',
            sizeMap[size],
            colors.bar,
          )}
          style={{ width: `${displayValue}%` }}
        />
      </div>
    </div>
  );
}

interface TripleProbabilityBarProps {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  homeLabel: string;
  awayLabel: string;
  animated?: boolean;
}

export function TripleProbabilityBar({
  homeProb,
  drawProb,
  awayProb,
  homeLabel,
  awayLabel,
  animated = true,
}: TripleProbabilityBarProps) {
  const [displayHome, setDisplayHome] = useState(0);
  const [displayDraw, setDisplayDraw] = useState(0);
  const [displayAway, setDisplayAway] = useState(0);

  useEffect(() => {
    if (!animated) {
      setDisplayHome(homeProb);
      setDisplayDraw(drawProb);
      setDisplayAway(awayProb);
      return;
    }

    const startTime = performance.now();
    const duration = 1000;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayHome(Math.round(homeProb * eased));
      setDisplayDraw(Math.round(drawProb * eased));
      setDisplayAway(Math.round(awayProb * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [homeProb, drawProb, awayProb, animated]);

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 mb-2 font-semibold">
        <span>Casa</span>
        <span>Empate</span>
        <span>Visitante</span>
      </div>
      <div className="flex h-10 rounded-xl overflow-hidden gap-0.5">
        <div
          className="bg-blue-600 flex items-center justify-center text-white text-sm font-black transition-all duration-100"
          style={{ width: `${displayHome}%` }}
        >
          {displayHome > 12 && `${displayHome}%`}
        </div>
        <div
          className="bg-slate-600 flex items-center justify-center text-white text-sm font-black transition-all duration-100"
          style={{ width: `${displayDraw}%` }}
        >
          {displayDraw > 10 && `${displayDraw}%`}
        </div>
        <div
          className="bg-amber-600 flex items-center justify-center text-white text-sm font-black transition-all duration-100"
          style={{ width: `${displayAway}%` }}
        >
          {displayAway > 12 && `${displayAway}%`}
        </div>
      </div>
    </div>
  );
}
