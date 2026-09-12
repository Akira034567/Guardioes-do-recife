import Phaser from "phaser";
import { DEPTH } from "../constants";
import type { ProjectileView as ProjectileState } from "../core/match/systems/ProjectileSystem";

export interface ProjectileArt {
  /** Imagem do projétil (aponta para a direita) ou `null` para o círculo vetorial. */
  textureKey: string | null;
  scale: number;
  /** Imagem exibida no ponto de acerto, ou `null`. */
  impactKey: string | null;
  impactScale: number;
}

/** Casca visual do projétil: posição e rotação vêm do motor a cada frame. */
export class ProjectileView extends Phaser.GameObjects.Container {
  readonly textureKey: string | null;
  readonly impactKey: string | null;
  readonly impactScale: number;

  constructor(
    scene: Phaser.Scene,
    readonly projectile: ProjectileState,
    art: ProjectileArt,
  ) {
    super(scene, projectile.x, projectile.y);
    this.impactKey = art.impactKey && scene.textures.exists(art.impactKey) ? art.impactKey : null;
    this.impactScale = art.impactScale;
    if (art.textureKey && scene.textures.exists(art.textureKey)) {
      const sprite = new Phaser.GameObjects.Image(scene, 0, 0, art.textureKey);
      sprite.setScale(art.scale);
      this.add(sprite);
      this.textureKey = art.textureKey;
    } else {
      const fallback = new Phaser.GameObjects.Arc(scene, 0, 0, projectile.radius, 0, 360, false, 0x5ae8ff, 1);
      fallback.setStrokeStyle(2, 0xd8fbff, 1);
      this.add(fallback);
      this.textureKey = null;
    }
    this.setRotation(projectile.rotation);
    this.setDepth(DEPTH.projectiles);
    scene.add.existing(this);
  }

  get id(): string {
    return this.projectile.id;
  }

  sync(): void {
    this.setPosition(this.projectile.x, this.projectile.y);
    this.setRotation(this.projectile.rotation);
  }
}
