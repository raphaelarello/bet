/**
 * Rapha Guru — Automation API Router v3.0
 * Credenciais criptografadas AES-256 · Fila com mutex · Retry automático
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

// ── AES-256 encryption ────────────────────────────────────────
function getKey(): Buffer {
  if (fs.existsSync(KEY_FILE)) return fs.readFileSync(KEY_FILE);
  const key = crypto.randomBytes(32);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
  return key;
}

function encrypt(text: string): string {
  const key = getKey(), iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return iv.toString('hex') + ':' + Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex');
}

function decrypt(data: string): string {
  const key = getKey(), [ivHex, encHex] = data.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final().toString('utf8');
}

// ── Account persistence ───────────────────────────────────────
function loadAccounts(): BookmakerAccount[] {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];
    const records = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')) as Array<BookmakerAccount & { _pwd: string }>;
    return records.map(r => ({ ...r, password: decrypt(r._pwd), _pwd: undefined as unknown as string }));
  } catch { return []; }
}

function saveAccounts(accounts: BookmakerAccount[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(
    accounts.map(a => ({ ...a, password: '', _pwd: encrypt(a.password) })), null, 2
  ), { mode: 0o600 });
}

// ── Validation helpers ────────────────────────────────────────
function checkLimits(account: BookmakerAccount, order: BetOrder): string | null {
  if (order.stake > account.maxSingleStake) {
    return `Stake R$ ${order.stake} excede limite por aposta (R$ ${account.maxSingleStake})`;
  }
  if (order.odds < (account.minOddsAccepted ?? 1.01)) {
    return `Odd ${order.odds} abaixo do mínimo configurado (${account.minOddsAccepted ?? 1.01})`;
  }
  if (account.maxOddsAccepted && order.odds > account.maxOddsAccepted) {
    return `Odd ${order.odds} acima do máximo configurado (${account.maxOddsAccepted})`;
  }
  return null;
}

// ── Routes ────────────────────────────────────────────────────

router.get('/bookmakers', (_req, res) => {
  res.json({ bookmakers: Object.entries(BOOKMAKER_DEFS).map(([id, def]) => ({ ...def, supported: !!ADAPTERS[id] })) });
});

router.get('/accounts', (_req, res) => {
  res.json({ accounts: loadAccounts().map(a => ({ ...a, password: '***' })) });
});

router.post('/accounts', express.json(), (req, res) => {
  const body = req.body as Partial<BookmakerAccount>;
  if (!body.bookmaker || !body.username || !body.password) {
    return res.status(400).json({ error: 'bookmaker, username e password são obrigatórios' });
  }
  if (!ADAPTERS[body.bookmaker]) {
    return res.status(400).json({ error: `Casa "${body.bookmaker}" não suportada` });
  }
  const accounts = loadAccounts();
  const account: BookmakerAccount = {
    id:               body.id ?? `${body.bookmaker}_${Date.now()}`,
    bookmaker:        body.bookmaker,
    name:             body.name ?? body.bookmaker,
    username:         body.username,
    password:         body.password,
    maxDailyStake:    body.maxDailyStake ?? 500,
    maxSingleStake:   body.maxSingleStake ?? 100,
    maxOddsAccepted:  body.maxOddsAccepted ?? 10,
    minOddsAccepted:  body.minOddsAccepted ?? 1.05,
    enabled:          body.enabled ?? true,
    createdAt:        body.createdAt ?? new Date().toISOString(),
  };
  const idx = accounts.findIndex(a => a.id === account.id);
  if (idx >= 0) accounts[idx] = account; else accounts.push(account);
  saveAccounts(accounts);
  res.json({ success: true, account: { ...account, password: '***' } });
});

router.patch('/accounts/:id', express.json(), (req, res) => {
  const accounts = loadAccounts();
  const idx = accounts.findIndex(a => a.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Conta não encontrada' });
  const body = req.body as Partial<BookmakerAccount>;
  accounts[idx] = { ...accounts[idx], ...body, id: accounts[idx].id };
  saveAccounts(accounts);
  res.json({ success: true });
});

router.delete('/accounts/:id', (_req, res) => {
  saveAccounts(loadAccounts().filter(a => a.id !== _req.params.id));
  res.json({ success: true });
});

router.post('/login', express.json(), async (req, res) => {
  const { accountId } = req.body as { accountId: string };
  const account = loadAccounts().find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: 'Conta não encontrada' });
  const result = await engine.login(account);
  res.json(result);
});

router.get('/status', (_req, res) => {
  res.json({ status: engine.getAllStatus() });
});

router.get('/balance/:bookmaker', async (req, res) => {
  const balance = await engine.getBalance(req.params.bookmaker);
  res.json({ bookmaker: req.params.bookmaker, balance });
});

// ── Bet — single, immediate ────────────────────────────────────
router.post('/bet', express.json(), async (req, res) => {
  const { accountId, order } = req.body as { accountId: string; order: BetOrder };
  if (!accountId || !order) return res.status(400).json({ error: 'accountId e order obrigatórios' });

  const account = loadAccounts().find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: 'Conta não encontrada' });
  if (!account.enabled) return res.status(400).json({ error: 'Conta desativada' });

  const limitErr = checkLimits(account, order);
  if (limitErr) return res.status(400).json({ error: limitErr });

  const result = await engine.placeBet(account.bookmaker, order, account);
  res.json(result);
});

// ── Multi-bet — parallel across bookmakers ─────────────────────
router.post('/bet/multi', express.json(), async (req, res) => {
  const { accountIds, order } = req.body as { accountIds: string[]; order: BetOrder };
  const accounts = loadAccounts().filter(a => accountIds.includes(a.id) && a.enabled);
  if (!accounts.length) return res.status(400).json({ error: 'Nenhuma conta válida' });

  const results = await Promise.allSettled(
    accounts.map(async account => {
      const err = checkLimits(account, order);
      if (err) return { success: false, bookmaker: account.bookmaker, error: err };
      return engine.placeBet(account.bookmaker, order, account);
    })
  );

  res.json({ results: results.map((r, i) => ({
    bookmaker: accounts[i]?.bookmaker,
    ...(r.status === 'fulfilled' ? r.value : { success: false, error: String(r.reason) }),
  })) });
});

// ── Queue endpoints ────────────────────────────────────────────
router.get('/queue', (_req, res) => {
  res.json({ queue: engine.getQueue() });
});

router.post('/queue', express.json(), (req, res) => {
  const { accountId, order, maxRetries = 3 } = req.body as { accountId: string; order: BetOrder; maxRetries?: number };
  const account = loadAccounts().find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: 'Conta não encontrada' });

  const err = checkLimits(account, order);
  if (err) return res.status(400).json({ error: err });

  const item = engine.addToQueue(accountId, account.bookmaker, order, maxRetries);
  res.json({ success: true, queueItemId: item.id, item });
});

router.post('/queue/run', express.json(), async (req, res) => {
  const accounts = loadAccounts();
  const results  = await engine.runQueue(accounts);
  res.json({ results });
});

router.delete('/queue/:id', (req, res) => {
  const ok = engine.cancelQueueItem(req.params.id);
  res.json({ success: ok, message: ok ? 'Cancelado' : 'Item não encontrado ou já executando' });
});

router.delete('/queue', (_req, res) => {
  engine.clearQueue();
  res.json({ success: true });
});

// ── Logs ──────────────────────────────────────────────────────
router.get('/logs', (req, res) => {
  const days = Number((req.query as Record<string, string>).days ?? 7);
  res.json({ entries: engine.getLogs(days) });
});

// ── Screenshots ───────────────────────────────────────────────
router.get('/screenshots', (_req, res) => {
  const dir = path.resolve(process.cwd(), 'data', 'screenshots');
  if (!fs.existsSync(dir)) return res.json({ files: [] });
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.png'))
    .sort()
    .reverse()
    .slice(0, 50)
    .map(f => ({ name: f, ts: f.split('_')[1], bookmaker: f.split('_')[0], ok: f.includes('_ok') }));
  res.json({ files });
});

router.get('/screenshots/:name', (req, res) => {
  const file = path.resolve(process.cwd(), 'data', 'screenshots', req.params.name.replace(/\//g, ''));
  if (!fs.existsSync(file) || !file.endsWith('.png')) return res.status(404).end();
  res.setHeader('Content-Type', 'image/png');
  fs.createReadStream(file).pipe(res);
});

router.post('/shutdown', async (_req, res) => {
  await engine.shutdown();
  res.json({ success: true });
});

export default router;
