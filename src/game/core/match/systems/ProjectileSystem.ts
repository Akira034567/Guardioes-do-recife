import { GAME_HEIGHT, GAME_WIDTH } from "../../../constants";
import { GUARDIAN_BALANCE } from "../../../data/balance";
import type { CurrentSystem } from "../../CurrentSystem";
import type { DamageOptions } from "../../GuardianBehaviors";
import { ProjectileCore, type ProjectileTarget } from "../../ProjectileCore";
import type { MatchEnemy } from "../MatchEnemy";
import type { MatchEvent } from "../MatchEvents";
import type { MatchGuardian } from "../MatchGuardian";

export interface ProjectileView {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  rotation: number;
  radius: number;
}

interface Projectile extends ProjectileView {
  core: ProjectileCore;
}

export interface ProjectileContext {
  now: number;
  enemies: readonly MatchEnemy[];
  currents: CurrentSystem;
  damage(enemy: MatchEnemy, amount: number, options?: DamageOptions): void;
  emit(event: MatchEvent): void;
}

function snapshot(enemy: MatchEnemy): ProjectileTarget {
  return {
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    hitRadius: enemy.definition.hitRadius,
    velocity: enemy.velocity,
    alive: !enemy.dead && !enemy.reachedGoal,
  };
}

/** Projéteis físicos (Camarão). A física fica em `ProjectileCore`; aqui só o ciclo de vida e a deriva. */
export class ProjectileSystem {
  private readonly list: Projectile[] = [];
  private serial = 0;

  get projectiles(): readonly ProjectileView[] {
    return this.list;
  }

  fire(guardian: MatchGuardian, target: MatchEnemy, now: number, emit: (event: MatchEvent) => void): void {
    const stats = guardian.stats;
    const origin = { x: guardian.x + 22, y: guardian.y };
    const core = new ProjectileCore(origin, snapshot(target), {
      speed: stats.projectileSpeed,
      damages: stats.pierceDamages,
      predictiveAim: stats.predictiveAim,
      straightRicochet: stats.straightRicochet,
      ricochetRange: GUARDIAN_BALANCE["pistol-shrimp"].ricochetRange,
      splash: stats.splash ?? undefined,
      radius: 6,
      lifetimeMs: 2200,
      bounds: { minX: -80, maxX: GAME_WIDTH + 80, minY: -80, maxY: GAME_HEIGHT + 80 },
    });
    const id = `P${++this.serial}`;
    this.list.push({ id, ownerId: guardian.id, x: core.x, y: core.y, rotation: core.rotation, radius: 6, core });
    emit({ type: "projectileFired", now, id, ownerId: guardian.id, guardianId: guardian.guardianId, x: origin.x, y: origin.y });
  }

  update(deltaMs: number, context: ProjectileContext): void {
    const targets = context.enemies.map(snapshot);
    for (let index = this.list.length - 1; index >= 0; index -= 1) {
      const projectile = this.list[index];
      const result = projectile.core.step(deltaMs, targets);
      const drift = context.currents.projectileDrift(projectile.core, deltaMs / 1000);
      projectile.core.x += drift.x;
      projectile.core.y += drift.y;
      projectile.x = projectile.core.x;
      projectile.y = projectile.core.y;
      projectile.rotation = projectile.core.rotation;
      for (const hit of result.hits) {
        const enemy = context.enemies.find((candidate) => candidate.id === hit.targetId);
        if (!enemy) continue;
        context.emit({ type: "projectileHit", now: context.now, id: projectile.id, enemyId: enemy.id, x: enemy.x, y: enemy.y, splash: hit.splash });
        context.damage(enemy, hit.damage, { sourceId: projectile.ownerId, cause: hit.splash ? "splash" : "projectile" });
      }
      if (result.expired) {
        this.list.splice(index, 1);
        context.emit({ type: "projectileExpired", now: context.now, id: projectile.id });
      }
    }
  }
}
