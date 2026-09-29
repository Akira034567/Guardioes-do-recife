import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Corredeira. A água mais rápida dos Canais.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-7/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: -30, y: 120 },
  { x: 200, y: 130 },
  { x: 400, y: 200 },
  { x: 600, y: 280 },
  { x: 800, y: 200 },
  { x: 1000, y: 130 },
  { x: 1150, y: 200 },
  { x: 1180, y: 320 },
  { x: 1000, y: 380 },
  { x: 800, y: 340 },
  { x: 600, y: 400 },
  { x: 400, y: 470 },
  { x: 200, y: 420 },
  { x: 100, y: 480 },
  { x: 150, y: 550 },
  { x: 400, y: 560 },
  { x: 700, y: 550 },
  { x: 1000, y: 560 },
  { x: 1310, y: 540 },
];

export const CANAIS_SEVEN: LevelDefinition = {
  id: "canais-7",
  name: "Corredeira",
  subtitle: "A água mais rápida dos Canais",
  briefing:
    "Um canal comprido que desce em zigue-zague. Nas ondas de corredeira a corrente dobra de força, e a maré ainda vira no meio do caminho.",
  quote: "Rápido demais para pensar? Pense antes.",
  theme: { water: 0x0a4a70, sand: 0x7c95a0, path: 0xb2e6f4, rock: 0x39434f },
  startingPearls: 415,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.34, speed: 1.5, reward: 1.05 },
  enemyOverrides: { tidebreaker: { maxHealth: 1400 }, queenMoray: { maxHealth: 1400 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 12 },
    { id: "rapido", kind: "underTimeMs", value: 1020000 },
  ],
  objectivesByDifficulty: {
    dificil: [
      { id: "completar", kind: "complete" },
      { id: "vidas", kind: "minLivesRemaining", value: 10 },
      { id: "paciencia", kind: "noEarlyCall" },
    ],
    abissal: [
      { id: "completar", kind: "complete" },
      { id: "elites", kind: "noEliteLeaks" },
      { id: "especies", kind: "maxDistinctGuardians", value: 3 },
    ],
  },
  waypoints: MAIN_ROUTE,
  placements: [
    { id: "rocha-1", x: 400, y: 320 },
    { id: "rocha-2", x: 600, y: 170 },
    { id: "rocha-3", x: 290, y: 265 },
    { id: "rocha-4", x: 1030, y: 250 },
    { id: "rocha-5", x: 960, y: 465 },
    { id: "rocha-6", x: 850, y: 450 },
    { id: "rocha-8", x: 180, y: 290 },
    { id: "rocha-9", x: 1180, y: 460 },
  ],
  currents: [
    {
      id: "descida",
      x: 190,
      y: 100,
      width: 420,
      height: 200,
      direction: { x: -1, y: 0 },
      speedModifier: 0.32,
      projectileDrift: 40,
      flipEveryMs: 12000,
    },
    {
      id: "retorno",
      x: 590,
      y: 320,
      width: 420,
      height: 100,
      direction: { x: 1, y: 0 },
      speedModifier: 0.32,
      projectileDrift: 40,
      flipEveryMs: 12000,
    },
    {
      id: "fundo",
      x: 380,
      y: 520,
      width: 640,
      height: 60,
      direction: { x: -1, y: 0 },
      speedModifier: 0.32,
      projectileDrift: 40,
      flipEveryMs: 12000,
    },
  ],
  waves: [
    {
      name: "Maré de Abertura",
      completionReward: 50,
      groups: [
        { enemyId: "swimmer", count: 2, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Batedores",
      completionReward: 47,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Cardume Dividido",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.8 }],
      completionReward: 45,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Casco e Espinho",
      completionReward: 42,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "needlefish", count: 3, intervalMs: 450, delayMs: 2970 },
      ],
    },
    {
      name: "Correnteza Suja",
      completionReward: 40,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 3360 },
      ],
    },
    {
      name: "Ronda Funda",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.8 }],
      completionReward: 37,
      groups: [
        { enemyId: "minnow", count: 15, intervalMs: 200, delayMs: 0 },
        { enemyId: "needlefish", count: 4, intervalMs: 450, delayMs: 2760 },
      ],
    },
    {
      name: "Olhos no Escuro",
      completionReward: 34,
      groups: [
        { enemyId: "swimmer", count: 2, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2580 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 5130 },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 32,
      groups: [
        { enemyId: "minnow", count: 16, intervalMs: 200, delayMs: 0 },
        { enemyId: "needlefish", count: 5, intervalMs: 450, delayMs: 2760 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5910 },
      ],
    },
    {
      name: "Carga Pesada",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.8 }],
      completionReward: 29,
      groups: [
        { enemyId: "minnow", count: 17, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 5310 },
      ],
    },
    {
      name: "Enxame",
      completionReward: 27,
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 650, delayMs: 0 },
        { enemyId: "needlefish", count: 5, intervalMs: 450, delayMs: 4140 },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 7290 },
      ],
    },
    {
      name: "Escolta",
      groups: [
        { enemyId: "needlefish", count: 5, intervalMs: 450, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 3150 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5700 },
      ],
    },
    {
      name: "Dois Braços",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.8 }],
      groups: [
        { enemyId: "minnow", count: 19, intervalMs: 200, delayMs: 0 },
        { enemyId: "needlefish", count: 6, intervalMs: 450, delayMs: 2760, elite: "swift", elitePicks: [5] },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 6180 },
      ],
    },
    {
      name: "Água Turva",
      specialModifiers: [{ type: "noEarlyStart" }],
      groups: [
        { enemyId: "tidebreaker", count: 2, intervalMs: 7000, delayMs: 0 },
        { enemyId: "needlefish", count: 1, intervalMs: 450, delayMs: 10200 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 12270 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 14820 },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 17310 },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "swimmer", count: 12, intervalMs: 650, delayMs: 0 },
        { enemyId: "needlefish", count: 6, intervalMs: 450, delayMs: 4920, elite: "resilient", elitePicks: [5] },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 8340 },
      ],
    },
    {
      name: "Investida",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.8 }],
      groups: [
        { enemyId: "swimmer", count: 8, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 4920, elite: "resilient", elitePicks: [1] },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 8220 },
      ],
    },
    {
      name: "Maré Alta",
      groups: [
        { enemyId: "minnow", count: 22, intervalMs: 200, delayMs: 0 },
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 2760, elite: "regenerating", elitePicks: [6] },
        { enemyId: "ironShell", count: 2, intervalMs: 1600, delayMs: 6450 },
      ],
    },
    {
      name: "Caçadores",
      groups: [
        { enemyId: "dartfish", count: 14, intervalMs: 460, delayMs: 0 },
        { enemyId: "carrier", count: 3, intervalMs: 1250, delayMs: 4008 },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 8058, elite: "resilient", elitePicks: [1] },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 12618 },
      ],
    },
    {
      name: "Contracorrente",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.8 }],
      groups: [
        { enemyId: "dartfish", count: 15, intervalMs: 460, delayMs: 0, elite: "swift", elitePicks: [14] },
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 4008 },
        { enemyId: "moray", count: 3, intervalMs: 2300, delayMs: 7698 },
      ],
    },
    {
      name: "Tempestade",
      groups: [
        { enemyId: "minnow", count: 24, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 3, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "shellback", count: 3, intervalMs: 1150, delayMs: 6810 },
      ],
    },
    {
      name: "Arrastão",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0 },
        { enemyId: "ironShell", count: 4, intervalMs: 1600, delayMs: 3960 },
      ],
    },
    {
      name: "Maré Negra",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.8 }],
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0 },
        { enemyId: "carrier", count: 5, intervalMs: 1250, delayMs: 3960 },
        { enemyId: "puffer", count: 11, intervalMs: 700, delayMs: 9510, elite: "regenerating", elitePicks: [10] },
      ],
    },
    {
      name: "Última Luz",
      groups: [
        { enemyId: "needlefish", count: 9, intervalMs: 450, delayMs: 0 },
        { enemyId: "moray", count: 5, intervalMs: 2300, delayMs: 3960 },
      ],
    },
    {
      name: "Fundo do Canal",
      groups: [
        { enemyId: "minnow", count: 26, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 3, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 6810, elite: "swift", elitePicks: [1] },
        { enemyId: "ghostJelly", count: 4, intervalMs: 1200, delayMs: 11370, elite: "resilient", elitePicks: [3] },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 16050 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 18570 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 21090 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 23610 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 26130 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 28650 },
      ],
    },
    {
      name: "Sombra Longa",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.8 }],
      groups: [
        { enemyId: "swimmer", count: 17, intervalMs: 650, delayMs: 0 },
        { enemyId: "needlefish", count: 9, intervalMs: 450, delayMs: 4920 },
        { enemyId: "carrier", count: 8, intervalMs: 1250, delayMs: 8880 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 16680 },
      ],
    },
    {
      name: "Corredeira",
      specialModifiers: [{ type: "noEarlyStart" }],
      groups: [
        { enemyId: "queenMoray", count: 1, intervalMs: 8000, delayMs: 0 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 6600 },
        { enemyId: "swimmer", count: 18, intervalMs: 650, delayMs: 12600 },
        { enemyId: "carrier", count: 8, intervalMs: 1250, delayMs: 17520 },
        { enemyId: "ironShell", count: 4, intervalMs: 1600, delayMs: 25320, elite: "swift", elitePicks: [3] },
      ],
    },
  ],
};
