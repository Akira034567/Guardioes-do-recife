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

/**
 * Um lugar do Recife. A arte segue a mesma promessa das decorações: hoje é desenhada com formas do
 * Phaser (`drawLandmarkShape`, na cena), e quando o PNG existir basta preencher `art` — a cena passa
 * a usar a imagem e nada mais muda.
 */
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
  /** Arte pintada. Ausente = a cena desenha a forma vetorial de reserva. */
  art?: { key: string; path: string; scale?: number };
  /**
   * A área que o lugar OCUPA no fundo pintado (estrutura + plaquinha), em %. É diferente do `radius`,
   * que é só o alvo de clique: a ostra, o naufrágio e a lápide são bem maiores que o alvo. Decoração
   * nenhuma pode nascer aqui dentro, senão tapa o desenho ou o nome — `tests/reef-catalog.test.ts`
   * cobra isso a cada mudança de canteiro.
   */
  keepOut: { x0: number; x1: number; y0: number; y1: number };
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
  { id: "collection", label: "Álbum do Recife", hint: "Quem já vive aqui", at: { x: 16, y: 40 }, radius: 9, minStage: 0, keepOut: { x0: 6, x1: 26, y0: 21, y1: 50 } },
  { id: "bestiary", label: "Ameaças", hint: "Conheça os invasores", at: { x: 15, y: 70 }, radius: 9, minStage: 0, keepOut: { x0: 0, x1: 25, y0: 51, y1: 83 } },
  { id: "map", label: "Mapa do Recife", hint: "Explore novas áreas", at: { x: 46, y: 47 }, radius: 9, minStage: 0, keepOut: { x0: 38, x1: 53, y0: 35, y1: 73 } },
  { id: "stories", label: "Histórias", hint: "O que o oceano guarda", at: { x: 79, y: 43 }, radius: 8, minStage: 0, keepOut: { x0: 71, x1: 92, y0: 19, y1: 50 } },
  { id: "achievements", label: "Conquistas", hint: "Sua jornada até aqui", at: { x: 68, y: 67 }, radius: 8, minStage: 0, keepOut: { x0: 60, x1: 74, y0: 52, y1: 80 } },
  { id: "settings", label: "Configurações", hint: "Ajuste o jogo do seu jeito", at: { x: 90, y: 68 }, radius: 8, minStage: 0, keepOut: { x0: 81, x1: 98, y0: 53, y1: 80 } },
];

/**
 * Os canteiros do Recife. `order` é a fila de liberação: o crescimento abre um por vez, então o
 * jogador vê UM coral novo, não dez de uma vez.
 */
export const REEF_SLOTS: readonly ReefSlot[] = [
  { id: "coral-a", kind: "coralBed", at: { x: 32, y: 90 }, scale: 1.0, order: 0 },
  { id: "sand-a", kind: "sandBed", at: { x: 46, y: 96 }, scale: 1.0, order: 1 },
  { id: "rock-a", kind: "rockField", at: { x: 55, y: 95 }, scale: 1.0, order: 2 },
  { id: "algae-a", kind: "algaeBank", at: { x: 31, y: 97 }, scale: 0.95, order: 3 },
  { id: "sand-b", kind: "sandBed", at: { x: 67, y: 98 }, scale: 0.95, order: 4 },
  { id: "coral-b", kind: "coralBed", at: { x: 78, y: 95 }, scale: 1.0, order: 5 },
  { id: "rock-b", kind: "rockField", at: { x: 88, y: 98 }, scale: 0.95, order: 6 },
  { id: "algae-b", kind: "algaeBank", at: { x: 50, y: 97 }, scale: 0.9, order: 7 },
  { id: "sand-c", kind: "sandBed", at: { x: 18, y: 99 }, scale: 0.95, order: 8 },
  { id: "front-a", kind: "foreground", at: { x: 36, y: 99 }, scale: 1.1, order: 9 },
  { id: "coral-c", kind: "coralBed", at: { x: 63, y: 98 }, scale: 0.95, order: 10 },
  { id: "rock-c", kind: "rockField", at: { x: 93, y: 98 }, scale: 0.95, order: 11 },
  { id: "algae-c", kind: "algaeBank", at: { x: 77, y: 97 }, scale: 0.95, order: 12 },
  { id: "sand-d", kind: "sandBed", at: { x: 42, y: 98 }, scale: 0.95, order: 13 },
  { id: "ruin-a", kind: "ruinYard", at: { x: 30, y: 97 }, scale: 0.9, order: 14 },
  { id: "coral-d", kind: "coralBed", at: { x: 52, y: 92 }, scale: 0.95, order: 15 },
  { id: "sand-e", kind: "sandBed", at: { x: 11, y: 99 }, scale: 0.9, order: 16 },
  { id: "front-b", kind: "foreground", at: { x: 71, y: 99 }, scale: 1.1, order: 17 },
  { id: "rock-d", kind: "rockField", at: { x: 26, y: 98 }, scale: 0.95, order: 18 },
  { id: "algae-d", kind: "algaeBank", at: { x: 85, y: 98 }, scale: 0.9, order: 19 },
  { id: "sand-f", kind: "sandBed", at: { x: 31, y: 98 }, scale: 0.9, order: 20 },
  { id: "ruin-b", kind: "ruinYard", at: { x: 78, y: 99 }, scale: 0.85, order: 21 },
  { id: "coral-e", kind: "coralBed", at: { x: 47, y: 91 }, scale: 0.95, order: 22 },
  { id: "front-c", kind: "foreground", at: { x: 5, y: 99 }, scale: 1.1, order: 23 },
  { id: "canopy-a", kind: "canopy", at: { x: 33, y: 77 }, scale: 0.6, order: 24 },
  { id: "canopy-b", kind: "canopy", at: { x: 78, y: 90 }, scale: 0.6, order: 25 },
];

export const REEF_REST_SPOTS: readonly ReefRestSpot[] = [
  { id: "turtle-coral", at: { x: 34, y: 58 }, habitat: "nearCoral", radius: 6 },
  { id: "crab-rock", at: { x: 30, y: 84 }, habitat: "seabed", radius: 5 },
  { id: "shrimp-coral", at: { x: 44, y: 64 }, habitat: "nearCoral", radius: 4 },
  { id: "octopus-den", at: { x: 62, y: 86 }, habitat: "seabed", radius: 5 },
  { id: "stonefish-sand", at: { x: 50, y: 88 }, habitat: "seabed", radius: 4 },
];

export const REEF_ZONES: readonly ReefZone[] = [
  { habitat: "seabed", bounds: { x: 6, y: 72, w: 88, h: 22 } },
  { habitat: "nearCoral", bounds: { x: 20, y: 52, w: 60, h: 30 } },
  { habitat: "midwater", bounds: { x: 30, y: 24, w: 42, h: 42 } },
  { habitat: "wideRange", bounds: { x: 22, y: 18, w: 56, h: 64 } },
  { habitat: "surface", bounds: { x: 20, y: 8, w: 60, h: 14 } },
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
// Os lugares vêm pintados no fundo: se um sair da tela, o alvo clicável não cobre mais o desenho.
const offscreen = REEF_LANDMARKS.filter(
  (landmark) => landmark.at.x - landmark.radius < 0 || landmark.at.x + landmark.radius > 100 || landmark.at.y - landmark.radius < 0 || landmark.at.y + landmark.radius > 100,
);
if (offscreen.length > 0) throw new Error(`Lugar do Recife fora da tela: ${offscreen.map((landmark) => landmark.id).join(", ")}`);
