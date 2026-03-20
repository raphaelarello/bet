# Rapha Guru v28 — Correção real da Home e filtros operacionais

## O que foi corrigido
- inclusão de filtro funcional de lista por visão:
  - Todos
  - Ao vivo
  - Próximos
  - Encerrados
- botão **Ao vivo** agora mostra apenas partidas em andamento
- botão **Próximos** agora mostra partidas que começam em breve (ou partidas futuras na data selecionada)
- nova divisão da home por:
  - Todos
  - Favoritos
  - Competições
- remoção do bloco redundante de métricas no topo e troca por painel operacional da rodada
- melhoria visual dos botões principais da lista
- melhoria visual dos cabeçalhos por competição
- melhoria do card de jogo para sinalizar **EM BREVE**
- card lateral da lista agora explica claramente o filtro ativo

## Arquivos alterados
- client/src/pages/Home.tsx
- client/src/components/MatchCard.tsx

## Validação realizada neste ambiente
- checagem de parsing/transpile TypeScript em:
  - client/src/pages/Home.tsx
  - client/src/components/MatchCard.tsx

## Limitação
- não foi possível rodar build completo do projeto neste ambiente porque as dependências do projeto não estão instaladas localmente.
