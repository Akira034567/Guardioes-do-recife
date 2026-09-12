import type { LevelDefinition } from "../../types";

/**
 * Encontro — Rede Fantasma (Tartaruga). Uma rede à deriva prendeu a Tartaruga em cima da correnteza.
 * Cortar a rede leva cinco golpes com fôlego entre eles; quando ela sai, a água vira contra os
 * invasores por alguns segundos — a demonstração do ramo Correnteza.
 */
export const REDE_FANTASMA: LevelDefinition = {
  id: "rede-fantasma",
  name: "Rede Fantasma",
  subtitle: "O que a maré trouxe não devia estar aqui",
  kind: "encounter",
  encounterId: "rede-fantasma",
  theme: { water: 0x0b4f63, sand: 0x74b0bd, path: 0xa5f0ff, rock: 0x27485c },
  startingPearls: 210,
  reefHealth: 10,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 9_000,
  enemyScaling: { health: 0.95, speed: 1.02, reward: 1.2 },
  waypoints: [
    { x: 640, y: -40 },
    { x: 640, y: 150 },
    { x: 640, y: 260 },
    { x: 610, y: 330 },
    { x: 520, y: 380 },
    { x: 400, y: 400 },
    { x: 300, y: 440 },
    { x: 280, y: 510 },
    { x: 360, y: 555 },
    { x: 520, y: 560 },
    { x: 700, y: 545 },
    { x: 860, y: 500 },
    { x: 960, y: 430 },
    { x: 1010, y: 340 },
    { x: 1040, y: 230 },
    { x: 1060, y: -40 },
  ],
  placements: [
    { id: "pedra-da-rede", x: 800, y: 300 },
    { id: "pedra-oeste", x: 180, y: 330 },
    { id: "pedra-do-laco", x: 420, y: 250 },
    { id: "pedra-do-sul", x: 140, y: 460 },
    { id: "pedra-leste", x: 880, y: 190 },
  ],
  currents: [
    {
      id: "arrasto-da-rede",
      x: 340,
      y: 520,
      width: 320,
      height: 80,
      direction: { x: 1, y: 0 },
      speedModifier: 0.28,
      projectileDrift: 30,
    },
  ],
  interactables: [
    {
      id: "rede",
      x: 700,
      y: 480,
      radius: 42,
      label: "Rede fantasma",
      goal: { type: "taps", taps: 5, cooldownMs: 900 },
      ally: { guardianId: "sea-turtle", x: 700, y: 545 },
      current: { x: 700, y: 545, radius: 190, speedFactor: 0.5, durationMs: 14_000 },
      messages: {
        idle: "Toque para cortar a rede.",
        progress: "A rede está cedendo…",
        done: "Livre. A água mudou de ideia.",
      },
    },
  ],
  waves: [
    {
      name: "Quem veio com a rede",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 850, delayMs: 0 },
        { enemyId: "minnow", count: 8, intervalMs: 280, delayMs: 3000 },
      ],
    },
    {
      name: "Arrasto",
      groups: [
        { enemyId: "dartfish", count: 5, intervalMs: 700, delayMs: 0 },
        { enemyId: "shellback", count: 2, intervalMs: 1800, delayMs: 2600 },
      ],
    },
    {
      name: "Maré de sucata",
      groups: [
        { enemyId: "minnow", count: 12, intervalMs: 240, delayMs: 0 },
        { enemyId: "swimmer", count: 6, intervalMs: 780, delayMs: 3000 },
        { enemyId: "shellback", count: 2, intervalMs: 1700, delayMs: 6000 },
      ],
    },
  ],
};
