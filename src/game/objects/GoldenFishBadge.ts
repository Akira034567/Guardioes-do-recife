import Phaser from "phaser";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM } from "../constants";
import { GOLDEN_FISH_FRAMES, GOLDEN_FISH_FRAME_MS, GOLDEN_SWIRL_KEY, GOLDEN_TRAIL_KEY } from "../assets/goldenArt";

/**
 * O Peixinho Dourado esperando no canto, até o jogador escolher quem coroar.
 *
 * Ele não é um botão: é um bicho que o jogador PEGA e LEVA até o Guardião. Coroar é a única decisão
 * irreversível de uma partida, então tirá-la de um clique solto foi deliberado — antes, o primeiro
 * toque num Guardião depois dos 60% da fase já gastava o Peixinho sem o jogador perceber.
 *
 * Enquanto está parado, nada e gira o redemoinho no canto inferior direito. Ao ser arrastado, larga o
 * rastro dourado e o alvo válido acende embaixo dele.
 */
export class GoldenFishBadge extends Phaser.GameObjects.Container {
  private readonly fish: Phaser.GameObjects.Image;
  private readonly swirl: Phaser.GameObjects.Image;
  private readonly trail: Phaser.GameObjects.Image;
  private readonly hint: Phaser.GameObjects.Text;
  private frame = 0;
  private elapsed = 0;
  private dragging = false;
  /** Onde ele descansa quando não está na mão do jogador. */
  private readonly restX: number;
  private readonly restY: number;

  constructor(
    scene: Phaser.Scene,
    private readonly callbacks: {
      /** Onde está o Guardião sob o ponteiro, se houver um ao alcance do solto. */
      guardianAt(x: number, y: number): { id: string; x: number; y: number } | null;
      /** Coroa a unidade; devolve false se o motor recusar. */
      crown(instanceId: string): boolean;
      onDragStateChanged?(dragging: boolean): void;
    },
  ) {
    super(scene, 0, 0);
    this.restX = GAME_WIDTH - 74;
    this.restY = GAME_HEIGHT - HUD_BOTTOM - 62;
    this.setPosition(this.restX, this.restY);

    this.swirl = scene.add.image(0, 0, GOLDEN_SWIRL_KEY).setDisplaySize(78, 78).setAlpha(0.55);
    this.trail = scene.add.image(-6, 4, GOLDEN_TRAIL_KEY).setDisplaySize(72, 44).setAlpha(0);
    this.fish = scene.add.image(0, 0, GOLDEN_FISH_FRAMES[0]).setDisplaySize(56, 42);
    this.hint = scene.add
      .text(0, 40, "ARRASTE ATÉ UM GUARDIÃO", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#ffe9b0",
        align: "center",
      })
      .setOrigin(0.5);

    this.add([this.swirl, this.trail, this.fish, this.hint]);
    this.setDepth(DEPTH.debug - 1);
    scene.add.existing(this);

    // A área de agarrar é generosa de propósito: no celular o dedo cobre o peixinho inteiro.
    this.setSize(84, 84);
    this.setInteractive({ useHandCursor: true, draggable: true });
    scene.input.setDraggable(this);
    this.on("dragstart", this.onDragStart, this);
    this.on("drag", this.onDrag, this);
    this.on("dragend", this.onDragEnd, this);
  }

  private onDragStart(): void {
    this.dragging = true;
    this.hint.setVisible(false);
    this.trail.setAlpha(0.85);
    this.swirl.setAlpha(0.25);
    this.callbacks.onDragStateChanged?.(true);
  }

  private onDrag(_pointer: Phaser.Input.Pointer, dragX: number, dragY: number): void {
    this.setPosition(dragX, dragY);
  }

  private onDragEnd(pointer: Phaser.Input.Pointer): void {
    this.dragging = false;
    this.trail.setAlpha(0);
    this.swirl.setAlpha(0.55);
    this.callbacks.onDragStateChanged?.(false);
    const target = this.callbacks.guardianAt(pointer.worldX, pointer.worldY);
    if (target && this.callbacks.crown(target.id)) {
      // Coroou: o peixinho some no Guardião — quem continua a história é a `GoldenCrownView`.
      this.scene.tweens.add({
        targets: this,
        x: target.x,
        y: target.y,
        scale: 0.2,
        alpha: 0,
        duration: 260,
        ease: "Cubic.easeIn",
        onComplete: () => this.destroy(),
      });
      return;
    }
    // Soltou no vazio: ele nada de volta para o canto e continua disponível.
    this.hint.setVisible(true);
    this.scene.tweens.add({ targets: this, x: this.restX, y: this.restY, duration: 320, ease: "Back.easeOut" });
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  /** O ponto cai em cima do peixinho? A cena consulta antes de tratar o toque como posicionamento. */
  contains(x: number, y: number): boolean {
    return Math.abs(x - this.x) <= this.width / 2 && Math.abs(y - this.y) <= this.height / 2;
  }

  /** Nado parado e giro do redemoinho. */
  sync(deltaMs: number): void {
    this.elapsed += deltaMs;
    const next = Math.floor(this.elapsed / GOLDEN_FISH_FRAME_MS) % GOLDEN_FISH_FRAMES.length;
    if (next !== this.frame) {
      this.frame = next;
      this.fish.setTexture(GOLDEN_FISH_FRAMES[next]);
    }
    this.swirl.rotation += deltaMs / 2600;
    if (!this.dragging) this.fish.y = Math.sin(this.elapsed / 420) * 3;
  }
}
