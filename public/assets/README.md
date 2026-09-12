# Assets de runtime

- `levels/recife-one/background.png`: fundo jogável do Recife 1.
- `guardians/<id>/<variante>/`: arte dos cinco Guardiões recortada das tabelas de upgrade (abaixo). É o que o
  jogo usa: `idle`/`attack` no mapa, `projectile` como projétil (Camarão) ou como desenho da habilidade
  (raio, pulso, jato, giro), `impact` no ponto de acerto e `portrait` no card do Guardião selecionado.
- `guardians/pistol-shrimp/level-0..2`: arte antiga do Camarão, linear por nível. Não é mais carregada;
  fica só como referência e pode ser removida.
- `guardians/{tubarao,tartaruga,peixe_pedra,golfinho}/<variante>/`: os quatro novos Guardiões, com
  `idle`/`attack`/`ability`/`impact` (e `portrait`, o card inteiro) — ver "Novos guardiões" abaixo.
- `enemies/<inimigo>/frame-N.png`: quadros dos inimigos da prancha "Inimigos do Oceano" (abaixo).
  Ainda não são carregados pelo jogo.

O registro de chaves, caminhos, escala e estilo de habilidade de cada variante fica em
`src/game/assets/guardianArt.ts`. A variante visual é `base` até o primeiro upgrade e depois a do ramo e
nível escolhidos (ex.: `perfuracao-2`). As imagens de um mesmo Guardião preservam a célula da tabela, então
uma única escala por Guardião mantém a proporção entre variantes.

## Árvore de upgrades do Camarão-Pistola

Recortes da tabela `art/guardians/pistol-shrimp/upgrade-sheet.png`, gerados por `scripts/slice-upgrade-sheet.py`. Uma pasta por variante, seguindo a árvore de `GUARDIANS["pistol-shrimp"].branches`:

| Pasta | Nome na tabela | Ramo |
| --- | --- | --- |
| `guardians/pistol-shrimp/base` | Tiro de Bolha | base |
| `guardians/pistol-shrimp/perfuracao-1` | Garra Alongada | branches[0].upgrades[0] |
| `guardians/pistol-shrimp/perfuracao-2` | Canhão Abissal | branches[0].upgrades[1] |
| `guardians/pistol-shrimp/impacto-1` | Garra Robusta | branches[1].upgrades[0] |
| `guardians/pistol-shrimp/impacto-2` | Bum Absurdo | branches[1].upgrades[1] |

Cada pasta tem cinco PNGs com fundo transparente, recortados no bbox do sprite com 2px de margem:

- `portrait.png`: retrato grande da coluna esquerda, sem os textos.
- `idle.png`, `attack.png`: colunas 1 e 2.
- `projectile.png`: coluna 3 ("Habilidade").
- `impact.png`: coluna 4 ("Impacto").

O sprite vai até a linha interna da moldura da célula, e o que passa por cima da moldura na tabela
(antenas dos retratos, garras do Perfuração II e do Impacto II) é preservado. Onde a própria tabela
corta o desenho na moldura (patas embaixo, brilho dos impactos nas laterais), o corte vem de lá.
Em `impacto-2/impact.png` fica um buraco no formato do rótulo "4. IMPACTO", que na tabela está por
cima das pedras. O script imprime, para cada arquivo, em quais bordas o sprite encosta (T/B/L/R) e
aceita `SLICE_PREVIEW=<arquivo.png>` para gerar uma prancha de conferência.

## Árvores de upgrade dos outros guardiões

Recortes das tabelas `art/guardians/<guardiao>/upgrade-sheet.png`, gerados por
`scripts/slice-upgrade-cells.py`. Diferente do camarão, aqui cada PNG é o retângulo interno inteiro da
célula, só sem a moldura: nada foi reposicionado nem recortado no bbox, então todas as células de uma
coluna têm o mesmo tamanho e os sprites mantêm posição e proporção da prancha. Rótulos e tiras foram
limpos à mão depois do corte; os retratos mantêm o painel de texto da tabela e funcionam como card.

| Guardião | Pastas | Ramos na tabela |
| --- | --- | --- |
| `guardians/jellyfish` | `base`, `eletrico-1`, `eletrico-2`, `controle-1`, `controle-2` | Elétrico, Controle |
| `guardians/pufferfish` | `base`, `perfuracao-1`, `perfuracao-2`, `pulso-1`, `pulso-2` | Perfuração, Pulso |
| `guardians/ink-octopus` | `base`, `debuff-1`, `debuff-2`, `buff-1`, `buff-2` | Debuff, Buff |
| `guardians/reef-crab` | `base`, `quebra-casco-1`, `quebra-casco-2`, `area-1`, `area-2` | Quebra-Casco, Área |

Os nomes das pastas seguem a tabela, não `GUARDIANS[...].branches` (que chama os ramos de Fortaleza,
Tinta/Maré Aliada e Varredura). Cada pasta tem `portrait.png`, `idle.png`, `attack.png`,
`projectile.png` (coluna "Habilidade") e `impact.png`.

## Guardiões novos

Cada pasta de forma tem `idle.png`, `attack.png`, `ability.png`, `impact.png` e `portrait.png`. Se algum
arquivo faltar, o jogo cai no desenho vetorial provisório daquele Guardião. Cada pasta de Guardião tem um
`README.md` dizendo o que cada forma e cada arquivo representa.

| Guardião | Pasta | Formas |
| --- | --- | --- |
| Tubarão (`shark`) | `guardians/tubarao` | `base`, `frenesi_1`, `frenesi_2`, `alfa_1`, `alfa_2` |
| Tartaruga-Marinha (`sea-turtle`) | `guardians/tartaruga` | `base`, `casco_1`, `casco_2`, `corrente_1`, `corrente_2` |
| Peixe-Pedra (`stonefish`) | `guardians/peixe_pedra` | `base`, `veneno_1`, `veneno_2`, `emboscada_1`, `emboscada_2` |
| Golfinho (`dolphin`) | `guardians/golfinho` | `base`, `coro_1`, `coro_2`, `sonar_1`, `sonar_2` |

As formas não são frames de animação: a imagem só muda quando o jogador compra o upgrade. No Peixe-Pedra,
`idle.png` é o estado enterrado (só olhos e espinhos) e `attack.png` o emergido.

## Novos guardiões (moldura amarela neon)

Recortes das tabelas `art/guardians/<pasta>/upgrade-sheet.png` (Tubarão, Tartaruga, Peixe-Pedra e
Golfinho), gerados por `scripts/slice-neon-sheet.py`. Essas pranchas têm 5 painéis verticais com moldura
amarela (#FFF01F) e 4 divisórias horizontais; cada célula é recortada 1 px para dentro da linha amarela,
sem reposicionar nada, então as células de um mesmo painel têm a mesma largura e as de uma mesma linha a
mesma altura. Pastas e nomes de arquivo seguem `GUARDIAN_ART` em `src/game/assets/guardianArt.ts`:

| Pasta | Variantes | Arquivos |
| --- | --- | --- |
| `guardians/tubarao` | `base`, `frenesi_1`, `frenesi_2`, `alfa_1`, `alfa_2` | `portrait`, `idle`, `attack`, `ability`, `impact` |
| `guardians/tartaruga` | `base`, `casco_1`, `casco_2`, `corrente_1`, `corrente_2` | idem |
| `guardians/peixe_pedra` | `base`, `veneno_1`, `veneno_2`, `emboscada_1`, `emboscada_2` | idem |
| `guardians/golfinho` | `base`, `coro_1`, `coro_2`, `sonar_1`, `sonar_2` | idem |

`portrait.png` é o card inteiro da primeira linha (ícone, título e texto) e é carregado como card do
Guardião selecionado, igual aos outros cinco.

Quando um sprite passa por cima da linha amarela, a célula é recortada 1 px para FORA da moldura (a linha
fica na imagem) para não perder o desenho; o script lista essas células como `SOBREPOSTO`, e elas são
ajustadas à mão depois: `tartaruga/corrente_2/idle` (nadadeira embaixo), `tartaruga/casco_1/ability`
(cúpula em cima), `peixe_pedra/veneno_1/attack` e `peixe_pedra/emboscada_1/attack` (areia embaixo).

## Inimigos

Recortes de `art/enemies/enemies-sheet.png` ("Inimigos do Oceano"), gerados por
`scripts/slice-enemy-sheet.py`. Um por pasta, com os quadros da prancha da esquerda para a direita
(`frame-1.png`, `frame-2.png`, ...). Todos os quadros de um inimigo têm o mesmo tamanho (maior bbox do
grupo + 2 px de margem) e o sprite centralizado, então a troca de quadro não pula. Peças soltas que não
são o inimigo ficam em `extras.png` da pasta para ajuste manual.

| Pasta | Nome na prancha | Quadros |
| --- | --- | --- |
| `enemies/cardume-invasor` | Cardume Invasor | 4 |
| `enemies/caranguejo-eremita` | Caranguejo-Eremita Couraçado | 4 (o 4º é a concha fechada) |
| `enemies/agua-viva-fantasma` | Água-Viva Fantasma | 4 |
| `enemies/baiacu-corrompido` | Baiacu Corrompido | 4 (inflando) |
| `enemies/ladrao-do-recife` | Ladrão do Recife | 4 (o 4º é a nuvem de tinta) |
| `enemies/predador-corrompido` | Predador Corrompido | 3 |
| `enemies/carregador` | O Carregador | 4 |
| `enemies/moreia-das-correntes` | Moreia das Correntes | 3 |
| `enemies/raia-espinhosa` | Raia Espinhosa | 4 |
| `enemies/tartaruga-corrompida` | Tartaruga Corrompida | 3 |
| `enemies/lider-do-cardume` | Líder do Cardume | 2 (+ `extras.png` com os peixinhos do cardume) |
| `enemies/baleia-mare-negra` | Chefe: Baleia da Maré Negra | 1 (+ `extras.png` com o mergulhador de escala) |

Ainda não há registro desses inimigos no código (`src/game/data/enemies.ts` usa outros ids); as pastas
são só os assets.
