# Relatório — rodada V3.3 (leitura de campo)

Continuação de [`relatorio-v3-2.md`](relatorio-v3-2.md) e do [relatório do tutorial](relatorio-tutorial.md).
Planilha atualizada: `balanceamento.xlsx`.

**Testes unitários: 598 passando, 0 falhando.**
**E2E: suíte completa rodada.**

Rodada inteira de apresentação, com uma exceção: a recarga do Peixe-Pedra, que é número de
balanceamento e por isso entra com a conta na mão (seção 2).

---

## 1. Peixe-Pedra — ele agora VIRA pedra

O problema era simples de descrever e difícil de ver: camuflado, ele continuava sendo um peixe
translúcido. A translucidez dizia "sumiu", mas a silhueta na tela continuava sendo a de um peixe — e
o jogador continuava vendo um peixe.

Agora o repouso dele é a arte de pedra que você mandou, **a mesma nas cinco variantes**. Isso é
parte do ponto: camuflado, ele não deve parecer nem o base nem o evoluído. Não dá para saber qual
Peixe-Pedra está ali até os espinhos abrirem.

| Fase | O que aparece |
|---|---|
| `settling` · `camouflaged` | a pedra (com um véu leve só enquanto ele se acomoda) |
| `arming` · `striking` | o bicho da variante, virado para a presa |
| `cooldown` | **a pedra de novo** |

O `cooldown` entrar nessa lista foi mudança de comportamento, não só de arte: antes ele ficava de
espinhos abertos durante a recarga inteira, o que contava uma mentira sobre quando ele é perigoso.

**A pedra é opaca.** Ela é o disfarce; uma pedra translúcida seria o único objeto fantasma do
cenário. E ela não boia nem espelha — o balanço e a virada são do bicho, e aplicá-los à pedra
entregaria o disfarce (uma pedra que respira no ritmo de um peixe).

**Virada para a presa.** Ele tem dano 0 na ficha, então nunca adquiria alvo e dava o bote de costas.
É o mesmo buraco que o Baiacu tinha; o caminho que já existia para os bloqueadores ("para onde olha
quem não tem alvo") foi generalizado e agora serve aos dois.

**Um fio menor**: escala 0,72 → 0,62. Ele mora na BORDA da correnteza e não pode competir com a rota.

**Caçador da Corrente**: a Habilidade dele passou a usar o desenho do Impacto. A prancha traz uma
mira como habilidade e uma explosão de espinhos como impacto, e as duas saem no mesmo instante — a
mira em cima da explosão era sujeira. A troca acontece na CHAVE da textura, não no arquivo: carregar
a mesma imagem sob dois nomes seria pagar duas vezes por ela no boot.

---

## 2. A recarga: 3s → 4,5s

Pedido de sensação, com consequência de balanceamento — então vai com a conta.

| | Antes | Agora |
|---|---|---|
| Recarga | 3,0s | 4,5s |
| DPS base (bote + veneno, 1 alvo) | 27,3 | 18,2 |
| A2 Jardim Abissal | 33,3 | 22,2 |
| B2 Caçador da Corrente | 44,0 | 29,3 |

É um corte de um terço no dano por segundo. **Na simulação o efeito foi pequeno:** a partida do
golden que usa o Peixe-Pedra (`recife-1 · novatos: camarões + peixe-pedra veneno + golfinho sonar`)
terminou com **as mesmas 19 vidas, as mesmas 145 pérolas e as mesmas 7 ondas** — só levou 3,3
segundos a mais. As duas outras builds com ele (`recife-1 · tubarão frenesi + peixe-pedra emboscada`,
15/20, e `recife-6 · novatos`, 15/20) fecharam iguais.

A leitura: ele nunca foi o pilar de dano de nenhuma build, então mexer no DPS dele mexe pouco no
resultado. O que muda é a sensação, que era o pedido — a 3s ele emboscava quase sem parar, e um
emboscador que ataca a cada três segundos não está emboscando, está atirando devagar.

**Fica em aberto** confirmar isso à mão nas fases longas, onde ele tem mais tempo para acumular.

---

## 3. Névoa tóxica mais discreta

A arte da nuvem era desenhada no diâmetro inteiro da zona. Com raio 108, isso é um disco de 216 px
em cima da rota — ele escondia justamente os inimigos que estava envenenando, e o jogador perdia de
vista o que precisava acompanhar.

| | Antes | Agora |
|---|---|---|
| Arte | 2,0 × raio | 1,5 × raio |
| Opacidade máxima | 0,85 | 0,50 |

**A zona de jogo não mudou.** O anel desenhado continua marcando o raio real; o que encolheu foi só
o desenho, que agora lê como o núcleo denso. A nuvem de tinta do Polvo ficou como estava — ela tem o
mesmo problema estrutural, mas não foi o que você apontou, e mexer nela sem pedido seria mudar uma
leitura que você pode estar gostando.

---

## 4. Tartaruga — a onda ANDA

Era um anel que crescia em cima da Tartaruga. O jogador via a unidade piscar e os inimigos saltarem
para trás, sem nada ligando as duas coisas.

Agora a arte da habilidade **percorre a correnteza**, pelo traçado real da rota, no sentido em que o
empurrão acontece, e pela **mesma distância** que ele aplica — o evento passou a carregar `distance`
justamente para a animação não mentir sobre o alcance. A imagem gira acompanhando as curvas e espelha
quando o caminho vai para a esquerda, para a crista apontar sempre para onde a onda empurra.

Detalhes que existem por motivo:
- o rumo é medido de um ponto **atrás** da frente, senão a onda treme nas quinas da rota;
- em fases com mais de uma rota, ela escolhe a correnteza mais próxima da Tartaruga, não a principal;
- a mais de 220 px de qualquer rota não há correnteza para percorrer e o anel antigo volta como recurso.

---

## 5. Golfinho

**O sonar sai em três ondas.** A arte da habilidade era desenhada nas três, empilhando três discos
grandes no mesmo lugar. Agora ela entra só na primeira — as cristas vetoriais já contam a repetição,
e a arte serve para anunciar "o Golfinho fez alguma coisa", não para repetir três vezes.

**O idle do Maestro do Recife estava gigante.** A arte retocada chegou em 1774×887 enquanto toda a
família do Golfinho tem ~200×60; como a escala é única por Guardião, ela aparecia com **1277 px de
largura** em campo. Reenquadrada no gabarito dos irmãos:

| | base | Coro I | **Coro II** | Sonar I | Sonar II |
|---|---|---|---|---|---|
| Largura em campo | 143 px | 145 px | **148 px** (era 1277) | 142 px | 142 px |

O desenho não foi alterado — só o enquadramento: bicho na largura de um upgrade de nível 2 e
encostado na base do canvas, que é onde a âncora (0.5, 1) espera encontrá-lo.

---

## 6. O que ficou de fora

| Item | Por quê |
|---|---|
| Nuvem de tinta do Polvo | Mesmo problema de sobreposição da névoa, mas não foi apontado. Vale a mesma dose se você quiser. |
| Recarga do Peixe-Pedra jogada à mão | A simulação diz que muda pouco; a sensação é o ponto e só você pode julgar. |
| Arte da onda da Tartaruga | Ela carrega as pedras do rodapé da célula da prancha, que no meio da água ficam estranhas. Uma peça só de onda, sem cenário, resolveria. |
