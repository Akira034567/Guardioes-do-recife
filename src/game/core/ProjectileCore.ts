import type { Vec2 } from "../types";
import { predictInterceptPoint, projectileTurnRate } from "./Combat";

export interface ProjectileTarget extends Vec2 {
  id: string;
  hitRadius: number;
  velocity: Vec2;
  alive: boolean;
}

export interface ProjectileConfig {
  speed: number;
  /** Dano de cada acerto sucessivo; o tamanho define quantos alvos o disparo pode atingir. */
  damages: number[];
  predictiveAim: boolean;
  /** Após atravessar, mira em linha reta no próximo alvo novo e não faz mais curvas. */
  straightRicochet: boolean;
  ricochetRange: number;
  splash?: { radius: number; damageMultiplier: number };
  radius: number;
  lifetimeMs: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface ProjectileHit {
  targetId: string;
  damage: number;
  splash: boolean;
}

export interface ProjectileStepResult {
  hits: ProjectileHit[];
  expired: boolean;
}

const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
const MAX_SUBSTEP_MS = 20;

/**
 * Simulação pura do projétil do Camarão. Regra global: um mesmo disparo nunca
 * acerta o mesmo inimigo duas vezes (`hitIds`). Sem dependência de Phaser para
 * permitir testes de colisão determinísticos.
 */
export class ProjectileCore {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  targetId: string | null;
  readonly hitIds = new Set<string>();
  lifetimeMs = 0;
  /** Falso após um ricochete reto: o projétil segue em linha até acertar ou expirar. */
  homing = true;

  constructor(origin: Vec2, target: ProjectileTarget, readonly config: ProjectileConfig) {
    this.x = origin.x;
    this.y = origin.y;
    this.targetId = target.id;
    const aim = config.predictiveAim ? predictInterceptPoint(origin, target, config.speed) : target;
    const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
    this.velocityX = Math.cos(angle) * config.speed;
    this.velocityY = Math.sin(angle) * config.speed;
  }

  get hitCount(): number {
    return this.hitIds.size;
  }

  get remainingHits(): number {
    return Math.max(0, this.config.damages.length - this.hitCount);
  }

  get rotation(): number {
    return Math.atan2(this.velocityY, this.velocityX);
  }

  /**
   * Avança o projétil. Quadros longos são divididos em sub-passos de até
   * `MAX_SUBSTEP_MS` para a colisão não pular inimigos em máquinas lentas.
   */
  step(deltaMs: number, targets: readonly ProjectileTarget[]): ProjectileStepResult {
    const substeps = Math.max(1, Math.ceil(deltaMs / MAX_SUBSTEP_MS));
    if (substeps === 1) return this.advance(deltaMs, targets);
    const hits: ProjectileHit[] = [];
    for (let index = 0; index < substeps; index += 1) {
      const result = this.advance(deltaMs / substeps, targets);
      hits.push(...result.hits);
      if (result.expired) return { hits, expired: true };
    }
    return { hits, expired: false };
  }

  private advance(deltaMs: number, targets: readonly ProjectileTarget[]): ProjectileStepResult {
    const deltaSeconds = deltaMs / 1000;
    this.lifetimeMs += deltaMs;
    this.steer(deltaSeconds, targets);
    this.x += this.velocityX * deltaSeconds;
    this.y += this.velocityY * deltaSeconds;

    const hits: ProjectileHit[] = [];
    for (const target of targets) {
      if (this.remainingHits <= 0) break;
      if (!this.canHit(target)) continue;
      if (Math.hypot(this.x - target.x, this.y - target.y) > this.config.radius + target.hitRadius) continue;

      const damage = this.config.damages[this.hitCount];
      this.hitIds.add(target.id);
      hits.push({ targetId: target.id, damage, splash: false });
      if (this.config.splash) hits.push(...this.splashHits(target, damage, targets));
      if (this.remainingHits > 0) this.retarget(targets);
    }

    const { bounds } = this.config;
    const outOfBounds = this.x < bounds.minX || this.x > bounds.maxX || this.y < bounds.minY || this.y > bounds.maxY;
    return {
      hits,
      expired: this.remainingHits <= 0 || this.lifetimeMs >= this.config.lifetimeMs || outOfBounds,
    };
  }

  private canHit(target: ProjectileTarget): boolean {
    return target.alive && !this.hitIds.has(target.id);
  }

  private steer(deltaSeconds: number, targets: readonly ProjectileTarget[]): void {
    if (!this.homing || !this.targetId) return;
    const tracked = targets.find((target) => target.id === this.targetId && this.canHit(target));
    if (!tracked) return;
    const aim = this.config.predictiveAim ? predictInterceptPoint(this, tracked, this.config.speed) : tracked;
    const currentAngle = this.rotation;
    const desiredAngle = Math.atan2(aim.y - this.y, aim.x - this.x);
    const maxTurn = projectileTurnRate(this.config.predictiveAim, this.hitCount) * deltaSeconds;
    const difference = wrapAngle(desiredAngle - currentAngle);
    const newAngle = currentAngle + Math.max(-maxTurn, Math.min(maxTurn, difference));
    this.velocityX = Math.cos(newAngle) * this.config.speed;
    this.velocityY = Math.sin(newAngle) * this.config.speed;
  }

  private splashHits(center: ProjectileTarget, damage: number, targets: readonly ProjectileTarget[]): ProjectileHit[] {
    const splash = this.config.splash;
    if (!splash) return [];
    const hits: ProjectileHit[] = [];
    for (const other of targets) {
      if (!this.canHit(other)) continue;
      if (Math.hypot(other.x - center.x, other.y - center.y) > splash.radius + other.hitRadius) continue;
      this.hitIds.add(other.id);
      hits.push({ targetId: other.id, damage: damage * splash.damageMultiplier, splash: true });
    }
    return hits;
  }

  /** Escolhe o alvo novo mais próximo dentro do alcance de ricochete. */
  private retarget(targets: readonly ProjectileTarget[]): void {
    const next = targets
      .filter((candidate) => this.canHit(candidate))
      .map((candidate) => ({ candidate, distance: Math.hypot(candidate.x - this.x, candidate.y - this.y) }))
      .filter(({ distance }) => distance <= this.config.ricochetRange)
      .sort((first, second) => first.distance - second.distance)[0]?.candidate;

    if (!next) {
      this.targetId = null;
      return;
    }
    this.targetId = next.id;
    if (this.config.straightRicochet) {
      const angle = Math.atan2(next.y - this.y, next.x - this.x);
      this.velocityX = Math.cos(angle) * this.config.speed;
      this.velocityY = Math.sin(angle) * this.config.speed;
      this.homing = false;
    }
  }
}
