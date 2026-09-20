# Guardiões do Recife

Tower defense 2D subaquático com seis fases, construído com TypeScript, Phaser e Vite.

## Requisitos

- Node.js 24 LTS
- npm 11+

## Comandos

```bash
npm install
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:balance
```

Abra `http://localhost:5173`. O jogo usa mouse e touch em layout horizontal 16:9.

## Fases e progressão

- O jogo abre no menu de fases. Concluir uma fase libera a seguinte; o progresso fica no `localStorage`.
- `?level=recife-3` abre uma fase diretamente (útil para testes e balanceamento).
- Fase 1 usa o fundo pintado; as demais desenham um fundo procedural a partir da rota, plataformas e correntes.
- Cada fase define rota, plataformas, correntes, pérolas iniciais, escala de inimigos e composição de ondas.
- A carta da fase abre a história de abertura (na primeira vez) e depois a preparação: objetivos, dificuldade, ameaças conhecidas e as cinco vagas do esquadrão.
- Concluir objetivos rende estrelas e Conchas, a moeda permanente gasta fora da partida.

### Dificuldade: três campanhas, não três multiplicadores

Fechar a campanha no Normal abre o **Difícil**; fechá-la no Difícil abre o **Abissal** (`core/progression/difficultyUnlocks.ts`). O que mudou na V3.5 é que isso deixou de ser invisível e deixou de ser só "os bichos batem mais forte":

- **Cada dificuldade tem a sua missão.** A fase declara o trio do Normal em `objectives` e o das outras em `objectivesByDifficulty`; quem resolve o par fase+dificuldade é `core/progression/levelObjectives.ts`, e nenhuma tela lê `level.objectives` direto. No Recife 1 o Normal pede 15 vidas e no máximo 3 Guardiões; o Difícil pede que ninguém passe, com no máximo 2 espécies.
- **Cada dificuldade tem a sua trilha de estrelas.** `LevelRecord.byDifficulty` guarda estrelas e objetivos por dificuldade (save v6). Os campos de cima do registro continuam sendo a trilha do **Normal** — é deles que vivem as estrelas da campanha, os desbloqueios e as conquistas antigas, então nada inflou.
- **O mapa mostra qual trilha você está olhando.** Uma fileira de três cartões (`map-track-<id>`) acima do mapa, com a cor da dificuldade, quantas fases caíram e quantas estrelas aquela trilha tem; os nós, as estrelas dos nós e os objetivos da ficha respondem à trilha escolhida. O mapa abre na mais alta que o jogador já liberou — antes o Difícil era liberado e nada na tela mudava.
- **A partida diz em que dificuldade está.** A plaquinha da barra de cima traz "FASE 3/6 · NOME" e um selo com o nome e a cor da dificuldade.

## Contas e saves

Há dois níveis de conta, e a tela Minha Conta diz claramente qual é qual.

### Conta na nuvem (Supabase)

A conta de verdade: **usuário único, e-mail, senha com hash e o progresso em qualquer aparelho**. Ela só existe quando a instalação está configurada — sem isso o jogo roda inteiro offline, com o que está descrito na seção seguinte.

- **Divisão de trabalho.** E-mail, hash da senha (bcrypt) e os e-mails de confirmação e de "esqueci a senha" são do Supabase Auth. O nome de usuário único e o documento de progresso são duas tabelas nossas com RLS (`supabase/schema.sql`). O jogo só empurra e puxa um JSON.
- **Entrar pelo nome de usuário.** O Supabase só autentica por e-mail. Traduzir nome → e-mail com uma função aberta vazaria o endereço de qualquer um; então a RPC `email_for_credentials(usuario, senha)` **confere o hash antes** de devolver o e-mail. Senha errada e usuário inexistente dão exatamente a mesma resposta.
- **Sincronização.** O jogo grava no `localStorage` como sempre e empurra para o servidor alguns segundos depois (`systems/cloud.ts`). Falhar ao empurrar nunca quebra a partida: vira um aviso em Minha Conta. Ao entrar, vence o documento **mais recente** — não há fusão de progresso, porque "eu tinha 12 estrelas e agora tenho 9" é pior do que qualquer perda honesta.
- **Cliente próprio.** São ~150 linhas de `fetch` (`core/account/supabase.ts`) em vez do SDK: o jogo usa seis rotas e tem uma dependência de runtime só (o Phaser). Os dois cabeçalhos (`apikey` e `Authorization: Bearer`) levam a chave publicável enquanto ninguém entrou, e o `Authorization` passa a levar o token da sessão depois — que é o que a RLS lê para saber de quem são as linhas.

**Como ligar** (uma vez, por instalação):

1. **Crie o projeto.** [supabase.com](https://supabase.com) → New project (o plano free basta). Guarde a senha do banco que ele pede; ela não é usada pelo jogo, mas é a sua chave mestra do Postgres.
2. **Crie o esquema.** No painel, SQL Editor → New query → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) inteiro → Run. Ele é idempotente: rodar de novo depois de uma atualização não apaga nada.
3. **Aponte para onde o e-mail volta.** Authentication → URL Configuration: ponha a URL do jogo em **Site URL** e a mesma em **Redirect URLs**. Sem isso, o link de "esqueci a senha" chega mas leva para o lugar errado. Em Authentication → Sign In / Providers → Email, deixe **Confirm email** ligado: é ele que garante que o e-mail do reset é de verdade.
4. **Configure o jogo.** Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (painel → Settings → API Keys; a chave começa com `sb_publishable_`). Projetos antigos têm o JWT `anon` no lugar — vale também, em `VITE_SUPABASE_ANON_KEY`.
5. **Ligue um SMTP próprio — sem isto, só VOCÊ consegue se cadastrar.** O mailer embutido do Supabase entrega apenas para endereços da equipe do projeto (qualquer outro recebe *"Email address not authorized"*) e manda no máximo 2 por hora; a própria documentação diz que ele não é para produção. Em Authentication → Emails → SMTP Settings, aponte para um provedor. O [Brevo](https://www.brevo.com/free-smtp-server/) resolve sem domínio próprio: plano grátis de 300/dia, e basta verificar UM endereço remetente (um Gmail seu serve).

   | Campo no Supabase | Valor |
   | --- | --- |
   | Host | `smtp-relay.brevo.com` |
   | Port | `587` |
   | Username | o e-mail de login do Brevo |
   | Password | a *SMTP key* gerada no Brevo (não é a senha da conta) |
   | Sender email | o endereço que você verificou no Brevo |
   | Sender name | `Guardiões do Recife` |

   Depois de salvar, o Supabase impõe um teto inicial de 30 mensagens/hora: ajuste em Authentication → Rate Limits.

6. **Confira.** `npm run verify:supabase` testa tudo pelo mesmo caminho que o jogo usa e diz qual peça faltou: configuração, tabelas, **RLS realmente barrando quem não entrou**, e as duas RPCs (inclusive que a de login por usuário nega sem revelar se o nome existe). Dois modos a mais:

   - `npm run verify:supabase -- --cadastrar EMAIL --usuario NOME --senha SENHA` cria uma conta de verdade. É o único jeito de responder "outra pessoa consegue se cadastrar?" — é aqui que o mailer embutido denuncia o `not authorized`.
   - `npm run verify:supabase -- --usuario NOME --senha SENHA` faz o caminho completo com uma conta já confirmada: entrar pelo nome, gravar o progresso, ler de volta e desfazer.
7. **Leve para o deploy.** As duas variáveis precisam existir na hora do `npm run build` do GitHub Actions. Declare-as como *repository variables* (Settings → Secrets and variables → Actions → Variables): `gh variable set VITE_SUPABASE_URL` e `gh variable set VITE_SUPABASE_PUBLISHABLE_KEY`. O workflow já as lê.

Sem `VITE_SUPABASE_URL`, `isCloudEnabled()` é falso, o cartão da nuvem não é desenhado e nada muda.

### Contas deste aparelho

O que sempre existiu, e continua valendo para quem não quer dar e-mail nenhum: uma conta **deste aparelho**, com nome e senha, que separa saves e leva o progresso num código.

- **Um save por conta.** Quem joga sem entrar continua no save do aparelho (`guardioes-do-recife.save`); cada conta tem o seu (`guardioes-do-recife.save:<id>`). Entrar é só trocar a chave que o `SaveManager` abre, então dois irmãos no mesmo computador nunca jogam por cima um do outro.
- **Nome é único.** A comparação ignora maiúsculas, acentos e espaço sobrando ("Ana", "ana" e " aNa " são a mesma pessoa), então não existem dois usuários com o mesmo nome.
- **A senha não é guardada.** Fica só a derivação PBKDF2-SHA-256 com sal por conta (`core/account/passwords.ts`). Em contexto sem `crypto.subtle` (http puro, `file://`) o esquema cai para um plano B fraco, **marcado como tal** no registro — nunca é senha em texto puro.
- **Progresso já salvo vira conta.** Criar conta pergunta se o progresso do aparelho vem junto; vindo, ele é copiado (o save do convidado fica intacto) e carimbado com o `profileId` da conta nova.
- **Jogar em outro aparelho.** `exportCode()` empacota conta e save num "código do Recife" (`GR1.…`) para colar no outro aparelho, onde a mesma senha o abre. Se a conta já existir lá, o código só substitui o progresso dela quando a senha for a mesma. Continua sendo a ponte de quem joga sem conta na nuvem: **sem o código, o save fica no navegador onde foi jogado**.
- **Trocar de conta reabre tudo.** `systems/session.ts` derruba os serviços únicos da página (`ProgressStore`, `progression`) e a cena se refaz (`router.reboot()`), senão a conta nova continuaria mexendo no documento da anterior.
- As contas ficam em `guardioes-do-recife.accounts`; apagar uma conta apaga o save dela e devolve o jogador ao modo convidado.


## Encontros do Recife

Os quatro Guardiões além dos cinco fundadores não se compram: eles são **encontrados**. Cada um tem uma fase curta própria em `src/game/data/encounters/`, fora da campanha (não entra em `LEVELS`, não vale estrela, não mexe na contagem de fases).

| Encontro | Guardião | Abre quando | Como resolve |
| --- | --- | --- | --- |
| A Gruta do Predador | Tubarão | Recife 2 concluído | Manter um Guardião a 150px da gruta por 10s |
| Rede Fantasma | Tartaruga | Recife 3 concluído | Cinco cortes na rede, com fôlego entre eles |
| Emboscada no Coral | Peixe-Pedra | Achar a pedra que pisca no Recife 4 | Um toque no leito |
| O Chamado | Golfinho | Recife 5 concluído | Um Guardião perto do sino durante a segunda maré |

O Guardião libertado entra **de graça e emprestado** (`ownerId: "npc"`): luta até o fim da partida, não custa pérolas e não pode ser vendido. Vencer a fase conclui o Encontro e é isso que `data/unlocks.ts` espera para entregá-lo à coleção.

Tudo isso roda em `core/Interactables.ts` (regra pura) mais o comando `interact` do motor. Um interagível novo é só uma entrada em `LevelDefinition.interactables`, com `goal` (`taps`, `guardNearby`, `enemyDefeated` ou `reveal`) e a recompensa (`ally`, `current` ou `secretId`).

## Conquistas e desafios

- **Conquistas** (`data/achievements.ts` + `core/progression/achievements.ts`): dezenove medidas sobre o perfil, a coleção e a melhor marca de uma partida. O progresso nunca regride, cada uma paga Conchas uma vez e as escondidas ficam em "???" até caírem. São recalculadas no fim de cada partida e ao abrir o mapa.
- **Segredos do Recife** (`secret: true`): três façanhas de campanha inteira que **não aparecem na lista** antes de caírem — nem como "???" — e entram nela no instante em que o jogador as completa. A tela anuncia só quantas existem ("Segredos do Recife: 1 de 3"), para haver o que procurar sem entregar o quê.
  - *Sopro de vida* — vencer as seis fases perdendo no máximo 1 vida em cada (o teto é a constante `MAX_LIVES_LOST_FOR_SECRET`).
  - *Sem recomeço* — concluir a campanha sem nunca reiniciar uma fase. Um único recomeço na vida (`totals.restarts`) tranca a conquista para sempre, porque o progresso medido congela abaixo da meta.
  - *Dupla do Recife* — vencer todas as fases usando no máximo duas espécies em cada (`best.distinctGuardians`). Save antigo, que nunca mediu espécies, conta como "ainda não" — nunca como zero.
- **Desafios** (`core/progression/challenges.ts`): um do dia e um da semana, sorteados a partir da data com a semente do `Rng` — sem servidor, sem rede. O sorteio só usa fases e Guardiões que o jogador já alcançou; a preparação entra travada, com esquadrão e dificuldade fixos, e a recompensa cai ao cumprir a regra extra.

## Arte dos inimigos

Cada uma das sete ameaças tem sua pasta em `public/assets/enemies/<pasta>/frame-N.png`, declarada em `ENEMIES` pelo campo `art`:

| Inimigo | Pasta | Quadros |
| --- | --- | --- |
| Peixinho | `cardume-invasor` | 4 |
| Peixe Invasor | `lider-do-cardume` | 2 |
| Peixe-Flecha | `predador-corrompido` | 3 |
| Peixe-Agulha | `raia-espinhosa` | 4 |
| Cascudo | `caranguejo-eremita` | 4 |
| Moreia Sombria | `moreia-das-correntes` | 3 |
| Quebra-Marés | `baleia-mare-negra` | 1 |

A `EnemyView` alterna os quadros no ritmo de `frameMs`, gira a criatura ao longo da rota e a vira de barriga para baixo quando ela nada para a esquerda; `rotate: "upright"` mantém em pé quem anda no leito (o Cascudo). Faltando a imagem, o inimigo volta sozinho para a silhueta vetorial de `EnemyShapes.ts` (`shapeFallback`). O bestiário usa o primeiro quadro como retrato, em silhueta enquanto a espécie não foi encontrada. As imagens entram na `GameScene`, só para as espécies que aparecem naquela fase.

As outras cinco pastas (`agua-viva-fantasma`, `baiacu-corrompido`, `ladrao-do-recife`, `tartaruga-corrompida`, `carregador`) ficam prontas para os inimigos que ainda não existem.

## Áudio

Não há arquivo de áudio no projeto: tudo é sintetizado com osciladores em `systems/AudioManager.ts`. Dois barramentos sob o volume geral, efeitos e música, ambos ligados às configurações. A trilha (`systems/audio/MusicBed.ts`) é um acorde grave com respiro lento que muda de clima quando o chefe chega e quando a fase é vencida. Trocar por samples depois é mexer só nessa camada; as regras nunca chamam áudio, quem toca é `systems/MatchEffects.ts`.

## Telas fora da partida

Menus são HTML por cima do canvas (`src/game/ui/dom`), alinhados ao jogo e escalados por `--gr-scale`; o HUD da partida continua em Phaser.

- **Álbum do Recife**: seis abas com a mesma carta ilustrada e a mesma ficha — Guardiões, Encontros, Locais, Tesouros, **Escola** e **Maestria**. Guardião bloqueado vira silhueta com "???" e a pista de onde encontrá-lo; encontrado abre ficha com história, números, carreira e as duas árvores de evolução.
  - **Escola do Recife** (aba): as 25 aulas viraram cartas com a arte de quem elas ensinam, agrupadas pelo curso; a ficha traz resumo, pontos e a REGRA. Nada é bloqueado — o que a aba guarda é o que já foi lido, para marcar o que é novo.
  - **Maestria** (aba): a foto de cada Guardião na grade e, ao clicar, a árvore dele desenhada como árvore — tronco de quatro nós, o nó 5 e a bifurcação nas duas evoluções finais, com a arte de cada uma.
  - As duas saíram do menu lateral: o menu perdeu dois itens (no celular, dois alvos a menos disputando o polegar) e os dois assuntos ganharam o desenho do resto do jogo. `ShellNav.onOpenSchool/onOpenMastery` continuam existindo e abrem o álbum na aba certa.
- **Ameaças do Recife**: bestiário. O inimigo só aparece depois do primeiro encontro, com vida, velocidade, fraquezas, resistências e habilidades; chefes ganham página destacada.
- **Histórias do Recife**: índice dos capítulos já vividos, com releitura.
- **Configurações**: volumes, silenciar, efeitos reduzidos, tremor de tela e escala da interface. Tudo grava no save na hora.
- **Meu Recife**: a tela inicial e a casa do jogador (`scenes/HubScene.ts`). Um cenário pintado (`assets/reef/backdrop.png`) onde os Guardiões encontrados moram de verdade — nadam, reparam no cursor e reagem ao clique. O cenário É a interface: os seis lugares vêm desenhados no próprio fundo, com plaquinha e tudo (a ostra abre o Álbum, o naufrágio as Ameaças, o arco o Mapa, a lápide as Histórias, o troféu as Conquistas, o leme as Configurações), e cada um tem um alvo transparente por cima que dá o clique, o brilho no hover e o foco de teclado. O rótulo que aparece ao aproximar mostra só a dica — o nome já está pintado. Em aparelho sem cursor, o primeiro toque mostra a dica e o segundo entra. Clicar num Guardião abre uma ficha pequena com papel, origem e carreira. O menu lateral fica recolhido atrás do botão ☰: uma coluna sempre aberta taparia o Álbum e as Ameaças, que moram naquela faixa do desenho.
- **Mapa do Recife**: as seis fases em sequência, com estrelas, e os nós de Encontro pendurados nelas. Acima do mapa, a fileira das três dificuldades: escolher uma troca a campanha inteira que a tela mostra (nós, estrelas e objetivos da ficha). Deixou de ser a tela inicial: agora é uma seção como as outras, com VOLTAR para o Meu Recife.
- **Menu de pause**: o botão Ⅱ pausa e abre uma gaveta ao lado do mapa, com continuar, Escola, reiniciar, fases, sair e os ajustes inteiros. A gaveta **anda para os lados**: arraste pela alça do topo e ela encosta no lado mais perto, que passa a valer nas próximas pausas da sessão.
- **Conquistas do Recife**: a lista com barra de progresso, o que já caiu e o que falta.
- **Minha Conta**: a conta na nuvem (entrar por usuário ou e-mail, criar, recuperar senha por e-mail, sincronizar) e, abaixo dela, as contas deste aparelho com o código do Recife. O letreiro do Meu Recife mostra quem está jogando ("Convidado" quando ninguém entrou). Ver [Contas e saves](#contas-e-saves).

## UX da partida

- **Posicionamento**: a carta escolhida mostra a criatura em transparência sob o cursor, com o alcance na forma certa, o custo e o motivo quando a posição não vale. ESC ou o botão direito cancelam.
- **Painel de contexto**: sem unidade selecionada, o painel de baixo vira a ficha da carta escolhida (papel, ataque, alcance, custo e para onde vão as duas evoluções). Com unidade selecionada, mostra a árvore, os dois botões de ramo e a venda. O retrato flutuante sobre o mapa saiu de cena.
- **Números de dano**: `core/DamageAggregator.ts` soma os acertos de um mesmo alvo numa janela curta e `systems/FloatingTextPool.ts` reaproveita os textos. Golpe forte sai maior; veneno e área têm cor própria; a recompensa da morte sobe em dourado. Desligável nas configurações.
- **Tutorial, camada 1 — os passos**: `core/tutorial/TutorialDirector.ts` decide o passo (lógica pura, testada) e a `UIScene` desenha uma faixa acima das cartas com contorno no botão citado. Só no Recife 1, ensina a MEXER no jogo. Nada bloqueia, PULAR encerra de vez e `?tutorial=0` desliga.
- **Tutorial, camada 2 — os momentos**: `core/tutorial/Moments.ts` é uma fila que dispara aulas-relâmpago em QUALQUER fase, uma vez na vida do jogador, no instante em que a coisa acontece pela primeira vez — o primeiro veneno, a primeira correnteza, o primeiro chefe, o primeiro Polvo em campo. Divide a faixa com a camada 1, e o passo tem preferência: duas vozes ensinando ao mesmo tempo é pior que uma. Uma frase por vez, com intervalo de 14s, para a onda 1 do Recife 3 não despejar cinco cartões juntos. Desligável em Configurações (`tutorialMoments`).
- **Escola do Recife** (`ui/dom/screens/album/schoolTab.ts`, conteúdo em `data/school.ts`): o manual, hoje uma aba do Álbum. 25 aulas em quatro cursos — os nove Guardiões, os cinco efeitos de status, a correnteza e os seis tipos de invasor. Existe porque o Álbum e as Ameaças CATALOGAM e nunca EXPLICAM: lá o jogador lê que o Cascudo tem armadura 9; aqui ele lê que isso corta 36% de cada golpe. Toda aula fecha numa `rule` com o número exato, e um teste exige isso. Nada é bloqueado. Alcançável pelo Álbum e pela gaveta de pausa, sem sair da partida.
- **Barra de cima** (V3.5): marca, plaquinha da fase com a dificuldade, pérolas, vida do Recife, a pílula da onda (em que onda estou **e** quanto falta para a próxima) e, à direita, PRÓXIMA ONDA seguido de velocidade, reiniciar, pausa, tela cheia e som. A plaquinha e o chamado de onda vinham do canto de baixo: lá eles dividiam o bloco mais apertado do HUD e ficavam longe de tudo que responde "como vai a partida". O canto de baixo ficou só com as cartas e o painel do Guardião, que cresceu para ocupar o espaço.
- **Atalhos de teclado**: `1`–`5` escolhem a carta da vaga; `ESPAÇO` chama a próxima onda e, quando não há onda para chamar, alterna 1×/2× (uma tecla, dois momentos que nunca coexistem); `R` pede para reiniciar; `Enter` ou `R` de novo confirmam; `ESC` cancela a confirmação, desfaz a seleção ou abre a pausa, nessa ordem. A confirmação nasce **desarmada** por 600 ms (`ConfirmScreen`): o segundo `R` de um toque duplo é o mesmo gesto que abriu a pergunta, não a resposta dela.
- **Tela cheia**: quem vai para tela cheia é o `#game` inteiro (`scale.fullscreenTarget`), não o canvas. Sem isso o Phaser move só o canvas para um `<div>` próprio e a camada HTML fica de fora — era por isso que o jogo "travava" ao pausar e ao passar de fase em tela cheia: a gaveta e o painel de resultado estavam abertos (bloqueando o input, como toda tela modal) e invisíveis.
- **Celular**: no primeiro toque de um aparelho de toque o jogo pede tela cheia (`systems/immersive.ts`), que é a única forma de tirar a barra do navegador de cima do HUD em paisagem; desligável em Configurações (`immersiveMobile`). Em tela estreita o menu lateral e as abas do Álbum viram pictogramas de 44 px e o álbum passa a uma coluna só.
- **Registro do HUD**: `ui/UiRegistry.ts` guarda a posição de cada controle por nome (`pause`, `speed:2`, `card:first`, `upgrade:a`, ...). O tutorial usa para destacar e os testes e2e para achar um botão sem coordenada escrita à mão (`window.__grUi`).
- **Carga de arte**: o boot traz só a forma base dos nove Guardiões; as evoluções entram na `GameScene`, apenas para o esquadrão da partida.

## Guardiões

| Guardião | Posição | Papel | Ramo A | Ramo B |
| --- | --- | --- | --- | --- |
| Camarão-Pistola | plataforma | dano à distância | Perfuração (2 → 3 alvos, ricochete reto) | Dano Concentrado (34 → 50, área no impacto) |
| Água-viva | água livre | controle | Elétrico (salto, campo periódico) | Controle (slow forte, paralisia com imunidade) |
| Baiacu | correnteza, bloqueia | contenção | Fortaleza (2 → 3 presos, pausa chefes) | Pulso (25 → 40 em área, slow leve) |
| Caranguejo-Recife | correnteza, não bloqueia | corpo a corpo | Quebra-Casco (ignora armadura, vulnerabilidade) | Varredura (área, giro a cada 4 ataques) |
| Polvo-Tinteiro | plataforma | suporte | Tinta (vulnerabilidade em área, nuvem) | Maré Aliada (velocidade de ataque e alcance; não acumula) |
| Tubarão — Instinto Predador | margem da rota | execução (investida curta, prioriza pouca vida) | Frenesi (velocidade contra feridos; +% por ferido) | Caçador Alfa (marca chefe/elite: +30% de dano, acumula por golpe) |
| Tartaruga-Marinha — Guardiã do Recife | correnteza | controle de rota | Casco (segura 3 → 5 por tempo limitado, turbulência, Repulsa Ancestral) | Correnteza (zona de corrente contrária -25%, Corrente Forte empurra pela rota) |
| Peixe-Pedra — Emboscador da Corrente | borda da correnteza | emboscada recorrente: camufla, arma ao detectar, dá o bote em área com veneno e recomeça | Jardim Tóxico (Toxina Viva deixa nuvem que envenena e atrasa; Jardim Abissal espalha a toxina de quem morre nela) | Predador de Emboscada (Espinhos Cortantes trocam área por dano que ignora armadura; Caçador da Corrente trava o alvo forte e cobra pela vida máxima dele) |
| Golfinho — Mensageiro do Recife | água livre | suporte: pulso de sonar (revela, +5% dano recebido) | Coro (buff temporizado; +2% por espécie diferente; Coro II dá bônus temático) | Sonar (pulso maior, marca prioridade; Eco Perfeito coordena aliados) |

- Cada unidade escolhe **um** ramo no primeiro upgrade e só pode seguir nele (dois upgrades por unidade). O anel colorido sob o Guardião mostra o ramo e os marcadores mostram o nível. O painel de upgrade mostra sempre os dois ramos: o escolhido com o próximo passo e o outro marcado como **bloqueado**.
- As formas (base e quatro upgrades) são persistentes: o sprite só troca quando o upgrade é comprado; o idle apenas flutua.
- O HUD leva **cinco** Guardiões por partida. Até existir a tela de seleção, `?guardians=shark,sea-turtle,stonefish,dolphin,pistol-shrimp` escolhe o esquadrão (ids: `pistol-shrimp`, `jellyfish`, `pufferfish`, `reef-crab`, `ink-octopus`, `shark`, `sea-turtle`, `stonefish`, `dolphin`).

### Camada de controle

Slow, stun, knockback, bloqueio, marca, veneno e vulnerabilidade passam por `src/game/core/StatusEffects.ts` (contêiner central com regra de acúmulo por tipo), pela fachada `EnemyStatus.ts`, por `CrowdControl.ts`, `Blocking.ts` e `CurrentSystem.ts`. Elites e chefes têm retornos decrescentes configurados em `CROWD_CONTROL` (`balance.ts`): o primeiro controle forte vale 100%, o segundo 60%, o terceiro 30% e depois imunidade temporária. Knockback sempre desloca ao longo da rota; chefes nunca são empurrados (só sofrem slow). Posicionamento (correnteza, água, margem) está em `PLACEMENT` e `core/PlacementRules.ts`.
- **Vender** devolve 25% de tudo investido (custo base + upgrades) e libera a posição.
- Regra global do projétil do Camarão: um mesmo disparo nunca acerta o mesmo inimigo duas vezes.

## Inimigos

Peixinho (cardume), Peixe Invasor, Peixe-Flecha, Peixe-Agulha, Cascudo (armadura), Moreia Sombria (elite, resiste a controle) e Quebra-Marés (chefe, inverte a corrente, não pode ser bloqueado).

Cada inimigo é só dados (`ENEMIES` + `ENEMY_BALANCE`). Além dos números, a definição aceita `tags`, `resistances`, `immunities`, `art` e **habilidades** (`abilities`), despachadas por tipo em `core/EnemyAbilities.ts`: `regen`, `enrageBelowHp`, `shieldAllies`, `disruptGuardians`, `stealth`, `splitOnDeath`, `phaseChangeAtHp`, `speedBurst` e `reverseCurrents` (a inversão de corrente do Quebra-Marés). Nenhum código olha o id do inimigo.

### Elites e chefes

- **Elites** (`data/elites.ts`) são modificadores aplicáveis a qualquer inimigo: Blindado, Veloz, Regenerador, Furioso, Resistente e Camuflado. Uma onda pede elites com `elite: "swift"` (todos do grupo) ou `elite: [...] + elitePicks: [1, 3]` (só alguns). O id base não muda, então contagens, `enemyOverrides` e testes seguem valendo.
- **Chefes** declaram `boss: { phases: [...] }`: cada fase entra abaixo de uma fração de vida e pode mudar atributos, ganhar habilidades e anunciar a virada. Sem `boss`, um chefe tem uma fase só (é o caso do Quebra-Marés). O HUD mostra barra, nome e fase.

## Balanceamento

> **As suítes de balanceamento estão desligadas.** A chave é `BALANCE_SUITES_ON`, em `tests/balanceSwitch.ts`: hoje `false`, ela pula `balance-sim.test.ts`, `balance-lab.test.ts` e as 22 sondas de `e2e/balance.spec.ts`. Continuam rodando sempre `match-golden.test.ts` (congela o resultado de cada build e pega deriva do motor) e `balance.test.ts` (tabela de preços). Para voltar ao balanceamento, troque a constante para `true`.

Critério de vencibilidade: toda fase deve ser vencível perdendo poucas vidas com builds diversas, sem ficar fácil demais. Os roteiros de compra ficam em `tests/balance-builds.ts` (dois ou mais por fase) e são verificados de duas formas:

- `npm test` roda `tests/balance-sim.test.ts`, uma simulação headless da partida (`src/game/core/Simulation.ts`, que roda o MESMO motor da partida real, `src/game/core/match/Match.ts`, sem Phaser) que termina em segundos e imprime `[sim] … vidas X/20 · pérolas Y · vazou: …` por build. `tests/balance-lab.test.ts` imprime rota, cobertura de cada plataforma e vida/renda por onda de cada fase. `tests/match-golden.test.ts` congela o resultado exato de cada build em snapshot: qualquer refatoração precisa mantê-lo.
- `npm run test:balance` joga os mesmos roteiros no jogo real via Playwright (`tests/e2e/balance.spec.ts`), bem mais lento (cerca de 1h30 com 3 workers). Desde que cena e simulação passaram a rodar o mesmo motor em passo fixo, as vidas batem: na última rodada, 21 das 22 builds terminaram com exatamente as vidas previstas pela simulação (só uma ficou 1 vida abaixo). As pérolas sobram um pouco mais no jogo real, porque o roteiro leva alguns segundos para clicar cada compra.

A dificuldade da partida (`NORMAL`, `DIFÍCIL`, `ABISSAL` em `data/difficulty.ts`) é aplicada **antes** do motor por `resolveLevelForDifficulty`, que devolve uma fase nova com vida, velocidade, quantidade, recompensas, pérolas iniciais e sorteio de elites já resolvidos. `NORMAL` é identidade verificada por teste, então o balanceamento de referência não muda. Até existir a tela de preparação, `?difficulty=abissal` escolhe.

Cada fase controla sua dificuldade em `enemyScaling` (vida, velocidade, recompensa), `enemyOverrides` (ex.: chefe mais fraco) e na composição das ondas; a razão vida-total ÷ (pérolas iniciais + renda) sobe de ~2,7 na fase 1 para ~6,8 na fase 6; as rotas longas com laços (fases 2 e 3) compensam com mais inimigos, e as rotas curtas do naufrágio (fases 5 e 6) com plataformas mais próximas do canal.

Todos os números vivem em `src/game/data/balance.ts`: economia (pérolas iniciais, reembolso, bônus de onda e de fase), custos e habilidades dos Guardiões e a ficha de referência dos inimigos. `guardians.ts` e `enemies.ts` só adicionam nomes, cores e textos; as fases em `src/game/data/levels/` definem geometria e ondas.

## Arquitetura da partida

Uma partida inteira vive em `src/game/core/match/Match.ts`, sem Phaser:

- **Comandos** são a única porta de entrada: `placeGuardian`, `upgradeGuardian`, `sellGuardian`, `startNextWave` e os `debug.*`. Cada um devolve sucesso ou um motivo tipado (`insufficientPearls`, `branchLocked`, ...), que a cena traduz em mensagem.
- **Eventos de domínio** saem pelo `listener` (`MatchEvents.ts`): ondas, inimigos, Guardiões, projéteis, áreas, chefe, pérolas. A apresentação (`GameScene` + `systems/MatchEffects.ts`) cria e destrói as views e toca som a partir deles; regra nenhuma vive na cena.
- **Relógio**: `MatchClock` acumula o tempo real e roda `tick()` de passo fixo (60 Hz). Pausa é zero tick; 2× são dois ticks. O motor não conhece relógio de parede, o que mantém o caminho aberto para replay e coop.
- **Jogadores**: todo comando carrega `playerId` e cada Guardião guarda o `ownerId` de quem o colocou. `economyMode` escolhe entre um caixa para a mesa (`shared`, o padrão de hoje) e um por jogador (`individual`), e `snapshot(playerId)` devolve a visão de cada um. É o que falta ligar quando houver rede; as regras já não dependem de quem está na frente da tela.
- **Economia**: `Economy` guarda um razão por fonte (`EnemyReward`, `WaveReward`, `LevelReward`, `GuardianGeneration`, `MapReward`, `SpecialReward`, `EarlyWaveBonus`, `SellRefund`) e por destino (`Place`, `Upgrade`), que alimenta `MatchStats`.
- **Estatísticas**: `MatchStats` acompanha abates, vazamentos, dano por Guardião e por causa, colocações, upgrades, ondas, tempo e pérolas — base das telas de resultado e das conquistas.
- **Progressão**: `core/save/SaveManager.ts` guarda o documento permanente (versão 2, com migração da chave antiga), separado do estado da partida.

`?difficulty=`, `?level=`, `?guardians=`, `?debug=1` e `?debug=1&wave=N` continuam funcionando como atalhos.

## Debug

- `F2`: abre ou fecha o modo debug.
- `?debug=1`: inicia com debug e disponibiliza o botão para dispositivos touch. Em build de produção, F2 só funciona com `?debug=1`.
- `?screen=map`: abre direto no Mapa do Recife, pulando o Meu Recife.
- O painel permite alternar rota, alcance, hitboxes, corrente, estados, alvos e áreas de posicionamento separadamente.
- Ações do painel: +100 pérolas, spawn de inimigo, spawn de elite, pular onda, matar todos e invencibilidade. Elas viram comandos do motor e marcam a partida como testada (`MatchStats.cheated`), para não render progressão.

## Organização

- `src/game/data`: balanceamento, catálogo de Guardiões e inimigos, registro de fases.
- `src/game/core`: regras puras e testáveis (rota, correntes, economia com razão de fontes, ondas, árvore de upgrades, projétil, status, auras, alvo e formas de alcance, habilidades de inimigo, encontro de chefe).
- `src/game/core/match`: o motor único da partida (`Match`): estado, `tick()` de passo fixo, comandos (`placeGuardian`, `upgradeGuardian`, `sellGuardian`, `startNextWave`), eventos de domínio, `MatchStats`, `MatchClock` (pause e velocidade). Cena e simulação de balanceamento rodam o mesmo motor.
- `src/game/core/account`: contas locais (`AccountStore`, `passwords`) — nome único, senha derivada, um save por conta e o código de transferência — e a conta na nuvem (`CloudAccount`, `supabase`), com o cliente HTTP próprio. Puro: armazenamento e `fetch` entram por injeção ou pelo ambiente.
- `src/game/core/save`: progressão permanente versionada (`PlayerProgress`, `SaveManager`, migrações); nunca se mistura com o estado da partida.
- `src/game/objects`: views Phaser (`EnemyView`, `GuardianView`, `ProjectileView`, áreas) que só desenham o que o motor diz.
- `src/game/scenes`: carregamento, hub (`HubScene`), menu de fases, apresentação da partida (`GameScene`) e HUD.
- `src/game/core/reef`: as regras do hub, puras e sem Phaser — crescimento do Recife (`growth.ts`), plantio determinístico (`planting.ts`), comportamento das criaturas (`ReefInhabitant`/`ReefLife`), patente e a costura da moeda (`economy.ts`, ainda sem loja).
- `src/game/data/reef`: catálogo de decoração, layout do Recife (lugares, canteiros, zonas — tudo em % 0–100) e o comportamento de hub de cada Guardião.
- `src/game/assets/reefArt.ts`: chaves e caminhos da arte do Recife. Nada disso entra no boot — a cena pede o fundo e só as peças que estão plantadas.
- `public/assets/reef/`: o fundo pintado e as 18 decorações, fatiadas das folhas por `scripts/slice-reef-sheet.py`.
- `src/game/systems`: `MatchEffects` (evento → efeito/som/mensagem), áudio provisório, overlay de debug, fundo procedural, `ProgressStore`, `accounts` (registro de contas da página), `session` (entrar/sair reabre o save), `settings` e `story`.
- `src/game/ui/dom`: camada de telas em HTML (`ScreenHost`, `h`, `ui.css`) e as telas de preparação, resultado, álbum (com as abas em `screens/album/`), bestiário, histórias, conta, configurações, confirmação e pause.
- `src/game/core/progression`: objetivos (e o trio por dificuldade em `levelObjectives.ts`), estrelas por trilha, recompensas, desbloqueios e o `ProgressionService` que aplica o resultado de uma partida.
- `supabase/schema.sql`: o banco da conta na nuvem — perfis, saves, RLS e as duas RPCs. Roda uma vez no SQL Editor do projeto.

## Como estender

- Novo Guardião: entrada em `GUARDIAN_BALANCE`, em `GUARDIANS`, no tipo `GuardianId`, em `GUARDIAN_ORDER` e em `GUARDIAN_ART` (`assets/guardianArt.ts`, com `assetFolder`/`abilityFile` se as pastas seguirem outro nome); mecânicas novas entram como campos de `GuardianUpgrade` resolvidos em `GuardianStats.ts` e como funções em `core/GuardianBehaviors.ts` ou nos sistemas de `core/match/systems`; o visual reage aos eventos em `systems/MatchEffects.ts`. Pastas de arte: `public/assets/guardians/<pasta>/<forma>/{idle,attack,ability,impact}.png`.
- Regra nova de partida: sempre no motor (`core/match`), nunca na cena. Emita um evento em `MatchEvents.ts` se a apresentação precisar reagir.
- Novo inimigo: entrada em `ENEMY_BALANCE`, em `ENEMIES`, no tipo `EnemyId` e, se tiver mecânica, uma entrada em `abilities` (um tipo novo vira um handler em `core/EnemyAbilities.ts`). O desenho vem de `art` (forma vetorial ou pasta de sprites).
- Novo elite: uma entrada em `ELITE_BALANCE` e outra em `ELITES`. Ele já pode ser usado em qualquer onda e aparece no preview.
- Guardião que rende pérolas (Ostra): basta declarar `generatesPearls: { amount, intervalMs }` na definição ou em um upgrade.
- Texto de coleção/bestiário: uma entrada em `data/guardianLore.ts` ou `data/enemyLore.ts` (`tests/lore.test.ts` cobra a ficha de todo conteúdo novo).
- Novo Encontro: uma fase em `data/encounters/`, a entrada em `ENCOUNTERS` e a condição `encounterCompleted` no Guardião. `tests/encounters.test.ts` valida rota, plataformas, ondas e o aliado prometido.
- Nova história: uma entrada em `data/story.ts` com o gatilho (`levelIntro`, `levelOutro` ou `manual`); o save guarda só os ids lidos.
- Nova conquista: uma entrada em `ACHIEVEMENTS` com a medida e a meta; a avaliação e a tela se viram sozinhas.
- Nova seção no menu lateral: um id em `ShellSection`, a ação em `ShellNav` (e nos `fallbackNav` das telas que abrem sozinhas), o item em `ITEMS` (`ui/dom/shell.ts`) e as entradas de `BACKDROPS`, `NAV_PREFIX` e `BACK_ID` em `ui/dom/sections.ts` — o TypeScript cobra cada uma delas.
- Nova configuração: campo em `PlayerSettings`, padrão em `DEFAULT_SETTINGS`, saneamento em `sanitizeProgress` e a linha na tela de configurações.
- Guardião novo no Meu Recife: uma entrada em `HUB_BEHAVIORS` (`data/reef/hubBehaviors.ts`) e nada mais — a cena só faz `residents.map(hubBehavior)`, e quem esquecer de cadastrar ganha o comportamento padrão em vez de derrubar o hub.
- Nova decoração do Recife: uma entrada em `DECORATIONS` (`data/reef/decorations.ts`) com a condição de liberação (a mesma união `UnlockCondition` dos Guardiões) e os tipos de canteiro que a aceitam. A arte é declarada: `{ type: "sprite", key, path }` aponta para `public/assets/reef/<id>.png`, e `{ type: "vector", layers }` deixa a peça nascer desenhada com formas do Phaser enquanto o PNG não existe — só o renderizador lê `art`, então a troca é uma linha. Um canteiro novo entra em `REEF_SLOTS` com o `order` seguinte (a fila precisa ficar sem buraco) e **não pode tapar um lugar pintado** — a área proibida é o `keepOut` do lugar, que é o que ele OCUPA na arte, bem maior que o `radius` do alvo de clique. `tests/reef-catalog.test.ts` cobra as duas coisas, já contando o sorteio de ±15% no tamanho.
- Mover um canteiro: pode. A posição no save é sempre re-ancorada ao canteiro na entrada do hub (`reconcileReef`), então o Recife de quem já jogou acompanha a mudança em vez de ficar com as peças paradas no lugar antigo. Peça cujo canteiro sumiu do layout é retirada de cena (a posse continua).
- Arte nova do Recife: as folhas vêm em 3×2 células de 512px; ajuste `SHEETS` em `scripts/slice-reef-sheet.py` (a faixa `top`/`bottom` de cada linha recorta o rótulo fora) e rode `python scripts/slice-reef-sheet.py`. Os ids são os nomes dos arquivos.
- Campo novo no save: além do tipo, ele PRECISA ser reconstruído em `sanitizeProgress` — a função monta o documento campo a campo, e o que ela não conhece é apagado na gravação seguinte, sem erro nenhum.
- Nova fase: arquivo em `src/game/data/levels/` e inclusão em `LEVELS`; os testes em `tests/levels.test.ts` validam rota, plataformas, correntes e ondas automaticamente.
