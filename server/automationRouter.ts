/**
 * Rapha Guru — API REST de Automação
 * Expõe endpoints para o frontend controlar o motor de apostas
 * 
 * Credenciais são criptografadas com AES-256 antes de persistir.
 * A chave é gerada automaticamente e fica em data/key.bin (não versionar).
 */

import express from 'express';
import { engine, ADAPTERS } from './automation/engine.js';
import { BOOKMAKER_DEFS } from './automation/types.js';
import type { BookmakerAccount, BetOrder } from './automation/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const router = express.Router();
const DATA_DIR      = path.resolve(process.cwd(), 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.enc.json');
const KEY_FILE      = path.join(DATA_DIR, 'key.bin');

// ── Criptografia simples para credenciais em disco ────────────

function getOrCreateKey(): Buffer {
  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE);
  }
  const key = crypto.randomBytes(32);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 }); // só dono pode ler
  return key;
}

function encrypt(text: string): string {
  const key = getOrCreateKey();
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(data: string): string {
  const key = getOrCreateKey();
  const [ivHex, encHex] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return decipher.update(enc).toString('utf8') + decipher.final().toString('utf8');
}

// ── Persistência de contas ────────────────────────────────────

function loadAccounts(): BookmakerAccount[] {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];
    const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    const records = JSON.parse(raw) as Array<BookmakerAccount & { _pwd: string }>;
    return records.map(r => ({
      ...r,
      password: decrypt(r._pwd),
      _pwd: undefined as unknown as string,
    }));
  } catch { return []; }
}

function saveAccounts(accounts: BookmakerAccount[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const records = accounts.map(a => ({
    ...a,
    password: '',          // nunca salva em claro
    _pwd: encrypt(a.password),
  }));
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(records, null, 2), { mode: 0o600 });
}

// ── Limites de segurança ──────────────────────────────────────

function checkLimits(account: BookmakerAccount, order: BetOrder): string | null {
  if (order.stake > account.maxSingleStake) {
    return `Stake R$ ${order.stake} excede o limite por aposta (R$ ${account.maxSingleStake})`;
  }
  // Aqui poderia somar o total do dia, mas isso requer histórico
  return null;
}

// ────────────────────────────────────────────────────────────────
// ENDPOINTS
// ────────────────────────────────────────────────────────────────

// GET /api/automation/bookmakers — lista casas suportadas
router.get('/bookmakers', (_req, res) => {
  const list = Object.entries(BOOKMAKER_DEFS).map(([id, def]) => ({
    ...def,
    supported: !!ADAPTERS[id],
  }));
  res.json({ bookmakers: list });
});

// GET /api/automation/accounts — lista contas (sem senhas)
router.get('/accounts', (_req, res) => {
  const accounts = loadAccounts().map(a => ({ ...a, password: '***' }));
  res.json({ accounts });
});

// POST /api/automation/accounts — adiciona/atualiza conta
router.post('/accounts', express.json(), (req, res) => {
  const body = req.body as Partial<BookmakerAccount>;

  if (!body.bookmaker || !body.username || !body.password) {
    return res.status(400).json({ error: 'bookmaker, username e password são obrigatórios' });
  }

  if (!ADAPTERS[body.bookmaker]) {
    return res.status(400).json({ error: `Casa "${body.bookmaker}" não suportada` });
  }

  const accounts = loadAccounts();
  const existing = accounts.findIndex(a => a.id === body.id);

  const account: BookmakerAccount = {
    id:              body.id ?? `${body.bookmaker}_${Date.now()}`,
    bookmaker:       body.bookmaker,
    name:            body.name ?? body.bookmaker,
    username:        body.username,
    password:        body.password,
    maxDailyStake:   body.maxDailyStake ?? 500,
    maxSingleStake:  body.maxSingleStake ?? 100,
    enabled:         body.enabled ?? true,
    createdAt:       body.createdAt ?? new Date().toISOString(),
  };

  if (existing >= 0) {
    accounts[existing] = account;
  } else {
    accounts.push(account);
  }

  saveAccounts(accounts);
  res.json({ success: true, account: { ...account, password: '***' } });
});

// DELETE /api/automation/accounts/:id — remove conta
router.delete('/accounts/:id', (req, res) => {
  const accounts = loadAccounts().filter(a => a.id !== req.params.id);
  saveAccounts(accounts);
  res.json({ success: true });
});

// POST /api/automation/login — faz login em uma casa
router.post('/login', express.json(), async (req, res) => {
  const { accountId } = req.body as { accountId: string };
  const account = loadAccounts().find(a => a.id === accountId);

  if (!account) return res.status(404).json({ error: 'Conta não encontrada' });

  const result = await engine.login(account);
  res.json(result);
});

// GET /api/automation/status — status de todas as casas
router.get('/status', (_req, res) => {
  res.json({ status: engine.getAllStatus() });
});

// GET /api/automation/balance/:bookmaker — saldo
router.get('/balance/:bookmaker', async (req, res) => {
  const balance = await engine.getBalance(req.params.bookmaker);
  res.json({ bookmaker: req.params.bookmaker, balance });
});

// POST /api/automation/bet — executa aposta
router.post('/bet', express.json(), async (req, res) => {
  const { accountId, order } = req.body as { accountId: string; order: BetOrder };

  if (!accountId || !order) {
    return res.status(400).json({ error: 'accountId e order são obrigatórios' });
  }

  const account = loadAccounts().find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: 'Conta não encontrada' });
  if (!account.enabled) return res.status(400).json({ error: 'Conta desativada' });

  const limitError = checkLimits(account, order);
  if (limitError) return res.status(400).json({ error: limitError });

  const result = await engine.placeBet(account.bookmaker, order);
  res.json(result);
});

// POST /api/automation/bet/multi — aposta em múltiplas casas
router.post('/bet/multi', express.json(), async (req, res) => {
  const { accountIds, order } = req.body as { accountIds: string[]; order: BetOrder };

  const accounts = loadAccounts().filter(a => accountIds.includes(a.id) && a.enabled);
  if (accounts.length === 0) return res.status(400).json({ error: 'Nenhuma conta válida' });

  const results = await Promise.allSettled(
    accounts.map(async account => {
      const limitError = checkLimits(account, order);
      if (limitError) return { success: false, bookmaker: account.bookmaker, error: limitError };
      return engine.placeBet(account.bookmaker, order);
    })
  );

  res.json({
    results: results.map((r, i) => ({
      bookmaker: accounts[i]?.bookmaker,
      ...(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }),
    })),
  });
});

// GET /api/automation/logs — histórico de apostas
router.get('/logs', (_req, res) => {
  try {
    const LOG_DIR = path.join(DATA_DIR, 'bet_logs');
    if (!fs.existsSync(LOG_DIR)) return res.json({ entries: [] });

    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .slice(-7); // últimos 7 dias

    const entries: unknown[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(path.join(LOG_DIR, file), 'utf8').trim().split('\n');
      for (const line of lines) {
        if (line) {
          try { entries.push(JSON.parse(line)); } catch { /* skip */ }
        }
      }
    }

    res.json({ entries: entries.reverse() }); // mais recentes primeiro
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/automation/shutdown — encerra browser
router.post('/shutdown', async (_req, res) => {
  await engine.shutdown();
  res.json({ success: true });
});

export default router;
