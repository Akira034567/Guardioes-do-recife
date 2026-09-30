import Phaser from "phaser";
import { preloadEnemyArt } from "../assets/enemyArt";
import { preloadGoldenArt } from "../assets/goldenArt";
import { preloadGuardianUpgradeArt } from "../assets/guardianArt";
import { preloadLevelBackground } from "../assets/levelBackgrounds";
import { preloadStatusArt } from "../assets/statusArt";
import { DEFAULT_LOADOUT } from "../data/guardians";
import { LEVELS } from "../data/levels";
import { getProgression } from "../systems/progression";
import type { GuardianId, LevelDefinition } from "../types";

/** Espera depois de a primeira tela abrir: o hub e o mapa carregam primeiro, sem disputar a rede. */
const START_DELAY_MS = 1500;

/**
 * PRÉ-CARREGAMENTO EM SEGUNDO PLANO — para a fase abrir na hora, sem tela de "carregando".
 *
 * Cena invisível (sem nada na tela), lançada pela `BootScene` ao lado da primeira tela. Enquanto o
 * jogador está no hub, no mapa ou na preparação, ela busca a arte que as fases vão pedir: primeiro a
 * da PRÓXIMA fase do jogador (fundo e inimigos) e as evoluções do último esquadrão; depois o resto.
 * As texturas do Phaser são globais — quando a `GameScene` abre, o `preload` dela encontra tudo já
 * em cache e não baixa nada. Se o jogador for rápido e entrar antes, a fase só baixa o que faltar.
 *
 * Poucos downloads por vez: é trabalho de fundo, não pode deixar lenta a tela que está aberta.
 * Nos testes automatizados não roda (a rede do teste é da tela que o teste abriu).
 */
export class WarmupScene extends Phaser.Scene {
  constructor() {
    super({ key: "WarmupScene", active: false });
  }

  create(): void {
    if (navigator.webdriver) {
      this.scene.stop();
      return;
    }
    this.time.delayedCall(START_DELAY_MS, () => this.warm());
  }

  private warm(): void {
    const progress = getProgression().progress;
    const done = new Set(progress.completedLevels);
    // A fase mais provável de ser jogada agora: a primeira ainda não vencida.
    const next = LEVELS.find((level) => !done.has(level.id)) ?? LEVELS[0];
    const ordered: LevelDefinition[] = [next, ...LEVELS.filter((level) => level !== next)];
    const squad = (progress.lastLoadout.length > 0 ? progress.lastLoadout : DEFAULT_LOADOUT) as GuardianId[];

    const loader = this.load;
    loader.maxParallelDownloads = 4;
    // Falha de rede aqui não é erro de ninguém: a fase tenta de novo quando abrir.
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {});

    // A ordem é a da chance de ser pedido primeiro: a próxima fase (fundo e inimigos), o que toda
    // fase usa, as evoluções do último esquadrão — e só então o resto das fases e dos Guardiões.
    const warmLevel = (level: LevelDefinition): void => {
      preloadLevelBackground(this, level.backgroundKey);
      preloadEnemyArt(this, [...new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))]);
    };
    warmLevel(next);
    preloadStatusArt(this);
    preloadGoldenArt(this);
    preloadGuardianUpgradeArt(this, squad);
    ordered.slice(1).forEach(warmLevel);
    preloadGuardianUpgradeArt(this, progress.unlockedGuardians as GuardianId[]);

    if (loader.list.size === 0) {
      this.scene.stop();
      return;
    }
    loader.once(Phaser.Loader.Events.COMPLETE, () => this.scene.stop());
    loader.start();
  }
}
