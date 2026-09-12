import Phaser from "phaser";
import { DEPTH } from "../constants";
import type { InteractableSnapshot } from "../core/match/MatchSnapshot";

const COLORS = {
  locked: 0x3c5a68,
  available: 0xffe580,
  working: 0x8df3ff,
  done: 0x67f2ac,
} as const;

/**
 * Desenho de um elemento interativo do mapa (item 28): um anel que pulsa quando pode ser usado, a
 * argola de progresso por cima e o rótulo. Nenhuma regra aqui — o estado vem do motor.
 */
export class InteractableView extends Phaser.GameObjects.Container {
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly pulse: Phaser.GameObjects.Arc;
  private signature = "";

  constructor(
    scene: Phaser.Scene,
    private snapshot: InteractableSnapshot,
    onTap: () => void,
  ) {
    super(scene, snapshot.x, snapshot.y);
    this.ring = scene.add.graphics();
    this.pulse = scene.add.circle(0, 0, snapshot.radius, 0xffe580, 0.12);
    this.label = scene.add
      .text(0, -snapshot.radius - 14, snapshot.label, {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#f3fbff",
        align: "center",
        backgroundColor: "rgba(3, 29, 45, .78)",
        padding: { x: 6, y: 3 },
        wordWrap: { width: 190 },
      })
      .setOrigin(0.5, 1);
    this.add([this.pulse, this.ring, this.label]);
    this.setDepth(DEPTH.effects);
    this.setSize(snapshot.radius * 2, snapshot.radius * 2);
    this.setInteractive(new Phaser.Geom.Circle(snapshot.radius, snapshot.radius, snapshot.radius), Phaser.Geom.Circle.Contains);
    this.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onTap();
    });
    scene.add.existing(this);
    // Respiro lento enquanto está esperando o jogador.
    scene.tweens.add({ targets: this.pulse, scale: 1.25, alpha: 0.22, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.draw();
  }

  get id(): string {
    return this.snapshot.id;
  }

  sync(next: InteractableSnapshot): void {
    this.snapshot = next;
    this.setPosition(next.x, next.y);
    this.draw();
  }

  private draw(): void {
    const signature = `${this.snapshot.state}-${this.snapshot.progress.toFixed(2)}-${this.snapshot.hint}`;
    if (signature === this.signature) return;
    this.signature = signature;
    const color = COLORS[this.snapshot.state];
    const radius = this.snapshot.radius;

    this.ring.clear();
    this.ring.lineStyle(3, color, this.snapshot.state === "locked" ? 0.5 : 0.95);
    this.ring.strokeCircle(0, 0, radius);
    if (this.snapshot.progress > 0 && this.snapshot.state !== "done") {
      this.ring.lineStyle(5, 0xffffff, 0.9);
      this.ring.beginPath();
      this.ring.arc(0, 0, radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.snapshot.progress, false);
      this.ring.strokePath();
    }
    if (this.snapshot.state === "done") {
      this.ring.fillStyle(color, 0.18);
      this.ring.fillCircle(0, 0, radius);
    }

    this.pulse.setVisible(this.snapshot.state === "available" || this.snapshot.state === "working");
    this.pulse.setFillStyle(color, 0.14);
    this.label.setText(this.snapshot.hint);
    this.label.setAlpha(this.snapshot.state === "locked" ? 0.6 : 1);
    this.setAlpha(this.snapshot.state === "done" ? 0.75 : 1);
    if (this.snapshot.state === "done") this.disableInteractive();
  }
}
