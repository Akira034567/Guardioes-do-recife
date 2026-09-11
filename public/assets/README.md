# Assets de runtime

- `levels/recife-one/background.png`: fundo jogável do Recife 1.
- `guardians/<id>/<variante>/`: arte dos cinco Guardiões recortada das tabelas de upgrade (abaixo). É o que o
  jogo usa: `idle`/`attack` no mapa, `projectile` como projétil (Camarão) ou como desenho da habilidade
  (raio, pulso, jato, giro), `impact` no ponto de acerto e `portrait` no card do Guardião selecionado.
- `guardians/pistol-shrimp/level-0..2`: arte antiga do Camarão, linear por nível. Não é mais carregada;
  fica só como referência e pode ser removida.

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
