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

const DESKTOP_HUD = {
  /**
   * HUD COMPACTO (celular). O canvas de 1280 px aparece a ~0,54× num telefone deitado: um texto de
   * 12 px vira 6 px de verdade, ilegível. No compacto sai todo texto de apoio ("RECIFE", "ONDA",
   * papel da carta, legenda das medidas) e fica o que o jogador lê de relance — pictograma e
   * número —, em corpo grande. Ver `buildMobileHud`.
   */
  compact: false,
  /** Marca do jogo na barra de cima. No celular ela sai: o espaço vira botão maior. */
  showBrand: true,
  /** Plaquinha "FASE 1/6 · RECIFE COSTEIRO · NORMAL". No celular sai: a pausa já diz onde se está. */
  showLevelPod: true,
  /** Reiniciar na barra de cima. No celular ele mora só na gaveta de pausa (com confirmação). */
  showRestart: true,
  /** Tela cheia na barra de cima. No celular só aparece onde o navegador deixa (não no iPhone). */
  showFullscreen: true,
  /** Folga de toque em volta de cada botão do HUD, além do desenho. */
  hitSlop: 0,
  /** Linhas da descrição do ramo no painel do Guardião em foco. */
  panelDescriptionLines: 3,
  /**
   * Posicionar pede DOIS toques (o primeiro mostra onde e o alcance; o segundo, no mesmo lugar,
   * confirma). No celular o dedo cobre o ponto e não há "passar o mouse por cima" para conferir
   * antes: sem isto, cada toque torto era pérola gasta no lugar errado.
   */
  confirmPlacement: false,
  /** Raio em que um toque fora da plataforma ainda "gruda" na mais próxima (0 = só em cima dela). */
  platformSnap: 0,
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
  /** Corpo do número das pílulas (pérolas, vida, onda) e do rótulo da contagem. */
  podValueSize: 17,
  timerSize: 12,
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
  optionButtonXs: [714, 926] as readonly [number, number],
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
};

export type HudLayout = Readonly<typeof DESKTOP_HUD>;

/**
 * HUD DO CELULAR. Num telefone deitado o canvas de 1280 px aparece a ~0,54×: o botão de 42 px do
 * desktop vira um alvo de 23 px, e o texto de 11 px, 6 px. As FAIXAS continuam com a mesma altura
 * (`HUD_TOP`/`HUD_BOTTOM`) — mudar isso tiraria canteiros de fases já feitas de baixo do HUD —, mas
 * dentro delas o HUD é outro (`compact`):
 *
 * - Barra de cima: só pérolas, vida, onda/contagem e os botões que se usam jogando (chamar onda,
 *   velocidade, pausa, som). A plaquinha da fase e o reiniciar vão para a gaveta de pausa; a tela
 *   cheia só aparece onde o navegador a oferece (o iPhone não oferece).
 * - Cartas: retrato grande e custo. Nome e papel aparecem no painel ao lado quando a carta é tocada.
 * - Painel: nome, nível e as medidas em número grande; os botões de melhorar e vender com 46 px.
 */
function buildMobileHud(): HudLayout {
  const fullscreen = canOfferFullscreen();
  // Botões da direita para a esquerda: som, pausa, (tela cheia), velocidade, chamar onda.
  const button = 72;
  const gap = 8;
  const mute = GAME_WIDTH - 10 - button / 2;
  const pause = mute - button - gap;
  const fullscreenX = fullscreen ? pause - button - gap : pause;
  const speedWidth = 84;
  const speed = fullscreenX - button / 2 - gap - speedWidth / 2;
  const skipWidth = 212;
  const skip = speed - speedWidth / 2 - gap - skipWidth / 2;
  // As três pílulas repartem o que sobra até o botão de chamar (mais espaço sem tela cheia).
  const podsRight = skip - skipWidth / 2 - gap;
  const podsSpace = podsRight - 10 - gap * 2;
  const pearlsWidth = Math.round(podsSpace * 0.28);
  const reefWidth = Math.round(podsSpace * 0.3);
  const pearls = { x: 10, width: pearlsWidth };
  const reef = { x: pearls.x + pearlsWidth + gap, width: reefWidth };
  const wave = { x: reef.x + reefWidth + gap, width: podsRight - (reef.x + reefWidth + gap) };
  return {
    ...DESKTOP_HUD,
    compact: true,
    showBrand: false,
    showLevelPod: false,
    showRestart: false,
    showFullscreen: fullscreen,
    hitSlop: 6,
    panelDescriptionLines: 2,
    confirmPlacement: true,
    platformSnap: 72,
    podHeight: 54,
    podValueSize: 27,
    timerSize: 22,
    pods: { pearls, reef, wave },
    // Sem o botão de chamar, a pílula da onda estica até onde ele começava.
    wavePodWideWidth: skip + skipWidth / 2 - wave.x,
    messageY: HUD_TOP + 80,
    messageWidth: 640,
    topButtonSize: button,
    topButtonHeight: 56,
    skipButtonX: skip,
    skipButtonWidth: skipWidth,
    speedButtonX: speed,
    speedButtonWidth: speedWidth,
    restartButtonX: -1000,
    pauseButtonX: pause,
    fullscreenButtonX: fullscreen ? fullscreenX : -1000,
    muteButtonX: mute,
    bossBarY: HUD_TOP + 34,
    bossBarWidth: 420,
    wavePreviewY: HUD_TOP + 10,
    cardHeight: 100,
    optionButtonY: GAME_HEIGHT - 29,
    optionButtonHeight: 46,
  };
}

/**
 * Tela cheia de ELEMENTO: o Android deixa, o iPhone não (o Safari do iPhone só põe vídeo em tela
 * cheia). Aberto pelo ícone, o jogo já está em tela cheia e o botão sobraria.
 */
function canOfferFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const standalone = document.documentElement.classList.contains("is-standalone");
  return Boolean(document.fullscreenEnabled) && !standalone;
}

/**
 * Qual HUD vale nesta abertura. `?hud=mobile|desktop` força (é o que a sonda e2e do HUD do celular
 * usa); os testes automatizados, fora isso, ficam no do desktop — as coordenadas deles vêm de
 * `DESKTOP_HUD` em Node, onde não há `document` para perguntar.
 */
function pickLayout(): HudLayout {
  if (typeof document === "undefined") return DESKTOP_HUD;
  const forced = new URLSearchParams(window.location.search).get("hud");
  if (forced === "mobile") return buildMobileHud();
  if (forced === "desktop" || navigator.webdriver) return DESKTOP_HUD;
  return document.documentElement.classList.contains("is-touch") ? buildMobileHud() : DESKTOP_HUD;
}

export const HUD_LAYOUT: HudLayout = pickLayout();
export { DESKTOP_HUD };

/** Centro da carta na posição `slot` (0..4) do esquadrão. */
export function cardCenterX(slot: number): number {
  return HUD_LAYOUT.cardStartX + slot * HUD_LAYOUT.cardStep;
}

/** Centro vertical de uma pílula ou botão da barra de cima. */
export function topRowY(): number {
  return HUD_LAYOUT.topCenterY;
}
