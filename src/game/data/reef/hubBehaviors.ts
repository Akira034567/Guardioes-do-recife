import type { GuardianId } from "../../types";
import type { DecorationKind } from "./decorations";
import type { ReefHabitat, ReefPoint } from "./layout";

/**
 * Como cada Guardião vive no Meu Recife.
 *
 * Um Guardião novo entra aqui e em mais lugar nenhum: a cena só faz `residents.map(hubBehavior)`. E
 * se alguém esquecer de cadastrar, `hubBehavior` devolve o padrão em vez de derrubar o hub.
 *
 * O dado desenha o briefing sozinho. A água-viva com `axisBias` alto e um bob longo É o flutuar para
 * cima e para baixo — `pulse` é só o corpo por cima disso. O `coverKinds` do caranguejo faz
 * "esconde atrás das pedras" emergir do que o jogador plantou, sem esconderijo escrito à mão.
 */

export type HubQuirk = "pulse" | "inflate" | "clawWave" | "sonarPing" | "rest" | "play" | "burrow" | "inkPuff" | "hop";

export type HubCursorReaction = "look" | "approach" | "flee" | "ignore";

/** Feitio do trajeto: perninhas curtas, travessias longas ou quase parado. */
export type HubPathStyle = "wander" | "cruise" | "hover";

export interface HubBehaviorProfile {
  guardianId: GuardianId;
  habitat: ReefHabitat;
  /** % da largura do Recife por segundo. */
  speed: number;
  /** Variação da velocidade a cada trecho, 0..1. */
  speedJitter: number;
  pathStyle: HubPathStyle;
  /** 0 = só horizontal, 1 = só vertical, 0.5 = livre. */
  axisBias: number;
  /** Raio de perambulação em torno da âncora, em % da largura. */
  wanderRadius: number;
  anchor: ReefPoint;
  pauseMs: { min: number; max: number };
  quirk: HubQuirk;
  quirkIntervalMs: { min: number; max: number };
  quirkDurationMs: number;
  cursor: { reaction: HubCursorReaction; radius: number; speedMultiplier: number };
  /** Multiplicador sobre a escala de arte da partida: o hub mostra criaturas menores. */
  scale: number;
  /** Balanço vertical contínuo, em % da altura. */
  bob: { amplitude: number; periodMs: number };
  /** Fuga e descanso preferem estas decorações como abrigo. */
  coverKinds?: readonly DecorationKind[];
  restsAt?: ReefHabitat;
  facesMovement: boolean;
}

export const DEFAULT_HUB_BEHAVIOR: Omit<HubBehaviorProfile, "guardianId"> = {
  habitat: "midwater",
  speed: 1.4,
  speedJitter: 0.25,
  pathStyle: "wander",
  axisBias: 0.4,
  wanderRadius: 12,
  anchor: { x: 50, y: 52 },
  pauseMs: { min: 700, max: 2000 },
  quirk: "pulse",
  quirkIntervalMs: { min: 4000, max: 9000 },
  quirkDurationMs: 800,
  cursor: { reaction: "look", radius: 10, speedMultiplier: 1 },
  scale: 0.6,
  bob: { amplitude: 0.7, periodMs: 3200 },
  facesMovement: true,
};

export const HUB_BEHAVIORS: Record<GuardianId, HubBehaviorProfile> = {
  // Vive nas fendas do coral e dá arrancadas curtas.
  "pistol-shrimp": {
    guardianId: "pistol-shrimp",
    habitat: "nearCoral",
    speed: 2.2,
    speedJitter: 0.35,
    pathStyle: "wander",
    axisBias: 0.45,
    wanderRadius: 7,
    anchor: { x: 30, y: 80 },
    pauseMs: { min: 400, max: 1200 },
    quirk: "hop",
    quirkIntervalMs: { min: 1800, max: 3600 },
    quirkDurationMs: 380,
    cursor: { reaction: "look", radius: 8, speedMultiplier: 1 },
    scale: 0.55,
    bob: { amplitude: 0.4, periodMs: 1700 },
    restsAt: "nearCoral",
    facesMovement: true,
  },
  // Sobe e desce sem pressa; o corpo pulsa por cima do trajeto.
  jellyfish: {
    guardianId: "jellyfish",
    habitat: "midwater",
    speed: 1.1,
    speedJitter: 0.2,
    pathStyle: "wander",
    axisBias: 0.85,
    wanderRadius: 9,
    anchor: { x: 62, y: 40 },
    pauseMs: { min: 700, max: 2000 },
    quirk: "pulse",
    quirkIntervalMs: { min: 1200, max: 2200 },
    quirkDurationMs: 900,
    cursor: { reaction: "ignore", radius: 0, speedMultiplier: 1 },
    scale: 0.6,
    bob: { amplitude: 1.8, periodMs: 4200 },
    facesMovement: false,
  },
  // Nada tranquilo e, de vez em quando, infla.
  pufferfish: {
    guardianId: "pufferfish",
    habitat: "midwater",
    speed: 0.9,
    speedJitter: 0.25,
    pathStyle: "wander",
    axisBias: 0.4,
    wanderRadius: 8,
    anchor: { x: 36, y: 52 },
    pauseMs: { min: 900, max: 2400 },
    quirk: "inflate",
    quirkIntervalMs: { min: 6000, max: 12000 },
    quirkDurationMs: 1400,
    cursor: { reaction: "flee", radius: 10, speedMultiplier: 2 },
    scale: 0.6,
    bob: { amplitude: 0.6, periodMs: 2600 },
    facesMovement: true,
  },
  // Anda pelo fundo e se enfia atrás do que houver de pedra.
  "reef-crab": {
    guardianId: "reef-crab",
    habitat: "seabed",
    speed: 1.6,
    speedJitter: 0.3,
    pathStyle: "wander",
    axisBias: 0.1,
    wanderRadius: 11,
    anchor: { x: 34, y: 86 },
    pauseMs: { min: 500, max: 1600 },
    quirk: "clawWave",
    quirkIntervalMs: { min: 3000, max: 6000 },
    quirkDurationMs: 700,
    cursor: { reaction: "flee", radius: 9, speedMultiplier: 1.8 },
    scale: 0.55,
    bob: { amplitude: 0.15, periodMs: 1400 },
    coverKinds: ["rock", "ruin"],
    restsAt: "seabed",
    facesMovement: true,
  },
  // Deriva lenta pelo fundo, com uma baforada de tinta de vez em quando.
  "ink-octopus": {
    guardianId: "ink-octopus",
    habitat: "seabed",
    speed: 1,
    speedJitter: 0.2,
    pathStyle: "wander",
    axisBias: 0.3,
    wanderRadius: 9,
    anchor: { x: 62, y: 88 },
    pauseMs: { min: 1200, max: 3000 },
    quirk: "inkPuff",
    quirkIntervalMs: { min: 7000, max: 14000 },
    quirkDurationMs: 1100,
    cursor: { reaction: "flee", radius: 7, speedMultiplier: 1.5 },
    scale: 0.62,
    bob: { amplitude: 0.3, periodMs: 3200 },
    coverKinds: ["rock", "ruin", "coral"],
    restsAt: "seabed",
    facesMovement: true,
  },
  // Patrulha uma região grande, sem nunca parar. Não liga para o cursor.
  shark: {
    guardianId: "shark",
    habitat: "wideRange",
    speed: 3.2,
    speedJitter: 0.15,
    pathStyle: "cruise",
    axisBias: 0.25,
    wanderRadius: 42,
    anchor: { x: 50, y: 30 },
    pauseMs: { min: 0, max: 200 },
    quirk: "rest",
    quirkIntervalMs: { min: 20000, max: 35000 },
    quirkDurationMs: 2500,
    cursor: { reaction: "ignore", radius: 0, speedMultiplier: 1 },
    scale: 0.9,
    bob: { amplitude: 0.5, periodMs: 5200 },
    facesMovement: true,
  },
  // Ancestral: nada devagar e descansa perto dos corais.
  "sea-turtle": {
    guardianId: "sea-turtle",
    habitat: "wideRange",
    speed: 0.8,
    speedJitter: 0.2,
    pathStyle: "cruise",
    axisBias: 0.3,
    wanderRadius: 30,
    anchor: { x: 32, y: 62 },
    pauseMs: { min: 2000, max: 5000 },
    quirk: "rest",
    quirkIntervalMs: { min: 12000, max: 22000 },
    quirkDurationMs: 6000,
    cursor: { reaction: "look", radius: 14, speedMultiplier: 1 },
    scale: 0.8,
    bob: { amplitude: 0.8, periodMs: 6000 },
    restsAt: "nearCoral",
    facesMovement: true,
  },
  // Emboscador: quase imóvel, meio enterrado na areia.
  stonefish: {
    guardianId: "stonefish",
    habitat: "seabed",
    speed: 0.3,
    speedJitter: 0.1,
    pathStyle: "hover",
    axisBias: 0.1,
    wanderRadius: 4,
    anchor: { x: 50, y: 90 },
    pauseMs: { min: 3000, max: 9000 },
    quirk: "burrow",
    quirkIntervalMs: { min: 9000, max: 18000 },
    quirkDurationMs: 4000,
    cursor: { reaction: "ignore", radius: 0, speedMultiplier: 1 },
    scale: 0.55,
    bob: { amplitude: 0.1, periodMs: 4000 },
    restsAt: "seabed",
    facesMovement: true,
  },
  // O mais ativo do Recife: atravessa tudo, brinca e vem ver quem chegou.
  dolphin: {
    guardianId: "dolphin",
    habitat: "wideRange",
    speed: 4,
    speedJitter: 0.3,
    pathStyle: "cruise",
    axisBias: 0.35,
    wanderRadius: 46,
    anchor: { x: 56, y: 34 },
    pauseMs: { min: 0, max: 150 },
    quirk: "play",
    quirkIntervalMs: { min: 2500, max: 5000 },
    quirkDurationMs: 1200,
    cursor: { reaction: "approach", radius: 22, speedMultiplier: 1.3 },
    scale: 0.92,
    bob: { amplitude: 1, periodMs: 3800 },
    facesMovement: true,
  },
};

/** Nunca lança: um Guardião sem perfil cadastrado ganha o comportamento padrão. */
export function hubBehavior(guardianId: string): HubBehaviorProfile {
  const profile = HUB_BEHAVIORS[guardianId as GuardianId];
  if (profile) return profile;
  return { ...DEFAULT_HUB_BEHAVIOR, guardianId: guardianId as GuardianId };
}
