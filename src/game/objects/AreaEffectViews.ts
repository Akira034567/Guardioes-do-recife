import Phaser from "phaser";
import { DEPTH } from "../constants";
import type { FlowField } from "../core/FlowField";
import type { CloudView as CloudState, FieldView as FieldState } from "../core/match/systems/AreaEffects";
import type { RoutePath } from "../core/RoutePath";
import type { ArtEffects } from "../systems/ArtEffects";

/** Campo elétrico da Água-viva: anel da arte (quando existe) + círculo vetorial que apaga com o tempo. */
export class FieldGfx {
  private readonly graphic: Phaser.GameObjects.Graphics;
  private readonly image: Phaser.GameObjects.Image | null;

  constructor(scene: Phaser.Scene, effects: ArtEffects, artKey: string | null, readonly state: FieldState) {
    this.image = effects.persistent(artKey, state.x, state.y, state.radius * 2);
    const graphic = scene.add.graphics().setDepth(DEPTH.effects - 1);
    graphic.fillStyle(0x9e65ff, this.image ? 0.08 : 0.13);
    graphic.fillCircle(state.x, state.y, state.radius);
    graphic.lineStyle(3, 0x7deaff, this.image ? 0.35 : 0.72);
    graphic.strokeCircle(state.x, state.y, state.radius);
    if (!this.image) {
      graphic.lineStyle(1, 0xe5d3ff, 0.65);
      graphic.strokeCircle(state.x, state.y, state.radius * 0.58);
    }
    this.graphic = graphic;
  }

  sync(now: number): void {
    const remaining = (this.state.expiresAt - now) / this.state.durationMs;
    this.graphic.setAlpha(Math.max(0.18, Math.min(1, remaining)));
    this.image?.setAlpha(Math.max(0.2, Math.min(0.85, remaining)));
  }

  destroy(): void {
    this.graphic.destroy();
    this.image?.destroy();
  }
}

/** Nuvem persistente: tinta do Polvo (roxa) ou jardim tóxico do Peixe-Pedra (verde). */
export class CloudGfx {
  private readonly graphic: Phaser.GameObjects.Graphics;
  private readonly image: Phaser.GameObjects.Image | null;

  constructor(scene: Phaser.Scene, effects: ArtEffects, artKey: string | null, readonly state: CloudState) {
    this.image = effects.persistent(artKey, state.x, state.y, state.radius * 2);
    const graphic = scene.add.graphics().setDepth(DEPTH.effects - 1);
    if (state.kind === "ink") {
      graphic.fillStyle(0x2a1a4a, this.image ? 0.2 : 0.45);
      graphic.fillCircle(state.x, state.y, state.radius);
      if (!this.image) {
        graphic.fillStyle(0x6b5bd6, 0.25);
        graphic.fillCircle(state.x - state.radius * 0.25, state.y - state.radius * 0.2, state.radius * 0.6);
      }
      graphic.lineStyle(2, 0xd58cff, this.image ? 0.35 : 0.6);
      graphic.strokeCircle(state.x, state.y, state.radius);
    } else {
      graphic.fillStyle(0x4f8a2f, this.image ? 0.18 : 0.4);
      graphic.fillCircle(state.x, state.y, state.radius);
      graphic.fillStyle(0x8ef26b, 0.2);
      graphic.fillCircle(state.x + state.radius * 0.2, state.y - state.radius * 0.25, state.radius * 0.55);
      graphic.lineStyle(2, 0xa4f26b, 0.6);
      graphic.strokeCircle(state.x, state.y, state.radius);
    }
    this.graphic = graphic;
  }

  sync(now: number): void {
    const remaining = (this.state.expiresAt - now) / this.state.durationMs;
    this.graphic.setAlpha(Math.max(0.25, Math.min(1, remaining + 0.2)));
    this.image?.setAlpha(Math.max(0.25, Math.min(0.85, remaining + 0.15)));
  }

  destroy(): void {
    this.graphic.destroy();
    this.image?.destroy();
  }
}

/** Zona de corrente da Tartaruga: anel na água e partículas fluindo contra a rota. */
export class FlowGfx {
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly motes: Phaser.GameObjects.Arc[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    field: FlowField,
  ) {
    this.ring = scene.add.graphics().setDepth(DEPTH.current + 1);
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const distance = field.radius * (0.35 + ((index * 37) % 60) / 100);
      this.motes.push(
        scene.add
          .circle(field.x + Math.cos(angle) * distance, field.y + Math.sin(angle) * distance, 2 + (index % 3), 0x9fefff, 0.45)
          .setDepth(DEPTH.current + 2),
      );
    }
  }

  sync(field: FlowField, deltaMs: number, route: RoutePath): void {
    void this.scene;
    this.ring.clear();
    this.ring.fillStyle(0x4fd6ff, field.speedFactor < 0.85 ? 0.08 : 0.05);
    this.ring.fillCircle(field.x, field.y, field.radius);
    this.ring.lineStyle(2, 0x6fe3ff, 0.45);
    this.ring.strokeCircle(field.x, field.y, field.radius);
    // Partículas correm contra o sentido da rota no ponto onde estão: a água "empurra de volta".
    this.motes.forEach((mote, index) => {
      const tangent = route.getTangentAtDistance(route.getClosestPoint(mote).routeDistance);
      const speed = (30 + (index % 4) * 10) * (1.2 - field.speedFactor);
      mote.x -= tangent.x * speed * (deltaMs / 1000);
      mote.y -= tangent.y * speed * (deltaMs / 1000);
      if (Math.hypot(mote.x - field.x, mote.y - field.y) > field.radius) {
        const angle = Math.atan2(mote.y - field.y, mote.x - field.x) + Math.PI + (index % 5) * 0.2;
        mote.x = field.x + Math.cos(angle) * field.radius * 0.9;
        mote.y = field.y + Math.sin(angle) * field.radius * 0.9;
      }
    });
  }

  destroy(): void {
    this.ring.destroy();
    this.motes.forEach((mote) => mote.destroy());
  }
}
