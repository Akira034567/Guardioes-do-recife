import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Breu Azul. Onde a luz do sol não chega.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-8/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: 1310, y: 520 },
  { x: 1140, y: 520 },
  { x: 1000, y: 470 },
  { x: 880, y: 380 },
  { x: 760, y: 290 },
  { x: 620, y: 220 },
  { x: 460, y: 180 },
  { x: 300, y: 170 },
  { x: 160, y: 140 },
  { x: -30, y: 140 },
];

export const CANAIS_EIGHT: LevelDefinition = {
  id: "canais-8",
  name: "Breu Azul",
  subtitle: "Onde a luz do sol não chega",
  briefing:
    "O fundo mais escuro dos Canais. A névoa quase não sai, os camuflados nadam à vontade e os ladrões correm atrás das suas pérolas.",
  quote: "No breu, a luz é o esquadrão inteiro.",
  theme: { water: 0x0a2a45, sand: 0x5d6f7a, path: 0x8cc2dd, rock: 0x2a2e3a },
  startingPearls: 420,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.38, speed: 0.88, reward: 1.4 },
  enemyOverrides: { tidebreaker: { maxHealth: 1100 }, queenMoray: { maxHealth: 1250 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 12 },
    { id: "elites", kind: "noEliteLeaks" },
  ],
  objectivesByDifficulty: {
    dificil: [
      { id: "completar", kind: "complete" },
      { id: "elites", kind: "noEliteLeaks" },
      { id: "vidas", kind: "minLivesRemaining", value: 8 },
    ],
    abissal: [
      { id: "completar", kind: "complete" },
      { id: "vidas", kind: "minLivesRemaining", value: 6 },
      { id: "sem-venda", kind: "noSell" },
    ],
  },
  waypoints: MAIN_ROUTE,
  paths: [
    { id: "main", waypoints: MAIN_ROUTE },
    { id: "fundo", waypoints: [
      { x: 1310, y: 520 },
      { x: 1140, y: 520 },
      { x: 960, y: 545 },
      { x: 760, y: 545 },
      { x: 580, y: 525 },
      { x: 420, y: 480 },
      { x: 300, y: 400 },
      { x: 220, y: 300 },
      { x: 160, y: 210 },
      { x: 110, y: 150 },
      { x: -30, y: 140 },
    ] },
  ],
  placements: [
    { id: "breu-1", x: 720, y: 430 },
    { id: "breu-2", x: 540, y: 380 },
    { id: "breu-3", x: 380, y: 320 },
    { id: "barranco", x: 1030, y: 370 },
    { id: "pedra-alta", x: 720, y: 160 },
    { id: "mirante", x: 560, y: 100 },
    { id: "foz", x: 100, y: 300 },
    { id: "banco-sul", x: 280, y: 540 },
  ],
  currents: [
    {
      id: "diagonal",
      x: 600,
      y: 200,
      width: 300,
      height: 200,
      direction: { x: 1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
    {
      id: "fundo",
      x: 560,
      y: 505,
      width: 420,
      height: 60,
      direction: { x: 1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
  ],
  whirlpools: [
    {
      id: "breu",
      label: "Redemoinho do Breu",
      x: 880,
      y: 380,
      radius: 70,
      pullBack: 170,
      intervalMs: 2500,
      dormant: { activeMs: 8000, cooldownMs: 15000 },
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
      completionReward: 48,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Cardume Dividido",
      specialModifiers: [{ type: "fog" }],
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
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970 },
      ],
    },
    {
      name: "Correnteza Suja",
      specialModifiers: [{ type: "fog" }],
      completionReward: 40,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970 },
      ],
    },
    {
      name: "Ronda Funda",
      completionReward: 38,
      groups: [
        { enemyId: "minnow", count: 13, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2760 },
      ],
    },
    {
      name: "Olhos no Escuro",
      specialModifiers: [{ type: "fog" }],
      completionReward: 35,
      groups: [
        { enemyId: "minnow", count: 10, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2760 },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 32,
      groups: [
        { enemyId: "minnow", count: 15, intervalMs: 200, delayMs: 0 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 2760 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 5400 },
      ],
    },
    {
      name: "Carga Pesada",
      specialModifiers: [{ type: "fog" }],
      completionReward: 30,
      groups: [
        { enemyId: "minnow", count: 16, intervalMs: 200, delayMs: 0 },
        { enemyId: "ghostJelly", count: 1, intervalMs: 1200, delayMs: 2760, pathId: "fundo" },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 5280 },
      ],
    },
    {
      name: "Enxame",
      completionReward: 28,
      groups: [
        { enemyId: "minnow", count: 17, intervalMs: 200, delayMs: 0, pathId: "fundo" },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 2760 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5496 },
      ],
    },
    {
      name: "Escolta",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0, elite: "regenerating", elitePicks: [3] },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 3360 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 6600 },
      ],
    },
    {
      name: "Dois Braços",
      groups: [
        { enemyId: "swimmer", count: 8, intervalMs: 650, delayMs: 0, elite: "camouflaged", elitePicks: [7] },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 4920 },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 7656 },
      ],
    },
    {
      name: "Água Turva",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "dartfish", count: 12, intervalMs: 460, delayMs: 0, elite: "swift", elitePicks: [11] },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 4008, elite: "camouflaged", elitePicks: [1] },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 7248, elite: "regenerating", elitePicks: [1] },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "dartfish", count: 13, intervalMs: 460, delayMs: 0, elite: "armored", elitePicks: [12] },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 4008 },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 7056, pathId: "fundo" },
      ],
    },
    {
      name: "Investida",
      specialModifiers: [{ type: "fog" }, { type: "noEarlyStart" }],
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0 },
        { enemyId: "dartfish", count: 2, intervalMs: 460, delayMs: 6000, pathId: "fundo" },
        { enemyId: "ghostJelly", count: 1, intervalMs: 1200, delayMs: 8352 },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 10872, pathId: "fundo" },
      ],
    },
    {
      name: "Maré Alta",
      groups: [
        { enemyId: "swimmer", count: 12, intervalMs: 650, delayMs: 0, pathId: "fundo" },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 4920 },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 7968, pathId: "fundo" },
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 12288, elite: "resilient", elitePicks: [6] },
      ],
    },
    {
      name: "Caçadores",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 0 },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 3690, pathId: "fundo", elite: "swift", elitePicks: [1] },
        { enemyId: "puffer", count: 5, intervalMs: 700, delayMs: 6930 },
        { enemyId: "swimmer", count: 9, intervalMs: 650, delayMs: 10830, pathId: "fundo" },
      ],
    },
    {
      name: "Contracorrente",
      groups: [
        { enemyId: "dartfish", count: 14, intervalMs: 460, delayMs: 0, pathId: "fundo" },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 4008, elite: "camouflaged", elitePicks: [3] },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 7056, pathId: "fundo" },
        { enemyId: "puffer", count: 5, intervalMs: 700, delayMs: 9816 },
      ],
    },
    {
      name: "Tempestade",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "minnow", count: 23, intervalMs: 200, delayMs: 0 },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 2760, pathId: "fundo" },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 6000 },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 9180 },
      ],
    },
    {
      name: "Arrastão",
      groups: [
        { enemyId: "swimmer", count: 15, intervalMs: 650, delayMs: 0, pathId: "fundo" },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 4920 },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 8280 },
        { enemyId: "dartfish", count: 15, intervalMs: 460, delayMs: 13080, elite: "camouflaged", elitePicks: [14] },
      ],
    },
    {
      name: "Maré Negra",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0 },
        { enemyId: "ghostJelly", count: 3, intervalMs: 1200, delayMs: 3960 },
        { enemyId: "corruptedShark", count: 2, intervalMs: 4200, delayMs: 7920, elite: "camouflaged", elitePicks: [1] },
        { enemyId: "swimmer", count: 14, intervalMs: 650, delayMs: 14760, elite: "furious", elitePicks: [13] },
      ],
    },
    {
      name: "Última Luz",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0 },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 3960 },
        { enemyId: "corruptedShark", count: 3, intervalMs: 4200, delayMs: 7320 },
      ],
    },
    {
      name: "Fundo do Canal",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "dartfish", count: 16, intervalMs: 460, delayMs: 0 },
        { enemyId: "ghostJelly", count: 3, intervalMs: 1200, delayMs: 4008 },
        { enemyId: "carrier", count: 3, intervalMs: 1250, delayMs: 7968 },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 12018, pathId: "fundo" },
      ],
    },
    {
      name: "Sombra Longa",
      groups: [
        { enemyId: "minnow", count: 26, intervalMs: 200, delayMs: 0 },
        { enemyId: "thief", count: 5, intervalMs: 520, delayMs: 2760 },
        { enemyId: "corruptedShark", count: 3, intervalMs: 4200, delayMs: 6120, pathId: "fundo" },
        { enemyId: "puffer", count: 12, intervalMs: 700, delayMs: 15480 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 20640, pathId: "fundo" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 23160 },
      ],
    },
    {
      name: "Rede Rasgada",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "dartfish", count: 17, intervalMs: 460, delayMs: 0, elite: "resilient", elitePicks: [16] },
        { enemyId: "ghostJelly", count: 3, intervalMs: 1200, delayMs: 4008, pathId: "fundo" },
        { enemyId: "carrier", count: 7, intervalMs: 1250, delayMs: 7968, elite: "swift", elitePicks: [6] },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 15018, pathId: "fundo" },
      ],
    },
    {
      name: "Breu Azul",
      specialModifiers: [{ type: "noEarlyStart" }],
      groups: [
        { enemyId: "queenMoray", count: 1, intervalMs: 8000, delayMs: 0, pathId: "fundo" },
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 6600 },
        { enemyId: "needlefish", count: 10, intervalMs: 450, delayMs: 12600, pathId: "fundo", elite: "resilient", elitePicks: [9] },
        { enemyId: "thief", count: 6, intervalMs: 520, delayMs: 16560 },
        { enemyId: "carrier", count: 7, intervalMs: 1250, delayMs: 20232, pathId: "fundo" },
        { enemyId: "corruptedShark", count: 4, intervalMs: 4200, delayMs: 27282 },
      ],
    },
  ],
};
