// Rapha Guru — Página de Planos e Checkout

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth, PLAN_META } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Check, Zap, Crown, Star, Gift, ArrowLeft, Loader2,
  QrCode, Copy, CreditCard, FileText, Shield, X,
} from 'lucide-react';

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

  const price = (p: Plan) =>
    billing === 'annual' && p.price_annual ? p.price_annual : p.price_monthly;

  const checkout = async () => {
    if (!selected) return;
    if (!user) { go('/login'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rg_auth_token')}`,
        },
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
    <div style={{ minHeight: '100vh', background: '#07090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 style={{ width: 28, height: 28, color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Resultado checkout ────────────────────────────────────
  if (result && result.status !== 'paid') {
    return (
      <div style={{ minHeight: '100vh', background: '#07090f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Space Grotesk',system-ui,sans-serif" }}>
        <div style={{ maxWidth: 440, width: '100%', background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          {method === 'pix' && <>
            <QrCode style={{ width: 40, height: 40, color: '#22c55e', margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e8eeff', marginBottom: 8 }}>PIX gerado!</h2>
            <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 20 }}>Escaneie o QR code ou copie o código. Acesso liberado automaticamente após pagamento.</p>
            {result.pix_qr_base64 && (
              <img src={result.pix_qr_base64 as string} alt="QR PIX"
                style={{ width: 180, height: 180, margin: '0 auto 16px', borderRadius: 10, display: 'block', border: '4px solid rgba(255,255,255,.06)' }} />
            )}
            {result.pix_qr_code && (
              <div onClick={() => copy(result.pix_qr_code as string)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, cursor: 'pointer', marginBottom: 12 }}>
                <span style={{ flex: 1, fontSize: 11, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{result.pix_qr_code as string}</span>
                <Copy style={{ width: 14, height: 14, color: '#60a5fa', flexShrink: 0 }} />
              </div>
            )}
            <p style={{ fontSize: 11, color: '#4a5568' }}>Expira em 1 hora · Pagamento via Pagar.me</p>
            {result._demo && <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 8 }}>⚠️ Modo demo — configure PAGARME_API_KEY</p>}
          </>}

          {method === 'boleto' && <>
            <FileText style={{ width: 40, height: 40, color: '#f59e0b', margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e8eeff', marginBottom: 8 }}>Boleto gerado!</h2>
            <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 20 }}>Pague até o vencimento. Acesso ativado em até 1 dia útil.</p>
            {result.boleto_url && (
              <a href={result.boleto_url as string} target="_blank" rel="noreferrer"
                style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 10, background: '#f59e0b', color: '#000', fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 14 }}>
                Abrir boleto
              </a>
            )}
            {result.boleto_barcode && (
              <div onClick={() => copy(result.boleto_barcode as string)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', justifyContent: 'center', fontSize: 12, color: '#4a5568', marginBottom: 8 }}>
                Copiar código de barras <Copy style={{ width: 13, height: 13, color: '#60a5fa' }} />
              </div>
            )}
          </>}

          <button onClick={() => go('/')} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#8892b0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Voltar ao início
          </button>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Checkout selecionado ──────────────────────────────────
  if (selected) {
    const Icon = ICONS[selected.slug] ?? Star;
    const col  = selected.badge_color ?? '#3b82f6';
    const p    = price(selected);

    return (
      <div style={{ minHeight: '100vh', background: '#07090f', color: '#e8eeff', padding: '28px 20px', fontFamily: "'Space Grotesk',system-ui,sans-serif" }}>
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          <button onClick={() => setSel(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 13, marginBottom: 22, fontFamily: 'inherit' }}>
            <ArrowLeft style={{ width: 15, height: 15 }} /> Voltar
          </button>

          {/* Resumo */}
          <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '16px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: `${col}20`, border: `1px solid ${col}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon style={{ width: 19, height: 19, color: col }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Plano {selected.name}</div>
              <div style={{ fontSize: 12, color: '#4a5568' }}>{billing === 'annual' ? 'Cobrança anual' : 'Cobrança mensal'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: col }}>R$ {p.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: '#4a5568' }}>/{billing === 'annual' ? 'ano' : 'mês'}</div>
            </div>
          </div>

          {/* Método de pagamento */}
          <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Forma de pagamento</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                { id: 'pix',         label: 'PIX',    Icon: QrCode,     desc: 'Instantâneo' },
                { id: 'credit_card', label: 'Cartão', Icon: CreditCard, desc: 'Até 12x' },
                { id: 'boleto',      label: 'Boleto', Icon: FileText,   desc: '3 dias' },
              ] as const).map(({ id, label, Icon: I, desc }) => (
                <button key={id} onClick={() => setMethod(id)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 8px', borderRadius: 10, cursor: 'pointer', background: method === id ? `${col}15` : 'rgba(255,255,255,.03)', border: `1px solid ${method === id ? col + '55' : 'rgba(255,255,255,.08)'}`, transition: 'all .15s', fontFamily: 'inherit' }}>
                  <I style={{ width: 18, height: 18, color: method === id ? col : '#4a5568' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: method === id ? '#e8eeff' : '#8892b0' }}>{label}</span>
                  <span style={{ fontSize: 10, color: '#4a5568' }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cupom de desconto */}
          <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Cupom de desconto</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Ex: RAPHA20"
                style={{ flex: 1, padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', color: '#e8eeff', fontSize: 13, outline: 'none' }} />
              <button onClick={applyCoupon} disabled={couponLoading || !couponCode}
                style={{ padding: '9px 16px', borderRadius: 8, background: coupon ? '#22c55e' : '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: couponLoading ? .6 : 1 }}>
                {coupon ? '✓' : 'Aplicar'}
              </button>
            </div>
            {coupon && selected && (
              <p style={{ fontSize: 12, color: '#22c55e', marginTop: 8 }}>
                ✓ Desconto de {coupon.type === 'pct' ? `${coupon.discount}%` : `R$ ${coupon.discount.toFixed(2)}`} aplicado!
                Novo total: <strong>R$ {finalPrice(selected).toFixed(2)}</strong>
              </p>
            )}
          </div>

          {/* Parcelamento (cartão) */}
          {method === 'credit_card' && (
            <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Parcelamento</p>
              <select value={installments} onChange={e => setInstallments(Number(e.target.value))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', color: '#e8eeff', fontSize: 13 }}>
                {[1,2,3,6,12].map(n => {
                  const total = finalPrice(selected);
                  return <option key={n} value={n}>{n}x de R$ {(total/n).toFixed(2)}{n === 1 ? ' (sem juros)' : ''}</option>;
                })}
              </select>
            </div>
          )}

          <button onClick={checkout} disabled={loading}
            style={{ width: '100%', padding: 14, borderRadius: 11, background: loading ? '#1c2335' : col, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
            {loading ? <Loader2 style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} /> : <Zap style={{ width: 17, height: 17 }} />}
            {loading ? 'Processando...' : `Assinar por R$ ${finalPrice(selected).toFixed(2)}`}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#4a5568', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Shield style={{ width: 12, height: 12 }} /> Pagamento seguro via Pagar.me · SSL 256-bit
          </p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Grid de planos ────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#07090f', color: '#e8eeff', padding: '32px 20px', fontFamily: "'Space Grotesk',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <button onClick={() => go('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 13, marginBottom: 28, fontFamily: 'inherit' }}>
          <ArrowLeft style={{ width: 15, height: 15 }} /> Voltar
        </button>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 10 }}>Escolha seu plano</h1>
          <p style={{ fontSize: 14, color: '#4a5568', marginBottom: 20 }}>Comece grátis · Faça upgrade quando quiser · Cancelare a qualquer hora</p>

          <div style={{ display: 'inline-flex', background: '#10141f', border: '1px solid rgba(255,255,255,.07)', borderRadius: 50, padding: 4, gap: 4 }}>
            {(['monthly','annual'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)}
                style={{ padding: '7px 20px', borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: billing === b ? '#3b82f6' : 'transparent', color: billing === b ? '#fff' : '#4a5568', border: 'none', transition: 'all .15s', fontFamily: 'inherit' }}>
                {b === 'monthly' ? 'Mensal' : <>
                  Anual
                  <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(34,197,94,.15)', color: '#22c55e', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>-33%</span>
                </>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {plans.map(plan => {
            const Icon    = ICONS[plan.slug] ?? Star;
            const col     = plan.badge_color ?? '#3b82f6';
            const isCur   = cur === plan.slug;
            const isPop   = plan.slug === 'pro';
            const p       = price(plan);

            return (
              <div key={plan.slug} style={{
                background: isCur ? `${col}10` : '#10141f',
                border: `1px solid ${isCur ? col + '45' : isPop ? col + '30' : 'rgba(255,255,255,.07)'}`,
                borderRadius: 14, padding: '22px 20px', position: 'relative',
                boxShadow: isPop ? `0 20px 40px -20px ${col}40` : 'none',
              }}>
                {isPop && (
                  <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: col, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 14px', borderRadius: 20, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                    MAIS POPULAR
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${col}20`, border: `1px solid ${col}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon style={{ width: 17, height: 17, color: col }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{plan.name}</div>
                    <div style={{ fontSize: 11, color: '#4a5568' }}>{plan.description}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  {plan.price_monthly === 0
                    ? <span style={{ fontSize: 26, fontWeight: 800, color: col }}>Grátis</span>
                    : <>
                        <span style={{ fontSize: 26, fontWeight: 800, color: col }}>R$ {p.toFixed(2)}</span>
                        <span style={{ fontSize: 12, color: '#4a5568' }}>/{billing === 'annual' ? 'ano' : 'mês'}</span>
                        {billing === 'annual' && plan.price_annual && (
                          <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2 }}>≈ R$ {(plan.price_annual / 12).toFixed(2)}/mês</div>
                        )}
                      </>
                  }
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#8892b0' }}>
                      <Check style={{ width: 13, height: 13, color: col, flexShrink: 0, marginTop: 1 }} />
                      {f}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (isCur || plan.price_monthly === 0) return;
                    if (!user) { go('/login'); return; }
                    setSel(plan);
                  }}
                  disabled={isCur}
                  style={{ width: '100%', padding: '11px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: isCur ? 'default' : 'pointer', background: isCur ? 'rgba(255,255,255,.05)' : col, color: isCur ? '#4a5568' : '#fff', border: `1px solid ${isCur ? 'rgba(255,255,255,.08)' : 'transparent'}`, fontFamily: 'inherit' }}>
                  {isCur ? '✓ Plano atual' : plan.price_monthly === 0 ? 'Começar grátis' : 'Assinar agora'}
                </button>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: '#4a5568' }}>
          Sem fidelidade · Cancelare a qualquer momento · Pagamento processado pelo Pagar.me
        </p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
