import Phaser from "phaser";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from "../constants";
import type { GateSnapshot, WhirlpoolSnapshot } from "../core/match/MatchSnapshot";

/**
 * Desenho dos aparelhos dos Canais Profundos. Nenhuma regra aqui: o estado vem do snapshot do motor
 * e o toque vira o comando `useMapDevice` na cena.
 */

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "Arial, sans-serif",
  fontSize: "11px",
  fontStyle: "bold",
  color: "#f3fbff",
  align: "center",
  backgroundColor: "rgba(3, 29, 45, .8)",
  padding: { x: 6, y: 3 },
};

/**
 * COMPORTA: a alavanca no pilar e a porta de pedra no canal fechado. A alavanca aponta para o canal
 * aberto; a argola dourada em volta apaga enquanto ela está trancada depois de virar.
 */
export class GateView extends Phaser.GameObjects.Container {
  private readonly lever: Phaser.GameObjects.Graphics;
  private readonly cooldown: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly doors: Phaser.GameObjects.Graphics;
  private signature = "";

  constructor(
    scene: Phaser.Scene,
    private snapshot: GateSnapshot,
    onTap: () => void,
  ) {
    super(scene, snapshot.x, snapshot.y);
    this.doors = scene.add.graphics().setDepth(DEPTH.path + 2);
    this.cooldown = scene.add.graphics();
    this.lever = scene.add.graphics();
    this.label = scene.add.text(0, -34, "", LABEL_STYLE).setOrigin(0.5, 1);
    this.add([this.cooldown, this.lever, this.label]);
    this.setDepth(DEPTH.effects);
    this.setSize(64, 64);
    this.setInteractive(new Phaser.Geom.Circle(32, 32, 34), Phaser.Geom.Circle.Contains);
    this.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onTap();
    });
    scene.add.existing(this);
    this.draw();
  }

  sync(next: GateSnapshot): void {
    this.snapshot = next;
    this.draw();
  }

  destroy(fromScene?: boolean): void {
    this.doors.destroy();
    super.destroy(fromScene);
  }

  private draw(): void {
    const { open, readyInMs, routeLabels, doors, label } = this.snapshot;
    const cooling = readyInMs > 0;
    const signature = `${open}-${cooling ? Math.ceil(readyInMs / 250) : 0}`;
    if (signature === this.signature) return;
    this.signature = signature;

    // Alavanca inclinada para o lado do canal aberto.
    const tilt = open === 0 ? -0.6 : 0.6;
    this.lever.clear();
    this.lever.fillStyle(0x3b2a17, 1);
    this.lever.fillRoundedRect(-14, 6, 28, 10, 4);
    this.lever.lineStyle(6, 0xd9a441, 1);
    this.lever.lineBetween(0, 10, Math.sin(tilt) * 26, 10 - Math.cos(tilt) * 26);
    this.lever.fillStyle(cooling ? 0x8a7a5a : 0xffd76a, 1);
    this.lever.fillCircle(Math.sin(tilt) * 26, 10 - Math.cos(tilt) * 26, 7);

    this.cooldown.clear();
    this.cooldown.lineStyle(3, 0xffd76a, cooling ? 0.35 : 0.9);
    // Argola apagada = trancada depois de virar (os segundos restantes vão no rótulo).
    this.cooldown.strokeCircle(0, 0, 30);
    if (!cooling) {
      this.cooldown.fillStyle(0xffd76a, 0.12);
      this.cooldown.fillCircle(0, 0, 30);
    }

    this.label.setText(`${label}\n▶ ${routeLabels[open]}${cooling ? ` · ${Math.ceil(readyInMs / 1000)}s` : ""}`);

    // A porta de pedra fecha o canal que NÃO está aberto.
    const closed = doors[open === 0 ? 1 : 0];
    this.doors.clear();
    this.doors.fillStyle(0x000000, 0.3);
    this.doors.fillRoundedRect(closed.x - 34, closed.y - 10, 70, 26, 8);
    this.doors.fillStyle(0x5d5046, 1);
    this.doors.fillRoundedRect(closed.x - 36, closed.y - 14, 72, 26, 8);
    this.doors.lineStyle(2, 0xffd76a, 0.6);
    this.doors.strokeRoundedRect(closed.x - 36, closed.y - 14, 72, 26, 8);
    this.doors.lineStyle(2, 0x2c241f, 0.8);
    for (const offset of [-18, 0, 18]) this.doors.lineBetween(closed.x + offset, closed.y - 12, closed.x + offset, closed.y + 10);
  }
}

/**
 * REDEMOINHO: espiral que gira no leito. Ativo gira rápido e claro; dormente fica apagado e, quando
 * pode ser acordado, pisca "toque" em cima.
 */
export class WhirlpoolView extends Phaser.GameObjects.Container {
  private readonly spiral: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text | null;
  private spinning: boolean;

  constructor(scene: Phaser.Scene, snapshot: WhirlpoolSnapshot, onTap: () => void) {
    super(scene, snapshot.x, snapshot.y);
    this.spiral = scene.add.graphics();
    this.drawSpiral(snapshot.radius);
    this.add(this.spiral);
    this.label = snapshot.dormant ? scene.add.text(0, -snapshot.radius - 8, "", LABEL_STYLE).setOrigin(0.5, 1) : null;
    if (this.label) this.add(this.label);
    this.spinning = snapshot.active;
    this.setDepth(DEPTH.current + 2);
    if (snapshot.dormant) {
      this.setSize(snapshot.radius * 2, snapshot.radius * 2);
      this.setInteractive(new Phaser.Geom.Circle(snapshot.radius, snapshot.radius, snapshot.radius), Phaser.Geom.Circle.Contains);
      this.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        onTap();
      });
    }
    scene.add.existing(this);
    this.sync(snapshot);
  }

  sync(next: WhirlpoolSnapshot): void {
    this.spinning = next.active;
    this.spiral.setAlpha(next.active ? 0.85 : 0.3);
    if (this.label) {
      const ready = !next.active && next.readyInMs <= 0;
      this.label.setText(next.active ? next.label : ready ? `${next.label}\nToque para girar` : `${next.label} · ${Math.ceil(next.readyInMs / 1000)}s`);
      this.label.setAlpha(ready || next.active ? 1 : 0.65);
    }
  }

  /** Giro contínuo; chamado a cada quadro pela cena. */
  spin(deltaMs: number): void {
    this.spiral.rotation += (this.spinning ? 2.6 : 0.4) * (deltaMs / 1000);
  }

  private drawSpiral(radius: number): void {
    this.spiral.clear();
    for (let arm = 0; arm < 3; arm += 1) {
      this.spiral.lineStyle(4, 0xbff4ff, 0.8);
      this.spiral.beginPath();
      for (let step = 0; step <= 28; step += 1) {
        const t = step / 28;
        const angle = arm * ((Math.PI * 2) / 3) + t * Math.PI * 2.4;
        const r = radius * (1 - t * 0.9);
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (step === 0) this.spiral.moveTo(px, py);
        else this.spiral.lineTo(px, py);
      }
      this.spiral.strokePath();
    }
  }
}

/**
 * LUZ E NÉVOA. A névoa é um véu verde-lodo por cima dos inimigos e embaixo dos Guardiões; a luz de
 * cada Peixe-Lanterna abre um buraco nele. Sem névoa, a luz ainda aparece como um halo leve — é o
 * que ensina o jogador, antes da primeira onda de névoa, que ali existe uma área especial.
 */
export class LightFogLayer {
  private readonly fog: Phaser.GameObjects.RenderTexture;
  private readonly halos: Phaser.GameObjects.Graphics;
  private readonly brush: Phaser.GameObjects.Graphics;
  private signature = "";
  private fogAlpha = 0;

  constructor(scene: Phaser.Scene) {
    this.fog = scene.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0, 0).setDepth(DEPTH.enemies + 5).setAlpha(0);
    this.halos = scene.add.graphics().setDepth(DEPTH.pads + 1);
    this.brush = scene.make.graphics({ x: 0, y: 0 }, false);
  }

  /** `lights` = centro e raio de cada luz em campo. */
  update(fogOn: boolean, lights: ReadonlyArray<{ x: number; y: number; radius: number }>, deltaMs: number): void {
    const target = fogOn ? 1 : 0;
    this.fogAlpha += Math.sign(target - this.fogAlpha) * Math.min(Math.abs(target - this.fogAlpha), deltaMs / 900);
    this.fog.setAlpha(this.fogAlpha);

    const signature = lights.map((light) => `${Math.round(light.x)},${Math.round(light.y)},${Math.round(light.radius)}`).join("|");
    if (signature === this.signature) return;
    this.signature = signature;

    this.halos.clear();
    for (const light of lights) {
      this.halos.fillStyle(0xfff3b0, 0.07);
      this.halos.fillCircle(light.x, light.y, light.radius);
      this.halos.lineStyle(2, 0xfff3b0, 0.25);
      this.halos.strokeCircle(light.x, light.y, light.radius);
    }

    this.fog.clear();
    this.fog.fill(0x2f4a3c, 0.5);
    this.brush.clear();
    this.brush.fillStyle(0xffffff, 1);
    for (const light of lights) this.brush.fillCircle(light.x, light.y, light.radius);
    if (lights.length > 0) this.fog.erase(this.brush);
  }

  destroy(): void {
    this.fog.destroy();
    this.halos.destroy();
    this.brush.destroy();
  }
}
