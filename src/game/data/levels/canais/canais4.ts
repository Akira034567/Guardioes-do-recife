import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Névoa de Lodo. Não dá para defender o que não se vê.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-4/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: -30, y: 520 },
  { x: 140, y: 520 },
  { x: 280, y: 470 },
  { x: 400, y: 380 },
  { x: 520, y: 290 },
  { x: 660, y: 220 },
  { x: 820, y: 180 },
  { x: 980, y: 170 },
  { x: 1120, y: 140 },
  { x: 1310, y: 140 },
];

export const CANAIS_FOUR: LevelDefinition = {
  id: "canais-4",
  name: "Névoa de Lodo",
  subtitle: "Não dá para defender o que não se vê",
  briefing:
    "O lodo do fundo sobe em nuvens. Nas ondas de névoa, só quem está perto de uma luz enxerga longe — e os ladrões adoram o escuro.",
  quote: "Na névoa, ninguém protege sozinho.",
  theme: { water: 0x173f4a, sand: 0x6c7f6a, path: 0x9fc9b8, rock: 0x2f3a33 },
  startingPearls: 400,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.22, speed: 0.9, reward: 1.32 },
  enemyOverrides: { tidebreaker: { maxHealth: 1250 }, queenMoray: { maxHealth: 1500 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 12 },
    { id: "poucos", kind: "maxGuardians", value: 10 },
  ],
  objectivesByDifficulty: {
    dificil: [
      { id: "completar", kind: "complete" },
      { id: "elites", kind: "noEliteLeaks" },
      { id: "vidas", kind: "minLivesRemaining", value: 10 },
    ],
    abissal: [
      { id: "completar", kind: "complete" },
      { id: "vidas", kind: "minLivesRemaining", value: 8 },
      { id: "poucos", kind: "maxGuardians", value: 12 },
    ],
  },
  waypoints: MAIN_ROUTE,
  paths: [
    { id: "main", waypoints: MAIN_ROUTE },
    { id: "baixio", waypoints: [
      { x: -30, y: 520 },
      { x: 140, y: 520 },
      { x: 320, y: 545 },
      { x: 520, y: 545 },
      { x: 700, y: 525 },
      { x: 860, y: 480 },
      { x: 980, y: 400 },
      { x: 1060, y: 300 },
      { x: 1120, y: 210 },
      { x: 1170, y: 150 },
      { x: 1310, y: 140 },
    ] },
  ],
  placements: [
    { id: "lodo-oeste", x: 560, y: 430 },
    { id: "lodo-centro", x: 740, y: 380 },
    { id: "lodo-leste", x: 900, y: 320 },
    { id: "barranco", x: 250, y: 370 },
    { id: "pedra-alta", x: 560, y: 160 },
    { id: "mirante", x: 720, y: 100 },
    { id: "foz", x: 1180, y: 300 },
    { id: "banco-sul", x: 1000, y: 540 },
  ],
  currents: [
    {
      id: "diagonal",
      x: 380,
      y: 200,
      width: 300,
      height: 200,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
    {
      id: "baixio",
      x: 500,
      y: 505,
      width: 380,
      height: 60,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
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
      specialModifiers: [{ type: "fog" }],
      completionReward: 44,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Casco e Espinho",
      completionReward: 41,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970 },
      ],
    },
    {
      name: "Correnteza Suja",
      specialModifiers: [{ type: "fog" }],
      completionReward: 38,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970 },
      ],
    },
    {
      name: "Ronda Funda",
      completionReward: 35,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 3360 },
      ],
    },
    {
      name: "Olhos no Escuro",
      specialModifiers: [{ type: "fog" }],
      completionReward: 32,
      groups: [
        { enemyId: "minnow", count: 9, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2760 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 4980 },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 29,
      groups: [
        { enemyId: "dartfish", count: 8, intervalMs: 460, delayMs: 0, pathId: "baixio" },
        { enemyId: "ghostJelly", count: 1, intervalMs: 1200, delayMs: 4008 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 6528, pathId: "baixio" },
      ],
    },
    {
      name: "Carga Pesada",
      specialModifiers: [{ type: "fog" }],
      completionReward: 26,
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 650, delayMs: 0 },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 4140, pathId: "baixio" },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 6876 },
      ],
    },
    {
      name: "Enxame",
      groups: [
        { enemyId: "swimmer", count: 7, intervalMs: 650, delayMs: 0, pathId: "baixio" },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 4530 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 7770 },
      ],
    },
    {
      name: "Escolta",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "needlefish", count: 6, intervalMs: 450, delayMs: 0 },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 3420 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 6156, elite: "furious", elitePicks: [1] },
      ],
    },
    {
      name: "Dois Braços",
      groups: [
        { enemyId: "dartfish", count: 13, intervalMs: 460, delayMs: 0 },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 4008 },
        { enemyId: "puffer", count: 5, intervalMs: 700, delayMs: 7248, elite: "resilient", elitePicks: [4] },
      ],
    },
    {
      name: "Água Turva",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "dartfish", count: 13, intervalMs: 460, delayMs: 0, elite: "furious", elitePicks: [12] },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 4008 },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 7056 },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0 },
        { enemyId: "dartfish", count: 7, intervalMs: 460, delayMs: 6000 },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 9732, pathId: "baixio" },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 12972 },
      ],
    },
    {
      name: "Investida",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 0 },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 3690, pathId: "baixio" },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 6738 },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 9918, pathId: "baixio", elite: "swift", elitePicks: [2] },
      ],
    },
    {
      name: "Maré Alta",
      groups: [
        { enemyId: "dartfish", count: 15, intervalMs: 460, delayMs: 0, pathId: "baixio", elite: "swift", elitePicks: [14] },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 4008 },
        { enemyId: "corruptedShark", count: 2, intervalMs: 4200, delayMs: 7248, pathId: "baixio" },
        { enemyId: "shellback", count: 3, intervalMs: 1150, delayMs: 14088 },
      ],
    },
    {
      name: "Caçadores",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "minnow", count: 24, intervalMs: 200, delayMs: 0 },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 2760, pathId: "baixio", elite: "regenerating", elitePicks: [4] },
        { enemyId: "puffer", count: 7, intervalMs: 700, delayMs: 6120 },
        { enemyId: "dartfish", count: 15, intervalMs: 460, delayMs: 10860, pathId: "baixio", elite: "furious", elitePicks: [14] },
      ],
    },
    {
      name: "Contracorrente",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0, pathId: "baixio" },
        { enemyId: "ghostJelly", count: 3, intervalMs: 1200, delayMs: 3960 },
        { enemyId: "puffer", count: 7, intervalMs: 700, delayMs: 7920, pathId: "baixio" },
        { enemyId: "swimmer", count: 14, intervalMs: 650, delayMs: 12660, elite: "armored", elitePicks: [13] },
      ],
    },
    {
      name: "Tempestade",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "dartfish", count: 16, intervalMs: 460, delayMs: 0 },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 4008, pathId: "baixio" },
        { enemyId: "corruptedShark", count: 2, intervalMs: 4200, delayMs: 7368 },
      ],
    },
    {
      name: "Arrastão",
      groups: [
        { enemyId: "needlefish", count: 9, intervalMs: 450, delayMs: 0, pathId: "baixio", elite: "camouflaged", elitePicks: [8] },
        { enemyId: "ghostJelly", count: 3, intervalMs: 1200, delayMs: 3960 },
        { enemyId: "shellback", count: 7, intervalMs: 1150, delayMs: 7920 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 14550 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 17070 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 19590 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 22110, pathId: "baixio" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 24630 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 27150, pathId: "baixio" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 29670 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 32190, pathId: "baixio" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 34710 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 37230 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 39750 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 42270 },
      ],
    },
    {
      name: "Maré Negra",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "minnow", count: 27, intervalMs: 200, delayMs: 0 },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 2760, elite: "furious", elitePicks: [4] },
        { enemyId: "shellback", count: 7, intervalMs: 1150, delayMs: 6120 },
      ],
    },
    {
      name: "Névoa de Lodo",
      groups: [
        { enemyId: "tidebreaker", count: 2, intervalMs: 7000, delayMs: 0 },
        { enemyId: "dartfish", count: 18, intervalMs: 460, delayMs: 10200 },
        { enemyId: "ghostJelly", count: 3, intervalMs: 1200, delayMs: 14208 },
        { enemyId: "shellback", count: 7, intervalMs: 1150, delayMs: 18168 },
        { enemyId: "carrier", count: 6, intervalMs: 1250, delayMs: 24798, pathId: "baixio" },
      ],
    },
  ],
};
