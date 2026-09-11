import type { EnemyDefinition, EnemyId, EnemyOverride, EnemyScaling } from "../types";
import { ENEMY_BALANCE } from "./balance";

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
  },
};

export const ENEMY_ORDER: EnemyId[] = ["minnow", "swimmer", "dartfish", "needlefish", "shellback", "moray", "tidebreaker"];

/** Aplica a sobrescrita da fase (se houver) e depois o multiplicador da fase. */
export function scaleEnemy(definition: EnemyDefinition, scaling: EnemyScaling, override: EnemyOverride = {}): EnemyDefinition {
  const base = { ...definition, ...override };
  return {
    ...base,
    maxHealth: Math.round(base.maxHealth * scaling.health),
    speed: Math.round(base.speed * scaling.speed),
    reward: Math.round(base.reward * scaling.reward),
  };
}
