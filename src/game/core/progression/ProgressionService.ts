import type { GuardianUnlockDefinition } from "../../data/unlocks";
import type { GuardianId, LevelObjectiveDefinition } from "../../types";
import type { SaveManager } from "../save/SaveManager";
import type { LevelRecord, PlayerProgress, Stars } from "../save/PlayerProgress";
import type { AchievementDefinition } from "../../data/achievements";
import { achievementShells, applyAchievements } from "./achievements";
import { countsForProgression, type MatchResult } from "./MatchResult";
import { evaluateObjectives } from "./objectives";
import { highestUnlockedDifficulty } from "./difficultyUnlocks";
import type { DifficultyId } from "../../data/difficulty";
import { computeLevelRewards, encounterRewards, type RewardBreakdown } from "./rewards";
import { mergeLevelRecord, type LevelMerge } from "./stars";
import { masteryLevelOf } from "./mastery";
import { MASTERY_ORDER, masteryNextCost } from "../../data/mastery";
import { purchaseUnlock, reconcileUnlocks, unlockStatus, type PurchaseResult, type UnlockStatus } from "./unlocks";

export interface ObjectiveOutcome {
  definition: LevelObjectiveDefinition;
  achieved: boolean;
  /** Cumprido pela primeira vez nesta partida. */
  isNew: boolean;
}

export interface MatchOutcome {
  levelId: string;
  victory: boolean;
  /** Encontro concluído nesta partida, quando foi um. */
  encounterId: string | null;
  stars: Stars;
  starsBefore: Stars;
  objectives: ObjectiveOutcome[];
  rewards: RewardBreakdown;
  /** Guardiões que acabaram de entrar na coleção, para a apresentação. */
  unlocked: GuardianId[];
  /** Conquistas obtidas nesta partida (item 37). */
  achievements: AchievementDefinition[];
  /** Desafio cumprido agora (item 38). */
  challengeCompleted: string | null;
  /** Fase seguinte liberada, quando houver. */
  nextLevelId: string | null;
  /**
   * Dificuldade que esta vitória acabou de abrir (item 4). Sem este aviso o jogador não teria como
   * descobrir que terminar a campanha no Normal liberou o Difícil.
   */
  difficultyUnlocked: DifficultyId | null;
  /** Falso quando a partida usou comandos de debug: nada é salvo além da descoberta de inimigos. */
  counted: boolean;
}

export interface ProgressionContext {
  levelIds: readonly string[];
  unlocks: readonly GuardianUnlockDefinition[];
}

/**
 * Ponte entre o fim de uma partida e a progressão permanente (itens 21, 22, 3 e 37). Recebe o
 * resultado, calcula objetivos, estrelas, Conchas e desbloqueios, e grava tudo de uma vez no save.
 */
export class ProgressionService {
  constructor(
    private readonly save: SaveManager,
    private readonly context: ProgressionContext,
  ) {}

  get progress(): Readonly<PlayerProgress> {
    return this.save.progress;
  }

  record(levelId: string): LevelRecord | undefined {
    return this.save.progress.levelStars[levelId];
  }

  /** Aplica o resultado de uma partida e devolve o que a tela de vitória precisa mostrar. */
  applyMatchResult(result: MatchResult, objectiveDefinitions: readonly LevelObjectiveDefinition[]): MatchOutcome {
    const isEncounter = result.kind === "encounter";
    const achieved = evaluateObjectives(objectiveDefinitions, result);
    const before = this.save.progress.levelStars[result.levelId];
    const merge = mergeLevelRecord(before, result, achieved);
    const counted = countsForProgression(result);
    // Encontro não vale estrela: paga uma recompensa própria e entrega o Guardião.
    const rewards = !counted || !result.victory ? { shells: 0, lines: [] } : isEncounter ? encounterRewards(this.save.progress, result) : computeLevelRewards(merge, result.difficulty);
    const unlocked: GuardianId[] = [];
    const achievements: AchievementDefinition[] = [];
    // Desafio: a partida só conta se cumpriu a regra extra e não usou ferramentas de debug.
    const challenge = result.challenge;
    const challengeDone =
      Boolean(challenge) && counted && result.victory && evaluateObjectives([challenge!.objective], result)[0] === true;
    let challengeCompleted: string | null = null;

    // Lido antes e depois do `update` para saber o que ESTA vitória abriu.
    const unlockedBefore = highestUnlockedDifficulty(this.save.progress, this.context.levelIds);

    this.save.update((draft) => {
      // Descobrir um inimigo vale para o bestiário mesmo em partida de teste.
      this.recordDiscovery(draft, result);
      if (!counted) return;
      this.recordTotals(draft, result);
      // Segredos achados no mapa valem mesmo sem vencer: o jogador esteve lá e viu.
      for (const secretId of result.stats.secretsFound) {
        if (!draft.discoveredSecrets.includes(secretId)) draft.discoveredSecrets.push(secretId);
      }
      if (!result.loadoutOverride) draft.lastLoadout = [...result.loadout];
      draft.lastDifficulty = result.difficulty;

      if (result.victory) {
        if (isEncounter) {
          const encounterId = result.encounterId ?? result.levelId;
          if (!draft.completedEncounters.includes(encounterId)) draft.completedEncounters.push(encounterId);
        } else {
          draft.levelStars[result.levelId] = merge.next;
          if (!draft.completedLevels.includes(result.levelId)) draft.completedLevels.push(result.levelId);
        }
        draft.currency.shells += rewards.shells;
        draft.currency.lifetimeShells += rewards.shells;
        unlocked.push(...reconcileUnlocks(this.context.unlocks, draft));
        draft.pendingUnlockReveals.push(...unlocked.filter((guardianId) => !draft.pendingUnlockReveals.includes(guardianId)));
      }

      if (challenge && challengeDone && !draft.challenges.completed.includes(challenge.id)) {
        draft.challenges.completed.push(challenge.id);
        draft.challenges.lastSeenRotation = challenge.id;
        draft.currency.shells += challenge.shells;
        draft.currency.lifetimeShells += challenge.shells;
        challengeCompleted = challenge.id;
      }

      // As conquistas medem o save já atualizado, então entram por último — e contam na derrota também
      // (tempo de jogo, abates, segredos achados antes de o Recife cair).
      achievements.push(...applyAchievements(draft, result));
      const bonus = achievementShells(achievements);
      draft.currency.shells += bonus;
      draft.currency.lifetimeShells += bonus;
    });
    if (challengeCompleted && challenge) {
      rewards.lines.push({ label: "Desafio cumprido", shells: challenge.shells });
      rewards.shells += challenge.shells;
    }
    if (achievements.length > 0) {
      rewards.lines.push(...achievements.map((definition) => ({ label: `Conquista: ${definition.name}`, shells: definition.shells })));
      rewards.shells += achievementShells(achievements);
    }

    const unlockedAfter = highestUnlockedDifficulty(this.save.progress, this.context.levelIds);

    return {
      levelId: result.levelId,
      victory: result.victory,
      encounterId: isEncounter && result.victory ? (result.encounterId ?? result.levelId) : null,
      stars: isEncounter ? 0 : merge.next.stars,
      starsBefore: isEncounter ? 0 : (before?.stars ?? 0),
      objectives: (isEncounter ? [] : objectiveDefinitions).map((definition, index) => ({
        definition,
        achieved: merge.next.objectives[index] ?? false,
        isNew: merge.newObjectives[index] ?? false,
      })),
      rewards,
      unlocked,
      achievements,
      challengeCompleted,
      nextLevelId: result.victory && !isEncounter ? this.nextLevelId(result.levelId) : null,
      difficultyUnlocked: unlockedAfter !== unlockedBefore ? unlockedAfter : null,
      counted,
    };
  }

  /**
   * Desbloqueia o que as condições já permitem e recalcula as conquistas (abertura do menu, migração
   * de save antigo). Sem isso, um perfil que já fez o suficiente veria a lista zerada.
   */
  reconcile(): GuardianId[] {
    const unlocked: GuardianId[] = [];
    this.save.update((draft) => {
      unlocked.push(...reconcileUnlocks(this.context.unlocks, draft));
      draft.pendingUnlockReveals.push(...unlocked.filter((guardianId) => !draft.pendingUnlockReveals.includes(guardianId)));
      const gained = applyAchievements(draft);
      const bonus = achievementShells(gained);
      draft.currency.shells += bonus;
      draft.currency.lifetimeShells += bonus;
    });
    return unlocked;
  }

  /**
   * Guarda o esquadrão escolhido na preparação, na ORDEM escolhida (item 7), sem esperar o fim da
   * partida. Antes só `applyMatchResult` gravava, então sair da preparação perdia tanto a escolha
   * quanto a ordem das vagas.
   */
  /** Nível de maestria já comprado para um Guardião (0 a 5). */
  masteryLevel(guardianId: GuardianId): number {
    return masteryLevelOf(this.save.progress.mastery, guardianId);
  }

  /** Níveis de todos os Guardiões, prontos para entrar numa partida. */
  masteryLevels(): Partial<Record<GuardianId, number>> {
    const levels: Partial<Record<GuardianId, number>> = {};
    for (const guardianId of MASTERY_ORDER) {
      const level = this.masteryLevel(guardianId);
      if (level > 0) levels[guardianId] = level;
    }
    return levels;
  }

  /**
   * Compra o próximo nó de maestria. Devolve o motivo da recusa em vez de lançar: a tela precisa
   * saber a diferença entre "sem Conchas" e "árvore completa" para escrever a mensagem certa.
   */
  buyMastery(guardianId: GuardianId): { ok: true; level: number; spent: number } | { ok: false; reason: "maxed" | "insufficientShells" } {
    const level = this.masteryLevel(guardianId);
    const cost = masteryNextCost(level);
    if (cost === null) return { ok: false, reason: "maxed" };
    if (this.save.progress.currency.shells < cost) return { ok: false, reason: "insufficientShells" };
    this.save.update((draft) => {
      draft.currency.shells -= cost;
      draft.mastery[guardianId] = level + 1;
    });
    return { ok: true, level: level + 1, spent: cost };
  }

  rememberLoadout(loadout: readonly GuardianId[]): void {
    this.save.update((draft) => {
      draft.lastLoadout = [...loadout];
    });
  }

  /** Consome a fila de apresentações pendentes (a tela de desbloqueio mostra uma por vez). */
  takePendingReveals(): GuardianId[] {
    const pending = [...this.save.progress.pendingUnlockReveals] as GuardianId[];
    if (pending.length > 0) {
      this.save.update((draft) => {
        draft.pendingUnlockReveals.length = 0;
      });
    }
    return pending;
  }

  buy(guardianId: GuardianId): PurchaseResult {
    let outcome: PurchaseResult = { ok: false, reason: "notFound" };
    this.save.update((draft) => {
      outcome = purchaseUnlock(this.context.unlocks, draft, guardianId);
      if (outcome.ok && !draft.pendingUnlockReveals.includes(guardianId)) draft.pendingUnlockReveals.push(guardianId);
    });
    return outcome;
  }

  unlockStatuses(): UnlockStatus[] {
    return this.context.unlocks.map((definition) => unlockStatus(definition, this.save.progress));
  }

  isUnlocked(guardianId: GuardianId): boolean {
    return this.save.progress.unlockedGuardians.includes(guardianId);
  }

  nextLevelId(levelId: string): string | null {
    const index = this.context.levelIds.indexOf(levelId);
    if (index < 0 || index >= this.context.levelIds.length - 1) return null;
    return this.context.levelIds[index + 1];
  }

  /** O `merge` cru, para telas que queiram detalhar o histórico. */
  preview(result: MatchResult, objectiveDefinitions: readonly LevelObjectiveDefinition[]): LevelMerge {
    return mergeLevelRecord(this.save.progress.levelStars[result.levelId], result, evaluateObjectives(objectiveDefinitions, result));
  }

  private recordDiscovery(draft: PlayerProgress, result: MatchResult): void {
    const seen = new Set([...Object.keys(result.stats.kills), ...Object.keys(result.stats.leaks)]);
    for (const enemyId of seen) {
      const kills = result.stats.kills[enemyId as keyof typeof result.stats.kills] ?? 0;
      const entry = draft.enemyDiscovery[enemyId];
      if (entry) entry.kills += kills;
      else draft.enemyDiscovery[enemyId] = { firstSeenLevelId: result.levelId, seenAt: draft.updatedAt, kills };
    }
  }

  private recordTotals(draft: PlayerProgress, result: MatchResult): void {
    draft.totals.matches += 1;
    draft.totals.victories += result.victory ? 1 : 0;
    draft.totals.defeats += result.victory ? 0 : 1;
    draft.totals.kills += result.stats.enemiesKilled;
    draft.totals.playTimeMs += result.stats.timeMs;
    draft.totals.wavesCleared += result.stats.wavesCompleted;
    for (const guardianId of result.stats.distinctGuardiansUsed) {
      const career = draft.guardianStats[guardianId] ?? { matches: 0, kills: 0, damage: 0, placements: 0, upgrades: 0 };
      career.matches += 1;
      career.kills += result.stats.killsByGuardianType[guardianId] ?? 0;
      career.damage += Math.round(result.stats.damageByGuardianType[guardianId] ?? 0);
      career.placements += result.stats.placementsByGuardian[guardianId] ?? 0;
      draft.guardianStats[guardianId] = career;
    }
    // Os upgrades não são atribuídos por espécie no motor; ficam no total do perfil.
    const anyGuardian = result.stats.distinctGuardiansUsed[0];
    if (anyGuardian && draft.guardianStats[anyGuardian]) draft.guardianStats[anyGuardian].upgrades += result.stats.upgradesBought;
  }
}
