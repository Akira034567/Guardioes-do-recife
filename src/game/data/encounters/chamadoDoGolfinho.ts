import type { LevelDefinition } from "../../types";

/**
 * Encontro — O Chamado (Golfinho). O sino do galeão afundado ainda toca quando alguém fica perto.
 * Manter um Guardião ao lado dele durante a segunda maré é o que traz o Golfinho de volta.
 */
export const CHAMADO_DO_GOLFINHO: LevelDefinition = {
  id: "chamado-do-golfinho",
  name: "O Chamado",
  subtitle: "O sino do galeão ainda responde",
  kind: "encounter",
  encounterId: "chamado-do-golfinho",
  theme: { water: 0x08405a, sand: 0x6ea6b6, path: 0x8fe4f5, rock: 0x223f55 },
  startingPearls: 230,
  reefHealth: 10,
  initialWaveDelayMs: 13_000,
  betweenWaveDelayMs: 9_500,
  enemyScaling: { health: 1.05, speed: 1.05, reward: 1.25 },
  waypoints: [
    { x: -40, y: 470 },
    { x: 180, y: 470 },
    { x: 340, y: 440 },
    { x: 440, y: 360 },
    { x: 520, y: 270 },
    { x: 640, y: 220 },
    { x: 780, y: 240 },
    { x: 880, y: 320 },
    { x: 960, y: 420 },
    { x: 1080, y: 470 },
    { x: 1320, y: 470 },
  ],
  placements: [
    { id: "convés-oeste", x: 300, y: 250 },
    { id: "mastro", x: 560, y: 430 },
    { id: "proa", x: 760, y: 430 },
    { id: "convés-leste", x: 1000, y: 250 },
    { id: "popa", x: 150, y: 300 },
  ],
  currents: [
    {
      id: "ressaca-do-casco",
      x: 560,
      y: 190,
      width: 260,
      height: 76,
      direction: { x: 1, y: 0 },
      speedModifier: 0.26,
      projectileDrift: 32,
    },
  ],
  interactables: [
    {
      id: "sino",
      x: 640,
      y: 540,
      radius: 40,
      label: "Sino do galeão",
      availableFromWave: 2,
      goal: { type: "guardNearby", radius: 160, durationMs: 8000 },
      ally: { guardianId: "dolphin", x: 640, y: 480 },
      messages: {
        idle: "Só toca com alguém por perto, e só na segunda maré.",
        progress: "O eco está indo longe…",
        done: "Alguém respondeu.",
      },
    },
  ],
  waves: [
    {
      name: "Primeira maré",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 820, delayMs: 0 },
        { enemyId: "dartfish", count: 4, intervalMs: 750, delayMs: 3000 },
      ],
    },
    {
      name: "Segunda maré",
      groups: [
        { enemyId: "needlefish", count: 5, intervalMs: 650, delayMs: 0 },
        { enemyId: "minnow", count: 10, intervalMs: 250, delayMs: 2600 },
        { enemyId: "shellback", count: 2, intervalMs: 1800, delayMs: 5200 },
      ],
    },
    {
      name: "O que veio com o eco",
      groups: [
        { enemyId: "moray", count: 1, intervalMs: 1000, delayMs: 0 },
        { enemyId: "swimmer", count: 6, intervalMs: 780, delayMs: 2200 },
        { enemyId: "needlefish", count: 5, intervalMs: 650, delayMs: 5400 },
      ],
    },
  ],
};
