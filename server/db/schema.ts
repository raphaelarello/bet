import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const isProd = process.env.NODE_ENV === 'production';

function getDbInstance() {
  if ((global as any)._db_instance) return (global as any)._db_instance;

  let sqliteDb: any;
  try {
    // No Railway, /tmp é o único lugar com permissão de escrita garantida
    const dbPath = isProd ? '/tmp/rapha.db' : path.resolve(process.cwd(), 'data', 'rapha.db');
    
    if (!isProd) {
      const DATA = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
    }

    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    console.log(`[DB] SQLite conectado em: ${dbPath}`);
  } catch (err) {
    console.error('[DB] Erro ao conectar SQLite:', err);
    throw err;
  }

  const instance = {
    prepare: (sql: string) => {
      const stmt = sqliteDb.prepare(sql);
      return {
        get: (...args: any[]) => stmt.get(...args),
        all: (...args: any[]) => stmt.all(...args),
        run: (...args: any[]) => stmt.run(...args)
      };
    },
    exec: (sql: string) => sqliteDb.exec(sql),
    sqlite: sqliteDb
  };

  (global as any)._db_instance = instance;
  return instance;
}

export const db = getDbInstance();

export function initDb() {
  const d = getDbInstance();
  
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      name          TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'free',
      is_active     INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER NOT NULL DEFAULT 0,
      login_count   INTEGER NOT NULL DEFAULT 0,
      last_login_at INTEGER,
      avatar_url    TEXT,
      phone         TEXT,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS plans (
      slug           TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      price_monthly  REAL NOT NULL,
      features       TEXT NOT NULL, -- JSON
      limits         TEXT NOT NULL, -- JSON
      badge_color    TEXT DEFAULT 'blue'
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      plan_slug     TEXT    NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'active',
      billing_cycle TEXT    NOT NULL DEFAULT 'monthly',
      amount_brl    REAL    NOT NULL,
      period_start  INTEGER NOT NULL,
      period_end    INTEGER NOT NULL,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      title      TEXT    NOT NULL,
      body       TEXT    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'info',
      read       INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      jti        TEXT    NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      action     TEXT    NOT NULL,
      ip_address TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Garante planos básicos
  const plans = [
    { slug: 'free', name: 'Plano Free', price: 0, features: '["Análises básicas", "1 robô ativo"]', limits: '{"robots": 1}' },
    { slug: 'pro', name: 'Plano Pro', price: 97.0, features: '["Análises Pro", "Robôs ilimitados", "Suporte VIP"]', limits: '{"robots": 999}' }
  ];

  for (const p of plans) {
    d.prepare(`INSERT OR IGNORE INTO plans (slug, name, price_monthly, features, limits) VALUES (?, ?, ?, ?, ?)`).run(
      p.slug, p.name, p.price, p.features, p.limits
    );
  }

  // Garante Admin
  const hash = bcrypt.hashSync('superadmin', 12);
  d.prepare(`
    INSERT INTO users (email, name, password_hash, role, is_active, email_verified)
    VALUES ('admin@raphaguru.com', 'Administrador', ?, 'admin', 1, 1)
    ON CONFLICT(email) DO UPDATE SET role='admin', is_active=1
  `).run(hash);

  console.log('[DB] Inicialização concluída');
}

export default db;
// v141-sqlite-tmp
