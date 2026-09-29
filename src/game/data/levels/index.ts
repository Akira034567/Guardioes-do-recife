import { ENCOUNTER_LEVELS } from "../encounters";
import { CANAIS_LEVELS } from "./canais";
import type { LevelDefinition } from "../../types";
import { RECIFE_FIVE } from "./recifeFive";
import { RECIFE_FOUR } from "./recifeFour";
import { RECIFE_ONE } from "./recifeOne";
import { RECIFE_SIX } from "./recifeSix";
import { RECIFE_THREE } from "./recifeThree";
import { RECIFE_TWO } from "./recifeTwo";

/**
 * Registro ordenado de fases. A ordem aqui define a progressão: concluir a fase
 * N libera a fase N+1. Para adicionar uma fase, crie o arquivo e inclua aqui.
 */
export const LEVELS: readonly LevelDefinition[] = [
  RECIFE_ONE,
  RECIFE_TWO,
  RECIFE_THREE,
  RECIFE_FOUR,
  RECIFE_FIVE,
  RECIFE_SIX,
  // Canais Profundos (v4): continuam a cadeia — vencer o Coração do Recife abre a Boca do Canal.
  ...CANAIS_LEVELS,
];

export const LEVEL_IDS: readonly string[] = LEVELS.map((level) => level.id);

/**
 * Fases que abrem o Difícil e o Abissal: as do Recife Costeiro. Com os Canais Profundos a campanha
 * dobrou de tamanho, e contar as fases novas trancaria de volta as dificuldades de quem já tinha
 * fechado a primeira região — o jogador perderia algo que já ganhou.
 */
export const DIFFICULTY_GATE_LEVEL_IDS: readonly string[] = [RECIFE_ONE, RECIFE_TWO, RECIFE_THREE, RECIFE_FOUR, RECIFE_FIVE, RECIFE_SIX].map(
  (level) => level.id,
);

/**
 * Fase jogável por id: as da campanha e, depois delas, as fases de Encontro. `LEVELS`,
 * `levelIndex` e `nextLevelId` continuam falando só da campanha — Encontro não entra na cadeia.
 */
export function getLevel(id: string | null | undefined): LevelDefinition | undefined {
  return LEVELS.find((level) => level.id === id) ?? ENCOUNTER_LEVELS.find((level) => level.id === id);
}

/** Só a campanha, quando o chamador precisa garantir que não é um Encontro. */
export function getCampaignLevel(id: string | null | undefined): LevelDefinition | undefined {
  return LEVELS.find((level) => level.id === id);
}

export function levelIndex(id: string): number {
  return LEVELS.findIndex((level) => level.id === id);
}

export function nextLevelId(id: string): string | null {
  const index = levelIndex(id);
  if (index < 0 || index >= LEVELS.length - 1) return null;
  return LEVELS[index + 1].id;
}

export { RECIFE_ONE, RECIFE_TWO, RECIFE_THREE, RECIFE_FOUR, RECIFE_FIVE, RECIFE_SIX };
