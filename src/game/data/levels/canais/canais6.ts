import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Labirinto de Pedra. Três canais, duas alavancas, uma defesa.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-6/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: -30, y: 330 },
  { x: 140, y: 330 },
  { x: 300, y: 330 },
  { x: 460, y: 320 },
  { x: 620, y: 340 },
  { x: 780, y: 320 },
  { x: 940, y: 340 },
  { x: 1100, y: 330 },
  { x: 1310, y: 330 },
];

export const CANAIS_SIX: LevelDefinition = {
  id: "canais-6",
  name: "Labirinto de Pedra",
  subtitle: "Três canais, duas alavancas, uma defesa",
  briefing:
    "As pedras do fundo formam um labirinto de três canais. Duas eclusas escolhem por onde o cardume passa: feche o que você não consegue defender.",
  quote: "Um bom guardião escolhe onde lutar.",
  theme: { water: 0x0b3a58, sand: 0x77838a, path: 0xa4d4e6, rock: 0x40404c },
  startingPearls: 410,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.3, speed: 0.9, reward: 1.36 },
  enemyOverrides: { tidebreaker: { maxHealth: 1050 }, queenMoray: { maxHealth: 1150 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 12 },
    { id: "especies", kind: "maxDistinctGuardians", value: 4 },
  ],
  objectivesByDifficulty: {
    dificil: [
      { id: "completar", kind: "complete" },
      { id: "elites", kind: "noEliteLeaks" },
      { id: "especies", kind: "maxDistinctGuardians", value: 4 },
    ],
    abissal: [
      { id: "completar", kind: "complete" },
      { id: "vidas", kind: "minLivesRemaining", value: 8 },
      { id: "sem-venda", kind: "noSell" },
    ],
  },
  waypoints: MAIN_ROUTE,
  paths: [
    { id: "main", waypoints: MAIN_ROUTE },
    { id: "norte", waypoints: [
      { x: -30, y: 330 },
      { x: 140, y: 330 },
      { x: 220, y: 250 },
      { x: 300, y: 150 },
      { x: 460, y: 125 },
      { x: 620, y: 130 },
      { x: 780, y: 125 },
      { x: 940, y: 135 },
      { x: 1060, y: 180 },
      { x: 1140, y: 260 },
      { x: 1200, y: 330 },
      { x: 1310, y: 330 },
    ] },
    { id: "sul", waypoints: [
      { x: -30, y: 330 },
      { x: 140, y: 330 },
      { x: 220, y: 410 },
      { x: 300, y: 510 },
      { x: 460, y: 540 },
      { x: 620, y: 530 },
      { x: 780, y: 540 },
      { x: 940, y: 525 },
      { x: 1060, y: 480 },
      { x: 1140, y: 400 },
      { x: 1200, y: 330 },
      { x: 1310, y: 330 },
    ] },
  ],
  placements: [
    { id: "pedra-n1", x: 380, y: 235 },
    { id: "pedra-n2", x: 700, y: 240 },
    { id: "pedra-n3", x: 960, y: 245 },
    { id: "pedra-s1", x: 380, y: 425 },
    { id: "pedra-s2", x: 700, y: 425 },
    { id: "pedra-s3", x: 960, y: 425 },
    { id: "torre-oeste", x: 60, y: 200 },
    { id: "torre-sul", x: 60, y: 460 },
  ],
  currents: [
    {
      id: "meio",
      x: 440,
      y: 290,
      width: 520,
      height: 70,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
  ],
  gates: [
    {
      id: "norte",
      label: "Eclusa Norte",
      x: 170,
      y: 180,
      routes: ["norte", "main"],
      routeLabels: ["Canal Norte", "Canal do Meio"],
      doors: [{ x: 250, y: 215 }, { x: 260, y: 330 }],
      cooldownMs: 10000,
      initial: 0,
    },
    {
      id: "sul",
      label: "Eclusa Sul",
      x: 170,
      y: 480,
      routes: ["sul", "main"],
      routeLabels: ["Canal Sul", "Canal do Meio"],
      doors: [{ x: 250, y: 447 }, { x: 330, y: 330 }],
      cooldownMs: 10000,
      initial: 0,
    },
  ],
  waves: [
    {
      name: "Maré de Abertura",
      completionReward: 50,
      groups: [
        { enemyId: "swimmer", count: 2, intervalMs: 650, delayMs: 0, pathId: "gate:norte" },
      ],
    },
    {
      name: "Batedores",
      completionReward: 47,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0, pathId: "gate:sul" },
      ],
    },
    {
      name: "Cardume Dividido",
      completionReward: 45,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0, pathId: "gate:norte" },
      ],
    },
    {
      name: "Casco e Espinho",
      completionReward: 42,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970, pathId: "gate:norte" },
      ],
    },
    {
      name: "Correnteza Suja",
      completionReward: 39,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0, pathId: "gate:norte" },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970, pathId: "gate:sul" },
      ],
    },
    {
      name: "Ronda Funda",
      completionReward: 36,
      groups: [
        { enemyId: "minnow", count: 13, intervalMs: 200, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2760, pathId: "gate:norte" },
      ],
    },
    {
      name: "Olhos no Escuro",
      completionReward: 34,
      groups: [
        { enemyId: "minnow", count: 7, intervalMs: 200, delayMs: 0, pathId: "gate:norte" },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2640, pathId: "gate:sul" },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 5190, pathId: "gate:norte" },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 31,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "thief", count: 2, intervalMs: 520, delayMs: 3360, pathId: "gate:norte" },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 5784, pathId: "gate:sul" },
      ],
    },
    {
      name: "Carga Pesada",
      completionReward: 28,
      groups: [
        { enemyId: "minnow", count: 16, intervalMs: 200, delayMs: 0, pathId: "gate:norte" },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760, pathId: "gate:sul" },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5310, pathId: "gate:norte" },
      ],
    },
    {
      name: "Enxame",
      completionReward: 26,
      groups: [
        { enemyId: "minnow", count: 18, intervalMs: 200, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 2760, pathId: "gate:norte" },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 5496, pathId: "gate:sul" },
      ],
    },
    {
      name: "Escolta",
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0, pathId: "gate:norte" },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 3360, pathId: "gate:sul" },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5910, pathId: "gate:norte" },
      ],
    },
    {
      name: "Dois Braços",
      groups: [
        { enemyId: "swimmer", count: 8, intervalMs: 650, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 4920, pathId: "gate:norte" },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 7656, pathId: "gate:sul" },
      ],
    },
    {
      name: "Água Turva",
      groups: [
        { enemyId: "dartfish", count: 13, intervalMs: 460, delayMs: 0, pathId: "gate:norte" },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 4008, pathId: "gate:sul" },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 6768, pathId: "gate:norte" },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 9828, pathId: "gate:sul" },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "dartfish", count: 13, intervalMs: 460, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 4008, pathId: "gate:norte" },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 7056, pathId: "gate:sul" },
      ],
    },
    {
      name: "Investida",
      specialModifiers: [{ type: "noEarlyStart" }],
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0, pathId: "gate:norte" },
        { enemyId: "needlefish", count: 1, intervalMs: 450, delayMs: 6000, pathId: "gate:sul" },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 8070, pathId: "gate:norte" },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 10830, pathId: "gate:sul" },
      ],
    },
    {
      name: "Maré Alta",
      groups: [
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 3690, pathId: "gate:norte" },
        { enemyId: "shellback", count: 3, intervalMs: 1150, delayMs: 6738, pathId: "gate:sul", elite: "camouflaged", elitePicks: [2] },
      ],
    },
    {
      name: "Caçadores",
      groups: [
        { enemyId: "dartfish", count: 14, intervalMs: 460, delayMs: 0, pathId: "gate:norte" },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 4008, pathId: "gate:sul" },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 6768, pathId: "gate:norte", elite: "swift", elitePicks: [1] },
      ],
    },
    {
      name: "Contracorrente",
      groups: [
        { enemyId: "minnow", count: 23, intervalMs: 200, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 2760, pathId: "gate:norte", elite: "camouflaged", elitePicks: [3] },
        { enemyId: "ironShell", count: 2, intervalMs: 1600, delayMs: 5808, pathId: "gate:sul", elite: "furious", elitePicks: [1] },
      ],
    },
    {
      name: "Tempestade",
      groups: [
        { enemyId: "minnow", count: 24, intervalMs: 200, delayMs: 0, pathId: "gate:norte" },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 2760, pathId: "gate:sul" },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 5520, pathId: "gate:norte" },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 8700, pathId: "gate:sul", elite: "regenerating", elitePicks: [1] },
      ],
    },
    {
      name: "Arrastão",
      groups: [
        { enemyId: "minnow", count: 25, intervalMs: 200, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 2760, pathId: "gate:norte" },
        { enemyId: "moray", count: 3, intervalMs: 2300, delayMs: 6120, pathId: "gate:sul" },
        { enemyId: "shellback", count: 4, intervalMs: 1150, delayMs: 12060, pathId: "gate:norte", elite: "armored", elitePicks: [3] },
      ],
    },
    {
      name: "Maré Negra",
      groups: [
        { enemyId: "swimmer", count: 16, intervalMs: 650, delayMs: 0, pathId: "gate:norte" },
        { enemyId: "ironShell", count: 2, intervalMs: 1600, delayMs: 4920, pathId: "gate:sul", elite: "armored", elitePicks: [1] },
        { enemyId: "corruptedShark", count: 2, intervalMs: 4200, delayMs: 8640, pathId: "gate:norte" },
      ],
    },
    {
      name: "Última Luz",
      groups: [
        { enemyId: "dartfish", count: 17, intervalMs: 460, delayMs: 0, pathId: "gate:sul", elite: "regenerating", elitePicks: [16] },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 4008, pathId: "gate:norte" },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 7368, pathId: "gate:sul" },
        { enemyId: "puffer", count: 8, intervalMs: 700, delayMs: 12168, pathId: "gate:norte" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 17328, pathId: "gate:sul" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 19848, pathId: "gate:norte" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 22368, pathId: "gate:sul" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 24888, pathId: "gate:norte" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 27408, pathId: "gate:sul" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 29928, pathId: "gate:norte" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 32448, pathId: "gate:sul" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 34968, pathId: "gate:norte" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 37488, pathId: "gate:sul" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 40008, pathId: "gate:norte" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 42528, pathId: "gate:sul" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 45048, pathId: "gate:norte" },
      ],
    },
    {
      name: "Fundo do Canal",
      groups: [
        { enemyId: "needlefish", count: 9, intervalMs: 450, delayMs: 0, pathId: "gate:norte", elite: "armored", elitePicks: [8] },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 3960, pathId: "gate:sul" },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 6720, pathId: "gate:norte" },
        { enemyId: "puffer", count: 6, intervalMs: 700, delayMs: 11280, pathId: "gate:sul" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 15600, pathId: "gate:norte" },
      ],
    },
    {
      name: "Labirinto de Pedra",
      specialModifiers: [{ type: "noEarlyStart" }],
      groups: [
        { enemyId: "queenMoray", count: 1, intervalMs: 8000, delayMs: 0, pathId: "gate:sul" },
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 6600, pathId: "gate:norte" },
        { enemyId: "dartfish", count: 18, intervalMs: 460, delayMs: 12600, pathId: "gate:sul", elite: "regenerating", elitePicks: [17] },
        { enemyId: "thief", count: 6, intervalMs: 520, delayMs: 16608, pathId: "gate:norte" },
        { enemyId: "carrier", count: 5, intervalMs: 1250, delayMs: 20280, pathId: "gate:sul" },
        { enemyId: "moray", count: 4, intervalMs: 2300, delayMs: 25830, pathId: "gate:norte" },
      ],
    },
  ],
};
