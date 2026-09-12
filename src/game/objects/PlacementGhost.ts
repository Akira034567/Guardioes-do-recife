import Phaser from "phaser";
import { artTextureFor, GUARDIAN_ART } from "../assets/guardianArt";
import { DEPTH } from "../constants";
import { RADIAL, shapeOutline } from "../core/TargetingShape";
import type { GuardianDefinition } from "../types";

export interface GhostState {
  x: number;
  y: number;
  valid: boolean;
  affordable: boolean;
  /** Texto curto sob o fantasma: o motivo da recusa ou o custo. */
  label: string;
}

const VALID = 0x67f2ac;
const INVALID = 0xff6f79;

/**
 * Prévia de posicionamento (item 32): a própria criatura em transparência sob o cursor, com o alcance
 * na forma certa e o custo. Verde quando dá para posicionar ali, vermelho quando não dá. Só desenho:
 * quem decide se a posição vale é `validatePlacement`, no motor.
 */
export class PlacementGhost {
  private readonly range: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private definition: GuardianDefinition | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.range = scene.add.graphics().setDepth(DEPTH.effects - 1);
    this.body = scene.add.graphics().setDepth(DEPTH.effects + 1);
    this.sprite = scene.add.image(0, 0, "__WHITE").setOrigin(0.5, 1).setDepth(DEPTH.effects + 1).setVisible(false);
    this.label = scene.add
      .text(0, 0, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#eafcff",
        backgroundColor: "rgba(3, 29, 45, .8)",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.effects + 2)
      .setVisible(false);
    this.hide();
  }

  /** Troca o Guardião em prévia; a arte base é a mesma que a unidade terá ao nascer. */
  setGuardian(definition: GuardianDefinition | null): void {
    if (this.definition?.id === definition?.id) return;
    this.definition = definition;
    if (!definition) {
      this.hide();
      return;
    }
    const key = artTextureFor(definition.id, { branchId: null, upgradeLevel: 0 }, "idle");
    if (this.scene.textures.exists(key)) {
      this.sprite.setTexture(key).setScale(GUARDIAN_ART[definition.id].scale).setVisible(false);
    } else {
      this.sprite.setVisible(false);
    }
  }

  show(state: GhostState): void {
    const definition = this.definition;
    if (!definition) return;
    const color = state.valid && state.affordable ? VALID : INVALID;
    const usesSprite = this.scene.textures.exists(this.sprite.texture.key) && this.sprite.texture.key !== "__WHITE";

    this.range.clear();
    const outline = shapeOutline(definition.targetingShape ?? RADIAL, { x: state.x, y: state.y, facingRad: 0 }, definition.range);
    this.range.fillStyle(color, 0.08);
    this.range.lineStyle(2, color, 0.55);
    if (outline.kind === "circle") {
      this.range.fillCircle(outline.x, outline.y, outline.radius);
      this.range.strokeCircle(outline.x, outline.y, outline.radius);
    } else if (outline.kind === "polygon") {
      const points = outline.points.map((point) => new Phaser.Geom.Point(point.x, point.y));
      this.range.fillPoints(points, true);
      this.range.strokePoints(points, true);
    }

    this.body.clear();
    this.body.lineStyle(2, color, 0.9);
    this.body.strokeCircle(state.x, state.y, 26);
    if (usesSprite) {
      this.sprite.setPosition(state.x, state.y + 22).setAlpha(0.72).setTint(color).setVisible(true);
    } else {
      this.body.fillStyle(definition.color, 0.45);
      this.body.fillCircle(state.x, state.y, 20);
    }

    this.label.setPosition(state.x, state.y + 30).setText(state.label).setColor(state.affordable ? "#eafcff" : "#ffc2c7").setVisible(true);
  }

  hide(): void {
    this.range.clear();
    this.body.clear();
    this.sprite.setVisible(false);
    this.label.setVisible(false);
  }

  destroy(): void {
    this.range.destroy();
    this.body.destroy();
    this.sprite.destroy();
    this.label.destroy();
  }
}
