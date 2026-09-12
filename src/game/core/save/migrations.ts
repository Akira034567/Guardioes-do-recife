import { REWARDS } from "../../data/progression";
import type { SanitizeRegistry } from "./PlayerProgress";

/**
 * Migrações do save: cada função leva o documento da versão N para N+1. `sanitizeProgress` roda depois,
 * então basta produzir os campos que mudam de forma. Nunca apague a chave antiga: ela fica como
 * segurança para voltar a uma versão anterior do jogo.
 */
export type Migration = (document: Record<string, unknown>, registry: SanitizeRegistry) => Record<string, unknown>;

/** v1: `{ completed: string[] }` na chave `guardioes-do-recife.progress.v1`. */
function fromV1(document: Record<string, unknown>, registry: SanitizeRegistry): Record<string, unknown> {
  const completed = Array.isArray(document.completed)
    ? document.completed.filter((id): id is string => typeof id === "string" && registry.levelIds.includes(id))
    : [];
  const levelStars: Record<string, unknown> = {};
  for (const levelId of completed) levelStars[levelId] = { stars: 1, objectives: [true, false, false], completions: 1, best: null };
  // Recompensa retroativa e justa: cada fase já concluída vale a primeira conclusão.
  const shells = completed.length * REWARDS.firstCompletion;
  return {
    ...document,
    saveVersion: 2,
    completedLevels: completed,
    levelStars,
    currency: { shells, lifetimeShells: shells },
    migratedFrom: 1,
  };
}

export const MIGRATIONS: Record<number, Migration> = {
  1: fromV1,
};

/** Aplica as migrações em cadeia a partir de `fromVersion` até a versão alvo. */
export function migrate(
  document: Record<string, unknown>,
  fromVersion: number,
  toVersion: number,
  registry: SanitizeRegistry,
): Record<string, unknown> {
  let current = document;
  for (let version = fromVersion; version < toVersion; version += 1) {
    const step = MIGRATIONS[version];
    if (!step) break;
    current = step(current, registry);
  }
  return current;
}
