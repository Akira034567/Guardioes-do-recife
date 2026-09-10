import Phaser from "phaser";

export const EventBus = new Phaser.Events.EventEmitter();

export const Events = {
  hudUpdate: "hud:update",
  selectGuardian: "ui:select-guardian",
  upgradeGuardian: "ui:upgrade-guardian",
  togglePause: "ui:toggle-pause",
  toggleMute: "ui:toggle-mute",
  restart: "ui:restart",
  skipCountdown: "ui:skip-countdown",
  toggleDebug: "ui:toggle-debug",
  toggleDebugFlag: "ui:toggle-debug-flag",
} as const;
