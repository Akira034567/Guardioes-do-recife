import Phaser from "phaser";
import { preloadRecifeOneAssets } from "../assets/recifeOneAssets";
import { getLevel } from "../data/levels";
import { hideSplash, setSplashProgress } from "../systems/splash";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    // Arte dos Guardiões novos chega aos poucos: arquivos ausentes só deixam a unidade no desenho vetorial.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (!file.key.includes("-")) console.warn(`[assets] falha ao carregar ${file.key}`);
    });
    // A barra da entrada (index.html) vai de 30% — o bundle já chegou — até 100%.
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => setSplashProgress(0.3 + value * 0.7));
    // Os fundos das outras fases são carregados pela GameScene ao abrir cada fase.
    preloadRecifeOneAssets(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#052f49");
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = getLevel(params.get("level"));
    // Atalho de desenvolvimento e dos testes: `?screen=map` pula o hub e vai direto para as fases.
    const requestedScreen = params.get("screen");
    this.time.delayedCall(80, () => {
      if (requestedLevel) this.scene.start("GameScene", { levelId: requestedLevel.id });
      else if (requestedScreen === "map") this.scene.start("LevelSelectScene");
      else this.scene.start("HubScene");
      // A entrada sai por cima da primeira tela já montada — nunca revela um quadro vazio.
      hideSplash();
      // Em segundo plano, a arte das fases: entrar numa fase não mostra "carregando".
      this.scene.launch("WarmupScene");
    });
  }
}
