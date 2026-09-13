import type { TargetTier } from "./Targeting";
import type {
  BlockHoldEffect,
  ChorusEffect,
  FlowFieldEffect,
  FrenzyEffect,
  GuardianDefinition,
  GuardianUpgrade,
  MarkEffect,
  PushWaveEffect,
  PearlGeneration,
  ResolvedAura,
  SonarEffect,
  TargetPolicyMode,
  TrapEffect,
  VulnerabilityEffect,
} from "../types";
import { NEUTRAL_AURA } from "./Auras";
import { RADIAL, type TargetingShape } from "./TargetingShape";
import { appliedUpgrades, resolveLast, resolveProduct, type UpgradeProgress } from "./UpgradeTree";

/**
 * Atributos efetivos de um Guardião a partir da definição, do progresso na árvore,
 * da aura recebida e de bônus temporários (frenesi). Fonte única usada pela simulação
 * de balanceamento e pelo objeto Phaser `Guardian`.
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
  providedAura: GuardianUpgrade["aura"] | null;
  /** Política de alvo (padrão: o mais avançado). */
  targeting: TargetPolicyMode;
  /** Forma do alcance (padrão: radial). */
  targetingShape: TargetingShape;
  /** Ordem de categorias de alvo (item 12); `null` = sem preferência, comportamento de sempre. */
  targetPriority: readonly TargetTier[] | null;
  /** Geração periódica de pérolas (Ostra); null = não rende nada. */
  generatesPearls: PearlGeneration | null;
  dash: boolean;
  frenzy: FrenzyEffect | null;
  mark: MarkEffect | null;
  blockHold: BlockHoldEffect | null;
  flowField: FlowFieldEffect | null;
  pushWave: PushWaveEffect | null;
  trap: TrapEffect | null;
  sonar: SonarEffect | null;
  chorus: ChorusEffect | null;
  /** Multiplicadores da aura que os sistemas aplicam na hora de usar (cooldowns, durações). */
  abilityCooldownMultiplier: number;
  controlDurationMultiplier: number;
  debuffDurationMultiplier: number;
  rearmMultiplier: number;
  dashSpeedMultiplier: number;
}

export interface StatModifiers {
  /** Bônus temporário de velocidade de ataque (Frenesi): 0.35 = +35%. */
  attackSpeedBonus?: number;
  /** Multiplicadores vindos de status no Guardião (buff aliado ou interferência inimiga); 1 = neutro. */
  attackSpeedMultiplier?: number;
  damageMultiplier?: number;
}

export function resolveGuardianStats(
  definition: GuardianDefinition,
  progress: UpgradeProgress,
  aura: ResolvedAura = NEUTRAL_AURA,
  modifiers: StatModifiers = {},
): GuardianStats {
  const applied = appliedUpgrades(definition, progress);
  const baseDamage = resolveLast(applied, "damage") ?? definition.damage;
  const damage = baseDamage > 0 ? baseDamage * aura.damageMultiplier * (modifiers.damageMultiplier ?? 1) : 0;
  const blocks = definition.placementMode === "route" && Boolean(resolveLast(applied, "blocks") ?? definition.blocks);
  const attackSpeed = aura.attackSpeedMultiplier * (1 + Math.max(0, modifiers.attackSpeedBonus ?? 0)) * Math.max(0.05, modifiers.attackSpeedMultiplier ?? 1);
  const vulnerability = resolveLast(applied, "vulnerability") ?? definition.vulnerability ?? null;
  const trap = resolveLast(applied, "trap") ?? definition.trap ?? null;
  return {
    range: definition.range * resolveProduct(applied, "rangeMultiplier") * aura.rangeMultiplier,
    damage,
    canAttack: damage > 0,
    cooldownMs: (resolveLast(applied, "cooldownMs") ?? definition.cooldownMs) / attackSpeed,
    projectileSpeed:
      (definition.projectileSpeed ?? 400) * resolveProduct(applied, "projectileSpeedMultiplier") * aura.projectileSpeedMultiplier,
    predictiveAim: applied.some((upgrade) => upgrade.predictiveAim),
    pierceDamages: resolveLast(applied, "pierceDamages") ?? [damage],
    straightRicochet: applied.some((upgrade) => upgrade.straightRicochet),
    splash: resolveLast(applied, "splash") ?? null,
    chainDamages: resolveLast(applied, "chainDamages") ?? [damage],
    slowFactor: resolveLast(applied, "slowFactor") ?? definition.slowFactor ?? null,
    slowDurationMs: (resolveLast(applied, "slowDurationMs") ?? definition.slowDurationMs ?? 0) * aura.debuffDurationMultiplier,
    stun: resolveLast(applied, "stun") ?? null,
    electricField: resolveLast(applied, "electricField") ?? null,
    blocks,
    blockCapacity: blocks ? (resolveLast(applied, "blockCapacity") ?? definition.blockCapacity ?? 1) : 0,
    contactDamagePerSecond: resolveLast(applied, "contactDamagePerSecond") ?? definition.contactDamagePerSecond ?? 0,
    bossHold: resolveLast(applied, "bossHold") ?? null,
    armorPiercing: applied.some((upgrade) => upgrade.armorPiercing),
    vulnerability: vulnerability ? { ...vulnerability, durationMs: vulnerability.durationMs * aura.debuffDurationMultiplier } : null,
    areaAttack: applied.some((upgrade) => upgrade.areaAttack),
    spin: resolveLast(applied, "spin") ?? null,
    inkCloud: resolveLast(applied, "inkCloud") ?? null,
    providedAura: resolveLast(applied, "aura") ?? null,
    targeting: resolveLast(applied, "targeting") ?? definition.targeting ?? "leading",
    targetingShape: resolveLast(applied, "targetingShape") ?? definition.targetingShape ?? RADIAL,
    targetPriority: resolveLast(applied, "targetPriority") ?? definition.targetPriority ?? null,
    generatesPearls: resolveLast(applied, "generatesPearls") ?? definition.generatesPearls ?? null,
    dash: Boolean(definition.dash),
    frenzy: resolveLast(applied, "frenzy") ?? null,
    mark: resolveLast(applied, "mark") ?? null,
    blockHold: blocks ? (resolveLast(applied, "blockHold") ?? null) : null,
    flowField: resolveLast(applied, "flowField") ?? null,
    pushWave: resolveLast(applied, "pushWave") ?? null,
    trap,
    sonar: resolveLast(applied, "sonar") ?? definition.sonar ?? null,
    chorus: resolveLast(applied, "chorus") ?? null,
    abilityCooldownMultiplier: aura.abilityCooldownMultiplier,
    controlDurationMultiplier: aura.controlDurationMultiplier,
    debuffDurationMultiplier: aura.debuffDurationMultiplier,
    rearmMultiplier: aura.rearmMultiplier,
    dashSpeedMultiplier: aura.dashSpeedMultiplier,
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
