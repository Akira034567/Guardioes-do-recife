import Phaser from "phaser";
import "./style.css";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/constants";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import { HubScene } from "./game/scenes/HubScene";
import { LevelSelectScene } from "./game/scenes/LevelSelectScene";
import { UIScene } from "./game/scenes/UIScene";
import { DIAGNOSTICS_ON, dumpLifecycle } from "./game/systems/devLog";
import { armImmersiveFullscreen } from "./game/systems/immersive";
import { setCloudLinkEvent } from "./game/systems/cloud";
import { adoptCloudLinkSession } from "./game/systems/session";

/**
 * O jogador pode estar CHEGANDO de um link de e-mail (confirmação de conta ou troca de senha).
 *
 * A sessão tem que ser adotada ANTES de o Phaser existir: adotar depois trocaria o save por baixo
 * de cenas já criadas, que continuariam mostrando o progresso do convidado. Sem `#access_token` na
 * URL — o caso de 99,9% das aberturas — isto é uma função que olha a hash e volta na hora.
 */
const linkEvent = await adoptCloudLinkSession();
if (linkEvent) setCloudLinkEvent(linkEvent);

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
    /*
     * A TELA CHEIA PRECISA LEVAR A CAMADA HTML JUNTO.
     *
     * Sem isto, o Phaser cria um `<div>` próprio, move só o `<canvas>` para dentro dele e manda
     * ESSE div para tela cheia. O `#ui-layer` — que é irmão do canvas dentro de `#game` — fica de
     * fora do elemento em tela cheia e o navegador simplesmente não o desenha.
     *
     * O sintoma não parecia um problema de tela cheia: o jogo "travava" ao pausar e ao passar de
     * fase. Não travava nada — a gaveta de pausa e o painel de resultado estavam abertos,
     * bloqueando o input do Phaser (como toda tela modal faz) e invisíveis. Apontar a tela cheia
     * para `#game`, que contém os dois, resolve os dois sintomas de uma vez.
     */
    fullscreenTarget: "game",
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  input: {
    activePointers: 3,
  },
});

// No celular, o primeiro toque pede tela cheia: é a única forma de a barra do navegador sair da frente.
const stage = document.getElementById("game");
const disarmImmersive = stage ? armImmersiveFullscreen(stage) : () => {};

window.addEventListener("beforeunload", () => {
  disarmImmersive();
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
