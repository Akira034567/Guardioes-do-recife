# Guardiões do Recife — rodada de expansão e rebalanceamento

## 0. Regras da tarefa (leia antes de escrever qualquer linha)

1. **Analise a implementação atual antes de mexer em qualquer coisa.** O ponto único de balanceamento é `src/game/data/balance.ts`; `guardians.ts` e `enemies.ts` só embrulham esses números com nome, cor e texto; as fases em `src/game/data/levels/` definem geometria e composição de ondas.
2. **Não faça simplificações aleatórias.** Se um sistema parece redundante, deixe como está e reporte no relatório.
3. **Não invente mecânicas novas** além do que está descrito aqui.
4. **Não assuma números fora dos definidos aqui.** Onde este documento dá uma faixa, ela é alvo inicial de teste, não valor final.
5. **Mantenha a identidade de cada Guardião.** Camarão é DPS puro; Água-viva é controle; Baiacu é contenção; Caranguejo é brawler de rota; Polvo é debuff/aura; Tubarão é execução; Tartaruga é controle de rota; Peixe-Pedra é armadilha; Golfinho é suporte. Nenhum deles deve sair desta rodada virando outra coisa.

---

## 1. Estado atual (medido no repositório, use como base)

### Ondas e volume por fase

| Fase | Nome | Ondas hoje | Inimigos somados | Mult. de vida | Pérolas iniciais | Vida do chefe (base → campo) |
|---|---|---|---|---|---|---|
| recife-1 | Recife Costeiro | 5 | 41 | 0,75 | 180 | 400 → 300 |
| recife-2 | Canal das Algas | 6 | 87 | 0,90 | 200 | 528 → 475 |
| recife-3 | Três Redemoinhos | 7 | 135 | 0,95 | 230 | 684 → 650 |
| recife-4 | Espiral de Coral | 7 | 107 | 0,95 | 320 | 842 → 800 |
| recife-5 | Naufrágio do Galeão | 8 | 119 | 0,95 | 360 | 1053 → 1000 |
| recife-6 | Coração do Recife | 9 | 141 | 1,00 | 420 | 1300 → 1300 |

### Vida base dos inimigos (`ENEMY_BALANCE`)

`minnow` 18 · `swimmer` 55 · `dartfish` 35 · `needlefish` 45 · `ghostJelly` 60 · `shellback` 130 · `moray` 250 · `corruptedShark` 320 · `tidebreaker` 550 (sobrescrito por fase).

### Regras que não podem ser quebradas por acidente

- **Armadura é percentual:** `redução = armadura / (armadura + 16)` (`src/game/core/Combat.ts`). Não volte para subtração.
- **Vulnerabilidade não soma:** vale sempre a maior, teto `×1,30`.
- **Auras não acumulam:** vale a melhor fonte por atributo (`src/game/core/Auras.ts`).
- **Upgrades substituem, não somam:** o último valor definido vence (`resolveLast` em `src/game/core/UpgradeTree.ts`). Só `rangeMultiplier` e `projectileSpeedMultiplier` são multiplicativos.
- **Árvore:** 2 ramos × 2 níveis, escolha definitiva. Não existe nível 3.

### Testes

`tests/balanceSwitch.ts` tem `BALANCE_SUITES_ON = false`, o que pula `balance-sim.test.ts`, `balance-lab.test.ts` e `e2e/balance.spec.ts`. **Para esta tarefa você está autorizado a ligar essa chave**, rodar as suítes e deixá-la ligada até entregar o relatório. Diga explicitamente no relatório em que estado ela ficou.

Sempre valem, independentemente da chave: `match-golden.test.ts` (congela o resultado exato de cada build — é a rede de segurança de qualquer refatoração do motor) e `balance.test.ts` (confere a tabela de preços e números acordados). Os dois vão quebrar de propósito com as mudanças abaixo: **atualize os valores esperados, não afrouxe as asserções.**

---

## 2. Trabalho a fazer

### 2.1 Fases mais longas

Aumente a duração das fases. Hoje são 5 a 9 ondas. Passe para uma curva na linha de **7 / 10 / 12 / 15 / 18 ondas**, distribuídas de forma balanceada — sem encher com ondas de enchimento iguais entre si, e sem empurrar toda a dificuldade para o fim. **A economia tem que acompanhar:** pérolas iniciais, recompensa por abate e bônus por onda precisam sustentar uma partida mais longa sem virar sobra de pérolas no fim nem travar o jogador no meio.

### 2.2 Mais inimigos e mais vida por onda

Aumente a quantidade de inimigos por onda e o HP deles, **especialmente nas fases médias e finais**, para criar situações mais densas. Fase 1 continua sendo introdução.

### 2.3 Curva de vida dos inimigos

- **Peixinho (`minnow`) continua frágil.** Ele deve morrer para um AoE grande. Não mexa nele para cima.
- **Inimigos intermediários precisam de mais vida.** O Peixe Invasor (`swimmer`) não pode sumir com um único Giro de Carapaça do Caranguejo: mire em **2 a 3 ataques relevantes** para derrubá-lo.
- A partir daí, **suba gradualmente** os inimigos seguintes mantendo a ordem de ameaça atual.

### 2.4 DPS principais: não nerfar (uma exceção)

Mantenha **Camarão, Caranguejo e Tubarão como estão** — a ideia é testá-los contra os inimigos mais resistentes antes de qualquer ajuste.

**Única exceção — Caranguejo ramo B nível 2 (Giro de Carapaça):** o giro passa a ativar **a cada 4 ataques**, não 3. Em `balance.ts`, `"reef-crab".sweep.level2.spin.everyAttacks: 3 → 4`. Efeito: dano médio por ataque cai de 37,3 para 35,0, e o DPS de 29,9 para 28,0. Atualize também o texto do upgrade em `guardians.ts`, que hoje é gerado a partir desse número.

### 2.5 Guardiões de utilidade: subir o dano moderadamente

**Alvos iniciais para teste, não números finais.** Ajuste, meça e proponha o valor final no relatório.

| Guardião | Dano hoje | Alvo inicial |
|---|---|---|
| Água-viva — ramo Controle (`control.level1/level2.damage`) | 14 | **18–19** |
| Polvo-Tinteiro (base 12, `ink.level1.damage` 15) | 12 / 15 | **11–14** |
| Tartaruga-Marinha (base) | 8 | **10–13** |
| Golfinho (base) | 9 | **10–12** |

Subir dano aqui não pode transformar nenhum deles em fonte de DPS: a identidade continua sendo controle, debuff, controle de rota e suporte.

### 2.6 Peixe-Pedra B2: corrigir a lógica de espera

**Não redesenhe o Peixe-Pedra ainda.** Só corrija o gatilho do `ambush.level2` (Fúria Abissal).

Hoje: `waitFor: { count: 2, maxWaitMs: 2000 }` — ele espera 2 inimigos, com timeout de 2s.

Novo comportamento: **janela curta de ~500 ms.** Quando o primeiro inimigo entra no raio de gatilho, abre uma janela de 0,5s. Se mais inimigos entrarem nessa janela, ele detona na hora. Se a janela fechar sem mais ninguém, ele detona no primeiro inimigo mesmo.

> **Ponto de decisão:** há duas leituras possíveis de "se mais inimigos entrarem, detona na hora" — (a) detona no instante em que o segundo inimigo entra, ou (b) espera a janela inteira e detona pegando todos. Implemente (a), que é a leitura literal, e **registre no relatório** qual escolheu e a diferença medida entre as duas.

### 2.7 Peixe-Pedra: testar depois de tudo

Depois das mudanças acima, teste o Peixe-Pedra em cenários com **mais congestionamento e sinergias**. Se ainda ficar ruim, **reporte** — o redesenho fica para depois, não faça nesta rodada.

### 2.8 Maestria permanente por Guardião (só a estrutura)

Adicione um sistema de **maestria permanente por Guardião no menu**, com **moeda global ganha fora da partida**, dando **pequenos bônus percentuais** e terminando em **um nó final mecânico temático** por Guardião. Números controlados: isto não pode quebrar o jogo.

**Nesta entrega, implemente apenas a estrutura:** moeda, persistência no save, tela/menu, árvore de nós, e os bônus percentuais pequenos. **O nó final mecânico de cada Guardião fica sem efeito definido** — deixe o ponto de extensão pronto e documentado. As propostas de efeito serão revisadas antes de existirem.

### 2.9 Peixinho Dourado (só a estrutura)

Buff **único por partida**: o jogador escolhe **uma unidade específica já colocada no mapa** e ela recebe uma **amplificação grande de stats e efeitos que já existem** naquele Guardião — só naquela run.

- **Não replique o efeito do nó final da maestria.** São sistemas separados e devem continuar separados no código.
- Amplifica o que já existe; não adiciona mecânica nova.
- **Nesta entrega, só a estrutura**: seleção da unidade, marcação de "dourado" no estado da partida, ponto de aplicação dos multiplicadores. **Os valores finais de amplificação ficam indefinidos** e serão revisados antes.

### 2.10 Baiacu: orientação do sprite (só visual)

O Baiacu não vira para o inimigo que está bloqueando. **Correção puramente visual, nada de balanceamento.**

Causa provável: em `src/game/objects/GuardianView.ts`, o `aimTarget` (linha ~121) só é definido a partir de `guardian.targetId`. O Baiacu base tem `damage: 0` → `canAttack: false`, então nunca adquire alvo de ataque e nunca gira. Os inimigos que ele segura são rastreados à parte, em `src/game/core/Blocking.ts`. A correção é fazer um bloqueador virar para o inimigo que está segurando quando não tem alvo de ataque.

### 2.11 Inimigos bloqueados na frente do bloqueador (só visual)

Enquanto estão sendo bloqueados, os inimigos devem aparecer **na frente do Baiacu e da Tartaruga**, não atrás. Hoje `DEPTH.enemies = 30` e `DEPTH.guardians = 40` (`src/game/constants.ts`), então o bloqueado sempre fica por baixo. Suba a profundidade do inimigo enquanto ele estiver preso e devolva ao normal quando for solto. Não mexa nas outras camadas.

### 2.12 Baleia: amplificar a corrente, não inverter

O chefe Quebra-Marés hoje **inverte** a corrente do recife em ciclos (`abilities: [{ type: "reverseCurrents" }]`, tratado em `src/game/core/EnemyAbilities.ts` a partir da linha ~97, aplicado em `src/game/core/CurrentSystem.ts` e `CurrentField.ts`).

Novo comportamento: em vez de inverter, ela **amplifica a corrente natural do mapa** — as zonas de corrente declaradas pela fase. **Não pode afetar as correntes criadas pela Tartaruga nem por qualquer outro Guardião.** Garanta essa separação no código, não só por convenção: correntes de fase e campos de fluxo de Guardião precisam ser distinguíveis na hora de aplicar a amplificação.

Mantenha os ciclos de `BOSS_CURRENT` (`cycleMs: 6500`, `reverseMs: 3000`) como ritmo, renomeando o que fizer sentido. **A intensidade da amplificação é um número novo — proponha um valor, marque como placeholder e reporte.**

---

## 3. Testes e entrega

Rode os testes de balanceamento e **crie testes novos onde os atuais não cobrirem** as mudanças (contagem de ondas por fase, curva de HP, gatilho do Peixe-Pedra, separação corrente-de-fase × corrente-de-Guardião, orientação e profundidade dos bloqueados).

Entregue um **relatório** com:

1. Tudo que mudou, com **valor antigo e valor novo**, item a item.
2. **Total de ondas e HP total por fase**, antes e depois.
3. **Resultados dos testes**, incluindo os que falharam.
4. **Pontos que exigem decisão de design**, listados separadamente.
5. Estado final de `BALANCE_SUITES_ON`.

**Não esconda falhas de teste.** Se alguma composição de esquadrão quebrar o jogo, ou alguma fase ficar inviável, **reporte claramente antes de tentar compensar com mudanças grandes** — a decisão sobre como compensar é de design, não sua.
