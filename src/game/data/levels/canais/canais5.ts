import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Redemoinho do Farol. A água gira em volta da luz velha.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-5/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: 200, y: -30 },
  { x: 200, y: 130 },
  { x: 210, y: 330 },
  { x: 190, y: 520 },
  { x: 260, y: 560 },
  { x: 430, y: 560 },
  { x: 500, y: 480 },
  { x: 510, y: 300 },
  { x: 490, y: 140 },
  { x: 560, y: 110 },
  { x: 730, y: 110 },
  { x: 800, y: 160 },
  { x: 810, y: 350 },
  { x: 790, y: 520 },
  { x: 860, y: 560 },
  { x: 1030, y: 560 },
  { x: 1100, y: 480 },
  { x: 1110, y: 300 },
  { x: 1100, y: 140 },
  { x: 1100, y: -30 },
];

export const CANAIS_FIVE: LevelDefinition = {
  id: "canais-5",
  name: "Redemoinho do Farol",
  subtitle: "A água gira em volta da luz velha",
  briefing:
    "O farol afundado ainda puxa a água em espiral. O redemoinho devolve quem passa rota acima — e o dormente só gira quando alguém o acorda.",
  quote: "O mar devolve o que você não conseguiu segurar. Aproveite.",
  theme: { water: 0x0c3a61, sand: 0x7a8c9a, path: 0xaad8f0, rock: 0x3b3a4a },
  startingPearls: 405,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.26, speed: 1.55, reward: 1.0 },
  enemyOverrides: { tidebreaker: { maxHealth: 1350 }, queenMoray: { maxHealth: 1150 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 12 },
    { id: "paciencia", kind: "noEarlyCall" },
  ],
  objectivesByDifficulty: {
    dificil: [
      { id: "completar", kind: "complete" },
      { id: "vidas", kind: "minLivesRemaining", value: 12 },
      { id: "sem-venda", kind: "noSell" },
    ],
    abissal: [
      { id: "completar", kind: "complete" },
      { id: "elites", kind: "noEliteLeaks" },
      { id: "especies", kind: "maxDistinctGuardians", value: 3 },
    ],
  },
  waypoints: MAIN_ROUTE,
  placements: [
    { id: "farol-1", x: 350, y: 200 },
    { id: "farol-2", x: 350, y: 420 },
    { id: "farol-3", x: 650, y: 230 },
    { id: "farol-4", x: 650, y: 450 },
    { id: "farol-5", x: 950, y: 200 },
    { id: "farol-6", x: 950, y: 420 },
    { id: "rocha-oeste", x: 80, y: 300 },
    { id: "rocha-leste", x: 1220, y: 320 },
  ],
  currents: [
    {
      id: "descida",
      x: 170,
      y: 110,
      width: 70,
      height: 430,
      direction: { x: 0, y: -1 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
    {
      id: "subida",
      x: 460,
      y: 120,
      width: 80,
      height: 400,
      direction: { x: 0, y: 1 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
  ],
  whirlpools: [
    {
      id: "farol",
      label: "Redemoinho do Farol",
      x: 510,
      y: 300,
      radius: 70,
      pullBack: 150,
      intervalMs: 5000,
    },
    {
      id: "dormente",
      label: "Redemoinho Dormente",
      x: 810,
      y: 350,
      radius: 70,
      pullBack: 180,
      intervalMs: 2500,
      dormant: { activeMs: 8000, cooldownMs: 16000 },
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
      completionReward: 44,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Casco e Espinho",
      completionReward: 41,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 3360 },
      ],
    },
    {
      name: "Correnteza Suja",
      completionReward: 39,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 3360 },
      ],
    },
    {
      name: "Ronda Funda",
      completionReward: 36,
      groups: [
        { enemyId: "minnow", count: 15, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 2760 },
      ],
    },
    {
      name: "Olhos no Escuro",
      completionReward: 33,
      groups: [
        { enemyId: "minnow", count: 10, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5310 },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 30,
      groups: [
        { enemyId: "minnow", count: 17, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 2760 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5400 },
      ],
    },
    {
      name: "Carga Pesada",
      completionReward: 27,
      groups: [
        { enemyId: "dartfish", count: 9, intervalMs: 460, delayMs: 0, elite: "armored", elitePicks: [8] },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 4008 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 6558 },
      ],
    },
    {
      name: "Enxame",
      groups: [
        { enemyId: "needlefish", count: 5, intervalMs: 450, delayMs: 0 },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 3150 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 6210 },
      ],
    },
    {
      name: "Escolta",
      groups: [
        { enemyId: "dartfish", count: 8, intervalMs: 460, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 4008 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 6558 },
      ],
    },
    {
      name: "Dois Braços",
      groups: [
        { enemyId: "needlefish", count: 6, intervalMs: 450, delayMs: 0 },
        { enemyId: "puffer", count: 5, intervalMs: 700, delayMs: 3420, elite: "camouflaged", elitePicks: [4] },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 7320 },
      ],
    },
    {
      name: "Água Turva",
      groups: [
        { enemyId: "swimmer", count: 11, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 4920, elite: "furious", elitePicks: [1] },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 8220, elite: "armored", elitePicks: [1] },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0 },
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 6000 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 9360 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 12000 },
      ],
    },
    {
      name: "Investida",
      groups: [
        { enemyId: "minnow", count: 22, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 5310, elite: "furious", elitePicks: [1] },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 8490, elite: "swift", elitePicks: [2] },
      ],
    },
    {
      name: "Maré Alta",
      groups: [
        { enemyId: "swimmer", count: 14, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 6, intervalMs: 700, delayMs: 4920, elite: "resilient", elitePicks: [5] },
        { enemyId: "corruptedShark", count: 2, intervalMs: 4200, delayMs: 9240 },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 16080 },
      ],
    },
    {
      name: "Caçadores",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0 },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 3960 },
        { enemyId: "shellback", count: 4, intervalMs: 1150, delayMs: 8760 },
      ],
    },
    {
      name: "Contracorrente",
      groups: [
        { enemyId: "minnow", count: 24, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 7, intervalMs: 700, delayMs: 2760 },
        { enemyId: "carrier", count: 3, intervalMs: 1250, delayMs: 7500 },
        { enemyId: "ghostJelly", count: 4, intervalMs: 1200, delayMs: 11550 },
      ],
    },
    {
      name: "Tempestade",
      groups: [
        { enemyId: "minnow", count: 25, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "puffer", count: 5, intervalMs: 700, delayMs: 6060 },
        { enemyId: "swimmer", count: 9, intervalMs: 650, delayMs: 9960 },
      ],
    },
    {
      name: "Arrastão",
      groups: [
        { enemyId: "minnow", count: 25, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 10, intervalMs: 700, delayMs: 2760, elite: "regenerating", elitePicks: [9] },
        { enemyId: "moray", count: 3, intervalMs: 2300, delayMs: 7920 },
        { enemyId: "ghostJelly", count: 4, intervalMs: 1200, delayMs: 13860 },
      ],
    },
    {
      name: "Maré Negra",
      groups: [
        { enemyId: "dartfish", count: 17, intervalMs: 460, delayMs: 0 },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 4008, elite: "camouflaged", elitePicks: [3] },
        { enemyId: "puffer", count: 9, intervalMs: 700, delayMs: 8808 },
        { enemyId: "moray", count: 3, intervalMs: 2300, delayMs: 13968 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 19908 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 22428 },
      ],
    },
    {
      name: "Última Luz",
      groups: [
        { enemyId: "swimmer", count: 17, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 13, intervalMs: 700, delayMs: 4920 },
        { enemyId: "shellback", count: 7, intervalMs: 1150, delayMs: 10080, elite: "swift", elitePicks: [6] },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 16710 },
      ],
    },
    {
      name: "Redemoinho do Farol",
      groups: [
        { enemyId: "queenMoray", count: 1, intervalMs: 8000, delayMs: 0 },
        { enemyId: "dartfish", count: 18, intervalMs: 460, delayMs: 6600, elite: "swift", elitePicks: [17] },
        { enemyId: "carrier", count: 9, intervalMs: 1250, delayMs: 10608 },
        { enemyId: "corruptedShark", count: 5, intervalMs: 4200, delayMs: 18408 },
      ],
    },
  ],
};
