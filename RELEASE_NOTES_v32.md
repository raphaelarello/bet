# RELEASE NOTES v32

## Correções centrais
- Correção do motor de escanteios pré-jogo para evitar inflação de projeções.
- Ajuste da projeção ao vivo de escanteios com amortecimento forte no início do jogo.
- Rebalanceamento dos pitacos de escanteios para não forçar linhas altas em massa.

## Pitacos do Rapha
- Filtro por liga.
- Ranking por horário.
- Selo de risco por pitaco (baixo, médio, alto).

## Arquivos principais alterados
- client/src/lib/footballApi.ts
- client/src/lib/liveProjection.ts
- client/src/components/RaphaPicksPanel.tsx
