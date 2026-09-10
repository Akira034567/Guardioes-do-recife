import Phaser from "phaser";
import { SHRIMP_LEVEL_TEXTURES } from "../assets/recifeOneAssets";
import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { GUARDIANS, GUARDIAN_ORDER } from "../data/guardians";
import { EventBus, Events } from "../EventBus";
import type { DebugFlags, GuardianId, HudSnapshot } from "../types";

interface GuardianCard {
  id: GuardianId;
  background: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
}

interface DebugButton {
  flag: keyof Omit<DebugFlags, "enabled">;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class UIScene extends Phaser.Scene {
  private pearlText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private cards: GuardianCard[] = [];
  private upgradeTitle!: Phaser.GameObjects.Text;
  private upgradeDescription!: Phaser.GameObjects.Text;
  private upgradeButton!: Phaser.GameObjects.Rectangle;
  private upgradeButtonText!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Rectangle;
  private pauseText!: Phaser.GameObjects.Text;
  private muteButton!: Phaser.GameObjects.Rectangle;
  private muteText!: Phaser.GameObjects.Text;
  private skipButton!: Phaser.GameObjects.Rectangle;
  private skipButtonText!: Phaser.GameObjects.Text;
  private debugToggle!: Phaser.GameObjects.Rectangle;
  private debugToggleText!: Phaser.GameObjects.Text;
  private debugPanel!: Phaser.GameObjects.Rectangle;
  private debugCollapseButton!: Phaser.GameObjects.Rectangle;
  private debugCollapseText!: Phaser.GameObjects.Text;
  private debugOpenButton!: Phaser.GameObjects.Rectangle;
  private debugOpenText!: Phaser.GameObjects.Text;
  private debugButtons: DebugButton[] = [];
  private debugPanelCollapsed = false;
  private debugEnabled = false;
  private resultShade!: Phaser.GameObjects.Rectangle;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultSubtitle!: Phaser.GameObjects.Text;
  private resultRestart!: Phaser.GameObjects.Rectangle;
  private resultRestartText!: Phaser.GameObjects.Text;
  private debugFromQuery = false;

  constructor() {
    super("UIScene");
  }

  init(data: { debugFromQuery?: boolean }): void {
    this.debugFromQuery = Boolean(data.debugFromQuery);
  }

  create(): void {
    this.createTopHud();
    this.createBottomHud();
    this.createDebugPanel();
    this.createResultOverlay();

    EventBus.on(Events.hudUpdate, this.renderSnapshot, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(Events.hudUpdate, this.renderSnapshot, this);
    });

    this.input.keyboard?.on("keydown-F2", () => EventBus.emit(Events.toggleDebug));
    this.input.keyboard?.on("keydown-SPACE", (event: KeyboardEvent) => {
      event.preventDefault();
      EventBus.emit(Events.skipCountdown);
    });
  }

  private createTopHud(): void {
    this.add
      .rectangle(GAME_WIDTH / 2, HUD_TOP / 2, GAME_WIDTH, HUD_TOP, 0x031d2d, 0.96)
      .setStrokeStyle(2, 0x1581a3, 0.7);
    this.add
      .text(22, 13, "GUARDIÕES\nDO RECIFE", {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: "18px",
        lineSpacing: -4,
        color: "#f3fcff",
      });
    this.pearlText = this.add.text(206, 24, "◉ 180", this.topStyle("#ffe69a"));
    this.healthText = this.add.text(350, 24, "RECIFE ♥ 20/20", this.topStyle("#82f1bd"));
    this.waveText = this.add.text(568, 24, "ONDA 1/5", this.topStyle("#d4f7ff"));
    this.timerText = this.add.text(705, 24, "EM 10s", this.topStyle("#75e2f5"));
    this.messageText = this.add
      .text(905, 36, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 330 },
      })
      .setOrigin(0.5);

    this.pauseButton = this.button(1143, 36, 48, 42, "Ⅱ", () => EventBus.emit(Events.togglePause));
    this.pauseText = this.pauseButton.getData("label") as Phaser.GameObjects.Text;
    this.muteButton = this.button(1201, 36, 48, 42, "♪", () => EventBus.emit(Events.toggleMute));
    this.muteText = this.muteButton.getData("label") as Phaser.GameObjects.Text;
  }

  private createBottomHud(): void {
    const centerY = GAME_HEIGHT - HUD_BOTTOM / 2;
    this.add
      .rectangle(GAME_WIDTH / 2, centerY, GAME_WIDTH, HUD_BOTTOM, 0x031d2d, 0.97)
      .setStrokeStyle(2, 0x1581a3, 0.7);
    this.add.text(18, GAME_HEIGHT - HUD_BOTTOM + 8, "GUARDIÕES", {
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#72cfe5",
      letterSpacing: 1,
    });

    this.cards = GUARDIAN_ORDER.map((id, index) => {
      const definition = GUARDIANS[id];
      const x = 72 + index * 148;
      const background = this.add
        .rectangle(x, centerY + 10, 136, 78, 0x0a3c53, 1)
        .setStrokeStyle(2, definition.color, 0.78)
        .setInteractive({ useHandCursor: true });
      background.on("pointerdown", () => EventBus.emit(Events.selectGuardian, id));
      const icon = id === "pistol-shrimp"
        ? this.add.image(x - 45, centerY + 5, SHRIMP_LEVEL_TEXTURES[0].idle).setScale(0.5)
        : this.add.circle(x - 45, centerY + 5, 17, definition.color, 1).setStrokeStyle(3, definition.accent, 1);
      icon.setData("guardian", id);
      const name = this.add.text(x - 20, centerY - 17, definition.shortName, {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#f3fbff",
      });
      const cost = this.add.text(x - 20, centerY + 7, `◉ ${definition.cost}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        color: "#ffe69a",
      });
      return { id, background, icon, name, cost };
    });

    this.add
      .rectangle(695, centerY + 10, 355, 78, 0x092f43, 1)
      .setStrokeStyle(2, 0x3da7bd, 0.6);
    this.upgradeTitle = this.add.text(530, centerY - 22, "Selecione um Guardião posicionado", {
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      color: "#d9f8ff",
    });
    this.upgradeDescription = this.add.text(530, centerY + 1, "Toque em um Guardião no mapa para ver o upgrade.", {
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      color: "#8dcbd8",
      wordWrap: { width: 210 },
    });
    this.upgradeButton = this.button(817, centerY + 12, 92, 48, "UPGRADE", () => EventBus.emit(Events.upgradeGuardian));
    this.upgradeButtonText = this.upgradeButton.getData("label") as Phaser.GameObjects.Text;
    this.upgradeButton.setVisible(false);
    this.upgradeButtonText.setVisible(false);

    this.skipButton = this.button(928, centerY + 11, 92, 48, "PULAR  ␣", () => EventBus.emit(Events.skipCountdown));
    this.skipButtonText = this.skipButton.getData("label") as Phaser.GameObjects.Text;

    this.button(1138, centerY + 11, 96, 48, "REINICIAR", () => EventBus.emit(Events.restart));
    this.add
      .text(1138, centerY - 30, "RECIFE 1", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#69bfd1",
      })
      .setOrigin(0.5);
  }

  private createDebugPanel(): void {
    this.debugToggle = this.button(1030, GAME_HEIGHT - HUD_BOTTOM / 2 + 11, 88, 48, "DEBUG F2", () => EventBus.emit(Events.toggleDebug));
    this.debugToggleText = this.debugToggle.getData("label") as Phaser.GameObjects.Text;
    this.debugToggle.setVisible(this.debugFromQuery);
    this.debugToggleText.setVisible(this.debugFromQuery);

    this.debugPanel = this.add
      .rectangle(1120, 240, 282, 300, 0x001723, 0.94)
      .setStrokeStyle(2, 0xff4df3, 0.8)
      .setVisible(false);
    const title = this.add
      .text(1120, 105, "DEBUG OVERLAY", {
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ff9bf5",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.debugPanel.setData("title", title);

    const definitions: Array<[keyof Omit<DebugFlags, "enabled">, string]> = [
      ["route", "ROTA"],
      ["ranges", "ALCANCE"],
      ["hitboxes", "HITBOXES"],
      ["current", "CORRENTE"],
      ["states", "ESTADOS"],
      ["targets", "ALVOS"],
      ["placements", "POSIÇÕES"],
    ];
    this.debugButtons = definitions.map(([flag, text], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const background = this.button(1059 + column * 122, 143 + row * 53, 108, 39, text, () => EventBus.emit(Events.toggleDebugFlag, flag));
      const label = background.getData("label") as Phaser.GameObjects.Text;
      background.setVisible(false);
      label.setVisible(false);
      return { flag, background, label };
    });
    const hint = this.add
      .text(1120, 371, "F2 fecha · overlays não recebem input", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8cbac4",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.debugPanel.setData("hint", hint);

    this.debugCollapseButton = this.button(1238, 105, 30, 26, "−", () => {
      this.debugPanelCollapsed = true;
      this.updateDebugPanelVisibility();
    });
    this.debugCollapseText = this.debugCollapseButton.getData("label") as Phaser.GameObjects.Text;
    this.debugCollapseButton.setVisible(false);
    this.debugCollapseText.setVisible(false);

    this.debugOpenButton = this.button(1190, 92, 138, 34, "ABRIR DEBUG", () => {
      this.debugPanelCollapsed = false;
      this.updateDebugPanelVisibility();
    });
    this.debugOpenText = this.debugOpenButton.getData("label") as Phaser.GameObjects.Text;
    this.debugOpenButton.setVisible(false);
    this.debugOpenText.setVisible(false);
  }

  private createResultOverlay(): void {
    this.resultShade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x00111b, 0.74).setVisible(false);
    this.resultTitle = this.add
      .text(GAME_WIDTH / 2, 282, "", {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: "48px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.resultSubtitle = this.add
      .text(GAME_WIDTH / 2, 340, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "19px",
        color: "#a7e4f0",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.resultRestart = this.button(GAME_WIDTH / 2, 408, 180, 54, "JOGAR DE NOVO", () => EventBus.emit(Events.restart));
    this.resultRestartText = this.resultRestart.getData("label") as Phaser.GameObjects.Text;
    this.resultRestart.setVisible(false);
    this.resultRestartText.setVisible(false);
  }

  private renderSnapshot(snapshot: HudSnapshot): void {
    this.pearlText.setText(`◉ ${snapshot.pearls}`);
    this.healthText.setText(`RECIFE ♥ ${snapshot.reefHealth}/${snapshot.maxReefHealth}`);
    this.healthText.setColor(snapshot.reefHealth <= 6 ? "#ff7d83" : "#82f1bd");
    this.waveText.setText(`ONDA ${snapshot.wave}/${snapshot.totalWaves}`);
    this.timerText.setText(snapshot.waveState === "countdown" ? `EM ${snapshot.countdownSeconds}s` : snapshot.waveState === "victory" ? "CONCLUÍDO" : "EM CURSO");
    this.messageText.setText(snapshot.message);
    this.pauseText.setText(snapshot.paused ? "▶" : "Ⅱ");
    this.muteText.setText(snapshot.muted ? "×♪" : "♪");
    this.skipButton.setVisible(snapshot.canSkipCountdown && !snapshot.gameOver);
    this.skipButtonText.setVisible(snapshot.canSkipCountdown && !snapshot.gameOver);

    this.cards.forEach((card) => {
      const selected = snapshot.selectedGuardianId === card.id;
      const affordable = snapshot.pearls >= GUARDIANS[card.id].cost;
      card.background.setFillStyle(selected ? 0x17617a : 0x0a3c53, affordable ? 1 : 0.55);
      card.background.setStrokeStyle(selected ? 4 : 2, selected ? 0xffe580 : GUARDIANS[card.id].color, selected ? 1 : 0.72);
      card.icon.setAlpha(affordable ? 1 : 0.55);
      card.name.setAlpha(affordable ? 1 : 0.55);
      card.cost.setColor(affordable ? "#ffe69a" : "#ff8585");
    });

    const selected = snapshot.selectedPlacedGuardian;
    if (selected) {
      const hasNext = selected.nextUpgradeCost !== null;
      this.upgradeTitle.setText(
        `${selected.name} · nível ${selected.upgradeLevel}/${selected.maxUpgradeLevel}${selected.nextUpgradeName ? ` · ${selected.nextUpgradeName}` : ""}`,
      );
      this.upgradeDescription.setText(selected.nextUpgradeDescription ?? "Todos os upgrades instalados.");
      this.upgradeButtonText.setText(hasNext ? `◉ ${selected.nextUpgradeCost}` : "MÁXIMO");
      this.upgradeButton.setVisible(hasNext);
      this.upgradeButtonText.setVisible(hasNext);
      if (hasNext) {
        this.upgradeButton.setFillStyle(snapshot.pearls >= selected.nextUpgradeCost! ? 0x13728a : 0x563947, 1);
      }
    } else {
      this.upgradeTitle.setText("Selecione um Guardião posicionado");
      this.upgradeDescription.setText("Toque em um Guardião no mapa para ver o upgrade.");
      this.upgradeButton.setVisible(false);
      this.upgradeButtonText.setVisible(false);
    }

    this.renderDebugState(snapshot.debug);
    this.renderResult(snapshot.gameOver);
  }

  private renderDebugState(debug: DebugFlags): void {
    this.debugEnabled = debug.enabled;
    const showToggle = this.debugFromQuery || debug.enabled;
    this.debugToggle.setVisible(showToggle);
    this.debugToggleText.setVisible(showToggle);
    this.debugToggle.setStrokeStyle(2, debug.enabled ? 0xff4df3 : 0x348ba0, debug.enabled ? 1 : 0.7);
    this.debugButtons.forEach((button) => {
      const enabled = debug[button.flag];
      button.background.setFillStyle(enabled ? 0x4a1e55 : 0x102f3a, 1);
      button.background.setStrokeStyle(2, enabled ? 0xff65ee : 0x476b75, enabled ? 1 : 0.65);
    });
    this.updateDebugPanelVisibility();
  }

  private updateDebugPanelVisibility(): void {
    const expanded = this.debugEnabled && !this.debugPanelCollapsed;
    const collapsed = this.debugEnabled && this.debugPanelCollapsed;
    this.game.canvas.dataset.debugPanel = expanded ? "expanded" : collapsed ? "collapsed" : "hidden";
    this.debugPanel.setVisible(expanded);
    (this.debugPanel.getData("title") as Phaser.GameObjects.Text).setVisible(expanded);
    (this.debugPanel.getData("hint") as Phaser.GameObjects.Text).setVisible(expanded);
    this.debugCollapseButton.setVisible(expanded);
    this.debugCollapseText.setVisible(expanded);
    this.debugOpenButton.setVisible(collapsed);
    this.debugOpenText.setVisible(collapsed);
    this.debugButtons.forEach((button) => {
      button.background.setVisible(expanded);
      button.label.setVisible(expanded);
    });
  }

  private renderResult(result: HudSnapshot["gameOver"]): void {
    const visible = result !== null;
    this.resultShade.setVisible(visible);
    this.resultTitle.setVisible(visible);
    this.resultSubtitle.setVisible(visible);
    this.resultRestart.setVisible(visible);
    this.resultRestartText.setVisible(visible);
    if (!result) return;
    this.resultTitle.setText(result === "victory" ? "RECIFE PROTEGIDO!" : "O RECIFE CAIU");
    this.resultTitle.setColor(result === "victory" ? "#8dffd0" : "#ff858b");
    this.resultSubtitle.setText(result === "victory" ? "As cinco ondas foram vencidas." : "Reposicione sua defesa e tente novamente.");
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    onClick: () => void,
  ): Phaser.GameObjects.Rectangle {
    const background = this.add
      .rectangle(x, y, width, height, 0x103e50, 1)
      .setStrokeStyle(2, 0x348ba0, 0.75)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, text, {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#e9fbff",
        align: "center",
      })
      .setOrigin(0.5);
    background.setData("label", label);
    background.on("pointerdown", onClick);
    background.on("pointerover", () => background.setAlpha(0.8));
    background.on("pointerout", () => background.setAlpha(1));
    return background;
  }

  private topStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: "Arial, sans-serif",
      fontSize: "17px",
      fontStyle: "bold",
      color,
    };
  }
}
