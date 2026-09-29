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

  /** Diâmetro do botão redondo de jogar (só no celular; no desktop são dois botões). */
  playButtonSize: 0,
  /** Faixa da dica do tutorial, acima das cartas: onde começa e a largura. */
  tutorialLeft: 50,
  tutorialWidth: 560,

  /** Largura útil da tela, para quem precisa encostar algo na borda. */
  screenWidth: GAME_WIDTH,
  /** Topo da barra de baixo. */
  bottomTop: GAME_HEIGHT - HUD_BOTTOM,
};

export type HudLayout = Readonly<typeof DESKTOP_HUD>;

/**
 * HUD DO CELULAR — tela inteira, estilo jogo de celular (pense no Bloons TD 6).
 *
 * Num telefone deitado o palco é largo (ver `systems/stage.ts`): o HUD encosta nas bordas REAIS da
 * tela, dentro da área segura, e não nas do mundo de 1280. E ele não tem mais barras: sem a faixa
 * sólida de cima nem a de baixo, o mapa aparece de ponta a ponta e o HUD são peças de vidro
 * flutuando sobre ele. As FAIXAS continuam reservadas (`HUD_TOP`/`HUD_BOTTOM`: nenhuma fase tem
 * canteiro ali), só que agora sem tinta.
 *
 * - Em cima, à esquerda: pérolas, vida e onda/contagem. À direita: a prévia da onda, pausa e som.
 * - Embaixo, à esquerda: as cartas (retrato grande e custo).
 * - Embaixo, à direita: o botão redondo grande de JOGAR — chama a próxima onda quando dá, e fora
 *   disso alterna 1×/2×, como a barra de espaço.
 * - Entre os dois, o painel do Guardião tocado (nome, medidas e os botões de melhorar e vender),
 *   que só aparece quando há algo em foco.
 *
 * A plaquinha da fase e o reiniciar ficam na gaveta de pausa; a tela cheia é automática no Android
 * (primeiro toque) e não existe no iPhone.
 *
 * `edges` são as bordas úteis do palco em coordenadas do jogo; sem palco largo, as do mundo.
 */
export function buildMobileHud(edges: { left: number; right: number } = { left: 0, right: GAME_WIDTH }): HudLayout {
  const margin = 10;
  const left = edges.left + margin;
  const right = edges.right - margin;
  const gap = 8;

  // ── em cima
  const podHeight = 52;
  const pearls = { x: left, width: 168 };
  const reef = { x: pearls.x + pearls.width + gap, width: 176 };
  const wave = { x: reef.x + reef.width + gap, width: 236 };
  const button = 64;
  const mute = right - button / 2;
  const pause = mute - button - gap;

  // ── embaixo
  const cardWidth = 112;
  const cardStep = cardWidth + 8;
  const cardStartX = left + cardWidth / 2;
  const cardsRight = left + cardStep * 5 - 8;
  const playSize = 100;
  const playX = right - playSize / 2;
  const bottomCenter = GAME_HEIGHT - HUD_BOTTOM / 2 + 4;
  const panelLeft = cardsRight + 12;
  const panelRight = playX - playSize / 2 - 12;
  const panelWidth = Math.max(420, panelRight - panelLeft);
  const optionButtonWidth = Math.floor((panelWidth - 16 * 4) / 3);
  const optionXs = [0, 1, 2].map((index) => panelLeft + 16 + optionButtonWidth / 2 + index * (optionButtonWidth + 16));

  return {
    ...DESKTOP_HUD,
    compact: true,
    showBrand: false,
    showLevelPod: false,
    showRestart: false,
    showFullscreen: false,
    hitSlop: 6,
    panelDescriptionLines: 2,
    confirmPlacement: true,
    platformSnap: 72,
    podHeight,
    podValueSize: 26,
    timerSize: 21,
    pods: { pearls, reef, wave },
    wavePodWideWidth: wave.width,
    messageX: (left + right) / 2,
    messageY: HUD_TOP + 74,
    messageWidth: 640,
    topButtonSize: button,
    topButtonHeight: 56,
    // Chamar onda e velocidade viram UM botão redondo embaixo à direita (`play*`).
    skipButtonX: playX,
    skipButtonY: bottomCenter,
    skipButtonWidth: playSize,
    speedButtonX: playX,
    speedButtonWidth: playSize,
    playButtonSize: playSize,
    restartButtonX: -1000,
    pauseButtonX: pause,
    fullscreenButtonX: -1000,
    muteButtonX: mute,
    bossBarX: (left + right) / 2,
    bossBarY: HUD_TOP + 22,
    bossBarWidth: 420,
    // A prévia da onda mora na faixa de cima, encostada nos botões da direita.
    wavePreviewRight: pause - button / 2 - 12,
    wavePreviewY: HUD_TOP / 2 - 25,
    cardStartX,
    cardStep,
    cardWidth,
    cardHeight: 100,
    cardY: bottomCenter + 6,
    panelX: panelLeft + panelWidth / 2,
    panelWidth,
    panelY: bottomCenter,
    panelHeight: 104,
    optionButtonY: GAME_HEIGHT - 29,
    optionButtonXs: [optionXs[0], optionXs[1]],
    optionButtonWidth,
    optionButtonHeight: 44,
    sellButtonX: optionXs[2],
    tutorialLeft: left,
    tutorialWidth: Math.min(660, panelRight - left),
    screenWidth: right - left,
  };
}

/**
 * Reposiciona o HUD do celular para as bordas atuais do palco. A `UIScene` chama isto ao nascer
 * (e renasce quando o palco muda de largura, ao girar ou ao entrar em tela cheia).
 */
export function refitMobileHud(edges: { left: number; right: number }): void {
  if (!HUD_LAYOUT.compact) return;
  Object.assign(HUD_LAYOUT as Record<string, unknown>, buildMobileHud(edges));
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
