/**
 * Rapha Guru — Auth Routes
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import * as schema from '../db/schema.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const SALT = 12;

// Garante que o db não seja undefined
const db = schema.db || (schema as any).default || (global as any).db;

if (!db) {
  console.error('[AUTH] Erro crítico: Objeto db não encontrado no schema ou global');
}

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

    const exists = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
    if (exists) return res.status(409).json({ error: 'Email já cadastrado' });

    const hash = await bcrypt.hash(password, SALT);
    const result = await db.prepare(`
      INSERT INTO users (email, name, password_hash, phone, role)
      VALUES (?, ?, ?, ?, 'free')
    `).run(email.toLowerCase(), name.trim(), hash, phone ?? null) as { lastInsertRowid: number };

    const userId = result.lastInsertRowid;

    // Cria assinatura free
    await db.prepare(`
      INSERT INTO subscriptions (user_id, plan_slug, status, billing_cycle, amount_brl, period_start, period_end)
      VALUES (?, 'free', 'active', 'monthly', 0, (EXTRACT(EPOCH FROM NOW())::INTEGER), (EXTRACT(EPOCH FROM NOW())::INTEGER) + 31536000)
    `).run(userId);

    // Notificação de boas-vindas
    await db.prepare(`
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (?, '🎉 Bem-vindo ao Rapha Guru!', 'Sua conta foi criada. Explore as análises e faça upgrade quando quiser.', 'success')
    `).run(userId);

    const user = await db.prepare(`SELECT id, email, name, role FROM users WHERE id = ?`).get(userId) as
      { id: number; email: string; name: string; role: string };

    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Erro interno', _dev: String(err) });
  }
});

// ── Login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password)
      return res.status(400).json({ error: 'Email e senha obrigatórios' });

    if (!db) throw new Error('Banco de dados não disponível');

    const user = await db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase()) as {
      id: number; email: string; name: string; password_hash: string;
      role: string; is_active: number;
    } | undefined;

    if (!user) return res.status(401).json({ error: 'Email ou senha incorretos' });
    if (!user.is_active) return res.status(403).json({ error: 'Conta desativada' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou senha incorretos' });

    await db.prepare(`UPDATE users SET last_login_at = (EXTRACT(EPOCH FROM NOW())::INTEGER), login_count = login_count + 1 WHERE id = ?`).run(user.id);

    const sub = await db.prepare(`
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
    console.error('[auth/login] ERRO:', err);
    res.status(500).json({ error: 'Erro interno', _dev: String(err) });
  }
});

// ── Logout ────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  await db.prepare(`DELETE FROM sessions WHERE jti = ?`).run(req.user!.jti);
  res.json({ ok: true });
});

// ── /me ───────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const user = await db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.avatar_url, u.phone,
           u.email_verified, u.login_count, u.last_login_at, u.created_at
    FROM users u WHERE u.id = ?
  `).get(req.user!.id) as Record<string, unknown> | undefined;
  if (!user) return res.status(404).json({ error: 'Não encontrado' });

  const sub = await db.prepare(`
    SELECT s.*, p.name as plan_name, p.features, p.limits, p.price_monthly, p.badge_color
    FROM subscriptions s JOIN plans p ON p.slug = s.plan_slug
    WHERE s.user_id = ? AND s.status = 'active' ORDER BY s.created_at DESC LIMIT 1
  `).get(req.user!.id) as Record<string, unknown> | undefined;

  const since30 = Math.floor(Date.now() / 1000) - 86400 * 30;
  const usage = await db.prepare(`
    SELECT action, COUNT(*) as n FROM usage_logs WHERE user_id = ? AND created_at > ? GROUP BY action
  `).all(req.user!.id, since30) as { action: string; n: number }[];

  const unreadRes = await db.prepare(`SELECT COUNT(*) as n FROM notifications WHERE user_id = ? AND read = 0`).get(req.user!.id) as { n: number };
  const unread = unreadRes.n;

  res.json({
    user,
    subscription: sub ? { ...sub, features: JSON.parse(sub.features as string), limits: JSON.parse(sub.limits as string) } : null,
    usage_30d: Object.fromEntries(usage.map(u => [u.action, u.n])),
    unread_notifications: unread,
  });
});

// ── Atualiza perfil ───────────────────────────────────────────
router.patch('/profile', requireAuth, async (req, res) => {
  const { name, phone, avatar_url } = req.body as { name?: string; phone?: string; avatar_url?: string };
  await db.prepare(`
    UPDATE users SET
      name       = COALESCE(?, name),
      phone      = COALESCE(?, phone),
      avatar_url = COALESCE(?, avatar_url),
      updated_at = (EXTRACT(EPOCH FROM NOW())::INTEGER)
    WHERE id = ?
  `).run(name ?? null, phone ?? null, avatar_url ?? null, req.user!.id);
  res.json({ ok: true });
});

// ── Troca senha ───────────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { current, novo } = req.body as { current?: string; novo?: string };
  if (!current || !novo) return res.status(400).json({ error: 'Campos obrigatórios' });
  if (novo.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });

  const user = await db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.user!.id) as { password_hash: string };
  if (!await bcrypt.compare(current, user.password_hash))
    return res.status(400).json({ error: 'Senha atual incorreta' });

  const hash = await bcrypt.hash(novo, SALT);
  await db.prepare(`UPDATE users SET password_hash = ?, updated_at = (EXTRACT(EPOCH FROM NOW())::INTEGER) WHERE id = ?`).run(hash, req.user!.id);
  await db.prepare(`DELETE FROM sessions WHERE user_id = ? AND jti != ?`).run(req.user!.id, req.user!.jti);

  res.json({ ok: true, message: 'Senha alterada. Outros dispositivos foram deslogados.' });
});

export default router;
// v134
