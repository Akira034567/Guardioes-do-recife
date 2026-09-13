import type { UnlockCondition } from "../unlocks";
import type { ReefSlotKind } from "./layout";

/**
 * O que pode crescer no Meu Recife.
 *
 * A arte é declarada, não desenhada aqui: hoje toda peça é `vector` (formas do Phaser), e trocar por
 * `sprite` no dia em que os PNGs chegarem é editar UMA linha por entrada. Isso funciona porque nada
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

const vector = (...layers: VectorLayer[]): DecorationArt => ({ type: "vector", layers });

export const DECORATIONS: readonly DecorationDefinition[] = [
  {
    id: "coral-cerebro",
    kind: "coral",
    name: "Coral-cérebro",
    tagline: "Lento para crescer, teimoso para ficar.",
    art: vector({ shape: "blob", color: 0xe98a7b, size: 1, jitter: 0.5 }, { shape: "blob", color: 0xc9635b, size: 0.7, dy: 0.1 }),
    footprint: { w: 6, h: 5 },
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
    art: vector({ shape: "branch", color: 0xf2a65a, size: 1, repeat: 5, sway: { amplitudeDeg: 3, periodMs: 4200 } }),
    footprint: { w: 5, h: 7 },
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
    art: vector({ shape: "ribbon", color: 0x3fa66b, size: 1, repeat: 4, sway: { amplitudeDeg: 9, periodMs: 3000 } }),
    footprint: { w: 4, h: 9 },
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
    art: vector({ shape: "blob", color: 0x4a5a66, size: 1, jitter: 0.4 }, { shape: "dome", color: 0x3c7a58, size: 0.75, dy: 0.25, alpha: 0.7 }),
    footprint: { w: 7, h: 4 },
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
    art: vector({ shape: "dome", color: 0xe6d2a8, size: 1, dy: 0.4, alpha: 0.9 }),
    footprint: { w: 9, h: 2 },
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
    art: vector(
      { shape: "ribbon", color: 0x2e8f7a, size: 1, repeat: 3, sway: { amplitudeDeg: 8, periodMs: 3400 } },
      { shape: "orb", color: 0x9fe8d6, size: 0.22, repeat: 6, dy: -0.2 },
    ),
    footprint: { w: 4, h: 8 },
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
    art: vector({ shape: "fan", color: 0xf6e3c5, size: 1, repeat: 7, rotation: -12 }),
    footprint: { w: 4, h: 3 },
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
    art: vector({ shape: "fan", color: 0x9a6bd6, size: 1, repeat: 9, sway: { amplitudeDeg: 5, periodMs: 3600 } }),
    footprint: { w: 6, h: 6 },
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
    art: vector({ shape: "ribbon", color: 0x63b36a, size: 0.4, repeat: 11, sway: { amplitudeDeg: 12, periodMs: 2200 } }),
    footprint: { w: 6, h: 4 },
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
    art: vector({ shape: "arc", color: 0x55666f, size: 1 }, { shape: "blob", color: 0x3e4c55, size: 0.6, dy: 0.35 }),
    footprint: { w: 9, h: 7 },
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
    art: vector({ shape: "dome", color: 0x6a5647, size: 1 }, { shape: "arc", color: 0x2b2119, size: 0.4, dy: 0.2 }),
    footprint: { w: 6, h: 4 },
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
    art: vector({ shape: "spiral", color: 0xf3d9b1, size: 1 }, { shape: "spiral", color: 0xce9c6a, size: 0.7, alpha: 0.8 }),
    footprint: { w: 4, h: 4 },
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
    art: vector(
      { shape: "branch", color: 0xff6b4a, size: 1, repeat: 6 },
      { shape: "orb", color: 0xffb38a, size: 0.2, repeat: 4, glow: { color: 0xffb38a, periodMs: 2600, min: 0.3, max: 0.8 } },
    ),
    footprint: { w: 6, h: 8 },
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
    art: vector({ shape: "column", color: 0x8e8a7e, size: 1 }, { shape: "dome", color: 0x6f6b60, size: 0.8, dy: -0.45 }),
    footprint: { w: 5, h: 12 },
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
    art: vector({
      shape: "orb",
      color: 0x8fe3ff,
      size: 0.5,
      repeat: 3,
      glow: { color: 0x8fe3ff, periodMs: 1800, min: 0.25, max: 0.9 },
      sway: { amplitudeDeg: 4, periodMs: 5000 },
    }),
    footprint: { w: 5, h: 6 },
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
    art: vector(
      { shape: "column", color: 0x7fa8a0, size: 1 },
      { shape: "dome", color: 0x9fc4bc, size: 0.7, dy: -0.4 },
      { shape: "arc", color: 0x5e837c, size: 0.9, dy: 0.1 },
    ),
    footprint: { w: 6, h: 11 },
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
    art: vector(
      { shape: "blob", color: 0x4e5a4a, size: 1, jitter: 0.6 },
      { shape: "orb", color: 0xc9ff6b, size: 0.18, glow: { color: 0xc9ff6b, periodMs: 900, min: 0.05, max: 1 } },
    ),
    footprint: { w: 4, h: 4 },
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
    art: vector(
      { shape: "column", color: 0xb8c4c8, size: 1 },
      { shape: "orb", color: 0xffe9a8, size: 0.3, dy: -0.5, glow: { color: 0xffe9a8, periodMs: 3200, min: 0.4, max: 1 } },
      { shape: "arc", color: 0x6e7c80, size: 0.8, dy: 0.3 },
    ),
    footprint: { w: 6, h: 13 },
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
