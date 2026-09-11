import type { AuraEffect, GuardianDefinition, GuardianUpgrade, VulnerabilityEffect } from "../types";
import { NEUTRAL_AURA } from "./Auras";
import { appliedUpgrades, resolveLast, resolveProduct, type UpgradeProgress } from "./UpgradeTree";

/**
 * Atributos efetivos de um Guardião a partir da definição, do progresso na árvore
 * e da aura recebida. Fonte única usada pela simulação de balanceamento; o objeto
 * Phaser `Guardian` expõe os mesmos valores.
 */
export interface GuardianStats {
  range: number;
  damage: number;
  canAttack: boolean;
  cooldownMs: number;
  projectileSpeed: number;
  predictiveAim: boolean;
  pierceDamages: number[];
  straightRicochet: boolean;
  splash: NonNullable<GuardianUpgrade["splash"]> | null;
  chainDamages: number[];
  slowFactor: number | null;
  slowDurationMs: number;
  stun: NonNullable<GuardianUpgrade["stun"]> | null;
  electricField: NonNullable<GuardianUpgrade["electricField"]> | null;
  blocks: boolean;
  blockCapacity: number;
  contactDamagePerSecond: number;
  bossHold: NonNullable<GuardianUpgrade["bossHold"]> | null;
  armorPiercing: boolean;
  vulnerability: VulnerabilityEffect | null;
  areaAttack: boolean;
  spin: NonNullable<GuardianUpgrade["spin"]> | null;
  inkCloud: NonNullable<GuardianUpgrade["inkCloud"]> | null;
  providedAura: AuraEffect | null;
}

export function resolveGuardianStats(
  definition: GuardianDefinition,
  progress: UpgradeProgress,
  aura: AuraEffect = NEUTRAL_AURA,
): GuardianStats {
  const applied = appliedUpgrades(definition, progress);
  const damage = resolveLast(applied, "damage") ?? definition.damage;
  const blocks = definition.placementMode === "route" && Boolean(definition.blocks);
  return {
    range: definition.range * resolveProduct(applied, "rangeMultiplier") * aura.rangeMultiplier,
    damage,
    canAttack: damage > 0,
    cooldownMs: (resolveLast(applied, "cooldownMs") ?? definition.cooldownMs) / aura.attackSpeedMultiplier,
    projectileSpeed: (definition.projectileSpeed ?? 400) * resolveProduct(applied, "projectileSpeedMultiplier"),
    predictiveAim: applied.some((upgrade) => upgrade.predictiveAim),
    pierceDamages: resolveLast(applied, "pierceDamages") ?? [damage],
    straightRicochet: applied.some((upgrade) => upgrade.straightRicochet),
    splash: resolveLast(applied, "splash") ?? null,
    chainDamages: resolveLast(applied, "chainDamages") ?? [damage],
    slowFactor: resolveLast(applied, "slowFactor") ?? definition.slowFactor ?? null,
    slowDurationMs: resolveLast(applied, "slowDurationMs") ?? definition.slowDurationMs ?? 0,
    stun: resolveLast(applied, "stun") ?? null,
    electricField: resolveLast(applied, "electricField") ?? null,
    blocks,
    blockCapacity: blocks ? (resolveLast(applied, "blockCapacity") ?? definition.blockCapacity ?? 1) : 0,
    contactDamagePerSecond: resolveLast(applied, "contactDamagePerSecond") ?? definition.contactDamagePerSecond ?? 0,
    bossHold: resolveLast(applied, "bossHold") ?? null,
    armorPiercing: applied.some((upgrade) => upgrade.armorPiercing),
    vulnerability: resolveLast(applied, "vulnerability") ?? definition.vulnerability ?? null,
    areaAttack: applied.some((upgrade) => upgrade.areaAttack),
    spin: resolveLast(applied, "spin") ?? null,
    inkCloud: resolveLast(applied, "inkCloud") ?? null,
    providedAura: resolveLast(applied, "aura") ?? null,
  };
}

/** Tempos de animação escalados para que o ciclo completo dure `cooldownMs`. */
export function scaledTimings(definition: GuardianDefinition, cooldownMs: number) {
  const base = definition.timings;
  const baseTotal = base.windupMs + base.attackMs + base.recoveryMs;
  const scale = baseTotal > 0 ? cooldownMs / baseTotal : 1;
  return {
    windupMs: base.windupMs * scale,
    attackMs: base.attackMs * scale,
    recoveryMs: base.recoveryMs * scale,
    impactAtMs: definition.animation.impactAtMs * scale,
  };
}
