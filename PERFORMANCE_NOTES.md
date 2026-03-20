# Rapha Guru v59 — Correções e Otimizações

## 🔴 BUG CORRIGIDO: Reset Superadmin (404)

### Causa
O `vercel.json` redirecionava **todas** as rotas para `index.html`, inclusive as rotas `/api/*`.
Isso fazia o frontend receber as chamadas ao backend antes de chegar ao servidor Express.

### Correção aplicada (`vercel.json`)
A regra de rewrite agora exclui rotas `/api`, `/assets`, `/_next` e `/__manus__`:
```json
"source": "/((?!api|_next|favicon|assets|__manus__).*)"
```

### Como usar o reset-admin
```bash
curl -X POST https://SEU-DOMINIO/api/auth/reset-admin \
  -H "Content-Type: application/json" \
  -d '{ "secret": "VALOR_DO_JWT_SECRET_NO_.ENV" }'
```
- O JWT_SECRET padrão de dev é: `rapha-guru-dev-secret-MUDE-EM-PRODUCAO`
- **Troque o JWT_SECRET em produção!** (`JWT_SECRET=sua-senha-forte-aqui` no `.env`)
- Após o reset: e-mail `admin@raphaguru.com` / senha `superadmin`

---

## 🟡 PERFORMANCE: Code Splitting (`vite.config.ts`)

### O que foi feito
Adicionado `manualChunks` ao build do Vite para separar vendors em chunks independentes:
- `vendor-react` — react + react-dom
- `vendor-motion` — framer-motion (pesada, ~130kb)
- `vendor-charts` — recharts (~200kb)
- `vendor-radix` — componentes Radix UI
- `vendor-misc` — wouter, sonner, zod, utilitários

### Impacto esperado
- Primeira carga reduzida significativamente (cache de vendors entre deploys)
- Usuários recorrentes carregam só os chunks alterados no deploy

---

## 🟡 PERFORMANCE: Lazy Loading de Rotas (`App.tsx`)

### O que foi feito
Todas as rotas secundárias (Admin, Planos, Automação, etc.) agora carregam sob demanda com `React.lazy()`.
Apenas `Home` é carregado imediatamente por ser a rota principal.

### Rotas com lazy loading
- `/executor` — ExecutionCenter
- `/automacao` — AutomationCenter
- `/login`, `/cadastro`, `/esqueci-senha` — AuthPages
- `/planos` — PlansPage
- `/minha-conta` — MyAccountPage
- `/admin` — AdminPanel

Um spinner verde é exibido durante o carregamento de cada rota.

---

## 🟡 PERFORMANCE: Polling inteligente (`useMatches.ts`)

### O que foi feito
O polling ao vivo (30s) agora:
1. **Não dispara requisições quando a aba está em background** (`document.hidden`)
2. **Faz fetch imediato quando o usuário volta para a aba** (`visibilitychange`)

### Impacto
- Elimina dezenas de requisições desnecessárias ao ESPN por sessão
- Reduz uso de banda e carga no servidor de origem

---

## 🟢 MINOR: bcrypt SALT no reset-admin

Reduzido de 12 para 10 rounds no endpoint de emergência `/api/auth/reset-admin`.
Ainda seguro, mas responde em ~300ms ao invés de ~1s.
Os registros normais de usuários continuam com SALT=12.
