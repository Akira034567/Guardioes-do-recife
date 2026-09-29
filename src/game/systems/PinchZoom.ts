import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";

const MIN_ZOOM = 1;
const MAX_ZOOM = 1.8;
/** Abaixo disto o zoom volta sozinho para 1×: "quase sem zoom" é só um mapa levemente torto. */
const SNAP_BACK = 1.06;

/**
 * PINÇA E ARRASTO COM DOIS DEDOS no mapa da partida (só no celular).
 *
 * Num telefone o mapa inteiro cabe na tela, mas um inimigo miúdo ou dois canteiros vizinhos ficam
 * do tamanho de uma unha. Dois dedos aproximam (até 1,8×) e arrastam; o HUD mora em outra cena, com
 * câmera própria, então nunca sai do lugar. Um dedo continua sendo SEMPRE o toque do jogo — a
 * pinça só existe com dois dedos na tela, e enquanto ela dura o jogo ignora os toques (`active`).
 *
 * As coordenadas do jogo já passam pela câmera (`pointer.worldX`), então posicionar com zoom cai
 * exatamente onde o dedo está.
 */
export class PinchZoom {
  private startDistance = 0;
  private startZoom = 1;
  private lastMid = new Phaser.Math.Vector2();
  /** Há uma pinça em curso (dois dedos). A cena não trata toques enquanto isto for verdade. */
  active = false;

  constructor(private readonly scene: Phaser.Scene) {
    scene.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onDown, this);
    this.scene.input.off("pointermove", this.onMove, this);
    this.scene.input.off("pointerup", this.onUp, this);
  }

  private fingers(): [Phaser.Input.Pointer, Phaser.Input.Pointer] | null {
    const { pointer1, pointer2 } = this.scene.input;
    return pointer1?.isDown && pointer2?.isDown ? [pointer1, pointer2] : null;
  }

  private onDown(): void {
    const pair = this.fingers();
    if (!pair) return;
    this.active = true;
    this.startDistance = Math.max(1, Phaser.Math.Distance.Between(pair[0].x, pair[0].y, pair[1].x, pair[1].y));
    this.startZoom = this.scene.cameras.main.zoom;
    this.lastMid.set((pair[0].x + pair[1].x) / 2, (pair[0].y + pair[1].y) / 2);
  }

  private onMove(): void {
    if (!this.active) return;
    const pair = this.fingers();
    if (!pair) return;
    const camera = this.scene.cameras.main;
    const distance = Phaser.Math.Distance.Between(pair[0].x, pair[0].y, pair[1].x, pair[1].y);
    const zoom = Phaser.Math.Clamp((this.startZoom * distance) / this.startDistance, MIN_ZOOM, MAX_ZOOM);
    const midX = (pair[0].x + pair[1].x) / 2;
    const midY = (pair[0].y + pair[1].y) / 2;
    // O ponto do mundo sob o meio dos dedos continua sob o meio dos dedos: zoom "onde se pinça".
    const before = camera.getWorldPoint(midX, midY);
    camera.setZoom(zoom);
    const after = camera.getWorldPoint(midX, midY);
    camera.scrollX += before.x - after.x - (midX - this.lastMid.x) / zoom;
    camera.scrollY += before.y - after.y - (midY - this.lastMid.y) / zoom;
    this.lastMid.set(midX, midY);
  }

  private onUp(): void {
    if (!this.active) return;
    const { pointer1, pointer2 } = this.scene.input;
    if (pointer1?.isDown || pointer2?.isDown) return;
    // Só encerra quando os DOIS dedos saíram: o último dedo a subir não pode virar um toque no mapa.
    this.scene.time.delayedCall(0, () => (this.active = false));
    const camera = this.scene.cameras.main;
    if (camera.zoom < SNAP_BACK) camera.setZoom(1).setScroll(0, 0);
  }

  /** Volta ao mapa inteiro (reinício de fase, fim de partida). */
  reset(): void {
    this.active = false;
    this.scene.cameras.main.setZoom(1).setScroll(0, 0);
  }
}
