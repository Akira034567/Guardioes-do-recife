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
```

Abra `http://localhost:5173`. O jogo usa mouse e touch em layout horizontal 16:9.

## Fases e progressão

- O jogo abre no menu de fases. Concluir uma fase libera a seguinte; o progresso fica no `localStorage`.
- `?level=recife-3` abre uma fase diretamente (útil para testes e balanceamento).
- Fase 1 usa o fundo pintado; as demais desenham um fundo procedural a partir da rota, plataformas e correntes.
- Cada fase define rota, plataformas, correntes, pérolas iniciais, escala de inimigos e composição de ondas.

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

Slow, stun, knockback, bloqueio, marca, veneno e vulnerabilidade passam por `src/game/core/CrowdControl.ts`, `EnemyStatus.ts`, `Blocking.ts` e `FlowField.ts`, usados igualmente pela cena e pela simulação. Elites e chefes têm retornos decrescentes configurados em `CROWD_CONTROL` (`balance.ts`): o primeiro controle forte vale 100%, o segundo 60%, o terceiro 30% e depois imunidade temporária. Knockback sempre desloca ao longo da rota; chefes nunca são empurrados (só sofrem slow). Posicionamento (correnteza, água, margem) está em `PLACEMENT` e `core/PlacementRules.ts`.
- **Vender** devolve 25% de tudo investido (custo base + upgrades) e libera a posição.
- Regra global do projétil do Camarão: um mesmo disparo nunca acerta o mesmo inimigo duas vezes.

## Inimigos

Peixinho (cardume), Peixe Invasor, Peixe-Flecha, Peixe-Agulha, Cascudo (armadura), Moreia Sombria (elite, resiste a controle) e Quebra-Marés (chefe, inverte a corrente, não pode ser bloqueado).

## Balanceamento

Critério de vencibilidade: toda fase deve ser vencível perdendo poucas vidas com builds diversas, sem ficar fácil demais. Os roteiros de compra ficam em `tests/balance-builds.ts` (dois ou mais por fase) e são verificados de duas formas:

- `npm test` roda `tests/balance-sim.test.ts`, uma simulação headless da partida (`src/game/core/Simulation.ts`, mesmas regras da `GameScene`, sem Phaser) que termina em segundos e imprime `[sim] … vidas X/20 · pérolas Y · vazou: …` por build. `tests/balance-lab.test.ts` imprime rota, cobertura de cada plataforma e vida/renda por onda de cada fase.
- `npm run test:balance` joga os mesmos roteiros no jogo real via Playwright (`tests/e2e/balance.spec.ts`), mais lento; a simulação tende a ser 2 a 4 vidas mais otimista que a partida real.

Cada fase controla sua dificuldade em `enemyScaling` (vida, velocidade, recompensa), `enemyOverrides` (ex.: chefe mais fraco) e na composição das ondas; a razão vida-total ÷ (pérolas iniciais + renda) sobe de ~2,7 na fase 1 para ~6,8 na fase 6; as rotas longas com laços (fases 2 e 3) compensam com mais inimigos, e as rotas curtas do naufrágio (fases 5 e 6) com plataformas mais próximas do canal.

Todos os números vivem em `src/game/data/balance.ts`: economia (pérolas iniciais, reembolso, bônus de onda e de fase), custos e habilidades dos Guardiões e a ficha de referência dos inimigos. `guardians.ts` e `enemies.ts` só adicionam nomes, cores e textos; as fases em `src/game/data/levels/` definem geometria e ondas.

## Debug

- `F2`: abre ou fecha o modo debug.
- `?debug=1`: inicia com debug e disponibiliza o botão para dispositivos touch.
- O painel permite alternar rota, alcance, hitboxes, corrente, estados, alvos e áreas de posicionamento separadamente.

## Organização

- `src/game/data`: balanceamento, catálogo de Guardiões e inimigos, registro de fases.
- `src/game/core`: simulação pura e testável (rota, corrente, economia, ondas, árvore de upgrades, projétil, status de inimigos, auras, progresso).
- `src/game/objects`: representações Phaser substituíveis pelos sprites finais.
- `src/game/scenes`: carregamento, menu de fases, gameplay e HUD.
- `src/game/systems`: áudio provisório, overlay de debug, fundo procedural e persistência de progresso.

## Como estender

- Novo Guardião: entrada em `GUARDIAN_BALANCE`, em `GUARDIANS`, no tipo `GuardianId`, em `GUARDIAN_ORDER` e em `GUARDIAN_ART` (`assets/guardianArt.ts`, com `assetFolder`/`abilityFile` se as pastas seguirem outro nome); mecânicas novas entram como campos de `GuardianUpgrade` resolvidos em `GuardianStats.ts` e como funções em `core/GuardianBehaviors.ts`, para que cena e simulação compartilhem a lógica. Pastas de arte: `public/assets/guardians/<pasta>/<forma>/{idle,attack,ability,impact}.png`.
- Novo inimigo: entrada em `ENEMY_BALANCE`, em `ENEMIES`, no tipo `EnemyId` (e um desenho em `Enemy.drawBody`, opcional).
- Nova fase: arquivo em `src/game/data/levels/` e inclusão em `LEVELS`; os testes em `tests/levels.test.ts` validam rota, plataformas, correntes e ondas automaticamente.
