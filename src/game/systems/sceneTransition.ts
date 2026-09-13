import Phaser from "phaser";
import { getScreenHost } from "../ui/dom/host";
import { getSettings } from "./settings";

/** Fade curto entre as telas grandes do jogo (Meu Recife ↔ mapa ↔ partida). */
export const TRANSITION_MS = 240;

/** Cor do fade: o mesmo azul profundo do fundo das telas, para não piscar preto. */
const FADE_RGB = [2, 20, 31] as const;

/** Movimento reduzido: a preferência do sistema ou a configuração do jogador. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Quanto tempo o fade pode durar agora. Zero quando o jogador pediu menos movimento. */
export function transitionDuration(durationMs = TRANSITION_MS): number {
  return prefersReducedMotion() || getSettings().reducedEffects ? 0 : durationMs;
}

/**
 * Troca de cena com um fade curto, sem recarregar a aplicação. A camada HTML sai antes do fade para
 * a tela antiga não aparecer piscando sobre a nova, e o input morre durante a troca: dois cliques
 * rápidos não podem disparar dois `scene.start`.
 *
 * A cena precisa estar rodando — `FADE_OUT_COMPLETE` nunca dispara numa cena pausada.
 */
export function transitionTo(scene: Phaser.Scene, key: string, data?: object, durationMs = TRANSITION_MS): void {
  const duration = transitionDuration(durationMs);
  scene.input.enabled = false;
  getScreenHost(scene.game).clear();
  if (scene.scene.isPaused()) scene.scene.resume();
  if (duration === 0) {
    scene.scene.start(key, data);
    return;
  }
  scene.game.canvas.dataset.transition = "out";
  scene.cameras.main.fadeOut(duration, ...FADE_RGB);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.game.canvas.dataset.transition = "";
    scene.scene.start(key, data);
  });
}

/**
 * A entrada da cena. `onDone` roda quando a tela já está visível — é onde a cena anuncia que está
 * pronta para os testes e para o jogador.
 */
export function fadeInScene(scene: Phaser.Scene, onDone?: () => void, durationMs = TRANSITION_MS): void {
  const duration = transitionDuration(durationMs);
  if (duration === 0) {
    onDone?.();
    return;
  }
  scene.cameras.main.fadeIn(duration, ...FADE_RGB);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => onDone?.());
}
