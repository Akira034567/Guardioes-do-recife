import { LEVEL_BACKGROUND_KEYS } from "../assets/levelBackgrounds";
import { LEVELS } from "./levels";

/**
 * Regiões do Recife: como o mapa agrupa as fases. A campanha mora no Recife Costeiro e nos Canais
 * Profundos (v4); as outras duas estão declaradas porque o mapa as anuncia como o que vem por aí —
 * aparecem fechadas, com o nome e a chamada, e SEM fase nenhuma dentro. Quando uma delas ganhar
 * fases, basta preencher `nodes` aqui: a tela não precisa mudar.
 */
export interface RegionNode {
  levelId: string;
  /** Posição no mapa, em % da área pintada (0–100). */
  x: number;
  y: number;
}

export interface RegionDefinition {
  id: string;
  name: string;
  /** Uma linha sobre o lugar, na aba da região. */
  tagline: string;
  /** Fundo pintado usado como mapa da região; ausente = região ainda sem mapa. */
  backgroundKey?: string;
  /** As fases da região, na ordem, já posicionadas no mapa. Vazio = região por vir. */
  nodes: readonly RegionNode[];
  /** Placa de madeira no canto do mapa, apontando para onde a trilha segue. */
  nextSign?: string;
}

export const REGIONS: readonly RegionDefinition[] = [
  {
    id: "recife-costeiro",
    name: "Recife Costeiro",
    tagline: "Águas calmas, grandes lições.",
    backgroundKey: LEVEL_BACKGROUND_KEYS["recife-1"],
    nextSign: "Canais Profundos",
    nodes: [
      { levelId: "recife-1", x: 10, y: 44 },
      { levelId: "recife-2", x: 24, y: 56 },
      { levelId: "recife-3", x: 40, y: 61 },
      { levelId: "recife-4", x: 56, y: 69 },
      { levelId: "recife-5", x: 71, y: 50 },
      { levelId: "recife-6", x: 86, y: 63 },
    ],
  },
  {
    id: "canais-profundos",
    name: "Canais Profundos",
    tagline: "Segredos nas correntes.",
    // Sem mapa pintado ainda: a tela desenha o fundo procedural da região (ver `MapScreen`).
    nextSign: "Abismo Azul",
    nodes: [
      { levelId: "canais-1", x: 8, y: 40 },
      { levelId: "canais-2", x: 18, y: 62 },
      { levelId: "canais-3", x: 29, y: 44 },
      { levelId: "canais-4", x: 38, y: 68 },
      { levelId: "canais-5", x: 49, y: 46 },
      { levelId: "canais-6", x: 58, y: 70 },
      { levelId: "canais-7", x: 67, y: 44 },
      { levelId: "canais-8", x: 76, y: 66 },
      { levelId: "canais-9", x: 84, y: 42 },
      { levelId: "canais-10", x: 92, y: 62 },
    ],
  },
  { id: "abismo-azul", name: "Abismo Azul", tagline: "Sombras despertam.", nodes: [] },
  { id: "recife-ancestral", name: "Recife Ancestral", tagline: "O verdadeiro teste.", nodes: [] },
];

/** A região onde a fase mora, para o mapa abrir já na aba certa. */
export function regionOfLevel(levelId: string): RegionDefinition | undefined {
  return REGIONS.find((region) => region.nodes.some((node) => node.levelId === levelId));
}

/** Uma região só é jogável quando tem fase dentro; o resto é anúncio do que vem por aí. */
export function isRegionOpen(region: RegionDefinition): boolean {
  return region.nodes.length > 0;
}

/**
 * Guarda de desenvolvimento: toda fase da campanha precisa de um lugar no mapa, senão ela some da
 * tela sem ninguém perceber. Roda uma vez, na carga do módulo.
 */
const placed = new Set(REGIONS.flatMap((region) => region.nodes.map((node) => node.levelId)));
const missing = LEVELS.filter((level) => !placed.has(level.id)).map((level) => level.id);
if (missing.length > 0) throw new Error(`Fases sem posição no mapa: ${missing.join(", ")}`);
