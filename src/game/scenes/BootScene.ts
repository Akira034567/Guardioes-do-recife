import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#052f49");
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 18, "GUARDIÕES DO RECIFE", {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: "34px",
        color: "#e8fbff",
        letterSpacing: 3,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, "Preparando Recife 1…", {
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        color: "#75dff4",
      })
      .setOrigin(0.5);

    this.time.delayedCall(80, () => this.scene.start("GameScene"));
  }
}
