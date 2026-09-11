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
} as const;

/** Valores de referência da fase 1; cada fase aplica `enemyScaling` por cima. */
export const ENEMY_BALANCE = {
  minnow: { maxHealth: 18, speed: 72, reward: 2, armor: 0, reefDamage: 1 },
  swimmer: { maxHealth: 55, speed: 58, reward: 5, armor: 0, reefDamage: 1 },
  dartfish: { maxHealth: 35, speed: 92, reward: 6, armor: 0, reefDamage: 1 },
  needlefish: { maxHealth: 45, speed: 118, reward: 7, armor: 0, reefDamage: 2 },
  shellback: { maxHealth: 130, speed: 40, reward: 10, armor: 4, reefDamage: 2 },
  moray: { maxHealth: 250, speed: 52, reward: 18, armor: 2, reefDamage: 4 },
  tidebreaker: { maxHealth: 550, speed: 29, reward: 60, armor: 3, reefDamage: 10 },
} as const;

/** Regras do chefe: ciclo de inversão da corrente. */
export const BOSS_CURRENT = {
  cycleMs: 6500,
  reverseMs: 3000,
} as const;
