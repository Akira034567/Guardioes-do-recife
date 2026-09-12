import type { EnemyDefinition, Vec2 } from "../../types";
import { mitigatedDamage } from "../Combat";
import type { CurrentSystem } from "../CurrentSystem";
import { EnemyStatus } from "../EnemyStatus";
import type { DamageOptions } from "../GuardianBehaviors";
import type { RoutePath } from "../RoutePath";

export interface DamageOutcome {
  /** Dano efetivamente descontado da vida. */
  applied: number;
  killed: boolean;
}

/**
 * Inimigo da partida: só estado e regras (posição na rota, vida, status). Nada de Phaser; a
 * apresentação lê `x/y/heading/health` e desenha. Satisfaz `BehaviorEnemy`, `ControlTarget`,
 * `BlockableEnemy` e `TargetCandidate`.
 */
export class MatchEnemy {
  x: number;
  y: number;
  health: number;
  pathDistance = 0;
  effectiveSpeed: number;
  /** Direção do movimento em radianos (para a apresentação girar o corpo). */
  heading = 0;
  dead = false;
  reachedGoal = false;
  blockedById: string | null = null;
  readonly status: EnemyStatus;
  private now = 0;

  constructor(
    readonly id: string,
    readonly definition: EnemyDefinition,
    readonly route: RoutePath,
    readonly pathId: string,
  ) {
    const start = route.getPointAtDistance(0);
    this.x = start.x;
    this.y = start.y;
    this.health = definition.maxHealth;
    this.effectiveSpeed = definition.speed;
    this.status = new EnemyStatus(definition.slowResistance ?? 0);
    const tangent = route.getTangentAtDistance(0);
    this.heading = Math.atan2(tangent.y, tangent.x);
  }

  get alive(): boolean {
    return !this.dead && !this.reachedGoal;
  }

  get progress(): number {
    return this.route.getProgress(this.pathDistance);
  }

  get velocity(): Vec2 {
    if (this.blockedById) return { x: 0, y: 0 };
    const tangent = this.route.getTangentAtDistance(this.pathDistance);
    return { x: tangent.x * this.effectiveSpeed, y: tangent.y * this.effectiveSpeed };
  }

  get isBlockable(): boolean {
    return !this.definition.unblockable;
  }

  setBlocked(blockerId: string, stopDistance: number): void {
    this.blockedById = blockerId;
    this.setPathDistance(stopDistance);
    this.effectiveSpeed = 0;
  }

  clearBlocked(): void {
    this.blockedById = null;
  }

  /** Move ao longo da rota (clampado) e atualiza a posição. */
  setPathDistance(distance: number): void {
    this.pathDistance = Math.max(0, Math.min(this.route.totalLength, distance));
    const point = this.route.getPointAtDistance(this.pathDistance);
    this.x = point.x;
    this.y = point.y;
  }

  /** Avança um passo; devolve true no instante em que chega ao Recife. */
  tick(now: number, deltaMs: number, currents: CurrentSystem): boolean {
    if (this.dead || this.reachedGoal) return false;
    this.now = now;
    this.status.update(now);
    const tangent = this.route.getTangentAtDistance(this.pathDistance);
    this.heading = Math.atan2(tangent.y, tangent.x);
    if (this.blockedById) {
      this.effectiveSpeed = 0;
      return false;
    }
    const currentMultiplier = currents.enemySpeedMultiplier(this, tangent, this.status.resistance("slow"));
    this.effectiveSpeed = this.definition.speed * this.status.speedMultiplier(now) * currentMultiplier;
    this.pathDistance += this.effectiveSpeed * (deltaMs / 1000);
    const point = this.route.getPointAtDistance(this.pathDistance);
    this.x = point.x;
    this.y = point.y;
    if (this.pathDistance >= this.route.totalLength) {
      this.reachedGoal = true;
      return true;
    }
    return false;
  }

  /** Dano de golpe: sofre armadura (salvo perfuração), vulnerabilidade e a marca da fonte. */
  takeDamage(rawDamage: number, options: DamageOptions = {}): DamageOutcome {
    if (this.dead || this.reachedGoal) return { applied: 0, killed: false };
    const base = options.armorPiercing ? Math.max(1, rawDamage) : mitigatedDamage(rawDamage, this.definition.armor);
    return this.loseHealth(base * this.status.damageMultiplier(this.now) * this.status.markMultiplier(options.sourceId, this.now));
  }

  /** Dano contínuo (contato, campos, veneno): ignora armadura, mas respeita vulnerabilidade e marca. */
  takeContinuousDamage(amount: number, options: DamageOptions = {}): DamageOutcome {
    if (this.dead || this.reachedGoal) return { applied: 0, killed: false };
    return this.loseHealth(Math.max(0, amount) * this.status.damageMultiplier(this.now) * this.status.markMultiplier(options.sourceId, this.now));
  }

  distanceTo(x: number, y: number): number {
    return Math.hypot(this.x - x, this.y - y);
  }

  private loseHealth(amount: number): DamageOutcome {
    const before = this.health;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
    return { applied: before - this.health, killed: this.dead };
  }
}
