# Arte-fonte

Arquivos de referência e pranchas que não são carregados pelo jogo ficam aqui. Os assets usados em runtime ficam em `public/assets`.

## Guardiões

- `guardians/pistol-shrimp/reference-sheet.png`: prancha original do Camarão-Pistola.
- `guardians/<guardiao>/upgrade-sheet.png`: tabela de upgrade 5x5 de cada Guardião. As dos cinco primeiros
  têm moldura ciano e são cortadas por `scripts/slice-upgrade-sheet.py` / `slice-upgrade-cells.py`; as dos
  quatro novos (`tubarao`, `tartaruga`, `peixe_pedra`, `golfinho`) têm moldura amarela neon e são cortadas
  por `scripts/slice-neon-sheet.py`.

## Inimigos

- `enemies/enemies-sheet.png`: prancha "Inimigos do Oceano", cortada por `scripts/slice-enemy-sheet.py`.

Ao adicionar outro Guardião, use uma pasta com o `GuardianId` em inglês e kebab-case, preservando as pranchas originais nesta área.
