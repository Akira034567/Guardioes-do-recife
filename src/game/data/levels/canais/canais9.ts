import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Encruzilhada. Todos os canais se encontram aqui.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-9/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: -30, y: 150 },
  { x: 160, y: 150 },
  { x: 340, y: 190 },
  { x: 500, y: 260 },
  { x: 640, y: 330 },
  { x: 780, y: 400 },
  { x: 940, y: 470 },
  { x: 1100, y: 510 },
  { x: 1310, y: 510 },
];

export const CANAIS_NINE: LevelDefinition = {
  id: "canais-9",
  name: "Encruzilhada",
  subtitle: "Todos os canais se encontram aqui",
  briefing:
    "Dois canais se cruzam no meio do fundo, cada um vindo de um lado. Maré que vira, névoa, redemoinho — e ondas inteiras de elite.",
  quote: "No cruzamento, não existe lado seguro.",
  theme: { water: 0x0b3556, sand: 0x70808e, path: 0x9fcfe6, rock: 0x383a48 },
  startingPearls: 420,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.42, speed: 0.92, reward: 1.42 },
  enemyOverrides: { tidebreaker: { maxHealth: 1300 }, queenMoray: { maxHealth: 1500 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 12 },
    { id: "poucos", kind: "maxGuardians", value: 11 },
  ],
  objectivesByDifficulty: {
    dificil: [
      { id: "completar", kind: "complete" },
      { id: "vidas", kind: "minLivesRemaining", value: 10 },
      { id: "sem-venda", kind: "noSell" },
    ],
    abissal: [
      { id: "completar", kind: "complete" },
      { id: "elites", kind: "noEliteLeaks" },
      { id: "especies", kind: "maxDistinctGuardians", value: 4 },
    ],
  },
  waypoints: MAIN_ROUTE,
  paths: [
    { id: "main", waypoints: MAIN_ROUTE },
    { id: "cruzado", waypoints: [
      { x: -30, y: 510 },
      { x: 160, y: 510 },
      { x: 340, y: 470 },
      { x: 500, y: 400 },
      { x: 640, y: 330 },
      { x: 780, y: 260 },
      { x: 940, y: 190 },
      { x: 1100, y: 150 },
      { x: 1310, y: 150 },
    ] },
  ],
  placements: [
    { id: "cruz-norte", x: 640, y: 190 },
    { id: "cruz-sul", x: 640, y: 470 },
    { id: "cruz-oeste", x: 430, y: 330 },
    { id: "cruz-leste", x: 850, y: 330 },
    { id: "canto-no", x: 280, y: 285 },
    { id: "canto-so", x: 280, y: 390 },
    { id: "canto-ne", x: 1000, y: 290 },
    { id: "canto-se", x: 1000, y: 390 },
    { id: "entrada-n", x: 160, y: 260 },
    { id: "saida-s", x: 1120, y: 360 },
  ],
  currents: [
    {
      id: "norte",
      x: 330,
      y: 160,
      width: 190,
      height: 120,
      direction: { x: -1, y: 0 },
      speedModifier: 0.28,
      projectileDrift: 40,
      flipEveryMs: 14000,
    },
    {
      id: "sul",
      x: 330,
      y: 380,
      width: 190,
      height: 110,
      direction: { x: -1, y: 0 },
      speedModifier: 0.28,
      projectileDrift: 40,
      flipEveryMs: 14000,
    },
  ],
  whirlpools: [
    {
      id: "cruz",
      label: "Redemoinho da Cruz",
      x: 640,
      y: 330,
      radius: 75,
      pullBack: 160,
      intervalMs: 2500,
      dormant: { activeMs: 7000, cooldownMs: 14000 },
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
      completionReward: 45,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Casco e Espinho",
      specialModifiers: [{ type: "fog" }],
      completionReward: 43,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2970 },
      ],
    },
    {
      name: "Correnteza Suja",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.6 }],
      completionReward: 41,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970 },
      ],
    },
    {
      name: "Ronda Funda",
      completionReward: 38,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2970 },
      ],
    },
    {
      name: "Olhos no Escuro",
      specialModifiers: [{ type: "fog" }],
      completionReward: 36,
      groups: [
        { enemyId: "minnow", count: 9, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 34,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 3360 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5910 },
      ],
    },
    {
      name: "Carga Pesada",
      completionReward: 31,
      groups: [
        { enemyId: "minnow", count: 14, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 5310 },
      ],
    },
    {
      name: "Enxame",
      specialModifiers: [{ type: "fog" }, { type: "strongCurrents", multiplier: 1.6 }],
      completionReward: 29,
      groups: [
        { enemyId: "minnow", count: 17, intervalMs: 200, delayMs: 0, pathId: "cruzado" },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5310 },
      ],
    },
    {
      name: "Escolta",
      completionReward: 27,
      groups: [
        { enemyId: "dartfish", count: 5, intervalMs: 460, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 3180 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 5730 },
      ],
    },
    {
      name: "Dois Braços",
      specialModifiers: [{ type: "eliteAll", elite: "armored" }],
      groups: [
        { enemyId: "minnow", count: 18, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 5310, elite: "swift", elitePicks: [1] },
      ],
    },
    {
      name: "Água Turva",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "dartfish", count: 11, intervalMs: 460, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 4008 },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 6558, elite: "resilient", elitePicks: [1] },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "swimmer", count: 9, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 4920, elite: "resilient", elitePicks: [1] },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 8220, pathId: "cruzado" },
      ],
    },
    {
      name: "Investida",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.6 }, { type: "noEarlyStart" }],
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0 },
        { enemyId: "dartfish", count: 2, intervalMs: 460, delayMs: 6000, pathId: "cruzado" },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 8352 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 11112, pathId: "cruzado" },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 13602 },
      ],
    },
    {
      name: "Maré Alta",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "dartfish", count: 13, intervalMs: 460, delayMs: 0, pathId: "cruzado" },
        { enemyId: "carrier", count: 3, intervalMs: 1250, delayMs: 4008, elite: "swift", elitePicks: [2] },
        { enemyId: "puffer", count: 6, intervalMs: 700, delayMs: 8058, pathId: "cruzado", elite: "resilient", elitePicks: [5] },
      ],
    },
    {
      name: "Caçadores",
      groups: [
        { enemyId: "dartfish", count: 13, intervalMs: 460, delayMs: 0 },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 4008, pathId: "cruzado" },
        { enemyId: "puffer", count: 5, intervalMs: 700, delayMs: 6768 },
      ],
    },
    {
      name: "Contracorrente",
      specialModifiers: [{ type: "eliteAll", elite: "swift" }],
      groups: [
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 0, pathId: "cruzado" },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 3690 },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 6990, pathId: "cruzado" },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 11550, elite: "armored", elitePicks: [1] },
      ],
    },
    {
      name: "Tempestade",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "dartfish", count: 12, intervalMs: 460, delayMs: 0 },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 4008, pathId: "cruzado" },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 6768 },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 9948 },
      ],
    },
    {
      name: "Arrastão",
      specialModifiers: [{ type: "strongCurrents", multiplier: 1.6 }],
      groups: [
        { enemyId: "needlefish", count: 7, intervalMs: 450, delayMs: 0, pathId: "cruzado" },
        { enemyId: "carrier", count: 3, intervalMs: 1250, delayMs: 3690 },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 7740 },
        { enemyId: "minnow", count: 23, intervalMs: 200, delayMs: 12300 },
      ],
    },
    {
      name: "Maré Negra",
      groups: [
        { enemyId: "minnow", count: 23, intervalMs: 200, delayMs: 0 },
        { enemyId: "ironShell", count: 2, intervalMs: 1600, delayMs: 2760 },
        { enemyId: "puffer", count: 7, intervalMs: 700, delayMs: 6480 },
        { enemyId: "corruptedShark", count: 2, intervalMs: 4200, delayMs: 11220 },
      ],
    },
    {
      name: "Última Luz",
      specialModifiers: [{ type: "fog" }, { type: "noEarlyStart" }],
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0 },
        { enemyId: "dartfish", count: 15, intervalMs: 460, delayMs: 6000 },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 10008, elite: "furious", elitePicks: [1] },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 13308 },
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 16068, pathId: "cruzado" },
      ],
    },
    {
      name: "Fundo do Canal",
      groups: [
        { enemyId: "minnow", count: 25, intervalMs: 200, delayMs: 0 },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 2760 },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 5520, elite: "armored", elitePicks: [1] },
        { enemyId: "dartfish", count: 14, intervalMs: 460, delayMs: 10080, pathId: "cruzado" },
      ],
    },
    {
      name: "Sombra Longa",
      groups: [
        { enemyId: "swimmer", count: 16, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 5, intervalMs: 1250, delayMs: 4920 },
        { enemyId: "corruptedShark", count: 3, intervalMs: 4200, delayMs: 10470, pathId: "cruzado" },
        { enemyId: "minnow", count: 25, intervalMs: 200, delayMs: 19830 },
      ],
    },
    {
      name: "Rede Rasgada",
      specialModifiers: [{ type: "fog" }, { type: "strongCurrents", multiplier: 1.6 }, { type: "eliteAll", elite: "resilient" }],
      groups: [
        { enemyId: "needlefish", count: 9, intervalMs: 450, delayMs: 0 },
        { enemyId: "ironShell", count: 2, intervalMs: 1600, delayMs: 3960, pathId: "cruzado" },
        { enemyId: "puffer", count: 10, intervalMs: 700, delayMs: 7680 },
        { enemyId: "ghostJelly", count: 3, intervalMs: 1200, delayMs: 12840, pathId: "cruzado" },
      ],
    },
    {
      name: "Ferrões",
      groups: [
        { enemyId: "minnow", count: 26, intervalMs: 200, delayMs: 0, pathId: "cruzado" },
        { enemyId: "carrier", count: 5, intervalMs: 1250, delayMs: 2760, elite: "regenerating", elitePicks: [4] },
        { enemyId: "puffer", count: 11, intervalMs: 700, delayMs: 8310, pathId: "cruzado" },
        { enemyId: "corruptedShark", count: 3, intervalMs: 4200, delayMs: 13470 },
      ],
    },
    {
      name: "Recuo",
      groups: [
        { enemyId: "minnow", count: 27, intervalMs: 200, delayMs: 0 },
        { enemyId: "ironShell", count: 2, intervalMs: 1600, delayMs: 2760, pathId: "cruzado" },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 6480 },
        { enemyId: "dartfish", count: 17, intervalMs: 460, delayMs: 11280, pathId: "cruzado" },
      ],
    },
    {
      name: "Encruzilhada",
      specialModifiers: [{ type: "fog" }, { type: "noEarlyStart" }],
      groups: [
        { enemyId: "queenMoray", count: 1, intervalMs: 8000, delayMs: 0, pathId: "cruzado" },
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 6600 },
        { enemyId: "needlefish", count: 10, intervalMs: 450, delayMs: 12600, pathId: "cruzado" },
        { enemyId: "carrier", count: 9, intervalMs: 1250, delayMs: 16560 },
        { enemyId: "corruptedShark", count: 5, intervalMs: 4200, delayMs: 24360 },
      ],
    },
  ],
};
