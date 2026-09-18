import Phaser from "phaser";
import "./style.css";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/constants";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import { HubScene } from "./game/scenes/HubScene";
import { LevelSelectScene } from "./game/scenes/LevelSelectScene";
import { UIScene } from "./game/scenes/UIScene";
import { DIAGNOSTICS_ON, dumpLifecycle } from "./game/systems/devLog";
import { flushSaveSync } from "./game/systems/accountSync";
import { restoreSession } from "./game/systems/session";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#063a55",
  scene: [BootScene, HubScene, LevelSelectScene, GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  input: {
    activePointers: 3,
  },
});

/*
 * Quem já estava logado volta logado: a sessão guardada é conferida com o servidor e o progresso da
 * conta desce antes de a primeira cena precisar dele. Sem rede, o jogo abre com o save local desta
 * conta e tenta de novo na próxima abertura — ninguém é deslogado por causa de internet ruim.
 */
void restoreSession();

window.addEventListener("beforeunload", () => {
  // Última chance de subir o que acabou de ser gravado; se não der, sobe na próxima abertura.
  void flushSaveSync();
  game.destroy(true);
});

/**
 * O laço do Phaser reagenda o próximo quadro DEPOIS de chamar o `update()` das cenas
 * (`RequestAnimationFrame.step`). Uma exceção não capturada lá dentro, portanto, não "pula um
 * quadro": ela mata o laço para sempre. A tela congela, o cursor continua respondendo e o console
 * mostra um erro solto que ninguém liga ao travamento. Este aviso faz a ligação explícita e diz em
 * que fase a partida estava.
 */
if (DIAGNOSTICS_ON) {
  window.addEventListener("error", (event) => {
    console.error(
      "[GR:fatal] exceção não capturada — se o jogo congelou, o laço do Phaser provavelmente morreu aqui.",
      event.error ?? event.message,
      "\n" + dumpLifecycle().join("\n"),
    );
  });
}
