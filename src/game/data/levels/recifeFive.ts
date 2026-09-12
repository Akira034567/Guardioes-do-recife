import { LEVEL_BACKGROUND_KEYS } from "../../assets/levelBackgrounds";
import type { LevelDefinition } from "../../types";
import { ECONOMY } from "../balance";

/**
 * Fase 5 — Naufrágio do Galeão. Rota curta e diagonal que atravessa o casco
 * partido: pouco tempo de tiro, então cada plataforma conta. Dois chefes (meio e
 * fim) e todos os tipos de inimigos misturados.
 * Geometria alinhada ao fundo pintado (`recife-five/background.png`). Os pontos
 * sob o navio seguem em linha reta porque o canal fica escondido pelo casco.
 */
export const RECIFE_FIVE: LevelDefinition = {
  id: "recife-5",
  name: "Naufrágio do Galeão",
  subtitle: "Rota curta, pressão máxima",
  backgroundKey: LEVEL_BACKGROUND_KEYS["recife-5"],
  theme: { water: 0x0f5a7d, sand: 0x8aa9a0, path: 0xb8f4ff, rock: 0x5a4630 },
  startingPearls: ECONOMY.startingPearls + 160,
  reefHealth: ECONOMY.reefHealth,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 0.95, speed: 1.05, reward: 1.2 },
  enemyOverrides: { tidebreaker: { maxHealth: 550 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 10 },
    { id: "poucos", kind: "maxGuardians", value: 6 },
  ],
  waypoints: [
    { x: 243, y: -30 },
    { x: 255, y: 20 },
    { x: 246, y: 71 },
    { x: 249, y: 94 },
    { x: 319, y: 153 },
    { x: 374, y: 158 },
    { x: 458, y: 152 },
    { x: 500, y: 185 },
    { x: 550, y: 215 },
    { x: 600, y: 260 },
    { x: 650, y: 310 },
    { x: 700, y: 355 },
    { x: 740, y: 415 },
    { x: 785, y: 436 },
    { x: 830, y: 480 },
    { x: 900, y: 492 },
    { x: 970, y: 494 },
    { x: 1030, y: 514 },
    { x: 1067, y: 545 },
    { x: 1077, y: 559 },
    { x: 1063, y: 604 },
    { x: 1075, y: 656 },
    { x: 1072, y: 692 },
  ],
  placements: [
    { id: "pedra-noroeste", x: 210, y: 190 },
    { id: "pedra-norte", x: 595, y: 135 },
    { id: "proa", x: 400, y: 250 },
    { id: "popa", x: 615, y: 400 },
    { id: "pedra-leste", x: 865, y: 385 },
    { id: "pedra-sudeste", x: 1065, y: 420 },
  ],
  currents: [
    {
      id: "correnteza-alta",
      x: 290,
      y: 115,
      width: 180,
      height: 80,
      direction: { x: 1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 44,
    },
    {
      id: "vala-do-naufragio",
      x: 800,
      y: 450,
      width: 200,
      height: 80,
      direction: { x: 1, y: 0.1 },
      speedModifier: 0.3,
      projectileDrift: 50,
    },
  ],
  waves: [
    {
      name: "Prelúdio",
      groups: [
        { enemyId: "swimmer", count: 5, intervalMs: 800, delayMs: 0 },
        { enemyId: "minnow", count: 6, intervalMs: 260, delayMs: 3500 },
        { enemyId: "dartfish", count: 2, intervalMs: 700, delayMs: 7000 },
      ],
    },
    {
      name: "Agulhas e Moreia",
      groups: [
        { enemyId: "needlefish", count: 4, intervalMs: 650, delayMs: 0 },
        { enemyId: "shellback", count: 2, intervalMs: 1600, delayMs: 3000 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 6000 },
      ],
    },
    {
      name: "Blindagem Pesada",
      groups: [
        { enemyId: "shellback", count: 3, intervalMs: 1300, delayMs: 0 },
        { enemyId: "minnow", count: 8, intervalMs: 230, delayMs: 3000 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 7000 },
      ],
    },
    {
      name: "Primeiro Quebra-Marés",
      groups: [
        { enemyId: "dartfish", count: 5, intervalMs: 650, delayMs: 0 },
        { enemyId: "needlefish", count: 3, intervalMs: 650, delayMs: 4000 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 8000 },
      ],
    },
    {
      name: "Cardume Infinito",
      groups: [
        { enemyId: "minnow", count: 14, intervalMs: 210, delayMs: 0 },
        { enemyId: "swimmer", count: 5, intervalMs: 700, delayMs: 2000 },
        { enemyId: "shellback", count: 2, intervalMs: 1500, delayMs: 6000 },
      ],
    },
    {
      name: "Três Moreias",
      groups: [
        { enemyId: "moray", count: 2, intervalMs: 4000, delayMs: 0 },
        { enemyId: "needlefish", count: 5, intervalMs: 600, delayMs: 1500 },
        { enemyId: "shellback", count: 3, intervalMs: 1400, delayMs: 6000 },
      ],
    },
    {
      name: "Tempestade",
      groups: [
        { enemyId: "dartfish", count: 7, intervalMs: 550, delayMs: 0 },
        { enemyId: "minnow", count: 10, intervalMs: 220, delayMs: 2000 },
        { enemyId: "shellback", count: 3, intervalMs: 1400, delayMs: 4500 },
        { enemyId: "moray", count: 1, intervalMs: 3000, delayMs: 9000 },
      ],
    },
    {
      name: "Quebra-Marés do Galeão",
      groups: [
        { enemyId: "moray", count: 2, intervalMs: 2500, delayMs: 0 },
        { enemyId: "shellback", count: 3, intervalMs: 1300, delayMs: 4000 },
        { enemyId: "needlefish", count: 5, intervalMs: 550, delayMs: 8000 },
        { enemyId: "minnow", count: 8, intervalMs: 220, delayMs: 11000 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 14000 },
      ],
    },
  ],
};
