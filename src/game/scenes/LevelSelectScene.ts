import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import type { LevelProgressApi } from "../core/LevelProgress";
import { difficultyOf } from "../data/difficulty";
import { LEVELS, LEVEL_IDS } from "../data/levels";
import { ENEMIES } from "../data/enemies";
import { GLOBAL_CURRENCY } from "../data/progression";
import { launchConfigFor } from "../match/MatchLaunchConfig";
import { createLevelProgress } from "../systems/ProgressStore";
import { getProgression } from "../systems/progression";
import { getScreenHost } from "../ui/dom/host";
import { preparationScreen } from "../ui/dom/screens/PreparationScreen";
import type { EnemyId, GuardianId, LevelDefinition } from "../types";

/** Menu de fases: mostra progressão e inicia a fase escolhida. */
export class LevelSelectScene extends Phaser.Scene {
  private progress!: LevelProgressApi;
  private prepareLevelId: string | null = null;

  constructor() {
    super("LevelSelectScene");
  }

  init(data: { prepareLevelId?: string } = {}): void {
    this.prepareLevelId = data.prepareLevelId ?? null;
  }

  create(): void {
    this.progress = createLevelProgress();
    const progression = getProgression();
    // Um save antigo (ou uma fase concluída fora daqui) pode ter deixado desbloqueios pendentes.
    progression.reconcile();
    getScreenHost(this.game).clear();
    this.cameras.main.setBackgroundColor("#052f49");
    this.game.canvas.dataset.screen = "menu";
    this.game.canvas.dataset.gameState = "menu";
    this.game.canvas.dataset.unlockedLevels = String(LEVEL_IDS.filter((id) => this.progress.isUnlocked(id)).length);

    this.add
      .text(GAME_WIDTH / 2, 64, "GUARDIÕES DO RECIFE", {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: "38px",
        color: "#e8fbff",
        letterSpacing: 3,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 110, "Escolha uma fase. Concluir uma fase libera a seguinte.", {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        color: "#75dff4",
      })
      .setOrigin(0.5);

    // Seis cartas precisam caber em 1280px; a largura encolhe com o número de fases.
    const gap = 16;
    const cardWidth = Math.min(224, Math.floor((GAME_WIDTH - 48 - (LEVELS.length - 1) * gap) / LEVELS.length));
    const totalWidth = LEVELS.length * cardWidth + (LEVELS.length - 1) * gap;
    const startX = (GAME_WIDTH - totalWidth) / 2 + cardWidth / 2;
    LEVELS.forEach((level, index) => this.createCard(level, index, startX + index * (cardWidth + gap), 360, cardWidth));

    // Conchas do jogador, no canto de cima (a moeda global vive fora da partida).
    this.add
      .text(GAME_WIDTH - 26, 26, `${GLOBAL_CURRENCY.symbol} ${progression.progress.currency.shells} ${GLOBAL_CURRENCY.name}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffe69a",
      })
      .setOrigin(1, 0);
    this.game.canvas.dataset.shells = String(progression.progress.currency.shells);
    this.game.canvas.dataset.stars = String(Object.values(progression.progress.levelStars).reduce((total, record) => total + record.stars, 0));

    if (this.prepareLevelId) {
      const level = LEVELS.find((candidate) => candidate.id === this.prepareLevelId);
      this.prepareLevelId = null;
      if (level) this.openPreparation(level);
    }

    const resetButton = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 56, 200, 40, 0x103e50, 1)
      .setStrokeStyle(2, 0x348ba0, 0.75)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 56, "LIMPAR PROGRESSO", {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#e9fbff",
      })
      .setOrigin(0.5);
    resetButton.on("pointerdown", () => {
      this.progress.reset();
      this.scene.restart();
    });
  }

  /** Abre a preparação da fase: informações, dificuldade e escolha do esquadrão. */
  private openPreparation(level: LevelDefinition): void {
    const progression = getProgression();
    const host = getScreenHost(this.game);
    const saved = progression.progress;
    host.replace(
      preparationScreen(
        level,
        LEVELS.indexOf(level),
        progression,
        {
          onBack: () => host.clear(),
          onStart: (difficulty, loadout) => {
            host.clear();
            this.scene.start("GameScene", launchConfigFor(level, difficulty, loadout));
          },
        },
        {
          difficulty: difficultyOf(saved.lastDifficulty).id,
          loadout: (saved.lastLoadout.length > 0 ? saved.lastLoadout : saved.unlockedGuardians) as GuardianId[],
        },
      ),
    );
  }

  private createCard(level: LevelDefinition, index: number, x: number, y: number, width: number): void {
    const unlocked = this.progress.isUnlocked(level.id);
    const completed = this.progress.isCompleted(level.id);
    const height = 300;
    const background = this.add
      .rectangle(x, y, width, height, unlocked ? 0x0a3c53 : 0x07242f, 1)
      .setStrokeStyle(3, completed ? 0x8dffd0 : unlocked ? 0xffe580 : 0x2c4a57, unlocked ? 1 : 0.7);

    this.add.rectangle(x, y - 90, width - 24, 96, level.theme.water, unlocked ? 1 : 0.45).setStrokeStyle(2, level.theme.path, 0.6);
    const preview = this.add.graphics();
    preview.lineStyle(6, level.theme.path, unlocked ? 0.9 : 0.4);
    preview.beginPath();
    const scaleX = (width - 40) / GAME_WIDTH;
    const scaleY = 80 / GAME_HEIGHT;
    level.waypoints.forEach((point, pointIndex) => {
      const px = x - (width - 40) / 2 + Math.max(0, Math.min(GAME_WIDTH, point.x)) * scaleX;
      const py = y - 90 - 40 + Math.max(60, Math.min(GAME_HEIGHT - 60, point.y)) * scaleY;
      if (pointIndex === 0) preview.moveTo(px, py);
      else preview.lineTo(px, py);
    });
    preview.strokePath();

    // Cartas estreitas (seis fases) usam nome menor para caber em uma linha.
    const nameSize = width >= 210 ? "17px" : "14px";
    this.add
      .text(x, y - 34, `FASE ${index + 1}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#72cfe5",
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    this.add
      .text(x, y - 10, level.name, {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: nameSize,
        color: unlocked ? "#f3fbff" : "#7d98a3",
        align: "center",
        wordWrap: { width: width - 28 },
      })
      .setOrigin(0.5);
    this.add
      .text(x, y + 34, level.subtitle, {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        color: unlocked ? "#a7e4f0" : "#5f7a84",
        align: "center",
        wordWrap: { width: width - 28 },
      })
      .setOrigin(0.5);

    const enemyIds = [...new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))] as EnemyId[];
    this.add
      .text(x, y + 72, `${level.waves.length} ondas · ${enemyIds.map((id) => ENEMIES[id].name).join(", ")}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        color: unlocked ? "#8dcbd8" : "#4f6a74",
        align: "center",
        wordWrap: { width: width - 28 },
      })
      .setOrigin(0.5);

    const status = completed ? "CONCLUÍDA · JOGAR DE NOVO" : unlocked ? "JOGAR" : "BLOQUEADA";
    const button = this.add
      .rectangle(x, y + 118, width - 40, 40, unlocked ? 0x13728a : 0x0f2a34, 1)
      .setStrokeStyle(2, unlocked ? 0x67f2ac : 0x2c4a57, 0.9);
    this.add
      .text(x, y + 118, status, {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: unlocked ? "#e9fbff" : "#5f7a84",
      })
      .setOrigin(0.5);

    // Estrelas conquistadas ficam embaixo do nome da fase.
    const stars = getProgression().record(level.id)?.stars ?? 0;
    this.add
      .text(x, y + 96, "★★★".slice(0, stars).padEnd(3, "☆"), {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        color: stars > 0 ? "#ffe69a" : "#3f5f6b",
      })
      .setOrigin(0.5);

    if (!unlocked) return;
    [background, button].forEach((target) => {
      target.setInteractive({ useHandCursor: true });
      target.on("pointerdown", () => this.openPreparation(level));
      target.on("pointerover", () => background.setFillStyle(0x17617a, 1));
      target.on("pointerout", () => background.setFillStyle(0x0a3c53, 1));
    });
  }
}
