# Rapha Guru v31 — Pitacos por liga, confiança e leitura principal/conservadora

## Entrou nesta versão
- filtro por **confiança** na aba **Pitacos do Rapha**
- novo **ranking por liga** no recorte atual
- destaque de **pitaco principal** por jogo
- destaque de **pitaco conservador** por jogo
- recorte atual agora mostra:
  - mercado filtrado
  - confiança filtrada
  - liga mais forte do recorte
- melhores pitacos do dia agora exibem também:
  - faixa de confiança
  - principal vs conservador
- cards de jogos encerrados mostram principal/conservador com status de acerto

## Arquivo principal alterado
- `client/src/components/RaphaPicksPanel.tsx`

## Validação feita
- `npx tsc --noEmit -p tsconfig.json` continua barrado apenas por falta das type definitions de `node` e `vite/client` neste ambiente
- não houve erro apontando o arquivo alterado nessa checagem
