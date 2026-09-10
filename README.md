# Guardiões do Recife

Vertical slice de um tower defense 2D subaquático, construído com TypeScript, Phaser e Vite.

## Requisitos

- Node.js 24 LTS
- npm 11+

## Comandos

```bash
npm install
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Abra `http://localhost:5173`. O jogo usa mouse e touch em layout horizontal 16:9.

## Posicionamento e upgrades

- Camarão-Pistola: selecione a carta e depois uma das quatro plataformas de concha.
- Água-viva: selecione a carta e escolha uma área livre da água; a prévia verde ou vermelha valida a posição.
- Baiacu: selecione a carta e escolha um dos quatro pontos marcados diretamente na rota.
- Toque em qualquer Guardião já colocado para comprar seus dois upgrades em ordem.
- Clique numa área vazia do mapa para limpar a seleção e esconder o alcance.
- Durante a preparação, pressione `Espaço` ou use o botão **PULAR** para iniciar a onda imediatamente.

## Debug

- `F2`: abre ou fecha o modo debug.
- `?debug=1`: inicia com debug e disponibiliza o botão para dispositivos touch.
- O painel permite alternar rota, alcance, hitboxes, corrente, estados, alvos e áreas de posicionamento separadamente.

## Organização

- `src/game/data`: definições data-driven de Guardiões, inimigos, ondas e Recife 1.
- `src/game/core`: simulação pura e testável de rota, corrente, economia, ondas e estados.
- `src/game/objects`: representações Phaser substituíveis pelos sprites finais.
- `src/game/scenes`: carregamento, gameplay e HUD.
- `src/game/systems`: áudio provisório e overlay de debug.
