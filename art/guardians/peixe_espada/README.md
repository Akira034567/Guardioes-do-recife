# Arte-fonte: peixe_espada

Peixe-Espada — Lâmina do Canal (`swordfish`). **A arte ainda não chegou**: o jogo desenha este Guardião em vetor (`GuardianView.drawBody`) e as
pastas de runtime em `public/assets/guardians/peixe_espada/` estão só com `.gitkeep`.

## O que entregar

`upgrade-sheet.png`: prancha 5x5 com **moldura amarela neon** (como a do Golfinho), uma linha por forma e as
colunas **retrato · parado · ataque · habilidade · impacto**, fundo transparente, criatura virada para a
**direita**.

Formas (linhas, nesta ordem): base, estocada_1, estocada_2, esgrima_1, esgrima_2.

Visual: Peixe-espada prateado-azulado com vela dorsal alta e a espada longa à frente. Estocada: espada alaranjada, mais longa no nível 2. Esgrima: espada rosa/vermelha com brilho de duelo.

Coluna Habilidade: o risco de luz da estocada (feixe fino e longo) para a coluna Habilidade.

## Como encaixar

1. Salve a prancha aqui como `upgrade-sheet.png`.
2. Acrescente `"peixe_espada"` em `SHEETS` de `scripts/slice-neon-sheet.py` e rode o script.
3. Em `src/game/assets/guardianArt.ts`, apague a linha `pending: true` do perfil deste Guardião.
4. `npm test` confere que todos os arquivos existem (`tests/guardian-art.test.ts`).
