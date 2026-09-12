import Phaser from "phaser";

export const EventBus = new Phaser.Events.EventEmitter();

export const Events = {
  hudUpdate: "hud:update",
  selectGuardian: "ui:select-guardian",
  /** payload: BranchId — compra o próximo passo do ramo indicado. */
  upgradeGuardian: "ui:upgrade-guardian",
  sellGuardian: "ui:sell-guardian",
  togglePause: "ui:toggle-pause",
  toggleMute: "ui:toggle-mute",
  restart: "ui:restart",
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
