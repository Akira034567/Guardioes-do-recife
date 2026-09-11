import type { LevelDefinition } from "../../types";
import { ECONOMY } from "../balance";

/**
 * Fase 4 — Correntes Cruzadas. Grande U com uma corrente a favor e outra contra.
 * Elites em dupla e grupos escalonados.
 */
export const RECIFE_FOUR: LevelDefinition = {
  id: "recife-4",
  name: "Correntes Cruzadas",
  subtitle: "Uma corrente empurra, a outra segura",
  theme: { water: 0x1b4f7a, sand: 0x94a9b8, path: 0xc2dcef, rock: 0x35485c },
  startingPearls: ECONOMY.startingPearls + 120,
  reefHealth: ECONOMY.reefHealth,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 0.95, speed: 1.03, reward: 1.15 },
  enemyOverrides: { tidebreaker: { maxHealth: 550 } },
  waypoints: [
    { x: -40, y: 150 },
    { x: 140, y: 150 },
    { x: 280, y: 185 },
    { x: 390, y: 290 },
    { x: 420, y: 420 },
    { x: 500, y: 515 },
    { x: 640, y: 545 },
    { x: 790, y: 525 },
    { x: 910, y: 445 },
    { x: 970, y: 330 },
    { x: 1030, y: 225 },
    { x: 1150, y: 180 },
    { x: 1320, y: 185 },
  ],
  placements: [
    { id: "cruz-oeste", x: 240, y: 300 },
    { id: "cruz-fundo", x: 560, y: 400 },
    { id: "cruz-centro", x: 800, y: 390 },
    { id: "cruz-leste", x: 1120, y: 320 },
    { id: "cruz-alta", x: 540, y: 240 },
    { id: "cruz-sul", x: 1000, y: 520 },
  ],
  currents: [
    {
      id: "descida",
      x: 250,
      y: 160,
      width: 220,
      height: 290,
      direction: { x: 0.6, y: 1 },
      speedModifier: 0.3,
      projectileDrift: 46,
    },
    {
      id: "contra-maré",
      x: 880,
      y: 190,
      width: 180,
      height: 280,
      direction: { x: -0.5, y: 1 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
  ],
  waves: [
    {
      name: "Patrulha",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 750, delayMs: 0 },
        { enemyId: "needlefish", count: 3, intervalMs: 700, delayMs: 3500 },
      ],
    },
    {
      name: "Nuvem de Peixinhos",
      groups: [
        { enemyId: "minnow", count: 12, intervalMs: 220, delayMs: 0 },
        { enemyId: "shellback", count: 1, intervalMs: 1800, delayMs: 2000 },
      ],
    },
    {
      name: "Escolta",
      groups: [
        { enemyId: "shellback", count: 2, intervalMs: 1500, delayMs: 0 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 2500 },
        { enemyId: "dartfish", count: 4, intervalMs: 600, delayMs: 4000 },
      ],
    },
    {
      name: "Velocidade Máxima",
      groups: [
        { enemyId: "needlefish", count: 7, intervalMs: 500, delayMs: 0 },
        { enemyId: "dartfish", count: 5, intervalMs: 600, delayMs: 2500 },
      ],
    },
    {
      name: "Parede Blindada",
      groups: [
        { enemyId: "shellback", count: 4, intervalMs: 1300, delayMs: 0 },
        { enemyId: "minnow", count: 8, intervalMs: 240, delayMs: 3000 },
      ],
    },
    {
      name: "Moreias Gêmeas",
      groups: [
        { enemyId: "moray", count: 2, intervalMs: 1200, delayMs: 0 },
        { enemyId: "swimmer", count: 6, intervalMs: 700, delayMs: 2000 },
        { enemyId: "needlefish", count: 4, intervalMs: 600, delayMs: 6000 },
      ],
    },
    {
      name: "Quebra-Marés Cruzado",
      groups: [
        { enemyId: "shellback", count: 3, intervalMs: 1400, delayMs: 0 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 4000 },
        { enemyId: "minnow", count: 8, intervalMs: 230, delayMs: 7000 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 10000 },
      ],
    },
  ],
};
