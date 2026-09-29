# Arte-fonte: ostra

Ostra — Tesoureira do Canal (`oyster`). **A arte ainda não chegou**: o jogo desenha este Guardião em vetor (`GuardianView.drawBody`) e as
pastas de runtime em `public/assets/guardians/ostra/` estão só com `.gitkeep`.

## O que entregar

`upgrade-sheet.png`: prancha 5x5 com **moldura amarela neon** (como a do Golfinho), uma linha por forma e as
colunas **retrato · parado · ataque · habilidade · impacto**, fundo transparente, criatura virada para a
**direita**.

Formas (linhas, nesta ordem): base, banco_1, banco_2, madreperola_1, madreperola_2.

Visual: Concha grande de ostra, rosada/nacarada, com uma pérola brilhando dentro. Banco: pérola dourada, concha com detalhes de ouro. Madrepérola: pérola violeta (nível 1) e pérola negra com brilho (nível 2).

Coluna Habilidade: tiro de pérola (projétil pequeno e redondo).

## Como encaixar

1. Salve a prancha aqui como `upgrade-sheet.png`.
2. Acrescente `"ostra"` em `SHEETS` de `scripts/slice-neon-sheet.py` e rode o script.
3. Em `src/game/assets/guardianArt.ts`, apague a linha `pending: true` do perfil deste Guardião.
4. `npm test` confere que todos os arquivos existem (`tests/guardian-art.test.ts`).
