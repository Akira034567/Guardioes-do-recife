import type { LevelObjectiveDefinition, ObjectiveKind } from "../../types";
import type { MatchResult } from "./MatchResult";

/**
 * Objetivos secundários (item 21). Cada tipo é um predicado puro sobre o resultado da partida, então
 * uma fase nova só precisa declarar três objetivos em dados. O primeiro é sempre "complete a fase".
 */
export const OBJECTIVE_PREDICATES: Record<ObjectiveKind, (result: MatchResult, value: number) => boolean> = {
  complete: (result) => result.victory,
  minLivesRemaining: (result, value) => result.victory && result.livesRemaining >= value,
  noLeaks: (result) => result.victory && result.stats.enemiesLeaked === 0,
  noEliteLeaks: (result) => result.victory && result.stats.eliteLeaks === 0 && result.stats.bossLeaks === 0,
  maxGuardians: (result, value) => result.victory && result.stats.maxSimultaneousGuardians <= value,
  maxDistinctGuardians: (result, value) => result.victory && result.stats.distinctGuardiansUsed.length <= value,
  underTimeMs: (result, value) => result.victory && result.stats.timeMs <= value,
  noFinalEvolution: (result) => result.victory && result.stats.maxUpgradeLevel < 2,
  noSell: (result) => result.victory && result.stats.guardiansSold === 0,
  noEarlyCall: (result) => result.victory && result.stats.earlyWaveCalls === 0,
};

/** Um objetivo cumprido por partida, na ordem em que a fase os declara. */
export function evaluateObjectives(definitions: readonly LevelObjectiveDefinition[], result: MatchResult): boolean[] {
  return definitions.map((definition) => OBJECTIVE_PREDICATES[definition.kind](result, definition.value ?? 0));
}

/**
 * Como um objetivo está indo durante a partida, para o HUD: `failed` quando já não há como cumprir,
 * `ok` quando a condição vale agora e `pending` enquanto depende do fim.
 */
export function objectiveProgress(definition: LevelObjectiveDefinition, result: MatchResult): "ok" | "failed" | "pending" {
  const value = definition.value ?? 0;
  switch (definition.kind) {
    case "complete":
      return result.victory ? "ok" : "pending";
    case "minLivesRemaining":
      return result.livesRemaining < value ? "failed" : "pending";
    case "noLeaks":
      return result.stats.enemiesLeaked > 0 ? "failed" : "pending";
    case "noEliteLeaks":
      return result.stats.eliteLeaks + result.stats.bossLeaks > 0 ? "failed" : "pending";
    case "maxGuardians":
      return result.stats.maxSimultaneousGuardians > value ? "failed" : "pending";
    case "maxDistinctGuardians":
      return result.stats.distinctGuardiansUsed.length > value ? "failed" : "pending";
    case "underTimeMs":
      return result.stats.timeMs > value ? "failed" : "pending";
    case "noFinalEvolution":
      return result.stats.maxUpgradeLevel >= 2 ? "failed" : "pending";
    case "noSell":
      return result.stats.guardiansSold > 0 ? "failed" : "pending";
    case "noEarlyCall":
      return result.stats.earlyWaveCalls > 0 ? "failed" : "pending";
  }
}

/** Texto pronto para a tela de preparação e para a de vitória. */
export function objectiveLabel(definition: LevelObjectiveDefinition): string {
  const value = definition.value ?? 0;
  switch (definition.kind) {
    case "complete":
      return "Proteja o Recife até o fim";
    case "minLivesRemaining":
      return `Termine com pelo menos ${value} vidas`;
    case "noLeaks":
      return "Não deixe nenhum inimigo passar";
    case "noEliteLeaks":
      return "Não deixe nenhum elite ou chefe passar";
    case "maxGuardians":
      return `Use no máximo ${value} Guardiões em campo`;
    case "maxDistinctGuardians":
      return `Use no máximo ${value} espécies de Guardião`;
    case "underTimeMs":
      return `Termine em menos de ${Math.round(value / 60000)} minutos`;
    case "noFinalEvolution":
      return "Vença sem nenhuma evolução final";
    case "noSell":
      return "Vença sem vender nenhum Guardião";
    case "noEarlyCall":
      return "Nunca chame a próxima onda antes da hora";
  }
}
