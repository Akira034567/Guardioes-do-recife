import type { LevelDefinition } from "../types";

export const RECIFE_ONE: LevelDefinition = {
  id: "recife-1",
  name: "Recife Costeiro",
  startingPearls: 180,
  reefHealth: 20,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
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
