# Fundos das fases dos Canais Profundos

As dez fases dos Canais (`canais-1` … `canais-10`) ainda usam o fundo **procedural** (`LevelBackdrop.ts`).
Cada pasta aqui tem um `guia.png` de **1280×634** com a posição exata de tudo que o jogo usa:

- as rotas (a faixa cinza é a largura da areia, 118 px; a linha colorida é o centro de cada canal);
- os canteiros de pedra (elipses brancas, onde os Guardiões de plataforma ficam);
- as zonas de corrente (retângulos verdes), as comportas e as portas de pedra (amarelo) e os redemoinhos (azul).

Regra de coordenada: **y_jogo = y_imagem + 21** (o fundo começa 21 px abaixo do topo, sob o HUD).

## Como encaixar um fundo pintado

1. Pinte por cima do `guia.png` respeitando rotas, pedras e redemoinhos, e salve como
   `public/assets/levels/canais-N/background.png` (1280×634).
2. Em `src/game/assets/levelBackgrounds.ts`, acrescente a chave em `LEVEL_BACKGROUND_KEYS` e o caminho em
   `LEVEL_BACKGROUND_ASSETS`, como as do Recife Costeiro.
3. No arquivo da fase (`src/game/data/levels/canais/canaisN.ts`), acrescente `backgroundKey`.
