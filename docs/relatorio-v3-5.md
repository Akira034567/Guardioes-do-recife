# Relatório — rodada V3.5 (o menu, a dificuldade, os atalhos e a conta de verdade)

Continuação de [`relatorio-v3-4.md`](relatorio-v3-4.md).

**Testes unitários: 628 passando, 0 falhando.**
**E2E: 128 passando, 0 falhando (4 puladas — as `@balance`).**

---

## 1. A Escola e a Maestria viraram abas do Álbum

Eram duas entradas no menu lateral e duas telas com layout próprio — lista de texto à esquerda,
prosa à direita. Nada parecido com o resto do jogo, e dois alvos a mais disputando o polegar no
celular.

As duas falam do **mesmo acervo** que o Álbum cataloga (os Guardiões, os efeitos, as ameaças), então
moram lá agora, com a mesma carta ilustrada e a mesma ficha das outras abas:

- **Escola**: cada aula é uma carta com a arte de quem ela ensina, agrupada pelo curso no subtítulo.
  A ficha traz resumo, pontos e a REGRA. O que a aba guarda continua sendo só o que já foi lido.
- **Maestria**: a foto de cada Guardião na grade; clicar abre a árvore dele **desenhada como
  árvore** — tronco de quatro nós, o nó 5 e a bifurcação nos dois ramos, com a arte da evolução
  final de cada lado. Era o pedido literal ("a foto dos guardiões e clicando em cada um deles abre
  uma árvore de evolução até que chegue na evolução final").

`ShellSection` perdeu `school` e `mastery`; `ShellNav.onOpenSchool/onOpenMastery` ficaram, e agora
abrem o Álbum na aba certa — inclusive o atalho da gaveta de pausa e o das aulas em campo.

Arquivos: `ui/dom/screens/album/{entry,schoolTab,masteryTab}.ts`. `SchoolScreen.ts` e
`MasteryScreen.ts` foram apagados, e com eles ~200 linhas de CSS que só serviam a eles.

---

## 2. Dificuldade: três campanhas, não três multiplicadores

O Difícil era **invisível**. O jogador fechava a campanha no Normal, liberava o Difícil e nada na
tela mudava: nem que ele existia, nem que a missão de lá é outra.

Três mudanças, nesta ordem de importância:

1. **Cada dificuldade tem a sua missão.** A fase declara o trio do Normal em `objectives` e o das
   outras em `objectivesByDifficulty`; `core/progression/levelObjectives.ts` resolve o par
   fase+dificuldade, e nenhuma tela lê `level.objectives` direto. No Recife 1, o Normal pede 15
   vidas e no máximo 3 Guardiões; o Difícil pede que **ninguém passe**, com no máximo 2 espécies.
2. **Cada dificuldade tem a sua trilha de estrelas.** `LevelRecord.byDifficulty` (save **v6**).
   Os campos de cima do registro continuam sendo a trilha do Normal — é deles que vivem as estrelas
   da campanha, os desbloqueios e as conquistas antigas, então nada inflou. Uma vitória no Difícil
   que também cumpre a missão do Normal continua marcando lá: vencer no Difícil é estritamente mais
   difícil.
3. **O mapa mostra qual trilha você está olhando.** Uma fileira de três cartões acima do mapa, com
   a cor da dificuldade, quantas fases caíram e quantas estrelas aquela trilha tem. Trocar de
   cartão troca a campanha inteira que a tela mostra: nós, estrelas dos nós e os objetivos da ficha.
   O mapa abre na mais alta que o jogador já liberou.

A migração v5 → v6 é honesta: o que existia foi medido pelos objetivos do Normal, então vira a
trilha do Normal. Difícil e Abissal começam vazios, porque as missões deles nunca foram avaliadas.

---

## 3. Três Segredos do Recife

Conquistas que **não aparecem na lista** antes de caírem — nem como "???" — e entram nela no
instante em que o jogador as completa. A tela anuncia só quantas existem ("Segredos do Recife: 1 de
3"), para haver o que procurar sem entregar o quê.

| Segredo | O que pede | Como é medido |
| --- | --- | --- |
| Sopro de vida | Vencer as 6 fases perdendo no máximo 1 vida em cada | `best.livesLost` de cada fase |
| Sem recomeço | Concluir a campanha sem nunca reiniciar uma fase | `totals.restarts === 0` |
| Dupla do Recife | Vencer todas as fases com no máximo 2 espécies em cada | `best.distinctGuardians` |

O "Sem recomeço" tem uma propriedade bonita de graça: como o progresso de conquista nunca regride,
um único recomeço na vida congela a medida abaixo da meta **para sempre**. É exatamente o que a
frase promete.

Save antigo, que nunca mediu espécies por partida, conta como "ainda não" — nunca como zero. Ninguém
ganha a Dupla do Recife de presente por ter um save velho.

---

## 4. A barra de cima recebeu a fase e o chamado de onda

O canto de baixo à direita guardava "FASE 1/6 · RECIFE COSTEIRO" e o botão PRÓXIMA ONDA. Era o bloco
mais apertado do HUD, e a plaquinha ficava longe de tudo que responde "como vai a partida".

A barra de cima agora é, da esquerda para a direita: marca, **plaquinha da fase com o selo da
dificuldade**, pérolas, vida do Recife, a pílula da onda (em que onda estou **e** quanto falta para a
próxima, que antes eram duas pílulas) e, à direita, **PRÓXIMA ONDA · 1× · reiniciar · pausa · tela
cheia · som**.

- O selo da dificuldade usa a mesma cor do mapa: as duas telas falam a mesma língua.
- A velocidade andou para a esquerda e ganhou o **reiniciar** ao lado, entre ela e a pausa.
- A plaquinha flutuante que ficava por cima do mapa saiu: dizia a mesma coisa duas vezes.
- O painel do Guardião em foco cresceu de 440 para 560 px, ocupando o espaço que sobrou embaixo.

---

## 5. Atalhos de teclado, e a armadilha do toque duplo

- `ESPAÇO` — chama a próxima onda; **sem onda para chamar**, alterna 1×/2×. Uma tecla, dois momentos
  que nunca coexistem: durante a contagem a coisa urgente é adiantar a onda (e ganhar o bônus);
  com a onda em campo, o espaço ficava ocioso. Quem decide qual dos dois é a **cena**, não a barra:
  a barra só tem um espelho do estado, e ele pode estar um quadro atrasado justamente no instante
  em que a contagem começa (foi o que fez a sonda do espaço trocar a velocidade no celular).
- `R` — pede para reiniciar. `Enter` ou `R` de novo confirmam. `ESC` cancela.
- A confirmação (`ui/dom/screens/ConfirmScreen.ts`) nasce **desarmada por 600 ms**, e a carência
  vale igual para a tecla e para o botão. É a armadilha do enunciado: apertar R duas vezes rápido é
  o gesto de quem está com pressa, e sem a carência o segundo R jogaria a partida fora antes de a
  pergunta chegar a ser lida.
- A partida congela enquanto a pergunta está na tela: o tempo de ler não pode ser tempo de onda
  andando.

---

## 6. A gaveta de pausa anda para os lados

A cena escolhe o lado olhando por onde a rota passa, mas ela não sabe de que lado está a coisa que
**este** jogador quer olhar agora. Agora tem uma alça no topo: arrastando, a gaveta segue o dedo e,
ao soltar, encosta no lado mais perto — e aquele lado passa a valer nas próximas pausas da sessão.

Só a alça arrasta. O corpo da gaveta tem os controles deslizantes de volume, e um arrasto que
começasse neles roubaria o gesto de quem só queria baixar a música.

---

## 7. Tela cheia parou de "travar" o jogo

Não travava nada. O Phaser, sem `fullscreenTarget`, cria um `<div>` próprio, move **só o canvas**
para dentro dele e manda esse div para tela cheia. O `#ui-layer` — irmão do canvas dentro de `#game`
— ficava de fora do elemento em tela cheia, e o navegador simplesmente não o desenhava.

Então a gaveta de pausa e o painel de resultado **estavam abertos**: bloqueando o input do Phaser,
como toda tela modal faz, e invisíveis. Apontar a tela cheia para `#game`, que contém os dois,
resolve os dois sintomas de uma vez.

---

## 8. Celular

- **A barra do navegador saiu da frente.** Em paisagem, a barra de endereço do Chrome cobre a barra
  de cima do HUD e só some depois de uma rolagem que esta página nunca tem. A única saída que os
  navegadores dão é a API de tela cheia, e ela exige um gesto: no primeiro toque, o jogo pede tela
  cheia uma vez (`systems/immersive.ts`). Não insiste, e dá para desligar em Configurações.
- **Os botões pararam de ser largos.** Abaixo de 760 px de canvas, o menu lateral e as seis abas do
  Álbum viram pictogramas de 44 px (o nome fica no `title` e no rótulo acessível), o álbum passa a
  uma coluna só e o botão de texto perde metade do respiro lateral.
- **Barra de rolagem horizontal não existe mais** em lugar nenhum da camada HTML, e a vertical
  ficou fina, arredondada e da cor da água. A exceção é a fileira de abas, que precisa rolar de lado
  em tela estreita e rola sem barra nenhuma.
- De quebra, a sonda `opens the reef album` — que falhava em `mobile-landscape` desde antes desta
  rodada — passou a passar: o rodapé decorativo do álbum escorregava por cima das abas da ficha e
  comia o clique delas.

---

## 9. O que só apareceu rodando o jogo

Testes verdes não são telas boas. Rodando o jogo de verdade e olhando as capturas, quatro coisas
apareceram — e três delas eram anteriores a esta rodada:

- **A tela de conta nunca teve CSS.** `gr-field`, `gr-field__label`, `gr-field__input` e o resto
  existiam no HTML e em lugar nenhum do `ui.css`. Os rótulos saíam no corpo padrão do navegador
  (gigantes ao lado do resto, que é escalado por `--gr-scale`) e cada campo tinha a largura do seu
  `size` implícito. Agora o rótulo fica em cima, os campos têm a mesma largura e o formulário se
  parece com o resto do jogo.
- **`hidden` perdia para o nosso `display`.** Um bloco que devia abrir só depois do clique nascia
  aberto, porque `display: flex` vence o `display: none` que o navegador dá a `[hidden]`. Havia dois
  remendos por elemento no Meu Recife; agora é uma regra só, `#ui-layer [hidden]`.
- **O álbum em tela estreita empilhava errado.** A grade e a ficha rolavam cada uma por dentro, as
  duas estouravam a própria faixa e a ficha era pintada POR CIMA das cartas. Em tela estreita quem
  rola passou a ser a coluna inteira, e as cartas deixaram de esticar até 390px cada.
- **A plaquinha da fase não cabia em uma linha.** "FASE 3/6 · TRÊS REDEMOINHOS" ao lado do selo da
  dificuldade encolhia até o piso de 7px e ainda passava por baixo do selo. Viraram duas linhas: a
  posição em cima, o nome embaixo.
- **O ESC chegava duas vezes.** Com a confirmação de reinício aberta, apertar Esc às vezes cancelava
  a pergunta E abria a gaveta de pausa em seguida. O Phaser só processa a fila de teclado com o
  input do jogo ligado, e uma tela modal o desliga — o mesmo toque podia ser entregue de novo depois
  de a tela fechar. Para quem joga, era "apertei Esc para desistir e o jogo pausou sozinho". Um
  segundo ESC dentro de 320 ms agora é tratado como eco; dois toques de verdade continuam fazendo as
  duas coisas.
- **A reposição da rolagem podia se perder.** `preserveScroll` gravava a posição e a repunha numa
  atribuição só. Conteúdo recém-montado tem imagem que ainda não carregou, e imagem sem carregar não
  tem altura: o contêiner está mais curto do que vai ficar, o navegador limita o `scrollTop` ao
  máximo daquele instante e a posição some. O sintoma era uma tela que "às vezes" voltava ao topo —
  e a sonda que protegia isso falhava 1 em cada 6 execuções já antes desta rodada. Agora a reposição
  insiste por alguns quadros e a cada imagem que chega, e para na hora em que o jogador toca na
  rolagem (a vontade dele vence).

---

## 10. Conta de verdade, com banco de dados (Supabase)

O que existia era honesto mas limitado: conta **deste aparelho**, com um código para colar no outro.
Agora há um segundo nível, e a tela diz claramente qual é qual.

**Divisão de trabalho.** E-mail, hash da senha (bcrypt) e os e-mails de confirmação e de "esqueci a
senha" são do Supabase Auth. O nome de usuário único e o documento de progresso são duas tabelas
nossas com RLS (`supabase/schema.sql`). O jogo só empurra e puxa um JSON.

**Entrar pelo nome de usuário.** O Supabase só autentica por e-mail, e o jogador não decora qual
e-mail usou. A saída óbvia — uma função que traduz nome em e-mail — vazaria o endereço de qualquer
um. A RPC `email_for_credentials(usuario, senha)` **confere o hash antes** de devolver o e-mail:
senha errada e usuário inexistente dão exatamente a mesma resposta.

**Sincronização.** O jogo grava no `localStorage` como sempre e empurra para o servidor alguns
segundos depois. Falhar nunca quebra a partida: vira um aviso em Minha Conta. Ao entrar, vence o
documento **mais recente** — não há fusão, porque "eu tinha 12 estrelas e agora tenho 9" é pior do
que qualquer perda honesta, e a tela diz qual dos dois venceu.

**Cliente próprio.** ~150 linhas de `fetch` (`core/account/supabase.ts`) em vez do SDK: o jogo usa
seis rotas e tem uma dependência de runtime só.

Sem `VITE_SUPABASE_URL` configurado, nada disto aparece e o jogo roda exatamente como antes. O passo
a passo de ligação está no README, em [Contas e saves](../README.md#contas-e-saves).

---

## 11. Segunda passada, depois de usar

Cinco acertos pedidos depois de jogar a versão publicada. Quatro são de proporção — coisas que
estavam certas e grandes demais — e um era um defeito que impedia de usar a tela.

- **O e-mail não cabia no campo.** Todo campo de texto da tela de conta herdava o teto do NOME de
  usuário: 16 caracteres. Um e-mail de verdade não cabe em 16, então criar conta era impossível — e
  a tela não dava pista nenhuma do motivo, o caractere simplesmente não aparecia. Agora o teto é
  declarado por campo (`FIELD_MAX`), e o do e-mail é o da especificação: 254.
- **Minha Conta mostrava seis formulários ao mesmo tempo.** Entrar, criar, recuperar, entrar no
  aparelho, criar no aparelho e o código de transferência — uns vinte campos abertos numa tela cujo
  trabalho é responder "quem está jogando?". Agora é um cartão só, com um seletor de dois botões
  (ENTRAR / CRIAR CONTA) trocando o formulário no lugar, e "Mais opções" guardando o resto. O
  código do Recife saiu da frente mas não saiu do jogo: a conta na nuvem é opcional, e quem prefere
  não dar e-mail nenhum continua só com ele para levar o progresso.
- **As trilhas de dificuldade comiam um quinto da tela.** Eram três cartões com nome, contagem,
  estrelas e uma frase de apoio cada. Viraram três pílulas numa fileira fina; a frase e o requisito
  foram para o `title`.
- **A pílula da onda cortava "EM CURSO".** Ela foi dimensionada para "EM 10s". Agora ela cresce
  quando o botão PRÓXIMA ONDA some — que é exatamente quando o texto fica longo e o espaço ao lado
  vaga — e encolhe quando ele volta.
- **A Escola era idêntica às outras abas.** Mesma grade de três retratos dos Guardiões e da
  Maestria, o que fazia a troca de aba parecer não ter acontecido. Aula é texto, não criatura:
  virou uma lista agrupada pelos quatro cursos, com contador por seção.
- **Sobrava uma faixa vazia no canto de baixo à direita**, herdada do bloco de comandos que subiu
  para a barra de cima. O painel do Guardião tomou a faixa: ganhou uma quarta medida (o quanto já
  foi investido NAQUELA unidade, que é o número que decide entre evoluir e vender) e a descrição
  dos ramos deixou de ser espremida em duas linhas de 9 px.
