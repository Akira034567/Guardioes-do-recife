# Relatório — Escola do Recife (camada de tutorial)

**Testes unitários: 596 passando, 0 falhando** (eram 589; +7 da Escola, +9 dos momentos já contados antes).
**E2E: 5 sondas novas em `tests/e2e/school.spec.ts`, mais a suíte completa.**

---

## 1. O que existia

Seis frases, só no Recife 1, sobre o HUD: escolher carta, posicionar, iniciar onda, selecionar
unidade, comprar evolução, acelerar. É o `TutorialDirector`, e ele faz bem o que se propõe — ensina a
MEXER no jogo.

O que ele nunca ensinou é o jogo. Levantei o que estava faltando:

| Assunto | Onde era explicado antes |
|---|---|
| O que cada Guardião faz e quando escolher cada ramo | Álbum, como lore e ficha de números |
| Os cinco ícones de status em cima do inimigo | **Em lugar nenhum** |
| A correnteza do mapa | **Em lugar nenhum** — só partículas sem legenda |
| Como responder a cada tipo de invasor | Ameaças, como `weaknesses` de uma linha |

Os dois "em lugar nenhum" são os graves. Os ícones de status estão em campo desde a V3.1 e o jogador
que vê um floco de neve sobre o inimigo não tinha **nenhuma** forma de descobrir o que ele significa.
A correnteza muda a velocidade do invasor **e desvia o projétil** — a segunda metade quase ninguém
percebe, e ela decide se um Camarão rende o que a ficha promete.

E há uma família de regras que o motor aplica desde sempre sem nunca dizer: vulnerabilidade **não
soma** (vale a maior, teto ×1,30), lentidão **não soma** (vale a mais forte), aura **não acumula**
(vale a melhor fonte), veneno **acumula** (até 2 doses), e controle em elite/chefe tem retorno
decrescente. Isso muda a decisão de comprar o segundo Polvo. O jogador descobria perdendo.

---

## 2. O que foi construído

### Camada 1 — os passos (inalterada)

Continua igual, com o mesmo contrato de e2e: `data-tutorial` é o id do passo, `tutorial:skip`
encerra, `?tutorial=0` desliga, nada bloqueia.

### Camada 2 — os momentos (`core/tutorial/Moments.ts`)

Aulas-relâmpago que disparam **uma vez na vida**, em **qualquer fase**, no instante em que a coisa
acontece pela primeira vez: o primeiro veneno, a primeira correnteza, o primeiro camuflado, o
primeiro chefe, o primeiro Polvo em campo. São 20 gatilhos — 9 de Guardião, 5 de status, 6 de campo.

Três limites que existem por motivo:

1. **Uma frase por vez, com 14s de intervalo.** A onda 1 do Recife 3 pode envenenar, atordoar,
   revelar e trazer um elite no mesmo segundo. Quatro cartões empilhados viram ruído que o jogador
   aprende a fechar sem ler.
2. **Calada enquanto a faixa está ocupada por um passo.** O critério é o passo estar NA TELA, não o
   tutorial estar "por terminar" — fora do Recife 1 o diretor nunca conclui nada, e checar `isOver`
   calaria os momentos para sempre em todas as outras fases. Foi exatamente o bug que a primeira
   versão tinha, pego na sonda.
3. **Nunca bloqueia.** Mesma faixa, mesmo PULAR, mesmo jogo respondendo por baixo.

O momento é marcado como visto ao **entrar** na tela, não ao sair: fechar o jogo no meio da onda não
faz a frase voltar como se nada tivesse acontecido.

### O manual (`data/school.ts` + `ui/dom/screens/SchoolScreen.ts`)

**25 aulas em quatro cursos:**

| Curso | Aulas |
|---|---|
| Os Guardiões | 9 — uma por Guardião: o que faz, onde vai, os dois ramos e quando escolher cada um |
| Efeitos de status | 6 — os cinco ícones mais uma sobre a regra de não somar |
| A correnteza | 4 — a rota, a água do mapa, os cinco lugares de posicionamento, a água que você muda |
| As ameaças | 6 — cardume, veloz, blindado, camuflado, elite, chefe, com o contra-jogo de cada um |

Toda aula fecha numa **REGRA** com o número exato — é o que separa a aula do texto de sabor, e um
teste unitário exige que ela exista e contenha um número. Três regras que eu havia escrito de forma
categórica foram reescritas por causa desse teste, e ficaram melhores: a do revelado passou a dizer
"revela por 5s, a cada 5,5s", a da correnteza ganhou o piso de 30% da velocidade, e a da água que
você muda passou a citar os ×2,2 e ×1,8 da Baleia.

**Nada é bloqueado.** Um manual que esconde a página de que você precisa não é um manual. O que o
save guarda é só o que já foi lido, para marcar o que é novo e contar "12/25".

**Alcançável de dentro da partida**, pelo menu de pause. A dúvida "o que é esse ícone?" nasce no meio
da onda; mandar o jogador sair da fase para descobrir é pedir que ele não descubra.

---

## 3. Onde isso aparece

- Barra lateral, entre o Mapa e o Álbum (`ESCOLA DO RECIFE`).
- Menu de pause (`ESCOLA DO RECIFE`), sem sair da partida.
- Faixa acima das cartas, durante a partida, com o ícone do efeito quando a aula fala de status.
- Configurações → Jogabilidade → **Aulas em campo** (liga/desliga os momentos; o manual continua).
- Configurações → Dados → **Rever tudo de novo** (zera passos, momentos e aulas lidas de uma vez).

---

## 4. Save

Nenhuma migração foi necessária: `sanitizeProgress` preenche campo novo com o padrão, que é o
caminho já estabelecido no projeto para acréscimos. `SAVE_VERSION` segue 5.

```
tutorial: { completedSteps, done, skipped, seenMoments, seenLessons }
settings.tutorialMoments: true
```

---

## 5. Testes

- `tests/school.test.ts` (7): catálogo íntegro, todo Guardião com aula, **todo ícone de status com
  aula** (impede que um efeito novo entre em campo sem explicação), toda arte apontando para algo que
  existe, toda regra com número.
- `tests/moments.test.ts` (9): fila solta um por vez, respeita o intervalo, nunca repete entre
  partidas, calada não gasta os momentos, PULAR cala pelo intervalo, marca ao entrar na tela.
- `tests/e2e/school.spec.ts` (5): abre pelo menu e conta a leitura; alcançável pelo pause; ensina a
  correnteza uma frase por vez; **não atropela o tutorial e não trava o jogo** (posiciona um Guardião
  com a faixa na tela); desligar silencia a faixa e mantém o manual.

---

## 6. O que ficou de fora

| Item | Por quê |
|---|---|
| Aula por inimigo individual | O curso ensina os seis ARQUÉTIPOS e o contra-jogo. Ficha por bicho já é o Bestiário; duplicar seria manter dois textos divergindo. |
| Link do Bestiário/Álbum para a aula correspondente | Barato e útil, mas é superfície nova em duas telas que já são grandes. Vale uma rodada própria. |
| Aula sobre maestria, Peixinho Dourado e economia | A Maestria já tem tela própria e explícita. A economia (pérolas, bônus de onda antecipada) é um buraco real, mas de outro assunto. |
| Momento no primeiro Encontro e no primeiro tesouro | Os gatilhos existem no motor; faltou decidir se aquilo é aula ou narrativa. |
