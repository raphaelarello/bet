// Rapha Guru — Badge de Plano + Menu do Usuário
// Adicione ao header da Home.tsx

import React, { useLocation } from 'wouter';
import { useAuth, PLAN_META } from '@/contexts/AuthContext';
import { Zap, User, LogOut, Settings, Crown, ChevronDown, Bell } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// ── Badge compacto de plano (use no header) ───────────────────
export function PlanBadge({ className }: { className?: string }) {
  const { user, subscription } = useAuth();
  if (!user) return null;

  const meta  = PLAN_META[user.role] ?? PLAN_META.free;
  const color = meta.color;

  return (
    <span className={className} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: `${color}15`, color, border: `1px solid ${color}30`,
    }}>
      {meta.icon} {meta.name}
    </span>
  );
}

// ── Menu completo do usuário (dropdown) ───────────────────────
export function UserMenu() {
  const [, go]   = useLocation();
  const { user, logout, unread, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => go('/cadastro')}
          style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#8892b0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Cadastrar
        </button>
        <button onClick={() => go('/login')}
          style={{ padding: '5px 12px', borderRadius: 7, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Entrar
        </button>
      </div>
    );
  }

  const meta  = PLAN_META[user.role] ?? PLAN_META.free;
  const color = meta.color;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 8, background: open ? 'rgba(255,255,255,.07)' : 'transparent', border: '1px solid transparent', cursor: 'pointer', transition: 'all .12s' }}>
        {/* Avatar */}
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}20`, border: `2px solid ${color}45`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        {/* Nome e plano */}
        <div style={{ textAlign: 'left', display: 'none' }} className="sm:block">
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eeff', lineHeight: 1.2 }}>{user.name.split(' ')[0]}</div>
          <div style={{ fontSize: 10, color, lineHeight: 1.2 }}>{meta.icon} {meta.name}</div>
        </div>
        {/* Unread badge */}
        {unread > 0 && (
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        <ChevronDown style={{ width: 13, height: 13, color: '#4a5568', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 6,
          width: 220, background: '#10141f', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 12, overflow: 'hidden', zIndex: 99,
          boxShadow: '0 20px 40px rgba(0,0,0,.5)',
        }}>
          {/* Header do dropdown */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', background: `${color}08` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e8eeff', marginBottom: 2 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 8 }}>{user.email}</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${color}15`, color, border: `1px solid ${color}30` }}>
              {meta.icon} {meta.name}
            </span>
          </div>

          {/* Links */}
          {[
            { icon: User,     label: 'Minha conta',  action: () => { go('/minha-conta'); setOpen(false); } },
            { icon: Bell,     label: `Notificações ${unread > 0 ? `(${unread})` : ''}`, action: () => { go('/minha-conta'); setOpen(false); } },
            { icon: Zap,      label: 'Planos e upgrade', action: () => { go('/planos'); setOpen(false); } },
            ...(isAdmin ? [{ icon: Settings, label: 'Painel admin', action: () => { go('/admin'); setOpen(false); } }] : []),
          ].map(({ icon: Icon, label, action }) => (
            <button key={label} onClick={action}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: '#8892b0', textAlign: 'left', fontFamily: 'inherit', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
              {label}
            </button>
          ))}

          <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', margin: '4px 0' }} />

          {user.role === 'free' && (
            <button onClick={() => { go('/planos'); setOpen(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'rgba(245,158,11,.05)', border: 'none', cursor: 'pointer', fontSize: 12, color: '#f59e0b', fontWeight: 700, fontFamily: 'inherit' }}>
              <Crown style={{ width: 14, height: 14 }} />
              Fazer upgrade para Pro
            </button>
          )}

          <button onClick={() => { logout(); setOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444', textAlign: 'left', fontFamily: 'inherit', transition: 'background .1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <LogOut style={{ width: 14, height: 14 }} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
