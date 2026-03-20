# Rapha Guru v36 — Automação integrada + passada agressiva em português

## O que entrou
- integração do módulo **Central de Automação** em `/automacao`
- rota adicionada no frontend
- botão de acesso à automação na home e na central de execução manual
- backend unificado com:
  - webhooks de cotações
  - rotas `/api/automation/*`
  - fallback 503 quando o navegador do Playwright não estiver instalado
- dependência `playwright` adicionada ao `package.json`
- script `pnpm instalar:automacao` para instalar o Chromium do módulo

## Passada agressiva em português
- reforço do tradutor de rótulos de mercado
- substituição de termos como:
  - `Decision Score` → `Índice de decisão`
  - `Heat` → `Pressão`
  - `Ranking` → `Classificação`
  - `Execution` → `Execução`
  - `Tips` / `Tip` → `Pitacos` / `Pitaco`
  - `Betslip` → `Bilhete`
- ajustes adicionais em telas principais

## Observações
- a automação depende de Playwright + Chromium no ambiente de hospedagem
- se o servidor já estiver publicado, é preciso reinstalar dependências e executar `pnpm instalar:automacao` antes de testar a nova área
