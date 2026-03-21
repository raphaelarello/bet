
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'rapha.db');
const db = new Database(dbPath);

const email = 'admin@raphaguru.com';
const name = 'Administrador';
const password = 'superadmin';
const role = 'admin';

const hash = bcrypt.hashSync(password, 12);

try {
  // Tenta inserir ou atualizar o usuário
  const result = db.prepare(`
    INSERT INTO users (email, name, password_hash, role, is_active, email_verified)
    VALUES (?, ?, ?, ?, 1, 1)
    ON CONFLICT(email) DO UPDATE SET 
      password_hash = excluded.password_hash,
      role = 'admin',
      is_active = 1
  `).run(email.toLowerCase(), name, hash, role);

  console.log('Usuário admin criado/atualizado com sucesso:', result);

  // Garante que o usuário tenha uma assinatura ativa
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (user) {
    db.prepare(`
      INSERT OR IGNORE INTO subscriptions (user_id, plan_slug, status, billing_cycle, amount_brl, period_start, period_end)
      VALUES (?, 'pro', 'active', 'monthly', 0, strftime('%s','now'), strftime('%s','now', '+1 year'))
    `).run(user.id);
    console.log('Assinatura Pro garantida para o admin.');
  }
} catch (err) {
  console.error('Erro ao criar usuário admin:', err);
} finally {
  db.close();
}
