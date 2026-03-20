/**
 * Rapha Guru — Admin + Estatísticas do Assinante
 * GET /api/admin/dashboard
 * GET /api/admin/users
 * PATCH /api/admin/users/:id
 * GET /api/admin/reports
 * GET /api/user/stats
 * GET /api/user/notifications
 */

import { Router } from 'express';
import { db } from '../db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════

// Dashboard executivo
router.get('/admin/dashboard', requireAuth, requireAdmin, (_req, res) => {
  const now    = Math.floor(Date.now() / 1000);
  const today  = now - 86400;
  const week   = now - 7 * 86400;
  const month  = now - 30 * 86400;

  const q = <T>(sql: string, ...params: unknown[]) =>
    db.prepare(sql).get(...params) as T;
  const qa = <T>(sql: string, ...params: unknown[]) =>
    db.prepare(sql).all(...params) as T[];

  const totalUsers   = q<{n:number}>(`SELECT COUNT(*) n FROM users WHERE role != 'admin'`).n;
  const activeToday  = q<{n:number}>(`SELECT COUNT(*) n FROM users WHERE last_login_at > ?`, today).n;
  const newToday     = q<{n:number}>(`SELECT COUNT(*) n FROM users WHERE created_at > ?`, today).n;
  const newWeek      = q<{n:number}>(`SELECT COUNT(*) n FROM users WHERE created_at > ?`, week).n;
  const newMonth     = q<{n:number}>(`SELECT COUNT(*) n FROM users WHERE created_at > ?`, month).n;
  const paidSubs     = q<{n:number}>(`SELECT COUNT(*) n FROM subscriptions WHERE status='active' AND plan_slug != 'free'`).n;
  const mrr          = q<{s:number}>(`SELECT COALESCE(SUM(amount_brl),0) s FROM subscriptions WHERE status='active' AND billing_cycle='monthly' AND plan_slug != 'free'`).s;
  const revenueMonth = q<{s:number}>(`SELECT COALESCE(SUM(amount_brl),0) s FROM payments WHERE status='paid' AND paid_at > ?`, month).s;
  const revenueWeek  = q<{s:number}>(`SELECT COALESCE(SUM(amount_brl),0) s FROM payments WHERE status='paid' AND paid_at > ?`, week).s;
  const revenueToday = q<{s:number}>(`SELECT COALESCE(SUM(amount_brl),0) s FROM payments WHERE status='paid' AND paid_at > ?`, today).s;
  const churnMonth   = q<{n:number}>(`SELECT COUNT(*) n FROM subscriptions WHERE status='cancelled' AND cancelled_at > ?`, month).n;

  const planDist     = qa<{plan_slug:string;n:number}>(`SELECT plan_slug, COUNT(*) n FROM subscriptions WHERE status='active' GROUP BY plan_slug ORDER BY n DESC`);
  const recentPays   = qa<Record<string,unknown>>(`
    SELECT p.id, p.amount_brl, p.status, p.method, p.created_at, p.paid_at,
           u.name user_name, u.email
    FROM payments p JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC LIMIT 20
  `);
  const topActions   = qa<{action:string;n:number}>(`
    SELECT action, COUNT(*) n FROM usage_logs WHERE created_at > ? GROUP BY action ORDER BY n DESC LIMIT 8
  `, month);
  const revenueChart = qa<{day:string;total:number;n:number}>(`
    SELECT date(paid_at,'unixepoch') day, SUM(amount_brl) total, COUNT(*) n
    FROM payments WHERE status='paid' AND paid_at > ?
    GROUP BY day ORDER BY day
  `, month);

  res.json({
    users:   { total: totalUsers, active_today: activeToday, new_today: newToday, new_week: newWeek, new_month: newMonth, paid_subs: paidSubs },
    revenue: { today: revenueToday, week: revenueWeek, month: revenueMonth, mrr, churn_month: churnMonth },
    plan_distribution: planDist,
    recent_payments: recentPays,
    top_actions: topActions,
    revenue_chart: revenueChart,
  });
});

// Lista usuários com paginação + busca
router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
  const { page = '1', limit = '25', q = '', role = '', status = '' } = req.query as Record<string, string>;
  const off = (Number(page) - 1) * Number(limit);
  const params: unknown[] = [];

  let where = `WHERE u.role != 'admin'`;
  if (q) { where += ` AND (u.email LIKE ? OR u.name LIKE ?)`; params.push(`%${q}%`, `%${q}%`); }
  if (role) { where += ` AND u.role = ?`; params.push(role); }
  if (status === 'active')   where += ` AND u.is_active = 1`;
  if (status === 'inactive') where += ` AND u.is_active = 0`;

  const total = (db.prepare(`SELECT COUNT(*) n FROM users u ${where}`).get(...params) as { n: number }).n;
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.is_active, u.email_verified,
           u.last_login_at, u.login_count, u.created_at,
           s.plan_slug, s.status sub_status, s.period_end
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
    ${where}
    ORDER BY u.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), off);

  res.json({ users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// Edita usuário (role, ativo, etc.)
router.patch('/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { role, is_active, name } = req.body as { role?: string; is_active?: number; name?: string };

  db.prepare(`
    UPDATE users SET
      role = COALESCE(?, role),
      is_active = COALESCE(?, is_active),
      name = COALESCE(?, name),
      updated_at = unixepoch()
    WHERE id = ?
  `).run(role ?? null, is_active ?? null, name ?? null, id);

  if (role && role !== 'admin') {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`UPDATE subscriptions SET status='cancelled', updated_at=unixepoch() WHERE user_id=? AND status='active'`).run(id);
    db.prepare(`
      INSERT INTO subscriptions (user_id, plan_slug, status, billing_cycle, amount_brl, period_start, period_end)
      VALUES (?, ?, 'active', 'monthly', 0, ?, ?)
    `).run(id, role, now, now + 30 * 86400);

    db.prepare(`
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (?, ?, ?, 'info')
    `).run(id, 'Plano atualizado pelo administrador', `Seu plano foi alterado para ${role}.`);
  }

  res.json({ ok: true });
});

// Relatórios detalhados
router.get('/admin/reports', requireAuth, requireAdmin, (req, res) => {
  const { days = '30' } = req.query as { days?: string };
  const since = Math.floor(Date.now() / 1000) - Number(days) * 86400;
  const qa = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as T[];

  res.json({
    revenue_by_day: qa(`
      SELECT date(paid_at,'unixepoch') day, SUM(amount_brl) total, COUNT(*) count
      FROM payments WHERE status='paid' AND paid_at > ? GROUP BY day ORDER BY day
    `, since),
    new_users_by_day: qa(`
      SELECT date(created_at,'unixepoch') day, COUNT(*) count
      FROM users WHERE created_at > ? GROUP BY day ORDER BY day
    `, since),
    churn_by_day: qa(`
      SELECT date(cancelled_at,'unixepoch') day, COUNT(*) count
      FROM subscriptions WHERE cancelled_at > ? GROUP BY day ORDER BY day
    `, since),
    plan_distribution: qa(`
      SELECT plan_slug, COUNT(*) count FROM subscriptions WHERE status='active' GROUP BY plan_slug
    `),
    payment_methods: qa(`
      SELECT method, COUNT(*) count, SUM(amount_brl) total
      FROM payments WHERE status='paid' AND paid_at > ? GROUP BY method
    `, since),
    top_users: qa(`
      SELECT u.id, u.email, u.name, u.role, COUNT(ul.id) actions
      FROM users u LEFT JOIN usage_logs ul ON ul.user_id = u.id AND ul.created_at > ?
      GROUP BY u.id ORDER BY actions DESC LIMIT 20
    `, since),
    pending_payments: qa(`
      SELECT p.*, u.name user_name, u.email FROM payments p JOIN users u ON u.id = p.user_id
      WHERE p.status = 'pending' ORDER BY p.created_at DESC LIMIT 20
    `),
  });
});

// ════════════════════════════════════════════════════════════
// ESTATÍSTICAS DO ASSINANTE
// ════════════════════════════════════════════════════════════

router.get('/user/stats', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const now    = Math.floor(Date.now() / 1000);
  const qa = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as T[];
  const q  = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as T;

  // Assinatura atual
  const sub = q<Record<string,unknown>>(`
    SELECT s.*, p.name plan_name, p.features, p.limits, p.price_monthly, p.badge_color
    FROM subscriptions s JOIN plans p ON p.slug = s.plan_slug
    WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 1
  `, userId);

  // Histórico de pagamentos
  const payments = qa<Record<string,unknown>>(`
    SELECT id, amount_brl, status, method, created_at, paid_at
    FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `, userId);

  // Uso por ação (total + últimos 30 dias)
  const usageTotal = qa<{action:string;n:number}>(`
    SELECT action, COUNT(*) n FROM usage_logs WHERE user_id = ? GROUP BY action
  `, userId);
  const usage30d = qa<{action:string;n:number}>(`
    SELECT action, COUNT(*) n FROM usage_logs WHERE user_id = ? AND created_at > ?
    GROUP BY action
  `, userId, now - 30 * 86400);
  const usageToday = qa<{action:string;n:number}>(`
    SELECT action, COUNT(*) n FROM usage_logs WHERE user_id = ? AND created_at > ?
    GROUP BY action
  `, userId, now - 86400);

  // Uso por dia (últimos 30 dias para gráfico)
  const usageChart = qa<{day:string;n:number}>(`
    SELECT date(created_at,'unixepoch') day, COUNT(*) n
    FROM usage_logs WHERE user_id = ? AND created_at > ?
    GROUP BY day ORDER BY day
  `, userId, now - 30 * 86400);

  // Streak de dias consecutivos com uso
  const days = qa<{day:string}>(`
    SELECT DISTINCT date(created_at,'unixepoch') day
    FROM usage_logs WHERE user_id = ? ORDER BY day DESC LIMIT 60
  `, userId);
  let streak = 0;
  let check = new Date(); check.setHours(0,0,0,0);
  for (const { day } of days) {
    const d = new Date(day + 'T00:00:00');
    const diff = Math.round((check.getTime() - d.getTime()) / 86400000);
    if (diff <= 1) { streak++; check = d; } else break;
  }

  // Notificações (e marca como lido)
  const notifications = qa<Record<string,unknown>>(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
  `, userId);
  db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`).run(userId);

  // Dados do usuário
  const user = q<Record<string,unknown>>(`
    SELECT id, email, name, role, avatar_url, phone, email_verified, login_count, last_login_at, created_at
    FROM users WHERE id = ?
  `, userId);

  const toMap = (arr: { action: string; n: number }[]) =>
    Object.fromEntries(arr.map(x => [x.action, x.n]));

  res.json({
    user,
    subscription: sub ? { ...sub, features: JSON.parse(sub.features as string), limits: JSON.parse(sub.limits as string) } : null,
    usage: {
      total:   toMap(usageTotal),
      last_30d: toMap(usage30d),
      today:   toMap(usageToday),
      chart:   usageChart,
    },
    streak_days: streak,
    payments,
    notifications,
    member_since: (user?.created_at as number) ?? null,
  });
});

router.post('/user/notify-read', requireAuth, (req, res) => {
  const { ids } = req.body as { ids?: number[] };
  if (ids?.length) {
    ids.forEach(id => db.prepare(`UPDATE notifications SET read=1 WHERE id=? AND user_id=?`).run(id, req.user!.id));
  } else {
    db.prepare(`UPDATE notifications SET read=1 WHERE user_id=?`).run(req.user!.id);
  }
  res.json({ ok: true });
});


// ── POST /api/usage/log — registra ação de uso ────────────────
router.post('/usage/log', requireAuth, (req, res) => {
  const { action, meta } = req.body as { action?: string; meta?: Record<string, unknown> };
  if (!action) { res.status(400).json({ error: 'action obrigatório' }); return; }
  try {
    db.prepare(`INSERT INTO usage_logs (user_id, action, meta, ip_address) VALUES (?, ?, ?, ?)`)
      .run(req.user!.id, action, meta ? JSON.stringify(meta) : null, req.ip ?? null);
    res.json({ ok: true });
  } catch { res.json({ ok: true }); } // nunca quebra
});


// ── DELETE usuário ────────────────────────────────────────────
router.delete('/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM users WHERE id = ? AND role != 'admin'`).run(id);
  res.json({ ok: true });
});

// ── Notificar usuário ─────────────────────────────────────────
router.post('/admin/users/:id/notify', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, body, type = 'info', action_url } = req.body as {
    title?: string; body?: string; type?: string; action_url?: string;
  };
  if (!title || !body) return res.status(400).json({ error: 'title e body obrigatórios' });
  db.prepare(`INSERT INTO notifications (user_id, title, body, type, action_url) VALUES (?, ?, ?, ?, ?)`)
    .run(id, title, body, type, action_url ?? null);
  res.json({ ok: true });
});

// ── Notificar TODOS os usuários ───────────────────────────────
router.post('/admin/notify-all', requireAuth, requireAdmin, (req, res) => {
  const { title, body, type = 'info', plan_filter } = req.body as {
    title?: string; body?: string; type?: string; plan_filter?: string;
  };
  if (!title || !body) return res.status(400).json({ error: 'title e body obrigatórios' });

  let users: { id: number }[];
  if (plan_filter) {
    users = db.prepare(`SELECT u.id FROM users u JOIN subscriptions s ON s.user_id = u.id WHERE s.plan_slug = ? AND s.status = 'active' AND u.is_active = 1`).all(plan_filter) as { id: number }[];
  } else {
    users = db.prepare(`SELECT id FROM users WHERE is_active = 1 AND role != 'admin'`).all() as { id: number }[];
  }

  const insert = db.prepare(`INSERT INTO notifications (user_id, title, body, type) VALUES (?, ?, ?, ?)`);
  const tx = db.transaction(() => { users.forEach(u => insert.run(u.id, title, body, type)); });
  tx();
  res.json({ ok: true, sent: users.length });
});

// ── Impersonar usuário (login como) ──────────────────────────
router.post('/admin/users/:id/impersonate', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const user = db.prepare(`SELECT id, email, name, role FROM users WHERE id = ? AND role != 'admin'`).get(id) as
    { id: number; email: string; name: string; role: string } | undefined;
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  // Gera token temporário com flag de impersonation
  const { signToken } = require('./auth.js');
  const token = signToken({ ...user, _impersonated_by: req.user!.id });
  res.json({ token, user });
});

// ── Exportar usuários CSV ─────────────────────────────────────
router.get('/admin/export/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.is_active, u.email_verified,
           u.phone, u.login_count, u.last_login_at, u.created_at,
           s.plan_slug, s.status sub_status, s.amount_brl sub_amount,
           s.billing_cycle, s.period_end
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
    WHERE u.role != 'admin'
    ORDER BY u.created_at DESC
  `).all() as Record<string, unknown>[];

  const headers = ['id','email','nome','plano','status','ativo','email_verificado','telefone','logins','ultimo_acesso','cadastro','valor_mensalidade','ciclo','proxima_cobranca'];
  const fmt = (ts: unknown) => ts ? new Date(Number(ts) * 1000).toLocaleDateString('pt-BR') : '';
  const rows = users.map(u => [
    u.id, u.email, u.name, u.plan_slug ?? 'free', u.sub_status ?? 'active',
    u.is_active ? 'sim' : 'não', u.email_verified ? 'sim' : 'não',
    u.phone ?? '', u.login_count, fmt(u.last_login_at), fmt(u.created_at),
    u.sub_amount ?? 0, u.billing_cycle ?? 'monthly', fmt(u.period_end),
  ]);

  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="usuarios-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send('\uFEFF' + csv); // BOM para Excel
});

// ── Criar/editar plano ────────────────────────────────────────
router.post('/admin/plans', requireAuth, requireAdmin, (req, res) => {
  const { slug, name, description, price_monthly, price_annual, features, limits, badge_color, sort_order, is_active } = req.body as {
    slug?: string; name?: string; description?: string; price_monthly?: number; price_annual?: number;
    features?: string[]; limits?: Record<string,number>; badge_color?: string; sort_order?: number; is_active?: number;
  };
  if (!slug || !name || price_monthly === undefined) return res.status(400).json({ error: 'slug, name e price_monthly obrigatórios' });

  db.prepare(`
    INSERT INTO plans (slug, name, description, price_monthly, price_annual, features, limits, badge_color, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name, description = excluded.description,
      price_monthly = excluded.price_monthly, price_annual = excluded.price_annual,
      features = excluded.features, limits = excluded.limits,
      badge_color = excluded.badge_color, sort_order = excluded.sort_order,
      is_active = excluded.is_active
  `).run(slug, name, description ?? null, price_monthly, price_annual ?? null,
    JSON.stringify(features ?? []), JSON.stringify(limits ?? {}),
    badge_color ?? '#3b82f6', sort_order ?? 0, is_active ?? 1);

  res.json({ ok: true });
});

// ── Estatísticas em tempo real ────────────────────────────────
router.get('/admin/realtime', requireAuth, requireAdmin, (_req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const hour = now - 3600;

  const q = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as T;
  const qa = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as T[];

  res.json({
    active_last_hour: q<{n:number}>(`SELECT COUNT(DISTINCT user_id) n FROM usage_logs WHERE created_at > ?`, hour).n,
    actions_last_hour: q<{n:number}>(`SELECT COUNT(*) n FROM usage_logs WHERE created_at > ?`, hour).n,
    pending_payments: q<{n:number}>(`SELECT COUNT(*) n FROM payments WHERE status = 'pending'`).n,
    pending_amount: q<{s:number}>(`SELECT COALESCE(SUM(amount_brl),0) s FROM payments WHERE status = 'pending'`).s,
    recent_signups: qa<{name:string;email:string;created_at:number}>(`SELECT name, email, created_at FROM users WHERE created_at > ? ORDER BY created_at DESC LIMIT 5`, hour),
    recent_actions: qa<{user_id:number;action:string;created_at:number}>(`SELECT user_id, action, created_at FROM usage_logs ORDER BY created_at DESC LIMIT 10`),
  });
});

export default router;
