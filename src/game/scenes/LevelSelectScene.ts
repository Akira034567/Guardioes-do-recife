import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import type { LevelProgressApi } from "../core/LevelProgress";
import { difficultyOf } from "../data/difficulty";
import { ENCOUNTERS, type EncounterDefinition } from "../data/encounters";
import type { ChallengeDefinition } from "../core/progression/challenges";
import { getLevel, LEVELS, LEVEL_IDS } from "../data/levels";
import { launchConfigFor } from "../match/MatchLaunchConfig";
import { createLevelProgress } from "../systems/ProgressStore";
import { getProgression } from "../systems/progression";
import { challengeRule } from "../core/progression/challenges";
import { pendingStory } from "../systems/story";
import { getScreenHost } from "../ui/dom/host";
import type { Screen } from "../ui/dom/ScreenHost";
import { achievementsScreen } from "../ui/dom/screens/AchievementsScreen";
import { bestiaryScreen } from "../ui/dom/screens/BestiaryScreen";
import { collectionScreen } from "../ui/dom/screens/CollectionScreen";
import { mapScreen } from "../ui/dom/screens/MapScreen";
import { preparationScreen } from "../ui/dom/screens/PreparationScreen";
import { settingsScreen } from "../ui/dom/screens/SettingsScreen";
import { storyIndexScreen, storyScreen } from "../ui/dom/screens/StoryScreen";
import type { ShellNav, ShellSection } from "../ui/dom/shell";
import type { GuardianId, LevelDefinition } from "../types";

/**
 * Mapa do Recife: o menu principal fora da partida. A cena desenha o fundo e hospeda o mapa em HTML
 * (`ui/dom/screens/MapScreen.ts`), onde ficam as fases, os Encontros e o acesso ao álbum, ao
 * bestiário, às histórias e às configurações.
 */
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
    const host = getScreenHost(this.game);
    host.clear();
    this.cameras.main.setBackgroundColor("#052f49");
    this.drawBackdrop();

    const dataset = this.game.canvas.dataset;
    dataset.screen = "menu";
    dataset.gameState = "menu";
    dataset.unlockedLevels = String(LEVEL_IDS.filter((id) => this.progress.isUnlocked(id)).length);
    dataset.shells = String(progression.progress.currency.shells);
    dataset.stars = String(Object.values(progression.progress.levelStars).reduce((total, record) => total + record.stars, 0));
    dataset.encounters = String(progression.progress.completedEncounters.length);

    host.push(
      mapScreen(progression, (levelId) => this.progress.isUnlocked(levelId), {
        onPlayLevel: (level) => this.openPreparation(level),
        onPlayEncounter: (encounter) => this.openPreparation(encounter.level, encounter),
        onPlayChallenge: (challenge) => this.openChallenge(challenge),
        onOpenAchievements: () => this.openSection("achievements"),
        onOpenCollection: () => this.openSection("collection"),
        onOpenBestiary: () => this.openSection("bestiary"),
        onOpenStories: () => this.openSection("stories"),
        onOpenSettings: () => this.openSection("settings"),
        onResetProgress: () => {
          this.progress.reset();
          this.scene.restart();
        },
      }),
    );

    if (this.prepareLevelId) {
      const level = LEVELS.find((candidate) => candidate.id === this.prepareLevelId);
      this.prepareLevelId = null;
      if (level) this.openPreparation(level);
    }
  }

  /**
   * Abre uma seção do menu por cima do mapa. A pilha nunca passa de duas telas: trocar de seção pelo
   * menu lateral volta ao mapa e abre a nova, em vez de empilhar mais uma.
   */
  private openSection(section: ShellSection): void {
    const host = getScreenHost(this.game);
    while (host.isOpen && host.topId !== "map") host.pop();
    if (section === "map") return;
    const progression = getProgression();
    const back = (): void => this.openSection("map");
    const nav: ShellNav = {
      onGoMap: () => this.openSection("map"),
      onOpenCollection: () => this.openSection("collection"),
      onOpenBestiary: () => this.openSection("bestiary"),
      onOpenStories: () => this.openSection("stories"),
      onOpenAchievements: () => this.openSection("achievements"),
      onOpenSettings: () => this.openSection("settings"),
    };
    const screens: Record<Exclude<ShellSection, "map">, () => Screen> = {
      collection: () => collectionScreen(progression, back, nav),
      bestiary: () => bestiaryScreen(progression, back, nav),
      stories: () => storyIndexScreen(back, nav, (levelId) => this.progress.isUnlocked(levelId)),
      achievements: () => achievementsScreen(progression, back, nav),
      settings: () => settingsScreen(back, nav),
    };
    host.push(screens[section]());
  }

  /**
   * Desafio do dia ou da semana: fase, dificuldade e esquadrão já vêm decididos pelo sorteio, então a
   * preparação entra travada — só resta aceitar ou voltar.
   */
  private openChallenge(challenge: ChallengeDefinition): void {
    const level = getLevel(challenge.levelId);
    if (!level) return;
    const host = getScreenHost(this.game);
    const progression = getProgression();
    host.push(
      preparationScreen(
        level,
        LEVELS.indexOf(level),
        progression,
        {
          onBack: () => host.pop(),
          onStart: (difficulty, loadout) => {
            host.clear();
            this.scene.start("GameScene", launchConfigFor(level, difficulty, loadout, { challengeId: challenge.id }));
          },
        },
        {
          difficulty: challenge.difficulty,
          loadout: [...challenge.loadout],
          locked: true,
          challenge: { name: challenge.name, rule: challengeRule(challenge), shells: challenge.shells },
        },
      ),
    );
  }

  /** Fundo do menu: faixas de água e o nome do jogo, atrás da camada HTML. */
  private drawBackdrop(): void {
    const water = this.add.graphics();
    water.fillGradientStyle(0x073d57, 0x073d57, 0x02202f, 0x02202f, 1);
    water.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let index = 0; index < 7; index += 1) {
      const y = 90 + index * 92;
      water.lineStyle(2, 0x1581a3, 0.12 + (index % 2) * 0.05);
      water.beginPath();
      water.moveTo(-20, y);
      for (let x = -20; x <= GAME_WIDTH + 20; x += 40) water.lineTo(x, y + Math.sin(x / 110 + index) * 14);
      water.strokePath();
    }
    this.add
      .text(GAME_WIDTH / 2, 30, "GUARDIÕES DO RECIFE", {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: "22px",
        color: "#1c6b86",
        letterSpacing: 4,
      })
      .setOrigin(0.5);
  }

  /**
   * Abre a preparação da fase, depois da história de abertura quando ela ainda não foi lida.
   * Encontros usam a mesma tela: o esquadrão e a dificuldade valem ali também.
   */
  private openPreparation(level: LevelDefinition, encounter?: EncounterDefinition): void {
    const intro = pendingStory({ type: "levelIntro", levelId: level.id });
    const host = getScreenHost(this.game);
    if (intro) {
      host.push(storyScreen(intro, () => {
        host.pop();
        this.openPreparation(level, encounter);
      }));
      return;
    }
    const progression = getProgression();
    const saved = progression.progress;
    host.push(
      preparationScreen(
        level,
        LEVELS.indexOf(level),
        progression,
        {
          onBack: () => host.pop(),
          onStart: (difficulty, loadout) => {
            host.clear();
            this.scene.start("GameScene", launchConfigFor(level, difficulty, loadout));
          },
        },
        {
          difficulty: difficultyOf(saved.lastDifficulty).id,
          loadout: (saved.lastLoadout.length > 0 ? saved.lastLoadout : saved.unlockedGuardians) as GuardianId[],
          encounter: encounter ? { guardianId: encounter.guardianId, teaser: encounter.teaser } : undefined,
        },
      ),
    );
  }
}

export { ENCOUNTERS };
