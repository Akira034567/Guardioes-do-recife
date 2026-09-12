import type Phaser from "phaser";
import { ScreenHost } from "./ScreenHost";

const hosts = new WeakMap<Phaser.Game, ScreenHost>();

/** Uma camada de telas por instância do jogo (as cenas vão e voltam, ela fica). */
export function getScreenHost(game: Phaser.Game): ScreenHost {
  let host = hosts.get(game);
  if (!host) {
    host = new ScreenHost(game);
    hosts.set(game, host);
  }
  return host;
}
