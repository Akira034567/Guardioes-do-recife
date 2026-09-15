import { PROGRESS_STORAGE_KEY, type LevelProgressApi } from "../LevelProgress";
import { LevelProgressAdapter } from "./LevelProgressAdapter";
import { migrate } from "./migrations";
import { createDefaultProgress, SAVE_VERSION, sanitizeProgress, type PlayerProgress, type SanitizeRegistry } from "./PlayerProgress";

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface SaveManagerOptions {
  key?: string;
  /** Save pré-versionamento a adotar quando `key` estiver vazia; `null` = não adotar nada. */
  legacyKey?: string | null;
  now?: () => Date;
  registry: SanitizeRegistry;
}

export interface SaveStatus {
  source: "storage" | "memory";
  migratedFrom: number | null;
  corrupted: boolean;
}

export const SAVE_KEY = "guardioes-do-recife.save";

/**
 * Único dono do documento persistente. Carrega, migra e sanitiza na criação; toda escrita passa por
 * `update(draft => …)`, que sanitiza, grava e notifica. Sem storage (modo privado, testes) funciona
 * em memória e nunca lança.
 */
export class SaveManager {
  private document: PlayerProgress;
  private readonly key: string;
  private readonly legacyKey: string | null;
  private readonly now: () => Date;
  private readonly registry: SanitizeRegistry;
  private readonly listeners = new Set<(progress: Readonly<PlayerProgress>) => void>();
  readonly status: SaveStatus;

  constructor(
    private readonly storage: SaveStorage | null,
    options: SaveManagerOptions,
  ) {
    this.key = options.key ?? SAVE_KEY;
    this.legacyKey = options.legacyKey === undefined ? PROGRESS_STORAGE_KEY : options.legacyKey;
    this.now = options.now ?? (() => new Date());
    this.registry = options.registry;
    this.status = { source: storage ? "storage" : "memory", migratedFrom: null, corrupted: false };
    this.document = this.load();
  }

  get progress(): Readonly<PlayerProgress> {
    return this.document;
  }

  /** Muta um rascunho, sanitiza, grava e avisa os ouvintes. */
  update(mutate: (draft: PlayerProgress) => void): void {
    const draft = structuredClone(this.document);
    mutate(draft);
    draft.updatedAt = this.now().toISOString();
    this.document = sanitizeProgress(draft, this.registry, this.now());
    this.document.updatedAt = draft.updatedAt;
    this.persist();
    this.listeners.forEach((listener) => listener(this.document));
  }

  reset(): void {
    this.document = createDefaultProgress(this.registry, this.now());
    this.persist();
    this.listeners.forEach((listener) => listener(this.document));
  }

  onChange(listener: (progress: Readonly<PlayerProgress>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Visão compatível com a `LevelProgress` antiga (fases concluídas e desbloqueio linear). */
  levelProgress(): LevelProgressApi {
    return new LevelProgressAdapter(this, this.registry.levelIds);
  }

  // ----------------------------------------------------------------- interno

  private load(): PlayerProgress {
    const now = this.now();
    if (!this.storage) return createDefaultProgress(this.registry, now);
    const raw = this.read(this.key);
    if (raw !== null) {
      const parsed = this.parse(raw, this.key);
      if (!parsed) return createDefaultProgress(this.registry, now);
      const version = typeof parsed.saveVersion === "number" ? parsed.saveVersion : 1;
      const migrated = version < SAVE_VERSION ? migrate(parsed, version, SAVE_VERSION, this.registry) : parsed;
      if (version < SAVE_VERSION) this.status.migratedFrom = version;
      return sanitizeProgress(migrated, this.registry, now);
    }
    if (this.legacyKey !== null) {
      const legacy = this.read(this.legacyKey);
      const parsed = legacy === null ? null : this.parse(legacy, this.legacyKey);
      if (parsed) {
        this.status.migratedFrom = 1;
        const document = sanitizeProgress(migrate({ ...parsed, saveVersion: 1 }, 1, SAVE_VERSION, this.registry), this.registry, now);
        this.document = document;
        this.persist();
        return document;
      }
    }
    return createDefaultProgress(this.registry, now);
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private parse(raw: string, key: string): Record<string, unknown> | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // cai no tratamento de corrompido abaixo
    }
    this.status.corrupted = true;
    try {
      this.storage?.setItem(`${key}.corrupt`, raw);
    } catch {
      // sem espaço ou sem storage: segue em memória
    }
    return null;
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(this.document));
    } catch {
      // Sem armazenamento disponível (modo privado, cota): o jogo segue em memória.
    }
  }
}
