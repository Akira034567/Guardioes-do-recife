/**
 * O mapa do Meu Recife: onde ficam os lugares que o jogador clica, onde as decorações podem nascer,
 * onde os Guardiões descansam e por onde eles nadam.
 *
 * TUDO aqui está em porcentagem da área (0–100), como `data/regions.ts` já faz com os nós do mapa.
 * A cena converte para pixel uma vez e reconverte ao redimensionar, sem mudar estado nenhum — é o que
 * faz o hub sobreviver ao `--gr-scale`, à tela cheia e ao celular deitado.
 */

/** Os seis lugares interativos. Espelha `ShellSection` sem importar a camada de interface. */
export type ReefLandmarkId = "map" | "collection" | "bestiary" | "stories" | "achievements" | "settings";

export interface ReefPoint {
  x: number;
  y: number;
}

export type ReefSlotKind = "coralBed" | "rockField" | "sandBed" | "algaeBank" | "ruinYard" | "canopy" | "foreground";

export type ReefHabitat = "seabed" | "midwater" | "nearCoral" | "wideRange" | "surface";

/** A forma vetorial de um lugar; a arte pintada entra depois por `texture`. */
export interface ReefLandmark {
  id: ReefLandmarkId;
  label: string;
  /** Uma linha sob o nome, no rótulo que aparece ao aproximar. */
  hint: string;
  at: ReefPoint;
  /** Raio que acende o rótulo e aceita o clique, em % da largura. */
  radius: number;
  /** Só aparece a partir deste estágio: a primeira visita é calma, com três lugares. */
  minStage: number;
}

export interface ReefSlot {
  id: string;
  kind: ReefSlotKind;
  at: ReefPoint;
  /** Escala sugerida: o que está ao fundo é menor. A profundidade vem do dado, não do desenho. */
  scale: number;
  /** Ordem de liberação pelo crescimento. 0 = aberto desde sempre. */
  order: number;
}

export interface ReefRestSpot {
  id: string;
  at: ReefPoint;
  habitat: ReefHabitat;
  /** Raio de aconchego, em % da largura. */
  radius: number;
}

/** Faixa navegável de cada habitat: os limites padrão de quem mora nele. */
export interface ReefZone {
  habitat: ReefHabitat;
  bounds: { x: number; y: number; w: number; h: number };
}

export const REEF_LANDMARKS: readonly ReefLandmark[] = [
  { id: "map", label: "Mapa do Recife", hint: "Explore novas áreas", at: { x: 13, y: 64 }, radius: 9, minStage: 0 },
  { id: "collection", label: "Álbum do Recife", hint: "Quem já vive aqui", at: { x: 33, y: 46 }, radius: 8, minStage: 0 },
  { id: "bestiary", label: "Ameaças", hint: "Conheça os invasores", at: { x: 57, y: 76 }, radius: 8, minStage: 1 },
  { id: "stories", label: "Histórias", hint: "O que o oceano guarda", at: { x: 75, y: 40 }, radius: 8, minStage: 1 },
  { id: "achievements", label: "Conquistas", hint: "Sua jornada até aqui", at: { x: 89, y: 62 }, radius: 8, minStage: 2 },
  { id: "settings", label: "Configurações", hint: "Ajuste o jogo do seu jeito", at: { x: 93, y: 15 }, radius: 7, minStage: 0 },
];

/**
 * Os canteiros do Recife. `order` é a fila de liberação: o crescimento abre um por vez, então o
 * jogador vê UM coral novo, não dez de uma vez.
 */
export const REEF_SLOTS: readonly ReefSlot[] = [
  { id: "coral-a", kind: "coralBed", at: { x: 28, y: 58 }, scale: 1.0, order: 0 },
  { id: "coral-b", kind: "coralBed", at: { x: 40, y: 66 }, scale: 1.0, order: 1 },
  { id: "rock-a", kind: "rockField", at: { x: 18, y: 78 }, scale: 1.25, order: 2 },
  { id: "sand-a", kind: "sandBed", at: { x: 50, y: 84 }, scale: 1.25, order: 3 },
  { id: "algae-a", kind: "algaeBank", at: { x: 8, y: 50 }, scale: 1.0, order: 4 },
  { id: "algae-b", kind: "algaeBank", at: { x: 62, y: 60 }, scale: 1.0, order: 5 },
  { id: "coral-c", kind: "coralBed", at: { x: 46, y: 52 }, scale: 1.0, order: 6 },
  { id: "rock-b", kind: "rockField", at: { x: 70, y: 80 }, scale: 1.25, order: 7 },
  { id: "sand-b", kind: "sandBed", at: { x: 34, y: 88 }, scale: 1.25, order: 8 },
  { id: "algae-c", kind: "algaeBank", at: { x: 86, y: 72 }, scale: 1.25, order: 9 },
  { id: "canopy-a", kind: "canopy", at: { x: 24, y: 28 }, scale: 0.7, order: 10 },
  { id: "front-a", kind: "foreground", at: { x: 12, y: 92 }, scale: 1.4, order: 11 },
  { id: "coral-d", kind: "coralBed", at: { x: 80, y: 50 }, scale: 1.0, order: 12 },
  { id: "rock-c", kind: "rockField", at: { x: 52, y: 70 }, scale: 1.0, order: 13 },
  { id: "sand-c", kind: "sandBed", at: { x: 72, y: 88 }, scale: 1.25, order: 14 },
  { id: "algae-d", kind: "algaeBank", at: { x: 44, y: 36 }, scale: 0.7, order: 15 },
  { id: "front-b", kind: "foreground", at: { x: 66, y: 94 }, scale: 1.4, order: 16 },
  { id: "ruin-a", kind: "ruinYard", at: { x: 82, y: 84 }, scale: 1.25, order: 17 },
  { id: "canopy-b", kind: "canopy", at: { x: 54, y: 22 }, scale: 0.7, order: 18 },
  { id: "coral-e", kind: "coralBed", at: { x: 20, y: 42 }, scale: 1.0, order: 19 },
  { id: "ruin-b", kind: "ruinYard", at: { x: 88, y: 44 }, scale: 1.0, order: 20 },
  { id: "rock-d", kind: "rockField", at: { x: 38, y: 74 }, scale: 1.25, order: 21 },
  { id: "canopy-c", kind: "canopy", at: { x: 78, y: 26 }, scale: 0.7, order: 22 },
  { id: "ruin-c", kind: "ruinYard", at: { x: 60, y: 48 }, scale: 1.0, order: 23 },
  { id: "sand-d", kind: "sandBed", at: { x: 92, y: 88 }, scale: 1.25, order: 24 },
  { id: "algae-e", kind: "algaeBank", at: { x: 4, y: 66 }, scale: 1.25, order: 25 },
];

export const REEF_REST_SPOTS: readonly ReefRestSpot[] = [
  { id: "turtle-coral", at: { x: 30, y: 52 }, habitat: "nearCoral", radius: 6 },
  { id: "crab-rock", at: { x: 19, y: 79 }, habitat: "seabed", radius: 5 },
  { id: "shrimp-coral", at: { x: 41, y: 64 }, habitat: "nearCoral", radius: 4 },
  { id: "octopus-den", at: { x: 70, y: 82 }, habitat: "seabed", radius: 5 },
  { id: "stonefish-sand", at: { x: 51, y: 86 }, habitat: "seabed", radius: 4 },
];

export const REEF_ZONES: readonly ReefZone[] = [
  { habitat: "seabed", bounds: { x: 4, y: 70, w: 92, h: 26 } },
  { habitat: "nearCoral", bounds: { x: 8, y: 44, w: 78, h: 34 } },
  { habitat: "midwater", bounds: { x: 6, y: 26, w: 88, h: 48 } },
  { habitat: "wideRange", bounds: { x: 3, y: 18, w: 94, h: 70 } },
  { habitat: "surface", bounds: { x: 10, y: 8, w: 80, h: 16 } },
];

export const SLOT_KINDS: readonly ReefSlotKind[] = ["coralBed", "rockField", "sandBed", "algaeBank", "ruinYard", "canopy", "foreground"];

export function reefZone(habitat: ReefHabitat): ReefZone {
  return REEF_ZONES.find((zone) => zone.habitat === habitat) ?? REEF_ZONES[3];
}

export function slotById(id: string): ReefSlot | undefined {
  return REEF_SLOTS.find((slot) => slot.id === id);
}

export function slotsOfKind(kind: ReefSlotKind): readonly ReefSlot[] {
  return REEF_SLOTS.filter((slot) => slot.kind === kind);
}

// Guardas de carga, no mesmo espírito de `data/regions.ts`: um layout torto falha na hora, não na tela.
const slotIds = new Set(REEF_SLOTS.map((slot) => slot.id));
if (slotIds.size !== REEF_SLOTS.length) throw new Error("Slots do Recife com id repetido");
const orders = [...REEF_SLOTS.map((slot) => slot.order)].sort((a, b) => a - b);
if (orders.some((order, index) => order !== index)) throw new Error("A ordem dos slots do Recife tem buraco ou repetição");
if (new Set(REEF_LANDMARKS.map((landmark) => landmark.id)).size !== 6) throw new Error("O Recife precisa dos seis lugares");
