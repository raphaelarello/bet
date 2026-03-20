// Rapha Guru — Hook de controle de limites do plano
// Uso: const { canUse, check, UpgradePrompt } = useUsageLimit('analysis')

import React, { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth, PLAN_META } from '@/contexts/AuthContext';
import { Zap, Crown, X } from 'lucide-react';

// Limites por plano (espelha o banco)
const PLAN_LIMITS: Record<string, Record<string, number>> = {
  free:  { analysis: 5,   favorite: 2,  betslip_add: 3,  comparison: 1 },
  basic: { analysis: 30,  favorite: 20, betslip_add: 10, comparison: 5 },
  pro:   { analysis: -1,  favorite: -1, betslip_add: 20, comparison: -1 },
  elite: { analysis: -1,  favorite: -1, betslip_add: -1, comparison: -1 },
  admin: { analysis: -1,  favorite: -1, betslip_add: -1, comparison: -1 },
};

const UPGRADE_PLAN: Record<string, string> = {
  free: 'basic', basic: 'pro', pro: 'elite', elite: 'elite',
};

interface UsageResult {
  canUse: boolean;
  used: number;
  limit: number;
  remaining: number;
  pctUsed: number;
  upgradeNeeded: string | null;
}

export function useUsageLimit(action: string): {
  canUse: boolean;
  check(): UsageResult;
  showBlocked: boolean;
  setShowBlocked(v: boolean): void;
  UpgradePrompt: React.FC;
} {
  const { user, usage30d } = useAuth();
  const [showBlocked, setShowBlocked] = useState(false);

  const check = useCallback((): UsageResult => {
    const role   = user?.role ?? 'free';
    const limits = PLAN_LIMITS[role] ?? PLAN_LIMITS.free;
    const limit  = limits[action] ?? -1;

    if (limit === -1) return { canUse: true, used: 0, limit: -1, remaining: -1, pctUsed: 0, upgradeNeeded: null };

    const used = usage30d[action] ?? 0;
    const canUse = used < limit;
    const remaining = Math.max(0, limit - used);
    const pctUsed = Math.min(100, (used / limit) * 100);
    const upgradeNeeded = !canUse ? UPGRADE_PLAN[role] ?? 'pro' : null;

    return { canUse, used, limit, remaining, pctUsed, upgradeNeeded };
  }, [user, usage30d, action]);

  const result = check();

  // Componente de bloqueio
  const UpgradePrompt: React.FC = () => {
    const [, go] = useLocation();
    if (!showBlocked) return null;
    const upgrade = result.upgradeNeeded ?? 'pro';
    const meta    = PLAN_META[upgrade] ?? PLAN_META.pro;
    const curMeta = PLAN_META[user?.role ?? 'free'] ?? PLAN_META.free;

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 20,
      }}>
        <div style={{
          background: '#10141f', border: `1px solid ${meta.color}30`,
          borderRadius: 16, padding: '28px 28px 24px', maxWidth: 380, width: '100%',
          boxShadow: `0 30px 60px rgba(0,0,0,.5), 0 0 40px -20px ${meta.color}`,
          position: 'relative',
        }}>
          <button onClick={() => setShowBlocked(false)}
            style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', display: 'flex' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{meta.icon}</div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#e8eeff', marginBottom: 6 }}>
              Limite do plano {curMeta.name} atingido
            </h3>
            <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.5 }}>
              Você usou <strong style={{ color: curMeta.color }}>{result.used}/{result.limit}</strong> {action === 'analysis' ? 'análises hoje' : action === 'favorite' ? 'favoritos' : 'usos'}.
              Faça upgrade para continuar sem limites.
            </p>
          </div>

          {/* O que o upgrade desbloqueia */}
          <div style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}20`, borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
              Plano {meta.name} inclui:
            </div>
            {[
              action === 'analysis'   ? 'Análises ilimitadas por dia'      : '',
              action === 'favorite'   ? 'Favoritos ilimitados'              : '',
              action === 'betslip_add'? 'Betslip sem limite de seleções'    : '',
              'Value bets e alertas ao vivo',
              'Histórico completo de apostas',
            ].filter(Boolean).map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8892b0', marginBottom: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>

          <button onClick={() => { go('/planos'); setShowBlocked(false); }}
            style={{ width: '100%', padding: '13px', borderRadius: 10, background: meta.color, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
            <Zap style={{ width: 16, height: 16 }} />
            Fazer upgrade para {meta.name}
          </button>

          <button onClick={() => setShowBlocked(false)}
            style={{ width: '100%', padding: '9px', borderRadius: 8, background: 'transparent', color: '#4a5568', fontSize: 13, border: 'none', cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}>
            Continuar com o plano gratuito
          </button>
        </div>
      </div>
    );
  };

  return {
    canUse: result.canUse,
    check,
    showBlocked,
    setShowBlocked,
    UpgradePrompt,
  };
}

// ── Componente de barra de progresso do limite ─────────────────
export function UsageLimitBar({ action, label }: { action: string; label?: string }) {
  const { user, usage30d } = useAuth();
  const [, go] = useLocation();

  const role   = user?.role ?? 'free';
  const limits = PLAN_LIMITS[role] ?? PLAN_LIMITS.free;
  const limit  = limits[action] ?? -1;

  if (limit === -1) return null; // ilimitado — não mostra barra

  const used    = usage30d[action] ?? 0;
  const pct     = Math.min(100, (used / limit) * 100);
  const color   = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a5568' }}>
        <span>{label ?? action}</span>
        <span style={{ color: pct >= 80 ? color : undefined, fontWeight: pct >= 80 ? 700 : 400 }}>
          {used}/{limit}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)' }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%`, transition: 'width .4s' }} />
      </div>
      {pct >= 100 && (
        <button onClick={() => go('/planos')}
          style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'inherit' }}>
          Limite atingido → Fazer upgrade
        </button>
      )}
    </div>
  );
}
