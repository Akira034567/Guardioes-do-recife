export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const HUD_TOP = 72;
export const HUD_BOTTOM = 116;

export const DEPTH = {
  background: 0,
  path: 10,
  current: 15,
  pads: 20,
  enemies: 30,
  guardians: 40,
  projectiles: 50,
  effects: 60,
  debug: 100,
} as const;

/**
 * Camadas do hub "Meu Recife". Separada de `DEPTH`, que é contrato da partida: o hub tem cenário,
 * marcos e criaturas onde a fase tem rota, plataformas e projéteis.
 */
export const HUB_DEPTH = {
  water: 0,
  farReef: 5,
  bands: 8,
  midDecor: 12,
  motes: 16,
  landmarkGlow: 18,
  landmark: 20,
  guardiansBack: 28,
  guardians: 30,
  guardiansFront: 34,
  nearDecor: 40,
  bubbles: 46,
  vignette: 50,
} as const;
