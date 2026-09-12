import { ProgressionService } from "../core/progression/ProgressionService";
import { LEVEL_IDS } from "../data/levels";
import { GUARDIAN_UNLOCKS } from "../data/unlocks";
import { getSaveManager } from "./ProgressStore";

let service: ProgressionService | null = null;

/** Serviço de progressão da página, em cima do `SaveManager` único. */
export function getProgression(): ProgressionService {
  if (!service) service = new ProgressionService(getSaveManager(), { levelIds: LEVEL_IDS, unlocks: GUARDIAN_UNLOCKS });
  return service;
}
