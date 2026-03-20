# Football Tips Pro — Ideias de Design

## Contexto
Sistema de análise de probabilidades para apostas esportivas de futebol. O usuário escolhe um jogo do dia e recebe análises detalhadas de probabilidades de gols, escanteios, cartões, resultado, etc.

---

<response>
<probability>0.08</probability>
<text>

## Ideia 1: "Terminal Verde" — Estética Hacker/Data Terminal

**Design Movement:** Cyberpunk Data Terminal + Sports Analytics Dashboard

**Core Principles:**
- Interface que parece um terminal de análise profissional de dados esportivos
- Dados apresentados como se fossem outputs de algoritmos em tempo real
- Contraste extremo entre fundo escuro e elementos neon verde/amarelo
- Sensação de "sistema exclusivo" e "informação privilegiada"

**Color Philosophy:**
- Background: `#0a0f0a` (quase preto com toque de verde)
- Primary: `#00ff41` (verde matrix/terminal)
- Accent: `#ffcc00` (amarelo neon para alertas e destaques)
- Muted: `#1a2a1a` (verde escuro para cards)
- Text: `#c8ffc8` (verde claro suave para leitura)
- Danger: `#ff4141` (vermelho para probabilidades baixas)

**Layout Paradigm:**
- Layout assimétrico com sidebar esquerda de ligas/jogos
- Área central com "terminal" de análise
- Dados aparecem com animação de "digitação" progressiva
- Grid de métricas com bordas neon

**Signature Elements:**
- Bordas com efeito "scanline" animado
- Barras de progresso com estilo de loading terminal
- Texto com efeito de "glitch" sutil em títulos

**Interaction Philosophy:**
- Hover revela dados adicionais com fade-in verde
- Clique em jogo "carrega" análise com animação de terminal
- Transições rápidas e precisas como respostas de sistema

**Animation:**
- Entrada de dados com efeito typewriter
- Barras de probabilidade preenchem da esquerda para direita
- Pulse suave em elementos "ao vivo"

**Typography System:**
- Display: `JetBrains Mono` (monospace para títulos)
- Body: `IBM Plex Mono` (monospace para dados)
- Hierarquia: peso e tamanho, não família diferente

</text>
</response>

<response>
<probability>0.07</probability>
<text>

## Ideia 2: "Estádio Noturno" — Premium Sports Dark

**Design Movement:** Premium Sports Media + Editorial Dark

**Core Principles:**
- Elegância de um jornal esportivo premium em modo escuro
- Dados apresentados com clareza jornalística e hierarquia editorial
- Sensação de confiança e autoridade analítica
- Contraste entre tipografia serifada elegante e dados sans-serif precisos

**Color Philosophy:**
- Background: `#0d1117` (azul-escuro quase preto, como céu noturno de estádio)
- Surface: `#161b22` (cards e painéis)
- Primary: `#e8a020` (dourado âmbar — cor de troféu/vitória)
- Secondary: `#1f6feb` (azul elétrico para ações)
- Success: `#3fb950` (verde para probabilidades altas)
- Danger: `#f85149` (vermelho para riscos)
- Text: `#e6edf3` (branco suave)

**Layout Paradigm:**
- Header com campo de futebol estilizado como hero
- Lista de jogos em coluna esquerda (sidebar)
- Painel de análise ocupa 2/3 da tela
- Métricas em grid de cards com ícones

**Signature Elements:**
- Gradiente sutil de azul escuro para preto no background
- Cards com borda esquerda colorida indicando nível de confiança
- Ícones de futebol (bola, cartão, escanteio) como indicadores visuais

**Interaction Philosophy:**
- Seleção de jogo com highlight suave
- Análise expande com slide-down animado
- Tooltips explicativos em cada métrica

**Animation:**
- Fade-in suave para novos dados
- Barras de probabilidade com spring animation
- Cards entram com stagger animation

**Typography System:**
- Display: `Playfair Display` (serifada para títulos de jogos)
- Body: `Inter` (sans-serif para dados e métricas)
- Mono: `Fira Code` (para valores numéricos precisos)

</text>
</response>

<response>
<probability>0.06</probability>
<text>

## Ideia 3: "Grama Verde" — Sporty & Bold

**Design Movement:** Sports Broadcast Graphics + Bold Editorial

**Core Principles:**
- Visual agressivo e dinâmico como gráficos de transmissão esportiva
- Cores saturadas e contrastantes que comunicam energia
- Layout assimétrico com elementos que "quebram a grade"
- Dados como protagonistas visuais, não apenas texto

**Color Philosophy:**
- Background: `#f5f5f0` (off-white levemente amarelado)
- Primary: `#1a472a` (verde escuro de campo de futebol)
- Accent: `#e8f5e9` (verde claro para superfícies)
- Bold: `#c62828` (vermelho intenso para alertas)
- Gold: `#f9a825` (âmbar para destaques)
- Text: `#1a1a1a` (quase preto)

**Layout Paradigm:**
- Header com campo de futebol SVG animado
- Cards de jogos em layout horizontal scrollável
- Análise em painel principal com tabs
- Métricas em blocos grandes e ousados

**Signature Elements:**
- Faixas diagonais de cor como elementos decorativos
- Números de probabilidade em tipografia display gigante
- Indicadores de "tip" com badges coloridos

**Interaction Philosophy:**
- Seleção de jogo com animação de "zoom in"
- Scroll horizontal para navegar jogos
- Probabilidades animam de 0% ao valor real

**Animation:**
- Counter animation para percentuais
- Slide-in lateral para painéis de análise
- Pulse em jogos ao vivo

**Typography System:**
- Display: `Bebas Neue` (condensada bold para números e títulos)
- Body: `Barlow` (semi-condensada para texto)
- Accent: `Barlow Condensed` (para labels e badges)

</text>
</response>

---

## Design Escolhido: Ideia 2 — "Estádio Noturno"

**Justificativa:** Combina credibilidade analítica com apelo visual premium. O tema escuro reduz fadiga visual durante análises longas, e a paleta dourada/azul transmite autoridade sem ser intimidante. A tipografia mista (serifada + sans) cria hierarquia clara entre contexto narrativo e dados precisos.
