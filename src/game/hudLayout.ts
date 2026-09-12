import { GAME_HEIGHT } from "./constants";

/**
 * Layout da fila de cartas e do painel de upgrade no HUD inferior. Sem Phaser, para que os testes e2e
 * cliquem nas mesmas coordenadas que a cena usa.
 */
export const HUD_LAYOUT = {
  cardStartX: 62,
  cardStep: 118,
  cardWidth: 108,
  cardY: GAME_HEIGHT - 48,
  panelX: 820,
  panelWidth: 430,
  optionButtonY: GAME_HEIGHT - 28,
  /** Botão do ramo A à esquerda, ramo B à direita: as posições são fixas por ramo. */
  optionButtonXs: [690, 800] as const,
  sellButtonX: 980,
  skipButtonX: 1078,
  skipButtonY: 640,
  debugButtonX: 1078,
  debugButtonY: 684,
  restartButtonX: 1190,
  restartButtonY: 640,
  menuButtonX: 1190,
  menuButtonY: 684,
  pauseButtonX: 1143,
  muteButtonX: 1201,
  topButtonY: 36,
} as const;

/** Centro da carta na posição `slot` (0..4) do esquadrão. */
export function cardCenterX(slot: number): number {
  return HUD_LAYOUT.cardStartX + slot * HUD_LAYOUT.cardStep;
}
