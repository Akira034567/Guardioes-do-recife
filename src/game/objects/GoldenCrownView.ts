import Phaser from "phaser";
import { DEPTH } from "../constants";
import {
  GOLDEN_CROWN_KEY,
  GOLDEN_CROWN_OFFSET_Y,
  GOLDEN_CROWN_WIDTH,
  GOLDEN_FLASH_KEY,
  GOLDEN_PILLAR_KEY,
} from "../assets/goldenArt";
import { GOLDEN_CORONATION_MS } from "../data/goldenFish";

/**
 * A coroa do Peixinho Dourado sobre um Guardião.
 *
 * Desenho combinado: a coroa é um asset SEPARADO flutuando acima da unidade, e o personagem não é
 * repintado — o que entra por baixo é só um halo dourado bem discreto. A coroação dura ~1s: pilar de
 * luz, clarão, e a coroa assentando no lugar.
 */
export class GoldenCrownView extends Phaser.GameObjects.Container {
  private readonly crown: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Ellipse;
  private elapsed = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly reducedEffects: boolean,
  ) {
    super(scene, x, y);
    // O halo fica ATRÁS da coroa e bem apagado: a leitura da unidade não pode mudar.
    this.halo = scene.add.ellipse(0, 0, 54, 34, 0xffd76a, reducedEffects ? 0.1 : 0.16);
    this.crown = scene.add.image(0, GOLDEN_CROWN_OFFSET_Y, GOLDEN_CROWN_KEY);
    this.crown.setDisplaySize(GOLDEN_CROWN_WIDTH, GOLDEN_CROWN_WIDTH * 0.73);
    this.add([this.halo, this.crown]);
    this.setDepth(DEPTH.guardians + 2);
    scene.add.existing(this);
    if (!reducedEffects) this.playCoronation(scene, x, y);
  }

  /** Clarão, pilar e a coroa assentando. Uma vez só, no instante da escolha. */
  private playCoronation(scene: Phaser.Scene, x: number, y: number): void {
    const pillar = scene.add.image(x, y - 10, GOLDEN_PILLAR_KEY).setDepth(DEPTH.effects).setDisplaySize(64, 84).setAlpha(0);
    const flash = scene.add.image(x, y - 18, GOLDEN_FLASH_KEY).setDepth(DEPTH.effects + 1).setDisplaySize(30, 30).setAlpha(0);
    const half = GOLDEN_CORONATION_MS / 2;

    scene.tweens.add({ targets: pillar, alpha: { from: 0, to: 0.95 }, scaleY: { from: 0.5, to: 1 }, duration: half * 0.5, yoyo: true, hold: half * 0.4 });
    scene.tweens.add({ targets: flash, alpha: { from: 0, to: 1 }, scale: { from: 0.4, to: 2.4 }, duration: half, delay: half * 0.4, ease: "Cubic.easeOut" });
    scene.tweens.add({ targets: flash, alpha: 0, duration: half * 0.6, delay: half * 1.1 });
    scene.time.delayedCall(GOLDEN_CORONATION_MS, () => {
      pillar.destroy();
      flash.destroy();
    });

    // A coroa cai de cima e assenta: é o gesto que diz "esta unidade foi escolhida".
    this.crown.setAlpha(0);
    this.crown.y = GOLDEN_CROWN_OFFSET_Y - 26;
    scene.tweens.add({
      targets: this.crown,
      alpha: 1,
      y: GOLDEN_CROWN_OFFSET_Y,
      duration: half * 0.8,
      delay: half * 0.9,
      ease: "Back.easeOut",
    });
  }

  /** Acompanha a unidade e faz a coroa flutuar. */
  sync(x: number, y: number, deltaMs: number): void {
    this.setPosition(x, y);
    if (this.reducedEffects) return;
    this.elapsed += deltaMs;
    // Flutuação curta e lenta: presença, não distração.
    this.crown.y = GOLDEN_CROWN_OFFSET_Y + Math.sin(this.elapsed / 420) * 2.5;
    this.halo.setScale(1 + Math.sin(this.elapsed / 620) * 0.05);
  }
}
