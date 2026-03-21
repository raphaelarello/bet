/**
 * Rapha Guru — Marketing & Financeiro Routes
 * GET  /api/admin/crm/contacts
 * POST /api/admin/crm/contacts
 * PATCH /api/admin/crm/contacts/:id
 * DELETE /api/admin/crm/contacts/:id
 * GET  /api/admin/campaigns
 * POST /api/admin/campaigns
 * PATCH /api/admin/campaigns/:id
 * POST /api/admin/campaigns/:id/send
 * GET  /api/admin/financial/overview
 * GET  /api/admin/financial/delinquent
 * GET  /api/admin/financial/rules
 * POST /api/admin/financial/rules
 * PATCH /api/admin/financial/rules/:id
 */

import { Router } from 'express';
import db from '../db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import nodemailer from 'nodemailer';

const router = Router();

// ── helpers ──────────────────────────────────────────────────
const q  = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as T;
const qa = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as T[];

function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendChannel(channel: string, to: { email?: string; phone?: string; telegram_id?: string; name: string }, subject: string, body: string): Promise<boolean> {
  try {
    if (channel === 'email' && to.email) {
      const mailer = getMailer();
      if (!mailer) { console.warn('[marketing] SMTP not configured'); return false; }
      await mailer.sendMail({
        from: process.env.SMTP_FROM ?? 'noreply@raphaguru.com',
        to: to.email,
        subject,
        html: body.replace(/\n/g, '<br>'),
        text: body,
      });
      return true;
    }
    if (channel === 'whatsapp' && to.phone && process.env.WHATSAPP_TOKEN) {
      const phone = to.phone.replace(/\D/g, '');
      const res = await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } }),
      });
      return res.ok;
    }
    if (channel === 'telegram' && to.telegram_id && process.env.TELEGRAM_BOT_TOKEN) {
      const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: to.telegram_id, text: `*${subject}*\n\n${body}`, parse_mode: 'Markdown' }),
      });
      return res.ok;
    }
    // app notification (always available)
    if (channel === 'app' && (to as Record<string, unknown>).user_id) {
      db.prepare(`INSERT INTO notifications (user_id, title, body, type) VALUES (?, ?, ?, 'info')`).run(
        (to as Record<string, unknown>).user_id, subject, body
      );
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[marketing] send ${channel}:`, err);
    return false;
  }
}

// ══ CRM CONTACTS ═════════════════════════════════════════════

router.get('/admin/crm/contacts', requireAuth, requireAdmin, (req, res) => {
  const { status, q: search, page = '1', limit = '50' } = req.query as Record<string, string>;
  const off = (Number(page) - 1) * Number(limit);
  let where = '1=1';
  const params: unknown[] = [];
  if (status) { where += ` AND c.status = ?`; params.push(status); }
  if (search) { where += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const contacts = db.prepare(`
    SELECT c.*, u.role, u.last_login_at,
           s.plan_slug, s.status sub_status, s.period_end, s.amount_brl
    FROM crm_contacts c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN subscriptions s ON s.user_id = c.user_id AND s.status = 'active'
    WHERE ${where}
    ORDER BY c.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), off) as Record<string, unknown>[];

  const total = (db.prepare(`SELECT COUNT(*) n FROM crm_contacts c WHERE ${where}`).get(...params) as { n: number }).n;
  res.json({ contacts, total });
});

router.post('/admin/crm/contacts', requireAuth, requireAdmin, (req, res) => {
  const { name, email, phone, telegram_id, status = 'prospect', plan_interest, notes, tags } = req.body as Record<string, string>;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });

  // Link to existing user if email matches
  const user = email ? db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase()) as { id: number } | undefined : undefined;

  const r = db.prepare(`
    INSERT INTO crm_contacts (user_id, name, email, phone, telegram_id, status, plan_interest, notes, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user?.id ?? null, name, email ?? null, phone ?? null, telegram_id ?? null, status, plan_interest ?? null, notes ?? null, tags ?? '[]');

  res.json({ id: r.lastInsertRowid, ok: true });
});

router.patch('/admin/crm/contacts/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, email, phone, telegram_id, status, plan_interest, notes, tags } = req.body as Record<string, string>;
  db.prepare(`UPDATE crm_contacts SET name=COALESCE(?,name), email=COALESCE(?,email), phone=COALESCE(?,phone), telegram_id=COALESCE(?,telegram_id), status=COALESCE(?,status), plan_interest=COALESCE(?,plan_interest), notes=COALESCE(?,notes), tags=COALESCE(?,tags), updated_at=unixepoch() WHERE id=?`)
    .run(name??null, email??null, phone??null, telegram_id??null, status??null, plan_interest??null, notes??null, tags??null, id);
  res.json({ ok: true });
});

router.delete('/admin/crm/contacts/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM crm_contacts WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ══ CAMPAIGNS ════════════════════════════════════════════════

router.get('/admin/campaigns', requireAuth, requireAdmin, (_req, res) => {
  const campaigns = qa<Record<string, unknown>>(`
    SELECT c.*, (SELECT COUNT(*) FROM campaign_sends WHERE campaign_id = c.id) total_sends
    FROM campaigns c ORDER BY c.created_at DESC LIMIT 100
  `);
  res.json({ campaigns });
});

router.post('/admin/campaigns', requireAuth, requireAdmin, (req, res) => {
  const { title, type = 'email', audience = 'all', audience_filter, subject, body, art_url, scheduled_at } = req.body as Record<string, string>;
  if (!title || !body) return res.status(400).json({ error: 'Título e corpo obrigatórios' });
  const r = db.prepare(`INSERT INTO campaigns (title, type, status, audience, audience_filter, subject, body, art_url, scheduled_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(title, type, 'draft', audience, audience_filter ?? '{}', subject ?? title, body, art_url ?? null, scheduled_at ? new Date(scheduled_at).getTime() / 1000 : null, req.user!.id);
  res.json({ id: r.lastInsertRowid, ok: true });
});

router.patch('/admin/campaigns/:id', requireAuth, requireAdmin, (req, res) => {
  const { title, type, audience, audience_filter, subject, body, art_url, scheduled_at, status } = req.body as Record<string, string>;
  db.prepare(`UPDATE campaigns SET title=COALESCE(?,title), type=COALESCE(?,type), audience=COALESCE(?,audience), audience_filter=COALESCE(?,audience_filter), subject=COALESCE(?,subject), body=COALESCE(?,body), art_url=COALESCE(?,art_url), scheduled_at=COALESCE(?,scheduled_at), status=COALESCE(?,status), updated_at=unixepoch() WHERE id=?`)
    .run(title??null, type??null, audience??null, audience_filter??null, subject??null, body??null, art_url??null, scheduled_at ? new Date(scheduled_at).getTime() / 1000 : null, status??null, req.params.id);
  res.json({ ok: true });
});

router.post('/admin/campaigns/:id/send', requireAuth, requireAdmin, async (req, res) => {
  const camp = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(req.params.id) as Record<string, unknown> | undefined;
  if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });

  const channel = (camp.type as string) || 'email';
  const filter  = (() => { try { return JSON.parse(camp.audience_filter as string || '{}'); } catch { return {}; } })();

  // Build recipient list
  let users: { id: number; name: string; email: string; phone: string; telegram_id: string }[] = [];
  if (camp.audience === 'all') {
    users = db.prepare(`SELECT u.id, u.name, u.email, u.phone, NULL telegram_id FROM users u WHERE u.is_active=1 AND u.role != 'admin'`).all() as typeof users;
  } else if (camp.audience === 'plan' && filter.plan) {
    users = db.prepare(`SELECT u.id, u.name, u.email, u.phone, NULL telegram_id FROM users u JOIN subscriptions s ON s.user_id=u.id AND s.status='active' WHERE s.plan_slug=? AND u.is_active=1`).all(filter.plan) as typeof users;
  } else if (camp.audience === 'delinquent') {
    users = db.prepare(`SELECT u.id, u.name, u.email, u.phone, NULL telegram_id FROM users u JOIN subscriptions s ON s.user_id=u.id WHERE s.status='overdue' AND u.is_active=1`).all() as typeof users;
  } else if (camp.audience === 'prospects') {
    const contacts = db.prepare(`SELECT name, email, phone, telegram_id FROM crm_contacts WHERE status='prospect'`).all() as typeof users;
    users = contacts;
  } else if (camp.audience === 'expiring') {
    const days = filter.days ?? 7;
    const threshold = Math.floor(Date.now() / 1000) + days * 86400;
    users = db.prepare(`SELECT u.id, u.name, u.email, u.phone, NULL telegram_id FROM users u JOIN subscriptions s ON s.user_id=u.id AND s.status='active' WHERE s.period_end <= ? AND s.period_end > unixepoch() AND u.is_active=1`).all(threshold) as typeof users;
  }

  let sent = 0;
  for (const user of users) {
    const ok = await sendChannel(channel, user as Parameters<typeof sendChannel>[1], camp.subject as string, camp.body as string);
    const insertSend = db.prepare(`INSERT INTO campaign_sends (campaign_id, user_id, channel, status, sent_at) VALUES (?, ?, ?, ?, ?)`);
    insertSend.run(camp.id as number, (user as Record<string, unknown>).id ?? null, channel, ok ? 'sent' : 'failed', ok ? Math.floor(Date.now() / 1000) : null);
    if (ok) sent++;
  }

  db.prepare(`UPDATE campaigns SET status='sent', sent_at=unixepoch(), sent_count=? WHERE id=?`).run(sent, camp.id as number);
  res.json({ ok: true, sent, total: users.length });
});

// ══ FINANCIAL OVERVIEW ════════════════════════════════════════

router.get('/admin/financial/overview', requireAuth, requireAdmin, (_req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const month = now - 30 * 86400;

  const mrr = (db.prepare(`SELECT COALESCE(SUM(amount_brl),0) s FROM subscriptions WHERE status='active' AND billing_cycle='monthly'`).get() as {s:number}).s;
  const arr = (db.prepare(`SELECT COALESCE(SUM(amount_brl),0) s FROM subscriptions WHERE status='active' AND billing_cycle='annual'`).get() as {s:number}).s;
  const activeCount = (db.prepare(`SELECT COUNT(*) n FROM subscriptions WHERE status='active' AND plan_slug!='free'`).get() as {n:number}).n;
  const overdue = (db.prepare(`SELECT COUNT(*) n FROM subscriptions WHERE status='overdue'`).get() as {n:number}).n;

  // Vencendo nos próximos 7 dias
  const expiring7 = (db.prepare(`SELECT COUNT(*) n FROM subscriptions WHERE status='active' AND period_end BETWEEN unixepoch() AND unixepoch()+604800`).get() as {n:number}).n;
  const expiring30 = (db.prepare(`SELECT COUNT(*) n FROM subscriptions WHERE status='active' AND period_end BETWEEN unixepoch() AND unixepoch()+2592000`).get() as {n:number}).n;

  // Receita mês
  const revenueMonth = (db.prepare(`SELECT COALESCE(SUM(amount_brl),0) s FROM payments WHERE status='paid' AND paid_at > ?`).get(month) as {s:number}).s;

  // Churn (cancelados mês)
  const churnMonth = (db.prepare(`SELECT COUNT(*) n FROM subscriptions WHERE cancelled_at > ?`).get(month) as {n:number}).n;

  // Inadimplentes com dados
  const delinquents = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, s.plan_slug, s.amount_brl, s.period_end
    FROM subscriptions s JOIN users u ON u.id = s.user_id
    WHERE s.status = 'overdue'
    ORDER BY s.period_end ASC LIMIT 20
  `).all() as Record<string, unknown>[];

  // Vencendo em breve
  const expiringList = db.prepare(`
    SELECT u.id, u.name, u.email, s.plan_slug, s.amount_brl, s.period_end,
           CAST((s.period_end - unixepoch()) / 86400 AS INTEGER) days_left
    FROM subscriptions s JOIN users u ON u.id = s.user_id
    WHERE s.status='active' AND s.period_end BETWEEN unixepoch() AND unixepoch()+2592000
    ORDER BY s.period_end ASC LIMIT 30
  `).all() as Record<string, unknown>[];

  // Revenue by plan
  const byPlan = db.prepare(`
    SELECT plan_slug, COUNT(*) n, COALESCE(SUM(amount_brl),0) revenue
    FROM subscriptions WHERE status='active'
    GROUP BY plan_slug ORDER BY revenue DESC
  `).all() as Record<string, unknown>[];

  res.json({ mrr, arr, activeCount, overdue, expiring7, expiring30, revenueMonth, churnMonth, delinquents, expiringList, byPlan });
});

// ══ FINANCIAL RULES (régua automática) ═══════════════════════

router.get('/admin/financial/rules', requireAuth, requireAdmin, (_req, res) => {
  const rules = qa<Record<string, unknown>>(`SELECT * FROM financial_rules ORDER BY created_at DESC`);
  res.json({ rules });
});

router.post('/admin/financial/rules', requireAuth, requireAdmin, (req, res) => {
  const { name, trigger_type, days_before, channel, audience } = req.body as Record<string, string>;
  if (!name || !trigger_type) return res.status(400).json({ error: 'Nome e trigger obrigatórios' });
  const r = db.prepare(`INSERT INTO financial_rules (name, trigger_type, days_before, channel, audience) VALUES (?,?,?,?,?)`)
    .run(name, trigger_type, Number(days_before ?? 0), channel ?? 'email', audience ?? 'all');
  res.json({ id: r.lastInsertRowid, ok: true });
});

router.patch('/admin/financial/rules/:id', requireAuth, requireAdmin, (req, res) => {
  const { is_active, name, days_before, channel } = req.body as Record<string, unknown>;
  db.prepare(`UPDATE financial_rules SET is_active=COALESCE(?,is_active), name=COALESCE(?,name), days_before=COALESCE(?,days_before), channel=COALESCE(?,channel) WHERE id=?`)
    .run(is_active??null, name??null, days_before??null, channel??null, req.params.id);
  res.json({ ok: true });
});

export default router;
