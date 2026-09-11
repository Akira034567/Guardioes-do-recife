import type { LevelDefinition } from "../../types";
import { ECONOMY } from "../balance";

/**
 * Fase 5 — Coração do Recife. Rota longa e sinuosa, dois chefes (meio e fim),
 * todos os tipos de inimigos misturados.
 */
export const RECIFE_FIVE: LevelDefinition = {
  id: "recife-5",
  name: "Coração do Recife",
  subtitle: "Tudo o que o mar tem para dar",
  theme: { water: 0x5b1f4a, sand: 0xb08aa3, path: 0xf0c7e0, rock: 0x43284a },
  startingPearls: ECONOMY.startingPearls + 160,
  reefHealth: ECONOMY.reefHealth,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1, speed: 1.05, reward: 1.1 },
  enemyOverrides: { tidebreaker: { maxHealth: 550 } },
  waypoints: [
    { x: -40, y: 540 },
    { x: 120, y: 540 },
    { x: 230, y: 480 },
    { x: 290, y: 370 },
    { x: 260, y: 260 },
    { x: 330, y: 170 },
    { x: 470, y: 150 },
    { x: 590, y: 215 },
    { x: 630, y: 330 },
    { x: 700, y: 430 },
    { x: 840, y: 470 },
    { x: 960, y: 410 },
    { x: 1010, y: 300 },
    { x: 1090, y: 205 },
    { x: 1200, y: 170 },
    { x: 1320, y: 170 },
  ],
  placements: [
    { id: "coracao-oeste", x: 120, y: 400 },
    { id: "coracao-norte", x: 420, y: 290 },
    { id: "coracao-centro", x: 500, y: 420 },
    { id: "coracao-leste", x: 780, y: 300 },
    { id: "coracao-alto", x: 1140, y: 330 },
    { id: "coracao-sul", x: 900, y: 560 },
  ],
  currents: [
    {
      id: "corrente-do-topo",
      x: 320,
      y: 120,
      width: 300,
      height: 140,
      direction: { x: 1, y: 0.15 },
      speedModifier: 0.25,
      projectileDrift: 44,
    },
    {
      id: "corrente-do-fundo",
      x: 680,
      y: 380,
      width: 310,
      height: 120,
      direction: { x: 1, y: -0.2 },
      speedModifier: 0.3,
      projectileDrift: 50,
    },
  ],
  waves: [
    {
      name: "Prelúdio",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 700, delayMs: 0 },
        { enemyId: "minnow", count: 8, intervalMs: 230, delayMs: 3000 },
        { enemyId: "dartfish", count: 3, intervalMs: 650, delayMs: 6500 },
      ],
    },
    {
      name: "Agulhas e Moreia",
      groups: [
        { enemyId: "needlefish", count: 6, intervalMs: 550, delayMs: 0 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 3000 },
        { enemyId: "shellback", count: 2, intervalMs: 1500, delayMs: 5000 },
      ],
    },
    {
      name: "Blindagem Pesada",
      groups: [
        { enemyId: "shellback", count: 4, intervalMs: 1200, delayMs: 0 },
        { enemyId: "minnow", count: 10, intervalMs: 220, delayMs: 2500 },
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 7000 },
      ],
    },
    {
      name: "Primeiro Quebra-Marés",
      groups: [
        { enemyId: "dartfish", count: 6, intervalMs: 600, delayMs: 0 },
        { enemyId: "needlefish", count: 4, intervalMs: 600, delayMs: 4000 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 8000 },
      ],
    },
    {
      name: "Cardume Infinito",
      groups: [
        { enemyId: "minnow", count: 16, intervalMs: 200, delayMs: 0 },
        { enemyId: "swimmer", count: 6, intervalMs: 650, delayMs: 2000 },
        { enemyId: "shellback", count: 2, intervalMs: 1500, delayMs: 6000 },
      ],
    },
    {
      name: "Três Moreias",
      groups: [
        { enemyId: "moray", count: 2, intervalMs: 3500, delayMs: 0 },
        { enemyId: "needlefish", count: 6, intervalMs: 550, delayMs: 1500 },
        { enemyId: "shellback", count: 3, intervalMs: 1400, delayMs: 6000 },
      ],
    },
    {
      name: "Tempestade",
      groups: [
        { enemyId: "dartfish", count: 8, intervalMs: 500, delayMs: 0 },
        { enemyId: "minnow", count: 12, intervalMs: 210, delayMs: 2000 },
        { enemyId: "shellback", count: 4, intervalMs: 1300, delayMs: 4500 },
        { enemyId: "moray", count: 1, intervalMs: 3000, delayMs: 9000 },
      ],
    },
    {
      name: "Coração do Recife",
      groups: [
        { enemyId: "moray", count: 2, intervalMs: 2000, delayMs: 0 },
        { enemyId: "shellback", count: 3, intervalMs: 1300, delayMs: 4000 },
        { enemyId: "needlefish", count: 6, intervalMs: 500, delayMs: 8000 },
        { enemyId: "minnow", count: 8, intervalMs: 220, delayMs: 11000 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 14000 },
      ],
    },
  ],
};
