import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Importações síncronas para garantir que tudo esteja pronto
import { initDb } from './db/schema.js';
import authR from './routes/auth.js';
import payR from './routes/payments.js';
import adminR from './routes/admin.js';
import automationRouter from "./automationRouter.js";
import { engine } from "./automation/engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Inicialização do Banco ──────────────────────────────
  try {
    initDb();
    console.log('[Servidor] Banco SQLite pronto em /tmp/rapha.db');
  } catch (err) {
    console.error('[Servidor] Erro crítico ao inicializar banco:', err);
  }

  // ── Segurança ──────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin: true,
    credentials: true,
  }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Aumentado para facilitar testes
    message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ── Rotas da API ───────────────────────────────────────
  app.use('/api/auth', authR);
  app.use('/api/payments', payR);
  app.use('/api', adminR);
  app.use('/api/automation', automationRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ 
      status: 'ok-v141-confirmed', 
      timestamp: new Date().toISOString(),
      db: 'sqlite-tmp'
    });
  });

  // Automação
  engine.init().catch(err => console.warn('[Servidor] Automação indisponível:', err));

  // ── Frontend Estático ──────────────────────────────────
  const staticPath = path.resolve(__dirname, 'public');
  app.use(express.static(staticPath));
  
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(staticPath, 'index.html'));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Servidor v141 rodando na porta ${port}`);
  });
}

startServer().catch(console.error);
// v141-final-fix
