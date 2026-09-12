import { LEVEL_BACKGROUND_KEYS } from "../../assets/levelBackgrounds";
import type { LevelDefinition } from "../../types";
import { ECONOMY } from "../balance";

/**
 * Fase 6 — Coração do Recife. Entrada por cima, laço em volta do galeão
 * encalhado e saída pelo fundo à direita. Final da campanha: nove ondas, três
 * Quebra-Marés (um no meio, dois no fim) e todos os inimigos com vida extra.
 * Geometria alinhada ao fundo pintado (`recife-six/background.png`).
 */
export const RECIFE_SIX: LevelDefinition = {
  id: "recife-6",
  name: "Coração do Recife",
  subtitle: "Tudo o que o mar tem para dar",
  backgroundKey: LEVEL_BACKGROUND_KEYS["recife-6"],
  theme: { water: 0x0b4f78, sand: 0x86a9b0, path: 0xaef0ff, rock: 0x4a3d2c },
  startingPearls: ECONOMY.startingPearls + 160,
  reefHealth: ECONOMY.reefHealth,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1, speed: 1.05, reward: 1.2 },
  enemyOverrides: { tidebreaker: { maxHealth: 600 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 8 },
    { id: "especies", kind: "maxDistinctGuardians", value: 3 },
  ],
  waypoints: [
    { x: 607, y: -19 },
    { x: 607, y: 21 },
    { x: 607, y: 71 },
    { x: 607, y: 131 },
    { x: 613, y: 163 },
    { x: 550, y: 214 },
    { x: 497, y: 204 },
    { x: 432, y: 187 },
    { x: 360, y: 183 },
    { x: 308, y: 207 },
    { x: 286, y: 244 },
    { x: 279, y: 269 },
    { x: 297, y: 296 },
    { x: 329, y: 316 },
    { x: 401, y: 336 },
    { x: 474, y: 341 },
    { x: 572, y: 345 },
    { x: 648, y: 351 },
    { x: 734, y: 366 },
    { x: 802, y: 366 },
    { x: 873, y: 334 },
    { x: 940, y: 324 },
    { x: 990, y: 342 },
    { x: 1018, y: 371 },
    { x: 1030, y: 406 },
    { x: 1014, y: 453 },
    { x: 953, y: 492 },
    { x: 865, y: 493 },
    { x: 836, y: 512 },
    { x: 832, y: 561 },
    { x: 830, y: 611 },
    { x: 830, y: 655 },
    { x: 830, y: 681 },
  ],
  placements: [
    { id: "pedra-noroeste", x: 200, y: 211 },
    { id: "mastro", x: 715, y: 165 },
    { id: "conves", x: 760, y: 270 },
    { id: "pedra-nordeste", x: 885, y: 240 },
    { id: "pedra-leste", x: 1080, y: 301 },
    { id: "pedra-oeste", x: 240, y: 366 },
    { id: "pedra-sul", x: 440, y: 435 },
    { id: "casco", x: 690, y: 470 },
  ],
  currents: [
    {
      id: "conves",
      x: 330,
      y: 156,
      width: 240,
      height: 70,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 44,
    },
    {
      id: "quilha",
      x: 380,
      y: 306,
      width: 340,
      height: 80,
      direction: { x: 1, y: 0 },
      speedModifier: 0.3,
      projectileDrift: 50,
    },
  ],
  waves: [
    {
      name: "Maré de Abertura",
      groups: [
        { enemyId: "swimmer", count: 5, intervalMs: 750, delayMs: 0 },
        { enemyId: "minnow", count: 6, intervalMs: 260, delayMs: 3000 },
        { enemyId: "dartfish", count: 2, intervalMs: 650, delayMs: 6500 },
      ],
    },
    {
      name: "Agulhas do Casco",
      groups: [
        { enemyId: "needlefish", count: 5, intervalMs: 600, delayMs: 0 },
        { enemyId: "shellback", count: 2, intervalMs: 1600, delayMs: 3000 },
      ],
    },
    {
      name: "Moreia do Porão",
      groups: [
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 0 },
        { enemyId: "minnow", count: 8, intervalMs: 240, delayMs: 2000 },
        { enemyId: "dartfish", count: 3, intervalMs: 650, delayMs: 6000 },
      ],
    },
    {
      name: "Blindagem",
      groups: [
        { enemyId: "shellback", count: 4, intervalMs: 1200, delayMs: 0 },
        { enemyId: "needlefish", count: 4, intervalMs: 600, delayMs: 3000 },
      ],
    },
    {
      name: "Primeiro Quebra-Marés",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 600, delayMs: 0 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 5000 },
        { enemyId: "minnow", count: 8, intervalMs: 240, delayMs: 9000 },
      ],
    },
    {
      name: "Cardume do Naufrágio",
      groups: [
        { enemyId: "minnow", count: 12, intervalMs: 220, delayMs: 0 },
        { enemyId: "dartfish", count: 5, intervalMs: 550, delayMs: 2000 },
        { enemyId: "shellback", count: 3, intervalMs: 1400, delayMs: 6000 },
      ],
    },
    {
      name: "Moreias Gêmeas",
      groups: [
        { enemyId: "moray", count: 2, intervalMs: 4000, delayMs: 0 },
        { enemyId: "needlefish", count: 6, intervalMs: 500, delayMs: 2000 },
        { enemyId: "shellback", count: 3, intervalMs: 1300, delayMs: 7000 },
      ],
    },
    {
      name: "Tempestade",
      groups: [
        { enemyId: "dartfish", count: 8, intervalMs: 450, delayMs: 0 },
        { enemyId: "minnow", count: 10, intervalMs: 230, delayMs: 2000 },
        { enemyId: "shellback", count: 4, intervalMs: 1200, delayMs: 4000 },
        { enemyId: "moray", count: 2, intervalMs: 3000, delayMs: 9000 },
      ],
    },
    {
      name: "Coração do Recife",
      groups: [
        { enemyId: "moray", count: 2, intervalMs: 2500, delayMs: 0 },
        { enemyId: "shellback", count: 4, intervalMs: 1200, delayMs: 4000 },
        { enemyId: "needlefish", count: 6, intervalMs: 500, delayMs: 8000 },
        { enemyId: "tidebreaker", count: 2, intervalMs: 8000, delayMs: 11000 },
        { enemyId: "minnow", count: 8, intervalMs: 230, delayMs: 14000 },
      ],
    },
  ],
};
