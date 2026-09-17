# Arte-fonte

Arquivos de referência e pranchas que não são carregados pelo jogo ficam aqui. Os assets usados em runtime ficam em `public/assets`.

## Guardiões

- `guardians/pistol-shrimp/reference-sheet.png`: prancha original do Camarão-Pistola.
- `guardians/<guardiao>/upgrade-sheet.png`: tabela de upgrade 5x5 de cada Guardião. As dos cinco primeiros
  têm moldura ciano e são cortadas por `scripts/slice-upgrade-sheet.py` / `slice-upgrade-cells.py`; as dos
  quatro novos (`tubarao`, `tartaruga`, `peixe_pedra`, `golfinho`) têm moldura amarela neon e são cortadas
  por `scripts/slice-neon-sheet.py`.

- `guardians/golfinho/coro_2-canto/frame-01..10.png`: os dez quadros da animação de canto do Coro II,
  na ordem da animação, encaixados por `scripts/fit-dolphin-chorus-frames.py` em `coro_2/attack-1..10.png`.
  Substituem `coro_2-canto-sheet.png`, a prancha 5x2 da mesma animação: cortada na grade
  (`scripts/slice-dolphin-chorus-sheet.py`), ela trazia pedaços da célula vizinha na borda de cada quadro.
- `guardians/tartaruga/corrente_2-onda.png`: a onda da Correnteza II, entregue em fundo branco;
  `scripts/prepare-turtle-wave.py` recorta o fundo e grava `corrente_2/ability.png`.

## Inimigos

- `enemies/enemies-sheet.png`: prancha "Inimigos do Oceano", cortada por `scripts/slice-enemy-sheet.py`.

Ao adicionar outro Guardião, use uma pasta com o `GuardianId` em inglês e kebab-case, preservando as pranchas originais nesta área.
