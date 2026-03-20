/**
 * Rapha Guru — Banco de Dados Híbrido (SQLite/PostgreSQL)
 * Usa SQLite localmente e PostgreSQL (Supabase) em produção no Railway
 */

import Database from 'better-sqlite3';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const isProd = process.env.NODE_ENV === 'production';

// ── Configuração do Banco ─────────────────────────────────────
let db: any;
let isPg = false;

if (isProd && process.env.DATABASE_URL) {
  console.log('[DB] Usando PostgreSQL (Produção)');
  isPg = true;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  // Wrapper para manter compatibilidade com better-sqlite3
  db = {
    prepare: (sql: string) => {
      // Converte sintaxe SQLite para PostgreSQL básica
      let pgSql = sql
        .replace(/\?/g, (_, i, full) => `$${full.slice(0, i).split('?').length}`)
        .replace(/unixepoch\(\)/g, 'EXTRACT(EPOCH FROM NOW())::INTEGER')
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
        .replace(/COLLATE NOCASE/g, '')
        .replace(/unixepoch\(\) \+ (\d+)/g, 'EXTRACT(EPOCH FROM NOW())::INTEGER + $1');

      return {
        get: async (...args: any[]) => {
          const res = await pool.query(pgSql, args);
          return res.rows[0];
        },
        all: async (...args: any[]) => {
          const res = await pool.query(pgSql, args);
          return res.rows;
        },
        run: async (...args: any[]) => {
          const res = await pool.query(pgSql, args);
          return { lastInsertRowid: res.rows[0]?.id || 0, changes: res.rowCount };
        }
      };
    },
    exec: async (sql: string) => {
      const pgSql = sql
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
        .replace(/COLLATE NOCASE/g, '')
        .replace(/unixepoch\(\)/g, 'EXTRACT(EPOCH FROM NOW())::INTEGER')
        .replace(/DATETIME/g, 'TIMESTAMP')
        .replace(/REAL/g, 'DECIMAL');
      return await pool.query(pgSql);
    }
  };
} else {
  console.log('[DB] Usando SQLite (Desenvolvimento)');
  const __dir = path.dirname(fileURLToPath(import.meta.url));
  const DATA = path.resolve(process.cwd(), 'data');
  const DB_FILE = path.join(DATA, 'rapha.db');

  if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

// ── Inicialização do Schema ───────────────────────────────────
async function initDb() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT    NOT NULL UNIQUE,
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
      created_at    INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
      updated_at    INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS plans (
      id            SERIAL PRIMARY KEY,
      slug          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      description   TEXT,
      price_monthly DECIMAL NOT NULL DEFAULT 0,
      price_annual  DECIMAL,
      features      TEXT NOT NULL DEFAULT '[]',
      limits        TEXT NOT NULL DEFAULT '{}',
      badge_color   TEXT DEFAULT '#3b82f6',
      is_active     INTEGER NOT NULL DEFAULT 1,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id                  SERIAL PRIMARY KEY,
      user_id             INTEGER NOT NULL,
      plan_slug           TEXT    NOT NULL,
      status              TEXT    NOT NULL DEFAULT 'pending',
      billing_cycle       TEXT    NOT NULL DEFAULT 'monthly',
      amount_brl          DECIMAL NOT NULL DEFAULT 0,
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
      created_at          INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
      updated_at          INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
    );
  `;

  if (isPg) {
    await db.exec(schema);
  } else {
    // SQLite usa sintaxe original
    db.exec(schema.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT').replace(/EXTRACT\(EPOCH FROM NOW\(\)\)::INTEGER/g, 'unixepoch()'));
  }

  // Seed Admin
  const hash = bcrypt.hashSync('superadmin', 10);
  if (isPg) {
    await db.prepare(`INSERT INTO users (email, name, password_hash, role, is_active, email_verified) 
      VALUES ('admin@raphaguru.com', 'Administrador', $1, 'admin', 1, 1)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1`).run(hash);
  } else {
    db.prepare(`INSERT OR REPLACE INTO users (email, name, password_hash, role, is_active, email_verified) 
      VALUES ('admin@raphaguru.com', 'Administrador', ?, 'admin', 1, 1)`).run(hash);
  }
  console.log('[DB] ✓ admin@raphaguru.com | senha: superadmin');
}

export { db, initDb };
