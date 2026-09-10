import Phaser from "phaser";
import "./style.css";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/constants";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import { UIScene } from "./game/scenes/UIScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#063a55",
  scene: [BootScene, GameScene, UIScene],
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

window.addEventListener("beforeunload", () => game.destroy(true));
