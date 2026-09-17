# Arte-fonte

Arquivos de referência e pranchas que não são carregados pelo jogo ficam aqui. Os assets usados em runtime ficam em `public/assets`.

## Guardiões

- `guardians/pistol-shrimp/reference-sheet.png`: prancha original do Camarão-Pistola.
- `guardians/<guardiao>/upgrade-sheet.png`: tabela de upgrade 5x5 de cada Guardião. As dos cinco primeiros
  têm moldura ciano e são cortadas por `scripts/slice-upgrade-sheet.py` / `slice-upgrade-cells.py`; as dos
  quatro novos (`tubarao`, `tartaruga`, `peixe_pedra`, `golfinho`) têm moldura amarela neon e são cortadas
  por `scripts/slice-neon-sheet.py`.

- `guardians/golfinho/coro_2-canto-sheet.png`: prancha 5x2 da animação de canto do Coro II, cortada por
  `scripts/slice-dolphin-chorus-sheet.py` nos quadros `coro_2/attack-1..10.png`.
- `guardians/tartaruga/corrente_2-onda.png`: a onda da Correnteza II, entregue em fundo branco;
  `scripts/prepare-turtle-wave.py` recorta o fundo e grava `corrente_2/ability.png`.

## Inimigos

- `enemies/enemies-sheet.png`: prancha "Inimigos do Oceano", cortada por `scripts/slice-enemy-sheet.py`.

Ao adicionar outro Guardião, use uma pasta com o `GuardianId` em inglês e kebab-case, preservando as pranchas originais nesta área.
