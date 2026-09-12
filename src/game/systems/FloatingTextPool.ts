import Phaser from "phaser";
import { DEPTH } from "../constants";

export interface FloatingTextStyle {
  color: string;
  size: number;
  /** Sobe mais alto quando o número é importante. */
  rise?: number;
  durationMs?: number;
}

/**
 * Números que sobem e somem (dano, pérolas). Reaproveita os objetos de texto: uma onda cheia cria
 * dezenas por segundo e criar/destruir `Phaser.Text` a esse ritmo custa caro (item 45).
 */
export class FloatingTextPool {
  private readonly free: Phaser.GameObjects.Text[] = [];
  private readonly busy = new Set<Phaser.GameObjects.Text>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly capacity = 28,
  ) {}

  get activeCount(): number {
    return this.busy.size;
  }

  spawn(x: number, y: number, label: string, style: FloatingTextStyle): void {
    const text = this.take();
    // Sem folga no pool: o número mais antigo cede a vez em vez de estourar a memória.
    if (!text) return;
    const rise = style.rise ?? 26;
    const duration = style.durationMs ?? 620;
    text
      .setText(label)
      .setPosition(x, y)
      .setColor(style.color)
      .setFontSize(style.size)
      .setAlpha(1)
      .setScale(1)
      .setVisible(true)
      .setActive(true);
    this.scene.tweens.add({ targets: text, y: y - rise, duration, ease: "Quad.Out" });
    // O texto segura a opacidade e só então some: um branco meio apagado sobre a água vira borrão.
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: Math.round(duration * 0.4),
      delay: Math.round(duration * 0.6),
      ease: "Quad.In",
      onComplete: () => this.release(text),
    });
  }

  /** Recolhe tudo (troca de fase, reinício). */
  reset(): void {
    for (const text of [...this.busy]) {
      this.scene.tweens.killTweensOf(text);
      this.release(text);
    }
  }

  destroy(): void {
    this.reset();
    for (const text of this.free) text.destroy();
    this.free.length = 0;
  }

  private take(): Phaser.GameObjects.Text | null {
    const reused = this.free.pop();
    if (reused) {
      this.busy.add(reused);
      return reused;
    }
    if (this.busy.size >= this.capacity) return null;
    const created = this.scene.add
      .text(0, 0, "", { fontFamily: "Arial Black, Arial, sans-serif", fontSize: "16px", color: "#ffffff" })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.effects + 3)
      .setStroke("#031d2d", 4);
    this.busy.add(created);
    return created;
  }

  private release(text: Phaser.GameObjects.Text): void {
    if (!this.busy.delete(text)) return;
    text.setVisible(false).setActive(false);
    this.free.push(text);
  }
}
