import Phaser from "phaser";
import { artTextureKeyForFolder, fitImageToBox, GUARDIAN_ART } from "../assets/guardianArt";
import { GAME_HEIGHT, GAME_WIDTH, HUB_DEPTH } from "../constants";
import type { InhabitantSnapshot } from "../core/reef/ReefInhabitant";
import { GUARDIANS } from "../data/guardians";
import type { HubBehaviorProfile } from "../data/reef/hubBehaviors";
import type { GuardianDefinition, GuardianId } from "../types";

/**
 * Um Guardião nadando no Meu Recife.
 *
 * A view não decide nada: ela recebe o retrato que `ReefInhabitant` produziu e o transforma em
 * pixel. Todo o comportamento mora no core, testado sem Phaser.
 *
 * A arte vem da forma base, que o boot já carrega para os nove — o hub não acrescenta um byte ao
 * preload (`tests/guardian-art.test.ts` mede isso). Sem a imagem, cai num desenho vetorial simples,
 * o mesmo idioma do `GuardianView` da partida.
 */

/** A caixa comum: sem isto, artes de tamanhos diferentes saem visualmente incoerentes. */
const FRAME = { width: 108, height: 108 };

export class HubGuardianView extends Phaser.GameObjects.Container {
  readonly definition: GuardianDefinition;

  private readonly art: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private readonly usesArt: boolean;
  private readonly baseScale: number;
  private ring: Phaser.GameObjects.Arc | null = null;
  private sonar: Phaser.GameObjects.Arc | null = null;
  private quirkScale = 1;

  constructor(
    scene: Phaser.Scene,
    readonly guardianId: GuardianId,
    readonly profile: HubBehaviorProfile,
    onSelect: (guardianId: GuardianId) => void,
  ) {
    super(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.definition = GUARDIANS[guardianId];

    const key = artTextureKeyForFolder(guardianId, GUARDIAN_ART[guardianId].base.folder, "idle");
    this.usesArt = scene.textures.exists(key);
    if (this.usesArt) {
      const image = scene.add.image(0, 0, key).setOrigin(0.5);
      fitImageToBox(scene, image, key, 0, 0, FRAME.width, FRAME.height);
      this.art = image;
    } else {
      this.art = this.drawBody(scene);
    }
    this.add(this.art);

    this.baseScale = profile.scale;
    this.setScale(this.baseScale);
    this.setDepth(profile.habitat === "wideRange" ? HUB_DEPTH.guardiansBack : HUB_DEPTH.guardians);

    const radius = (FRAME.width / 2) * 0.85;
    this.setSize(FRAME.width, FRAME.height);
    this.setInteractive(new Phaser.Geom.Circle(0, 0, radius), Phaser.Geom.Circle.Contains);
    if (this.input) this.input.cursor = "pointer";
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event?.stopPropagation?.();
      onSelect(guardianId);
    });

    scene.add.existing(this);
  }

  /** Põe o retrato do core na tela. Converte de % para pixel aqui, e só aqui. */
  apply(snapshot: InhabitantSnapshot, reduced: boolean): void {
    this.x = (snapshot.x / 100) * GAME_WIDTH;
    this.y = ((snapshot.y + snapshot.bobOffset) / 100) * GAME_HEIGHT;

    const facing = this.profile.facesMovement ? snapshot.facing : 1;
    this.applyQuirk(snapshot, reduced);
    this.setScale(facing * this.baseScale * this.quirkScale, this.baseScale * this.quirkScale);
    if (this.ring) this.ring.setPosition(0, 0);
  }

  /** Reação curta ao clique: um pulinho que faz a criatura parecer viva. */
  react(): void {
    this.scene.tweens.add({
      targets: this,
      scaleY: this.baseScale * 1.16,
      duration: 140,
      yoyo: true,
      ease: "Sine.InOut",
    });
    if (this.guardianId === "dolphin") this.emitSonar();
  }

  setHighlight(on: boolean): void {
    if (on && !this.ring) {
      this.ring = this.scene.add.circle(0, 0, FRAME.width * 0.62, this.definition.accent, 0.18).setDepth(-1);
      this.addAt(this.ring, 0);
    }
    this.ring?.setVisible(on);
  }

  destroy(fromScene?: boolean): void {
    this.sonar?.destroy();
    this.sonar = null;
    super.destroy(fromScene);
  }

  // ------------------------------------------------------------------- interno

  /** A manha de cada Guardião, lida do retrato: o core diz quando, a view diz como. */
  private applyQuirk(snapshot: InhabitantSnapshot, reduced: boolean): void {
    if (reduced || !snapshot.quirk) {
      this.quirkScale = 1;
      return;
    }
    const wave = Math.sin(snapshot.quirkT * Math.PI);
    switch (snapshot.quirk) {
      case "inflate":
        this.quirkScale = 1 + wave * 0.26;
        break;
      case "pulse":
        this.quirkScale = 1 + wave * 0.09;
        break;
      case "hop":
      case "play":
        this.quirkScale = 1 + wave * 0.12;
        break;
      case "burrow":
        this.quirkScale = 1;
        this.art.setAlpha(1 - wave * 0.55);
        return;
      default:
        this.quirkScale = 1;
    }
    this.art.setAlpha(1);
    if (snapshot.quirk === "play" && snapshot.quirkT > 0.48 && snapshot.quirkT < 0.52) this.emitSonar();
  }

  /** O pulso de sonar do Golfinho. Só um anel vivo por vez. */
  private emitSonar(): void {
    if (this.sonar) return;
    const ring = this.scene.add.circle(this.x, this.y, 12, this.definition.accent, 0);
    ring.setStrokeStyle(2, this.definition.accent, 0.75).setDepth(HUB_DEPTH.guardiansFront);
    this.sonar = ring;
    this.scene.tweens.add({
      targets: ring,
      radius: 82,
      alpha: 0,
      duration: 900,
      ease: "Sine.Out",
      onComplete: () => {
        ring.destroy();
        if (this.sonar === ring) this.sonar = null;
      },
    });
  }

  /** Sem arte pintada: uma silhueta com as cores do próprio Guardião. */
  private drawBody(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics();
    const { color, accent } = this.definition;
    graphics.fillStyle(color, 1);
    graphics.fillEllipse(0, 0, FRAME.width * 0.62, FRAME.height * 0.42);
    graphics.fillTriangle(-FRAME.width * 0.28, 0, -FRAME.width * 0.5, -FRAME.height * 0.16, -FRAME.width * 0.5, FRAME.height * 0.16);
    graphics.fillStyle(accent, 1);
    graphics.fillCircle(FRAME.width * 0.18, -FRAME.height * 0.06, 4);
    return graphics;
  }
}
