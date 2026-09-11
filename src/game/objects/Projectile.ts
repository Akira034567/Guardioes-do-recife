import Phaser from "phaser";
import { DEPTH } from "../constants";
import { containsPoint, projectileDrift } from "../core/CurrentField";
import { ProjectileCore, type ProjectileConfig, type ProjectileTarget } from "../core/ProjectileCore";
import type { CurrentZoneDefinition } from "../types";
import type { Enemy } from "./Enemy";

export interface ProjectileHitResult {
  enemy: Enemy;
  damage: number;
  splash: boolean;
}

export interface ProjectileArt {
  /** Imagem do projétil (aponta para a direita) ou `null` para o círculo vetorial. */
  textureKey: string | null;
  scale: number;
  /** Imagem exibida no ponto de acerto, ou `null`. */
  impactKey: string | null;
  impactScale: number;
}

const DEFAULT_ART: ProjectileArt = { textureKey: null, scale: 0.5, impactKey: null, impactScale: 0.4 };

/** Casca Phaser do projétil: a física e as regras de acerto vivem em `ProjectileCore`. */
export class Projectile extends Phaser.GameObjects.Container {
  readonly radius: number;
  readonly textureKey: string | null;
  readonly impactKey: string | null;
  readonly impactScale: number;
  readonly core: ProjectileCore;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: Enemy,
    config: ProjectileConfig,
    art: ProjectileArt = DEFAULT_ART,
  ) {
    super(scene, x, y);
    this.radius = config.radius;
    this.core = new ProjectileCore({ x, y }, Projectile.snapshot(target), config);
    this.impactKey = art.impactKey && scene.textures.exists(art.impactKey) ? art.impactKey : null;
    this.impactScale = art.impactScale;

    if (art.textureKey && scene.textures.exists(art.textureKey)) {
      const sprite = new Phaser.GameObjects.Image(scene, 0, 0, art.textureKey);
      sprite.setScale(art.scale);
      this.add(sprite);
      this.textureKey = art.textureKey;
    } else {
      const fallback = new Phaser.GameObjects.Arc(scene, 0, 0, config.radius, 0, 360, false, 0x5ae8ff, 1);
      fallback.setStrokeStyle(2, 0xd8fbff, 1);
      this.add(fallback);
      this.textureKey = null;
    }

    this.setRotation(this.core.rotation);
    this.setDepth(DEPTH.projectiles);
    scene.add.existing(this);
  }

  get targetId(): string | null {
    return this.core.targetId;
  }

  tick(
    deltaMs: number,
    currents: readonly CurrentZoneDefinition[],
    currentReversed: boolean,
    enemies: readonly Enemy[],
  ): { hits: ProjectileHitResult[]; expired: boolean } {
    const result = this.core.step(deltaMs, enemies.map(Projectile.snapshot));

    const zone = currents.find((candidate) => containsPoint(candidate, this.core));
    if (zone) {
      const drift = projectileDrift(zone, deltaMs / 1000, currentReversed);
      this.core.x += drift.x;
      this.core.y += drift.y;
    }
    this.setPosition(this.core.x, this.core.y);
    this.setRotation(this.core.rotation);

    const hits: ProjectileHitResult[] = [];
    for (const hit of result.hits) {
      const enemy = enemies.find((candidate) => candidate.instanceId === hit.targetId);
      if (enemy) hits.push({ enemy, damage: hit.damage, splash: hit.splash });
    }
    return { hits, expired: result.expired };
  }

  private static snapshot(enemy: Enemy): ProjectileTarget {
    return {
      id: enemy.instanceId,
      x: enemy.x,
      y: enemy.y,
      hitRadius: enemy.definition.hitRadius,
      velocity: enemy.velocity,
      alive: !enemy.dead && !enemy.reachedGoal,
    };
  }
}
