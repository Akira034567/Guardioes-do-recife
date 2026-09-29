# Arte-fonte: peixe_lanterna

Peixe-Lanterna — Farol das Profundezas (`lanternfish`). **A arte ainda não chegou**: o jogo desenha este Guardião em vetor (`GuardianView.drawBody`) e as
pastas de runtime em `public/assets/guardians/peixe_lanterna/` estão só com `.gitkeep`.

## O que entregar

`upgrade-sheet.png`: prancha 5x5 com **moldura amarela neon** (como a do Golfinho), uma linha por forma e as
colunas **retrato · parado · ataque · habilidade · impacto**, fundo transparente, criatura virada para a
**direita**.

Formas (linhas, nesta ordem): base, isca_1, isca_2, farol_1, farol_2.

Visual: Peixe-lanterna das profundezas, corpo azul-escuro, boca com dentinhos e a isca acesa (amarela) na ponta da antena. Isca: luz amarela pulsante mais forte. Farol: luz ciano larga, quase um farol.

Coluna Habilidade: a luz saindo da isca (anel/halo) para a coluna Habilidade.

## Como encaixar

1. Salve a prancha aqui como `upgrade-sheet.png`.
2. Acrescente `"peixe_lanterna"` em `SHEETS` de `scripts/slice-neon-sheet.py` e rode o script.
3. Em `src/game/assets/guardianArt.ts`, apague a linha `pending: true` do perfil deste Guardião.
4. `npm test` confere que todos os arquivos existem (`tests/guardian-art.test.ts`).
