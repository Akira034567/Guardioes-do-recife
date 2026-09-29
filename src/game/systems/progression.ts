import { ProgressionService } from "../core/progression/ProgressionService";
import { DIFFICULTY_GATE_LEVEL_IDS, LEVEL_IDS } from "../data/levels";
import { GUARDIAN_UNLOCKS } from "../data/unlocks";
import { getSaveManager } from "./ProgressStore";

let service: ProgressionService | null = null;

/** Serviço de progressão da página, em cima do `SaveManager` único. */
export function getProgression(): ProgressionService {
  if (!service) service = new ProgressionService(getSaveManager(), { levelIds: LEVEL_IDS, difficultyLevelIds: DIFFICULTY_GATE_LEVEL_IDS, unlocks: GUARDIAN_UNLOCKS });
  return service;
}

/** Troca de conta: o serviço aponta para o save antigo, então ele cai junto com o `SaveManager`. */
export function resetProgression(): void {
  service = null;
}
