import type { PoisonEffect, ToxicCloudEffect } from "../../../types";
import type { DamageOptions } from "../../GuardianBehaviors";
import type { MatchEnemy } from "../MatchEnemy";
import type { MatchEvent } from "../MatchEvents";
import type { MatchGuardian } from "../MatchGuardian";

export interface FieldView {
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  durationMs: number;
  expiresAt: number;
}

export interface CloudView extends FieldView {
  kind: "ink" | "toxic";
}

interface Field extends FieldView {
  nextPulseAt: number;
  pulseIntervalMs: number;
  damage: number;
  maxDamagePerTarget: number;
  slowFactor: number;
  slowDurationMs: number;
  damageDealt: Map<string, number>;
}

interface Cloud extends CloudView {
  slowFactor: number;
  vulnerabilityMultiplier: number;
  poison: PoisonEffect | null;
}

export interface AreaContext {
  now: number;
  enemies: readonly MatchEnemy[];
  damage(enemy: MatchEnemy, amount: number, options?: DamageOptions): void;
  emit(event: MatchEvent): void;
}

/**
 * Áreas persistentes criadas por Guardiões: campo elétrico (Água-viva) e nuvens (tinta do Polvo,
 * jardim tóxico do Peixe-Pedra). Uma por dono; substituir remove a anterior.
 */
export class AreaEffects {
  private readonly fieldList: Field[] = [];
  private readonly cloudList: Cloud[] = [];

  get fields(): readonly FieldView[] {
    return this.fieldList;
  }

  get clouds(): readonly CloudView[] {
    return this.cloudList;
  }

  createField(guardian: MatchGuardian, x: number, y: number, now: number, emit: (event: MatchEvent) => void): boolean {
    const definition = guardian.stats.electricField;
    if (!definition) return false;
    if (!guardian.runtime.cooldown("electricField").tryActivate(now, definition.cooldownMs * guardian.stats.abilityCooldownMultiplier)) return false;
    this.removeFieldsOf(guardian.id, now, emit);
    this.fieldList.push({
      ownerId: guardian.id,
      x,
      y,
      radius: definition.radius,
      durationMs: definition.durationMs,
      expiresAt: now + definition.durationMs,
      nextPulseAt: now,
      pulseIntervalMs: definition.pulseIntervalMs,
      damage: definition.damage,
      maxDamagePerTarget: definition.maxDamagePerTarget,
      slowFactor: definition.slowFactor,
      slowDurationMs: definition.slowDurationMs,
      damageDealt: new Map(),
    });
    emit({ type: "fieldCreated", now, ownerId: guardian.id, x, y, radius: definition.radius, durationMs: definition.durationMs });
    return true;
  }

  createInkCloud(guardian: MatchGuardian, x: number, y: number, now: number, emit: (event: MatchEvent) => void): boolean {
    const definition = guardian.stats.inkCloud;
    if (!definition) return false;
    if (!guardian.runtime.cooldown("inkCloud").tryActivate(now, definition.cooldownMs * guardian.stats.abilityCooldownMultiplier)) return false;
    this.replaceCloud(
      {
        kind: "ink",
        ownerId: guardian.id,
        x,
        y,
        radius: definition.radius,
        durationMs: definition.durationMs,
        expiresAt: now + definition.durationMs,
        slowFactor: definition.slowFactor,
        vulnerabilityMultiplier: definition.vulnerabilityMultiplier,
        poison: null,
      },
      now,
      emit,
    );
    return true;
  }

  createToxicCloud(ownerId: string, x: number, y: number, cloud: ToxicCloudEffect, now: number, emit: (event: MatchEvent) => void): void {
    this.replaceCloud(
      {
        kind: "toxic",
        ownerId,
        x,
        y,
        radius: cloud.radius,
        durationMs: cloud.durationMs,
        expiresAt: now + cloud.durationMs,
        slowFactor: 1,
        vulnerabilityMultiplier: 1,
        poison: cloud.poison,
      },
      now,
      emit,
    );
  }

  /** Remove tudo que pertence a um Guardião vendido. */
  removeOwner(ownerId: string, now: number, emit: (event: MatchEvent) => void): void {
    this.removeFieldsOf(ownerId, now, emit);
    for (let index = this.cloudList.length - 1; index >= 0; index -= 1) {
      if (this.cloudList[index].ownerId !== ownerId) continue;
      this.cloudList.splice(index, 1);
      emit({ type: "cloudExpired", now, ownerId });
    }
  }

  update(context: AreaContext): void {
    this.updateFields(context);
    this.updateClouds(context);
  }

  private updateFields(context: AreaContext): void {
    const { now } = context;
    for (let index = this.fieldList.length - 1; index >= 0; index -= 1) {
      const field = this.fieldList[index];
      if (now >= field.expiresAt) {
        this.fieldList.splice(index, 1);
        context.emit({ type: "fieldExpired", now, ownerId: field.ownerId });
        continue;
      }
      if (now < field.nextPulseAt) continue;
      field.nextPulseAt += field.pulseIntervalMs;
      const affected = context.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(field.x, field.y) <= field.radius);
      affected.forEach((enemy) => {
        const dealt = field.damageDealt.get(enemy.id) ?? 0;
        const allowed = Math.max(0, Math.min(field.damage, field.maxDamagePerTarget - dealt));
        if (allowed > 0) {
          field.damageDealt.set(enemy.id, dealt + allowed);
          context.damage(enemy, allowed, { continuous: true, sourceId: field.ownerId, cause: "field" });
        }
        enemy.status.applySlow(field.slowFactor, field.slowDurationMs, now);
      });
      if (affected.length > 0) {
        context.emit({ type: "fieldPulsed", now, ownerId: field.ownerId, x: field.x, y: field.y, radius: field.radius, hitCount: affected.length });
      }
    }
  }

  private updateClouds(context: AreaContext): void {
    const { now } = context;
    for (let index = this.cloudList.length - 1; index >= 0; index -= 1) {
      const cloud = this.cloudList[index];
      if (now >= cloud.expiresAt) {
        this.cloudList.splice(index, 1);
        context.emit({ type: "cloudExpired", now, ownerId: cloud.ownerId });
        continue;
      }
      context.enemies
        .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(cloud.x, cloud.y) <= cloud.radius)
        .forEach((enemy) => {
          if (cloud.slowFactor < 1) enemy.status.applySlow(cloud.slowFactor, 320, now);
          if (cloud.vulnerabilityMultiplier > 1) enemy.status.applyVulnerability(cloud.vulnerabilityMultiplier, 320, now);
          if (cloud.poison && !enemy.status.isPoisoned(now)) enemy.status.applyPoison(cloud.poison, now);
        });
    }
  }

  private removeFieldsOf(ownerId: string, now: number, emit: (event: MatchEvent) => void): void {
    for (let index = this.fieldList.length - 1; index >= 0; index -= 1) {
      if (this.fieldList[index].ownerId !== ownerId) continue;
      this.fieldList.splice(index, 1);
      emit({ type: "fieldExpired", now, ownerId });
    }
  }

  private replaceCloud(cloud: Cloud, now: number, emit: (event: MatchEvent) => void): void {
    for (let index = this.cloudList.length - 1; index >= 0; index -= 1) {
      if (this.cloudList[index].ownerId !== cloud.ownerId) continue;
      this.cloudList.splice(index, 1);
      emit({ type: "cloudExpired", now, ownerId: cloud.ownerId });
    }
    this.cloudList.push(cloud);
    emit({ type: "cloudCreated", now, ownerId: cloud.ownerId, kind: cloud.kind, x: cloud.x, y: cloud.y, radius: cloud.radius, durationMs: cloud.durationMs });
  }
}
