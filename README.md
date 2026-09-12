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

- **Conquistas** (`data/achievements.ts` + `core/progression/achievements.ts`): dezesseis medidas sobre o perfil, a coleção e a melhor marca de uma partida. O progresso nunca regride, cada uma paga Conchas uma vez e as escondidas ficam em "???" até caírem. São recalculadas no fim de cada partida e ao abrir o mapa.
- **Desafios** (`core/progression/challenges.ts`): um do dia e um da semana, sorteados a partir da data com a semente do `Rng` — sem servidor, sem rede. O sorteio só usa fases e Guardiões que o jogador já alcançou; a preparação entra travada, com esquadrão e dificuldade fixos, e a recompensa cai ao cumprir a regra extra.

## Áudio

Não há arquivo de áudio no projeto: tudo é sintetizado com osciladores em `systems/AudioManager.ts`. Dois barramentos sob o volume geral, efeitos e música, ambos ligados às configurações. A trilha (`systems/audio/MusicBed.ts`) é um acorde grave com respiro lento que muda de clima quando o chefe chega e quando a fase é vencida. Trocar por samples depois é mexer só nessa camada; as regras nunca chamam áudio, quem toca é `systems/MatchEffects.ts`.

## Telas fora da partida

Menus são HTML por cima do canvas (`src/game/ui/dom`), alinhados ao jogo e escalados por `--gr-scale`; o HUD da partida continua em Phaser.

- **Álbum do Recife**: uma carta por Guardião. Bloqueado vira silhueta com "???" e a pista de onde encontrá-lo; encontrado abre ficha com história, números, carreira e as duas árvores de evolução.
- **Ameaças do Recife**: bestiário. O inimigo só aparece depois do primeiro encontro, com vida, velocidade, fraquezas, resistências e habilidades; chefes ganham página destacada.
- **Histórias do Recife**: índice dos capítulos já vividos, com releitura.
- **Configurações**: volumes, silenciar, efeitos reduzidos, tremor de tela e escala da interface. Tudo grava no save na hora.
- **Mapa do Recife**: a tela inicial. As seis fases em sequência, com estrelas, e os nós de Encontro pendurados nelas; daqui saem o álbum, o bestiário, as histórias e as configurações.
- **Menu de pause**: o botão Ⅱ pausa e abre continuar, configurações, reiniciar e sair para o mapa.
- **Conquistas do Recife**: a lista com barra de progresso, o que já caiu e o que falta.

## UX da partida

- **Posicionamento**: a carta escolhida mostra a criatura em transparência sob o cursor, com o alcance na forma certa, o custo e o motivo quando a posição não vale. ESC ou o botão direito cancelam.
- **Painel de contexto**: sem unidade selecionada, o painel de baixo vira a ficha da carta escolhida (papel, ataque, alcance, custo e para onde vão as duas evoluções). Com unidade selecionada, mostra a árvore, os dois botões de ramo e a venda. O retrato flutuante sobre o mapa saiu de cena.
- **Números de dano**: `core/DamageAggregator.ts` soma os acertos de um mesmo alvo numa janela curta e `systems/FloatingTextPool.ts` reaproveita os textos. Golpe forte sai maior; veneno e área têm cor própria; a recompensa da morte sobe em dourado. Desligável nas configurações.
- **Tutorial**: `core/tutorial/TutorialDirector.ts` decide o passo (lógica pura, testada) e a `UIScene` desenha uma faixa acima das cartas com contorno no botão citado. Nada bloqueia o jogo, PULAR encerra de vez e `?tutorial=0` desliga.
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
| Peixe-Pedra — Emboscador do Recife | correnteza (armadilha) | armadilha: enterra em 3 s, dispara ao ser pisado, carrega até +25% | Veneno (veneno por tempo, Jardim Tóxico) | Emboscada (stun em área, Fúria Abissal espera 3 inimigos e empurra) |
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
- O painel permite alternar rota, alcance, hitboxes, corrente, estados, alvos e áreas de posicionamento separadamente.
- Ações do painel: +100 pérolas, spawn de inimigo, spawn de elite, pular onda, matar todos e invencibilidade. Elas viram comandos do motor e marcam a partida como testada (`MatchStats.cheated`), para não render progressão.

## Organização

- `src/game/data`: balanceamento, catálogo de Guardiões e inimigos, registro de fases.
- `src/game/core`: regras puras e testáveis (rota, correntes, economia com razão de fontes, ondas, árvore de upgrades, projétil, status, auras, alvo e formas de alcance, habilidades de inimigo, encontro de chefe).
- `src/game/core/match`: o motor único da partida (`Match`): estado, `tick()` de passo fixo, comandos (`placeGuardian`, `upgradeGuardian`, `sellGuardian`, `startNextWave`), eventos de domínio, `MatchStats`, `MatchClock` (pause e velocidade). Cena e simulação de balanceamento rodam o mesmo motor.
- `src/game/core/save`: progressão permanente versionada (`PlayerProgress`, `SaveManager`, migrações); nunca se mistura com o estado da partida.
- `src/game/objects`: views Phaser (`EnemyView`, `GuardianView`, `ProjectileView`, áreas) que só desenham o que o motor diz.
- `src/game/scenes`: carregamento, menu de fases, apresentação da partida (`GameScene`) e HUD.
- `src/game/systems`: `MatchEffects` (evento → efeito/som/mensagem), áudio provisório, overlay de debug, fundo procedural, `ProgressStore`, `settings` e `story`.
- `src/game/ui/dom`: camada de telas em HTML (`ScreenHost`, `h`, `ui.css`) e as telas de preparação, resultado, coleção, bestiário, histórias, configurações e pause.
- `src/game/core/progression`: objetivos, estrelas, recompensas, desbloqueios e o `ProgressionService` que aplica o resultado de uma partida.

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
- Nova configuração: campo em `PlayerSettings`, padrão em `DEFAULT_SETTINGS`, saneamento em `sanitizeProgress` e a linha na tela de configurações.
- Nova fase: arquivo em `src/game/data/levels/` e inclusão em `LEVELS`; os testes em `tests/levels.test.ts` validam rota, plataformas, correntes e ondas automaticamente.
