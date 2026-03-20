/**
 * Rapha Guru — Auth Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 * PATCH /api/auth/profile
 * POST /api/auth/change-password
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/schema.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const SALT = 12;

// ── Registro ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, name, password, phone } = req.body as {
      email?: string; name?: string; password?: string; phone?: string;
    };

    if (!email || !name || !password)
      return res.status(400).json({ error: 'email, nome e senha são obrigatórios' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Senha deve ter ao menos 8 caracteres' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Email inválido' });

    const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
    if (exists) return res.status(409).json({ error: 'Email já cadastrado' });

    const hash = await bcrypt.hash(password, SALT);
    const result = db.prepare(`
      INSERT INTO users (email, name, password_hash, phone, role)
      VALUES (?, ?, ?, ?, 'free')
    `).run(email.toLowerCase(), name.trim(), hash, phone ?? null) as { lastInsertRowid: number };

    const userId = result.lastInsertRowid;

    // Cria assinatura free
    db.prepare(`
      INSERT INTO subscriptions (user_id, plan_slug, status, billing_cycle, amount_brl, period_start, period_end)
      VALUES (?, 'free', 'active', 'monthly', 0, unixepoch(), unixepoch() + 31536000)
    `).run(userId);

    // Notificação de boas-vindas
    db.prepare(`
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (?, '🎉 Bem-vindo ao Rapha Guru!', 'Sua conta foi criada. Explore as análises e faça upgrade quando quiser.', 'success')
    `).run(userId);

    const user = db.prepare(`SELECT id, email, name, role FROM users WHERE id = ?`).get(userId) as
      { id: number; email: string; name: string; role: string };

    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password)
      return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase()) as {
      id: number; email: string; name: string; password_hash: string;
      role: string; is_active: number;
    } | undefined;

    if (!user) return res.status(401).json({ error: 'Email ou senha incorretos' });
    if (!user.is_active) return res.status(403).json({ error: 'Conta desativada' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou senha incorretos' });

    db.prepare(`UPDATE users SET last_login_at = unixepoch(), login_count = login_count + 1 WHERE id = ?`).run(user.id);

    const sub = db.prepare(`
      SELECT s.*, p.name as plan_name, p.features, p.limits, p.price_monthly, p.badge_color
      FROM subscriptions s JOIN plans p ON p.slug = s.plan_slug
      WHERE s.user_id = ? AND s.status = 'active' ORDER BY s.created_at DESC LIMIT 1
    `).get(user.id) as Record<string, unknown> | undefined;

    res.json({
      token: signToken({ id: user.id, email: user.email, name: user.name, role: user.role }),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      subscription: sub ? {
        ...sub,
        features: JSON.parse(sub.features as string),
        limits: JSON.parse(sub.limits as string),
      } : null,
    });
  } catch (err) {
    console.error('[auth/login] ERRO COMPLETO:', JSON.stringify(err, null, 2));
    if (err instanceof Error) {
      console.error('[auth/login] Mensagem:', err.message);
      console.error('[auth/login] Stack:', err.stack);
    }
    res.status(500).json({ error: 'Erro interno', _dev: String(err) });
  }
});

// ── Logout ────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  db.prepare(`DELETE FROM sessions WHERE jti = ?`).run(req.user!.jti);
  res.json({ ok: true });
});

// ── /me ───────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.avatar_url, u.phone,
           u.email_verified, u.login_count, u.last_login_at, u.created_at
    FROM users u WHERE u.id = ?
  `).get(req.user!.id) as Record<string, unknown> | undefined;
  if (!user) return res.status(404).json({ error: 'Não encontrado' });

  const sub = db.prepare(`
    SELECT s.*, p.name as plan_name, p.features, p.limits, p.price_monthly, p.badge_color
    FROM subscriptions s JOIN plans p ON p.slug = s.plan_slug
    WHERE s.user_id = ? AND s.status = 'active' ORDER BY s.created_at DESC LIMIT 1
  `).get(req.user!.id) as Record<string, unknown> | undefined;

  const since30 = Math.floor(Date.now() / 1000) - 86400 * 30;
  const usage = db.prepare(`
    SELECT action, COUNT(*) as n FROM usage_logs WHERE user_id = ? AND created_at > ? GROUP BY action
  `).all(req.user!.id, since30) as { action: string; n: number }[];

  const unread = (db.prepare(`SELECT COUNT(*) as n FROM notifications WHERE user_id = ? AND read = 0`).get(req.user!.id) as { n: number }).n;

  res.json({
    user,
    subscription: sub ? { ...sub, features: JSON.parse(sub.features as string), limits: JSON.parse(sub.limits as string) } : null,
    usage_30d: Object.fromEntries(usage.map(u => [u.action, u.n])),
    unread_notifications: unread,
  });
});

// ── Atualiza perfil ───────────────────────────────────────────
router.patch('/profile', requireAuth, (req, res) => {
  const { name, phone, avatar_url } = req.body as { name?: string; phone?: string; avatar_url?: string };
  db.prepare(`
    UPDATE users SET
      name       = COALESCE(?, name),
      phone      = COALESCE(?, phone),
      avatar_url = COALESCE(?, avatar_url),
      updated_at = unixepoch()
    WHERE id = ?
  `).run(name ?? null, phone ?? null, avatar_url ?? null, req.user!.id);
  res.json({ ok: true });
});

// ── Troca senha ───────────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { current, novo } = req.body as { current?: string; novo?: string };
  if (!current || !novo) return res.status(400).json({ error: 'Campos obrigatórios' });
  if (novo.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });

  const user = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.user!.id) as { password_hash: string };
  if (!await bcrypt.compare(current, user.password_hash))
    return res.status(400).json({ error: 'Senha atual incorreta' });

  const hash = await bcrypt.hash(novo, SALT);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ?`).run(hash, req.user!.id);
  db.prepare(`DELETE FROM sessions WHERE user_id = ? AND jti != ?`).run(req.user!.id, req.user!.jti);

  res.json({ ok: true, message: 'Senha alterada. Outros dispositivos foram deslogados.' });
});


// ── Esqueci a senha ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'Email obrigatório' });

  const user = db.prepare(`SELECT id, name FROM users WHERE email = ?`).get(email.toLowerCase()) as
    { id: number; name: string } | undefined;

  // Sempre responde OK para não revelar se e-mail existe
  if (!user) return res.json({ ok: true, message: 'Se o e-mail existir, você receberá as instruções.' });

  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const expires = Math.floor(Date.now() / 1000) + 3600; // 1h

  db.prepare(`UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?`)
    .run(token, expires, user.id);

  // TODO: enviar e-mail com link: /reset-senha?token=${token}
  console.log(`[RESET] Link para ${email}: /reset-senha?token=${token}`);

  res.json({ ok: true, message: 'Se o e-mail existir, você receberá as instruções.', _dev_token: token });
});

// ── Redefinir senha ───────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) return res.status(400).json({ error: 'Token e senha obrigatórios' });
  if (password.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });

  const user = db.prepare(`
    SELECT id FROM users WHERE reset_token = ? AND reset_expires > unixepoch()
  `).get(token) as { id: number } | undefined;

  if (!user) return res.status(400).json({ error: 'Token inválido ou expirado' });

  const hash = await bcrypt.hash(password, SALT);
  db.prepare(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, updated_at = unixepoch() WHERE id = ?`)
    .run(hash, user.id);
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);

  res.json({ ok: true, message: 'Senha redefinida com sucesso!' });
});

// ── Refresh token ─────────────────────────────────────────────
router.post('/refresh', requireAuth, (req, res) => {
  const user = db.prepare(`SELECT id, email, name, role FROM users WHERE id = ? AND is_active = 1`).get(req.user!.id) as
    { id: number; email: string; name: string; role: string } | undefined;
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

  const sub = db.prepare(`
    SELECT s.*, p.features, p.limits, p.badge_color
    FROM subscriptions s JOIN plans p ON p.slug = s.plan_slug
    WHERE s.user_id = ? AND s.status = 'active' ORDER BY s.created_at DESC LIMIT 1
  `).get(user.id) as Record<string, unknown> | undefined;

  res.json({
    token: signToken(user),
    user,
    subscription: sub ? { ...sub, features: JSON.parse(sub.features as string), limits: JSON.parse(sub.limits as string) } : null,
  });
});


// ── Reset admin (emergência) ──────────────────────────────────
// Acessa via POST /api/auth/reset-admin com o JWT_SECRET no body
router.post('/reset-admin', async (req, res) => {
  const { secret } = req.body as { secret?: string };
  const expected = process.env.JWT_SECRET || 'rapha-guru-dev-secret-MUDE-EM-PRODUCAO';

  if (secret !== expected) {
    return res.status(403).json({ error: 'Secret incorreto' });
  }

  // SALT=10 para endpoint de emergência (mais rápido que 12, ainda seguro)
  const hash = await bcrypt.hash('superadmin', 10);
  const existing = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get() as { id: number } | undefined;

  if (existing) {
    db.prepare(`UPDATE users SET password_hash = ?, is_active = 1, email = 'admin@raphaguru.com' WHERE role = 'admin'`).run(hash);
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(existing.id);
    console.log('[AUTH] Senha admin resetada para: superadmin');
    return res.json({ ok: true, message: 'Senha admin resetada para: superadmin', email: 'admin@raphaguru.com' });
  } else {
    db.prepare(`INSERT INTO users (email, name, password_hash, role, is_active, email_verified) VALUES ('admin@raphaguru.com', 'Administrador', ?, 'admin', 1, 1)`).run(hash);
    const adminId = (db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get() as { id: number }).id;
    db.prepare(`INSERT INTO subscriptions (user_id, plan_slug, status, billing_cycle, amount_brl, period_start) VALUES (?, 'elite', 'active', 'monthly', 0, unixepoch())`).run(adminId);
    return res.json({ ok: true, message: 'Admin criado com senha: superadmin', email: 'admin@raphaguru.com' });
  }
});

export default router;
