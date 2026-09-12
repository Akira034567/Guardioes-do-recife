import { EnemyStatus } from "../../src/game/core/EnemyStatus";
import type { BehaviorEnemy, BehaviorGuardian } from "../../src/game/core/GuardianBehaviors";
import { GuardianRuntime } from "../../src/game/core/GuardianRuntime";
import { resolveGuardianStats, type GuardianStats } from "../../src/game/core/GuardianStats";
import { ENEMIES } from "../../src/game/data/enemies";
import { GUARDIANS } from "../../src/game/data/guardians";
import type { BranchId, EnemyDefinition, EnemyId, GuardianId } from "../../src/game/types";

/** Inimigo de teste em uma rota reta horizontal: `x` = distância na rota, `y` = 0. */
export class FakeEnemy implements BehaviorEnemy {
  x: number;
  y = 0;
  health: number;
  dead = false;
  reachedGoal = false;
  blockedById: string | null = null;
  readonly status: EnemyStatus;
  readonly definition: EnemyDefinition;
  pathDistance: number;
  readonly totalLength = 2000;

  constructor(
    readonly id: string,
    enemyId: EnemyId,
    pathDistance = 100,
    overrides: Partial<EnemyDefinition> = {},
  ) {
    this.definition = { ...ENEMIES[enemyId], ...overrides };
    this.status = new EnemyStatus(this.definition.slowResistance ?? 0);
    this.health = this.definition.maxHealth;
    this.pathDistance = pathDistance;
    this.x = pathDistance;
  }

  get progress(): number {
    return this.pathDistance / this.totalLength;
  }

  get isBlockable(): boolean {
    return !this.definition.unblockable;
  }

  setPathDistance(distance: number): void {
    this.pathDistance = Math.max(0, Math.min(this.totalLength, distance));
    this.x = this.pathDistance;
  }

  setBlocked(blockerId: string, stopDistance: number): void {
    this.blockedById = blockerId;
    this.setPathDistance(stopDistance);
  }

  clearBlocked(): void {
    this.blockedById = null;
  }

  distanceTo(x: number, y: number): number {
    return Math.hypot(this.x - x, this.y - y);
  }
}

/** Guardião de teste com stats reais do catálogo e progresso configurável. */
export class FakeGuardian implements BehaviorGuardian {
  readonly runtime = new GuardianRuntime();
  targetId: string | null = null;
  attackSpeedBonus = 0;
  private cached: GuardianStats | null = null;

  constructor(
    readonly id: string,
    readonly guardianId: GuardianId,
    readonly x: number,
    readonly y: number,
    private branchId: BranchId | null = null,
    private upgradeLevel = 0,
    now = 0,
  ) {
    this.runtime.syncStats(this.stats, now);
  }

  get stats(): GuardianStats {
    if (!this.cached) {
      this.cached = resolveGuardianStats(GUARDIANS[this.guardianId], { branchId: this.branchId, upgradeLevel: this.upgradeLevel }, undefined, {
        attackSpeedBonus: this.attackSpeedBonus,
      });
    }
    return this.cached;
  }

  get range(): number {
    return this.stats.range;
  }

  get routeDistance(): number {
    return this.x;
  }

  upgrade(branchId: BranchId, level: number, now = 0): void {
    this.branchId = branchId;
    this.upgradeLevel = level;
    this.cached = null;
    this.runtime.syncStats(this.stats, now);
  }

  setAttackSpeedBonus(bonus: number): void {
    this.attackSpeedBonus = bonus;
    this.runtime.attackSpeedBonus = bonus;
    this.cached = null;
  }
}
