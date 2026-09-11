import type { LevelDefinition } from "../../types";
import { ECONOMY } from "../balance";

/**
 * Fase 3 — Gruta Profunda. Entrada por cima, saída pela esquerda; duas correntes.
 * Introduz o Peixe-Agulha (muito rápido) e a Moreia Sombria (elite).
 */
export const RECIFE_THREE: LevelDefinition = {
  id: "recife-3",
  name: "Gruta Profunda",
  subtitle: "Peixes-Agulha e a Moreia Sombria",
  theme: { water: 0x143a6b, sand: 0x6f8fb5, path: 0xa7c9f0, rock: 0x243a5c },
  startingPearls: ECONOMY.startingPearls + 80,
  reefHealth: ECONOMY.reefHealth,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 0.9, speed: 1, reward: 1.15 },
  enemyOverrides: { tidebreaker: { maxHealth: 480 } },
  waypoints: [
    { x: 180, y: 30 },
    { x: 180, y: 140 },
    { x: 240, y: 220 },
    { x: 360, y: 250 },
    { x: 520, y: 225 },
    { x: 660, y: 170 },
    { x: 820, y: 165 },
    { x: 960, y: 230 },
    { x: 1010, y: 340 },
    { x: 940, y: 440 },
    { x: 800, y: 495 },
    { x: 640, y: 510 },
    { x: 470, y: 500 },
    { x: 330, y: 530 },
    { x: 200, y: 560 },
    { x: 60, y: 540 },
    { x: -40, y: 540 },
  ],
  placements: [
    { id: "gruta-entrada", x: 60, y: 200 },
    { id: "gruta-norte", x: 420, y: 120 },
    { id: "gruta-centro", x: 760, y: 300 },
    { id: "gruta-leste", x: 1150, y: 420 },
    { id: "gruta-meio", x: 560, y: 390 },
    { id: "gruta-sul", x: 1040, y: 560 },
  ],
  currents: [
    {
      id: "corrente-alta",
      x: 520,
      y: 100,
      width: 340,
      height: 160,
      direction: { x: 1, y: -0.1 },
      speedModifier: 0.25,
      projectileDrift: 42,
    },
    {
      id: "corrente-baixa",
      x: 440,
      y: 430,
      width: 390,
      height: 130,
      direction: { x: -1, y: 0 },
      speedModifier: 0.3,
      projectileDrift: 48,
    },
  ],
  waves: [
    {
      name: "Sondagem",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 800, delayMs: 0 },
        { enemyId: "dartfish", count: 3, intervalMs: 800, delayMs: 3000 },
      ],
    },
    {
      name: "Agulhas",
      groups: [
        { enemyId: "needlefish", count: 4, intervalMs: 700, delayMs: 0 },
        { enemyId: "minnow", count: 8, intervalMs: 250, delayMs: 3000 },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "shellback", count: 3, intervalMs: 1600, delayMs: 0 },
        { enemyId: "swimmer", count: 4, intervalMs: 800, delayMs: 2000 },
      ],
    },
    {
      name: "A Moreia",
      groups: [
        { enemyId: "minnow", count: 8, intervalMs: 240, delayMs: 0 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 3500 },
        { enemyId: "dartfish", count: 3, intervalMs: 700, delayMs: 5000 },
      ],
    },
    {
      name: "Agulhas e Cascos",
      groups: [
        { enemyId: "needlefish", count: 6, intervalMs: 600, delayMs: 0 },
        { enemyId: "shellback", count: 2, intervalMs: 1700, delayMs: 2500 },
      ],
    },
    {
      name: "Duas Moreias",
      groups: [
        { enemyId: "moray", count: 2, intervalMs: 4500, delayMs: 0 },
        { enemyId: "swimmer", count: 5, intervalMs: 750, delayMs: 1500 },
        { enemyId: "needlefish", count: 3, intervalMs: 650, delayMs: 7000 },
      ],
    },
    {
      name: "Quebra-Marés da Gruta",
      groups: [
        { enemyId: "shellback", count: 2, intervalMs: 1500, delayMs: 0 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 4000 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 8000 },
      ],
    },
  ],
};
