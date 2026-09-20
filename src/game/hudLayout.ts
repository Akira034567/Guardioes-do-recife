import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "./constants";

/**
 * Geometria do HUD da partida. Fica fora do Phaser para que os testes e2e cliquem exatamente onde a
 * `UIScene` desenha: mudar um número aqui move o controle na tela e move a sonda junto.
 *
 * Leitura de cima para baixo: barra de cima (marca, fase, pílulas de estado, chamado e botões),
 * faixa flutuante sob ela (chefe no meio, sondagem à direita) e barra de baixo (cartas e o painel do
 * Guardião em foco).
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
  /**
   * Plaquinha da fase: "FASE 3/6 · TRÊS REDEMOINHOS" e a dificuldade em que se está jogando.
   *
   * Subiu do canto de baixo para cá com o botão PRÓXIMA ONDA (v3.5). Lá embaixo ela dividia o bloco
   * mais apertado do HUD e ficava longe de tudo que responde "como vai a partida"; aqui ela abre a
   * mesma fileira das pílulas de estado, que é onde o olho já procura.
   *
   * A dificuldade entra junto porque o Difícil e o Abissal mudam a MISSÃO, e não só os números: sem
   * ela na tela, duas partidas da mesma fase são indistinguíveis.
   */
  levelPod: { x: 180, width: 244 },
  /**
   * Pílulas de estado: moeda, vida do Recife e a onda (com a contagem da próxima junto).
   *
   * Onda e contagem viraram UMA pílula: são a mesma pergunta ("em que ponto da fase eu estou?") e
   * separadas custavam 100 px que a barra não tem mais, agora que a fase e o chamado moram aqui.
   */
  pods: {
    pearls: { x: 432, width: 106 },
    reef: { x: 546, width: 166 },
    wave: { x: 720, width: 182 },
  },
  /**
   * Largura da pílula da onda QUANDO NÃO HÁ onda para chamar.
   *
   * "EM 10s" cabe folgado em 182 px; "EM CURSO" não — e é justamente enquanto a onda corre que o
   * botão PRÓXIMA ONDA some, deixando o espaço dele vago ao lado. A pílula toma esse espaço
   * emprestado e devolve quando o botão volta, então nada nunca fica cortado e nada nunca briga
   * pelo mesmo pixel.
   */
  wavePodWideWidth: 292,
  /**
   * Aviso curto da partida. Saiu da barra de cima (onde disputava espaço com as pílulas) e virou um
   * balão discreto logo abaixo dela, sem encostar na barra do chefe.
   */
  messageX: GAME_WIDTH / 2,
  messageY: HUD_TOP + 54,
  messageWidth: 420,
  /** Botões da direita: chamar onda, 1×/2×, reiniciar, pausa, tela cheia e som. */
  topButtonY: TOP_CENTER,
  topButtonSize: 42,
  topButtonHeight: 40,
  /** Botão "PRÓXIMA ONDA", logo depois da pílula da onda: o chamado fica ao lado da contagem. */
  skipButtonX: 960,
  skipButtonY: TOP_CENTER,
  skipButtonWidth: 104,
  /**
   * Velocidade da partida: UM botão que alterna.
   *
   * Eram dois (1× e 2×) lado a lado, e um deles estava sempre apagado sem fazer nada — metade do
   * espaço servia só para mostrar a opção que não estava valendo. O botão único mostra a velocidade
   * ATUAL e troca ao toque, que é como o resto do HUD já se comporta.
   */
  speedButtonX: 1044,
  speedButtonWidth: 50,
  /**
   * REINICIAR FASE, entre a velocidade e a pausa.
   *
   * Ele joga a partida fora, então pede confirmação (a mesma da tecla R) — mas precisa estar à mão:
   * quem percebe no minuto dois que o esquadrão está errado não quer abrir a gaveta de pausa,
   * achar o item e confirmar duas vezes.
   */
  restartButtonX: 1098,
  pauseButtonX: 1146,
  fullscreenButtonX: 1194,
  muteButtonX: 1242,

  // ── Faixa flutuante sob a barra de cima ──────────────────────────────────────
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
  /**
   * Painel do Guardião em foco. Começa depois da última carta (que termina em 588) e vai até a
   * borda: o bloco de comandos que ocupava a direita subiu inteiro para a barra de cima, e a faixa
   * de 120 px que sobrava ali não estava fazendo nada. Com ela, cabe uma quarta medida e a
   * descrição do ramo deixa de ser espremida em duas linhas de 9 px.
   */
  panelX: 934,
  panelWidth: 668,
  panelY: GAME_HEIGHT - 58,
  panelHeight: 104,
  /** Botões do painel: ramo A à esquerda, ramo B no meio, venda à direita. */
  optionButtonY: GAME_HEIGHT - 27,
  optionButtonXs: [714, 926] as const,
  optionButtonWidth: 200,
  optionButtonHeight: 34,
  sellButtonX: 1138,

  // ── Atalho de desenvolvimento ────────────────────────────────────────────────
  /** Flutua acima da barra de baixo; só aparece com `?debug=1`. */
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
