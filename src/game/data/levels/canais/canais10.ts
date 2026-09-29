import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Trono da Moreia. A Rainha dos Canais espera no fundo.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-10/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: -30, y: 320 },
  { x: 120, y: 320 },
  { x: 220, y: 250 },
  { x: 340, y: 195 },
  { x: 480, y: 180 },
  { x: 620, y: 200 },
  { x: 760, y: 180 },
  { x: 900, y: 200 },
  { x: 1030, y: 185 },
  { x: 1120, y: 240 },
  { x: 1180, y: 320 },
  { x: 1310, y: 320 },
];

export const CANAIS_TEN: LevelDefinition = {
  id: "canais-10",
  name: "Trono da Moreia",
  subtitle: "A Rainha dos Canais espera no fundo",
  briefing:
    "O trono da Moreia-Rainha, entre dois canais que se abraçam. Ela muda de canal quando se fere e chama escolta a cada fase. Proteja os dois lados.",
  quote: "Se ela cair, os Canais voltam a ser nossos.",
  theme: { water: 0x0a3050, sand: 0x6c7a8c, path: 0xa0cde8, rock: 0x3a3346 },
  startingPearls: 425,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.46, speed: 0.93, reward: 1.45 },
  enemyOverrides: { tidebreaker: { maxHealth: 1150 }, queenMoray: { maxHealth: 2000 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 10 },
    { id: "elites", kind: "noEliteLeaks" },
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
      { id: "especies", kind: "maxDistinctGuardians", value: 4 },
    ],
  },
  waypoints: MAIN_ROUTE,
  paths: [
    { id: "main", waypoints: MAIN_ROUTE },
    { id: "trono", waypoints: [
      { x: -30, y: 320 },
      { x: 120, y: 320 },
      { x: 220, y: 390 },
      { x: 340, y: 445 },
      { x: 480, y: 460 },
      { x: 620, y: 440 },
      { x: 760, y: 460 },
      { x: 900, y: 440 },
      { x: 1030, y: 455 },
      { x: 1120, y: 400 },
      { x: 1180, y: 320 },
      { x: 1310, y: 320 },
    ] },
  ],
  placements: [
    { id: "trono-1", x: 420, y: 320 },
    { id: "trono-2", x: 600, y: 320 },
    { id: "trono-3", x: 780, y: 320 },
    { id: "trono-4", x: 960, y: 320 },
    { id: "coroa-no", x: 420, y: 100 },
    { id: "coroa-ne", x: 840, y: 102 },
    { id: "coroa-so", x: 480, y: 555 },
    { id: "coroa-se", x: 840, y: 555 },
    { id: "portal-n", x: 110, y: 200 },
    { id: "portal-s", x: 110, y: 445 },
  ],
  currents: [
    {
      id: "norte",
      x: 330,
      y: 150,
      width: 600,
      height: 70,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
      flipEveryMs: 18000,
    },
    {
      id: "sul",
      x: 330,
      y: 410,
      width: 600,
      height: 80,
      direction: { x: -1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
      flipEveryMs: 18000,
    },
  ],
  whirlpools: [
    {
      id: "oeste",
      label: "Redemoinho Oeste",
      x: 340,
      y: 195,
      radius: 65,
      pullBack: 150,
      intervalMs: 6000,
    },
    {
      id: "leste",
      label: "Redemoinho Leste",
      x: 1030,
      y: 455,
      radius: 65,
      pullBack: 150,
      intervalMs: 6000,
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
      completionReward: 46,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
      ],
    },
    {
      name: "Casco e Espinho",
      specialModifiers: [{ type: "fog" }],
      completionReward: 44,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970 },
      ],
    },
    {
      name: "Correnteza Suja",
      completionReward: 41,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970 },
      ],
    },
    {
      name: "Ronda Funda",
      completionReward: 39,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 2970 },
      ],
    },
    {
      name: "Olhos no Escuro",
      specialModifiers: [{ type: "fog" }],
      completionReward: 37,
      groups: [
        { enemyId: "swimmer", count: 2, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2580 },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 35,
      groups: [
        { enemyId: "minnow", count: 15, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
      ],
    },
    {
      name: "Carga Pesada",
      completionReward: 33,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2970 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 5520 },
      ],
    },
    {
      name: "Enxame",
      specialModifiers: [{ type: "fog" }],
      completionReward: 31,
      groups: [
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 0, pathId: "trono" },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 3360 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5910 },
      ],
    },
    {
      name: "Escolta",
      completionReward: 28,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2970 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 5520 },
      ],
    },
    {
      name: "Dois Braços",
      completionReward: 26,
      groups: [
        { enemyId: "minnow", count: 18, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 5310 },
      ],
    },
    {
      name: "Água Turva",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "swimmer", count: 7, intervalMs: 650, delayMs: 0, elite: "furious", elitePicks: [6] },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 4530 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 7080 },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "dartfish", count: 11, intervalMs: 460, delayMs: 0 },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 4008 },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 7308, pathId: "trono" },
      ],
    },
    {
      name: "Investida",
      groups: [
        { enemyId: "swimmer", count: 5, intervalMs: 650, delayMs: 0, elite: "camouflaged", elitePicks: [4] },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 3750, pathId: "trono" },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 6930 },
      ],
    },
    {
      name: "Maré Alta",
      specialModifiers: [{ type: "fog" }, { type: "noEarlyStart" }],
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0, pathId: "trono" },
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 6000 },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 9360, pathId: "trono" },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 12120 },
        { enemyId: "ghostJelly", count: 2, intervalMs: 1200, delayMs: 14610, pathId: "trono" },
      ],
    },
    {
      name: "Caçadores",
      groups: [
        { enemyId: "needlefish", count: 6, intervalMs: 450, delayMs: 0 },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 3420, pathId: "trono" },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 7980, elite: "swift", elitePicks: [1] },
      ],
    },
    {
      name: "Contracorrente",
      groups: [
        { enemyId: "swimmer", count: 13, intervalMs: 650, delayMs: 0, pathId: "trono" },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 4920 },
        { enemyId: "carrier", count: 3, intervalMs: 1250, delayMs: 7680, pathId: "trono" },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 11730 },
      ],
    },
    {
      name: "Tempestade",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "minnow", count: 21, intervalMs: 200, delayMs: 0 },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 2760, pathId: "trono" },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 5940 },
        { enemyId: "swimmer", count: 5, intervalMs: 650, delayMs: 9000 },
      ],
    },
    {
      name: "Arrastão",
      groups: [
        { enemyId: "minnow", count: 22, intervalMs: 200, delayMs: 0, pathId: "trono" },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 2760 },
        { enemyId: "shellback", count: 3, intervalMs: 1150, delayMs: 5520 },
        { enemyId: "dartfish", count: 14, intervalMs: 460, delayMs: 9390, elite: "armored", elitePicks: [13] },
      ],
    },
    {
      name: "Maré Negra",
      groups: [
        { enemyId: "swimmer", count: 14, intervalMs: 650, delayMs: 0 },
        { enemyId: "moray", count: 2, intervalMs: 2300, delayMs: 4920 },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 9480, elite: "regenerating", elitePicks: [3] },
        { enemyId: "thief", count: 3, intervalMs: 520, delayMs: 14280 },
      ],
    },
    {
      name: "Última Luz",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0 },
        { enemyId: "ironShell", count: 2, intervalMs: 1600, delayMs: 3960 },
        { enemyId: "puffer", count: 8, intervalMs: 700, delayMs: 7680, elite: "furious", elitePicks: [7] },
      ],
    },
    {
      name: "Fundo do Canal",
      groups: [
        { enemyId: "swimmer", count: 11, intervalMs: 650, delayMs: 0 },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 4920 },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 8100 },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 11400, pathId: "trono" },
      ],
    },
    {
      name: "Sombra Longa",
      specialModifiers: [{ type: "noEarlyStart" }],
      groups: [
        { enemyId: "tidebreaker", count: 2, intervalMs: 7000, delayMs: 0 },
        { enemyId: "minnow", count: 24, intervalMs: 200, delayMs: 10200 },
        { enemyId: "ironShell", count: 1, intervalMs: 1600, delayMs: 12960, pathId: "trono" },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 15720 },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 18900, pathId: "trono" },
      ],
    },
    {
      name: "Rede Rasgada",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "minnow", count: 25, intervalMs: 200, delayMs: 0 },
        { enemyId: "moray", count: 3, intervalMs: 2300, delayMs: 2760, pathId: "trono" },
        { enemyId: "puffer", count: 8, intervalMs: 700, delayMs: 8700 },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 13860, pathId: "trono", elite: "regenerating", elitePicks: [3] },
      ],
    },
    {
      name: "Ferrões",
      groups: [
        { enemyId: "dartfish", count: 16, intervalMs: 460, delayMs: 0, pathId: "trono" },
        { enemyId: "ironShell", count: 2, intervalMs: 1600, delayMs: 4008 },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 7728, pathId: "trono" },
        { enemyId: "needlefish", count: 9, intervalMs: 450, delayMs: 12528, elite: "regenerating", elitePicks: [8] },
      ],
    },
    {
      name: "Recuo",
      groups: [
        { enemyId: "swimmer", count: 16, intervalMs: 650, delayMs: 0 },
        { enemyId: "moray", count: 3, intervalMs: 2300, delayMs: 4920, pathId: "trono" },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 10860, elite: "swift", elitePicks: [3] },
      ],
    },
    {
      name: "Vigília",
      specialModifiers: [{ type: "fog" }],
      groups: [
        { enemyId: "minnow", count: 26, intervalMs: 200, delayMs: 0, pathId: "trono" },
        { enemyId: "ironShell", count: 4, intervalMs: 1600, delayMs: 2760, elite: "regenerating", elitePicks: [3] },
        { enemyId: "puffer", count: 16, intervalMs: 700, delayMs: 8400, pathId: "trono" },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 13560 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 16080 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 18600 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 21120 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 23640 },
        { enemyId: "minnow", count: 6, intervalMs: 200, delayMs: 26160, pathId: "trono" },
      ],
    },
    {
      name: "Tudo ou Nada",
      groups: [
        { enemyId: "minnow", count: 27, intervalMs: 200, delayMs: 0 },
        { enemyId: "moray", count: 5, intervalMs: 2300, delayMs: 2760, pathId: "trono", elite: "armored", elitePicks: [4] },
        { enemyId: "carrier", count: 7, intervalMs: 1250, delayMs: 11460 },
      ],
    },
    {
      name: "Trono da Moreia",
      specialModifiers: [{ type: "noEarlyStart" }],
      groups: [
        { enemyId: "queenMoray", count: 1, intervalMs: 8000, delayMs: 0, pathId: "trono" },
        { enemyId: "dartfish", count: 18, intervalMs: 460, delayMs: 6600 },
        { enemyId: "ironShell", count: 5, intervalMs: 1600, delayMs: 10608 },
        { enemyId: "moray", count: 6, intervalMs: 2300, delayMs: 17208, elite: "armored", elitePicks: [5] },
      ],
    },
  ],
};
