export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROGRESS_STORAGE_KEY = "guardioes-do-recife.progress.v1";

/** O que menu e partida precisam da progressão de fases (implementado pela classe abaixo e pelo `SaveManager`). */
export interface LevelProgressApi {
  readonly completed: readonly string[];
  isCompleted(levelId: string): boolean;
  isUnlocked(levelId: string): boolean;
  /** Marca a fase como concluída e devolve a próxima fase liberada, se houver. */
  complete(levelId: string): string | null;
  reset(): void;
}

interface StoredProgress {
  completed: string[];
}

/**
 * Progressão linear entre fases: a primeira está sempre liberada e concluir a
 * fase N libera a fase N+1. O armazenamento é injetável (localStorage no jogo,
 * memória nos testes).
 */
export class LevelProgress implements LevelProgressApi {
  private readonly completedIds = new Set<string>();

  constructor(
    private readonly levelIds: readonly string[],
    private readonly storage: ProgressStorage | null = null,
  ) {
    if (levelIds.length === 0) throw new Error("At least one level is required.");
    this.load();
  }

  get completed(): readonly string[] {
    return this.levelIds.filter((id) => this.completedIds.has(id));
  }

  isCompleted(levelId: string): boolean {
    return this.completedIds.has(levelId);
  }

  isUnlocked(levelId: string): boolean {
    const index = this.levelIds.indexOf(levelId);
    if (index < 0) return false;
    if (index === 0) return true;
    return this.completedIds.has(this.levelIds[index - 1]);
  }

  /** Marca a fase como concluída e devolve a próxima fase liberada, se houver. */
  complete(levelId: string): string | null {
    const index = this.levelIds.indexOf(levelId);
    if (index < 0) return null;
    this.completedIds.add(levelId);
    this.save();
    return index < this.levelIds.length - 1 ? this.levelIds[index + 1] : null;
  }

  reset(): void {
    this.completedIds.clear();
    this.save();
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(PROGRESS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredProgress>;
      (parsed.completed ?? []).forEach((id) => {
        if (this.levelIds.includes(id)) this.completedIds.add(id);
      });
    } catch {
      // Progresso corrompido: começa do zero sem quebrar o jogo.
    }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      const payload: StoredProgress = { completed: this.completed.slice() };
      this.storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Sem armazenamento disponível (modo privado, etc.).
    }
  }
}
