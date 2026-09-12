import type { EnemyDefinition, EnemyId, EnemyOverride, EnemyRole, EnemyScaling, EnemyShapeKey, EnemyTag, ResolvedEnemyDefinition } from "../types";
import { BOSS_CURRENT, ENEMY_BALANCE } from "./balance";

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
    color: 0xff6f91,
    accent: 0xffd0dc,
    ...ENEMY_BALANCE.dartfish,
    hitRadius: 11,
    scale: 0.82,
    art: { kind: "sprite", folder: "predador-corrompido", frames: 3, frameMs: 140, scale: 0.28, shapeFallback: "dart" },
  },
  needlefish: {
    id: "needlefish",
    name: "Peixe-Agulha",
    role: "fast",
    color: 0x5ef2c8,
    accent: 0xd6fff3,
    ...ENEMY_BALANCE.needlefish,
    hitRadius: 10,
    scale: 0.78,
    art: { kind: "sprite", folder: "raia-espinhosa", frames: 4, frameMs: 130, scale: 0.34, shapeFallback: "needle" },
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
    art: { kind: "sprite", folder: "caranguejo-eremita", frames: 4, frameMs: 200, scale: 0.42, rotate: "upright", shapeFallback: "shell" },
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
  tidebreaker: {
    id: "tidebreaker",
    name: "Quebra-Marés",
    role: "boss",
    color: 0xc8434f,
    accent: 0xffcf66,
    ...ENEMY_BALANCE.tidebreaker,
    hitRadius: 30,
    scale: 1.8,
    isBoss: true,
    unblockable: true,
    slowResistance: 0.35,
    art: { kind: "sprite", folder: "baleia-mare-negra", frames: 1, frameMs: 400, scale: 0.19, shapeFallback: "boss" },
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
  shellback: "shell",
  moray: "moray",
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

export const ENEMY_ORDER: EnemyId[] = ["minnow", "swimmer", "dartfish", "needlefish", "shellback", "moray", "tidebreaker"];

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
