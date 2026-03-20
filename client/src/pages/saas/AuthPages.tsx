// Rapha Guru — Páginas de Login e Cadastro

import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Trophy, Loader2, Mail, Lock, User, ArrowRight, CheckCircle2 } from 'lucide-react';

// ── Campo de input reutilizável ───────────────────────────────
function Field({
  type = 'text', placeholder, value, onChange, Icon, right, error,
}: {
  type?: string; placeholder: string; value: string; onChange(v: string): void;
  Icon: React.ElementType; right?: React.ReactNode; error?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <Icon style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        width: 15, height: 15, color: focused ? '#60a5fa' : error ? '#ef4444' : '#4a5568',
        transition: 'color .15s', pointerEvents: 'none',
      }} />
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '12px 40px 12px 42px', fontSize: 14,
          borderRadius: 10, outline: 'none', background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${focused ? '#3b82f6' : error ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
          color: '#e8eeff', transition: 'border-color .15s',
        }}
      />
      {right && (
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
          {right}
        </div>
      )}
    </div>
  );
}

// ── Barra de força da senha ───────────────────────────────────
function PasswordStrength({ pwd }: { pwd: string }) {
  if (!pwd) return null;
  const score = [pwd.length >= 8, /[A-Z]/.test(pwd), /[0-9]/.test(pwd), /[^A-Za-z0-9]/.test(pwd)].filter(Boolean).length;
  const map = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? colors[score] : 'rgba(255,255,255,0.08)', transition: 'background .2s' }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: colors[score], fontWeight: 600 }}>{map[score]}</span>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────
export function LoginPage() {
  const [, go] = useLocation();
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [pass,  setPass]        = useState('');
  const [show,  setShow]        = useState(false);
  const [err,   setErr]         = useState('');
  const [busy,  setBusy]        = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const ok = await login(email, pass);
    setBusy(false);
    if (ok) go('/'); else setErr('Email ou senha incorretos');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Trophy style={{ width: 26, height: 26, color: '#f59e0b' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#e8eeff', letterSpacing: '-.02em', marginBottom: 4 }}>Rapha Guru</h1>
          <p style={{ fontSize: 13, color: '#4a5568' }}>Análise profissional de probabilidades</p>
        </div>

        {/* Card */}
        <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '28px 28px 24px' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eeff', marginBottom: 4 }}>Entrar na conta</h2>
          <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 22 }}>
            Sem conta?{' '}
            <button onClick={() => go('/cadastro')} style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Criar agora grátis
            </button>
          </p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field type="email" placeholder="seu@email.com" value={email} onChange={setEmail} Icon={Mail} error={!!err} />
            <Field type={show ? 'text' : 'password'} placeholder="Senha" value={pass} onChange={setPass} Icon={Lock} error={!!err}
              right={
                <button type="button" onClick={() => setShow(s => !s)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', display: 'flex', padding: 0 }}>
                  {show ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              }
            />

            {err && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', fontSize: 13, color: '#ef4444' }}>
                {err}
              </div>
            )}

            <button type="submit" disabled={busy || !email || !pass}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, padding: '13px', borderRadius: 10, background: busy || !email || !pass ? '#1c2335' : '#3b82f6', color: busy || !email || !pass ? '#4a5568' : '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: busy || !email || !pass ? 'default' : 'pointer', transition: 'all .15s' }}>
              {busy ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <ArrowRight style={{ width: 16, height: 16 }} />}
              {busy ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button onClick={() => go('/esqueci-senha')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 12, textDecoration: 'underline' }}>
              Esqueci minha senha
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── CADASTRO ──────────────────────────────────────────────────
export function RegisterPage() {
  const [, go] = useLocation();
  const { register } = useAuth();
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [show,  setShow]  = useState(false);
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const ok = await register(email, name, pass);
    setBusy(false);
    if (ok) go('/'); else setErr('Erro ao criar conta. Tente outro e-mail.');
  };

  const perks = ['5 análises gratuitas por dia', 'Probabilidades em tempo real', 'Sem cartão de crédito', 'Upgrade quando quiser'];

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 800, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>

        {/* Esquerda */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trophy style={{ width: 20, height: 20, color: '#f59e0b' }} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#e8eeff' }}>Rapha Guru</span>
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#e8eeff', lineHeight: 1.2, marginBottom: 10, letterSpacing: '-.02em' }}>
            Análise profissional<br />
            <span style={{ color: '#60a5fa' }}>de probabilidades</span>
          </h2>
          <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.65, marginBottom: 22 }}>
            Mais de 40 métricas por partida — gols, escanteios, cartões, handicap asiático, value bets e muito mais.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {perks.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#8892b0' }}>
                <CheckCircle2 style={{ width: 16, height: 16, color: '#22c55e', flexShrink: 0 }} />
                {p}
              </div>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '28px 28px 24px' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eeff', marginBottom: 4 }}>Criar conta gratuita</h2>
          <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 22 }}>
            Já tem conta?{' '}
            <button onClick={() => go('/login')} style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Entrar
            </button>
          </p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field placeholder="Nome completo" value={name} onChange={setName} Icon={User} />
            <Field type="email" placeholder="seu@email.com" value={email} onChange={setEmail} Icon={Mail} />
            <div>
              <Field type={show ? 'text' : 'password'} placeholder="Senha (mín. 8 caracteres)" value={pass} onChange={setPass} Icon={Lock}
                right={
                  <button type="button" onClick={() => setShow(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', display: 'flex', padding: 0 }}>
                    {show ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                }
              />
              <PasswordStrength pwd={pass} />
            </div>

            {err && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', fontSize: 13, color: '#ef4444' }}>
                {err}
              </div>
            )}

            <button type="submit" disabled={busy || !name || !email || pass.length < 8}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, padding: '13px', borderRadius: 10, background: busy || !name || !email || pass.length < 8 ? '#1c2335' : '#3b82f6', color: busy || !name || !email || pass.length < 8 ? '#4a5568' : '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s' }}>
              {busy ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <ArrowRight style={{ width: 16, height: 16 }} />}
              {busy ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [, go] = useLocation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {}
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Trophy style={{ width: 26, height: 26, color: '#f59e0b' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#e8eeff', letterSpacing: '-.02em' }}>Rapha Guru</h1>
        </div>

        <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '28px 28px 24px' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>📧</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eeff', marginBottom: 8 }}>Verifique seu e-mail</h2>
              <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 20 }}>
                Se o e-mail <strong style={{ color: '#60a5fa' }}>{email}</strong> estiver cadastrado, você receberá as instruções em breve.
              </p>
              <button onClick={() => go('/login')} style={{ padding: '11px 24px', borderRadius: 10, background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Voltar ao login
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e8eeff', marginBottom: 4 }}>Recuperar senha</h2>
              <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 22 }}>
                Digite seu e-mail e enviaremos as instruções.
              </p>
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field type="email" placeholder="seu@email.com" value={email} onChange={setEmail} Icon={Mail} />
                <button type="submit" disabled={busy || !email}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 10, background: busy || !email ? '#1c2335' : '#3b82f6', color: busy || !email ? '#4a5568' : '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: busy || !email ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {busy ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <ArrowRight style={{ width: 16, height: 16 }} />}
                  {busy ? 'Enviando...' : 'Enviar instruções'}
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button onClick={() => go('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 12 }}>
                  ← Voltar ao login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
