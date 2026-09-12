import type { LevelDefinition } from "../../types";

/**
 * Encontro — A Gruta do Predador (Tubarão). Fase curta, fora da campanha: o Tubarão está ferido numa
 * gruta do lado de fora do Canal das Algas. Para tirá-lo de lá, alguém precisa ficar de guarda perto
 * da entrada enquanto a maré passa. É um custo real: um Guardião fora da linha de defesa.
 */
export const GRUTA_DO_PREDADOR: LevelDefinition = {
  id: "gruta-do-predador",
  name: "A Gruta do Predador",
  subtitle: "Alguma coisa grande respira no fundo da fenda",
  kind: "encounter",
  encounterId: "gruta-do-predador",
  theme: { water: 0x0a4359, sand: 0x6ea3b4, path: 0x93e6f7, rock: 0x24455c },
  startingPearls: 200,
  reefHealth: 10,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 9_000,
  enemyScaling: { health: 0.9, speed: 1, reward: 1.2 },
  waypoints: [
    { x: -40, y: 330 },
    { x: 120, y: 330 },
    { x: 260, y: 345 },
    { x: 380, y: 395 },
    { x: 520, y: 430 },
    { x: 660, y: 430 },
    { x: 800, y: 400 },
    { x: 920, y: 350 },
    { x: 1060, y: 330 },
    { x: 1320, y: 330 },
  ],
  placements: [
    { id: "pedra-da-entrada", x: 220, y: 200 },
    { id: "pedra-do-desvio", x: 460, y: 260 },
    { id: "pedra-alta", x: 700, y: 290 },
    { id: "pedra-do-canal", x: 940, y: 215 },
    { id: "pedra-da-gruta", x: 560, y: 560 },
  ],
  currents: [
    {
      id: "corrente-da-fenda",
      x: 500,
      y: 392,
      width: 220,
      height: 76,
      direction: { x: 1, y: 0 },
      speedModifier: 0.22,
      projectileDrift: 30,
    },
  ],
  interactables: [
    {
      id: "gruta",
      x: 700,
      y: 555,
      radius: 40,
      label: "Gruta do predador",
      goal: { type: "guardNearby", radius: 150, durationMs: 10_000 },
      ally: { guardianId: "shark", x: 700, y: 480 },
      messages: {
        idle: "Um Guardião por perto acalma o que está lá dentro.",
        progress: "Ele está saindo…",
        done: "O Tubarão saiu da gruta.",
      },
    },
  ],
  waves: [
    {
      name: "Cheiro de sangue",
      groups: [
        { enemyId: "swimmer", count: 5, intervalMs: 900, delayMs: 0 },
        { enemyId: "dartfish", count: 3, intervalMs: 800, delayMs: 3200 },
      ],
    },
    {
      name: "O cardume sente",
      groups: [
        { enemyId: "minnow", count: 10, intervalMs: 260, delayMs: 0 },
        { enemyId: "swimmer", count: 5, intervalMs: 800, delayMs: 3000 },
      ],
    },
    {
      name: "Quem guarda a fenda",
      groups: [
        { enemyId: "shellback", count: 2, intervalMs: 1800, delayMs: 0 },
        { enemyId: "dartfish", count: 5, intervalMs: 700, delayMs: 2400 },
        { enemyId: "minnow", count: 8, intervalMs: 260, delayMs: 5200 },
      ],
    },
  ],
};
