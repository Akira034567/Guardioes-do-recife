# Relatório — rodada V3.2 (Peixe-Pedra emboscador, contenção de verdade e arte nova)

Continuação de [`relatorio-v3-1.md`](relatorio-v3-1.md). Planilha atualizada: `balanceamento.xlsx`.

**Testes unitários: 580 passando, 0 falhando** (inclui as 44 sondas de balanceamento).
**E2E: suíte completa rodada. 1 teste meu estava quebrado e foi reescrito — ver a seção 7.**

---

## 1. Peixe-Pedra — troca de identidade, não de números

O pedido era claro: ele deixou de ser armadilha descartável e virou **Emboscador da Corrente**. A
pergunta que ele faz ao jogador mudou de *"quando vale a pena gastar a armadilha?"* para *"onde
nessa rota os inimigos vão se agrupar?"*.

### O ciclo

| Fase | O que acontece | Duração |
|---|---|---|
| `settling` | Só na colocação: ele se acomoda e some no cenário. | 1,6s |
| `camouflaged` | Espera. Não gasta nada, não tem alvo, parece pedra. | indefinido |
| `arming` | Alguém entrou na zona: os espinhos abrem. É o aviso visual. | 0,42s |
| `striking` | O bote. | 0,45s |
| `cooldown` | Recolhe e recarrega. | 3s |

Depois disso volta para `camouflaged` — **nunca mais se enterra do zero**. Antes ele explodia uma
vez e ficava inútil num rearme longo, que produzia exatamente a sensação de "passaram por ele e ele
não fez nada".

**O bote é comprometido.** Depois que os espinhos começam a abrir, ele sai mesmo que o alvo escape.
É o que dá peso à leitura do jogador e o que separa uma emboscada de um tiro teleguiado.

### Onde ele fica

Modo de posicionamento novo (`ambush`): o toque **encaixa na borda da correnteza**, a 38 px da linha
central, virado para dentro — a zona invade a rota em vez de ficar em cima dela. O toque é aceito até
130 px da rota e recusado além disso.

### Os números

| | Zona | Bote | Veneno | Recarga | DPS 1 alvo |
|---|---|---|---|---|---|
| **Base** | 70 | 46 | 9/s por 4s | 3s | 27,3 |
| **A1 Toxina Viva** | 78 | 40 | 10/s por 5s | 3s | 30,0 |
| **A2 Jardim Abissal** | 86 | 40 | 10/s por 6s | 3s | 33,3 |
| **B1 Espinhos Cortantes** | 54 | 82 ✱ | 9/s por 4s | 3s | 39,3 |
| **B2 Caçador da Corrente** | 54 | 96 ✱ | 9/s por 4s | 3s | 44,0 |

✱ ignora armadura.

**Ramo A — Jardim Tóxico.** O bote deixa uma névoa no chão: raio 88 por 4s a 85% da velocidade
(A1), raio 108 por 5s a 80% (A2). No A2, quem **morre envenenado dentro da névoa** contamina os
vizinhos num raio de 72 — uma vez por morte, sem reação em cadeia (senão um cardume viraria bola de
neve).

**Ramo B — Predador de Emboscada.** Zona menor, bote que ignora armadura. No B2 ele **trava o alvo
mais forte** que entra na zona (vida máxima ≥ 150), carrega os espinhos em 0,24s em vez de 0,42s e
cobra pela vida máxima dela: **+10% dessa vida, teto +80**. O teto é o que impede a mecânica de virar
execução — contra o Quebra-Marés (469 de vida) o bônus para em +80, não em +47 a cada bote sem limite.

### Maestria

O nó 4 era "+3 p.p. no teto da carga". A carga não existe mais, então virou **Peçonha Densa**:
+4% na duração do veneno. Os capstones do nó 5 continuam **declarados e sem números**:

- **A2 Ecossistema Tóxico** — a primeira entrada de cada inimigo no Jardim leva uma dose extra e curta.
- **B2 Paciência Mortal** — cada segundo camuflado sem atacar soma dano ao próximo bote, até um teto.

### Na UI

Deixou de se chamar "Armadilha". O papel na carta é **Emboscada • Veneno**.

---

## 2. Contenção — a Tartaruga finalmente segura mais que o Baiacu

Era o pedido direto: *"a tartaruga deve conseguir segurar os oponentes por bem mais tempo do que o
baiacu"*. Antes os dois seguravam por tempos parecidos e a diferença entre eles era só a capacidade.

| | Capacidade | Segura por | Recarga por solto |
|---|---|---|---|
| **Baiacu** base | 1 | 3,5s | 1,5s |
| **Baiacu** Fortaleza I / II | 3 / 5 | 4,5s / 5,5s | 1,5s / 1,4s |
| **Tartaruga** base | 2 | **9s** | 2,2s |
| **Tartaruga** Casco I / II | 4 / 6 | **12s / 14s** | 2,2s / 2,0s |
| **Tartaruga** Correnteza I / II | 3 / 5 | **10s / 11s** | 2,4s |

A Tartaruga segura de 2,6× a 2,5× mais tempo que o Baiacu no mesmo nível. Agora dá para dizer a
diferença em uma frase: **ela SEGURA, ele BELISCA** — o Baiacu compensa com dano de contato por
segundo, que é onde ele ganha.

O Baiacu também passou a **dar dano de contato em quem só passa por ele**, não só em quem está
preso. Antes, com a lotação cheia, ele virava um obstáculo decorativo para o sexto inimigo da fila.

---

## 3. Apresentação

**Ícones de status sobre o corpo.** Os cinco efeitos (atordoado, lento, envenenado, vulnerável,
revelado) agora são desenhos, não anéis coloridos, e ficam **em cima do bicho**, não flutuando acima
da cabeça — é assim que o ícone diz "esta criatura está envenenada" em vez de "existe um ícone por
perto". No máximo três ao mesmo tempo: com cinco, a fileira fica mais larga que o inimigo e cobre os
vizinhos.

**Tartaruga Correnteza.** A arte de habilidade e impacto ficou **reservada ao pulso**. O golpe dela
sai a cada 1,5s e a onda que empurra a fila a cada 9s; com a mesma arte nos dois, o anel piscava o
tempo todo e o momento que importava sumia no meio.

**Golfinho.** As colunas de habilidade e impacto vieram invertidas na prancha original — trocadas em
todos os estágios.

**Peixinho Dourado.** O nado dele enquanto espera no canto caiu para 300 ms por quadro. A 180 ms
parecia agitado demais para um bicho que está lá só boiando. O redemoinho do fundo continua igual.

---

## 4. Arte nova do Peixe-Pedra

As 25 imagens saíram da prancha 5×5 que você mandou, cortadas por
[`scripts/slice-stonefish-sheet.py`](../scripts/slice-stonefish-sheet.py).

| Coluna do card | Pasta no jogo |
|---|---|
| BASE — *Emboscada Natural* | `base` |
| TOXINA VIVA — *Névoa Corrosiva* | `veneno_1` |
| JARDIM ABISSAL — *Propagação Tóxica* | `veneno_2` |
| ESPINHOS CORTANTES — *Investida Perfurante* | `emboscada_1` |
| CAÇADOR DA CORRENTE — *Presas Maiores* | `emboscada_2` |

Três decisões que o corte tomou:

1. **O `portrait` não sai da prancha, sai do card.** O retrato dos outros sete Guardiões é o painel
   inteiro — moldura, cabeçalho, bicho e os três bullets — e a Coleção põe os oito lado a lado. Um
   Peixe-Pedra recortado só no bicho destoaria da fileira. Saiu 199×245, contra 196×245 da Tartaruga.

2. **Uma escala só para as 25 peças.** As variantes precisam preservar o tamanho relativo entre si:
   é a base ser menor que o upgrade que faz o bicho "crescer" ao evoluir. Aparar e reescalar cada
   peça para um tamanho fixo destruiria isso.

3. **Paleta de 255 cores.** A arte dos Guardiões inteira é pré-carregada no boot. Em RGBA cheio a
   pasta ficava em 1,9 MB; com paleta caiu para **580 KB — menos que os 1,2 MB da arte que ela
   substitui**. A 2× de zoom não dá para distinguir as duas, e em campo a imagem ainda encolhe 28%.

**Nomes alinhados ao card.** O retrato agora mostra "TOXINA VIVA" na tela, então os upgrades passaram
a se chamar assim de verdade: *Esporos Venenosos → Toxina Viva*, *Jardim Tóxico → Jardim Abissal*,
*Espinhos Perfurantes → Espinhos Cortantes*, *Contra-Ataque Abissal → Caçador da Corrente*. Os nomes
dos dois ramos (Jardim Tóxico, Predador de Emboscada) não mudaram — e a colisão entre o ramo
"Jardim Tóxico" e o upgrade de mesmo nome deixou de existir.

---

## 5. Sondas de balanceamento (vidas restantes de 20)

Nenhum número de inimigo ou de onda mudou nesta rodada; as sondas servem para confirmar que a troca
do Peixe-Pedra não quebrou nada.

| Fase | Build de dano | Build de controle | Build de novatos |
|---|---|---|---|
| Recife 1 | 20 · 20 | 19 · 16 | 15 · 19 · 20 |
| Recife 2 | 17 | 10 | 20 · 20 |
| Recife 3 | 19 | 13 | — |
| Recife 4 | 9 | 20 | — |
| Recife 5 | 2 | 7 | — |
| Recife 6 | 11 | 19 | 15 |

Duas builds de novatos usam o Peixe-Pedra novo e as duas vencem: `recife-1 · tubarão frenesi +
peixe-pedra emboscada + camarão` (15/20) e `recife-1 · camarões + peixe-pedra veneno + golfinho
sonar` (19/20). Na fase 6, `camarões + tubarão alfa + tartaruga casco + peixe-pedra` fecha com 15/20.

**A sobra de pérolas continua.** Recife 5 dano termina com 1041 e Recife 6 dano com 1736 pérolas
sem gastar. É a mesma pendência da V3: as fases longas dão dinheiro demais para o que há para
comprar. Não mexi porque isso pede uma decisão sua sobre onde o dinheiro deve ser drenado.

---

## 6. Planilha

`docs/balanceamento.xlsx` foi atualizada nas abas **Guardiões (base)**, **Evoluções**, **Resumo
DPS**, **Maestria**, **Peixinho Dourado** e **Decisões pendentes**. Estavam todas descrevendo a
armadilha enterrada, que não existe mais.

O gerador dela saiu do rascunho e entrou no repositório:
[`scripts/planilha/gerar-planilha.cjs`](../scripts/planilha/gerar-planilha.cjs). Ele reproduz a
planilha commitada byte a byte. Aviso importante: **os números não saem de `balance.ts`
automaticamente** — a planilha é uma transcrição escrita à mão, com uma coluna de leitura em
português por linha. Quando o balanceamento muda, alguém tem que atualizar o gerador.

---

## 7. End-to-end

A suíte completa foi rodada. **Um teste estava quebrado e era meu**: `buries the stonefish on the
route and arms it after a few seconds` ainda testava a armadilha enterrada — ele clicava a 110 px da
rota esperando recusa, e com o posicionamento novo (`ambushReach` 130) aquilo virou uma colocação
válida. Eu tinha rodado só o Vitest quando entreguei a V3.2, então a suíte e2e nunca viu a mudança.

Reescrito como `snaps the stonefish to the edge of the current and cycles the ambush`: recusa a 170
px da rota, aceita perto da borda, e acompanha o ciclo `settling → camouflaged → arming/striking →
camouflaged` com a primeira onda passando por cima dele.

---

## 8. O que continua em aberto

| Pendência | Situação |
|---|---|
| Sobra de pérolas nas fases longas | 700 a 1700 sem gastar em Recife 4–6. Precisa de decisão sua. |
| Amplificação da corrente da Baleia | ×2,2 de força e ×1,8 de deriva, nunca jogados à mão. |
| Efeitos numéricos do nó 5 da maestria | Declarados nos nove Guardiões, sem números. |
| Faixa de poder da maestria | 13–16% nominal contra a meta de 10–15% efetivo. |
| Calibrar o ciclo do Peixe-Pedra | Passou na simulação, nunca foi jogado à mão. Ver se 3s de recarga não o deixa forte demais em rota estreita, e se a zona de 54 do ramo B não é pequena demais para acertar alguém. |
| Números da coroa nas outras abas | A aba Peixinho Dourado ainda descreve as coroas dos outros oito Guardiões em texto, mas `goldenFish.ts` já tem multiplicadores concretos para todos. Só a linha do Peixe-Pedra foi atualizada com números. |
