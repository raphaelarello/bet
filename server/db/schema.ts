/**
 * Rapha Guru — Banco de Dados SQLite
 * Usa better-sqlite3 (síncrono, sem ORM, máxima performance)
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const DATA   = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA, 'rapha.db');

fs.mkdirSync(DATA, { recursive: true });

export const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// ── Schema completo ───────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'free',
    avatar_url    TEXT,
    phone         TEXT,
    cpf           TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    email_verified INTEGER NOT NULL DEFAULT 0,
    verify_token  TEXT,
    reset_token   TEXT,
    reset_expires INTEGER,
    last_login_at INTEGER,
    login_count   INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS plans (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    description   TEXT,
    price_monthly REAL NOT NULL DEFAULT 0,
    price_annual  REAL,
    features      TEXT NOT NULL DEFAULT '[]',
    limits        TEXT NOT NULL DEFAULT '{}',
    badge_color   TEXT DEFAULT '#3b82f6',
    is_active     INTEGER NOT NULL DEFAULT 1,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_slug           TEXT    NOT NULL,
    status              TEXT    NOT NULL DEFAULT 'pending',
    billing_cycle       TEXT    NOT NULL DEFAULT 'monthly',
    amount_brl          REAL    NOT NULL DEFAULT 0,
    payment_method      TEXT,
    gateway             TEXT    DEFAULT 'pagarme',
    gateway_sub_id      TEXT,
    gateway_customer_id TEXT,
    period_start        INTEGER,
    period_end          INTEGER,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    cancelled_at        INTEGER,
    cancel_reason       TEXT,
    next_billing_at     INTEGER,
    trial_ends_at       INTEGER,
    created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    subscription_id INTEGER REFERENCES subscriptions(id),
    amount_brl      REAL    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'pending',
    method          TEXT    NOT NULL,
    gateway         TEXT    NOT NULL DEFAULT 'pagarme',
    gateway_order_id TEXT,
    gateway_charge_id TEXT,
    pix_qr_code     TEXT,
    pix_qr_base64   TEXT,
    pix_expires_at  INTEGER,
    boleto_url      TEXT,
    boleto_barcode  TEXT,
    boleto_expires_at INTEGER,
    paid_at         INTEGER,
    refunded_at     INTEGER,
    failure_reason  TEXT,
    gateway_payload TEXT,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti        TEXT    NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action     TEXT    NOT NULL,
    meta       TEXT,
    ip_address TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT    NOT NULL,
    body       TEXT    NOT NULL,
    type       TEXT    NOT NULL DEFAULT 'info',
    read       INTEGER NOT NULL DEFAULT 0,
    action_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
  CREATE INDEX IF NOT EXISTS idx_subs_user_status  ON subscriptions(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_payments_user     ON payments(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_user_time   ON usage_logs(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_jti      ON sessions(jti);
  CREATE INDEX IF NOT EXISTS idx_notif_user_read   ON notifications(user_id, read);
`);

// ── Seed planos ───────────────────────────────────────────────
const insertPlan = db.prepare(`
  INSERT OR IGNORE INTO plans
    (slug, name, description, price_monthly, price_annual, features, limits, badge_color, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedPlans = db.transaction(() => {
  insertPlan.run('free', 'Gratuito', 'Explore sem compromisso', 0, null,
    JSON.stringify(['5 análises/dia', '2 favoritos', 'Histórico 7 dias']),
    JSON.stringify({ analyses_per_day: 5, favorites: 2, betslip: 3, history_days: 7 }),
    '#6b7280', 0);

  insertPlan.run('basic', 'Básico', 'Para apostadores casuais', 29.90, 239.90,
    JSON.stringify(['30 análises/dia', '20 favoritos', 'Histórico 30 dias', 'Suporte por e-mail']),
    JSON.stringify({ analyses_per_day: 30, favorites: 20, betslip: 10, history_days: 30 }),
    '#3b82f6', 1);

  insertPlan.run('pro', 'Pro', 'Para apostadores sérios', 69.90, 559.90,
    JSON.stringify(['Análises ilimitadas', 'Favoritos ilimitados', 'Histórico 90 dias', 'Value bets', 'Alertas ao vivo', 'Suporte prioritário']),
    JSON.stringify({ analyses_per_day: -1, favorites: -1, betslip: 20, history_days: 90 }),
    '#a855f7', 2);

  insertPlan.run('elite', 'Elite', 'Tudo sem limites', 149.90, 1199.90,
    JSON.stringify(['Tudo do Pro', 'Automação de apostas', 'Histórico ilimitado', 'Relatórios PDF', 'API de dados', 'Suporte VIP 24/7']),
    JSON.stringify({ analyses_per_day: -1, favorites: -1, betslip: -1, history_days: -1 }),
    '#f59e0b', 3);
});
seedPlans();

// ── Seed admin ────────────────────────────────────────────────
// ── Admin: sempre recria garantindo senha correta ─────────────
(function ensureAdmin() {
  const hash = bcrypt.hashSync('superadmin', 10);

  // Remove admin antigo e recria (garante e-mail e senha corretos)
  db.prepare(`DELETE FROM users WHERE role = 'admin'`).run();

  db.prepare(`
    INSERT INTO users (email, name, password_hash, role, is_active, email_verified)
    VALUES ('admin@raphaguru.com', 'Administrador', ?, 'admin', 1, 1)
  `).run(hash);

  const adminId = (db.prepare(
    `SELECT id FROM users WHERE role = 'admin' LIMIT 1`
  ).get() as { id: number }).id;

  // Assinatura elite
  db.prepare(`DELETE FROM subscriptions WHERE user_id = ?`).run(adminId);
  db.prepare(`
    INSERT INTO subscriptions (user_id, plan_slug, status, billing_cycle, amount_brl, period_start)
    VALUES (?, 'elite', 'active', 'monthly', 0, unixepoch())
  `).run(adminId);

  console.log('[DB] ✓ admin@raphaguru.com | senha: superadmin');
})();

console.log('[DB] SQLite pronto:', DB_FILE);
export default db;
