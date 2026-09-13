/**
 * PONTO ÚNICO DE BALANCEAMENTO.
 *
 * Todos os números de economia, Guardiões e inimigos vivem aqui. Os arquivos
 * `guardians.ts` e `enemies.ts` apenas embrulham estes valores com nomes, cores e
 * textos; as fases em `levels/` definem geometria e composição de ondas.
 * Ajuste aqui e o jogo, o HUD e os testes de contrato seguem juntos.
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
  "pistol-shrimp": {
    cost: 80,
    upgradeCosts: [70, 130] as const,
    range: 188,
    damage: 20,
    cooldownMs: 1200,
    projectileSpeed: 430,
    /** Alcance máximo para ricochetear até um novo alvo depois de atravessar um inimigo. */
    ricochetRange: 240,
    pierce: {
      level1: { pierceDamages: [20, 15] },
      level2: { pierceDamages: [24, 19, 15] },
    },
    heavy: {
      level1: { damage: 34, cooldownMs: 1350 },
      level2: { damage: 50, cooldownMs: 1400, splash: { radius: 42, damageMultiplier: 0.45 } },
    },
  },
  jellyfish: {
    cost: 100,
    upgradeCosts: [85, 145] as const,
    range: 166,
    damage: 9,
    cooldownMs: 1000,
    slowFactor: 0.68,
    slowDurationMs: 1500,
    electric: {
      level1: { chainDamages: [9, 6, 4] },
      level2: {
        radius: 72,
        durationMs: 2500,
        cooldownMs: 5000,
        pulseIntervalMs: 500,
        damage: 6,
        maxDamagePerTarget: 30,
        slowFactor: 0.6,
        slowDurationMs: 600,
      },
    },
    control: {
      level1: { slowFactor: 0.5, slowDurationMs: 1800 },
      level2: { stun: { durationMs: 600, immunityMs: 3500 } },
    },
  },
  pufferfish: {
    cost: 110,
    upgradeCosts: [90, 150] as const,
    range: 112,
    /** Base não pulsa: contém 1 inimigo e causa dano de contato. */
    damage: 0,
    cooldownMs: 4000,
    blockCapacity: 1,
    contactDamagePerSecond: 8,
    fortress: {
      level1: { blockCapacity: 2, contactDamagePerSecond: 12 },
      level2: {
        blockCapacity: 3,
        contactDamagePerSecond: 15,
        bossHold: { durationMs: 1200, immunityMs: 9000 },
      },
    },
    pulse: {
      level1: { damage: 25, cooldownMs: 4000 },
      level2: { damage: 40, cooldownMs: 4000, slowFactor: 0.75, slowDurationMs: 900 },
    },
  },
  "reef-crab": {
    cost: 90,
    upgradeCosts: [80, 140] as const,
    range: 70,
    damage: 28,
    cooldownMs: 1400,
    shellbreaker: {
      level1: { damage: 32 },
      level2: { damage: 45, vulnerability: { multiplier: 1.2, durationMs: 3000 } },
    },
    sweep: {
      level1: { damage: 22 },
      level2: { damage: 22, spin: { everyAttacks: 4, damage: 35, radiusMultiplier: 1.5 } },
    },
  },
  "ink-octopus": {
    cost: 120,
    upgradeCosts: [100, 170] as const,
    range: 150,
    damage: 10,
    cooldownMs: 1600,
    vulnerability: { multiplier: 1.1, durationMs: 2500 },
    ink: {
      level1: { damage: 12, vulnerability: { multiplier: 1.15, durationMs: 2500, radius: 40 } },
      level2: {
        radius: 70,
        durationMs: 3000,
        cooldownMs: 6000,
        slowFactor: 0.7,
        vulnerabilityMultiplier: 1.15,
      },
    },
    tide: {
      level1: { attackSpeedMultiplier: 1.1, rangeMultiplier: 1 },
      level2: { attackSpeedMultiplier: 1.15, rangeMultiplier: 1.12 },
    },
  },
  /** Tubarão — Instinto Predador: investida curta, dano alto, prioriza inimigos com pouca vida. */
  shark: {
    cost: 110,
    upgradeCosts: [90, 150] as const,
    /** Precisa cobrir a margem (até PLACEMENT.marginMax) mais o raio do maior inimigo. */
    range: 160,
    damage: 30,
    cooldownMs: 1300,
    targeting: "lowestHealth" as const,
    frenzy: {
      level1: { healthThreshold: 0.4, attackSpeedBonus: 0.35 },
      level2: { healthThreshold: 0.4, attackSpeedBonus: 0.35, perWoundedBonus: 0.12, maxBonus: 0.6 },
    },
    alpha: {
      level1: { mark: { damageMultiplier: 1.3, durationMs: 6000, cooldownMs: 8000 } },
      level2: {
        damage: 34,
        mark: { damageMultiplier: 1.3, durationMs: 6000, cooldownMs: 8000, stacking: { perHit: 0.1, max: 0.5 }, rearmOnDeath: true },
      },
    },
  },
  /** Tartaruga-Marinha — Guardiã do Recife: dano mínimo, controle de rota. */
  "sea-turtle": {
    cost: 100,
    upgradeCosts: [85, 145] as const,
    range: 90,
    damage: 6,
    cooldownMs: 1500,
    /** Batida base: slow leve no alvo. */
    slowFactor: 0.85,
    slowDurationMs: 1000,
    shell: {
      level1: {
        blockCapacity: 3,
        blockHold: { durationMs: 3000, releaseCooldownMs: 4000, eliteSlots: 2, bossSlow: { factor: 0.7, durationMs: 1000 } },
        /** Turbulência: slow ambiental leve em volta. */
        flowField: { radiusMultiplier: 1.4, speedFactor: 0.9 },
      },
      level2: {
        blockCapacity: 5,
        blockHold: { durationMs: 4000, releaseCooldownMs: 4000, eliteSlots: 2, bossSlow: { factor: 0.7, durationMs: 1000 } },
        flowField: { radiusMultiplier: 1.4, speedFactor: 0.9 },
        /** Repulsa Ancestral. */
        pushWave: { cooldownMs: 11000, distance: 90, eliteFactor: 0.5, bossSlow: { factor: 0.6, durationMs: 1200 }, visualMs: 700 },
      },
    },
    current: {
      level1: { flowField: { radiusMultiplier: 1.6, speedFactor: 0.75 } },
      level2: {
        flowField: { radiusMultiplier: 1.6, speedFactor: 0.75 },
        /** Corrente forte. */
        pushWave: { cooldownMs: 12000, distance: 120, eliteFactor: 0.5, bossSlow: { factor: 0.5, durationMs: 1500 }, visualMs: 1500 },
      },
    },
  },
  /** Peixe-Pedra — Emboscador do Recife: armadilha enterrada na rota. `range` é o raio de acionamento. */
  stonefish: {
    cost: 95,
    upgradeCosts: [80, 140] as const,
    range: 60,
    /** Não ataca pela FSM: tudo acontece na armadilha. */
    damage: 0,
    cooldownMs: 6000,
    trap: {
      armMs: 3000,
      cooldownMs: 6000,
      triggerRadius: 60,
      damage: 18,
      charge: { everyMs: 2000, bonus: 0.05, max: 0.25, applyTo: "damage" as const },
    },
    venom: {
      level1: { damage: 14, poison: { damagePerTick: 4, tickMs: 1000, durationMs: 5000, maxStacks: 2 } },
      level2: {
        damage: 14,
        poison: { damagePerTick: 5, tickMs: 1000, durationMs: 6000, maxStacks: 2 },
        cloud: { radius: 70, durationMs: 3000, poison: { damagePerTick: 4, tickMs: 1000, durationMs: 6000, maxStacks: 2 } },
      },
    },
    ambush: {
      level1: {
        damage: 22,
        stun: { durationMs: 800, eliteFactor: 0.6, bossFactor: 0.25 },
        charge: { everyMs: 2000, bonus: 0.05, max: 0.25, applyTo: "control" as const },
      },
      level2: {
        damage: 30,
        stun: { durationMs: 1200, eliteFactor: 0.6, bossFactor: 0.2 },
        knockback: { distance: 50, eliteFactor: 0.5 },
        waitFor: { count: 3, maxWaitMs: 2500 },
        charge: { everyMs: 2000, bonus: 0.05, max: 0.25, applyTo: "control" as const },
      },
    },
  },
  /** Golfinho — Mensageiro do Recife: suporte por sonar e coro. */
  dolphin: {
    cost: 120,
    upgradeCosts: [100, 170] as const,
    range: 150,
    damage: 8,
    cooldownMs: 1400,
    sonar: { cooldownMs: 6000, radiusMultiplier: 1, revealMs: 4000, vulnerability: { multiplier: 1.05, durationMs: 4000 } },
    chorus: {
      level1: {
        durationMs: 5000,
        cooldownMs: 12000,
        radiusMultiplier: 1,
        aura: { attackSpeedMultiplier: 1.1, abilityCooldownMultiplier: 0.9, rangeMultiplier: 1.05 },
        speciesBonus: 0.02,
        maxSpecies: 5,
      },
      level2: {
        durationMs: 5000,
        cooldownMs: 12000,
        radiusMultiplier: 1.3,
        aura: { attackSpeedMultiplier: 1.12, abilityCooldownMultiplier: 0.88, rangeMultiplier: 1.08 },
        speciesBonus: 0.02,
        maxSpecies: 5,
        thematic: {
          shark: { dashSpeedMultiplier: 1.25 },
          "sea-turtle": { controlDurationMultiplier: 1.15 },
          pufferfish: { rangeMultiplier: 1.1 },
          "reef-crab": { damageMultiplier: 1.1 },
          "ink-octopus": { debuffDurationMultiplier: 1.2 },
          stonefish: { rearmMultiplier: 0.8 },
          "pistol-shrimp": { projectileSpeedMultiplier: 1.15 },
        },
      },
    },
    echo: {
      level1: { cooldownMs: 6000, radiusMultiplier: 1.5, revealMs: 5000, vulnerability: { multiplier: 1.12, durationMs: 5000 }, markPriority: true },
      level2: {
        cooldownMs: 6000,
        radiusMultiplier: 1.5,
        revealMs: 5000,
        vulnerability: { multiplier: 1.12, durationMs: 5000 },
        markPriority: true,
        echo: { waves: 3, intervalMs: 400, coordinateMs: 3500 },
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
} as const;

/** Valores de referência da fase 1; cada fase aplica `enemyScaling` por cima. */
export const ENEMY_BALANCE = {
  minnow: { maxHealth: 18, speed: 72, reward: 2, armor: 0, reefDamage: 1 },
  swimmer: { maxHealth: 55, speed: 58, reward: 5, armor: 0, reefDamage: 1 },
  dartfish: { maxHealth: 35, speed: 92, reward: 6, armor: 0, reefDamage: 1 },
  needlefish: { maxHealth: 45, speed: 118, reward: 7, armor: 0, reefDamage: 2 },
  shellback: { maxHealth: 130, speed: 40, reward: 10, armor: 4, reefDamage: 2 },
  moray: { maxHealth: 250, speed: 52, reward: 18, armor: 2, reefDamage: 4 },
  corruptedShark: { maxHealth: 320, speed: 74, reward: 26, armor: 3, reefDamage: 5 },
  tidebreaker: { maxHealth: 550, speed: 29, reward: 60, armor: 3, reefDamage: 10 },
} as const;

/** Regras do chefe: ciclo de inversão da corrente. */
export const BOSS_CURRENT = {
  cycleMs: 6500,
  reverseMs: 3000,
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
  enrageArmorBonus: 2,
  enrageReefDamage: 1.5,
} as const;

/**
 * Modificadores de elite (item 7): números aplicados por cima de qualquer inimigo base.
 * `armorBonus` é aditivo; o resto multiplica. A recompensa sobe junto com a ameaça.
 */
export const ELITE_BALANCE = {
  armored: { maxHealth: 1.3, armorBonus: 3, speed: 0.95, rewardMultiplier: 1.6 },
  swift: { maxHealth: 0.9, speed: 1.35, rewardMultiplier: 1.4 },
  regenerating: { maxHealth: 1.15, hpPerSecond: 0.02, delayAfterHitMs: 1500, rewardMultiplier: 1.6 },
  furious: { maxHealth: 1.1, threshold: 0.5, speedMultiplier: 1.3, rewardMultiplier: 1.5 },
  resilient: { maxHealth: 1.25, slowResistance: 0.35, stunResistance: 0.4, rewardMultiplier: 1.5 },
  camouflaged: { maxHealth: 1.05, speed: 1.1, rewardMultiplier: 1.7 },
} as const;
