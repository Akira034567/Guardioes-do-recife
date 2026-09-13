import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "./constants";

/**
 * Geometria do HUD da partida. Fica fora do Phaser para que os testes e2e cliquem exatamente onde a
 * `UIScene` desenha: mudar um número aqui move o controle na tela e move a sonda junto.
 *
 * Leitura de cima para baixo: barra de cima (marca, pílulas de estado, botões), faixa flutuante sob
 * ela (fase à esquerda, sondagem à direita) e barra de baixo (cartas, painel do Guardião, comandos).
 */

/** Altura das pílulas de estado da barra de cima e centro vertical delas. */
const POD_HEIGHT = 40;
const TOP_CENTER = HUD_TOP / 2;

export const HUD_LAYOUT = {
  // ── Barra de cima ────────────────────────────────────────────────────────────
  topCenterY: TOP_CENTER,
  podHeight: POD_HEIGHT,
  /** Marca do jogo, encostada à esquerda. */
  brand: { x: 12, width: 160, height: 48 },
  /** Pílulas de estado: pérolas, vida do Recife, onda e relógio, nesta ordem. */
  pods: {
    pearls: { x: 178, width: 122 },
    reef: { x: 310, width: 192 },
    wave: { x: 512, width: 148 },
    timer: { x: 670, width: 156 },
  },
  /** Aviso curto da partida, no vão entre a última pílula e os botões. */
  messageX: 916,
  messageWidth: 160,
  /** Botões quadrados da direita: 1×, 2×, pausa, tela cheia e som. */
  topButtonY: TOP_CENTER,
  topButtonSize: 46,
  topButtonHeight: 42,
  /** Velocidade da partida: 1× e 2× abrem a fila. */
  speedButtonXs: [1029, 1083] as const,
  speedButtonWidth: 46,
  pauseButtonX: 1137,
  fullscreenButtonX: 1191,
  muteButtonX: 1245,

  // ── Faixa flutuante sob a barra de cima ──────────────────────────────────────
  /** Nome da fase, à esquerda, por cima do mapa. */
  levelChipX: 12,
  levelChipY: 92,
  levelChipHeight: 30,
  /** Barra do chefe, centralizada. */
  bossBarX: 640,
  bossBarY: 92,
  bossBarWidth: 360,
  /** Prévia da próxima onda, encostada à direita. */
  wavePreviewRight: 1268,
  wavePreviewY: 78,
  wavePreviewWidth: 244,

  // ── Barra de baixo: cartas do esquadrão ──────────────────────────────────────
  cardStartX: 62,
  cardStep: 118,
  cardWidth: 108,
  cardHeight: 88,
  /** Centro vertical das cartas: é aqui que as sondas e2e tocam para escolher um Guardião. */
  cardY: GAME_HEIGHT - 48,

  // ── Barra de baixo: painel do Guardião em foco ───────────────────────────────
  panelX: 818,
  panelWidth: 434,
  panelY: GAME_HEIGHT - 58,
  panelHeight: 104,
  /** Botões do painel: ramo A à esquerda, ramo B no meio, venda à direita. */
  optionButtonY: GAME_HEIGHT - 27,
  optionButtonXs: [678, 818] as const,
  optionButtonWidth: 132,
  optionButtonHeight: 34,
  sellButtonX: 958,

  // ── Barra de baixo: comandos da partida ──────────────────────────────────────
  /** Nome e número da fase, acima dos comandos. */
  commandLabelX: 1155,
  commandLabelY: GAME_HEIGHT - 106,
  /** Botão "PRÓXIMA ONDA". */
  skipButtonX: 1096,
  skipButtonY: GAME_HEIGHT - 74,
  skipButtonWidth: 108,
  commandButtonHeight: 38,
  restartButtonX: 1214,
  restartButtonY: GAME_HEIGHT - 74,
  /** Botão "FASES": ocupa a largura inteira do bloco de comandos. */
  menuButtonX: 1155,
  menuButtonY: GAME_HEIGHT - 28,
  menuButtonWidth: 226,
  menuButtonHeight: 40,
  /** Atalho de desenvolvimento: flutua acima da barra, só aparece com `?debug=1`. */
  debugButtonX: 1142,
  debugButtonY: GAME_HEIGHT - HUD_BOTTOM - 22,

  /** Largura útil da tela, para quem precisa encostar algo na borda. */
  screenWidth: GAME_WIDTH,
  /** Topo da barra de baixo. */
  bottomTop: GAME_HEIGHT - HUD_BOTTOM,
} as const;

/** Centro da carta na posição `slot` (0..4) do esquadrão. */
export function cardCenterX(slot: number): number {
  return HUD_LAYOUT.cardStartX + slot * HUD_LAYOUT.cardStep;
}

/** Centro vertical de uma pílula ou botão da barra de cima. */
export function topRowY(): number {
  return HUD_LAYOUT.topCenterY;
}
