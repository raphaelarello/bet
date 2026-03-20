# Rapha Guru — Módulo SaaS

Módulo completo de usuários, pagamentos, assinaturas e analytics.

---

## Instalação rápida

```bash
# 1. Instale as dependências novas
pnpm add better-sqlite3 bcrypt jsonwebtoken
pnpm add -D @types/better-sqlite3 @types/bcrypt @types/jsonwebtoken

# 2. Configure o .env
cp .env.example .env
# Edite .env e troque JWT_SECRET e PAGARME_API_KEY

# 3. Inicie o servidor (banco criado automaticamente)
pnpm dev
```

No primeiro start, o banco SQLite é criado em `data/rapha.db` com:
- 4 planos pré-configurados (Free, Básico, Pro, Elite)
- Admin padrão: `admin@raphaguru.com` / `Admin@2024`

---

## Arquitetura

```
server/
├── db/
│   └── schema.ts          ← SQLite (better-sqlite3) + seed de planos
├── middleware/
│   └── auth.ts            ← JWT + RBAC + logUsage
└── routes/
    ├── auth.ts            ← register, login, logout, /me, change-password
    ├── payments.ts        ← Pagar.me v5: PIX, boleto, cartão + webhook
    └── admin.ts           ← dashboard, users CRUD, reports, my-stats

client/src/
├── contexts/
│   └── AuthContext.tsx    ← AuthProvider, useAuth, PLAN_META
├── pages/saas/
│   ├── AuthPages.tsx      ← LoginPage + RegisterPage
│   ├── PlansPage.tsx      ← Pricing + checkout
│   ├── MyAccountPage.tsx  ← Dashboard do assinante (5 abas)
│   └── AdminPanel.tsx     ← Painel admin completo
└── components/saas/
    └── UserMenu.tsx       ← Badge de plano + menu dropdown
```

---

## Rotas adicionadas no App.tsx

| Rota | Componente |
|------|-----------|
| `/login` | LoginPage |
| `/cadastro` | RegisterPage |
| `/planos` | PlansPage |
| `/minha-conta` | MyAccountPage |
| `/admin` | AdminPanel |

---

## API Endpoints

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cria conta |
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/logout` | Revoga token |
| GET  | `/api/auth/me` | Perfil + assinatura + uso |
| PATCH | `/api/auth/profile` | Atualiza nome/telefone |
| POST | `/api/auth/change-password` | Troca senha |

### Pagamentos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/payments/plans` | Lista planos |
| GET  | `/api/payments/subscription` | Assinatura atual |
| POST | `/api/payments/checkout` | Gera PIX/boleto/cartão |
| POST | `/api/payments/webhook` | Webhook Pagar.me (ativa sub) |
| POST | `/api/payments/cancel` | Cancela assinatura |

### Admin
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/admin/dashboard` | KPIs executivos |
| GET  | `/api/admin/users` | Lista com paginação/busca |
| PATCH | `/api/admin/users/:id` | Edita plano/status |
| GET  | `/api/admin/reports` | Relatórios 30 dias |

### Usuário
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/user/stats` | Estatísticas completas |
| POST | `/api/user/notify-read` | Marca notificações lidas |

---

## Planos e limites

| Plano | Preço | Análises/dia | Favoritos | Histórico |
|-------|-------|-------------|-----------|-----------|
| Gratuito | R$ 0 | 5 | 2 | 7 dias |
| Básico | R$ 29,90 | 30 | 20 | 30 dias |
| Pro | R$ 69,90 | Ilimitado | Ilimitado | 90 dias |
| Elite | R$ 149,90 | Ilimitado | Ilimitado | Ilimitado |

---

## Adicionando o UserMenu ao header

No seu `Home.tsx`, importe e adicione:

```tsx
import { UserMenu } from '@/components/saas/UserMenu';

// Dentro do header, substitua os botões de ação por:
<UserMenu />
```

---

## Configurando Pagar.me

1. Crie conta em https://pagar.me (gratuito para testar)
2. No dashboard → Configurações → Chaves de API → copie a `ak_test_...`
3. Cole em `.env` como `PAGARME_API_KEY=ak_test_...`
4. Configure webhook: dashboard → Configurações → Webhooks → `https://seusite.com/api/payments/webhook`

**Sem a chave**, o sistema funciona em modo demo — gera QR codes e boletos simulados.

---

## Segurança

- Senhas com bcrypt (salt rounds=12)
- JWT com revogação por banco (não só expiração)
- Credenciais nunca retornadas nas responses
- Rate limit: não incluído — adicione `express-rate-limit` em produção
- HTTPS obrigatório em produção para cookies JWT
