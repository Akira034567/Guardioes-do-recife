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

/**
 * v2 → v3: nasce o hub "Meu Recife". O Recife entra vazio de propósito; `reconcileReef` planta na
 * primeira visita, então o layout sai do mesmo lugar para quem migrou e para quem começou agora.
 */
function fromV2(document: Record<string, unknown>): Record<string, unknown> {
  return {
    ...document,
    saveVersion: 3,
    reef: { owned: [], placed: [], nextInstanceId: 1, granted: [], lastSeenStage: 0, residents: [], servedSlots: [] },
    migratedFrom: 2,
  };
}

/**
 * v3 → v4: a dificuldade deixa de ser escolha livre e passa a ser conquistada (item 4).
 *
 * A migração é CONSERVADORA por decisão de produto: ninguém herda nada. Saves antigos nunca
 * registraram em qual dificuldade cada fase caiu — `best.difficulty` guarda a dificuldade da última
 * partida MELHOR, não a mais alta, então inferir dali daria um resultado errado com cara de certo.
 * Todo mundo recomeça com o Normal aberto e reconquista Difícil e Abissal.
 */
function fromV3(document: Record<string, unknown>): Record<string, unknown> {
  const levelStars = isRecord(document.levelStars) ? document.levelStars : {};
  const migrated: Record<string, unknown> = {};
  for (const [levelId, record] of Object.entries(levelStars)) {
    migrated[levelId] = isRecord(record) ? { ...record, clearedDifficulties: [] } : record;
  }
  return { ...document, saveVersion: 4, levelStars: migrated, migratedFrom: 3 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * v4 → v5: nasce a maestria permanente por Guardião (V3).
 *
 * Ninguém herda nós: a moeda já gasta em outras coisas não vira maestria retroativa, e o jogador
 * começa a árvore do zero com as Conchas que tiver em caixa. `sanitizeProgress` completa o resto.
 */
function fromV4(document: Record<string, unknown>): Record<string, unknown> {
  return { ...document, saveVersion: 5, mastery: {}, migratedFrom: 4 };
}

export const MIGRATIONS: Record<number, Migration> = {
  1: fromV1,
  2: fromV2,
  3: fromV3,
  4: fromV4,
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
