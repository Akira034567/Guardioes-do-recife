import Phaser from "phaser";

export const EventBus = new Phaser.Events.EventEmitter();

export const Events = {
  hudUpdate: "hud:update",
  selectGuardian: "ui:select-guardian",
  /**
   * payload: GuardianId — o dedo/cursor DESCEU sobre uma carta e ainda não soltou. Abre a janela em
   * que soltar dentro do mapa posiciona: é o que transforma "clicar na carta, clicar no mapa" em
   * "arrastar a carta até a plataforma", sem tirar o clique duplo de quem prefere assim.
   */
  beginGuardianDrag: "ui:begin-guardian-drag",
  /**
   * Larga a carta escolhida (e SÓ ela: o Guardião já posicionado continua em foco, senão ir até o
   * painel de baixo para vender fecharia o próprio painel no caminho).
   */
  cancelCardSelection: "ui:cancel-card-selection",
  /** payload: BranchId — compra o próximo passo do ramo indicado. */
  upgradeGuardian: "ui:upgrade-guardian",
  sellGuardian: "ui:sell-guardian",
  togglePause: "ui:toggle-pause",
  toggleMute: "ui:toggle-mute",
  /** Reinicia de verdade, sem perguntar. Só quem já confirmou emite isto. */
  restart: "ui:restart",
  /**
   * PEDE para reiniciar: abre a confirmação. O botão do HUD e a tecla R passam por aqui, nunca pelo
   * `restart` direto — jogar a partida fora por engano é o erro mais caro do jogo.
   */
  requestRestart: "ui:request-restart",
  /**
   * A TECLA DE ESPAÇO: chama a próxima onda; sem onda para chamar, alterna 1× e 2×.
   *
   * É um evento só, e não a barra escolhendo entre dois, porque quem sabe se há onda para chamar é
   * a PARTIDA. A barra vê um espelho do estado que chega por `hudUpdate`, e esse espelho pode estar
   * um quadro atrasado justamente no instante em que a contagem começa — foi o que fez a sonda do
   * espaço trocar a velocidade em vez de adiantar a onda no celular.
   */
  callWaveOrSpeed: "ui:call-wave-or-speed",
  skipCountdown: "ui:skip-countdown",
  /** Mesmo efeito de `skipCountdown`; nome do botão "INICIAR PRÓXIMA ONDA". */
  startNextWave: "ui:start-next-wave",
  /** payload: 1 | 2 | 3 */
  setSpeed: "ui:set-speed",
  /** "PULAR" na dica do tutorial. */
  skipTutorial: "ui:skip-tutorial",
  toggleDebug: "ui:toggle-debug",
  toggleDebugFlag: "ui:toggle-debug-flag",
  /** payload: MatchCommand de debug (só funciona com o debug liberado). */
  debugCommand: "ui:debug-command",
  /** payload: boolean — invencibilidade do Recife (debug). */
  debugInvincible: "ui:debug-invincible",
  /** payload: levelId */
  startLevel: "ui:start-level",
  openLevelSelect: "ui:open-level-select",
} as const;
