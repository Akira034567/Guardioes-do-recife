import type { GuardianId, LevelDefinition } from "../../types";
import { CHAMADO_DO_GOLFINHO } from "./chamadoDoGolfinho";
import { EMBOSCADA_NO_CORAL } from "./emboscadaNoCoral";
import { GRUTA_DO_PREDADOR } from "./grutaDoPredador";
import { REDE_FANTASMA } from "./redeFantasma";

/**
 * Encontros do Recife (item 3): fases curtas, fora da campanha, onde cada Guardião novo é ENCONTRADO.
 * Ficam num registro separado de `LEVELS` de propósito: não entram na cadeia linear de fases, não
 * valem estrela e não mexem na contagem da campanha. Vencer um deles conclui o Encontro e é isso que
 * `unlocks.ts` espera.
 */
export interface EncounterDefinition {
  id: string;
  level: LevelDefinition;
  /** Quem entra para a coleção ao vencer. */
  guardianId: GuardianId;
  /** Nó do mapa: o Encontro aparece ao lado desta fase da campanha. */
  after: string;
  /** O que precisa acontecer antes de o nó abrir. */
  requires: { levelCompleted?: string; secretFound?: string };
  /** Chamada curta no mapa de progressão. */
  teaser: string;
}

export const ENCOUNTERS: readonly EncounterDefinition[] = [
  {
    id: "gruta-do-predador",
    level: GRUTA_DO_PREDADOR,
    guardianId: "shark",
    after: "recife-2",
    requires: { levelCompleted: "recife-2" },
    teaser: "Algo grande respira numa fenda além do Canal das Algas.",
  },
  {
    id: "rede-fantasma",
    level: REDE_FANTASMA,
    guardianId: "sea-turtle",
    after: "recife-3",
    requires: { levelCompleted: "recife-3" },
    teaser: "Uma rede à deriva prendeu alguém perto dos Três Redemoinhos.",
  },
  {
    id: "emboscada-no-coral",
    level: EMBOSCADA_NO_CORAL,
    guardianId: "stonefish",
    after: "recife-4",
    requires: { secretFound: "pedra-que-pisca" },
    teaser: "A pedra que pisca na Espiral de Coral está esperando alguém.",
  },
  {
    id: "chamado-do-golfinho",
    level: CHAMADO_DO_GOLFINHO,
    guardianId: "dolphin",
    after: "recife-5",
    requires: { levelCompleted: "recife-5" },
    teaser: "O sino do galeão ainda responde a quem chega perto.",
  },
];

export const ENCOUNTER_LEVELS: readonly LevelDefinition[] = ENCOUNTERS.map((encounter) => encounter.level);

export function getEncounter(id: string | null | undefined): EncounterDefinition | undefined {
  return ENCOUNTERS.find((encounter) => encounter.id === id);
}

/** O Encontro que roda nesta fase, quando ela é uma fase de Encontro. */
export function encounterForLevel(levelId: string): EncounterDefinition | undefined {
  return ENCOUNTERS.find((encounter) => encounter.level.id === levelId);
}

export { CHAMADO_DO_GOLFINHO, EMBOSCADA_NO_CORAL, GRUTA_DO_PREDADOR, REDE_FANTASMA };
