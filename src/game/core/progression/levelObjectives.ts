import type { DifficultyId } from "../../data/difficulty";
import type { LevelDefinition, LevelObjectiveDefinition } from "../../types";

/**
 * Qual trio de objetivos vale numa fase, em cada dificuldade.
 *
 * O Difícil e o Abissal não são "a mesma missão com inimigos mais fortes": eles pedem OUTRA coisa.
 * A fase declara o trio próprio em `objectivesByDifficulty`; quem não declara joga pelo trio do
 * Normal, e um id de dificuldade desconhecido também cai nele.
 *
 * Esta é a única porta: nenhuma tela lê `level.objectives` direto, senão o Difícil mostraria as
 * estrelas do Normal na hora de escolher a fase e outras na hora de contar o resultado.
 */
export function objectivesFor(level: Pick<LevelDefinition, "objectives" | "objectivesByDifficulty">, difficulty: string): readonly LevelObjectiveDefinition[] {
  return level.objectivesByDifficulty?.[difficulty] ?? level.objectives ?? [];
}

/** Verdadeiro quando a dificuldade tem missão própria (a etiqueta "objetivos próprios" da tela). */
export function hasOwnObjectives(level: Pick<LevelDefinition, "objectivesByDifficulty">, difficulty: DifficultyId): boolean {
  return level.objectivesByDifficulty?.[difficulty] !== undefined;
}
