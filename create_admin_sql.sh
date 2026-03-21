#!/bin/bash

DB_PATH="/home/ubuntu/backend-bet/data/rapha.db"
EMAIL="admin@raphaguru.com"
NAME="Administrador"
PASSWORD="superadmin"
ROLE="admin"

# Gera o hash usando python (bcrypt)
HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'$PASSWORD', bcrypt.gensalt(12)).decode())")

# Cria o diretório data se não existir
mkdir -p /home/ubuntu/backend-bet/data

# Executa o SQL
sqlite3 "$DB_PATH" <<EOF
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
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

DELETE FROM users WHERE email = '$EMAIL';

INSERT INTO users (email, name, password_hash, role, is_active, email_verified, created_at, updated_at)
VALUES ('$EMAIL', '$NAME', '$HASH', '$ROLE', 1, 1, strftime('%s','now'), strftime('%s','now'));

CREATE TABLE IF NOT EXISTS subscriptions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  plan_slug     TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'active',
  billing_cycle TEXT    NOT NULL DEFAULT 'monthly',
  amount_brl    REAL    NOT NULL,
  period_start  INTEGER NOT NULL,
  period_end    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

INSERT INTO subscriptions (user_id, plan_slug, status, billing_cycle, amount_brl, period_start, period_end, created_at)
SELECT id, 'pro', 'active', 'monthly', 0, strftime('%s','now'), strftime('%s','now') + 31536000, strftime('%s','now')
FROM users WHERE email = '$EMAIL';
EOF

echo "Usuário admin criado/atualizado no banco local."
