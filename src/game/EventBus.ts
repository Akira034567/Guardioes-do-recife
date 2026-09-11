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
  toggleDebug: "ui:toggle-debug",
  toggleDebugFlag: "ui:toggle-debug-flag",
  /** payload: levelId */
  startLevel: "ui:start-level",
  openLevelSelect: "ui:open-level-select",
} as const;
