import type { LevelDefinition } from "../../types";
import { ECONOMY } from "../balance";

/**
 * Fase 2 — Canal das Algas. Entrada pela direita; introduz cardumes e Cascudos.
 */
export const RECIFE_TWO: LevelDefinition = {
  id: "recife-2",
  name: "Canal das Algas",
  subtitle: "Cardumes e os primeiros Cascudos",
  theme: { water: 0x0d6b62, sand: 0x8bbf9a, path: 0xb6ecd4, rock: 0x2c5546 },
  startingPearls: ECONOMY.startingPearls + 40,
  reefHealth: ECONOMY.reefHealth,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 0.85, speed: 1, reward: 1.2 },
  enemyOverrides: { tidebreaker: { maxHealth: 420 } },
  waypoints: [
    { x: 1320, y: 190 },
    { x: 1190, y: 195 },
    { x: 1080, y: 235 },
    { x: 990, y: 305 },
    { x: 910, y: 395 },
    { x: 800, y: 460 },
    { x: 670, y: 480 },
    { x: 550, y: 445 },
    { x: 460, y: 360 },
    { x: 380, y: 280 },
    { x: 270, y: 240 },
    { x: 160, y: 275 },
    { x: 80, y: 370 },
    { x: 20, y: 470 },
    { x: -40, y: 520 },
  ],
  placements: [
    { id: "pedra-leste", x: 1080, y: 385 },
    { id: "pedra-norte", x: 1140, y: 100 },
    { id: "pedra-central", x: 600, y: 340 },
    { id: "pedra-oeste", x: 250, y: 380 },
    { id: "pedra-sul", x: 920, y: 560 },
    { id: "pedra-alta", x: 420, y: 150 },
  ],
  currents: [
    {
      id: "canal-das-algas",
      x: 520,
      y: 380,
      width: 380,
      height: 140,
      direction: { x: -1, y: 0.05 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
  ],
  waves: [
    {
      name: "Reconhecimento",
      groups: [
        { enemyId: "swimmer", count: 5, intervalMs: 900, delayMs: 0 },
        { enemyId: "dartfish", count: 2, intervalMs: 900, delayMs: 3500 },
      ],
    },
    {
      name: "Cardume",
      groups: [
        { enemyId: "minnow", count: 8, intervalMs: 260, delayMs: 0 },
        { enemyId: "swimmer", count: 3, intervalMs: 900, delayMs: 3000 },
      ],
    },
    {
      name: "Cascos Duros",
      groups: [
        { enemyId: "shellback", count: 2, intervalMs: 1800, delayMs: 0 },
        { enemyId: "swimmer", count: 5, intervalMs: 800, delayMs: 1500 },
      ],
    },
    {
      name: "Enxurrada",
      groups: [
        { enemyId: "minnow", count: 8, intervalMs: 250, delayMs: 0 },
        { enemyId: "dartfish", count: 4, intervalMs: 700, delayMs: 2600 },
        { enemyId: "shellback", count: 2, intervalMs: 2000, delayMs: 5000 },
      ],
    },
    {
      name: "Maré Cheia",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 750, delayMs: 0 },
        { enemyId: "minnow", count: 8, intervalMs: 240, delayMs: 3000 },
        { enemyId: "dartfish", count: 4, intervalMs: 650, delayMs: 6500 },
      ],
    },
    {
      name: "Quebra-Marés Blindado",
      groups: [
        { enemyId: "shellback", count: 2, intervalMs: 1500, delayMs: 0 },
        { enemyId: "minnow", count: 8, intervalMs: 260, delayMs: 3000 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 7000 },
      ],
    },
  ],
};
