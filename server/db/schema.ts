import Database from 'better-sqlite3';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const { Pool } = pg;
const isProd = process.env.NODE_ENV === 'production';

function getDbInstance() {
  if ((global as any)._db_instance) return (global as any)._db_instance;

  let isPg = false;
  let pool: any;
  let sqliteDb: any;

  try {
    if (isProd && process.env.DATABASE_URL) {
      isPg = true;
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
    } else {
      const DATA = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
      sqliteDb = new Database(path.join(DATA, 'rapha.db'));
    }
  } catch (err) {
    console.error('[DB] Erro:', err);
  }

  const instance = {
    prepare: (sql: string) => {
      if (isPg) {
        const pgSql = sql
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
      }
      const stmt = sqliteDb.prepare(sql);
      return {
        get: async (...args: any[]) => stmt.get(...args),
        all: async (...args: any[]) => stmt.all(...args),
        run: async (...args: any[]) => stmt.run(...args)
      };
    },
    exec: async (sql: string) => {
      if (isPg) {
        const pgSql = sql
          .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
          .replace(/COLLATE NOCASE/g, '')
          .replace(/unixepoch\(\)/g, 'EXTRACT(EPOCH FROM NOW())::INTEGER')
          .replace(/DATETIME/g, 'TIMESTAMP')
          .replace(/REAL/g, 'DECIMAL');
        return await pool.query(pgSql);
      }
      return sqliteDb.exec(sql);
    },
    isPg
  };

  (global as any)._db_instance = instance;
  return instance;
}

export const db = getDbInstance();

export async function initDb() {
  const d = getDbInstance();
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT    NOT NULL UNIQUE,
      name          TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'free',
      is_active     INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
      updated_at    INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
    );
  `;
  if (d.isPg) await d.exec(schema);
  else await d.exec(schema.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT').replace(/EXTRACT\(EPOCH FROM NOW\(\)\)::INTEGER/g, 'unixepoch()'));

  const hash = bcrypt.hashSync('superadmin', 10);
  if (d.isPg) {
    await d.prepare(`INSERT INTO users (email, name, password_hash, role, is_active, email_verified) 
      VALUES ('admin@raphaguru.com', 'Administrador', $1, 'admin', 1, 1)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1`).run(hash);
  } else {
    await d.prepare(`INSERT OR REPLACE INTO users (email, name, password_hash, role, is_active, email_verified) 
      VALUES ('admin@raphaguru.com', 'Administrador', ?, 'admin', 1, 1)`).run(hash);
  }
}

export default db;
// v135
