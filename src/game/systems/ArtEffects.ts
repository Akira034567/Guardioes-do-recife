import Phaser from "phaser";
import { DEPTH } from "../constants";

export interface BurstOptions {
  /** Escala final da imagem. */
  scale: number;
  durationMs?: number;
  rotation?: number;
  /** Gira um pouco enquanto some (redemoinhos, espirais). */
  spin?: boolean;
}

export interface RingOptions {
  durationMs?: number;
  spin?: boolean;
  alpha?: number;
}

/**
 * Efeitos de combate desenhados com as imagens das tabelas de upgrade ("Habilidade" e "Impacto").
 * Todo método devolve `false` quando a textura não existe, para o chamador manter o efeito vetorial antigo.
 */
export class ArtEffects {
  constructor(private readonly scene: Phaser.Scene) {}

  has(key: string | null | undefined): key is string {
    return Boolean(key) && this.scene.textures.exists(key as string);
  }

  /** Surge no ponto, cresce um pouco e some. */
  burst(key: string | null, x: number, y: number, options: BurstOptions): boolean {
    if (!this.has(key)) return false;
    const { scale, durationMs = 320, rotation = 0, spin = false } = options;
    const image = this.scene.add
      .image(x, y, key)
      .setDepth(DEPTH.effects)
      .setScale(scale * 0.8)
      .setRotation(rotation)
      .setAlpha(0.96);
    this.scene.tweens.add({
      targets: image,
      scale: scale * 1.08,
      alpha: 0,
      angle: spin ? image.angle + 45 : image.angle,
      duration: durationMs,
      ease: "Quad.Out",
      onComplete: () => image.destroy(),
    });
    return true;
  }

  /** Esticada do ponto A ao ponto B. A imagem original aponta para a direita. */
  beam(key: string | null, fromX: number, fromY: number, toX: number, toY: number, thickness: number, durationMs = 240): boolean {
    if (!this.has(key)) return false;
    const frame = this.scene.textures.getFrame(key);
    const length = Math.max(24, Math.hypot(toX - fromX, toY - fromY));
    const image = this.scene.add
      .image((fromX + toX) / 2, (fromY + toY) / 2, key)
      .setDepth(DEPTH.effects)
      .setRotation(Math.atan2(toY - fromY, toX - fromX))
      .setScale(length / frame.width, thickness)
      .setAlpha(0.95);
    this.scene.tweens.add({ targets: image, alpha: 0, duration: durationMs, ease: "Quad.In", onComplete: () => image.destroy() });
    return true;
  }

  /** Centrada no ponto, com largura igual ao diâmetro; expande levemente e some. */
  ring(key: string | null, x: number, y: number, diameter: number, options: RingOptions = {}): boolean {
    if (!this.has(key)) return false;
    const { durationMs = 380, spin = false, alpha = 0.92 } = options;
    const scale = diameter / this.scene.textures.getFrame(key).width;
    const image = this.scene.add.image(x, y, key).setDepth(DEPTH.effects).setScale(scale * 0.7).setAlpha(alpha);
    this.scene.tweens.add({
      targets: image,
      scale: scale * 1.05,
      alpha: 0,
      angle: spin ? 60 : 0,
      duration: durationMs,
      ease: "Quad.Out",
      onComplete: () => image.destroy(),
    });
    return true;
  }

  /** Imagem que fica no mapa (campo elétrico, nuvem de tinta): quem chama controla alpha e destroi. */
  persistent(key: string | null, x: number, y: number, diameter: number): Phaser.GameObjects.Image | null {
    if (!this.has(key)) return null;
    const scale = diameter / this.scene.textures.getFrame(key).width;
    return this.scene.add.image(x, y, key).setDepth(DEPTH.effects - 1).setScale(scale).setAlpha(0.85);
  }
}
