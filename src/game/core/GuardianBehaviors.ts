import type { GuardianId, ToxicCloudEffect, Vec2 } from "../types";
import type { AuraSource } from "./Auras";
import type { BlockableEnemy } from "./Blocking";
import { distinctSpeciesInRange } from "./Chorus";
import { applyMarkTo, applyPoisonTo, applyStun, applyVulnerabilityTo, knockbackAlongPath } from "./CrowdControl";
import { flowFieldFor, type FlowField } from "./FlowField";
import type { GuardianStats } from "./GuardianStats";
import type { GuardianRuntime } from "./GuardianRuntime";
import type { SonarWave } from "./Sonar";
import { aliveInRange, isWounded, selectThreat, type TargetCandidate, type TargetPolicy } from "./Targeting";
import { trapChargeMultipliers, type TrapPhase } from "./TrapCore";

/**
 * Comportamentos dos Guardiões novos, sem Phaser, usados pela cena e pela simulação. Cada função
 * recebe as listas do runtime, altera estado de inimigos/Guardiões e devolve eventos para o visual.
 */

/** Inimigo visto pelos comportamentos (`Enemy` e `SimEnemy` satisfazem). */
// `pathDistance` vem de `BlockableEnemy` (obrigatório); em `TargetCandidate` ele é opcional.
export interface BehaviorEnemy extends BlockableEnemy, Omit<TargetCandidate, "definition" | "pathDistance" | "status"> {}

/** Guardião visto pelos comportamentos (`Guardian` e `SimGuardian` satisfazem). */
export interface BehaviorGuardian extends Vec2 {
  id: string;
  guardianId: GuardianId;
  stats: GuardianStats;
  range: number;
  runtime: GuardianRuntime;
  /** Alvo atual da FSM (para o Frenesi). */
  targetId: string | null;
  setAttackSpeedBonus(bonus: number): void;
}

/** Causa de um dano; a apresentação escolhe som/efeito por causa, o motor nunca sabe de áudio. */
export type DamageCause =
  | "projectile"
  | "splash"
  | "chain"
  | "pulse"
  | "melee"
  | "spin"
  | "ink"
  | "inkSecondary"
  | "sonar"
  | "trap"
  | "field"
  | "contact"
  | "poison"
  /** Ruptura de ponto fraco de chefe: o estrago interno, não um golpe de Guardião (item 11). */
  | "weakPoint";

export interface DamageOptions {
  sourceId?: string;
  armorPiercing?: boolean;
  continuous?: boolean;
  cause?: DamageCause;
}

export type BehaviorEvent =
  | { type: "trapPhase"; guardianId: string; phase: TrapPhase }
  | { type: "trapTrigger"; guardianId: string; x: number; y: number; radius: number; targetIds: string[]; chargeBonus: number }
  | { type: "mark"; guardianId: string; enemyId: string }
  | { type: "pushWave"; guardianId: string; x: number; y: number; radius: number; pushedIds: string[]; visualMs: number }
  | { type: "sonarWave"; guardianId: string; x: number; y: number; radius: number; wave: SonarWave; priorityId: string | null }
  | { type: "coordinate"; guardianId: string; targetId: string; guardianIds: string[] }
  | { type: "chorusStart"; guardianId: string; radius: number; durationMs: number }
  | { type: "stunned"; enemyId: string }
  | { type: "poisoned"; enemyId: string }
  | { type: "income"; guardianId: string; x: number; y: number; amount: number };

export interface BehaviorHooks<E extends BehaviorEnemy> {
  now: number;
  damage(enemy: E, amount: number, options?: DamageOptions): void;
  /** Credita pérolas geradas por um Guardião (Ostra). */
  earn?(amount: number, guardianId: string): void;
  spawnCloud?(ownerId: string, x: number, y: number, cloud: ToxicCloudEffect): void;
  /** Um inimigo saiu de um bloqueio por knockback (para o `BlockingSystem` não re-agarrar). */
  onEscaped?(blockerId: string, enemyId: string): void;
  emit?(event: BehaviorEvent): void;
}

// ------------------------------------------------------------------ alvo

/** Política de alvo efetiva de um Guardião agora (stats + presa marcada + coordenação do Sonar). */
export function targetPolicyFor(guardian: BehaviorGuardian, now: number): TargetPolicy {
  const { stats, runtime } = guardian;
  return {
    mode: stats.targeting,
    shape: stats.targetingShape,
    threshold: stats.frenzy?.healthThreshold,
    preferredId: runtime.preferredTargetId(now),
    markedId: stats.mark ? runtime.preyId : null,
    priority: stats.targetPriority ?? undefined,
  };
}

// ----------------------------------------------------------------- renda

/**
 * Geração periódica de pérolas (item 1). O primeiro pagamento sai depois de um intervalo cheio, e a
 * redução de recarga das auras (Coro) acelera a produção como qualquer outra habilidade.
 */
export function updateIncome<E extends BehaviorEnemy>(guardian: BehaviorGuardian, hooks: BehaviorHooks<E>): void {
  const income = guardian.stats.generatesPearls;
  if (!income || income.amount <= 0 || income.intervalMs <= 0) return;
  const intervalMs = income.intervalMs * guardian.stats.abilityCooldownMultiplier;
  if (!guardian.runtime.cooldown("income").tryActivate(hooks.now, intervalMs)) return;
  hooks.earn?.(income.amount, guardian.id);
  hooks.emit?.({ type: "income", guardianId: guardian.id, x: guardian.x, y: guardian.y, amount: income.amount });
}

// --------------------------------------------------------------- Tubarão

/** Frenesi: recalcula o bônus de velocidade de ataque a cada tick. */
export function updateFrenzy<E extends BehaviorEnemy>(guardian: BehaviorGuardian, enemies: readonly E[], now: number): void {
  void now;
  const frenzy = guardian.stats.frenzy;
  if (!frenzy) {
    guardian.setAttackSpeedBonus(0);
    return;
  }
  const pool = aliveInRange(enemies, guardian, guardian.range);
  const target = pool.find((enemy) => enemy.id === guardian.targetId) ?? null;
  let bonus = target && isWounded(target, frenzy.healthThreshold) ? frenzy.attackSpeedBonus : 0;
  if (frenzy.perWoundedBonus) {
    const wounded = pool.filter((enemy) => isWounded(enemy, frenzy.healthThreshold)).length;
    bonus += wounded * frenzy.perWoundedBonus;
  }
  if (frenzy.maxBonus !== undefined) bonus = Math.min(frenzy.maxBonus, bonus);
  guardian.setAttackSpeedBonus(bonus);
}

/** Caçador Alfa: mantém uma presa marcada; remarca quando o cooldown permite ou quando a presa cai. */
export function updateMark<E extends BehaviorEnemy>(guardian: BehaviorGuardian, enemies: readonly E[], hooks: BehaviorHooks<E>): void {
  const mark = guardian.stats.mark;
  const runtime = guardian.runtime;
  if (!mark) return;
  const now = hooks.now;
  const prey = runtime.preyId ? enemies.find((enemy) => enemy.id === runtime.preyId) : undefined;
  const preyGone = !prey || prey.dead || prey.reachedGoal || !prey.status.isMarked(now);
  if (preyGone && runtime.preyId) {
    if (mark.rearmOnDeath && prey && (prey.dead || prey.reachedGoal)) runtime.cooldown("mark").reset();
    runtime.preyId = null;
    runtime.preyStacks = 0;
  }
  if (runtime.preyId) return;
  const threat = selectThreat(enemies, guardian, guardian.range);
  if (!threat) return;
  if (!runtime.cooldown("mark").tryActivate(now, mark.cooldownMs * guardian.stats.abilityCooldownMultiplier)) return;
  applyMarkTo(threat, guardian.id, mark.damageMultiplier, mark.durationMs * guardian.stats.debuffDurationMultiplier, now);
  runtime.preyId = threat.id;
  runtime.preyStacks = 0;
  hooks.emit?.({ type: "mark", guardianId: guardian.id, enemyId: threat.id });
}

/** Golpe do Tubarão: acumula bônus contra a mesma presa (Alfa II). O dano em si usa `sourceId`. */
export function registerSharkHit<E extends BehaviorEnemy>(guardian: BehaviorGuardian, target: E, now: number): void {
  const mark = guardian.stats.mark;
  const runtime = guardian.runtime;
  if (mark?.stacking && runtime.preyId === target.id) {
    runtime.preyStacks = runtime.lastHitId === target.id ? runtime.preyStacks + 1 : 1;
    const extra = Math.min(mark.stacking.max, Math.max(0, runtime.preyStacks - 1) * mark.stacking.perHit);
    target.status.boostMark(guardian.id, mark.damageMultiplier * (1 + extra), now);
  } else if (runtime.lastHitId !== target.id) {
    runtime.preyStacks = 0;
  }
  runtime.lastHitId = target.id;
}

// ------------------------------------------------------------ Tartaruga

export function flowFieldsFor(guardians: readonly BehaviorGuardian[]): FlowField[] {
  const fields: FlowField[] = [];
  for (const guardian of guardians) {
    if (guardian.stats.flowField) fields.push(flowFieldFor(guardian, guardian.stats.flowField, guardian.range));
  }
  return fields;
}

/** Repulsa Ancestral / Corrente Forte: empurra todo mundo na zona para trás na rota. */
export function updatePushWave<E extends BehaviorEnemy>(guardian: BehaviorGuardian, enemies: readonly E[], hooks: BehaviorHooks<E>): void {
  const wave = guardian.stats.pushWave;
  if (!wave) return;
  const now = hooks.now;
  const radius = guardian.range * (guardian.stats.flowField?.radiusMultiplier ?? 1);
  const pool = aliveInRange(enemies, guardian, radius);
  if (pool.length === 0) return;
  if (!guardian.runtime.cooldown("pushWave").tryActivate(now, wave.cooldownMs * guardian.stats.abilityCooldownMultiplier)) return;
  const pushed: string[] = [];
  for (const enemy of pool) {
    const blocker = enemy.blockedById;
    const result = knockbackAlongPath(enemy, wave.distance, now, {
      eliteFactor: wave.eliteFactor,
      bossSlow: wave.bossSlow,
      durationMultiplier: guardian.stats.controlDurationMultiplier,
    });
    if (result === "pushed") {
      pushed.push(enemy.id);
      if (blocker) hooks.onEscaped?.(blocker, enemy.id);
    }
  }
  hooks.emit?.({ type: "pushWave", guardianId: guardian.id, x: guardian.x, y: guardian.y, radius, pushedIds: pushed, visualMs: wave.visualMs });
}

// ----------------------------------------------------------- Peixe-Pedra

/** Armadilha: avança a máquina de estados e resolve o disparo. */
export function updateTrap<E extends BehaviorEnemy>(guardian: BehaviorGuardian, enemies: readonly E[], hooks: BehaviorHooks<E>): void {
  const trap = guardian.stats.trap;
  const core = guardian.runtime.trap;
  if (!trap || !core) return;
  const now = hooks.now;
  const inRadius = aliveInRange(enemies, guardian, trap.triggerRadius);
  for (const event of core.update(now, inRadius.length, guardian.stats.rearmMultiplier)) {
    if (event.type === "phase") {
      hooks.emit?.({ type: "trapPhase", guardianId: guardian.id, phase: event.phase });
      continue;
    }
    const multipliers = trapChargeMultipliers(trap, event.chargeBonus);
    const controlMultiplier = multipliers.control * guardian.stats.controlDurationMultiplier;
    for (const enemy of inRadius) {
      if (trap.damage > 0) hooks.damage(enemy, trap.damage * multipliers.damage, { sourceId: guardian.id, cause: "trap" });
      if (trap.poison) {
        applyPoisonTo(enemy, trap.poison, now, guardian.stats.debuffDurationMultiplier);
        hooks.emit?.({ type: "poisoned", enemyId: enemy.id });
      }
      if (trap.stun) {
        const applied = applyStun(enemy, trap.stun.durationMs, now, {
          eliteFactor: trap.stun.eliteFactor,
          bossFactor: trap.stun.bossFactor,
          durationMultiplier: controlMultiplier,
        });
        if (applied > 0) hooks.emit?.({ type: "stunned", enemyId: enemy.id });
      }
      if (trap.knockback) {
        const blocker = enemy.blockedById;
        const result = knockbackAlongPath(enemy, trap.knockback.distance, now, { eliteFactor: trap.knockback.eliteFactor, bossSlow: null });
        if (result === "pushed" && blocker) hooks.onEscaped?.(blocker, enemy.id);
      }
    }
    if (trap.cloud) hooks.spawnCloud?.(guardian.id, guardian.x, guardian.y, trap.cloud);
    hooks.emit?.({
      type: "trapTrigger",
      guardianId: guardian.id,
      x: guardian.x,
      y: guardian.y,
      radius: trap.triggerRadius,
      targetIds: inRadius.map((enemy) => enemy.id),
      chargeBonus: event.chargeBonus,
    });
  }
}

// -------------------------------------------------------------- Golfinho

/** Pulso de sonar: revela, aplica vulnerabilidade, marca prioridade e (Eco Perfeito) coordena aliados. */
export function updateSonar<E extends BehaviorEnemy>(
  guardian: BehaviorGuardian,
  enemies: readonly E[],
  guardians: readonly BehaviorGuardian[],
  hooks: BehaviorHooks<E>,
): void {
  const sonar = guardian.stats.sonar;
  const core = guardian.runtime.sonar;
  if (!sonar || !core) return;
  const now = hooks.now;
  const radius = core.radius(guardian.range);
  const pool = aliveInRange(enemies, guardian, radius);
  for (const wave of core.update(now, pool.length, guardian.stats.abilityCooldownMultiplier)) {
    const priority = wave.priority || wave.coordinate ? selectThreat(pool, guardian, radius) : undefined;
    for (const enemy of pool) {
      if (wave.reveal) enemy.status.reveal(sonar.revealMs * guardian.stats.debuffDurationMultiplier, now);
      if (wave.vulnerability) {
        applyVulnerabilityTo(enemy, sonar.vulnerability.multiplier, sonar.vulnerability.durationMs * guardian.stats.debuffDurationMultiplier, now);
      }
    }
    if (wave.priority && priority) priority.status.flagPriority(sonar.vulnerability.durationMs * guardian.stats.debuffDurationMultiplier, now);
    let coordinated: string[] = [];
    if (wave.coordinate && priority && sonar.echo) {
      const until = now + sonar.echo.coordinateMs;
      coordinated = guardians
        .filter((ally) => Math.hypot(ally.x - guardian.x, ally.y - guardian.y) <= radius)
        .map((ally) => {
          ally.runtime.preferredTarget = { id: priority.id, until };
          return ally.id;
        });
      hooks.emit?.({ type: "coordinate", guardianId: guardian.id, targetId: priority.id, guardianIds: coordinated });
    }
    hooks.emit?.({ type: "sonarWave", guardianId: guardian.id, x: guardian.x, y: guardian.y, radius, wave, priorityId: priority?.id ?? null });
  }
}

/** Coro: tenta cantar e devolve a fonte de aura ativa (ou null). */
export function updateChorus(guardian: BehaviorGuardian, guardians: readonly BehaviorGuardian[], now: number, emit?: (event: BehaviorEvent) => void): AuraSource | null {
  const chorus = guardian.runtime.chorus;
  if (!chorus || !guardian.stats.chorus) return null;
  const radius = chorus.radius(guardian.range);
  const allies = guardians.filter((ally) => ally.id !== guardian.id && Math.hypot(ally.x - guardian.x, ally.y - guardian.y) <= radius);
  if (chorus.update(now, allies.length, guardian.stats.abilityCooldownMultiplier)) {
    emit?.({ type: "chorusStart", guardianId: guardian.id, radius, durationMs: guardian.stats.chorus.durationMs });
  }
  const species = distinctSpeciesInRange(guardian, radius, guardians);
  return chorus.asAuraSource(guardian, guardian.range, species, now);
}
