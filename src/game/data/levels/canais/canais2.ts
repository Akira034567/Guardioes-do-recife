import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Eclusa Velha. A alavanca escolhe o caminho.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-2/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: -30, y: 160 },
  { x: 120, y: 160 },
  { x: 260, y: 200 },
  { x: 400, y: 300 },
  { x: 560, y: 330 },
  { x: 720, y: 330 },
  { x: 880, y: 330 },
  { x: 1020, y: 380 },
  { x: 1120, y: 460 },
  { x: 1180, y: 520 },
  { x: 1310, y: 520 },
];

export const CANAIS_TWO: LevelDefinition = {
  id: "canais-2",
  name: "Eclusa Velha",
  subtitle: "A alavanca escolhe o caminho",
  briefing:
    "Uma eclusa do Recife antigo ainda funciona. A alavanca manda o cardume pelo canal reto ou pelo sinuoso — decida onde está a sua defesa.",
  quote: "Quem escolhe o caminho escolhe a luta.",
  theme: { water: 0x0b4466, sand: 0x7d8f88, path: 0xa8e2e8, rock: 0x4a3f37 },
  startingPearls: 390,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.14, speed: 0.93, reward: 1.3 },
  enemyOverrides: { tidebreaker: { maxHealth: 1200 }, queenMoray: { maxHealth: 1500 } },
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
      { id: "vidas", kind: "minLivesRemaining", value: 10 },
      { id: "sem-venda", kind: "noSell" },
    ],
  },
  waypoints: MAIN_ROUTE,
  paths: [
    { id: "main", waypoints: MAIN_ROUTE },
    { id: "longo", waypoints: [
      { x: -30, y: 160 },
      { x: 120, y: 160 },
      { x: 260, y: 200 },
      { x: 360, y: 150 },
      { x: 500, y: 125 },
      { x: 660, y: 130 },
      { x: 800, y: 140 },
      { x: 940, y: 150 },
      { x: 1080, y: 190 },
      { x: 1200, y: 260 },
      { x: 1220, y: 380 },
      { x: 1200, y: 470 },
      { x: 1180, y: 520 },
      { x: 1310, y: 520 },
    ] },
  ],
  placements: [
    { id: "pedra-eclusa", x: 560, y: 225 },
    { id: "pedra-meio", x: 760, y: 235 },
    { id: "pedra-leste", x: 980, y: 255 },
    { id: "pedra-sul", x: 440, y: 430 },
    { id: "baixio", x: 680, y: 440 },
    { id: "banco-sul", x: 880, y: 450 },
    { id: "foz", x: 1080, y: 560 },
    { id: "margem-leste", x: 1080, y: 300 },
  ],
  currents: [
    {
      id: "reto",
      x: 540,
      y: 300,
      width: 360,
      height: 60,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
    {
      id: "sinuoso",
      x: 480,
      y: 100,
      width: 480,
      height: 70,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
  ],
  gates: [
    {
      id: "eclusa",
      label: "Eclusa Velha",
      x: 200,
      y: 300,
      routes: ["main", "longo"],
      routeLabels: ["Canal Reto", "Canal Sinuoso"],
      doors: [{ x: 330, y: 250 }, { x: 310, y: 176 }],
      cooldownMs: 9000,
      initial: 0,
    },
  ],
  waves: [
    {
      name: "Maré de Abertura",
      completionReward: 50,
      groups: [
        { enemyId: "swimmer", count: 2, intervalMs: 650, delayMs: 0, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Batedores",
      completionReward: 47,
      groups: [
        { enemyId: "swimmer", count: 5, intervalMs: 650, delayMs: 0, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Cardume Dividido",
      completionReward: 43,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Casco e Espinho",
      completionReward: 40,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 3360, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Correnteza Suja",
      completionReward: 37,
      groups: [
        { enemyId: "minnow", count: 15, intervalMs: 200, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 2760, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Ronda Funda",
      completionReward: 34,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970, pathId: "gate:eclusa" },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5190, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Olhos no Escuro",
      completionReward: 30,
      groups: [
        { enemyId: "dartfish", count: 4, intervalMs: 460, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "thief", count: 1, intervalMs: 520, delayMs: 2904, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 5016, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 27,
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 650, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 4140, pathId: "gate:eclusa" },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 7200, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Carga Pesada",
      groups: [
        { enemyId: "needlefish", count: 5, intervalMs: 450, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 3150, pathId: "gate:eclusa" },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5886, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Enxame",
      groups: [
        { enemyId: "needlefish", count: 6, intervalMs: 450, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 3420, pathId: "gate:eclusa" },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 6480, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Escolta",
      groups: [
        { enemyId: "needlefish", count: 6, intervalMs: 450, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 3420, pathId: "gate:eclusa" },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 6156, pathId: "gate:eclusa" },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 9336, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Dois Braços",
      groups: [
        { enemyId: "swimmer", count: 13, intervalMs: 650, delayMs: 0, pathId: "gate:eclusa", elite: "resilient", elitePicks: [12] },
        { enemyId: "puffer", count: 6, intervalMs: 700, delayMs: 4920, pathId: "gate:eclusa", elite: "camouflaged", elitePicks: [5] },
        { enemyId: "shellback", count: 3, intervalMs: 1150, delayMs: 9240, pathId: "gate:eclusa", elite: "armored", elitePicks: [2] },
      ],
    },
    {
      name: "Água Turva",
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "dartfish", count: 7, intervalMs: 460, delayMs: 6000, pathId: "gate:eclusa" },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 9732, pathId: "gate:eclusa", elite: "camouflaged", elitePicks: [2] },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 12468, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 16788, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 7, intervalMs: 700, delayMs: 3690, pathId: "gate:eclusa" },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 8430, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Investida",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 3960, pathId: "gate:eclusa", elite: "regenerating", elitePicks: [3] },
        { enemyId: "puffer", count: 4, intervalMs: 700, delayMs: 7008, pathId: "gate:eclusa" },
        { enemyId: "minnow", count: 23, intervalMs: 200, delayMs: 10488, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Maré Alta",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 11, intervalMs: 700, delayMs: 3960, pathId: "gate:eclusa" },
        { enemyId: "shellback", count: 6, intervalMs: 1150, delayMs: 9120, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Caçadores",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0, pathId: "gate:eclusa", elite: "resilient", elitePicks: [7] },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 3960, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 8, intervalMs: 700, delayMs: 7320, pathId: "gate:eclusa" },
        { enemyId: "shellback", count: 4, intervalMs: 1150, delayMs: 12480, pathId: "gate:eclusa", elite: "regenerating", elitePicks: [3] },
      ],
    },
    {
      name: "Contracorrente",
      groups: [
        { enemyId: "needlefish", count: 9, intervalMs: 450, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 12, intervalMs: 700, delayMs: 3960, pathId: "gate:eclusa", elite: "armored", elitePicks: [11] },
        { enemyId: "shellback", count: 6, intervalMs: 1150, delayMs: 9120, pathId: "gate:eclusa" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 15060, pathId: "gate:eclusa" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 17580, pathId: "gate:eclusa" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 20100, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Tempestade",
      groups: [
        { enemyId: "swimmer", count: 17, intervalMs: 650, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 4920, pathId: "gate:eclusa", elite: "armored", elitePicks: [4] },
        { enemyId: "shellback", count: 4, intervalMs: 1150, delayMs: 8280, pathId: "gate:eclusa", elite: "regenerating", elitePicks: [3] },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 12840, pathId: "gate:eclusa" },
      ],
    },
    {
      name: "Eclusa Velha",
      groups: [
        { enemyId: "tidebreaker", count: 2, intervalMs: 7000, delayMs: 0, pathId: "gate:eclusa" },
        { enemyId: "minnow", count: 28, intervalMs: 200, delayMs: 10200, pathId: "gate:eclusa" },
        { enemyId: "puffer", count: 14, intervalMs: 700, delayMs: 12960, pathId: "gate:eclusa", elite: "regenerating", elitePicks: [13] },
        { enemyId: "shellback", count: 7, intervalMs: 1150, delayMs: 18120, pathId: "gate:eclusa" },
        { enemyId: "swimmer", count: 18, intervalMs: 650, delayMs: 24750, pathId: "gate:eclusa" },
      ],
    },
  ],
};
