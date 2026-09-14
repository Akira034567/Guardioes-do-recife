import { reefDecorationKey, reefDecorationPath } from "../../assets/reefArt";
import type { UnlockCondition } from "../unlocks";
import type { ReefSlotKind } from "./layout";

/**
 * O que pode crescer no Meu Recife.
 *
 * A arte é declarada, não desenhada aqui. Hoje toda peça é `sprite`, apontando para os PNGs de
 * `public/assets/reef/` (fatiados das folhas por `scripts/slice-reef-sheet.py`). O tipo `vector`
 * continua valendo para uma peça nova nascer desenhada antes de ter arte: a troca é uma linha, e nada
 * fora do renderizador lê `art` — crescimento, plantio, economia, save e testes só tocam `id`,
 * `kind`, `cost`, `unlock`, `slots` e `maxCount`.
 */

export type DecorationKind = "coral" | "rock" | "algae" | "shell" | "ruin" | "statue" | "plant" | "light" | "restSpot" | "special";

/** Primitivas que o desenhista vetorial da cena sabe traçar. */
export type VectorShape = "blob" | "dome" | "fan" | "branch" | "ribbon" | "column" | "spiral" | "arc" | "star" | "orb";

export interface VectorLayer {
  shape: VectorShape;
  /** 0xRRGGBB, mesmo formato de `GuardianDefinition.color`. */
  color: number;
  /** Tamanho relativo à caixa da peça (1 = ocupa tudo). */
  size: number;
  alpha?: number;
  /** Deslocamento do centro, em frações da caixa (-1..1). */
  dx?: number;
  dy?: number;
  rotation?: number;
  /** Repetições: nervuras do leque, galhos, folhas da alga. */
  repeat?: number;
  /** Irregularidade da silhueta, 0..1; a cena aplica com um sorteio semeado pela instância. */
  jitter?: number;
  /** Balanço contínuo. Ausente = parado. */
  sway?: { amplitudeDeg: number; periodMs: number };
  /** Brilho pulsante (luzes, coral-de-fogo). */
  glow?: { color: number; periodMs: number; min: number; max: number };
}

export type DecorationArt =
  | { type: "vector"; layers: readonly VectorLayer[] }
  | { type: "sprite"; key: string; path: string; scale?: number; sway?: VectorLayer["sway"] };

export interface DecorationDefinition {
  id: string;
  kind: DecorationKind;
  name: string;
  /** Uma linha para o rótulo, quando a peça virar algo que o jogador inspeciona. */
  tagline: string;
  art: DecorationArt;
  /** Caixa ocupada, em % da área do Recife. */
  footprint: { w: number; h: number };
  /** Camada de desenho; ausente = a camada média. Empate se resolve pelo `y` da instância. */
  depth?: number;
  /** Preço em Conchas para quando a loja existir. 0 = nunca vendida, só concedida. */
  cost: number;
  /** Basta UMA condição, mesma semântica de `GuardianUnlockDefinition.conditions`. */
  unlock: UnlockCondition[];
  /** Tipos de canteiro que aceitam esta peça. */
  slots: readonly ReefSlotKind[];
  /** Cópias simultâneas no Recife. */
  maxCount: number;
}

export const DECORATIONS: readonly DecorationDefinition[] = [
  {
    id: "coral-cerebro",
    kind: "coral",
    name: "Coral-cérebro",
    tagline: "Lento para crescer, teimoso para ficar.",
    art: { type: "sprite", key: reefDecorationKey("coral-cerebro"), path: reefDecorationPath("coral-cerebro") },
    footprint: { w: 11, h: 9 },
    cost: 0,
    unlock: [{ type: "default" }],
    slots: ["coralBed"],
    maxCount: 3,
  },
  {
    id: "coral-chifre",
    kind: "coral",
    name: "Coral-chifre",
    tagline: "Abrigo de quem é pequeno demais para brigar.",
    art: { type: "sprite", key: reefDecorationKey("coral-chifre"), path: reefDecorationPath("coral-chifre"), sway: { amplitudeDeg: 3, periodMs: 4200 } },
    footprint: { w: 10, h: 11 },
    cost: 0,
    unlock: [{ type: "default" }],
    slots: ["coralBed", "rockField"],
    maxCount: 4,
  },
  {
    id: "alga-fita",
    kind: "algae",
    name: "Alga-fita",
    tagline: "Dança com a corrente e nunca se cansa.",
    art: { type: "sprite", key: reefDecorationKey("alga-fita"), path: reefDecorationPath("alga-fita"), sway: { amplitudeDeg: 7, periodMs: 3000 } },
    footprint: { w: 8, h: 13 },
    cost: 0,
    unlock: [{ type: "default" }],
    slots: ["algaeBank", "sandBed"],
    maxCount: 6,
  },
  {
    id: "rocha-musgo",
    kind: "rock",
    name: "Rocha-musgo",
    tagline: "Estava aqui antes de todo mundo.",
    art: { type: "sprite", key: reefDecorationKey("rocha-musgo"), path: reefDecorationPath("rocha-musgo") },
    footprint: { w: 13, h: 8 },
    cost: 0,
    unlock: [{ type: "default" }],
    slots: ["rockField", "sandBed"],
    maxCount: 4,
  },
  {
    id: "leito-areia",
    kind: "restSpot",
    name: "Leito de areia",
    tagline: "Um bom lugar para descansar.",
    art: { type: "sprite", key: reefDecorationKey("leito-areia"), path: reefDecorationPath("leito-areia") },
    footprint: { w: 15, h: 5 },
    cost: 0,
    unlock: [{ type: "default" }],
    slots: ["sandBed"],
    maxCount: 3,
  },
  {
    id: "alga-bolha",
    kind: "algae",
    name: "Alga-bolha",
    tagline: "Solta bolhinhas quando ninguém está olhando.",
    art: { type: "sprite", key: reefDecorationKey("alga-bolha"), path: reefDecorationPath("alga-bolha"), sway: { amplitudeDeg: 6, periodMs: 3400 } },
    footprint: { w: 8, h: 12 },
    cost: 40,
    unlock: [{ type: "levelsCompleted", count: 2 }],
    slots: ["algaeBank"],
    maxCount: 4,
  },
  {
    id: "concha-leque",
    kind: "shell",
    name: "Concha-leque",
    tagline: "Vazia, mas ainda guarda o som do mar.",
    art: { type: "sprite", key: reefDecorationKey("concha-leque"), path: reefDecorationPath("concha-leque") },
    footprint: { w: 9, h: 7 },
    cost: 40,
    unlock: [{ type: "levelCompleted", levelId: "recife-2" }],
    slots: ["sandBed", "foreground"],
    maxCount: 3,
  },
  {
    id: "coral-leque-roxo",
    kind: "coral",
    name: "Leque-roxo",
    tagline: "Filtra a corrente e pinta a água.",
    art: { type: "sprite", key: reefDecorationKey("coral-leque-roxo"), path: reefDecorationPath("coral-leque-roxo"), sway: { amplitudeDeg: 4, periodMs: 3600 } },
    footprint: { w: 11, h: 10 },
    cost: 60,
    unlock: [{ type: "starsTotal", stars: 3 }],
    slots: ["coralBed", "canopy"],
    maxCount: 3,
  },
  {
    id: "capim-marinho",
    kind: "plant",
    name: "Capim-marinho",
    tagline: "Berçário de quem ainda vai crescer.",
    art: { type: "sprite", key: reefDecorationKey("capim-marinho"), path: reefDecorationPath("capim-marinho"), sway: { amplitudeDeg: 9, periodMs: 2200 } },
    footprint: { w: 10, h: 9 },
    cost: 35,
    unlock: [{ type: "starsTotal", stars: 3 }],
    slots: ["sandBed", "algaeBank"],
    maxCount: 8,
  },
  {
    id: "rocha-arco",
    kind: "rock",
    name: "Arco de pedra",
    tagline: "A corrente cavou por mil anos.",
    art: { type: "sprite", key: reefDecorationKey("rocha-arco"), path: reefDecorationPath("rocha-arco") },
    footprint: { w: 15, h: 11 },
    cost: 90,
    unlock: [{ type: "levelsCompleted", count: 3 }],
    slots: ["rockField"],
    maxCount: 2,
  },
  {
    id: "toca-do-caranguejo",
    kind: "restSpot",
    name: "Toca do caranguejo",
    tagline: "Ocupada. Sempre.",
    art: { type: "sprite", key: reefDecorationKey("toca-do-caranguejo"), path: reefDecorationPath("toca-do-caranguejo") },
    footprint: { w: 12, h: 9 },
    cost: 70,
    unlock: [{ type: "levelsCompleted", count: 4 }],
    slots: ["rockField", "sandBed"],
    maxCount: 2,
  },
  {
    id: "concha-nautilo",
    kind: "shell",
    name: "Concha-nautilo",
    tagline: "Uma espiral perfeita, de graça.",
    art: { type: "sprite", key: reefDecorationKey("concha-nautilo"), path: reefDecorationPath("concha-nautilo") },
    footprint: { w: 9, h: 8 },
    cost: 80,
    unlock: [{ type: "starsTotal", stars: 6 }],
    slots: ["sandBed", "foreground"],
    maxCount: 2,
  },
  {
    id: "coral-fogo",
    kind: "coral",
    name: "Coral-de-fogo",
    tagline: "Bonito de longe. Só de longe.",
    art: { type: "sprite", key: reefDecorationKey("coral-fogo"), path: reefDecorationPath("coral-fogo") },
    footprint: { w: 10, h: 11 },
    cost: 120,
    unlock: [{ type: "starsTotal", stars: 9 }],
    slots: ["coralBed", "canopy"],
    maxCount: 2,
  },
  {
    id: "ruina-coluna",
    kind: "ruin",
    name: "Coluna submersa",
    tagline: "Alguém construiu aqui, muito antes.",
    art: { type: "sprite", key: reefDecorationKey("ruina-coluna"), path: reefDecorationPath("ruina-coluna") },
    footprint: { w: 8, h: 13 },
    cost: 150,
    unlock: [{ type: "levelCompleted", levelId: "recife-4" }],
    slots: ["ruinYard"],
    maxCount: 3,
  },
  {
    id: "lanterna-agua-viva",
    kind: "light",
    name: "Lanterna-água-viva",
    tagline: "Acende quando o Recife dorme.",
    art: { type: "sprite", key: reefDecorationKey("lanterna-agua-viva"), path: reefDecorationPath("lanterna-agua-viva"), sway: { amplitudeDeg: 3, periodMs: 5000 } },
    footprint: { w: 9, h: 12 },
    cost: 130,
    unlock: [{ type: "guardiansUnlocked", count: 6 }],
    slots: ["canopy", "coralBed"],
    maxCount: 3,
  },
  {
    id: "estatua-guardia",
    kind: "statue",
    name: "Estátua da Guardiã",
    tagline: "Erguida para quem carregou o Recife nas costas.",
    art: { type: "sprite", key: reefDecorationKey("estatua-guardia"), path: reefDecorationPath("estatua-guardia") },
    footprint: { w: 10, h: 12 },
    cost: 0,
    unlock: [{ type: "encounterCompleted", encounterId: "rede-fantasma" }],
    slots: ["ruinYard", "rockField"],
    maxCount: 1,
  },
  {
    id: "pedra-que-pisca",
    kind: "special",
    name: "Pedra que pisca",
    tagline: "Você achou. Ela lembra.",
    art: { type: "sprite", key: reefDecorationKey("pedra-que-pisca"), path: reefDecorationPath("pedra-que-pisca") },
    footprint: { w: 9, h: 9 },
    cost: 0,
    unlock: [{ type: "secretFound", secretId: "pedra-que-pisca" }],
    slots: ["rockField"],
    maxCount: 1,
  },
  {
    id: "farol-afundado",
    kind: "light",
    name: "Farol afundado",
    tagline: "Ainda aponta o caminho de casa.",
    art: { type: "sprite", key: reefDecorationKey("farol-afundado"), path: reefDecorationPath("farol-afundado") },
    footprint: { w: 11, h: 13 },
    cost: 300,
    unlock: [{ type: "encounterCompleted", encounterId: "chamado-do-golfinho" }],
    slots: ["ruinYard"],
    maxCount: 1,
  },
];

export const DECORATION_IDS: readonly string[] = DECORATIONS.map((definition) => definition.id);

export function decoration(id: string): DecorationDefinition | undefined {
  return DECORATIONS.find((definition) => definition.id === id);
}

export function decorationsForSlot(kind: ReefSlotKind): readonly DecorationDefinition[] {
  return DECORATIONS.filter((definition) => definition.slots.includes(kind));
}

if (new Set(DECORATION_IDS).size !== DECORATIONS.length) throw new Error("Catálogo do Recife com id repetido");
