import type { LevelDefinition } from "../types";

export const RECIFE_ONE: LevelDefinition = {
  id: "recife-1",
  name: "Recife Costeiro",
  startingPearls: 180,
  reefHealth: 20,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  waypoints: [
    { x: -40, y: 362 },
    { x: 155, y: 355 },
    { x: 250, y: 425 },
    { x: 420, y: 430 },
    { x: 505, y: 330 },
    { x: 615, y: 260 },
    { x: 775, y: 280 },
    { x: 855, y: 390 },
    { x: 1020, y: 420 },
    { x: 1110, y: 330 },
    { x: 1325, y: 324 },
  ],
  placements: [
    { id: "coral-norte", x: 330, y: 205 },
    { id: "enseada-sul", x: 490, y: 535 },
    { id: "ruina-norte", x: 785, y: 155 },
    { id: "farol-sul", x: 1010, y: 535 },
  ],
  currents: [
    {
      id: "corrente-central",
      x: 560,
      y: 218,
      width: 245,
      height: 150,
      direction: { x: 1, y: 0.16 },
      speedModifier: 0.25,
      projectileDrift: 44,
    },
  ],
  waves: [
    {
      name: "Batedores",
      groups: [{ enemyId: "swimmer", count: 8, intervalMs: 920, delayMs: 0 }],
    },
    {
      name: "Correria",
      groups: [
        { enemyId: "swimmer", count: 8, intervalMs: 850, delayMs: 0 },
        { enemyId: "dartfish", count: 5, intervalMs: 1100, delayMs: 2300 },
      ],
    },
    {
      name: "Cascos Duros",
      groups: [
        { enemyId: "shellback", count: 5, intervalMs: 1500, delayMs: 0 },
        { enemyId: "swimmer", count: 8, intervalMs: 800, delayMs: 1600 },
      ],
    },
    {
      name: "Maré Cheia",
      groups: [
        { enemyId: "dartfish", count: 10, intervalMs: 650, delayMs: 0 },
        { enemyId: "shellback", count: 5, intervalMs: 1350, delayMs: 2200 },
        { enemyId: "swimmer", count: 7, intervalMs: 800, delayMs: 4100 },
      ],
    },
    {
      name: "Quebra-Marés",
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 1, delayMs: 0 },
        { enemyId: "swimmer", count: 10, intervalMs: 850, delayMs: 1000 },
        { enemyId: "dartfish", count: 8, intervalMs: 900, delayMs: 3800 },
      ],
    },
  ],
};
