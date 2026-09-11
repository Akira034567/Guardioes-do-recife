# Assets de runtime

- `levels/recife-one/background.png`: fundo jogável do Recife 1.
- `guardians/pistol-shrimp/level-0`: aparência base do Camarão (em uso pelo código).
- `guardians/pistol-shrimp/level-1`: aparência depois do primeiro upgrade (em uso pelo código).
- `guardians/pistol-shrimp/level-2`: aparência depois do segundo upgrade (em uso pelo código).

Cada nível possui exatamente uma imagem `idle`, uma imagem `attack` e uma imagem `projectile`. O movimento passivo é feito por transformação, sem alternar imagens de níveis diferentes.

As chaves, caminhos e animações são registrados em `src/game/assets/recifeOneAssets.ts`.

## Árvore de upgrades do Camarão-Pistola (ainda não plugada no código)

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

## Árvores de upgrade dos outros guardiões (corte bruto, ainda não plugadas no código)

Recortes das tabelas `art/guardians/<guardiao>/upgrade-sheet.png`, gerados por
`scripts/slice-upgrade-cells.py`. Diferente do camarão, aqui cada PNG é o retângulo interno inteiro da
célula, só sem a moldura: nada foi reposicionado nem recortado no bbox, então todas as células de uma
coluna têm o mesmo tamanho e os sprites mantêm posição e proporção da prancha. Rótulos ("1. IDLE"),
tiras azul-marinho e textos dos retratos ficam nos arquivos para ajuste manual.

| Guardião | Pastas | Ramos na tabela |
| --- | --- | --- |
| `guardians/jellyfish` | `base`, `eletrico-1`, `eletrico-2`, `controle-1`, `controle-2` | Elétrico, Controle |
| `guardians/pufferfish` | `base`, `perfuracao-1`, `perfuracao-2`, `pulso-1`, `pulso-2` | Perfuração, Pulso |
| `guardians/ink-octopus` | `base`, `debuff-1`, `debuff-2`, `buff-1`, `buff-2` | Debuff, Buff |
| `guardians/reef-crab` | `base`, `quebra-casco-1`, `quebra-casco-2`, `area-1`, `area-2` | Quebra-Casco, Área |

Os nomes das pastas seguem a tabela, não `GUARDIANS[...].branches` (que chama os ramos de Fortaleza,
Tinta/Maré Aliada e Varredura). Cada pasta tem `portrait.png`, `idle.png`, `attack.png`,
`projectile.png` (coluna "Habilidade") e `impact.png`.
