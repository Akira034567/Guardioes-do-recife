import Phaser from "phaser";
import { DEPTH } from "../constants";
import { normalizedDirection } from "../core/CurrentField";
import type { RoutePath } from "../core/RoutePath";
import type { CurrentZoneDefinition, DebugFlags } from "../types";
import type { Enemy } from "../objects/Enemy";
import type { Guardian } from "../objects/Guardian";
import type { Projectile } from "../objects/Projectile";

export class DebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly route: RoutePath) {
    this.graphics = scene.add.graphics().setDepth(DEPTH.debug);
  }

  render(
    flags: DebugFlags,
    guardians: readonly Guardian[],
    enemies: readonly Enemy[],
    projectiles: readonly Projectile[],
    currents: readonly CurrentZoneDefinition[],
    currentReversed: boolean,
    selectedGuardianId: string | null,
  ): void {
    this.graphics.clear();
    this.labels.forEach((label) => label.destroy());
    this.labels = [];
    if (!flags.enabled) return;

    if (flags.route) this.drawRoute();
    if (flags.current) this.drawCurrents(currents, currentReversed);

    if (flags.ranges) {
      guardians.forEach((guardian) => {
        const selected = guardian.instanceId === selectedGuardianId;
        this.graphics.lineStyle(selected ? 3 : 1, selected ? 0xffe36e : 0x72ddff, selected ? 0.9 : 0.42);
        this.graphics.strokeCircle(guardian.x, guardian.y, guardian.range);
      });
    }

    if (flags.hitboxes) {
      this.graphics.lineStyle(2, 0x6dff8a, 0.9);
      guardians.forEach((guardian) => this.graphics.strokeCircle(guardian.x, guardian.y, 34));
      this.graphics.lineStyle(2, 0xff6a79, 0.9);
      enemies.forEach((enemy) => this.graphics.strokeCircle(enemy.x, enemy.y, enemy.definition.hitRadius));
      this.graphics.lineStyle(2, 0xffef73, 0.9);
      projectiles.forEach((projectile) => this.graphics.strokeCircle(projectile.x, projectile.y, projectile.radius));
    }

    if (flags.targets) {
      this.graphics.lineStyle(1, 0xffffff, 0.7);
      guardians.forEach((guardian) => {
        const target = enemies.find((enemy) => enemy.instanceId === guardian.targetId);
        if (target) this.graphics.lineBetween(guardian.x, guardian.y, target.x, target.y);
      });
    }

    if (flags.states) {
      guardians.forEach((guardian) => {
        this.addLabel(
          guardian.x,
          guardian.y - 55,
          `${guardian.guardianState}${guardian.targetId ? ` → ${guardian.targetId}` : ""}`,
          0x9df2ff,
        );
      });
      enemies.forEach((enemy) => {
        this.addLabel(
          enemy.x,
          enemy.y + enemy.definition.hitRadius + 10,
          `HP ${Math.ceil(enemy.health)} · ${enemy.effectiveSpeed.toFixed(0)}px/s · ${(enemy.progress * 100).toFixed(0)}%`,
          0xffd4db,
        );
      });
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.labels.forEach((label) => label.destroy());
  }

  private drawRoute(): void {
    this.graphics.lineStyle(3, 0xff4df3, 0.9);
    this.graphics.beginPath();
    this.route.points.forEach((point, index) => {
      if (index === 0) this.graphics.moveTo(point.x, point.y);
      else this.graphics.lineTo(point.x, point.y);
    });
    this.graphics.strokePath();

    this.route.points.forEach((point, index) => {
      this.graphics.fillStyle(index === 0 ? 0x5cff91 : index === this.route.points.length - 1 ? 0xff5c67 : 0xff4df3, 1);
      this.graphics.fillCircle(point.x, point.y, 5);
      this.addLabel(point.x, point.y - 15, index === 0 ? "SPAWN" : index === this.route.points.length - 1 ? "RECIFE" : `P${index}`, 0xffaff7);
      if (index < this.route.points.length - 1) {
        const next = this.route.points[index + 1];
        this.drawArrow((point.x + next.x) / 2, (point.y + next.y) / 2, next.x - point.x, next.y - point.y, 0xff4df3);
      }
    });
  }

  private drawCurrents(currents: readonly CurrentZoneDefinition[], reversed: boolean): void {
    currents.forEach((current) => {
      this.graphics.lineStyle(2, reversed ? 0xff8b5f : 0x5ce7ff, 0.95);
      this.graphics.fillStyle(reversed ? 0xff654a : 0x36cfea, 0.12);
      this.graphics.fillRect(current.x, current.y, current.width, current.height);
      this.graphics.strokeRect(current.x, current.y, current.width, current.height);
      const direction = normalizedDirection(current, reversed);
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          this.drawArrow(
            current.x + 35 + column * 58,
            current.y + 30 + row * 45,
            direction.x,
            direction.y,
            reversed ? 0xff8b5f : 0x5ce7ff,
          );
        }
      }
      this.addLabel(current.x + current.width / 2, current.y - 12, `${reversed ? "REVERSA" : "FLUXO"} · ±${current.speedModifier * 100}% · deriva ${current.projectileDrift}`, reversed ? 0xffad93 : 0x8ff2ff);
    });
  }

  private drawArrow(x: number, y: number, dx: number, dy: number, color: number): void {
    const angle = Math.atan2(dy, dx);
    const length = 22;
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;
    this.graphics.lineStyle(2, color, 0.9);
    this.graphics.lineBetween(x, y, endX, endY);
    this.graphics.lineBetween(endX, endY, endX - Math.cos(angle - 0.55) * 7, endY - Math.sin(angle - 0.55) * 7);
    this.graphics.lineBetween(endX, endY, endX - Math.cos(angle + 0.55) * 7, endY - Math.sin(angle + 0.55) * 7);
  }

  private addLabel(x: number, y: number, text: string, color: number): void {
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: `#${color.toString(16).padStart(6, "0")}`,
        backgroundColor: "rgba(0, 14, 24, .78)",
        padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.debug + 1);
    this.labels.push(label);
  }
}
