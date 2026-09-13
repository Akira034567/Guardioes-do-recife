import type { DamageOptions } from "../../GuardianBehaviors";
import { registerSharkHit } from "../../GuardianBehaviors";
import type { MatchEnemy } from "../MatchEnemy";
import type { MatchEvent } from "../MatchEvents";
import type { MatchGuardian } from "../MatchGuardian";

/** O que a resolução de um golpe precisa do motor. */
export interface CombatContext {
  now: number;
  enemies: readonly MatchEnemy[];
  damage(enemy: MatchEnemy, amount: number, options?: DamageOptions): void;
  fireProjectile(guardian: MatchGuardian, target: MatchEnemy): void;
  createField(guardian: MatchGuardian, x: number, y: number): void;
  createCloud(guardian: MatchGuardian, x: number, y: number): void;
  emit(event: MatchEvent): void;
}

function inRange(context: CombatContext, guardian: MatchGuardian, radius = guardian.range): MatchEnemy[] {
  return context.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= radius);
}

/**
 * Com a trava de alvo (item 16), o golpe se resolve mesmo com o alvo já fora do alcance — e aí o
 * `inRange` não o inclui mais. Sem esta garantia, um ataque confirmado acertaria ZERO justamente no
 * caso que a trava existe para consertar.
 */
function withLockedTarget(affected: MatchEnemy[], target: MatchEnemy): MatchEnemy[] {
  if (target.dead || target.reachedGoal || affected.includes(target)) return affected;
  return [target, ...affected];
}

function attacked(
  context: CombatContext,
  guardian: MatchGuardian,
  target: MatchEnemy,
  affected: readonly MatchEnemy[],
  radius: number,
  extra: { spinning?: boolean; stunApplied?: boolean } = {},
): void {
  context.emit({
    type: "guardianAttacked",
    now: context.now,
    id: guardian.id,
    guardianId: guardian.guardianId,
    kind: guardian.definition.attackKind,
    x: guardian.x,
    y: guardian.y,
    targetId: target.id,
    targetX: target.x,
    targetY: target.y,
    affectedIds: affected.map((enemy) => enemy.id),
    radius,
    spinning: extra.spinning ?? false,
    stunApplied: extra.stunApplied ?? false,
  });
}

/**
 * Resolve o impacto de um Guardião conforme `attackKind`. Fonte única para jogo e balanceamento:
 * a apresentação só recebe `guardianAttacked`/`projectileFired` e desenha.
 */
export function resolveAttack(context: CombatContext, guardian: MatchGuardian, target: MatchEnemy): void {
  const kind = guardian.definition.attackKind;
  switch (kind) {
    case "projectile":
      context.fireProjectile(guardian, target);
      return;
    case "chain":
      resolveChain(context, guardian, target);
      return;
    case "melee":
      resolveMelee(context, guardian, target);
      return;
    case "ink":
      resolveInk(context, guardian, target);
      return;
    case "sonar":
      resolveSonarHit(context, guardian, target);
      return;
    case "area":
      resolvePulse(context, guardian, target);
      return;
    case "trap":
      return;
    default: {
      const exhaustive: never = kind;
      throw new Error(`attackKind desconhecido: ${String(exhaustive)}`);
    }
  }
}

function resolveChain(context: CombatContext, guardian: MatchGuardian, target: MatchEnemy): void {
  const stats = guardian.stats;
  const damages = stats.chainDamages;
  // O alvo travado vem primeiro: é ele que leva o elo mais forte da corrente.
  const candidates = withLockedTarget(
    inRange(context, guardian).sort((a, b) => b.progress - a.progress),
    target,
  ).slice(0, damages.length);
  candidates.forEach((enemy, index) => {
    context.damage(enemy, damages[index] ?? damages[damages.length - 1], { sourceId: guardian.id, cause: "chain" });
    if (stats.slowFactor !== null) enemy.status.applySlow(stats.slowFactor, stats.slowDurationMs, context.now);
  });
  let stunApplied = false;
  if (stats.stun && !target.dead) stunApplied = target.status.tryStun(stats.stun.durationMs, stats.stun.immunityMs, context.now);
  attacked(context, guardian, target, candidates, guardian.range, { stunApplied });
  if (stats.electricField) context.createField(guardian, target.x, target.y);
}

function resolvePulse(context: CombatContext, guardian: MatchGuardian, target: MatchEnemy): void {
  const stats = guardian.stats;
  const affected = withLockedTarget(inRange(context, guardian), target);
  affected.forEach((enemy) => {
    context.damage(enemy, stats.damage, { sourceId: guardian.id, cause: "pulse" });
    if (stats.slowFactor !== null) enemy.status.applySlow(stats.slowFactor, stats.slowDurationMs, context.now);
  });
  attacked(context, guardian, target, affected, guardian.range);
}

function resolveMelee(context: CombatContext, guardian: MatchGuardian, target: MatchEnemy): void {
  const stats = guardian.stats;
  const spinning = stats.spin !== null && guardian.attacksPerformed % stats.spin.everyAttacks === 0;
  const radius = spinning && stats.spin ? guardian.range * stats.spin.radiusMultiplier : guardian.range;
  const damage = spinning && stats.spin ? stats.spin.damage : stats.damage;
  const targets = stats.areaAttack || spinning ? withLockedTarget(inRange(context, guardian, radius), target) : [target];
  if (stats.mark) registerSharkHit(guardian, target, context.now);
  targets.forEach((enemy) => {
    context.damage(enemy, damage, { armorPiercing: stats.armorPiercing, sourceId: guardian.id, cause: spinning ? "spin" : "melee" });
    if (stats.vulnerability) enemy.status.applyVulnerability(stats.vulnerability.multiplier, stats.vulnerability.durationMs, context.now);
    if (stats.slowFactor !== null) enemy.status.applySlow(stats.slowFactor, stats.slowDurationMs, context.now);
  });
  attacked(context, guardian, target, targets, radius, { spinning });
}

function resolveInk(context: CombatContext, guardian: MatchGuardian, target: MatchEnemy): void {
  const stats = guardian.stats;
  const vulnerability = stats.vulnerability;
  const affected = vulnerability?.radius
    ? context.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(target.x, target.y) <= (vulnerability.radius ?? 0))
    : [target];
  if (!affected.includes(target)) affected.push(target);
  affected.forEach((enemy) => {
    context.damage(enemy, enemy === target ? stats.damage : Math.ceil(stats.damage * 0.5), {
      sourceId: guardian.id,
      cause: enemy === target ? "ink" : "inkSecondary",
    });
    if (vulnerability) enemy.status.applyVulnerability(vulnerability.multiplier, vulnerability.durationMs, context.now);
  });
  attacked(context, guardian, target, affected, vulnerability?.radius ?? 0);
  if (stats.inkCloud) context.createCloud(guardian, target.x, target.y);
}

/** Golpe base do Golfinho: pulso fraco em um alvo. O sonar de área é uma habilidade separada. */
function resolveSonarHit(context: CombatContext, guardian: MatchGuardian, target: MatchEnemy): void {
  context.damage(target, guardian.stats.damage, { sourceId: guardian.id, cause: "sonar" });
  attacked(context, guardian, target, [target], 0);
}
