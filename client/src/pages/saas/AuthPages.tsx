// Rapha Guru — Auth Pages v2 (Tailwind)

import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Trophy, Loader2, Mail, Lock, User, ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

function Field({ type = 'text', placeholder, value, onChange, Icon, right, error }: {
  type?: string; placeholder: string; value: string; onChange(v: string): void;
  Icon: React.ElementType; right?: React.ReactNode; error?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <Icon className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors',
        focused ? 'text-blue-400' : error ? 'text-red-400' : 'text-slate-500')} />
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className={cn('w-full bg-white/[0.04] rounded-xl px-4 pl-10 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all border',
          focused ? 'border-blue-500/60 bg-blue-500/[0.04]' : error ? 'border-red-500/50' : 'border-white/[0.08] hover:border-white/[0.14]')} />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

function PasswordStrength({ pwd }: { pwd: string }) {
  if (!pwd) return null;
  const score = [pwd.length >= 8, /[A-Z]/.test(pwd), /[0-9]/.test(pwd), /[^A-Za-z0-9]/.test(pwd)].filter(Boolean).length;
  const bars  = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'];
  const texts = ['', 'text-red-400', 'text-amber-400', 'text-blue-400', 'text-emerald-400'];
  const labels = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">{[1,2,3,4].map(i => (
        <div key={i} className={cn('h-0.5 flex-1 rounded-full transition-all', i <= score ? bars[score] : 'bg-white/[0.06]')} />
      ))}</div>
      <span className={cn('text-[11px] font-medium', texts[score])}>{labels[score]}</span>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center px-4 py-12">
      {children}
    </div>
  );
}

function BrandMark({ compact }: { compact?: boolean }) {
  return compact ? (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 flex items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10">
        <Trophy className="w-4 h-4 text-amber-400" />
      </div>
      <span className="text-base font-black text-white tracking-tight">Rapha Guru</span>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3">
      <div className="w-14 h-14 flex items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10">
        <Trophy className="w-6 h-6 text-amber-400" />
      </div>
      <div className="text-center">
        <div className="text-xl font-black text-white tracking-tight">Rapha Guru</div>
        <div className="text-xs text-slate-500 mt-0.5">Análise profissional de probabilidades</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const [, go] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [show,  setShow]  = useState(false);
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const ok = await login(email, pass);
    setBusy(false);
    if (ok) go('/'); else setErr('Email ou senha incorretos');
  };

  return (
    <PageShell>
      <div className="w-full max-w-sm space-y-6">
        <BrandMark />
        <div className="bg-slate-900/60 border border-white/[0.07] rounded-2xl p-7 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-100">Entrar na conta</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sem conta?{' '}
              <button onClick={() => go('/cadastro')} className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">Criar agora grátis</button>
            </p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Field type="email" placeholder="seu@email.com" value={email} onChange={setEmail} Icon={Mail} error={!!err} />
            <Field type={show ? 'text' : 'password'} placeholder="Senha" value={pass} onChange={setPass} Icon={Lock} error={!!err}
              right={<button type="button" onClick={() => setShow(s => !s)} className="text-slate-500 hover:text-slate-300 transition-colors">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>} />
            {err && <div className="px-3 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-sm text-red-400">{err}</div>}
            <button type="submit" disabled={busy || !email || !pass}
              className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all mt-1',
                busy || !email || !pass ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white')}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {busy ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <div className="text-center">
            <button onClick={() => go('/esqueci-senha')} className="text-xs text-slate-600 hover:text-slate-400 transition-colors underline underline-offset-2">
              Esqueci minha senha
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

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
    <PageShell>
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div className="space-y-6">
          <BrandMark compact />
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white leading-tight tracking-tight">
              Análise profissional<br /><span className="text-blue-400">de probabilidades</span>
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Mais de 40 métricas por partida — gols, escanteios, cartões, handicap asiático, value bets e muito mais.
            </p>
          </div>
          <div className="space-y-3">
            {perks.map(p => (
              <div key={p} className="flex items-center gap-3 text-sm text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />{p}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-white/[0.07] rounded-2xl p-7 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-100">Criar conta gratuita</h2>
            <p className="text-sm text-slate-500 mt-1">
              Já tem conta?{' '}
              <button onClick={() => go('/login')} className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">Entrar</button>
            </p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Field placeholder="Nome completo" value={name} onChange={setName} Icon={User} />
            <Field type="email" placeholder="seu@email.com" value={email} onChange={setEmail} Icon={Mail} />
            <div>
              <Field type={show ? 'text' : 'password'} placeholder="Senha (mín. 8 caracteres)" value={pass} onChange={setPass} Icon={Lock}
                right={<button type="button" onClick={() => setShow(s => !s)} className="text-slate-500 hover:text-slate-300 transition-colors">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>} />
              <PasswordStrength pwd={pass} />
            </div>
            {err && <div className="px-3 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-sm text-red-400">{err}</div>}
            <button type="submit" disabled={busy || !name || !email || pass.length < 8}
              className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all mt-1',
                busy || !name || !email || pass.length < 8 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white')}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {busy ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}

export function ForgotPasswordPage() {
  const [, go] = useLocation();
  const [email, setEmail] = useState('');
  const [sent,  setSent]  = useState(false);
  const [busy,  setBusy]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      setSent(true);
    } catch {}
    setBusy(false);
  };

  return (
    <PageShell>
      <div className="w-full max-w-sm space-y-6">
        <BrandMark />
        <div className="bg-slate-900/60 border border-white/[0.07] rounded-2xl p-7">
          {sent ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">Verifique seu e-mail</h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Se <span className="text-blue-400 font-medium">{email}</span> estiver cadastrado, você receberá as instruções em breve.
                </p>
              </div>
              <button onClick={() => go('/login')} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors">
                Voltar ao login
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-100">Recuperar senha</h2>
                <p className="text-sm text-slate-500 mt-1">Digite seu e-mail e enviaremos as instruções.</p>
              </div>
              <form onSubmit={submit} className="space-y-3">
                <Field type="email" placeholder="seu@email.com" value={email} onChange={setEmail} Icon={Mail} />
                <button type="submit" disabled={busy || !email}
                  className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all',
                    busy || !email ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white')}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {busy ? 'Enviando...' : 'Enviar instruções'}
                </button>
              </form>
              <div className="text-center">
                <button onClick={() => go('/login')} className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  <ChevronLeft className="w-3 h-3" /> Voltar ao login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
