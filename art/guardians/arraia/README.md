# Arte-fonte: arraia

Arraia-Manta — Asa do Canal (`manta-ray`). **A arte ainda não chegou**: o jogo desenha este Guardião em vetor (`GuardianView.drawBody`) e as
pastas de runtime em `public/assets/guardians/arraia/` estão só com `.gitkeep`.

## O que entregar

`upgrade-sheet.png`: prancha 5x5 com **moldura amarela neon** (como a do Golfinho), uma linha por forma e as
colunas **retrato · parado · ataque · habilidade · impacto**, fundo transparente, criatura virada para a
**direita**.

Formas (linhas, nesta ordem): base, planar_1, planar_2, arrasto_1, arrasto_2.

Visual: Arraia-manta vista de cima, asas largas azul-escuras com a barriga clara nas pontas. Planar: bordas das asas ciano, rastro de bolhas. Arrasto: onda azul forte saindo das asas.

Coluna Habilidade: a faixa do voo rasante (um feixe horizontal) para a coluna Habilidade.

## Como encaixar

1. Salve a prancha aqui como `upgrade-sheet.png`.
2. Acrescente `"arraia"` em `SHEETS` de `scripts/slice-neon-sheet.py` e rode o script.
3. Em `src/game/assets/guardianArt.ts`, apague a linha `pending: true` do perfil deste Guardião.
4. `npm test` confere que todos os arquivos existem (`tests/guardian-art.test.ts`).
