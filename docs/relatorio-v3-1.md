# Relatório — rodada V3.1 (bloqueio, Peixe-Pedra, Peixinho Dourado e usabilidade)

Continuação de [`relatorio-v3.md`](relatorio-v3.md). Planilha atualizada: `balanceamento.xlsx`.

**Testes unitários: 577 passando, 0 falhando** (inclui as 44 sondas de balanceamento).
**E2E: rodados e corrigidos** — ver a seção 9.

---

## 1. Decisões que você fechou nesta rodada

| Pendência | Decisão |
|---|---|
| Água-viva Fantasma contra builds sem resposta | **Fica como está.** Forçar o jogador a trazer bloqueador ou Golfinho virou regra de design, não bug. |
| Peixe-Pedra: leitura do gatilho | **Descartada a janela de 0,5s.** Nova regra: sai pouco antes de o primeiro escapar do raio. |

Continuam em aberto: sobra de pérolas nas fases longas, amplificação da corrente da Baleia,
efeitos do nó 5 da maestria e a faixa de poder da maestria.

---

## 2. Bloqueio

### Baiacu — capacidade igual, agarrão com prazo

Capacidade segue **1 / 3 / 5**. O que mudou é que segurar virou um ciclo, não um estado:

| Nível | Segura | Por quanto tempo | Recarga por inimigo solto |
|---|---|---|---|
| Base | 1 | 3,5s | 1,5s |
| Fortaleza I | 3 | 4,5s | 1,5s |
| Fortaleza II | 5 | 5,5s | 1,4s |

Antes, um Baiacu bem posto prendia a fila até o fim da onda e o jogador não precisava mais pensar
naquela rota.

### Tartaruga — bloqueia desde a base, e os dois ramos seguram

| | Sem ramo | Nível 1 | Nível 2 |
|---|---|---|---|
| **Casco** | 2 (3s) | 4 (4s) | 6 (5s) |
| **Correnteza** | 2 (3s) | 3 (3s) | 5 (3,5s) |

E a mudança que separa de vez os dois ramos: **a turbulência saiu do Casco**. Antes os dois ramos
mexiam na água, o que apagava a escolha — agora quem quer alterar a correnteza escolhe a Correnteza.
Há teste travando isso nos dois sentidos.

---

## 3. Peixe-Pedra

O gatilho antigo era uma aposta que costumava sair errada: ou ele segurava esperando companhia que
não vinha, ou detonava com um alvo só.

**Nova regra:** não dispara no primeiro contato. Espera o grupo se formar e sai quando o inimigo mais
avançado chega a **53 px depois dela** — faltando 12 px para escapar do raio de 65. É o instante em
que há mais gente dentro. Se a fila não anda (um bloqueador segurando todo mundo em cima dela),
`maxHoldMs` de 2s dispara assim mesmo.

**Recarga: 5s → 2,5s.** Uma armadilha que mira o momento certo precisa ter mais momentos.

A medida é feita ao longo da ROTA, não em linha reta, justamente para não confundir "acabou de
entrar" com "está saindo" — quem entrou também está longe do centro, mas do lado de antes.

---

## 4. Onde cada Guardião pode ficar

Um Guardião passou a poder aceitar mais de um lugar (`altPlacementModes`):

- **Polvo-Tinteiro**: plataforma **ou** água livre.
- **Golfinho**: água livre **ou** margem da correnteza, como o Tubarão.

O guia de posicionamento acende todos os lugares aceitos ao mesmo tempo, e a dica da carta lista os
dois ("toque em uma plataforma de pedra ou uma área livre da água").

---

## 5. Peixinho Dourado

### Deixou de ser um clique

Era um bug de desenho: depois dos 60% da fase, o primeiro toque em qualquer Guardião já gastava o
Peixinho, sem o jogador perceber que tinha acabado de tomar a decisão irreversível da partida.

Agora ele **aparece nadando no canto inferior direito** e o jogador **arrasta** até quem quer coroar.
Soltar em cima de um Guardião coroa (com o peixinho sumindo dentro dele e a coroação de 1s tocando);
soltar no vazio traz ele de volta nadando para o canto. O raio de acerto é generoso — a coroa é para
o Guardião que a pessoa mirou, não para o pixel exato.

### E agora ele faz alguma coisa

Na V3 a coroa não dava **nenhum** efeito numérico — era só a estrutura, como combinado. Agora
`GOLDEN_BOOSTS` traz um pacote por Guardião **e por ramo**, somando **20% a 55% nominais** no eixo que
é a função daquela unidade. Exemplos:

| Guardião | Sem ramo | Ramo A | Ramo B |
|---|---|---|---|
| Camarão | +25% dano, +10% cadência | +16/16% dano e cadência, +20% projétil | +28% dano, +10% alcance |
| Baiacu | +30% contato, +15% duração | +30% contato, **+1 vaga**, +15% duração | +25% dano, −18% recarga |
| Tartaruga | +25% controle, **+1 vaga** | +20% controle, **+2 vagas** | +20% zona, +25% repulsa |
| Golfinho | +20% alcance e duração | +20% alcance, −22% recarga | +25% duração, −20% recarga |

Entram pelo **mesmo canal da maestria** (`combineBonus`): as duas fontes somam cada uma a sua parte,
nenhuma sobrescreve a outra. Há teste garantindo que a coroa vale só para a unidade coroada.

🔶 Primeira passada de calibração — a faixa alvo de 20–30% de ganho *efetivo* ainda precisa de
confirmação em partida.

---

## 6. Apresentação

**Pulso do sonar.** Viajava em 520 ms e estourava antes de dar para entender que algo tinha saído do
Golfinho. Agora leva **1150 ms**, com uma segunda crista logo atrás para dar espessura à frente de
onda, e o alfa caindo devagar no começo e rápido no fim — o que faz ler como "a onda passou" em vez
de "o círculo sumiu".

**Empurrão mais fluido.** Os inimigos empurrados teleportavam: sumiam e reapareciam 170 px atrás. O
motor *precisa* que o movimento seja instantâneo (senão a posição de jogo e a desenhada discordariam),
então o que mudou foi só o desenho — a diferença vira um deslocamento visual que decai a zero em
~110 ms. O estado de jogo já está no destino; a criatura chega lá deslizando. A frente da repulsa
acompanha, acelerando para fora em vez de frear no meio do gesto.

---

## 7. Controles e telas

**Teclado 1–5.** Cada tecla escolhe a carta da vaga correspondente, com o número visível no canto da
carta. Ignora enquanto o jogador está digitando num campo de texto — senão escrever "guardiao1" na
tela de conta viraria uma compra.

**Celular.** Três correções estruturais:

1. `@media (pointer: coarse)` leva todo controle a **44 px** de alvo mínimo — botões, itens do menu,
   e principalmente o nó do mapa, que é redondo e fica no meio da arte.
2. Recorte de tela (notch, ilha, cantos redondos) tratado com `env(safe-area-inset-*)`.
3. Canvas baixo (celular deitado): o menu lateral vira uma fileira de ícones em cima e o miolo passa a
   rolar. Para isso as telas de menu trocaram `container-type: inline-size` por `size` — sem isso a
   consulta de ALTURA simplesmente não responde.

**Encontros mais legíveis no mapa.** O satélite de 36 px não dizia nem que havia um Guardião ali, nem
qual fase era. Agora tem etiqueta embaixo ("NOVO GUARDIÃO" + nome da fase; o nome do Guardião depois
de concluído; "?" quando trancado) e o nó **pulsa** quando acabou de abrir — respeitando
`prefers-reduced-motion`.

**Convite depois da fase.** Terminar a fase é o momento em que o jogador está olhando a tela: se
aquela fase abriu um Encontro que ele ainda não fez, a vitória agora mostra um convite com a arte do
Guardião preso e um botão **IR RESGATAR** que leva direto à preparação daquele Encontro. Antes ele
precisava voltar ao mapa e reparar sozinho no satélite.

---

## 8. Sondas de balanceamento (vidas restantes de 20)

| Fase | Vidas restantes, por build |
|---|---|
| recife-1 | 19 · 17 · 18 · 20 · 20 · 20 · 17 · 16 |
| recife-2 | 20 · 20 · 17 · 8 |
| recife-3 | 19 · 13 |
| recife-4 | 9 · 20 |
| recife-5 | **2** · 7 |
| recife-6 | 11 · 19 · 20 |

Todos os 21 builds vencem. O build cru de referência ("duas unidades cruas"), que existe só para
provar que o jogo não é fácil demais, termina com 3 de 20.

Comparado com a V3: a fase 2 apertou (10 → 8 no pior build), porque o Baiacu não segura mais a fila
inteira até o fim da onda. A fase 6 afrouxou no build "novatos" (8 → 20), porque a Tartaruga passou a
bloquear desde a base e nos dois ramos — é o efeito colateral esperado de transformar uma unidade de
zona numa unidade que também contém.

O build de dano puro da fase 5 segue nas 2 vidas, pelo motivo já conhecido e agora aceito: sem
bloqueador e sem Golfinho, a Água-viva Fantasma passa direto.


---

## 9. End-to-end: o que a suíte pegou

Rodei `npx playwright test --grep-invert @balance --workers=1` (102 testes, ~13 min). Na primeira
passada, **12 falharam**. Separando o que era meu do que já estava quebrado:

### Já estavam quebrados antes desta rodada (3)

Expectativas de pérolas desatualizadas: `game.spec.ts` esperava 340 de abertura no recife-5 (o valor
real é 360 há muito tempo) e 220 no recife-2 (real: 200), e `campaign.spec.ts` repetia o 220. Nunca
mexi em `startingPearls` — confirmei por `git diff` no intervalo inteiro dos meus commits. Os números
seguintes de cada teste vinham em cadeia do primeiro, então um erro de 20 pérolas derrubava a
sequência toda. Corrigi todos recalculando a partir dos custos atuais.

### Causados por mim (5)

| Teste | Causa | Conserto |
|---|---|---|
| `mechanics.spec.ts` × 2 (Corais Corrompidos) | Pulavam para `wave=5` esperando o chefe. A fase 1 foi de 5 para 7 ondas na V3, então a onda 5 não tem chefe nenhum. | `wave=6` (a última). |
| `game.spec.ts` migração de save | `saveVersion` foi para 5 com a maestria. | Espera 5 e confere que `mastery` nasce vazio. |
| `game.spec.ts` "dolphin in open water" | O ponto (950, 340) era recusado por não ser água livre. Com o Golfinho aceitando margem, ele passou a ser válido. | **O teste estava certo e a premissa é que mudou.** Reescrito para afirmar a regra nova. |
| `campaign.spec.ts` título "five waves" | A fase 1 não tem mais cinco ondas. | Renomeado. |

### Flake (1)

`mechanics.spec.ts` "o Camarão volta ao repouso" estourou o timeout com erro de teardown
(`End of central directory record signature not found`) numa passada e passou nas seguintes. É a
instabilidade de boot já conhecida do projeto, não regressão.

### Efeito colateral bom

O teste do álbum no `mobile-landscape`, que falhava no `main` desde 13/09 por sobreposição de layout
em 844×390, **passou a passar**. A causa é a correção 3 da seção 7: a consulta de altura
(`@container (max-height: 460px)`) empilha o álbum numa coluna só nessa resolução — exatamente o
intervalo que faltava.
