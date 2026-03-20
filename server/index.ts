import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import automationRouter from "./automationRouter";
import { engine } from "./automation/engine";

type OddsWebhookPayload = {
  matchId: string;
  source?: string;
  provider?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeOdds?: number | null;
  drawOdds?: number | null;
  awayOdds?: number | null;
  over25Odds?: number | null;
  under25Odds?: number | null;
  over85CornersOdds?: number | null;
  over35CardsOdds?: number | null;
  raw?: unknown;
};

type OddsWebhookEntry = OddsWebhookPayload & { receivedAt: number };

const oddsStore = new Map<string, OddsWebhookEntry>();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeNumber(value: unknown) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function saveOdds(payload: OddsWebhookPayload) {
  const entry: OddsWebhookEntry = {
    matchId: String(payload.matchId),
    source: payload.source || "webhook",
    provider: payload.provider || "Feed externo",
    homeTeam: payload.homeTeam,
    awayTeam: payload.awayTeam,
    homeOdds: normalizeNumber(payload.homeOdds),
    drawOdds: normalizeNumber(payload.drawOdds),
    awayOdds: normalizeNumber(payload.awayOdds),
    over25Odds: normalizeNumber(payload.over25Odds),
    under25Odds: normalizeNumber(payload.under25Odds),
    over85CornersOdds: normalizeNumber(payload.over85CornersOdds),
    over35CardsOdds: normalizeNumber(payload.over35CardsOdds),
    raw: payload.raw,
    receivedAt: Date.now(),
  };
  oddsStore.set(entry.matchId, entry);
  return entry;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Segurança ──────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || true,
    credentials: true,
  }));
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
    standardHeaders: true, legacyHeaders: false,
  });
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, max: 200,
    message: { error: 'Limite de requisições atingido.' },
  });
  app.use('/api/', apiLimiter);
  app.use('/api/auth/login', loginLimiter);

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Banco e módulo SaaS
  try {
    const { initDb } = await import('./db/schema.js');
    await initDb();
    console.log('[Servidor] Banco SaaS pronto');
  } catch (err) {
    console.error('[Servidor] Erro crítico ao inicializar banco:', err);
  }

  try {
    const [authR, payR, adminR] = await Promise.all([
      import('./routes/auth.js').then((m) => m.default),
      import('./routes/payments.js').then((m) => m.default),
      import('./routes/admin.js').then((m) => m.default),
    ]);
    app.use('/api/auth', authR);
    app.use('/api/payments', payR);
    app.use('/api', adminR);
    console.log('[Servidor] Rotas SaaS: /api/auth, /api/payments, /api/admin, /api/user');
  } catch (err) {
    console.warn('[Servidor] Rotas SaaS indisponíveis:', err);
    app.use('/api/auth', (_req, res) => res.status(503).json({
      error: 'Módulo SaaS indisponível neste ambiente',
      detalhes: ['Instale dependências: better-sqlite3, bcrypt, jsonwebtoken'],
    }));
    app.use('/api/payments', (_req, res) => res.status(503).json({
      error: 'Pagamentos indisponíveis neste ambiente',
      detalhes: ['Defina PAGARME_API_KEY e instale as dependências do módulo SaaS'],
    }));
  }

  // Webhooks de cotações
  app.post('/api/webhooks/odds', (req, res) => {
    const body = req.body as OddsWebhookPayload | OddsWebhookPayload[];
    const list = Array.isArray(body) ? body : [body];
    const valid = list.filter((item) => item && item.matchId);
    if (valid.length === 0) {
      return res.status(400).json({ ok: false, message: 'Payload precisa incluir matchId' });
    }
    const saved = valid.map(saveOdds);
    return res.json({ ok: true, saved: saved.length, entries: saved });
  });

  app.get('/api/webhooks/odds/latest', (_req, res) => {
    const entries = [...oddsStore.values()].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 50);
    res.json({ entries });
  });

  app.get('/api/webhooks/odds/:matchId', (req, res) => {
    const entry = oddsStore.get(req.params.matchId);
    if (!entry) return res.status(404).json({ ok: false, message: 'Nenhum snapshot para este jogo' });
    return res.json(entry);
  });

  app.post('/api/webhooks/odds/demo', (_req, res) => {
    const sample = [
      { matchId: 'demo-001', source: 'demo', provider: 'Feed demonstração', homeTeam: 'Time da Casa', awayTeam: 'Time Visitante', homeOdds: 1.92, drawOdds: 3.35, awayOdds: 4.1, over25Odds: 1.84, under25Odds: 2.01, over85CornersOdds: 1.95, over35CardsOdds: 1.76 },
      { matchId: 'demo-002', source: 'demo', provider: 'Feed demonstração', homeTeam: 'Favorito FC', awayTeam: 'Zebra SC', homeOdds: 1.68, drawOdds: 3.7, awayOdds: 5.0, over25Odds: 1.71, under25Odds: 2.1, over85CornersOdds: 1.82, over35CardsOdds: 1.88 },
    ];
    sample.forEach(saveOdds);
    res.json({ ok: true, entries: [...oddsStore.values()] });
  });

  // Automação
  try {
    await engine.init();
    app.use('/api/automation', automationRouter);
    console.log('[Servidor] Módulo de automação carregado');
  } catch (err) {
    console.warn('[Servidor] Automação indisponível:', err);
    app.use('/api/automation', (_req, res) => {
      res.status(503).json({
        error: 'Módulo de automação indisponível neste ambiente',
        detalhes: ['Instale o Playwright', 'Execute: pnpm instalar:automacao', 'Reinicie o servidor'],
      });
    });
  }

  // Health check endpoint para o Render
  app.get('/api/health', (_req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      db: process.env.DATABASE_URL ? 'postgres-configured' : 'sqlite-fallback',
      globalKeys: Object.keys(global).filter(k => k.includes('db') || k.includes('init'))
    });
  });

  process.on('SIGTERM', async () => {
    await engine.shutdown().catch(() => undefined);
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await engine.shutdown().catch(() => undefined);
    process.exit(0);
  });

  const staticPath =
    process.env.NODE_ENV === 'production'
      ? path.resolve(__dirname, 'public')
      : path.resolve(__dirname, '..', 'dist', 'public');

  app.use(express.static(staticPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
