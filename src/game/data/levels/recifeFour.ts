import { LEVEL_BACKGROUND_KEYS } from "../../assets/levelBackgrounds";
import type { LevelDefinition } from "../../types";
import { ECONOMY } from "../balance";

/**
 * Fase 4 — Espiral de Coral. Entrada por cima; a rota enrola a ilha central,
 * dá meia-volta e sai pelo arco externo até o fundo. Uma corrente empurra no
 * arco de cima e outra segura no fundo da espiral.
 * Geometria alinhada ao fundo pintado (`recife-four/background.png`).
 */
export const RECIFE_FOUR: LevelDefinition = {
  id: "recife-4",
  name: "Espiral de Coral",
  subtitle: "Uma corrente empurra, a outra segura",
  backgroundKey: LEVEL_BACKGROUND_KEYS["recife-4"],
  theme: { water: 0x115f8f, sand: 0x86b6c6, path: 0xb0f2ff, rock: 0x2c4a63 },
  startingPearls: ECONOMY.startingPearls + 120,
  reefHealth: ECONOMY.reefHealth,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 0.95, speed: 1.06, reward: 1.1 },
  enemyOverrides: { tidebreaker: { maxHealth: 550 } },
  waypoints: [
    { x: 428, y: -20 },
    { x: 428, y: 20 },
    { x: 428, y: 70 },
    { x: 428, y: 130 },
    { x: 408, y: 169 },
    { x: 369, y: 190 },
    { x: 320, y: 223 },
    { x: 292, y: 270 },
    { x: 292, y: 308 },
    { x: 302, y: 347 },
    { x: 342, y: 388 },
    { x: 413, y: 409 },
    { x: 475, y: 419 },
    { x: 550, y: 435 },
    { x: 625, y: 438 },
    { x: 673, y: 427 },
    { x: 718, y: 393 },
    { x: 734, y: 317 },
    { x: 708, y: 282 },
    { x: 658, y: 253 },
    { x: 622, y: 245 },
    { x: 554, y: 229 },
    { x: 537, y: 214 },
    { x: 538, y: 170 },
    { x: 561, y: 155 },
    { x: 620, y: 155 },
    { x: 684, y: 165 },
    { x: 750, y: 184 },
    { x: 817, y: 216 },
    { x: 876, y: 264 },
    { x: 914, y: 321 },
    { x: 924, y: 388 },
    { x: 899, y: 453 },
    { x: 834, y: 498 },
    { x: 760, y: 518 },
    { x: 690, y: 532 },
    { x: 633, y: 562 },
    { x: 622, y: 610 },
    { x: 617, y: 656 },
    { x: 614, y: 692 },
  ],
  placements: [
    { id: "ilha-central", x: 565, y: 335 },
    { id: "pedra-oeste", x: 150, y: 235 },
    { id: "pedra-norte", x: 920, y: 115 },
    { id: "pedra-leste", x: 1060, y: 300 },
    { id: "pedra-sudoeste", x: 380, y: 530 },
    { id: "pedra-sudeste", x: 965, y: 555 },
  ],
  currents: [
    {
      id: "arco-de-cima",
      x: 590,
      y: 120,
      width: 210,
      height: 80,
      direction: { x: 1, y: 0.25 },
      speedModifier: 0.3,
      projectileDrift: 46,
    },
    {
      id: "contra-maré",
      x: 380,
      y: 395,
      width: 270,
      height: 75,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
  ],
  waves: [
    {
      name: "Patrulha",
      groups: [
        { enemyId: "swimmer", count: 7, intervalMs: 720, delayMs: 0 },
        { enemyId: "needlefish", count: 4, intervalMs: 700, delayMs: 3500 },
      ],
    },
    {
      name: "Nuvem de Peixinhos",
      groups: [
        { enemyId: "minnow", count: 14, intervalMs: 210, delayMs: 0 },
        { enemyId: "shellback", count: 2, intervalMs: 1800, delayMs: 2000 },
      ],
    },
    {
      name: "Escolta",
      groups: [
        { enemyId: "shellback", count: 3, intervalMs: 1500, delayMs: 0 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 2500 },
        { enemyId: "dartfish", count: 5, intervalMs: 600, delayMs: 4000 },
      ],
    },
    {
      name: "Velocidade Máxima",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 500, delayMs: 0 },
        { enemyId: "dartfish", count: 6, intervalMs: 600, delayMs: 2500 },
      ],
    },
    {
      name: "Parede Blindada",
      groups: [
        { enemyId: "shellback", count: 5, intervalMs: 1300, delayMs: 0 },
        { enemyId: "minnow", count: 10, intervalMs: 230, delayMs: 3000 },
      ],
    },
    {
      name: "Moreias Gêmeas",
      groups: [
        { enemyId: "moray", count: 2, intervalMs: 1200, delayMs: 0 },
        { enemyId: "swimmer", count: 7, intervalMs: 700, delayMs: 2000 },
        { enemyId: "needlefish", count: 5, intervalMs: 600, delayMs: 6000 },
      ],
    },
    {
      name: "Quebra-Marés da Espiral",
      groups: [
        { enemyId: "shellback", count: 4, intervalMs: 1400, delayMs: 0 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 4000 },
        { enemyId: "minnow", count: 10, intervalMs: 230, delayMs: 7000 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 10000 },
      ],
    },
  ],
};
