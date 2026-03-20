/**
 * Rapha Guru — Rotas de Pagamento (Pagar.me v5)
 * GET  /api/payments/plans
 * GET  /api/payments/subscription
 * POST /api/payments/checkout
 * POST /api/payments/webhook
 * POST /api/payments/cancel
 */

import { Router } from 'express';
import db from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router  = Router();
const PM_KEY  = process.env.PAGARME_API_KEY || '';
const PM_BASE = 'https://api.pagar.me/core/v5';

async function pm<T>(method: string, path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(PM_KEY + ':').toString('base64');
  const res = await fetch(`${PM_BASE}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as T & { message?: string };
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `Pagar.me ${res.status}`);
  return data;
}

// ── GET /plans ────────────────────────────────────────────────
router.get('/plans', (_req, res) => {
  const plans = db.prepare(`SELECT * FROM plans WHERE is_active = 1 ORDER BY sort_order`).all() as {
    slug: string; name: string; description: string; price_monthly: number;
    price_annual: number | null; features: string; limits: string; badge_color: string;
  }[];

  res.json({
    plans: plans.map(p => ({
      ...p,
      features: JSON.parse(p.features) as string[],
      limits: JSON.parse(p.limits) as Record<string, number>,
    })),
  });
});

// ── GET /subscription ─────────────────────────────────────────
router.get('/subscription', requireAuth, (req, res) => {
  const sub = db.prepare(`
    SELECT s.*, p.name as plan_name, p.features, p.price_monthly, p.badge_color
    FROM subscriptions s JOIN plans p ON p.slug = s.plan_slug
    WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 1
  `).get(req.user!.id) as Record<string, unknown> | undefined;

  const payments = db.prepare(`
    SELECT id, amount_brl, status, method, created_at, paid_at
    FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(req.user!.id);

  res.json({
    subscription: sub ? { ...sub, features: JSON.parse(sub.features as string) } : null,
    payments,
  });
});

// ── POST /checkout ────────────────────────────────────────────
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const { plan_slug, billing_cycle = 'monthly', method, cpf } = req.body as {
      plan_slug?: string; billing_cycle?: string; method?: string; cpf?: string;
    };

    if (!plan_slug || !method)
      return res.status(400).json({ error: 'plan_slug e method são obrigatórios' });

    const plan = db.prepare(`SELECT * FROM plans WHERE slug = ? AND is_active = 1`).get(plan_slug) as {
      slug: string; name: string; price_monthly: number; price_annual: number | null;
    } | undefined;
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });
    if (plan.slug === 'free') return res.status(400).json({ error: 'Plano gratuito não requer pagamento' });

    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as {
      id: number; email: string; name: string; phone: string | null; cpf: string | null;
    };

    const amountCents = Math.round(
      (billing_cycle === 'annual' && plan.price_annual ? plan.price_annual : plan.price_monthly) * 100
    );
    const amountBrl = amountCents / 100;

    // Cria pagamento no banco
    const payResult = db.prepare(`
      INSERT INTO payments (user_id, amount_brl, status, method, gateway)
      VALUES (?, ?, 'pending', ?, 'pagarme')
    `).run(user.id, amountBrl, method) as { lastInsertRowid: number };
    const paymentId = payResult.lastInsertRowid;

    // Se não tem chave Pagar.me, retorna simulação
    if (!PM_KEY) {
      const simulated = simulatePayment(method as string, paymentId, plan.slug);
      db.prepare(`UPDATE payments SET ${Object.keys(simulated).map(k => `${k} = ?`).join(', ')} WHERE id = ?`)
        .run(...Object.values(simulated), paymentId);

      return res.json({
        payment_id: paymentId, status: 'pending', method,
        ...simulated,
        _demo: true,
        _demo_msg: 'Configure PAGARME_API_KEY para pagamentos reais',
      });
    }

    // ── Pagar.me real ──────────────────────────────────────────
    // Cria/recupera customer
    let customerId: string | null = (db.prepare(`
      SELECT gateway_customer_id FROM subscriptions
      WHERE user_id = ? AND gateway_customer_id IS NOT NULL LIMIT 1
    `).get(user.id) as { gateway_customer_id: string } | undefined)?.gateway_customer_id ?? null;

    if (!customerId) {
      const cust = await pm<{ id: string }>('POST', '/customers', {
        name:          user.name,
        email:         user.email,
        type:          'individual',
        document:      (cpf ?? user.cpf ?? '00000000000').replace(/\D/g, ''),
        document_type: 'CPF',
        phones: user.phone ? {
          mobile_phone: {
            country_code: '55',
            area_code:    user.phone.replace(/\D/g, '').slice(0, 2),
            number:       user.phone.replace(/\D/g, '').slice(2),
          },
        } : undefined,
      });
      customerId = cust.id;
    }

    const orderPayload: Record<string, unknown> = {
      customer_id: customerId,
      items: [{ amount: amountCents, description: `Rapha Guru ${plan.name}`, quantity: 1, code: plan.slug }],
    };

    let paymentBlock: Record<string, unknown>;
    if (method === 'pix') {
      paymentBlock = { payment_method: 'pix', pix: { expires_in: 3600 } };
    } else if (method === 'boleto') {
      paymentBlock = {
        payment_method: 'boleto',
        boleto: {
          instructions: 'Pague até o vencimento para ativar sua assinatura.',
          due_at: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        },
      };
    } else if (method === 'credit_card') {
      const { card_token } = req.body as { card_token?: string };
      if (!card_token) return res.status(400).json({ error: 'card_token obrigatório para cartão' });
      paymentBlock = {
        payment_method: 'credit_card',
        credit_card: {
          recurrence: (req.body as { installments?: number }).installments === 1,
          installments: (req.body as { installments?: number }).installments ?? 1,
          statement_descriptor: 'RAPHA GURU',
          card_token,
        },
      };
    } else {
      return res.status(400).json({ error: 'Método inválido: pix | boleto | credit_card' });
    }

    orderPayload.payments = [paymentBlock];
    const order = await pm<Record<string, unknown>>('POST', '/orders', orderPayload);
    const charge = ((order.charges as Record<string, unknown>[])?.[0]) as Record<string, unknown>;
    const lastTx = charge?.last_transaction as Record<string, unknown>;

    const updates: Record<string, unknown> = { gateway_order_id: order.id };

    if (method === 'pix') {
      updates.pix_qr_code   = lastTx?.qr_code;
      updates.pix_qr_base64 = lastTx?.qr_code_url;
      updates.pix_expires_at = Math.floor(Date.now() / 1000) + 3600;
    }
    if (method === 'boleto') {
      updates.boleto_url      = lastTx?.url;
      updates.boleto_barcode  = lastTx?.line;
      updates.boleto_expires_at = Math.floor(Date.now() / 1000) + 3 * 86400;
    }

    db.prepare(`
      UPDATE payments SET gateway_order_id = ?, pix_qr_code = ?, pix_qr_base64 = ?, pix_expires_at = ?,
        boleto_url = ?, boleto_barcode = ?, boleto_expires_at = ?
      WHERE id = ?
    `).run(
      updates.gateway_order_id as string ?? null,
      updates.pix_qr_code as string ?? null,
      updates.pix_qr_base64 as string ?? null,
      updates.pix_expires_at as number ?? null,
      updates.boleto_url as string ?? null,
      updates.boleto_barcode as string ?? null,
      updates.boleto_expires_at as number ?? null,
      paymentId,
    );

    // Cartão pago na hora
    if (method === 'credit_card' && order.status === 'paid') {
      await activateSub(user.id, plan.slug, billing_cycle, amountBrl, String(order.id));
      return res.json({ payment_id: paymentId, status: 'paid', message: 'Assinatura ativada!' });
    }

    res.json({ payment_id: paymentId, status: 'pending', method, ...updates });
  } catch (err) {
    console.error('[checkout]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro no checkout' });
  }
});

// ── POST /webhook ─────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  // TODO: validar HMAC com PAGARME_WEBHOOK_SECRET
  const event = req.body as { type?: string; data?: Record<string, unknown> };
  console.log('[webhook]', event.type);

  try {
    if (event.type === 'order.paid') {
      const order = event.data!;
      const orderId = String(order.id);

      const pay = db.prepare(`
        SELECT p.user_id, p.amount_brl FROM payments p WHERE p.gateway_order_id = ?
      `).get(orderId) as { user_id: number; amount_brl: number } | undefined;

      if (pay) {
        db.prepare(`UPDATE payments SET status = 'paid', paid_at = unixepoch() WHERE gateway_order_id = ?`)
          .run(orderId);

        const items = order.items as { code: string }[] | undefined;
        const planSlug = items?.[0]?.code ?? 'basic';
        await activateSub(pay.user_id, planSlug, 'monthly', pay.amount_brl, orderId);
      }
    }

    if (event.type === 'order.payment_failed') {
      db.prepare(`UPDATE payments SET status = 'failed', failure_reason = ? WHERE gateway_order_id = ?`)
        .run('Pagamento recusado pela operadora', String(event.data?.id));
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[webhook error]', err);
    res.status(500).json({ error: 'Webhook error' });
  }
});

// ── POST /cancel ──────────────────────────────────────────────
router.post('/cancel', requireAuth, (req, res) => {
  const { reason } = req.body as { reason?: string };
  const changed = db.prepare(`
    UPDATE subscriptions
    SET status = 'cancelled', cancelled_at = unixepoch(), cancel_reason = ?,
        cancel_at_period_end = 0, updated_at = unixepoch()
    WHERE user_id = ? AND status = 'active' AND plan_slug != 'free'
  `).run(reason ?? 'Cancelado pelo usuário', req.user!.id);

  if (!changed.changes)
    return res.status(404).json({ error: 'Nenhuma assinatura paga ativa' });

  db.prepare(`UPDATE users SET role = 'free', updated_at = unixepoch() WHERE id = ?`).run(req.user!.id);
  db.prepare(`
    INSERT INTO subscriptions (user_id, plan_slug, status, billing_cycle, amount_brl, period_start)
    VALUES (?, 'free', 'active', 'monthly', 0, unixepoch())
  `).run(req.user!.id);

  db.prepare(`
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (?, 'Assinatura cancelada', 'Seu acesso continua até o fim do período atual. Sentiremos sua falta!', 'warning')
  `).run(req.user!.id);

  res.json({ ok: true });
});

// ── Activa assinatura (interno) ───────────────────────────────
async function activateSub(
  userId: number, planSlug: string, cycle: string, amount: number, orderId: string
) {
  const now     = Math.floor(Date.now() / 1000);
  const expiry  = now + (cycle === 'annual' ? 365 : 31) * 86400;

  db.prepare(`UPDATE subscriptions SET status = 'cancelled', updated_at = unixepoch() WHERE user_id = ? AND status = 'active'`).run(userId);

  db.prepare(`
    INSERT INTO subscriptions
      (user_id, plan_slug, status, billing_cycle, amount_brl, gateway_sub_id, period_start, period_end, next_billing_at)
    VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?)
  `).run(userId, planSlug, cycle, amount, orderId, now, expiry, expiry);

  db.prepare(`UPDATE users SET role = ?, updated_at = unixepoch() WHERE id = ?`).run(planSlug, userId);

  db.prepare(`
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (?, ?, ?, 'success')
  `).run(userId, `✅ Plano ${planSlug} ativado!`, 'Seu acesso foi atualizado. Aproveite todos os recursos!');
}

// ── Demo sem Pagar.me ─────────────────────────────────────────
function simulatePayment(method: string, payId: number, plan: string) {
  if (method === 'pix') return {
    pix_qr_code:    `00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${(Math.random() * 100).toFixed(2)}5802BR5913RAPHA GURU6009SAO PAULO62140510RAPHAGURU${payId}6304ABCD`,
    pix_qr_base64:  'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=DEMO_PIX_RAPHA_GURU',
    pix_expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
  if (method === 'boleto') return {
    boleto_url:       'https://boleto.pagarme.com/demo',
    boleto_barcode:   '34191.75124 34567.261280 67117.190000 9 99990000100000',
    boleto_expires_at: Math.floor(Date.now() / 1000) + 3 * 86400,
  };
  return {};
}


// ── POST /refund ──────────────────────────────────────────────
router.post('/refund', requireAuth, async (req, res) => {
  const { payment_id, reason } = req.body as { payment_id?: number; reason?: string };
  if (!payment_id) return res.status(400).json({ error: 'payment_id obrigatório' });

  const pay = db.prepare(`SELECT * FROM payments WHERE id = ? AND user_id = ?`)
    .get(payment_id, req.user!.id) as Record<string, unknown> | undefined;
  if (!pay) return res.status(404).json({ error: 'Pagamento não encontrado' });
  if (pay.status !== 'paid') return res.status(400).json({ error: 'Apenas pagamentos pagos podem ser estornados' });

  try {
    if (PM_KEY && pay.gateway_order_id) {
      await pm('POST', `/orders/${pay.gateway_order_id}/refund`, { reason });
    }
    db.prepare(`UPDATE payments SET status = 'refunded', refunded_at = unixepoch(), failure_reason = ? WHERE id = ?`)
      .run(reason ?? 'Estorno solicitado pelo usuário', payment_id);
    db.prepare(`INSERT INTO notifications (user_id, title, body, type) VALUES (?, ?, ?, 'info')`)
      .run(req.user!.id, '💰 Estorno processado', `Seu estorno de R$ ${Number(pay.amount_brl).toFixed(2)} foi solicitado e será processado em até 7 dias úteis.`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro no estorno' });
  }
});

// ── POST /coupon/apply ────────────────────────────────────────
router.post('/coupon/apply', requireAuth, async (req, res) => {
  const { code, plan_slug } = req.body as { code?: string; plan_slug?: string };
  if (!code) return res.status(400).json({ error: 'Código obrigatório' });

  // Cupons hardcoded por enquanto — migrar para tabela depois
  const COUPONS: Record<string, { discount: number; type: 'pct' | 'fixed'; plans?: string[] }> = {
    'RAPHA10': { discount: 10, type: 'pct' },
    'RAPHA20': { discount: 20, type: 'pct' },
    'PROMO50': { discount: 50, type: 'fixed', plans: ['basic', 'pro'] },
    'ELITE30': { discount: 30, type: 'pct', plans: ['elite'] },
  };

  const coupon = COUPONS[code.toUpperCase()];
  if (!coupon) return res.status(404).json({ error: 'Cupom inválido ou expirado' });
  if (coupon.plans && plan_slug && !coupon.plans.includes(plan_slug))
    return res.status(400).json({ error: 'Cupom não válido para este plano' });

  res.json({ ok: true, coupon: { code, ...coupon } });
});

export default router;
