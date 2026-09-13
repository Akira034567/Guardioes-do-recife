import Phaser from "phaser";
import { DEPTH } from "../constants";
import { normalizedDirection } from "../core/CurrentField";
import type { FlowField } from "../core/FlowField";
import type { RoutePath } from "../core/RoutePath";
import type { CurrentZoneDefinition, DebugFlags } from "../types";
import type { MatchEnemy } from "../core/match/MatchEnemy";
import type { MatchGuardian } from "../core/match/MatchGuardian";
import type { ProjectileView } from "../core/match/systems/ProjectileSystem";

export interface PlacementDebugInfo {
  waterBounds: { x: number; y: number; width: number; height: number };
  waterRouteClearance: number;
  waterSeparation: number;
  routePlacementClearance: number;
  /** Faixa de margem (Tubarão): distâncias mínima e máxima da linha da rota. */
  marginBand: { min: number; max: number };
  platforms: Array<{ x: number; y: number }>;
  routeBlockers: Array<{ id: string; x: number; y: number; label: string }>;
}

export interface ControlDebugInfo {
  flowFields: readonly FlowField[];
  now: number;
}

export class DebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly route: RoutePath) {
    this.graphics = scene.add.graphics().setDepth(DEPTH.debug);
  }

  render(
    flags: DebugFlags,
    guardians: readonly MatchGuardian[],
    enemies: readonly MatchEnemy[],
    projectiles: readonly ProjectileView[],
    currents: readonly CurrentZoneDefinition[],
    currentReversed: boolean,
    selectedGuardianId: string | null,
    placementInfo: PlacementDebugInfo,
    controls: ControlDebugInfo,
  ): void {
    this.graphics.clear();
    this.labels.forEach((label) => label.destroy());
    this.labels = [];
    if (!flags.enabled) return;

    if (flags.route) this.strokeRouteLine();
    if (flags.routeNodes) this.drawRouteNodes();
    if (flags.current) this.drawCurrents(currents, currentReversed);
    if (flags.placements) this.drawPlacements(placementInfo, guardians);
    if (flags.controls) this.drawControls(controls, guardians, enemies);

    if (flags.ranges) {
      guardians.forEach((guardian) => {
        const selected = guardian.id === selectedGuardianId;
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
        const target = enemies.find((enemy) => enemy.id === guardian.targetId);
        if (target) this.graphics.lineBetween(guardian.x, guardian.y, target.x, target.y);
      });
    }

    if (flags.states) {
      guardians.forEach((guardian) => {
        const trap = guardian.trapPhase ? ` · ${guardian.trapPhase}` : "";
        const frenzy = guardian.runtime.attackSpeedBonus > 0 ? ` · +${Math.round(guardian.runtime.attackSpeedBonus * 100)}%` : "";
        const prey = guardian.runtime.preyId ? ` · presa ${guardian.runtime.preyId}` : "";
        this.addLabel(
          guardian.x,
          guardian.y - 55,
          `${guardian.state}${guardian.targetId ? ` → ${guardian.targetId}` : ""}${trap}${frenzy}${prey}`,
          0x9df2ff,
        );
      });
      enemies.forEach((enemy) => {
        const now = controls.now;
        const status = [
          enemy.blockedById ? `BLOQ ${enemy.blockedById}` : "",
          enemy.status.isStunned(now) ? "STUN" : "",
          enemy.status.poisonStacks(now) > 0 ? `VEN×${enemy.status.poisonStacks(now)}` : "",
          enemy.status.isMarked(now) ? `MARCA ${enemy.status.markedBy(now)}` : "",
          enemy.status.isPriority(now) ? "PRIORIDADE" : "",
          enemy.status.isControlImmune(now) ? "IMUNE CC" : "",
        ]
          .filter(Boolean)
          .join(" · ");
        this.addLabel(
          enemy.x,
          enemy.y + enemy.definition.hitRadius + 10,
          `HP ${Math.ceil(enemy.health)} · ${enemy.effectiveSpeed.toFixed(0)}px/s · ${(enemy.progress * 100).toFixed(0)}%${status ? ` · ${status}` : ""}`,
          0xffd4db,
        );
      });
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.labels.forEach((label) => label.destroy());
  }

  /** Só o traço da rota: onde os inimigos andam. */
  private strokeRouteLine(): void {
    this.graphics.lineStyle(3, 0xff4df3, 0.9);
    this.strokeRoute();
  }

  /**
   * Os nós que DEFINEM a rota. Isto é a estrutura de autoria do caminho aparecendo na tela, e já
   * vazou para o jogador uma vez — por isso mora atrás da própria flag, separada do traço.
   */
  private drawRouteNodes(): void {
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

  /** Zonas de corrente das Tartarugas (setas contra a rota) e alvos coordenados pelo Sonar. */
  private drawControls(controls: ControlDebugInfo, guardians: readonly MatchGuardian[], enemies: readonly MatchEnemy[]): void {
    controls.flowFields.forEach((field) => {
      this.graphics.lineStyle(2, 0x6fe3ff, 0.9);
      this.graphics.strokeCircle(field.x, field.y, field.radius);
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI * 2 * index) / 6;
        const x = field.x + Math.cos(angle) * field.radius * 0.6;
        const y = field.y + Math.sin(angle) * field.radius * 0.6;
        const tangent = this.route.getTangentAtDistance(this.route.getClosestPoint({ x, y }).routeDistance);
        this.drawArrow(x, y, -tangent.x, -tangent.y, 0x6fe3ff);
      }
      this.addLabel(field.x, field.y - field.radius - 10, `${field.mode.toUpperCase()} ×${field.speedFactor.toFixed(2)} · ${field.ownerId}`, 0x9fefff);
    });
    guardians.forEach((guardian) => {
      const preferred = guardian.runtime.preferredTargetId(controls.now);
      const target = preferred ? enemies.find((enemy) => enemy.id === preferred) : undefined;
      if (target) {
        this.graphics.lineStyle(2, 0x9b7bff, 0.8);
        this.graphics.lineBetween(guardian.x, guardian.y, target.x, target.y);
      }
      if (guardian.stats.trap) {
        this.graphics.lineStyle(1, 0xffd166, 0.8);
        this.graphics.strokeCircle(guardian.x, guardian.y, guardian.stats.trap.triggerRadius);
      }
    });
  }

  private drawPlacements(info: PlacementDebugInfo, guardians: readonly MatchGuardian[]): void {
    this.graphics.fillStyle(0x4edff0, 0.035);
    this.graphics.fillRect(info.waterBounds.x, info.waterBounds.y, info.waterBounds.width, info.waterBounds.height);
    this.graphics.lineStyle(info.waterRouteClearance * 2, 0xff526d, 0.055);
    this.strokeRoute();
    this.graphics.lineStyle(1, 0x5feaff, 0.8);
    this.graphics.strokeRect(info.waterBounds.x, info.waterBounds.y, info.waterBounds.width, info.waterBounds.height);

    // Faixa de margem (Tubarão), entre as duas linhas.
    this.graphics.lineStyle(info.marginBand.max * 2, 0x67f2ac, 0.05);
    this.strokeRoute();
    this.graphics.lineStyle(info.marginBand.min * 2, 0x031d2d, 0.08);
    this.strokeRoute();

    this.graphics.lineStyle(info.routePlacementClearance * 2, 0x74ff9a, 0.08);
    this.strokeRoute();

    this.graphics.lineStyle(1, 0xff7181, 0.75);
    info.platforms.forEach((platform) => this.graphics.strokeCircle(platform.x, platform.y, info.waterSeparation));
    guardians.forEach((guardian) => this.graphics.strokeCircle(guardian.x, guardian.y, info.waterSeparation));

    info.routeBlockers.forEach((placement, index) => {
      const color = 0xff6676;
      this.graphics.fillStyle(color, 0.18);
      this.graphics.lineStyle(3, color, 0.95);
      this.graphics.fillCircle(placement.x, placement.y, 28);
      this.graphics.strokeCircle(placement.x, placement.y, 28);
      this.addLabel(placement.x, placement.y - 36, `${placement.label} ${index + 1} · OCUPADO`, color);
    });
  }

  private strokeRoute(): void {
    this.graphics.beginPath();
    this.route.points.forEach((point, index) => {
      if (index === 0) this.graphics.moveTo(point.x, point.y);
      else this.graphics.lineTo(point.x, point.y);
    });
    this.graphics.strokePath();
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
