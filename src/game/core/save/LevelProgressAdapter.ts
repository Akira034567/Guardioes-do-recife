import type { LevelProgressApi } from "../LevelProgress";
import type { SaveManager } from "./SaveManager";

/**
 * Mantém a API da `LevelProgress` original em cima do `SaveManager`, para que menu e partida não
 * mudem enquanto a progressão nova (estrelas, desbloqueios) é construída.
 */
export class LevelProgressAdapter implements LevelProgressApi {
  constructor(
    private readonly save: SaveManager,
    private readonly levelIds: readonly string[],
  ) {}

  get completed(): readonly string[] {
    const done = new Set(this.save.progress.completedLevels);
    return this.levelIds.filter((id) => done.has(id));
  }

  isCompleted(levelId: string): boolean {
    return this.save.progress.completedLevels.includes(levelId);
  }

  isUnlocked(levelId: string): boolean {
    const index = this.levelIds.indexOf(levelId);
    if (index < 0) return false;
    if (index === 0) return true;
    return this.isCompleted(this.levelIds[index - 1]);
  }

  complete(levelId: string): string | null {
    const index = this.levelIds.indexOf(levelId);
    if (index < 0) return null;
    this.save.update((draft) => {
      if (!draft.completedLevels.includes(levelId)) draft.completedLevels.push(levelId);
      const record = draft.levelStars[levelId] ?? { stars: 0, objectives: [], completions: 0, best: null, clearedDifficulties: [] };
      record.completions += 1;
      if (record.stars < 1) {
        record.stars = 1;
        record.objectives = [true, ...record.objectives.slice(1)];
      }
      draft.levelStars[levelId] = record;
    });
    return index < this.levelIds.length - 1 ? this.levelIds[index + 1] : null;
  }

  reset(): void {
    this.save.reset();
  }
}
