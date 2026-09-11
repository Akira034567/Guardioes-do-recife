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
