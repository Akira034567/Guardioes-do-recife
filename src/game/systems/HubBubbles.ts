import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, HUB_DEPTH } from "../constants";
import { seededRandom } from "./LevelBackdrop";

/**
 * A ambiência do Recife: plâncton à deriva e bolhas subindo.
 *
 * Pool de tamanho fixo, no formato do `FloatingTextPool` — nada é criado ou destruído depois do
 * construtor, só reposicionado ao sair da tela. É o mesmo laço de deriva com retorno pelas bordas
 * que os motes de correnteza da partida já usam.
 */

interface Drifter {
  dot: Phaser.GameObjects.Arc;
  speed: number;
  drift: number;
  phase: number;
}

export class HubBubbles {
  private readonly motes: Drifter[] = [];
  private readonly bubbles: Drifter[] = [];
  private readonly random: () => number;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    options: { motes?: number; bubbles?: number; vitality?: number } = {},
  ) {
    const random = seededRandom("recife-ambiencia");
    this.random = random;
    const vitality = Math.max(0, Math.min(1, options.vitality ?? 0.5));
    // Um Recife mais vivo tem mais coisa boiando: a densidade acompanha o crescimento sem degrau.
    const moteCount = options.motes ?? Math.round(10 + vitality * 14);
    const bubbleCount = options.bubbles ?? Math.round(8 + vitality * 14);

    for (let index = 0; index < moteCount; index += 1) {
      const dot = scene.add
        .circle(random() * GAME_WIDTH, random() * GAME_HEIGHT, 1.5 + random() * 2, 0xa4f5ff, 0.32)
        .setDepth(HUB_DEPTH.motes);
      this.motes.push({ dot, speed: 4 + random() * 9, drift: (random() - 0.5) * 6, phase: random() * Math.PI * 2 });
    }

    for (let index = 0; index < bubbleCount; index += 1) {
      const dot = scene.add
        .circle(random() * GAME_WIDTH, random() * GAME_HEIGHT, 2 + random() * 4, 0xd8f7ff, 0.24)
        .setDepth(HUB_DEPTH.bubbles);
      this.bubbles.push({ dot, speed: 16 + random() * 26, drift: (random() - 0.5) * 10, phase: random() * Math.PI * 2 });
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    for (const drifter of [...this.motes, ...this.bubbles]) drifter.dot.setVisible(enabled);
  }

  update(deltaMs: number, now: number): void {
    if (!this.enabled) return;
    const seconds = deltaMs / 1000;

    for (const mote of this.motes) {
      mote.dot.x += (mote.drift + Math.sin(now / 2600 + mote.phase) * 3) * seconds;
      mote.dot.y += mote.speed * seconds * 0.2;
      this.wrap(mote.dot);
    }

    for (const bubble of this.bubbles) {
      bubble.dot.y -= bubble.speed * seconds;
      bubble.dot.x += Math.sin(now / 900 + bubble.phase) * 8 * seconds;
      if (bubble.dot.y < -10) {
        // Nasce de novo lá embaixo, em outro lugar: o fluxo nunca fica repetitivo.
        bubble.dot.y = GAME_HEIGHT + 10;
        bubble.dot.x = this.random() * GAME_WIDTH;
      }
      this.wrapHorizontal(bubble.dot);
    }
  }

  destroy(): void {
    for (const drifter of [...this.motes, ...this.bubbles]) drifter.dot.destroy();
    this.motes.length = 0;
    this.bubbles.length = 0;
  }

  private wrap(dot: Phaser.GameObjects.Arc): void {
    if (dot.y > GAME_HEIGHT + 10) dot.y = -10;
    if (dot.y < -10) dot.y = GAME_HEIGHT + 10;
    this.wrapHorizontal(dot);
  }

  private wrapHorizontal(dot: Phaser.GameObjects.Arc): void {
    if (dot.x > GAME_WIDTH + 10) dot.x = -10;
    if (dot.x < -10) dot.x = GAME_WIDTH + 10;
  }
}
