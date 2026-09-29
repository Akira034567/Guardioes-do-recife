import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Boca do Canal. Onde o Recife vira labirinto.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-1/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: -30, y: 330 },
  { x: 110, y: 330 },
  { x: 210, y: 290 },
  { x: 280, y: 210 },
  { x: 380, y: 180 },
  { x: 520, y: 190 },
  { x: 660, y: 170 },
  { x: 800, y: 185 },
  { x: 940, y: 175 },
  { x: 1050, y: 210 },
  { x: 1130, y: 290 },
  { x: 1190, y: 330 },
  { x: 1310, y: 330 },
];

export const CANAIS_ONE: LevelDefinition = {
  id: "canais-1",
  name: "Boca do Canal",
  subtitle: "Onde o Recife vira labirinto",
  briefing:
    "A maré negra desceu para os Canais Profundos. Aqui a água se divide em dois braços em volta de uma ilha comprida — e o cardume vem pelos dois.",
  quote: "Um canal por vez é fácil. Os dois juntos é que ensinam.",
  theme: { water: 0x0a3f63, sand: 0x6f8f96, path: 0x9fdcef, rock: 0x3a3a44 },
  startingPearls: 380,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.1, speed: 0.93, reward: 1.28 },
  enemyOverrides: { tidebreaker: { maxHealth: 1150 }, queenMoray: { maxHealth: 1500 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 10 },
    { id: "poucos", kind: "maxGuardians", value: 9 },
  ],
  objectivesByDifficulty: {
    dificil: [
      { id: "completar", kind: "complete" },
      { id: "vidas", kind: "minLivesRemaining", value: 12 },
      { id: "elites", kind: "noEliteLeaks" },
    ],
    abissal: [
      { id: "completar", kind: "complete" },
      { id: "vidas", kind: "minLivesRemaining", value: 10 },
      { id: "especies", kind: "maxDistinctGuardians", value: 3 },
    ],
  },
  waypoints: MAIN_ROUTE,
  paths: [
    { id: "main", waypoints: MAIN_ROUTE },
    { id: "sul", waypoints: [
      { x: -30, y: 330 },
      { x: 110, y: 330 },
      { x: 210, y: 370 },
      { x: 280, y: 450 },
      { x: 380, y: 480 },
      { x: 520, y: 470 },
      { x: 660, y: 490 },
      { x: 800, y: 475 },
      { x: 940, y: 485 },
      { x: 1050, y: 450 },
      { x: 1130, y: 370 },
      { x: 1190, y: 330 },
      { x: 1310, y: 330 },
    ] },
  ],
  placements: [
    { id: "ilha-oeste", x: 420, y: 330 },
    { id: "ilha-centro", x: 600, y: 330 },
    { id: "ilha-leste", x: 780, y: 330 },
    { id: "ilha-foz", x: 960, y: 330 },
    { id: "boca-norte", x: 110, y: 190 },
    { id: "boca-sul", x: 110, y: 470 },
    { id: "foz-norte", x: 1190, y: 190 },
    { id: "foz-sul", x: 1190, y: 470 },
  ],
  currents: [
    {
      id: "norte",
      x: 370,
      y: 150,
      width: 450,
      height: 65,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
    {
      id: "sul",
      x: 370,
      y: 445,
      width: 450,
      height: 70,
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
        { enemyId: "swimmer", count: 5, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Cardume Dividido",
      completionReward: 43,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Casco e Espinho",
      completionReward: 40,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0 },
        { enemyId: "needlefish", count: 3, intervalMs: 450, delayMs: 3360 },
      ],
    },
    {
      name: "Correnteza Suja",
      completionReward: 36,
      groups: [
        { enemyId: "minnow", count: 15, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 2760 },
      ],
    },
    {
      name: "Ronda Funda",
      completionReward: 33,
      groups: [
        { enemyId: "minnow", count: 14, intervalMs: 200, delayMs: 0 },
        { enemyId: "needlefish", count: 3, intervalMs: 450, delayMs: 2760 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5370 },
      ],
    },
    {
      name: "Olhos no Escuro",
      completionReward: 29,
      groups: [
        { enemyId: "minnow", count: 11, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2760, pathId: "sul" },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 4980 },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 26,
      groups: [
        { enemyId: "dartfish", count: 10, intervalMs: 460, delayMs: 0, pathId: "sul" },
        { enemyId: "needlefish", count: 5, intervalMs: 450, delayMs: 4008 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 7158, pathId: "sul" },
      ],
    },
    {
      name: "Carga Pesada",
      groups: [
        { enemyId: "minnow", count: 19, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 2760, pathId: "sul", elite: "swift", elitePicks: [2] },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 5820 },
      ],
    },
    {
      name: "Enxame",
      groups: [
        { enemyId: "swimmer", count: 9, intervalMs: 650, delayMs: 0, pathId: "sul" },
        { enemyId: "needlefish", count: 6, intervalMs: 450, delayMs: 4920, elite: "resilient", elitePicks: [5] },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 8340, elite: "furious", elitePicks: [1] },
      ],
    },
    {
      name: "Escolta",
      groups: [
        { enemyId: "minnow", count: 20, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 2760 },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 5820 },
      ],
    },
    {
      name: "Dois Braços",
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0 },
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 6000 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 9690 },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 12180 },
      ],
    },
    {
      name: "Água Turva",
      groups: [
        { enemyId: "swimmer", count: 12, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 5, intervalMs: 700, delayMs: 4920 },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 8820, elite: "furious", elitePicks: [1] },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 12000, pathId: "sul" },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "dartfish", count: 15, intervalMs: 460, delayMs: 0 },
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 4008 },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 7968, pathId: "sul" },
        { enemyId: "shellback", count: 3, intervalMs: 1150, delayMs: 12288 },
      ],
    },
    {
      name: "Investida",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0 },
        { enemyId: "puffer", count: 5, intervalMs: 700, delayMs: 3960, pathId: "sul" },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 7860 },
      ],
    },
    {
      name: "Maré Alta",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0, pathId: "sul" },
        { enemyId: "shellback", count: 6, intervalMs: 1150, delayMs: 3960 },
        { enemyId: "corruptedShark", count: 3, intervalMs: 4200, delayMs: 9900, pathId: "sul" },
      ],
    },
    {
      name: "Caçadores",
      groups: [
        { enemyId: "swimmer", count: 16, intervalMs: 650, delayMs: 0, elite: "swift", elitePicks: [15] },
        { enemyId: "puffer", count: 12, intervalMs: 700, delayMs: 4920, pathId: "sul", elite: "regenerating", elitePicks: [11] },
        { enemyId: "shellback", count: 6, intervalMs: 1150, delayMs: 10080 },
      ],
    },
    {
      name: "Contracorrente",
      groups: [
        { enemyId: "minnow", count: 27, intervalMs: 200, delayMs: 0, pathId: "sul" },
        { enemyId: "needlefish", count: 9, intervalMs: 450, delayMs: 2760 },
        { enemyId: "moray", count: 3, intervalMs: 2300, delayMs: 6720, pathId: "sul" },
        { enemyId: "corruptedShark", count: 2, intervalMs: 4200, delayMs: 12660 },
      ],
    },
    {
      name: "Boca do Canal",
      groups: [
        { enemyId: "tidebreaker", count: 2, intervalMs: 7000, delayMs: 0 },
        { enemyId: "dartfish", count: 18, intervalMs: 460, delayMs: 10200, pathId: "sul", elite: "camouflaged", elitePicks: [17] },
        { enemyId: "puffer", count: 13, intervalMs: 700, delayMs: 14208 },
        { enemyId: "moray", count: 4, intervalMs: 2300, delayMs: 19368 },
        { enemyId: "needlefish", count: 10, intervalMs: 450, delayMs: 26688 },
      ],
    },
  ],
};
