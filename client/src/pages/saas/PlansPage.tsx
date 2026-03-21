// Rapha Guru — Plans Page v2 (Tailwind)

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth, PLAN_META } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Check, Zap, Crown, Star, Gift, ArrowLeft, Loader2, QrCode, Copy, CreditCard, FileText, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  slug: string; name: string; description: string;
  price_monthly: number; price_annual: number | null;
  features: string[]; limits: Record<string, number>; badge_color: string;
}

const ICONS: Record<string, React.ElementType> = { free: Gift, basic: Star, pro: Zap, elite: Crown };

export default function PlansPage() {
  const [, go] = useLocation();
  const { user, subscription, refresh } = useAuth();
  const [plans, setPlans]     = useState<Plan[]>([]);
  const [billing, setBilling] = useState<'monthly'|'annual'>('monthly');
  const [selected, setSel]    = useState<Plan | null>(null);
  const [method, setMethod]   = useState<'pix'|'credit_card'|'boleto'>('pix');
  const [installments, setInstallments] = useState(1);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<{discount:number;type:'pct'|'fixed'} | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<Record<string,unknown> | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch('/api/payments/plans')
      .then(r => r.json() as Promise<{ plans: Plan[] }>)
      .then(d => { setPlans(d.plans); setFetching(false); })
      .catch(() => setFetching(false));
  }, []);

  const price = (p: Plan) => billing === 'annual' && p.price_annual ? p.price_annual : p.price_monthly;

  const checkout = async () => {
    if (!selected) return;
    if (!user) { go('/login'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rg_auth_token')}` },
        body: JSON.stringify({ plan_slug: selected.slug, billing_cycle: billing, method }),
      });
      const d = await r.json() as Record<string,unknown>;
      if (!r.ok) throw new Error(d.error as string);
      setResult(d);
      if (d.status === 'paid') { await refresh(); toast.success('Plano ativado!'); setTimeout(() => go('/minha-conta'), 1500); }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro no pagamento'); }
    setLoading(false);
  };

  const applyCoupon = async () => {
    if (!couponCode || !selected) return;
    setCouponLoading(true);
    try {
      const r = await fetch('/api/payments/coupon/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rg_auth_token')}` },
        body: JSON.stringify({ code: couponCode, plan_slug: selected.slug }),
      });
      const d = await r.json() as { ok?: boolean; coupon?: {discount:number;type:'pct'|'fixed'}; error?: string };
      if (d.ok && d.coupon) { setCoupon(d.coupon); toast.success('Cupom aplicado! 🎉'); }
      else toast.error(d.error ?? 'Cupom inválido');
    } catch { toast.error('Erro ao verificar cupom'); }
    setCouponLoading(false);
  };

  const finalPrice = (p: typeof selected) => {
    if (!p) return 0;
    const base = billing === 'annual' && p.price_annual ? p.price_annual : p.price_monthly;
    if (!coupon) return base;
    return coupon.type === 'pct' ? base * (1 - coupon.discount / 100) : Math.max(0, base - coupon.discount);
  };

  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success('Copiado!')).catch(() => {});
  const cur = subscription?.plan_slug ?? user?.role ?? 'free';

  if (fetching) return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
      <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
    </div>
  );

  // ── Resultado checkout ──────────────────────────────────────
  if (result && result.status !== 'paid') {
    return (
      <div className="min-h-screen bg-[#07090f] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-slate-900/60 border border-white/[0.07] rounded-2xl p-8 text-center space-y-4">
          {method === 'pix' && <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <QrCode className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">PIX gerado!</h2>
              <p className="text-sm text-slate-500 mt-1">Escaneie o QR code ou copie o código. Acesso liberado automaticamente após pagamento.</p>
            </div>
            {result.pix_qr_base64 && (
              <img src={result.pix_qr_base64 as string} alt="QR PIX" className="w-44 h-44 mx-auto rounded-xl border-4 border-white/[0.06]" />
            )}
            {result.pix_qr_code && (
              <button onClick={() => copy(result.pix_qr_code as string)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl hover:bg-white/[0.07] transition-colors">
                <span className="flex-1 text-xs text-slate-500 truncate text-left">{result.pix_qr_code as string}</span>
                <Copy className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              </button>
            )}
            <p className="text-xs text-slate-600">Expira em 1 hora · Pagamento via Pagar.me</p>
            {result._demo && <p className="text-xs text-amber-500">⚠️ Modo demo — configure PAGARME_API_KEY</p>}
          </>}
          {method === 'boleto' && <>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Boleto gerado!</h2>
              <p className="text-sm text-slate-500 mt-1">Pague até o vencimento. Acesso ativado em até 1 dia útil.</p>
            </div>
            {result.boleto_url && (
              <a href={result.boleto_url as string} target="_blank" rel="noreferrer"
                className="inline-block px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors">
                Abrir boleto
              </a>
            )}
            {result.boleto_barcode && (
              <button onClick={() => copy(result.boleto_barcode as string)} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Copiar código de barras <Copy className="w-3 h-3" />
              </button>
            )}
          </>}
          <button onClick={() => go('/')} className="mt-2 px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-slate-400 hover:text-slate-200 text-sm transition-colors">
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  // ── Checkout ────────────────────────────────────────────────
  if (selected) {
    const Icon = ICONS[selected.slug] ?? Star;
    const col  = selected.badge_color ?? '#3b82f6';
    const p    = price(selected);

    return (
      <div className="min-h-screen bg-[#07090f] px-4 py-8">
        <div className="max-w-lg mx-auto space-y-4">
          <button onClick={() => setSel(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          {/* Resumo do plano */}
          <div className="bg-slate-900/60 border border-white/[0.07] rounded-2xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: col + '20', border: `1px solid ${col}40` }}>
              <Icon className="w-5 h-5" style={{ color: col }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-100">Plano {selected.name}</div>
              <div className="text-xs text-slate-500">{billing === 'annual' ? 'Cobrança anual' : 'Cobrança mensal'}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black" style={{ color: col }}>R$ {p.toFixed(2)}</div>
              <div className="text-xs text-slate-500">/{billing === 'annual' ? 'ano' : 'mês'}</div>
            </div>
          </div>

          {/* Método de pagamento */}
          <div className="bg-slate-900/60 border border-white/[0.07] rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Forma de pagamento</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'pix', label: 'PIX', Icon: QrCode, desc: 'Instantâneo' },
                { id: 'credit_card', label: 'Cartão', Icon: CreditCard, desc: 'Até 12x' },
                { id: 'boleto', label: 'Boleto', Icon: FileText, desc: '3 dias' },
              ] as const).map(({ id, label, Icon: I, desc }) => (
                <button key={id} onClick={() => setMethod(id)}
                  className={cn('flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all',
                    method === id ? 'border-white/20 bg-white/[0.08] text-white' : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300 hover:border-white/10')}>
                  <I className="w-4 h-4" />
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[10px] text-slate-600">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cupom */}
          <div className="bg-slate-900/60 border border-white/[0.07] rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cupom de desconto</p>
            <div className="flex gap-2">
              <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Ex: RAPHA20"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/50" />
              <button onClick={applyCoupon} disabled={couponLoading || !couponCode}
                className={cn('px-4 py-2.5 rounded-xl text-sm font-bold transition-all', coupon ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-800 disabled:text-slate-500')}>
                {coupon ? '✓' : couponLoading ? '...' : 'Aplicar'}
              </button>
            </div>
            {coupon && selected && (
              <p className="text-xs text-emerald-400">
                ✓ Desconto de {coupon.type === 'pct' ? `${coupon.discount}%` : `R$ ${coupon.discount.toFixed(2)}`} aplicado!
                Novo total: <strong>R$ {finalPrice(selected).toFixed(2)}</strong>
              </p>
            )}
          </div>

          {/* Parcelamento */}
          {method === 'credit_card' && (
            <div className="bg-slate-900/60 border border-white/[0.07] rounded-2xl p-5 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Parcelamento</p>
              <select value={installments} onChange={e => setInstallments(Number(e.target.value))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
                {[1,2,3,6,12].map(n => {
                  const total = finalPrice(selected);
                  return <option key={n} value={n}>{n}x de R$ {(total/n).toFixed(2)}{n === 1 ? ' (sem juros)' : ''}</option>;
                })}
              </select>
            </div>
          )}

          <button onClick={checkout} disabled={loading}
            className={cn('w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all',
              loading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'text-white')}
            style={loading ? undefined : { background: col }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Processando...' : `Assinar por R$ ${finalPrice(selected).toFixed(2)}`}
          </button>

          <p className="text-center text-xs text-slate-600 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" /> Pagamento seguro via Pagar.me · SSL 256-bit
          </p>
        </div>
      </div>
    );
  }

  // ── Grid de planos ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#07090f] px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => go('/')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="text-center mb-10 space-y-4">
          <h1 className="text-3xl font-black text-white tracking-tight">Escolha seu plano</h1>
          <p className="text-sm text-slate-500">Comece grátis · Faça upgrade quando quiser · Cancele a qualquer hora</p>

          <div className="inline-flex bg-slate-900/80 border border-white/[0.07] rounded-full p-1 gap-1">
            {(['monthly','annual'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)}
                className={cn('px-5 py-2 rounded-full text-sm font-semibold transition-all',
                  billing === b ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300')}>
                {b === 'monthly' ? 'Mensal' : (
                  <span className="flex items-center gap-2">
                    Anual
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">-33%</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => {
            const Icon  = ICONS[plan.slug] ?? Star;
            const col   = plan.badge_color ?? '#3b82f6';
            const isCur = cur === plan.slug;
            const isPop = plan.slug === 'pro';
            const p     = price(plan);

            return (
              <div key={plan.slug} className={cn('relative rounded-2xl border p-5 flex flex-col',
                isCur ? 'border-white/20 bg-white/[0.04]' : isPop ? 'border-white/15 bg-slate-900/80' : 'border-white/[0.07] bg-slate-900/50')}
                style={isPop ? { boxShadow: `0 20px 50px -20px ${col}35` } : undefined}>

                {isPop && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black text-white tracking-wider"
                    style={{ background: col }}>
                    MAIS POPULAR
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: col + '20', border: `1px solid ${col}35` }}>
                    <Icon className="w-4 h-4" style={{ color: col }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-100">{plan.name}</div>
                    <div className="text-xs text-slate-500">{plan.description}</div>
                  </div>
                </div>

                <div className="mb-5">
                  {plan.price_monthly === 0
                    ? <span className="text-2xl font-black" style={{ color: col }}>Grátis</span>
                    : <>
                        <span className="text-2xl font-black" style={{ color: col }}>R$ {p.toFixed(2)}</span>
                        <span className="text-xs text-slate-500 ml-1">/{billing === 'annual' ? 'ano' : 'mês'}</span>
                        {billing === 'annual' && plan.price_annual && (
                          <div className="text-xs text-emerald-400 mt-0.5">≈ R$ {(plan.price_annual / 12).toFixed(2)}/mês</div>
                        )}
                      </>
                  }
                </div>

                <div className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2 text-xs text-slate-400">
                      <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: col }} />{f}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => { if (isCur || plan.price_monthly === 0) return; if (!user) { go('/login'); return; } setSel(plan); }}
                  disabled={isCur}
                  className={cn('w-full py-2.5 rounded-xl text-sm font-bold transition-all',
                    isCur ? 'bg-white/[0.05] text-slate-500 border border-white/[0.08] cursor-default' : 'text-white hover:opacity-90')}
                  style={!isCur ? { background: col } : undefined}>
                  {isCur ? '✓ Plano atual' : plan.price_monthly === 0 ? 'Começar grátis' : 'Assinar agora'}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center mt-6 text-xs text-slate-600">
          Sem fidelidade · Cancele a qualquer momento · Pagamento processado pelo Pagar.me
        </p>
      </div>
    </div>
  );
}
