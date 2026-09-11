import { RECIFE_ONE_BACKGROUND_KEY } from "../../assets/recifeOneAssets";
import type { LevelDefinition } from "../../types";
import { ECONOMY } from "../balance";

/**
 * Fase 1 — Recife Costeiro. Introduz comuns e rápidos; chefe no final.
 * Geometria alinhada ao fundo pintado (`background.png`).
 */
export const RECIFE_ONE: LevelDefinition = {
  id: "recife-1",
  name: "Recife Costeiro",
  subtitle: "Peixes invasores e o Quebra-Marés",
  backgroundKey: RECIFE_ONE_BACKGROUND_KEY,
  theme: { water: 0x0f6f92, sand: 0x7fb8c7, path: 0xa9e6f2, rock: 0x2f5468 },
  startingPearls: ECONOMY.startingPearls,
  reefHealth: ECONOMY.reefHealth,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  /** Fase de aprendizado: inimigos com 85% da vida de referência e 20% mais pérolas por abate. */
  enemyScaling: { health: 0.85, speed: 1, reward: 1.2 },
  /** Primeiro chefe: 400 de vida de base (340 após a escala) para que qualquer build razoável o derrube. */
  enemyOverrides: { tidebreaker: { maxHealth: 400 } },
  waypoints: [
    { x: -40, y: 315 },
    { x: 100, y: 310 },
    { x: 180, y: 320 },
    { x: 250, y: 368 },
    { x: 300, y: 385 },
    { x: 350, y: 390 },
    { x: 405, y: 385 },
    { x: 455, y: 366 },
    { x: 505, y: 325 },
    { x: 555, y: 288 },
    { x: 615, y: 255 },
    { x: 665, y: 252 },
    { x: 710, y: 263 },
    { x: 760, y: 291 },
    { x: 810, y: 342 },
    { x: 860, y: 372 },
    { x: 915, y: 386 },
    { x: 970, y: 386 },
    { x: 1015, y: 360 },
    { x: 1055, y: 320 },
    { x: 1110, y: 310 },
    { x: 1200, y: 315 },
    { x: 1325, y: 315 },
  ],
  placements: [
    { id: "anemona-norte", x: 375, y: 245 },
    { id: "estrela-sul", x: 500, y: 500 },
    { id: "concha-norte", x: 750, y: 135 },
    { id: "coral-cerebro-sul", x: 925, y: 500 },
  ],
  currents: [
    {
      id: "corrente-central",
      x: 475,
      y: 205,
      width: 390,
      height: 225,
      direction: { x: 1, y: 0.16 },
      speedModifier: 0.25,
      projectileDrift: 44,
    },
  ],
  waves: [
    {
      name: "Batedores",
      groups: [{ enemyId: "swimmer", count: 4, intervalMs: 1000, delayMs: 0 }],
    },
    {
      name: "Correria",
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 900, delayMs: 0 },
        { enemyId: "dartfish", count: 3, intervalMs: 1000, delayMs: 3000 },
      ],
    },
    {
      name: "Maré Dupla",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 850, delayMs: 0 },
        { enemyId: "dartfish", count: 4, intervalMs: 900, delayMs: 3500 },
      ],
    },
    {
      name: "Pressão",
      groups: [
        { enemyId: "dartfish", count: 6, intervalMs: 750, delayMs: 0 },
        { enemyId: "swimmer", count: 7, intervalMs: 850, delayMs: 3000 },
      ],
    },
    {
      name: "Quebra-Marés",
      groups: [
        { enemyId: "swimmer", count: 5, intervalMs: 900, delayMs: 0 },
        { enemyId: "dartfish", count: 3, intervalMs: 800, delayMs: 3500 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 8000 },
      ],
    },
  ],
};
