import Phaser from "phaser";
import { artTextureKey, artTextureKeyForFolder, GUARDIAN_ART, solidBounds } from "../assets/guardianArt";
import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { DEFAULT_LOADOUT, GUARDIANS } from "../data/guardians";
import { EventBus, Events } from "../EventBus";
import { HUD_LAYOUT } from "../hudLayout";
import type { BranchId, BranchStatus, DebugFlags, GuardianId, HudSnapshot, UpgradeOption } from "../types";

export { HUD_LAYOUT };

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

interface OptionButton {
  /** Botão fixo por ramo: A à esquerda, B à direita. */
  slot: BranchId;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  option: UpgradeOption | null;
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
  /** Árvore dos dois ramos: `BASE ─┬─ A I → A II` / `└─ B I 🔒`. */
  private upgradeTree!: Phaser.GameObjects.Text;
  private loadout: GuardianId[] = [...DEFAULT_LOADOUT];
  /** Card de retrato da variante atual do Guardião selecionado, acima do painel de upgrade. */
  private portraitCard: Phaser.GameObjects.Image | null = null;
  private optionButtons: OptionButton[] = [];
  private sellButton!: Phaser.GameObjects.Rectangle;
  private sellButtonText!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Rectangle;
  private pauseText!: Phaser.GameObjects.Text;
  private muteButton!: Phaser.GameObjects.Rectangle;
  private muteText!: Phaser.GameObjects.Text;
  private skipButton!: Phaser.GameObjects.Rectangle;
  private skipButtonText!: Phaser.GameObjects.Text;
  /** Botões de velocidade (1× e 2×) e o estado que eles representam. */
  private speedButtons: Array<{ speed: 1 | 2; background: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = [];
  /** Prévia da próxima onda, encostada à direita abaixo do HUD de cima. */
  private wavePreviewText!: Phaser.GameObjects.Text;
  /** Barra do chefe em campo. */
  private bossBarBackground!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossBarLabel!: Phaser.GameObjects.Text;
  private levelLabel!: Phaser.GameObjects.Text;
  private debugToggle!: Phaser.GameObjects.Rectangle;
  private debugToggleText!: Phaser.GameObjects.Text;
  private debugPanel!: Phaser.GameObjects.Rectangle;
  private debugCollapseButton!: Phaser.GameObjects.Rectangle;
  private debugCollapseText!: Phaser.GameObjects.Text;
  private debugOpenButton!: Phaser.GameObjects.Rectangle;
  private debugOpenText!: Phaser.GameObjects.Text;
  private debugButtons: DebugButton[] = [];
  private debugActionButtons: Array<{ background: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = [];
  private debugPanelCollapsed = false;
  private debugEnabled = false;
  private resultShade!: Phaser.GameObjects.Rectangle;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultSubtitle!: Phaser.GameObjects.Text;
  private resultRestart!: Phaser.GameObjects.Rectangle;
  private resultRestartText!: Phaser.GameObjects.Text;
  private resultNext!: Phaser.GameObjects.Rectangle;
  private resultNextText!: Phaser.GameObjects.Text;
  private resultMenu!: Phaser.GameObjects.Rectangle;
  private resultMenuText!: Phaser.GameObjects.Text;
  private nextLevelId: string | null = null;
  private debugFromQuery = false;

  constructor() {
    super("UIScene");
  }

  init(data: { debugFromQuery?: boolean; loadout?: GuardianId[] }): void {
    this.debugFromQuery = Boolean(data.debugFromQuery);
    this.loadout = data.loadout && data.loadout.length > 0 ? [...data.loadout] : [...DEFAULT_LOADOUT];
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
    this.add.text(22, 13, "GUARDIÕES\nDO RECIFE", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "18px",
      lineSpacing: -4,
      color: "#f3fcff",
    });
    this.pearlText = this.add.text(206, 24, "◉ 180", this.topStyle("#ffe69a"));
    this.healthText = this.add.text(340, 24, "RECIFE ♥ 20/20", this.topStyle("#82f1bd"));
    this.waveText = this.add.text(548, 24, "ONDA 1/5", this.topStyle("#d4f7ff"));
    this.timerText = this.add.text(690, 24, "EM 10s", this.topStyle("#75e2f5"));
    // Centro deslocado para a esquerda: a faixa da direita agora pertence aos botões de velocidade.
    this.messageText = this.add
      .text(855, 36, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 235 },
      })
      .setOrigin(0.5);

    this.speedButtons = ([1, 2] as const).map((speed, index) => {
      const background = this.button(HUD_LAYOUT.speedButtonXs[index], HUD_LAYOUT.topButtonY, HUD_LAYOUT.speedButtonWidth, 42, `${speed}×`, () =>
        EventBus.emit(Events.setSpeed, speed),
      );
      const label = background.getData("label") as Phaser.GameObjects.Text;
      label.setFontSize(13);
      return { speed, background, label };
    });
    this.pauseButton = this.button(HUD_LAYOUT.pauseButtonX, HUD_LAYOUT.topButtonY, 48, 42, "Ⅱ", () => EventBus.emit(Events.togglePause));
    this.pauseText = this.pauseButton.getData("label") as Phaser.GameObjects.Text;
    this.muteButton = this.button(HUD_LAYOUT.muteButtonX, HUD_LAYOUT.topButtonY, 48, 42, "♪", () => EventBus.emit(Events.toggleMute));
    this.muteText = this.muteButton.getData("label") as Phaser.GameObjects.Text;

    // Prévia da próxima onda: discreta, encostada à direita, fora do caminho do mapa.
    this.wavePreviewText = this.add
      .text(HUD_LAYOUT.wavePreviewRight, HUD_LAYOUT.wavePreviewY, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#cdefff",
        align: "right",
        backgroundColor: "rgba(2, 28, 44, .68)",
        padding: { x: 8, y: 5 },
        lineSpacing: 2,
      })
      .setOrigin(1, 0)
      .setVisible(false);

    this.createBossBar();
  }

  /** Barra de vida do chefe: aparece só enquanto há um em campo. */
  private createBossBar(): void {
    const { bossBarX, bossBarY, bossBarWidth } = HUD_LAYOUT;
    this.bossBarBackground = this.add
      .rectangle(bossBarX, bossBarY + 10, bossBarWidth, 14, 0x1a0a12, 0.88)
      .setStrokeStyle(2, 0xff6f79, 0.9)
      .setVisible(false);
    this.bossBarFill = this.add.rectangle(bossBarX - bossBarWidth / 2 + 2, bossBarY + 10, bossBarWidth - 4, 10, 0xff4d5e, 1).setOrigin(0, 0.5).setVisible(false);
    this.bossBarLabel = this.add
      .text(bossBarX, bossBarY - 4, "", {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: "12px",
        color: "#ffd9dc",
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
  }

  private createBottomHud(): void {
    const centerY = GAME_HEIGHT - HUD_BOTTOM / 2;
    this.add
      .rectangle(GAME_WIDTH / 2, centerY, GAME_WIDTH, HUD_BOTTOM, 0x031d2d, 0.97)
      .setStrokeStyle(2, 0x1581a3, 0.7);
    this.add.text(18, GAME_HEIGHT - HUD_BOTTOM + 6, "GUARDIÕES", {
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#72cfe5",
      letterSpacing: 1,
    });

    this.cards = this.loadout.map((id, index) => {
      const definition = GUARDIANS[id];
      const x = HUD_LAYOUT.cardStartX + index * HUD_LAYOUT.cardStep;
      const background = this.add
        .rectangle(x, centerY + 10, HUD_LAYOUT.cardWidth, 78, 0x0a3c53, 1)
        .setStrokeStyle(2, definition.color, 0.78)
        .setInteractive({ useHandCursor: true });
      background.on("pointerdown", () => EventBus.emit(Events.selectGuardian, id));
      const icon =
        this.artIcon(artTextureKey(id, GUARDIAN_ART[id].base, "idle"), x - 34, centerY + 6, 42, 48) ??
        this.add.circle(x - 34, centerY + 6, 13, definition.color, 1).setStrokeStyle(3, definition.accent, 1);
      icon.setData("guardian", id);
      const name = this.add.text(x - 17, centerY - 20, definition.shortName, {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#f3fbff",
      });
      const cost = this.add.text(x - 17, centerY - 2, `◉ ${definition.cost}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        color: "#ffe69a",
      });
      this.add.text(x - 17, centerY + 16, definition.role, {
        fontFamily: "Arial, sans-serif",
        fontSize: "9px",
        color: "#8dcbd8",
      });
      return { id, background, icon, name, cost };
    });

    this.add
      .rectangle(HUD_LAYOUT.panelX, centerY + 4, HUD_LAYOUT.panelWidth, 100, 0x092f43, 1)
      .setStrokeStyle(2, 0x3da7bd, 0.6);
    const panelLeft = HUD_LAYOUT.panelX - HUD_LAYOUT.panelWidth / 2 + 10;
    this.upgradeTitle = this.add.text(panelLeft, GAME_HEIGHT - HUD_BOTTOM + 10, "Selecione um Guardião posicionado", {
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      color: "#d9f8ff",
    });
    this.upgradeTree = this.add.text(panelLeft, GAME_HEIGHT - HUD_BOTTOM + 27, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "10px",
      color: "#d9f8ff",
      lineSpacing: 0,
    });
    this.upgradeDescription = this.add.text(panelLeft, GAME_HEIGHT - HUD_BOTTOM + 52, "Toque em um Guardião no mapa para ver os ramos de upgrade e vender.", {
      fontFamily: "Arial, sans-serif",
      fontSize: "10px",
      color: "#8dcbd8",
      wordWrap: { width: HUD_LAYOUT.panelWidth - 20 },
      lineSpacing: 1,
      maxLines: 2,
    });

    this.optionButtons = (["a", "b"] as BranchId[]).map((slot, index) => {
      const background = this.button(HUD_LAYOUT.optionButtonXs[index], HUD_LAYOUT.optionButtonY, 104, 34, "", () => {
        const option = this.optionButtons[index].option;
        // Ramo bloqueado ou completo: o clique vai à cena só para a mensagem explicativa.
        EventBus.emit(Events.upgradeGuardian, option?.branchId ?? slot);
      });
      const label = background.getData("label") as Phaser.GameObjects.Text;
      label.setFontSize(10);
      background.setVisible(false);
      label.setVisible(false);
      return { slot, background, label, option: null };
    });

    this.sellButton = this.button(HUD_LAYOUT.sellButtonX, HUD_LAYOUT.optionButtonY, 96, 34, "VENDER", () => EventBus.emit(Events.sellGuardian));
    this.sellButtonText = this.sellButton.getData("label") as Phaser.GameObjects.Text;
    this.sellButtonText.setFontSize(10);
    this.sellButton.setFillStyle(0x4a2a33, 1).setStrokeStyle(2, 0xff8290, 0.8);
    this.sellButton.setVisible(false);
    this.sellButtonText.setVisible(false);

    this.skipButton = this.button(HUD_LAYOUT.skipButtonX, HUD_LAYOUT.skipButtonY, HUD_LAYOUT.skipButtonWidth, 34, "PRÓXIMA ONDA  ␣", () =>
      EventBus.emit(Events.startNextWave),
    );
    this.skipButtonText = this.skipButton.getData("label") as Phaser.GameObjects.Text;
    this.skipButtonText.setFontSize(11);

    this.button(HUD_LAYOUT.restartButtonX, HUD_LAYOUT.restartButtonY, 120, 34, "REINICIAR", () => EventBus.emit(Events.restart));
    this.button(HUD_LAYOUT.menuButtonX, HUD_LAYOUT.menuButtonY, 120, 34, "FASES", () => EventBus.emit(Events.openLevelSelect));
    this.levelLabel = this.add
      .text(HUD_LAYOUT.restartButtonX, GAME_HEIGHT - HUD_BOTTOM + 8, "RECIFE 1", {
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        color: "#69bfd1",
      })
      .setOrigin(0.5, 0);
  }

  private createDebugPanel(): void {
    this.debugToggle = this.button(HUD_LAYOUT.debugButtonX, HUD_LAYOUT.debugButtonY, 84, 34, "DEBUG F2", () => EventBus.emit(Events.toggleDebug));
    this.debugToggleText = this.debugToggle.getData("label") as Phaser.GameObjects.Text;
    this.debugToggle.setVisible(this.debugFromQuery);
    this.debugToggleText.setVisible(this.debugFromQuery);

    this.debugPanel = this.add
      .rectangle(1120, 268, 282, 356, 0x001723, 0.94)
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
      ["controls", "CONTROLES"],
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
    this.createDebugActions();
    const hint = this.add
      .text(1120, 427, "F2 fecha · ações marcam a partida como testada", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8cbac4",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.debugPanel.setData("hint", hint);

    this.debugCollapseButton = this.button(1238, 105, 30, 26, "\u2212", () => {
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

  /** Atalhos de desenvolvimento: pérolas, spawns, pular onda, matar tudo e invencibilidade. */
  private createDebugActions(): void {
    let invincible = false;
    const actions: Array<[string, () => void]> = [
      ["+100 ◉", () => EventBus.emit(Events.debugCommand, { type: "debug.addPearls", amount: 100 })],
      ["SPAWN", () => EventBus.emit(Events.debugCommand, { type: "debug.spawnEnemy", enemyId: "swimmer" })],
      ["ELITE", () => EventBus.emit(Events.debugCommand, { type: "debug.spawnEnemy", enemyId: "shellback", elite: "armored" })],
      ["PULAR", () => EventBus.emit(Events.debugCommand, { type: "debug.skipWave" })],
      ["MATAR", () => EventBus.emit(Events.debugCommand, { type: "debug.killAll" })],
      [
        "IMUNE",
        () => {
          invincible = !invincible;
          EventBus.emit(Events.debugCommand, { type: "debug.invincible", on: invincible });
        },
      ],
    ];
    this.debugActionButtons = actions.map(([text, onClick], index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const background = this.button(1038 + column * 82, 350 + row * 40, 78, 34, text, onClick);
      const label = background.getData("label") as Phaser.GameObjects.Text;
      label.setFontSize(11);
      background.setFillStyle(0x2a1330, 1).setStrokeStyle(2, 0xff65ee, 0.8);
      background.setVisible(false);
      label.setVisible(false);
      return { background, label };
    });
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
        align: "center",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.resultRestart = this.button(GAME_WIDTH / 2 - 210, 408, 180, 54, "JOGAR DE NOVO", () => EventBus.emit(Events.restart));
    this.resultRestartText = this.resultRestart.getData("label") as Phaser.GameObjects.Text;
    this.resultNext = this.button(GAME_WIDTH / 2, 408, 180, 54, "PRÓXIMA FASE", () => {
      if (this.nextLevelId) EventBus.emit(Events.startLevel, this.nextLevelId);
    });
    this.resultNextText = this.resultNext.getData("label") as Phaser.GameObjects.Text;
    this.resultNext.setFillStyle(0x13728a, 1).setStrokeStyle(2, 0x67f2ac, 0.9);
    this.resultMenu = this.button(GAME_WIDTH / 2 + 210, 408, 180, 54, "FASES", () => EventBus.emit(Events.openLevelSelect));
    this.resultMenuText = this.resultMenu.getData("label") as Phaser.GameObjects.Text;
    [this.resultRestart, this.resultRestartText, this.resultNext, this.resultNextText, this.resultMenu, this.resultMenuText].forEach(
      (item) => item.setVisible(false),
    );
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
    const canCall = snapshot.canSkipCountdown && !snapshot.gameOver;
    this.skipButton.setVisible(canCall);
    this.skipButtonText.setVisible(canCall);
    this.skipButtonText.setText(snapshot.earlyCallBonus > 0 ? `PRÓXIMA ONDA\n+◉ ${snapshot.earlyCallBonus}` : "PRÓXIMA ONDA  ␣");
    this.renderSpeed(snapshot);
    this.renderWavePreview(snapshot);
    this.renderBossBar(snapshot);
    this.levelLabel.setText(`FASE ${snapshot.levelIndex + 1}/${snapshot.levelCount} · ${snapshot.levelName.toUpperCase()}`);
    this.nextLevelId = snapshot.nextLevelId;

    this.cards.forEach((card) => {
      const selected = snapshot.selectedGuardianId === card.id;
      const affordable = snapshot.pearls >= GUARDIANS[card.id].cost;
      card.background.setFillStyle(selected ? 0x17617a : 0x0a3c53, affordable ? 1 : 0.55);
      card.background.setStrokeStyle(selected ? 4 : 2, selected ? 0xffe580 : GUARDIANS[card.id].color, selected ? 1 : 0.72);
      card.icon.setAlpha(affordable ? 1 : 0.55);
      card.name.setAlpha(affordable ? 1 : 0.55);
      card.cost.setColor(affordable ? "#ffe69a" : "#ff8585");
    });

    this.renderUpgradePanel(snapshot);
    this.renderDebugState(snapshot.debug);
    this.renderResult(snapshot);
  }

  /** Os botões 1×/2× acendem conforme a velocidade; pausado, nenhum fica aceso. */
  private renderSpeed(snapshot: HudSnapshot): void {
    const over = snapshot.gameOver !== null;
    this.speedButtons.forEach((button) => {
      const active = !snapshot.paused && snapshot.speed === button.speed;
      button.background.setVisible(!over);
      button.label.setVisible(!over);
      button.background.setFillStyle(active ? 0x13728a : 0x103e50, 1);
      button.background.setStrokeStyle(2, active ? 0x67f2ac : 0x348ba0, active ? 1 : 0.75);
      button.label.setColor(active ? "#e9fbff" : "#9fc9d6");
    });
  }

  private renderWavePreview(snapshot: HudSnapshot): void {
    const preview = snapshot.nextWave;
    if (!preview || snapshot.gameOver) {
      this.wavePreviewText.setVisible(false);
      return;
    }
    const chips = preview.chips
      .map((chip) => `${chip.isBoss ? "☠" : chip.isElite ? "⚠" : "•"} ${chip.name} ×${chip.count}`)
      .slice(0, 5)
      .join("\n");
    this.wavePreviewText.setText(`PRÓXIMA: ${preview.name.toUpperCase()}\n${chips}`);
    this.wavePreviewText.setColor(preview.isBossWave ? "#ffd9dc" : "#cdefff");
    this.wavePreviewText.setVisible(true);
  }

  private renderBossBar(snapshot: HudSnapshot): void {
    const boss = snapshot.boss;
    const visible = boss !== null && !snapshot.gameOver;
    this.bossBarBackground.setVisible(visible);
    this.bossBarFill.setVisible(visible);
    this.bossBarLabel.setVisible(visible);
    if (!boss) return;
    const phase = boss.phaseCount > 1 ? ` · fase ${boss.phaseIndex + 1}/${boss.phaseCount}` : "";
    this.bossBarLabel.setText(`☠ ${boss.title.toUpperCase()}${phase}`);
    this.bossBarFill.setDisplaySize(Math.max(0, (HUD_LAYOUT.bossBarWidth - 4) * Math.max(0, Math.min(1, boss.healthRatio))), 10);
  }

  private renderUpgradePanel(snapshot: HudSnapshot): void {
    const selected = snapshot.selectedPlacedGuardian;
    this.renderPortraitCard(selected);
    if (!selected) {
      this.upgradeTitle.setText("Selecione um Guardião posicionado");
      this.upgradeTitle.setColor("#d9f8ff");
      this.upgradeTree.setText("");
      this.upgradeDescription.setPosition(this.upgradeDescription.x, GAME_HEIGHT - HUD_BOTTOM + 28);
      this.upgradeDescription.setText("Toque em um Guardião no mapa para ver os ramos de upgrade e vender.");
      this.optionButtons.forEach((button) => {
        button.option = null;
        button.background.setVisible(false);
        button.label.setVisible(false);
      });
      this.sellButton.setVisible(false);
      this.sellButtonText.setVisible(false);
      return;
    }

    const branchLabel = selected.branchName ? ` · ${selected.branchName}` : "";
    this.upgradeTitle.setText(`${selected.name} · nível ${selected.upgradeLevel}/${selected.maxUpgradeLevel}${branchLabel}`);
    this.upgradeTitle.setColor(selected.branchColor !== null ? `#${selected.branchColor.toString(16).padStart(6, "0")}` : "#d9f8ff");
    this.upgradeTree.setText(this.treeText(selected.branches));
    this.upgradeDescription.setPosition(this.upgradeDescription.x, GAME_HEIGHT - HUD_BOTTOM + 52);

    if (selected.options.length === 0) {
      this.upgradeDescription.setText(`Ramo ${selected.branchName ?? ""} completo. Investido: ◉ ${selected.invested}.`);
    } else if (selected.options.length === 1) {
      const option = selected.options[0];
      const locked = selected.branches.find((branch) => branch.state === "locked");
      this.upgradeDescription.setText(`${option.name}: ${option.description}${locked ? `  (${locked.name} bloqueado nesta unidade)` : ""}`);
    } else {
      // Antes da escolha, a árvore acima já mostra os dois passos; aqui vai um resumo curto de cada ramo.
      const definition = GUARDIANS[selected.guardianId];
      this.upgradeDescription.setText(
        selected.options
          .map((option) => {
            const tagline = definition.branches.find((branch) => branch.id === option.branchId)?.tagline ?? "";
            return `${option.branchName.toUpperCase()} · ${option.name}: ${tagline}`;
          })
          .join("\n"),
      );
    }

    // Os dois botões ficam sempre visíveis, fixos por ramo; o ramo descartado aparece bloqueado.
    this.optionButtons.forEach((button) => {
      const status = selected.branches.find((branch) => branch.id === button.slot);
      const option = selected.options.find((candidate) => candidate.branchId === button.slot) ?? null;
      button.option = option;
      button.background.setVisible(true);
      button.label.setVisible(true);
      if (!status) return;
      if (option) {
        const affordable = snapshot.pearls >= option.cost;
        button.label.setText(`${option.branchName.toUpperCase()} ${"I".repeat(option.level)}\n◉ ${option.cost}`);
        button.label.setColor("#e9fbff");
        button.background.setFillStyle(affordable ? 0x13728a : 0x563947, 1);
        button.background.setStrokeStyle(2, option.branchColor, 0.95);
        button.background.setAlpha(1);
      } else if (status.state === "locked") {
        button.label.setText(`${status.name.toUpperCase()}\n🔒 bloqueado`);
        button.label.setColor("#7d8e96");
        button.background.setFillStyle(0x1a2a31, 1);
        button.background.setStrokeStyle(2, 0x3a4a52, 0.9);
      } else {
        button.label.setText(`${status.name.toUpperCase()}\n✓ completo`);
        button.label.setColor("#cfeee0");
        button.background.setFillStyle(0x0f4a3c, 1);
        button.background.setStrokeStyle(2, status.color, 0.9);
      }
    });

    this.sellButtonText.setText(`VENDER\n◉ ${selected.sellValue}`);
    this.sellButton.setVisible(true);
    this.sellButtonText.setVisible(true);
  }

  /**
   * Duas linhas, uma por ramo: passos comprados com ✓, próximo passo com o custo, ramo bloqueado com 🔒.
   * Ex.: `BASE ─┬─ FRENESI I ✓ → FRENESI II ◉150`
   *      `     └─ CAÇADOR ALFA 🔒 bloqueado`
   */
  private treeText(branches: BranchStatus[]): string {
    return branches
      .map((branch, index) => {
        const connector = index === 0 ? "BASE ─┬─ " : "     └─ ";
        if (branch.state === "locked") return `${connector}${branch.name.toUpperCase()} 🔒 bloqueado`;
        const steps = branch.steps.map((step, level) => {
          const roman = level === 0 ? "I" : "II";
          if (step.purchased) return `${branch.name.toUpperCase()} ${roman} ✓`;
          const next = branch.steps.findIndex((candidate) => !candidate.purchased) === level;
          return next && branch.state !== "complete" ? `${branch.name.toUpperCase()} ${roman} ◉${step.cost}` : `${branch.name.toUpperCase()} ${roman}`;
        });
        return `${connector}${steps.join(" → ")}`;
      })
      .join("\n");
  }

  /**
   * Retrato da variante atual, encostado no canto superior direito logo abaixo do HUD de cima (longe das
   * plataformas e do painel de upgrade). Não recebe input, então toques no mapa atrás dele funcionam.
   */
  private renderPortraitCard(selected: HudSnapshot["selectedPlacedGuardian"]): void {
    const key = selected ? artTextureKeyForFolder(selected.guardianId, selected.artVariant, "portrait") : null;
    if (!key || !this.textures.exists(key)) {
      this.portraitCard?.setVisible(false);
      return;
    }
    if (!this.portraitCard) {
      this.portraitCard = this.add.image(0, 0, key).setOrigin(1, 0).setAlpha(0.96);
    } else if (this.portraitCard.texture.key !== key) {
      this.portraitCard.setTexture(key);
    }
    const frame = this.textures.getFrame(key);
    // Os cinco primeiros retratos são faixas largas (~290x105); os dos novos Guardiões são cards em pé
    // (~200x250) e precisam de mais altura para o texto continuar legível.
    const portraitOrientation = frame.height > frame.width;
    const scale = portraitOrientation ? Math.min(150 / frame.height, 130 / frame.width) : Math.min(84 / frame.height, 280 / frame.width);
    this.portraitCard.setScale(scale).setPosition(GAME_WIDTH - 10, HUD_TOP + 8).setVisible(true);
  }

  /**
   * Ícone da carta: a imagem `idle` da base recortada aos pixels visíveis e ajustada à caixa pedida.
   * `setCrop` mantém a posição do quadro inteiro, então o deslocamento centraliza só a parte visível.
   */
  private artIcon(key: string, centerX: number, centerY: number, boxWidth: number, boxHeight: number): Phaser.GameObjects.Image | null {
    const bounds = solidBounds(this, key);
    if (!bounds) return null;
    const frame = this.textures.getFrame(key);
    const scale = Math.min(boxWidth / bounds.width, boxHeight / bounds.height);
    const offsetX = (bounds.x + bounds.width / 2 - frame.width / 2) * scale;
    const offsetY = (bounds.y + bounds.height / 2 - frame.height / 2) * scale;
    return this.add
      .image(centerX - offsetX, centerY - offsetY, key)
      .setScale(scale)
      .setCrop(bounds.x, bounds.y, bounds.width, bounds.height);
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
    this.debugActionButtons.forEach((button) => {
      button.background.setVisible(expanded);
      button.label.setVisible(expanded);
    });
  }

  private renderResult(snapshot: HudSnapshot): void {
    const result = snapshot.gameOver;
    const visible = result !== null;
    this.resultShade.setVisible(visible);
    this.resultTitle.setVisible(visible);
    this.resultSubtitle.setVisible(visible);
    this.resultRestart.setVisible(visible);
    this.resultRestartText.setVisible(visible);
    this.resultMenu.setVisible(visible);
    this.resultMenuText.setVisible(visible);
    const showNext = visible && result === "victory" && snapshot.nextLevelId !== null;
    this.resultNext.setVisible(showNext);
    this.resultNextText.setVisible(showNext);
    if (!result) return;
    this.resultTitle.setText(result === "victory" ? "RECIFE PROTEGIDO!" : "O RECIFE CAIU");
    this.resultTitle.setColor(result === "victory" ? "#8dffd0" : "#ff858b");
    this.resultSubtitle.setText(
      result === "victory"
        ? snapshot.nextLevelId
          ? `${snapshot.levelName}: ${snapshot.totalWaves} ondas vencidas. A próxima fase foi liberada!`
          : `${snapshot.levelName}: ${snapshot.totalWaves} ondas vencidas. Você protegeu todo o Recife!`
        : "Reposicione sua defesa e tente novamente.",
    );
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
