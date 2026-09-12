import type { EnemyAbility, EnemyDefinition, EnemyTag, ResolvedEnemyDefinition, StatMultipliers, StatusResistanceMap } from "../types";
import { ELITE_BALANCE } from "./balance";
import { resolveEnemy } from "./enemies";

export type EliteId = "armored" | "swift" | "regenerating" | "furious" | "resilient" | "camouflaged";

/**
 * Modificador de elite (item 7): uma variação aplicável a QUALQUER inimigo base, sem criar uma classe
 * nova. Muda atributos, pode anexar habilidades e aumenta a recompensa.
 */
export interface EliteModifier {
  id: EliteId;
  /** Nome mostrado depois do nome base: "Cascudo Blindado". */
  name: string;
  description: string;
  /** Cor do anel/etiqueta no mapa e no bestiário. */
  tagColor: number;
  stats: StatMultipliers;
  resistances?: StatusResistanceMap;
  abilities?: EnemyAbility[];
  rewardMultiplier: number;
  extraTags?: EnemyTag[];
}

export const ELITES: Record<EliteId, EliteModifier> = {
  armored: {
    id: "armored",
    name: "Blindado",
    description: "Carapaça reforçada: muito mais armadura e vida, um pouco mais lento.",
    tagColor: 0x9fb4c7,
    stats: { maxHealth: ELITE_BALANCE.armored.maxHealth, armorBonus: ELITE_BALANCE.armored.armorBonus, speed: ELITE_BALANCE.armored.speed },
    rewardMultiplier: ELITE_BALANCE.armored.rewardMultiplier,
    extraTags: ["ARMORED", "TANK"],
  },
  swift: {
    id: "swift",
    name: "Veloz",
    description: "Nada muito mais rápido, mas com menos vida.",
    tagColor: 0x7df2c6,
    stats: { maxHealth: ELITE_BALANCE.swift.maxHealth, speed: ELITE_BALANCE.swift.speed },
    rewardMultiplier: ELITE_BALANCE.swift.rewardMultiplier,
    extraTags: ["FAST"],
  },
  regenerating: {
    id: "regenerating",
    name: "Regenerador",
    description: "Recupera vida quando fica um tempo sem levar dano.",
    tagColor: 0x8ef26b,
    stats: { maxHealth: ELITE_BALANCE.regenerating.maxHealth },
    rewardMultiplier: ELITE_BALANCE.regenerating.rewardMultiplier,
    abilities: [{ type: "regen", hpPerSecond: 0, delayAfterHitMs: ELITE_BALANCE.regenerating.delayAfterHitMs }],
  },
  furious: {
    id: "furious",
    name: "Furioso",
    description: "Acelera quando fica com pouca vida.",
    tagColor: 0xff8a5c,
    stats: { maxHealth: ELITE_BALANCE.furious.maxHealth },
    rewardMultiplier: ELITE_BALANCE.furious.rewardMultiplier,
    abilities: [{ type: "enrageBelowHp", threshold: ELITE_BALANCE.furious.threshold, speedMultiplier: ELITE_BALANCE.furious.speedMultiplier }],
  },
  resilient: {
    id: "resilient",
    name: "Resistente",
    description: "Sofre menos com lentidão e paralisia.",
    tagColor: 0xd0a3ff,
    stats: { maxHealth: ELITE_BALANCE.resilient.maxHealth },
    resistances: { slow: ELITE_BALANCE.resilient.slowResistance, stun: ELITE_BALANCE.resilient.stunResistance },
    rewardMultiplier: ELITE_BALANCE.resilient.rewardMultiplier,
  },
  camouflaged: {
    id: "camouflaged",
    name: "Camuflado",
    description: "Fica escondido até ser revelado por um sonar ou atingido.",
    tagColor: 0x6fd6ff,
    stats: { maxHealth: ELITE_BALANCE.camouflaged.maxHealth, speed: ELITE_BALANCE.camouflaged.speed },
    rewardMultiplier: ELITE_BALANCE.camouflaged.rewardMultiplier,
    abilities: [{ type: "stealth", untilDamaged: true }],
    extraTags: ["STEALTH"],
  },
};

export const ELITE_IDS = Object.keys(ELITES) as EliteId[];

/** Elites que fazem sentido em um inimigo base (chefes e cardumes ficam de fora por padrão). */
export function eliteAllowedFor(definition: EnemyDefinition): boolean {
  return !definition.isBoss && definition.role !== "swarm";
}

/**
 * Aplica um modificador a um inimigo base. O `id` continua sendo o do inimigo base (contagens de
 * abate, `enemyOverrides` e os testes de conteúdo seguem funcionando); `eliteId`/`baseId` guardam a
 * variação. Um comum vira `role: "elite"`, então tiers de controle e vagas de bloqueio já reagem.
 */
export function applyElite(base: EnemyDefinition, elite: EliteModifier): ResolvedEnemyDefinition {
  const resolved = resolveEnemy(base);
  const stats = elite.stats;
  const regenAbilities = (elite.abilities ?? []).map((ability) =>
    // O regenerador cura uma fração da vida máxima por segundo: resolvido aqui, onde a vida é conhecida.
    ability.type === "regen" && ability.hpPerSecond === 0
      ? { ...ability, hpPerSecond: resolved.maxHealth * (stats.maxHealth ?? 1) * ELITE_BALANCE.regenerating.hpPerSecond }
      : ability,
  );
  return {
    ...resolved,
    baseId: resolved.baseId ?? resolved.id,
    eliteId: elite.id,
    name: `${resolved.name} ${elite.name}`,
    role: resolved.isBoss || resolved.role === "boss" ? resolved.role : "elite",
    maxHealth: Math.round(resolved.maxHealth * (stats.maxHealth ?? 1)),
    speed: Math.round(resolved.speed * (stats.speed ?? 1)),
    reward: Math.round(resolved.reward * (stats.reward ?? 1) * elite.rewardMultiplier),
    reefDamage: Math.round(resolved.reefDamage * (stats.reefDamage ?? 1)),
    armor: resolved.armor + (stats.armorBonus ?? 0),
    scale: resolved.scale * (stats.scale ?? 1),
    tags: [...new Set<EnemyTag>([...resolved.tags, "ELITE", ...(elite.extraTags ?? [])])],
    resistances: mergeResistances(resolved.resistances, elite.resistances),
    threatLevel: Math.max(resolved.threatLevel, 2),
    abilities: [...resolved.abilities, ...regenAbilities],
  };
}

/** Chave de contagem: `cascudo#armored` para elites, o id base para o resto. */
export function eliteInstanceKey(definition: Pick<EnemyDefinition, "id" | "baseId" | "eliteId">): string {
  return definition.eliteId ? `${definition.baseId ?? definition.id}#${definition.eliteId}` : definition.id;
}

function mergeResistances(base: StatusResistanceMap, extra: StatusResistanceMap | undefined): StatusResistanceMap {
  if (!extra) return { ...base };
  const merged: StatusResistanceMap = { ...base };
  for (const [type, value] of Object.entries(extra) as Array<[keyof StatusResistanceMap, number]>) {
    merged[type] = Math.max(0, Math.min(1, (merged[type] ?? 0) + value));
  }
  return merged;
}
