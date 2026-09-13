import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, HUB_DEPTH } from "../constants";
import type { DecorationDefinition } from "../data/reef/decorations";
import type { PlacedDecoration } from "../core/save/PlayerProgress";
import { seededRandom } from "../systems/LevelBackdrop";
import { paintLayer } from "./hubShapes";

/**
 * Uma peça plantada no Recife.
 *
 * Hoje desenha formas vetoriais; no dia em que a arte pintada chegar, a decoração declara
 * `art: { type: "sprite", … }` e esta classe passa a usar a imagem — o mesmo idioma de degradação
 * graciosa de `systems/ArtEffects.ts`, que sempre confere `textures.exists` antes de usar.
 *
 * O desenho acontece UMA vez, no construtor. Nada de `clear()` por quadro: o que se anima é a
 * rotação do container (o balanço) e a transparência do brilho.
 */
export class HubDecorationView extends Phaser.GameObjects.Container {
  private readonly sway: { amplitudeDeg: number; periodMs: number } | null;
  private readonly glow: { target: Phaser.GameObjects.Graphics; periodMs: number; min: number; max: number } | null;
  private readonly phase: number;

  constructor(
    scene: Phaser.Scene,
    readonly definition: DecorationDefinition,
    readonly placed: PlacedDecoration,
  ) {
    super(scene, (placed.x / 100) * GAME_WIDTH, (placed.y / 100) * GAME_HEIGHT);
    const random = seededRandom(`${placed.instanceId}:${placed.defId}`);
    this.phase = random() * Math.PI * 2;

    const width = (definition.footprint.w / 100) * GAME_WIDTH * placed.scale;
    const height = (definition.footprint.h / 100) * GAME_HEIGHT * placed.scale;

    let swayLayer: { amplitudeDeg: number; periodMs: number } | null = null;
    let glowTarget: HubDecorationView["glow"] = null;

    if (definition.art.type === "sprite" && scene.textures.exists(definition.art.key)) {
      const image = scene.add.image(0, 0, definition.art.key).setOrigin(0.5, 1);
      const fit = Math.min(width / image.width, height / image.height);
      image.setScale(fit * (definition.art.scale ?? 1));
      this.add(image);
      swayLayer = definition.art.sway ?? null;
    } else if (definition.art.type === "vector") {
      for (const layer of definition.art.layers) {
        const graphics = scene.add.graphics();
        paintLayer({ graphics, width, height, random }, layer);
        this.add(graphics);
        if (layer.sway && !swayLayer) swayLayer = layer.sway;
        if (layer.glow) glowTarget = { target: graphics, periodMs: layer.glow.periodMs, min: layer.glow.min, max: layer.glow.max };
      }
    }

    this.sway = swayLayer;
    this.glow = glowTarget;
    this.setScale(placed.flip ? -1 : 1, 1);
    this.setAngle(placed.rotation);
    this.setDepth(definition.depth ?? HUB_DEPTH.midDecor);
    scene.add.existing(this);
  }

  /** Balanço e brilho. Só toca em ângulo e transparência — nenhum redesenho. */
  tick(now: number, reduced: boolean): void {
    if (this.sway && !reduced) {
      this.setAngle(this.placed.rotation + Math.sin((now / this.sway.periodMs) * Math.PI * 2 + this.phase) * this.sway.amplitudeDeg);
    }
    if (this.glow) {
      const pulse = reduced ? this.glow.max : (Math.sin((now / this.glow.periodMs) * Math.PI * 2 + this.phase) + 1) / 2;
      this.glow.target.setAlpha(this.glow.min + (this.glow.max - this.glow.min) * pulse);
    }
  }
}
