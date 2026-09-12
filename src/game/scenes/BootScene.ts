import Phaser from "phaser";
import { preloadRecifeOneAssets } from "../assets/recifeOneAssets";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { getLevel } from "../data/levels";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    // Arte dos Guardiões novos chega aos poucos: arquivos ausentes só deixam a unidade no desenho vetorial.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (!file.key.includes("-")) console.warn(`[assets] falha ao carregar ${file.key}`);
    });
    // Os fundos das outras fases são carregados pela GameScene ao abrir cada fase.
    preloadRecifeOneAssets(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#052f49");
    const requestedLevel = getLevel(new URLSearchParams(window.location.search).get("level"));
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 18, "GUARDIÕES DO RECIFE", {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: "34px",
        color: "#e8fbff",
        letterSpacing: 3,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, requestedLevel ? `Preparando ${requestedLevel.name}…` : "Carregando fases…", {
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        color: "#75dff4",
      })
      .setOrigin(0.5);

    this.time.delayedCall(80, () => {
      if (requestedLevel) this.scene.start("GameScene", { levelId: requestedLevel.id });
      else this.scene.start("LevelSelectScene");
    });
  }
}
