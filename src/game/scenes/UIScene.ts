import Phaser from "phaser";
import { enemyFrameKey } from "../assets/enemyArt";
import { artTextureKey, artTextureKeyForFolder, fitImageToBox, GUARDIAN_ART, solidBounds } from "../assets/guardianArt";
import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { PLACEMENT_HINTS } from "../core/PlacementRules";
import { ENEMIES, resolveEnemy } from "../data/enemies";
import { DEFAULT_LOADOUT, GUARDIANS } from "../data/guardians";
import { EventBus, Events } from "../EventBus";
import { HUD_LAYOUT } from "../hudLayout";
import { hudIcon, type HudIconName } from "../ui/hud/HudIcons";
import { GLOW_PAD, HUD_COLORS, HUD_FONT, hudBar, hudPanel, type PanelStyle } from "../ui/hud/HudSkin";
import { publishUiRegistry, UI_REGISTRY } from "../ui/UiRegistry";
import type { BranchId, DebugFlags, GuardianId, HudSnapshot, UpgradeOption } from "../types";

export { HUD_LAYOUT };

/** Largura da coluna do retrato dentro do painel de contexto. */
const PANEL_ICON_COLUMN = 58;

/** Faixa da dica do tutorial, acima das cartas. */
const TUTORIAL_HINT = { x: 330, width: 560, skipX: 330 + 560 / 2 - 48 } as const;

/** Quantas linhas de inimigo cabem na prévia da próxima onda. */
const PREVIEW_ROWS = 4;

/**
 * Paleta dos painéis de vidro. Cada entrada é um estado inteiro (preenchimento, borda e brilho),
 * porque trocar a textura é como a cena acende e apaga um controle.
 */
const SKIN = {
  bar: {
    radius: 0,
    fill: ["rgba(7, 38, 62, 0.93)", "rgba(3, 17, 30, 0.97)"],
    border: "rgba(48, 150, 190, 0.5)",
    borderWidth: 2,
    glow: "rgba(0, 0, 0, 0)",
    glowBlur: 0,
    sheen: 0.07,
  },
  pod: {
    radius: 13,
    fill: ["rgba(11, 52, 82, 0.86)", "rgba(4, 24, 42, 0.9)"],
    border: "#2892b8",
    borderTop: "#5cc8e8",
    glow: "rgba(70, 200, 245, 0.3)",
    glowBlur: 9,
    sheen: 0.12,
  },
  panel: {
    radius: 14,
    fill: ["rgba(11, 50, 78, 0.9)", "rgba(4, 22, 38, 0.94)"],
    border: "#2b9cc2",
    borderTop: "#62d0ee",
    glow: "rgba(70, 200, 245, 0.28)",
    glowBlur: 10,
    sheen: 0.1,
  },
  button: {
    radius: 11,
    fill: ["rgba(15, 62, 92, 0.92)", "rgba(6, 30, 50, 0.95)"],
    border: "#2d9dc4",
    borderTop: "#5ecae9",
    glow: "rgba(70, 200, 245, 0.28)",
    glowBlur: 9,
    sheen: 0.14,
  },
  buttonOn: {
    radius: 11,
    fill: ["rgba(24, 108, 146, 0.95)", "rgba(9, 52, 80, 0.96)"],
    border: "#8af0ff",
    borderTop: "#d6fbff",
    glow: "rgba(130, 240, 255, 0.6)",
    glowBlur: 16,
    innerGlow: "rgba(120, 230, 255, 0.35)",
    sheen: 0.2,
  },
  buttonOff: {
    radius: 11,
    fill: ["rgba(14, 34, 48, 0.9)", "rgba(7, 20, 32, 0.92)"],
    border: "#2d4c5c",
    borderTop: "#3d6478",
    glow: "rgba(0, 0, 0, 0)",
    glowBlur: 0,
    sheen: 0.04,
  },
  primary: {
    radius: 11,
    fill: ["rgba(18, 90, 126, 0.95)", "rgba(7, 40, 64, 0.96)"],
    border: "#5fd8f7",
    borderTop: "#b6f2ff",
    glow: "rgba(95, 216, 247, 0.5)",
    glowBlur: 14,
    sheen: 0.18,
  },
  danger: {
    radius: 11,
    fill: ["rgba(92, 32, 46, 0.93)", "rgba(44, 13, 24, 0.95)"],
    border: "#ff6f7e",
    borderTop: "#ffb0b8",
    glow: "rgba(255, 111, 126, 0.4)",
    glowBlur: 12,
    sheen: 0.12,
  },
} as const satisfies Record<string, PanelStyle>;

/** Um controle de vidro: a imagem do painel, o rótulo e os enfeites que andam junto com ele. */
class HudControl {
  private readonly parts: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text> = [];

  constructor(
    readonly image: Phaser.GameObjects.Image,
    readonly label: Phaser.GameObjects.Text,
    readonly icon: Phaser.GameObjects.Image | null,
  ) {
    this.parts.push(image, label);
    if (icon) this.parts.push(icon);
  }

  /** Peças opcionais (a moeda do custo, a segunda linha) que aparecem e somem junto com o controle. */
  add(...extra: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text>): this {
    this.parts.push(...extra);
    return this;
  }

  setVisible(visible: boolean): this {
    for (const part of this.parts) part.setVisible(visible);
    return this;
  }

  /** Troca o painel pintado: é assim que um controle acende, apaga ou muda de cor. */
  skin(key: string): this {
    this.image.setTexture(key);
    return this;
  }
}

interface GuardianCard {
  id: GuardianId;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  name: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  coin: Phaser.GameObjects.Image;
  role: Phaser.GameObjects.Text;
  skins: { idle: string; selected: string; poor: string };
}

interface DebugButton {
  flag: keyof Omit<DebugFlags, "enabled">;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

interface OptionButton {
  /** Botão fixo por ramo: A à esquerda, B no meio. */
  slot: BranchId;
  control: HudControl;
  cost: Phaser.GameObjects.Text;
  coin: Phaser.GameObjects.Image;
  option: UpgradeOption | null;
}

/** Uma linha da prévia: retrato do inimigo, nome e quantidade. */
interface PreviewRow {
  icon: Phaser.GameObjects.Image;
  dot: Phaser.GameObjects.Arc;
  name: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
}

/** Uma medida do painel de contexto: pictograma, nome curto e valor. */
interface StatCell {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
}

export class UIScene extends Phaser.Scene {
  private pearlText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private cards: GuardianCard[] = [];
  private upgradeTitle!: Phaser.GameObjects.Text;
  private upgradeLevel!: Phaser.GameObjects.Text;
  private upgradeDescription!: Phaser.GameObjects.Text;
  private statCells: StatCell[] = [];
  private loadout: GuardianId[] = [...DEFAULT_LOADOUT];
  /** Retrato da variante atual do Guardião em foco, na coluna esquerda do painel. */
  private panelIcon: Phaser.GameObjects.Image | null = null;
  private tutorialBox!: Phaser.GameObjects.Image;
  private tutorialText!: Phaser.GameObjects.Text;
  private tutorialSkip!: HudControl;
  private tutorialFocus!: Phaser.GameObjects.Graphics;
  private optionButtons: OptionButton[] = [];
  private sellButton!: HudControl;
  private sellValue!: Phaser.GameObjects.Text;
  private pauseButton!: HudControl;
  private muteButton!: HudControl;
  private skipButton!: HudControl;
  private skipBonus!: Phaser.GameObjects.Text;
  /** Botões de velocidade (1× e 2×) e o estado que eles representam. */
  private speedButtons: Array<{ speed: 1 | 2; control: HudControl }> = [];
  /** Prévia da próxima onda, encostada à direita abaixo da barra de cima. */
  private previewPanel!: Phaser.GameObjects.Image;
  private previewTitle!: Phaser.GameObjects.Text;
  private previewIcon!: Phaser.GameObjects.Image;
  private previewRows: PreviewRow[] = [];
  /** Barra de vida do chefe em campo. */
  private bossBarBackground!: Phaser.GameObjects.Image;
  private bossBarFill!: Phaser.GameObjects.Image;
  private bossBarLabel!: Phaser.GameObjects.Text;
  private bossBarIcon!: Phaser.GameObjects.Image;
  /** Nome da fase por cima do mapa, à esquerda. */
  private levelChip!: Phaser.GameObjects.Image;
  private levelChipText!: Phaser.GameObjects.Text;
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
  private debugFromQuery = false;

  constructor() {
    super("UIScene");
  }

  init(data: { debugFromQuery?: boolean; loadout?: GuardianId[] }): void {
    this.debugFromQuery = Boolean(data.debugFromQuery);
    this.loadout = data.loadout && data.loadout.length > 0 ? [...data.loadout] : [...DEFAULT_LOADOUT];
  }

  create(): void {
    UI_REGISTRY.clear();
    this.createTopHud();
    this.createOverlayStrip();
    this.createBottomHud();
    this.createTutorialHint();
    this.createDebugPanel();
    publishUiRegistry();

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

  // ── Barra de cima ────────────────────────────────────────────────────────────

  private createTopHud(): void {
    const { topCenterY, pods, brand } = HUD_LAYOUT;
    this.add.image(GAME_WIDTH / 2, HUD_TOP / 2, hudPanel(this, GAME_WIDTH, HUD_TOP, { ...SKIN.bar, edgeBottom: "#4fd8ff" }));

    // Marca: a onda do logotipo é o mesmo pictograma das pílulas, só que maior.
    this.add.image(brand.x + brand.width / 2, topCenterY, hudPanel(this, brand.width, brand.height, { ...SKIN.pod, radius: 14 }));
    this.add.image(brand.x + 136, topCenterY, hudIcon(this, "waves", 28, "#4fc3f0"));
    this.add
      .text(brand.x + 16, topCenterY, "GUARDIÕES\nDO RECIFE", {
        fontFamily: HUD_FONT.strong,
        fontSize: "15px",
        lineSpacing: -2,
        color: HUD_COLORS.text,
      })
      .setOrigin(0, 0.5);

    // Pílula das pérolas.
    this.pod(pods.pearls.x, pods.pearls.width, "pearl", 22);
    this.pearlText = this.podValue(pods.pearls.x + 44, "150", HUD_COLORS.pearl);

    // Pílula da vida do Recife: onda, "RECIFE", alfinete e contagem.
    this.pod(pods.reef.x, pods.reef.width, "waves", 22);
    this.podCaption(pods.reef.x + 40, "RECIFE");
    this.add.image(pods.reef.x + 112, topCenterY, hudIcon(this, "pin", 18, HUD_COLORS.cyan));
    this.healthText = this.podValue(pods.reef.x + 124, "20/20", HUD_COLORS.text);

    // Pílula da onda.
    this.pod(pods.wave.x, pods.wave.width, "waves", 22);
    this.podCaption(pods.wave.x + 40, "ONDA");
    this.waveText = this.podValue(pods.wave.x + 88, "1/5", HUD_COLORS.text);

    // Pílula do relógio.
    this.pod(pods.timer.x, pods.timer.width, "hourglass", 20);
    this.timerText = this.podValue(pods.timer.x + 42, "EM 10s", HUD_COLORS.cyanBright, 15);

    this.messageText = this.add
      .text(HUD_LAYOUT.messageX, topCenterY, "", {
        fontFamily: HUD_FONT.body,
        fontSize: "11px",
        fontStyle: "bold",
        color: HUD_COLORS.text,
        align: "center",
        wordWrap: { width: HUD_LAYOUT.messageWidth },
        maxLines: 3,
      })
      .setOrigin(0.5);

    this.createTopButtons();
  }

  /** Fundo de uma pílula de estado, com o pictograma encostado à esquerda. */
  private pod(x: number, width: number, icon: HudIconName, iconSize: number): void {
    const { topCenterY, podHeight } = HUD_LAYOUT;
    this.add.image(x + width / 2, topCenterY, hudPanel(this, width, podHeight, SKIN.pod));
    this.add.image(x + 20, topCenterY, hudIcon(this, icon, iconSize, HUD_COLORS.cyan));
  }

  /** Palavra pequena dentro da pílula ("RECIFE", "ONDA"): explica o número que vem depois. */
  private podCaption(x: number, text: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, HUD_LAYOUT.topCenterY + 1, text, {
        fontFamily: HUD_FONT.body,
        fontSize: "12px",
        fontStyle: "bold",
        color: HUD_COLORS.textSoft,
        letterSpacing: 1,
      })
      .setOrigin(0, 0.5);
  }

  private podValue(x: number, text: string, color: string, size = 17): Phaser.GameObjects.Text {
    return this.add
      .text(x, HUD_LAYOUT.topCenterY, text, {
        fontFamily: HUD_FONT.strong,
        fontSize: `${size}px`,
        color,
      })
      .setOrigin(0, 0.5);
  }

  private createTopButtons(): void {
    const { topButtonY, speedButtonWidth, topButtonHeight, topButtonSize } = HUD_LAYOUT;
    this.speedButtons = ([1, 2] as const).map((speed, index) => ({
      speed,
      control: this.glassControl({
        x: HUD_LAYOUT.speedButtonXs[index],
        y: topButtonY,
        width: speedButtonWidth,
        height: topButtonHeight,
        text: `${speed}×`,
        fontSize: 15,
        strong: true,
        name: `speed:${speed}`,
        onClick: () => EventBus.emit(Events.setSpeed, speed),
      }),
    }));

    this.pauseButton = this.glassControl({
      x: HUD_LAYOUT.pauseButtonX,
      y: topButtonY,
      width: topButtonSize,
      height: topButtonHeight,
      icon: "pause",
      iconSize: 20,
      iconCentered: true,
      name: "pause",
      onClick: () => EventBus.emit(Events.togglePause),
    });

    this.glassControl({
      x: HUD_LAYOUT.fullscreenButtonX,
      y: topButtonY,
      width: topButtonSize,
      height: topButtonHeight,
      icon: "expand",
      iconSize: 20,
      iconCentered: true,
      name: "fullscreen",
      onClick: () => this.scale.toggleFullscreen(),
    });

    this.muteButton = this.glassControl({
      x: HUD_LAYOUT.muteButtonX,
      y: topButtonY,
      width: topButtonSize,
      height: topButtonHeight,
      icon: "sound",
      iconSize: 20,
      iconCentered: true,
      name: "mute",
      onClick: () => EventBus.emit(Events.toggleMute),
    });
  }

  // ── Faixa flutuante: fase, chefe e prévia da onda ────────────────────────────

  private createOverlayStrip(): void {
    const { levelChipX, levelChipY, levelChipHeight } = HUD_LAYOUT;
    this.levelChip = this.add.image(levelChipX - GLOW_PAD, levelChipY, hudPanel(this, 240, levelChipHeight, SKIN.pod)).setOrigin(0, 0.5);
    this.add.image(levelChipX + 16, levelChipY, hudIcon(this, "waves", 17, HUD_COLORS.cyan));
    this.levelChipText = this.add
      .text(levelChipX + 32, levelChipY, "", {
        fontFamily: HUD_FONT.strong,
        fontSize: "12px",
        color: HUD_COLORS.text,
        letterSpacing: 0.5,
      })
      .setOrigin(0, 0.5);

    this.createWavePreview();
    this.createBossBar();
  }

  /** Prévia da próxima onda: cabeçalho e uma linha por inimigo, com o retrato de cada um. */
  private createWavePreview(): void {
    const { wavePreviewRight, wavePreviewY, wavePreviewWidth } = HUD_LAYOUT;
    const left = wavePreviewRight - wavePreviewWidth;
    this.previewPanel = this.add.image(wavePreviewRight + GLOW_PAD, wavePreviewY - GLOW_PAD, hudPanel(this, wavePreviewWidth, 110, SKIN.panel)).setOrigin(1, 0);
    this.previewIcon = this.add.image(left + 20, wavePreviewY + 19, hudIcon(this, "waves", 18, HUD_COLORS.cyan));
    this.previewTitle = this.add
      .text(left + 36, wavePreviewY + 19, "PRÓXIMA SONDAGEM", {
        fontFamily: HUD_FONT.strong,
        fontSize: "11px",
        color: HUD_COLORS.cyanBright,
        letterSpacing: 0.6,
      })
      .setOrigin(0, 0.5);

    this.previewRows = Array.from({ length: PREVIEW_ROWS }, (_, index) => {
      const y = wavePreviewY + 42 + index * 24;
      return {
        icon: this.add.image(left + 26, y, hudIcon(this, "waves", 16, HUD_COLORS.cyan)).setVisible(false),
        dot: this.add.circle(left + 26, y, 5, 0x5fd8f7, 1).setVisible(false),
        name: this.add.text(left + 48, y, "", { fontFamily: HUD_FONT.body, fontSize: "11px", color: HUD_COLORS.textSoft }).setOrigin(0, 0.5),
        count: this.add.text(wavePreviewRight - 16, y, "", { fontFamily: HUD_FONT.strong, fontSize: "12px", color: HUD_COLORS.text }).setOrigin(1, 0.5),
      };
    });
    this.setPreviewVisible(false);
  }

  private setPreviewVisible(visible: boolean): void {
    this.previewPanel.setVisible(visible);
    this.previewIcon.setVisible(visible);
    this.previewTitle.setVisible(visible);
    if (visible) return;
    for (const row of this.previewRows) {
      row.icon.setVisible(false);
      row.dot.setVisible(false);
      row.name.setVisible(false);
      row.count.setVisible(false);
    }
  }

  /** Barra de vida do chefe: aparece só enquanto há um em campo. */
  private createBossBar(): void {
    const { bossBarX, bossBarY, bossBarWidth } = HUD_LAYOUT;
    this.bossBarBackground = this.add
      .image(
        bossBarX,
        bossBarY + 12,
        hudPanel(this, bossBarWidth, 16, {
          ...SKIN.panel,
          radius: 8,
          border: "#ff6f7e",
          borderTop: "#ffb0b8",
          glow: "rgba(255, 111, 126, 0.45)",
        }),
      )
      .setVisible(false);
    this.bossBarFill = this.add
      .image(bossBarX - bossBarWidth / 2 + 4, bossBarY + 12, hudBar(this, bossBarWidth - 8, 8, "#ff8f99", "#e0293d"))
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.bossBarIcon = this.add.image(bossBarX, bossBarY - 6, hudIcon(this, "skull", 16, "#ffd9dc")).setVisible(false);
    this.bossBarLabel = this.add
      .text(bossBarX + 8, bossBarY - 6, "", {
        fontFamily: HUD_FONT.strong,
        fontSize: "12px",
        color: "#ffd9dc",
        align: "center",
      })
      .setOrigin(0.5)
      .setVisible(false);
  }

  // ── Barra de baixo ───────────────────────────────────────────────────────────

  private createBottomHud(): void {
    const top = GAME_HEIGHT - HUD_BOTTOM;
    this.add.image(GAME_WIDTH / 2, top + HUD_BOTTOM / 2, hudPanel(this, GAME_WIDTH, HUD_BOTTOM, { ...SKIN.bar, edgeTop: "#4fd8ff" }));
    this.add.image(26, top + 11, hudIcon(this, "trident", 15, HUD_COLORS.cyan));
    this.add
      .text(40, top + 11, "GUARDIÕES", {
        fontFamily: HUD_FONT.strong,
        fontSize: "11px",
        color: HUD_COLORS.cyan,
        letterSpacing: 1.4,
      })
      .setOrigin(0, 0.5);

    this.createCards();
    this.createContextPanel();
    this.createCommands();
  }

  private createCards(): void {
    const { cardWidth, cardHeight, cardY, cardStep, cardStartX } = HUD_LAYOUT;
    const cardTop = cardY - 50;
    const centerY = cardTop + cardHeight / 2;
    this.cards = this.loadout.map((id, index) => {
      const definition = GUARDIANS[id];
      const x = cardStartX + index * cardStep;
      const tint = `#${definition.color.toString(16).padStart(6, "0")}`;
      const skins = {
        idle: hudPanel(this, cardWidth, cardHeight, { ...SKIN.panel, border: tint, borderTop: tint, glow: `${tint}55`, glowBlur: 9 }),
        selected: hudPanel(this, cardWidth, cardHeight, {
          ...SKIN.panel,
          fill: ["rgba(22, 100, 136, 0.95)", "rgba(8, 46, 72, 0.96)"],
          border: "#8af0ff",
          borderTop: "#d6fbff",
          glow: "rgba(130, 240, 255, 0.62)",
          glowBlur: 18,
          innerGlow: "rgba(120, 230, 255, 0.32)",
        }),
        poor: hudPanel(this, cardWidth, cardHeight, { ...SKIN.buttonOff, radius: 14 }),
      };
      const frame = this.add.image(x, centerY, skins.idle);
      frame.setInteractive({ hitArea: new Phaser.Geom.Rectangle(GLOW_PAD, GLOW_PAD, cardWidth, cardHeight), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
      UI_REGISTRY.register(`card:${id}`, x, centerY, cardWidth, cardHeight);
      // Apelido da primeira carta: o tutorial aponta para ela sem saber qual é o esquadrão.
      if (index === 0) UI_REGISTRY.register("card:first", x, centerY, cardWidth, cardHeight);
      frame.on("pointerdown", () => EventBus.emit(Events.selectGuardian, id));
      frame.on("pointerover", () => frame.setAlpha(0.86));
      frame.on("pointerout", () => frame.setAlpha(1));

      const name = this.add
        .text(x, cardTop + 13, definition.shortName, { fontFamily: HUD_FONT.strong, fontSize: "12px", color: HUD_COLORS.text })
        .setOrigin(0.5);
      const icon =
        this.artIcon(artTextureKey(id, GUARDIAN_ART[id].base, "idle"), x - 27, cardTop + 41, 42, 34) ??
        this.add.circle(x - 27, cardTop + 41, 14, definition.color, 1).setStrokeStyle(3, definition.accent, 1);
      icon.setData("guardian", id);
      const coin = this.add.image(x + 8, cardTop + 38, hudIcon(this, "pearl", 15, HUD_COLORS.pearl));
      const cost = this.add
        .text(x + 19, cardTop + 38, `${definition.cost}`, { fontFamily: HUD_FONT.strong, fontSize: "13px", color: HUD_COLORS.pearl })
        .setOrigin(0, 0.5);
      const role = this.add
        .text(x, cardTop + 72, definition.role, {
          fontFamily: HUD_FONT.body,
          fontSize: "9px",
          color: HUD_COLORS.textDim,
          align: "center",
          wordWrap: { width: cardWidth - 14 },
          maxLines: 2,
          lineSpacing: -1,
        })
        .setOrigin(0.5);
      return { id, frame, icon, name, cost, coin, role, skins };
    });
  }

  private createContextPanel(): void {
    const { panelX, panelWidth, panelY, panelHeight } = HUD_LAYOUT;
    this.add.image(panelX, panelY, hudPanel(this, panelWidth, panelHeight, SKIN.panel));
    const left = panelX - panelWidth / 2;
    const top = panelY - panelHeight / 2;
    const textLeft = left + 12 + PANEL_ICON_COLUMN;

    this.upgradeTitle = this.add
      .text(textLeft, top + 10, "Selecione um Guardião posicionado", { fontFamily: HUD_FONT.strong, fontSize: "13px", color: HUD_COLORS.text })
      .setOrigin(0, 0.5);
    this.upgradeLevel = this.add
      .text(textLeft, top + 11, "", { fontFamily: HUD_FONT.strong, fontSize: "11px", color: HUD_COLORS.cyan })
      .setOrigin(0, 0.5);

    // Três medidas do Guardião em foco, como no resto do jogo: dano, alcance e cadência.
    const cells: Array<[HudIconName, string, number]> = [
      ["blade", "Dano", textLeft],
      ["target", "Alcance", textLeft + 96],
      ["cadence", "Cadência", textLeft + 196],
    ];
    this.statCells = cells.map(([icon, caption, x]) => ({
      icon: this.add.image(x + 7, top + 30, hudIcon(this, icon, 14, HUD_COLORS.cyan)),
      label: this.add.text(x + 18, top + 30, caption, { fontFamily: HUD_FONT.body, fontSize: "10px", color: HUD_COLORS.textDim }).setOrigin(0, 0.5),
      value: this.add.text(x + 18, top + 30, "", { fontFamily: HUD_FONT.strong, fontSize: "12px", color: HUD_COLORS.text }).setOrigin(0, 0.5),
    }));

    this.upgradeDescription = this.add.text(textLeft, top + 38, "Toque em um Guardião no mapa para ver os ramos de upgrade e vender.", {
      fontFamily: HUD_FONT.body,
      fontSize: "9px",
      color: HUD_COLORS.textSoft,
      wordWrap: { width: panelWidth - PANEL_ICON_COLUMN - 32 },
      lineSpacing: -1,
      maxLines: 2,
    });

    this.createPanelButtons();
  }

  private createPanelButtons(): void {
    const { optionButtonXs, optionButtonY, optionButtonWidth, optionButtonHeight, sellButtonX } = HUD_LAYOUT;
    this.optionButtons = (["a", "b"] as BranchId[]).map((slot, index) => {
      const x = optionButtonXs[index];
      const control = this.glassControl({
        x,
        y: optionButtonY,
        width: optionButtonWidth,
        height: optionButtonHeight,
        text: "",
        fontSize: 10,
        strong: true,
        labelOffsetY: -8,
        name: `upgrade:${slot}`,
        onClick: () => {
          const option = this.optionButtons[index].option;
          // Ramo bloqueado ou completo: o clique vai à cena só para a mensagem explicativa.
          EventBus.emit(Events.upgradeGuardian, option?.branchId ?? slot);
        },
      });
      const coin = this.add.image(x - 14, optionButtonY + 9, hudIcon(this, "pearl", 13, HUD_COLORS.pearl));
      const cost = this.add
        .text(x - 4, optionButtonY + 9, "", { fontFamily: HUD_FONT.strong, fontSize: "11px", color: HUD_COLORS.pearl })
        .setOrigin(0, 0.5);
      control.add(coin, cost).setVisible(false);
      return { slot, control, coin, cost, option: null };
    });

    this.sellButton = this.glassControl({
      x: sellButtonX,
      y: optionButtonY,
      width: optionButtonWidth,
      height: optionButtonHeight,
      text: "VENDER",
      fontSize: 11,
      strong: true,
      labelOffsetY: -8,
      tone: "danger",
      name: "sell",
      onClick: () => EventBus.emit(Events.sellGuardian),
    });
    const sellCoin = this.add.image(sellButtonX - 14, optionButtonY + 9, hudIcon(this, "pearl", 13, HUD_COLORS.pearl));
    this.sellValue = this.add
      .text(sellButtonX - 4, optionButtonY + 9, "", { fontFamily: HUD_FONT.strong, fontSize: "11px", color: HUD_COLORS.pearl })
      .setOrigin(0, 0.5);
    this.sellButton.add(sellCoin, this.sellValue).setVisible(false);
  }

  private createCommands(): void {
    const { skipButtonX, skipButtonY, skipButtonWidth, commandButtonHeight, restartButtonX, restartButtonY } = HUD_LAYOUT;
    this.levelLabel = this.add
      .text(HUD_LAYOUT.commandLabelX, HUD_LAYOUT.commandLabelY, "RECIFE 1", {
        fontFamily: HUD_FONT.strong,
        fontSize: "10px",
        color: HUD_COLORS.cyan,
        letterSpacing: 0.6,
      })
      .setOrigin(0.5);

    this.skipButton = this.glassControl({
      x: skipButtonX,
      y: skipButtonY,
      width: skipButtonWidth,
      height: commandButtonHeight,
      text: "PRÓXIMA ONDA",
      fontSize: 10,
      strong: true,
      icon: "forward",
      iconSize: 14,
      tone: "primary",
      labelOffsetX: 12,
      maxLabelWidth: skipButtonWidth - 32,
      name: "nextWave",
      onClick: () => EventBus.emit(Events.startNextWave),
    });
    this.skipBonus = this.add
      .text(skipButtonX + 12, skipButtonY + 14, "", { fontFamily: HUD_FONT.strong, fontSize: "9px", color: HUD_COLORS.pearl })
      .setOrigin(0.5);
    this.skipButton.add(this.skipBonus);

    this.glassControl({
      x: restartButtonX,
      y: restartButtonY,
      width: skipButtonWidth,
      height: commandButtonHeight,
      text: "REINICIAR",
      fontSize: 10,
      strong: true,
      icon: "refresh",
      iconSize: 14,
      labelOffsetX: 12,
      maxLabelWidth: skipButtonWidth - 32,
      name: "restart",
      onClick: () => EventBus.emit(Events.restart),
    });

    this.glassControl({
      x: HUD_LAYOUT.menuButtonX,
      y: HUD_LAYOUT.menuButtonY,
      width: HUD_LAYOUT.menuButtonWidth,
      height: HUD_LAYOUT.menuButtonHeight,
      text: "FASES",
      fontSize: 14,
      strong: true,
      icon: "map",
      iconSize: 20,
      tone: "primary",
      labelOffsetX: 12,
      maxLabelWidth: HUD_LAYOUT.menuButtonWidth - 46,
      name: "levels",
      onClick: () => EventBus.emit(Events.openLevelSelect),
    });
  }

  // ── Tutorial ─────────────────────────────────────────────────────────────────

  /**
   * Dica do tutorial: uma faixa acima do HUD de baixo, sem modal e sem travar nada. Só o botão
   * PULAR recebe toque; o resto do jogo continua respondendo normalmente (item 30).
   */
  private createTutorialHint(): void {
    const y = GAME_HEIGHT - HUD_BOTTOM - 34;
    this.tutorialFocus = this.add.graphics();
    this.tutorialBox = this.add
      .image(
        TUTORIAL_HINT.x,
        y,
        hudPanel(this, TUTORIAL_HINT.width, 46, {
          ...SKIN.panel,
          border: "#ffd86a",
          borderTop: "#fff0b8",
          glow: "rgba(255, 216, 106, 0.45)",
          glowBlur: 14,
        }),
      )
      .setVisible(false);
    this.tutorialText = this.add
      .text(TUTORIAL_HINT.x - TUTORIAL_HINT.width / 2 + 16, y, "", {
        fontFamily: HUD_FONT.body,
        fontSize: "12px",
        color: HUD_COLORS.text,
        wordWrap: { width: TUTORIAL_HINT.width - 120 },
      })
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.tutorialSkip = this.glassControl({
      x: TUTORIAL_HINT.skipX,
      y,
      width: 72,
      height: 28,
      text: "PULAR",
      fontSize: 11,
      strong: true,
      name: "tutorial:skip",
      onClick: () => EventBus.emit(Events.skipTutorial),
    });
    this.tutorialSkip.setVisible(false);
  }

  private renderTutorial(snapshot: HudSnapshot): void {
    const hint = snapshot.tutorial;
    const visible = Boolean(hint) && !snapshot.gameOver;
    this.tutorialBox.setVisible(visible);
    this.tutorialText.setVisible(visible);
    this.tutorialSkip.setVisible(visible);
    this.tutorialFocus.clear();
    if (!hint || !visible) return;
    this.tutorialText.setText(`${hint.step}/${hint.total} · ${hint.text}`);
    // Contorno no controle citado pela dica; o registro sabe onde cada botão está.
    const target = hint.highlight ? UI_REGISTRY.get(hint.highlight) : undefined;
    if (!target) return;
    this.tutorialFocus.lineStyle(3, 0xffd86a, 0.95);
    this.tutorialFocus.strokeRoundedRect(target.x - target.width / 2 - 4, target.y - target.height / 2 - 4, target.width + 8, target.height + 8, 10);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  private renderSnapshot(snapshot: HudSnapshot): void {
    const { topButtonSize, topButtonHeight } = HUD_LAYOUT;
    this.pearlText.setText(`${snapshot.pearls}`);
    this.healthText.setText(`${snapshot.reefHealth}/${snapshot.maxReefHealth}`);
    this.healthText.setColor(snapshot.reefHealth <= 6 ? HUD_COLORS.danger : HUD_COLORS.text);
    this.waveText.setText(`${snapshot.wave}/${snapshot.totalWaves}`);
    this.timerText.setText(
      snapshot.waveState === "countdown" ? `EM ${snapshot.countdownSeconds}s` : snapshot.waveState === "victory" ? "CONCLUÍDO" : "EM CURSO",
    );
    this.messageText.setText(snapshot.message);
    this.pauseButton.icon?.setTexture(hudIcon(this, snapshot.paused ? "play" : "pause", 20, HUD_COLORS.text));
    this.pauseButton.skin(hudPanel(this, topButtonSize, topButtonHeight, snapshot.paused ? SKIN.buttonOn : SKIN.button));
    this.muteButton.icon?.setTexture(hudIcon(this, snapshot.muted ? "muted" : "sound", 20, snapshot.muted ? HUD_COLORS.textDim : HUD_COLORS.text));
    this.muteButton.skin(hudPanel(this, topButtonSize, topButtonHeight, snapshot.muted ? SKIN.buttonOff : SKIN.button));

    const canCall = snapshot.canSkipCountdown && !snapshot.gameOver;
    this.skipButton.setVisible(canCall);
    const bonus = snapshot.earlyCallBonus > 0;
    this.skipBonus.setText(bonus ? `+ ${snapshot.earlyCallBonus} ◉` : "").setVisible(canCall && bonus);
    this.skipButton.label.setY(HUD_LAYOUT.skipButtonY + (bonus ? -5 : 0));

    this.renderSpeed(snapshot);
    this.renderWavePreview(snapshot);
    this.renderBossBar(snapshot);
    this.renderTutorial(snapshot);
    this.renderLevelLabels(snapshot);

    this.cards.forEach((card) => {
      const selected = snapshot.selectedGuardianId === card.id;
      const affordable = snapshot.pearls >= GUARDIANS[card.id].cost;
      card.frame.setTexture(selected ? card.skins.selected : affordable ? card.skins.idle : card.skins.poor);
      card.icon.setAlpha(affordable ? 1 : 0.5);
      card.name.setAlpha(affordable ? 1 : 0.6);
      card.role.setAlpha(affordable ? 1 : 0.6);
      card.coin.setAlpha(affordable ? 1 : 0.7);
      card.cost.setColor(affordable ? HUD_COLORS.pearl : HUD_COLORS.danger);
    });

    this.renderUpgradePanel(snapshot);
    this.renderDebugState(snapshot.debug);
  }

  /** Nome da fase nos dois lugares: a plaquinha por cima do mapa e o rótulo dos comandos. */
  private renderLevelLabels(snapshot: HudSnapshot): void {
    const name = snapshot.levelName.toUpperCase();
    this.levelLabel.setText(snapshot.levelIndex < 0 ? `ENCONTRO · ${name}` : `FASE ${snapshot.levelIndex + 1}/${snapshot.levelCount} · ${name}`);

    const chip = snapshot.levelIndex < 0 ? `ENCONTRO · ${name}` : `RECIFE ${snapshot.levelIndex + 1} · ${name}`;
    if (this.levelChipText.text === chip) return;
    this.levelChipText.setText(chip);
    const width = Math.ceil(32 + this.levelChipText.width + 16 - HUD_LAYOUT.levelChipX);
    this.levelChip.setTexture(hudPanel(this, width, HUD_LAYOUT.levelChipHeight, SKIN.pod));
  }

  /** Os botões 1×/2× acendem conforme a velocidade; pausado, nenhum fica aceso. */
  private renderSpeed(snapshot: HudSnapshot): void {
    const over = snapshot.gameOver !== null;
    const { speedButtonWidth, topButtonHeight } = HUD_LAYOUT;
    this.speedButtons.forEach(({ speed, control }) => {
      const active = !snapshot.paused && snapshot.speed === speed;
      control.setVisible(!over);
      control.skin(hudPanel(this, speedButtonWidth, topButtonHeight, active ? SKIN.buttonOn : SKIN.button));
      control.label.setColor(active ? HUD_COLORS.cyanBright : HUD_COLORS.textSoft);
    });
  }

  private renderWavePreview(snapshot: HudSnapshot): void {
    const preview = snapshot.nextWave;
    if (!preview || snapshot.gameOver) {
      this.setPreviewVisible(false);
      return;
    }
    const chips = preview.chips.slice(0, PREVIEW_ROWS);
    const { wavePreviewWidth } = HUD_LAYOUT;
    const boss = preview.isBossWave;
    this.previewPanel.setTexture(
      hudPanel(this, wavePreviewWidth, 32 + chips.length * 24, {
        ...SKIN.panel,
        border: boss ? "#ff6f7e" : SKIN.panel.border,
        borderTop: boss ? "#ffb0b8" : SKIN.panel.borderTop,
        glow: boss ? "rgba(255, 111, 126, 0.4)" : SKIN.panel.glow,
      }),
    );
    this.setPreviewVisible(true);
    this.previewTitle.setColor(boss ? "#ffd9dc" : HUD_COLORS.cyanBright);

    this.previewRows.forEach((row, index) => {
      const chip = chips[index];
      if (!chip) {
        row.icon.setVisible(false);
        row.dot.setVisible(false);
        row.name.setVisible(false);
        row.count.setVisible(false);
        return;
      }
      row.name.setVisible(true).setText(chip.name);
      row.name.setColor(chip.isBoss ? "#ffd9dc" : chip.isElite ? HUD_COLORS.warn : HUD_COLORS.textSoft);
      row.count.setVisible(true).setText(`×${chip.count}`);
      row.count.setColor(chip.isBoss ? "#ffd9dc" : HUD_COLORS.text);

      // O retrato só existe depois que a `GameScene` carregou a arte da fase; até lá, um ponto.
      const art = resolveEnemy(ENEMIES[chip.enemyId]).art;
      const key = art.kind === "sprite" ? enemyFrameKey(art.folder, 1) : null;
      if (key && this.textures.exists(key)) {
        this.fitSprite(row.icon, key, row.dot.x, row.dot.y, 28, 20);
        row.icon.setVisible(true);
        row.dot.setVisible(false);
      } else {
        row.icon.setVisible(false);
        row.dot.setVisible(true).setFillStyle(chip.isBoss ? 0xff6f7e : chip.isElite ? 0xffc95f : 0x5fd8f7, 1);
      }
    });
  }

  private renderBossBar(snapshot: HudSnapshot): void {
    const boss = snapshot.boss;
    const visible = boss !== null && !snapshot.gameOver;
    this.bossBarBackground.setVisible(visible);
    this.bossBarLabel.setVisible(visible);
    this.bossBarIcon.setVisible(visible);
    if (!boss) {
      this.bossBarFill.setVisible(false);
      return;
    }
    const phase = boss.phaseCount > 1 ? ` · fase ${boss.phaseIndex + 1}/${boss.phaseCount}` : "";
    this.bossBarLabel.setText(`${boss.title.toUpperCase()}${phase}`);
    this.bossBarIcon.setX(this.bossBarLabel.x - this.bossBarLabel.width / 2 - 12);
    const ratio = Math.max(0, Math.min(1, boss.healthRatio));
    const width = HUD_LAYOUT.bossBarWidth - 8;
    this.bossBarFill.setCrop(0, 0, width * ratio, 8);
    this.bossBarFill.setVisible(visible && ratio > 0);
  }

  private renderUpgradePanel(snapshot: HudSnapshot): void {
    const selected = snapshot.selectedPlacedGuardian;
    this.renderPanelIcon(selected?.guardianId ?? snapshot.selectedGuardianId, selected?.artVariant ?? "base");
    if (!selected) {
      this.renderBriefing(snapshot);
      this.optionButtons.forEach((button) => {
        button.option = null;
        button.control.setVisible(false);
      });
      this.sellButton.setVisible(false);
      return;
    }

    this.upgradeTitle.setText(selected.name);
    this.upgradeTitle.setColor(selected.branchColor !== null ? `#${selected.branchColor.toString(16).padStart(6, "0")}` : HUD_COLORS.text);
    this.upgradeLevel
      .setText(`Nível ${selected.upgradeLevel}/${selected.maxUpgradeLevel}${selected.branchName ? ` · ${selected.branchName}` : ""}`)
      .setColor(HUD_COLORS.cyan)
      .setX(this.upgradeTitle.x + this.upgradeTitle.width + 10)
      .setVisible(true);
    this.renderStats(selected.damage, selected.range, selected.cooldownMs, GUARDIANS[selected.guardianId].placementMode === "route");

    if (selected.options.length === 0) {
      this.upgradeDescription.setText(`Ramo ${selected.branchName ?? ""} completo. Investido: ◉ ${selected.invested}.`);
    } else if (selected.options.length === 1) {
      const option = selected.options[0];
      const locked = selected.branches.find((branch) => branch.state === "locked");
      this.upgradeDescription.setText(`${option.name}: ${option.description}${locked ? `  (${locked.name} bloqueado nesta unidade)` : ""}`);
    } else {
      // Antes da escolha, os dois botões já mostram os ramos; aqui vai o resumo curto de cada um.
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
    const { optionButtonWidth, optionButtonHeight, optionButtonY } = HUD_LAYOUT;
    this.optionButtons.forEach((button) => {
      const status = selected.branches.find((branch) => branch.id === button.slot);
      const option = selected.options.find((candidate) => candidate.branchId === button.slot) ?? null;
      button.option = option;
      button.control.setVisible(true);
      if (!status) return;
      if (option) {
        const affordable = snapshot.pearls >= option.cost;
        const tint = `#${option.branchColor.toString(16).padStart(6, "0")}`;
        button.control.label.setText(`${option.branchName.toUpperCase()} ${"I".repeat(option.level)}`);
        button.control.label.setColor(HUD_COLORS.text);
        this.fitLabel(button.control.label, optionButtonWidth - 14, 10);
        button.control.skin(
          hudPanel(this, optionButtonWidth, optionButtonHeight, {
            ...(affordable ? SKIN.button : SKIN.buttonOff),
            border: tint,
            borderTop: affordable ? "#d6fbff" : tint,
            glow: affordable ? `${tint}66` : "rgba(0, 0, 0, 0)",
            glowBlur: affordable ? 12 : 0,
          }),
        );
        button.coin.setVisible(true);
        button.cost.setVisible(true).setText(`${option.cost}`).setColor(affordable ? HUD_COLORS.pearl : HUD_COLORS.danger);
      } else if (status.state === "locked") {
        button.control.label.setText(`${status.name.toUpperCase()}\nbloqueado`);
        button.control.label.setColor(HUD_COLORS.textDim);
        this.fitLabel(button.control.label, optionButtonWidth - 14, 10);
        button.control.skin(hudPanel(this, optionButtonWidth, optionButtonHeight, SKIN.buttonOff));
        button.coin.setVisible(false);
        button.cost.setVisible(false);
      } else {
        button.control.label.setText(`${status.name.toUpperCase()}\ncompleto`);
        button.control.label.setColor(HUD_COLORS.success);
        this.fitLabel(button.control.label, optionButtonWidth - 14, 10);
        button.control.skin(
          hudPanel(this, optionButtonWidth, optionButtonHeight, {
            ...SKIN.button,
            fill: ["rgba(16, 82, 66, 0.92)", "rgba(6, 36, 30, 0.95)"],
            border: "#4fd6a2",
            borderTop: "#9df3cd",
            glow: "rgba(79, 214, 162, 0.35)",
          }),
        );
        button.coin.setVisible(false);
        button.cost.setVisible(false);
      }
      // Rótulo de duas linhas (bloqueado/completo) fica no centro; o de uma linha sobe para dar lugar ao custo.
      button.control.label.setY(optionButtonY + (option ? -8 : 0));
    });

    this.sellButton.setVisible(true);
    this.sellValue.setText(`${selected.sellValue}`);
  }

  /** As três medidas do painel, cada valor encostado no fim do seu rótulo. */
  private renderStats(damage: number, range: number, cooldownMs: number, melee: boolean): void {
    const values = [damage > 0 ? `${Math.round(damage)}` : "—", melee ? "corpo a corpo" : `${Math.round(range)}`, `${(cooldownMs / 1000).toFixed(1)}s`];
    this.statCells.forEach((cell, index) => {
      cell.icon.setVisible(true);
      cell.label.setVisible(true);
      cell.value.setVisible(true).setText(values[index]).setX(cell.label.x + cell.label.width + 6);
    });
  }

  private hideStats(): void {
    this.statCells.forEach((cell) => {
      cell.icon.setVisible(false);
      cell.label.setVisible(false);
      cell.value.setVisible(false);
    });
  }

  /**
   * Painel sem unidade selecionada. Com uma carta escolhida, vira a ficha dela: medidas, papel e
   * para onde vão as duas evoluções (item 32). Sem carta, a instrução de uso.
   */
  private renderBriefing(snapshot: HudSnapshot): void {
    const guardianId = snapshot.selectedGuardianId;
    if (!guardianId) {
      this.upgradeTitle.setText("Selecione um Guardião posicionado");
      this.upgradeTitle.setColor(HUD_COLORS.text);
      this.upgradeLevel.setVisible(false);
      this.hideStats();
      this.upgradeDescription.setText("Toque em um Guardião no mapa para ver os ramos de upgrade e vender.");
      return;
    }
    const definition = GUARDIANS[guardianId];
    const affordable = snapshot.pearls >= definition.cost;
    this.upgradeTitle.setText(definition.name);
    this.upgradeTitle.setColor(affordable ? HUD_COLORS.text : "#ffc2c7");
    this.upgradeLevel
      .setText(`◉ ${definition.cost}${affordable ? "" : " · faltam pérolas"}`)
      .setColor(affordable ? HUD_COLORS.pearl : HUD_COLORS.danger)
      .setX(this.upgradeTitle.x + this.upgradeTitle.width + 10)
      .setVisible(true);
    this.renderStats(definition.damage, definition.range, definition.cooldownMs, definition.placementMode === "route");
    this.upgradeDescription.setText(
      `${definition.role} · posicione em ${PLACEMENT_HINTS[definition.placementMode]}.\n` +
        definition.branches.map((branch) => `${branch.name.toUpperCase()}: ${branch.tagline}`).join("  "),
    );
  }

  /**
   * Retrato da unidade em foco, na coluna esquerda do painel. Fica dentro do HUD de baixo: nada de
   * retrato flutuante por cima do mapa, que escondia plataformas e inimigos (item 32).
   */
  private renderPanelIcon(guardianId: GuardianId | null, variant: string): void {
    const key = guardianId ? artTextureKeyForFolder(guardianId, variant, "idle") : null;
    if (!key || !this.textures.exists(key)) {
      this.panelIcon?.setVisible(false);
      return;
    }
    const centerX = HUD_LAYOUT.panelX - HUD_LAYOUT.panelWidth / 2 + 12 + PANEL_ICON_COLUMN / 2;
    const centerY = HUD_LAYOUT.panelY - 4;
    if (!this.panelIcon) this.panelIcon = this.add.image(0, 0, key).setOrigin(0.5);
    this.fitSprite(this.panelIcon, key, centerX, centerY, PANEL_ICON_COLUMN - 6, HUD_LAYOUT.panelHeight - 44);
    this.panelIcon.setAlpha(0.97).setVisible(true);
  }

  // ── Peças reaproveitadas ─────────────────────────────────────────────────────

  /**
   * Encolhe o rótulo até ele caber na largura pedida. Nome de ramo longo ("Dano Concentrado")
   * vazava para fora do botão e entrava no vizinho; meio ponto de corpo por vez resolve sem
   * quebrar linha, que aqui não tem altura sobrando.
   */
  private fitLabel(label: Phaser.GameObjects.Text, maxWidth: number, maxSize: number): void {
    let size = maxSize;
    label.setFontSize(size);
    while (label.width > maxWidth && size > 7) {
      size -= 0.5;
      label.setFontSize(size);
    }
  }

  /**
   * Encaixa a arte de uma unidade numa caixa: `solidBounds` acha os pixels visíveis e o recorte
   * mantém o quadro inteiro, então o deslocamento centraliza só a parte que aparece.
   */
  private fitSprite(image: Phaser.GameObjects.Image, key: string, centerX: number, centerY: number, boxWidth: number, boxHeight: number): void {
    fitImageToBox(this, image, key, centerX, centerY, boxWidth, boxHeight);
  }

  /** Ícone da carta: a arte `idle` da base recortada aos pixels visíveis e ajustada à caixa pedida. */
  private artIcon(key: string, centerX: number, centerY: number, boxWidth: number, boxHeight: number): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(key) || !solidBounds(this, key)) return null;
    const image = this.add.image(0, 0, key).setOrigin(0.5);
    this.fitSprite(image, key, centerX, centerY, boxWidth, boxHeight);
    return image;
  }

  /**
   * Um botão de vidro: painel pintado em canvas, rótulo opcional e pictograma opcional. O ícone
   * ancora na esquerda e o texto desloca para a direita, então trocar o rótulo não bagunça o arranjo.
   */
  private glassControl(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    icon?: HudIconName;
    iconSize?: number;
    /** Botão só de pictograma: ele fica no meio, sem abrir espaço para rótulo. */
    iconCentered?: boolean;
    fontSize?: number;
    strong?: boolean;
    /** Largura máxima do rótulo: passa disso e o corpo da fonte encolhe até caber. */
    maxLabelWidth?: number;
    tone?: "default" | "primary" | "danger";
    labelOffsetX?: number;
    labelOffsetY?: number;
    name?: string;
    onClick: () => void;
  }): HudControl {
    const { x, y, width, height, onClick } = options;
    if (options.name) UI_REGISTRY.register(options.name, x, y, width, height);
    const style = options.tone === "primary" ? SKIN.primary : options.tone === "danger" ? SKIN.danger : SKIN.button;
    const image = this.add.image(x, y, hudPanel(this, width, height, style));
    image.setInteractive({ hitArea: new Phaser.Geom.Rectangle(GLOW_PAD, GLOW_PAD, width, height), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    image.on("pointerdown", onClick);
    image.on("pointerover", () => image.setAlpha(0.82));
    image.on("pointerout", () => image.setAlpha(1));

    const icon = options.icon
      ? this.add.image(options.iconCentered ? x : x - width / 2 + 18, y, hudIcon(this, options.icon, options.iconSize ?? 18, HUD_COLORS.text))
      : null;
    const label = this.add
      .text(x + (options.labelOffsetX ?? 0), y + (options.labelOffsetY ?? 0), options.text ?? "", {
        fontFamily: options.strong ? HUD_FONT.strong : HUD_FONT.body,
        fontSize: `${options.fontSize ?? 12}px`,
        color: HUD_COLORS.text,
        align: "center",
        lineSpacing: -1,
      })
      .setOrigin(0.5);
    if (options.maxLabelWidth) this.fitLabel(label, options.maxLabelWidth, options.fontSize ?? 12);
    return new HudControl(image, label, icon);
  }

  // ── Painel de desenvolvimento ────────────────────────────────────────────────

  private createDebugPanel(): void {
    this.debugToggle = this.button(HUD_LAYOUT.debugButtonX, HUD_LAYOUT.debugButtonY, 84, 28, "DEBUG F2", () => EventBus.emit(Events.toggleDebug));
    this.debugToggleText = this.debugToggle.getData("label") as Phaser.GameObjects.Text;
    this.debugToggle.setVisible(this.debugFromQuery);
    this.debugToggleText.setVisible(this.debugFromQuery);

    this.debugPanel = this.add.rectangle(1120, 268, 282, 356, 0x001723, 0.94).setStrokeStyle(2, 0xff4df3, 0.8).setVisible(false);
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

  /** Botão simples de retângulo: só o painel de desenvolvimento ainda usa. */
  private button(x: number, y: number, width: number, height: number, text: string, onClick: () => void): Phaser.GameObjects.Rectangle {
    const background = this.add.rectangle(x, y, width, height, 0x103e50, 1).setStrokeStyle(2, 0x348ba0, 0.75).setInteractive({ useHandCursor: true });
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
}
