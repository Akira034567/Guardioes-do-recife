/**
 * PONTO ÚNICO DE BALANCEAMENTO.
 *
 * Todos os números de economia, Guardiões e inimigos vivem aqui. Os arquivos
 * `guardians.ts` e `enemies.ts` apenas embrulham estes valores com nomes, cores e
 * textos; as fases em `levels/` definem geometria e composição de ondas.
 * Ajuste aqui e o jogo, o HUD e os testes de contrato seguem juntos.
 *
 * ---------------------------------------------------------------------------
 * V2 (balanceamento dos Guardiões). O que mudou de princípio:
 *
 * 1. Armadura virou redução PERCENTUAL (`core/Combat.ts`): `1 − armadura/(armadura+16)`. Some o
 *    piso de 1 e some a punição desproporcional a golpes fracos. Como a escala mudou, os valores de
 *    armadura foram reescritos para manter a MESMA sensação de "blindado" (Cascudo 4 → 9 = 36%).
 * 2. Cada Guardião tem uma função e é medido por VALOR POR PÉROLA na função dele, não por DPS.
 *    Só o Camarão é DPS puro; ele é a régua com que os outros se comparam.
 * 3. Controle precisa segurar de verdade: lentidão e zonas passaram a ter uptime alto o bastante
 *    para mudar o resultado de uma onda, não só a animação.
 */

export const ECONOMY = {
  /** Pérolas iniciais padrão (cada fase pode sobrescrever em `startingPearls`). */
  startingPearls: 180,
  /** Vidas do Recife. */
  reefHealth: 20,
  /** Fração do valor investido (custo base + upgrades) devolvida na venda. */
  sellRefundRate: 0.25,
  /** Bônus ao limpar uma onda. */
  waveClearBonus: 25,
  /** Bônus ao concluir uma fase. */
  levelClearBonus: 75,
  /** Pérolas por segundo de preparação poupado ao chamar a onda antes da hora (0 = desligado). */
  earlyStartBonusPerSecond: 0,
} as const;

/**
 * Janela de animação dos Guardiões (item 15). São números de APRESENTAÇÃO: nenhum deles entra em
 * dano, alcance ou cooldown. 🔶 placeholders.
 *
 * `maxCycleFraction` é o que garante o repouso: a sequência golpe+recuperação nunca ocupa mais que
 * essa fração do cooldown, então sempre sobra tempo visível em `idle`, por mais rápido que o
 * Guardião ataque.
 */
export const GUARDIAN_VISUAL = {
  maxWindupMs: 200,
  maxAttackMs: 360,
  maxRecoveryMs: 240,
  maxCycleFraction: 0.6,
  abilityMs: 420,
} as const;

export const GUARDIAN_BALANCE = {
  /** Camarão-Pistola — DPS puro. Nenhuma utilidade: é a régua de pérola por dano do jogo. */
  "pistol-shrimp": {
    cost: 80,
    upgradeCosts: [70, 130] as const,
    range: 190,
    damage: 24,
    cooldownMs: 1100,
    projectileSpeed: 460,
    /** Alcance máximo para ricochetear até um novo alvo depois de atravessar um inimigo. */
    ricochetRange: 260,
    pierce: {
      level1: { pierceDamages: [24, 18] },
      level2: { pierceDamages: [26, 21, 16] },
    },
    heavy: {
      level1: { damage: 44, cooldownMs: 1300 },
      level2: { damage: 72, cooldownMs: 1400, splash: { radius: 58, damageMultiplier: 0.5 } },
    },
  },
  /** Água-viva — dano distribuído + controle. Nunca ganha de um DPS no alvo único; ganha no conjunto. */
  jellyfish: {
    cost: 90,
    upgradeCosts: [80, 135] as const,
    range: 170,
    damage: 12,
    cooldownMs: 950,
    slowFactor: 0.7,
    slowDurationMs: 1600,
    electric: {
      level1: { chainDamages: [14, 11, 9] },
      level2: {
        radius: 84,
        durationMs: 3200,
        cooldownMs: 5200,
        pulseIntervalMs: 450,
        damage: 8,
        maxDamagePerTarget: 56,
        slowFactor: 0.62,
        slowDurationMs: 800,
      },
    },
    control: {
      level1: { damage: 18, slowFactor: 0.45, slowDurationMs: 2200 },
      /** Stun curto com imunidade interna: 900ms a cada 3s no mesmo alvo, e nunca encadeia. */
      level2: { damage: 18, stun: { durationMs: 900, immunityMs: 3000 } },
    },
  },
  /**
   * Baiacu — bloqueio. Ramo A segura mais gente; ramo B troca a contenção por pulsos de área.
   *
   * V3.1: o agarrão deixou de ser PERMANENTE. Antes, um Baiacu bem posto prendia a fila inteira até o
   * fim da onda e o jogador não precisava mais pensar nela; agora cada inimigo fica preso por um
   * tempo, é solto, e leva `releaseCooldownMs` até poder ser pego de novo. A capacidade (1/3/5) não
   * mudou: o que mudou é que segurar virou um ciclo, não um estado.
   */
  pufferfish: {
    cost: 105,
    upgradeCosts: [85, 145] as const,
    range: 115,
    /** Base não pulsa: contém 1 inimigo e causa dano de contato. */
    damage: 0,
    cooldownMs: 3600,
    blockCapacity: 1,
    contactDamagePerSecond: 11,
    blockHold: { durationMs: 3500, releaseCooldownMs: 1500, eliteSlots: 2, bossSlow: { factor: 0.65, durationMs: 1200 } },
    fortress: {
      level1: {
        blockCapacity: 3,
        contactDamagePerSecond: 15,
        blockHold: { durationMs: 4500, releaseCooldownMs: 1500, eliteSlots: 2, bossSlow: { factor: 0.6, durationMs: 1400 } },
      },
      level2: {
        blockCapacity: 5,
        contactDamagePerSecond: 19,
        blockHold: { durationMs: 5500, releaseCooldownMs: 1400, eliteSlots: 2, bossSlow: { factor: 0.55, durationMs: 1600 } },
        bossHold: { durationMs: 1600, immunityMs: 8000 },
      },
    },
    pulse: {
      level1: { damage: 34, cooldownMs: 3000 },
      level2: { damage: 58, cooldownMs: 2800, slowFactor: 0.7, slowDurationMs: 1200 },
    },
  },
  /** Caranguejo-Recife — brawler de alcance curtíssimo. Paga o melhor dano por pérola do jogo por ficar na rota. */
  "reef-crab": {
    cost: 90,
    upgradeCosts: [80, 140] as const,
    range: 78,
    damage: 34,
    cooldownMs: 1250,
    shellbreaker: {
      level1: { damage: 40 },
      level2: { damage: 58, vulnerability: { multiplier: 1.25, durationMs: 3500 } },
    },
    sweep: {
      level1: { damage: 28 },
      level2: { damage: 28, spin: { everyAttacks: 4, damage: 56, radiusMultiplier: 1.7 } },
    },
  },
  /** Polvo-Tinteiro — debuffer. Ramo A vulnerabilidade e lentidão em área; ramo B a melhor aura permanente. */
  "ink-octopus": {
    cost: 105,
    upgradeCosts: [90, 155] as const,
    range: 155,
    damage: 14,
    cooldownMs: 1500,
    vulnerability: { multiplier: 1.12, durationMs: 3000 },
    ink: {
      level1: { damage: 17, vulnerability: { multiplier: 1.2, durationMs: 3000, radius: 55 } },
      level2: {
        radius: 90,
        durationMs: 4000,
        cooldownMs: 6000,
        slowFactor: 0.62,
        /** Teto de vulnerabilidade do jogo: nada multiplica com nada, vale sempre a maior. */
        vulnerabilityMultiplier: 1.3,
      },
    },
    tide: {
      level1: { attackSpeedMultiplier: 1.18, rangeMultiplier: 1 },
      level2: { attackSpeedMultiplier: 1.25, rangeMultiplier: 1.15 },
    },
  },
  /** Tubarão — dano direto. Ramo A frenesi contra feridos; ramo B a investida longa que bate uma vez e bate forte. */
  shark: {
    cost: 110,
    upgradeCosts: [90, 150] as const,
    /** Precisa cobrir a margem (até PLACEMENT.marginMax) mais o raio do maior inimigo. */
    range: 165,
    damage: 36,
    cooldownMs: 1250,
    targeting: "lowestHealth" as const,
    frenzy: {
      level1: { healthThreshold: 0.45, attackSpeedBonus: 0.4 },
      level2: { healthThreshold: 0.45, attackSpeedBonus: 0.4, perWoundedBonus: 0.12, maxBonus: 0.65 },
    },
    alpha: {
      /** Investida ofensiva: o bote vai mais longe e chega mais pesado. */
      level1: { damage: 46, rangeMultiplier: 1.25, mark: { damageMultiplier: 1.35, durationMs: 6000, cooldownMs: 7000 } },
      level2: {
        damage: 58,
        rangeMultiplier: 1.25,
        mark: { damageMultiplier: 1.35, durationMs: 6000, cooldownMs: 7000, stacking: { perHit: 0.1, max: 0.5 }, rearmOnDeath: true },
      },
    },
  },
  /**
   * Tartaruga-Marinha — controle em área. O dano é acessório; o valor é a zona e o bloqueio.
   *
   * V3.1, duas mudanças de fundo:
   *
   * 1. Ela BLOQUEIA desde a base (2 vagas) e os DOIS ramos sobem a capacidade: Casco 4 → 6, que é a
   *    barreira de verdade, e Correnteza 3 → 5, que segura menos mas compensa com a zona.
   *    O TEMPO de agarrão dela é muito maior que o do Baiacu (9s a 14s contra 3,5s a 5,5s): o Baiacu
   *    é uma parede que belisca, ela é a criatura que SEGURA. Sem essa diferença os dois viravam a
   *    mesma unidade com números um pouco diferentes.
   * 2. A turbulência saiu do Casco. Antes os dois ramos empurravam água, o que apagava a escolha;
   *    agora `flowField` é EXCLUSIVO do ramo Correnteza — quem quer mexer na água escolhe a água.
   */
  "sea-turtle": {
    cost: 85,
    upgradeCosts: [75, 130] as const,
    range: 100,
    damage: 11,
    cooldownMs: 1500,
    /** Batida base: slow leve no alvo. */
    slowFactor: 0.75,
    slowDurationMs: 1400,
    blockCapacity: 2,
    blockHold: { durationMs: 9000, releaseCooldownMs: 2200, eliteSlots: 2, bossSlow: { factor: 0.7, durationMs: 1800 } },
    shell: {
      level1: {
        blockCapacity: 4,
        blockHold: { durationMs: 12000, releaseCooldownMs: 2200, eliteSlots: 2, bossSlow: { factor: 0.6, durationMs: 2000 } },
      },
      level2: {
        blockCapacity: 6,
        blockHold: { durationMs: 14000, releaseCooldownMs: 2000, eliteSlots: 2, bossSlow: { factor: 0.5, durationMs: 2400 } },
        /** Repulsa Ancestral. */
        pushWave: { cooldownMs: 9000, distance: 110, eliteFactor: 0.6, bossSlow: { factor: 0.5, durationMs: 1600 }, visualMs: 700 },
      },
    },
    current: {
      level1: {
        blockCapacity: 3,
        blockHold: { durationMs: 10000, releaseCooldownMs: 2400, eliteSlots: 2, bossSlow: { factor: 0.65, durationMs: 1800 } },
        flowField: { radiusMultiplier: 1.8, speedFactor: 0.62 },
      },
      level2: {
        blockCapacity: 5,
        blockHold: { durationMs: 11000, releaseCooldownMs: 2400, eliteSlots: 2, bossSlow: { factor: 0.6, durationMs: 2000 } },
        flowField: { radiusMultiplier: 1.9, speedFactor: 0.55 },
        /** Controle pesado periódico: a corrente devolve a onda inteira 170px rota abaixo. */
        pushWave: { cooldownMs: 9000, distance: 170, eliteFactor: 0.6, bossSlow: { factor: 0.45, durationMs: 2000 }, visualMs: 1500 },
      },
    },
  },
  /**
   * Peixe-Pedra — EMBOSCADA. Não é mais armadilha.
   *
   * V3.2 mudou a identidade inteira. Antes ele se enterrava, explodia uma vez e ficava inútil num
   * rearme longo; na prática o jogador via a fila passar por cima dele sem nada acontecer. Agora ele
   * fica agarrado à BORDA da correnteza, camuflado de pedra, e dá botes curtos e repetidos em quem
   * entra na zona à frente dele. A pergunta que ele faz deixou de ser "quando gasto a armadilha" e
   * passou a ser "onde nesta rota os inimigos vão se agrupar".
   *
   * Os dois ramos puxam para lados opostos de propósito:
   *   Jardim Tóxico  → área, veneno e território; quer ver enxame.
   *   Predador       → área menor, bote brutal e anti-armadura; quer ver UM grandão.
   */
  stonefish: {
    cost: 95,
    upgradeCosts: [80, 140] as const,
    /** O alcance É a zona de emboscada: o que ele cobre da correnteza a partir da borda. */
    range: 70,
    /** Não ataca pela FSM: tudo acontece na emboscada. */
    damage: 0,
    cooldownMs: 3000,
    ambush: {
      /** Só na colocação: ele se acomoda e some no cenário. */
      settleMs: 1600,
      /** Abertura dos espinhos depois que alguém entra. Curto, mas visível — é o aviso. */
      armMs: 420,
      cooldownMs: 3000,
      triggerRadius: 70,
      damage: 46,
      poison: { damagePerTick: 9, tickMs: 1000, durationMs: 4000, maxStacks: 2 },
    },
    /** Ramo A — Jardim Tóxico: enxame e controle de território. */
    garden: {
      level1: {
        damage: 40,
        triggerRadius: 78,
        poison: { damagePerTick: 10, tickMs: 1000, durationMs: 5000, maxStacks: 2 },
        cloud: {
          radius: 88,
          durationMs: 4000,
          slowFactor: 0.85,
          poison: { damagePerTick: 8, tickMs: 1000, durationMs: 4000, maxStacks: 2 },
        },
      },
      level2: {
        damage: 40,
        triggerRadius: 86,
        poison: { damagePerTick: 10, tickMs: 1000, durationMs: 6000, maxStacks: 2 },
        cloud: {
          radius: 108,
          durationMs: 5000,
          slowFactor: 0.8,
          poison: { damagePerTick: 8, tickMs: 1000, durationMs: 6000, maxStacks: 2 },
        },
        /**
         * Quem morre envenenado dentro da nuvem contamina os vizinhos. UMA vez por morte: a dose
         * espalhada não espalha de novo, senão um cardume viraria reação em cadeia infinita.
         */
        spreadOnDeath: { radius: 72, poison: { damagePerTick: 8, tickMs: 1000, durationMs: 4000, maxStacks: 2 } },
      },
    },
    /** Ramo B — Predador de Emboscada: menos área, punição enorme em poucos alvos fortes. */
    predator: {
      level1: { damage: 82, triggerRadius: 54, armorPiercing: true },
      level2: {
        damage: 96,
        triggerRadius: 54,
        armorPiercing: true,
        /**
         * Trava o alvo mais forte da zona e cobra pela vida MÁXIMA dele: 10% dela, até 80 de bônus.
         * Contra um comum de 90 isso é ruído; contra um Cascudo (210) são +21; contra um chefe o teto
         * segura em +80, que é punição real sem virar execução.
         */
        focus: { bonusPerMaxHealth: 0.1, maxBonus: 80, armMs: 240 },
      },
    },
  },
  /** Golfinho — suporte puro por sonar. Não anda, não invoca: revela, enfraquece e rege o cardume. */
  dolphin: {
    cost: 110,
    upgradeCosts: [95, 160] as const,
    range: 155,
    damage: 11,
    cooldownMs: 1400,
    /** Base: 10% de vulnerabilidade, como combinado. */
    sonar: { cooldownMs: 5500, radiusMultiplier: 1, revealMs: 5000, vulnerability: { multiplier: 1.1, durationMs: 4500 } },
    chorus: {
      level1: {
        durationMs: 6000,
        cooldownMs: 11000,
        radiusMultiplier: 1.3,
        aura: { attackSpeedMultiplier: 1.3, abilityCooldownMultiplier: 0.8, rangeMultiplier: 1.15 },
        speciesBonus: 0.03,
        maxSpecies: 5,
      },
      level2: {
        durationMs: 6500,
        cooldownMs: 10500,
        radiusMultiplier: 1.6,
        aura: { attackSpeedMultiplier: 1.38, abilityCooldownMultiplier: 0.75, rangeMultiplier: 1.2 },
        speciesBonus: 0.03,
        maxSpecies: 5,
        thematic: {
          shark: { dashSpeedMultiplier: 1.25 },
          "sea-turtle": { controlDurationMultiplier: 1.2 },
          pufferfish: { rangeMultiplier: 1.15 },
          "reef-crab": { damageMultiplier: 1.15 },
          "ink-octopus": { debuffDurationMultiplier: 1.25 },
          stonefish: { rearmMultiplier: 0.75 },
          "pistol-shrimp": { projectileSpeedMultiplier: 1.2 },
        },
      },
    },
    echo: {
      level1: { cooldownMs: 5000, radiusMultiplier: 1.6, revealMs: 6000, vulnerability: { multiplier: 1.22, durationMs: 5500 }, markPriority: true },
      level2: {
        cooldownMs: 5000,
        radiusMultiplier: 1.7,
        revealMs: 6000,
        vulnerability: { multiplier: 1.25, durationMs: 5500 },
        markPriority: true,
        echo: { waves: 3, intervalMs: 350, coordinateMs: 4000 },
      },
    },
  },
} as const;

/**
 * Resistência global a controle (stun, bloqueio temporário, knockback). Cada controle forte dentro da
 * janela vale a fração do passo seguinte; esgotados os passos, o inimigo fica imune até a janela fechar.
 * Comuns não resistem.
 */
export const CROWD_CONTROL = {
  boss: { windowMs: 8000, steps: [1, 0.6, 0.3], immunityMs: 4000 },
  elite: { windowMs: 6000, steps: [1, 0.75, 0.5], immunityMs: 2000 },
} as const;

/** Regras de posicionamento compartilhadas pela cena e pela simulação (distâncias em pixels). */
export const PLACEMENT = {
  /** Toque a até esta distância da linha da rota conta como "na correnteza". */
  routeClearance: 52,
  /** Separação mínima entre unidades da correnteza. */
  routeSeparation: 78,
  /** Distância mínima da entrada e da saída da rota. */
  routeEndClearance: 60,
  /** Água livre: distância mínima da rota. */
  waterRouteClearance: 82,
  /** Separação mínima de plataformas e de outros Guardiões (água e margem). */
  separation: 78,
  /** Margem: faixa de água ao lado da rota (distância da linha central). */
  marginMin: 30,
  marginMax: 120,
  /** Raio de clique de uma plataforma na simulação. */
  platformHitRadius: 47,
  /**
   * Emboscada (Peixe-Pedra): distância da linha central em que ele se encaixa, na borda da
   * correnteza. Fora da faixa de areia, mas perto o bastante para a zona dele invadir a rota.
   */
  ambushOffset: 38,
  /** Até onde do centro da rota o toque ainda conta como "quero ele naquela borda". */
  ambushReach: 130,
  /** Separação mínima entre emboscadas e outras unidades da correnteza. */
  ambushSeparation: 64,
} as const;

/**
 * Valores de referência; cada fase aplica `enemyScaling` por cima.
 *
 * V2 mexeu só na ARMADURA, reescrita para a curva percentual. Redução efetiva:
 * 9 → 36%, 7 → 30%, 6 → 27%, 5 → 24%, 2 → 11%.
 *
 * ---------------------------------------------------------------------------
 * V3 (fases longas): agora a VIDA subiu, com dois princípios.
 *
 * 1. Um comum tem que custar 2–3 golpes relevantes, não um. O Peixe Invasor a 55 morria para um
 *    único Giro de Carapaça (56) em qualquer fase; a 90 ele exige 2 giros ou 3 pinçadas.
 * 2. O Peixinho é a exceção e continua descartável: subiu de 18 para 24 só o bastante para não
 *    evaporar no dano de raspão dos suportes, e segue morrendo a qualquer AoE de verdade.
 *
 * A subida do fim de campanha NÃO está aqui: está em `enemyScaling.health` de cada fase, que saiu
 * de uma reta quase plana (0,75 → 1,00) para uma rampa real (0,75 → 1,50). É o que concentra a
 * densidade nas fases médias e finais sem endurecer a fase 1.
 *
 * As recompensas subiram junto (o mesmo inimigo vale mais pérolas), senão a economia não paga uma
 * partida de 18 ondas.
 */
export const ENEMY_BALANCE = {
  /**
   * Cardume: a única unidade que NÃO acompanhou a subida da V3. Continua morrendo a um AoE grande
   * (34+) e a um tiro cheio do Camarão, mas já não cai para dano de raspão de suporte (11–18).
   */
  minnow: { maxHealth: 24, speed: 72, reward: 2, armor: 0, reefDamage: 1 },
  swimmer: { maxHealth: 90, speed: 58, reward: 6, armor: 0, reefDamage: 1 },
  dartfish: { maxHealth: 60, speed: 92, reward: 7, armor: 0, reefDamage: 1 },
  needlefish: { maxHealth: 78, speed: 118, reward: 9, armor: 0, reefDamage: 2 },
  /** Camuflado: só aparece se um bloqueador o segurar ou o sonar do Golfinho o revelar. */
  ghostJelly: { maxHealth: 100, speed: 70, reward: 11, armor: 2, reefDamage: 1 },
  shellback: { maxHealth: 210, speed: 40, reward: 13, armor: 9, reefDamage: 2 },
  moray: { maxHealth: 390, speed: 52, reward: 22, armor: 5, reefDamage: 4 },
  corruptedShark: { maxHealth: 500, speed: 74, reward: 32, armor: 6, reefDamage: 5 },
  tidebreaker: { maxHealth: 550, speed: 29, reward: 60, armor: 7, reefDamage: 10 },
} as const;

/**
 * Regras do chefe: ciclo de AMPLIFICAÇÃO da corrente natural do mapa.
 *
 * A Baleia não inverte mais o fluxo: ela engrossa o que o mapa já tem. Quem nada a favor acelera
 * mais, quem nada contra sofre mais, e a deriva dos projéteis aumenta. As correntes criadas por
 * Guardiões (a Tartaruga) ficam intocadas — só zonas `origin: "map"` são amplificáveis.
 *
 * 🔶 `strengthMultiplier` e `driftMultiplier` são números novos desta rodada: placeholders a calibrar.
 */
export const BOSS_CURRENT = {
  cycleMs: 6500,
  surgeMs: 3000,
  strengthMultiplier: 2.2,
  driftMultiplier: 1.8,
} as const;

/**
 * Regras do Tubarão Corrompido: ele caça em investidas (arranque periódico) e enlouquece ferido.
 * `burst*` alimenta a habilidade `speedBurst`; `enrage*`, a `enrageBelowHp`.
 */
export const SHARK_HUNT = {
  burstIntervalMs: 5200,
  burstMs: 1400,
  burstMultiplier: 1.9,
  enrageThreshold: 0.4,
  enrageSpeed: 1.25,
  enrageArmorBonus: 4,
  enrageReefDamage: 1.5,
} as const;

/**
 * Modificadores de elite (item 7): números aplicados por cima de qualquer inimigo base.
 * `armorBonus` é aditivo; o resto multiplica. A recompensa sobe junto com a ameaça.
 */
export const ELITE_BALANCE = {
  armored: { maxHealth: 1.3, armorBonus: 6, speed: 0.95, rewardMultiplier: 1.6 },
  swift: { maxHealth: 0.9, speed: 1.35, rewardMultiplier: 1.4 },
  regenerating: { maxHealth: 1.15, hpPerSecond: 0.02, delayAfterHitMs: 1500, rewardMultiplier: 1.6 },
  furious: { maxHealth: 1.1, threshold: 0.5, speedMultiplier: 1.3, rewardMultiplier: 1.5 },
  resilient: { maxHealth: 1.25, slowResistance: 0.35, stunResistance: 0.4, rewardMultiplier: 1.5 },
  camouflaged: { maxHealth: 1.05, speed: 1.1, rewardMultiplier: 1.7 },
} as const;
