import type { EnemyDefinition, EnemyId, EnemyOverride, EnemyRole, EnemyScaling, EnemyShapeKey, EnemyTag, ResolvedEnemyDefinition } from "../types";
import { BOSS_CURRENT, ENEMY_BALANCE, SHARK_HUNT } from "./balance";

/**
 * Catálogo de inimigos. Números em `balance.ts`; aqui ficam identidade visual e
 * regras especiais (chefe, resistência a controle). Para adicionar um inimigo:
 * entrada aqui, em `ENEMY_BALANCE` e no tipo `EnemyId`.
 */
export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
  minnow: {
    id: "minnow",
    name: "Peixinho",
    role: "swarm",
    color: 0x8fd6ff,
    accent: 0xe8fbff,
    ...ENEMY_BALANCE.minnow,
    hitRadius: 9,
    scale: 0.62,
    art: { kind: "sprite", folder: "cardume-invasor", frames: 4, frameMs: 150, scale: 0.42, shapeFallback: "minnow" },
  },
  swimmer: {
    id: "swimmer",
    name: "Peixe Invasor",
    role: "common",
    color: 0xf1b65c,
    accent: 0xfff0b5,
    ...ENEMY_BALANCE.swimmer,
    hitRadius: 14,
    scale: 1,
    art: { kind: "sprite", folder: "lider-do-cardume", frames: 2, frameMs: 220, scale: 0.36, shapeFallback: "fish" },
  },
  dartfish: {
    id: "dartfish",
    name: "Peixe-Flecha",
    role: "fast",
    color: 0x49b6ff,
    accent: 0xfff0a8,
    ...ENEMY_BALANCE.dartfish,
    hitRadius: 11,
    scale: 0.82,
    // Desenho único, sem quadros de nado. O bico aponta para +x, como toda a prancha.
    art: { kind: "sprite", folder: "peixe-flecha", frames: 1, frameMs: 140, scale: 0.3, shapeFallback: "dart" },
  },
  needlefish: {
    id: "needlefish",
    name: "Peixe-Agulha",
    role: "fast",
    color: 0x5ef2c8,
    accent: 0xd6fff3,
    ...ENEMY_BALANCE.needlefish,
    hitRadius: 11,
    scale: 0.78,
    // 🔶 placeholder de apresentação (item 10): a Raia era pequena demais para ser lida em campo.
    art: { kind: "sprite", folder: "raia-espinhosa", frames: 4, frameMs: 130, scale: 0.4, shapeFallback: "needle" },
  },
  ghostJelly: {
    id: "ghostJelly",
    name: "Água-viva Fantasma",
    role: "common",
    color: 0x9fb8ff,
    accent: 0xe9f0ff,
    ...ENEMY_BALANCE.ghostJelly,
    hitRadius: 13,
    scale: 0.9,
    art: { kind: "sprite", folder: "agua-viva-fantasma", frames: 4, frameMs: 190, scale: 0.38, shapeFallback: "fish" },
    description: "Some na água até alguém encostar nela: só aparece quando um bloqueador a segura ou o sonar a revela.",
    tags: ["NORMAL", "STEALTH"],
    /**
     * `untilDamaged: false` de propósito — acertar por área NÃO a expõe. Ou um bloqueador da rota a
     * segura (e aí ela fica visível de vez), ou o Golfinho a revela. São duas portas, não uma.
     */
    abilities: [{ type: "stealth", untilDamaged: false, revealOnBlock: true }],
  },
  shellback: {
    id: "shellback",
    name: "Cascudo",
    role: "armored",
    color: 0x718b9e,
    accent: 0xd8c59a,
    ...ENEMY_BALANCE.shellback,
    hitRadius: 18,
    scale: 1.18,
    // Os três primeiros quadros são o caranguejo fora da concha; o quarto é a concha fechada. Em
    // rodízio cego ele se escondia a cada 800ms e parecia piscar. Agora a concha fecha quando ele
    // leva dano, e só de vez em quando por conta própria. 🔶 tempos placeholder (item 19).
    art: {
      kind: "sprite",
      folder: "caranguejo-eremita",
      frames: 4,
      frameMs: 200,
      scale: 0.42,
      rotate: "upright",
      loopFrames: [1, 2, 3],
      guardFrames: [4],
      guard: { trigger: "both", holdMs: 900, cooldownMs: 6000, idleIntervalMs: 9000, idleJitterMs: 4000 },
      shapeFallback: "shell",
    },
  },
  moray: {
    id: "moray",
    name: "Moreia Sombria",
    role: "elite",
    color: 0x3f6f4a,
    accent: 0xd9ff8a,
    ...ENEMY_BALANCE.moray,
    hitRadius: 20,
    scale: 1.32,
    slowResistance: 0.5,
    art: { kind: "sprite", folder: "moreia-das-correntes", frames: 3, frameMs: 180, scale: 0.37, shapeFallback: "moray" },
  },
  corruptedShark: {
    id: "corruptedShark",
    name: "Tubarão Corrompido",
    role: "elite",
    color: 0x4a3f8f,
    accent: 0xc46bff,
    ...ENEMY_BALANCE.corruptedShark,
    hitRadius: 24,
    scale: 1.36,
    slowResistance: 0.4,
    resistances: { stun: 0.35 },
    // 🔶 placeholder de apresentação (item 10).
    art: { kind: "sprite", folder: "predador-corrompido", frames: 3, frameMs: 140, scale: 0.48, shapeFallback: "shark" },
    description: "Caçador da maré negra: dispara em investidas, ignora metade do controle e enlouquece ferido.",
    abilities: [
      { type: "speedBurst", intervalMs: SHARK_HUNT.burstIntervalMs, durationMs: SHARK_HUNT.burstMs, multiplier: SHARK_HUNT.burstMultiplier },
      {
        type: "enrageBelowHp",
        threshold: SHARK_HUNT.enrageThreshold,
        speedMultiplier: SHARK_HUNT.enrageSpeed,
        armorBonus: SHARK_HUNT.enrageArmorBonus,
        reefDamageBonus: SHARK_HUNT.enrageReefDamage,
      },
    ],
  },
  tidebreaker: {
    id: "tidebreaker",
    name: "Quebra-Marés",
    role: "boss",
    color: 0xc8434f,
    accent: 0xffcf66,
    ...ENEMY_BALANCE.tidebreaker,
    hitRadius: 36,
    scale: 1.8,
    isBoss: true,
    unblockable: true,
    slowResistance: 0.35,
    // A Baleia precisa parecer um CHEFE à primeira vista: a 172px de comprimento ela ultrapassa a
    // faixa de areia da rota (118px), que é o efeito pretendido. 🔶 placeholder (item 10).
    art: { kind: "sprite", folder: "baleia-mare-negra", frames: 1, frameMs: 400, scale: 0.27, shapeFallback: "boss" },
    description: "O chefe das primeiras marés: inverte a corrente do recife em ciclos e não pode ser bloqueado.",
    abilities: [{ type: "reverseCurrents", cycleMs: BOSS_CURRENT.cycleMs, reverseMs: BOSS_CURRENT.reverseMs }],
  },
};

/** Categorias padrão a partir do papel antigo. */
export const TAGS_FOR_ROLE: Record<EnemyRole, EnemyTag[]> = {
  swarm: ["SWARM"],
  common: ["NORMAL"],
  fast: ["FAST"],
  armored: ["ARMORED", "TANK"],
  elite: ["ELITE"],
  boss: ["BOSS"],
};

/** Forma vetorial de cada inimigo atual (o antigo `switch` por id no desenho). */
export const SHAPE_FOR_LEGACY_ID: Record<EnemyId, EnemyShapeKey> = {
  minnow: "minnow",
  swimmer: "fish",
  dartfish: "dart",
  needlefish: "needle",
  ghostJelly: "fish",
  shellback: "shell",
  moray: "moray",
  corruptedShark: "shark",
  tidebreaker: "boss",
};

export const THREAT_FOR_ROLE: Record<EnemyRole, number> = { swarm: 0, common: 0, fast: 0, armored: 1, elite: 2, boss: 3 };

/** Preenche os campos v2 ausentes com padrões derivados do papel; campos presentes vencem. */
export function resolveEnemy(definition: EnemyDefinition): ResolvedEnemyDefinition {
  const baseId = definition.baseId ?? definition.id;
  return {
    ...definition,
    description: definition.description ?? "",
    art: definition.art ?? { kind: "procedural", shape: SHAPE_FOR_LEGACY_ID[baseId] ?? (definition.isBoss ? "boss" : "fish") },
    tags: definition.tags ?? [...TAGS_FOR_ROLE[definition.role]],
    resistances: { slow: definition.slowResistance ?? 0, ...(definition.resistances ?? {}) },
    immunities: definition.immunities ?? [],
    threatLevel: definition.threatLevel ?? THREAT_FOR_ROLE[definition.role],
    abilities: definition.abilities ?? [],
  };
}

export const ENEMY_ORDER: EnemyId[] = [
  "minnow",
  "swimmer",
  "dartfish",
  "needlefish",
  "ghostJelly",
  "shellback",
  "moray",
  "corruptedShark",
  "tidebreaker",
];

/** Aplica a sobrescrita da fase (se houver) e depois o multiplicador da fase. */
export function scaleEnemy(definition: EnemyDefinition, scaling: EnemyScaling, override: EnemyOverride = {}): ResolvedEnemyDefinition {
  const base = { ...resolveEnemy(definition), ...override };
  return {
    ...base,
    maxHealth: Math.round(base.maxHealth * scaling.health),
    speed: Math.round(base.speed * scaling.speed),
    reward: Math.round(base.reward * scaling.reward),
  };
}
