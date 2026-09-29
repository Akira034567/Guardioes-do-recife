import type { LevelDefinition, Vec2 } from "../../../types";

/**
 * Canais Profundos — Maré Virada. A lua puxa a água de um lado para o outro.
 *
 * Gerada a partir da geometria validada (canteiros a 82–180 px da rota mais próxima, 90 px entre
 * si) e da curva de ondas da região. Fundo procedural até a arte chegar: a pasta
 * `public/assets/levels/canais-3/` tem as specs da imagem.
 */
// Rota principal: é `waypoints` e também o primeiro canal de `paths`.
const MAIN_ROUTE: Vec2[] = [
  { x: -30, y: 140 },
  { x: 150, y: 140 },
  { x: 400, y: 130 },
  { x: 650, y: 140 },
  { x: 900, y: 130 },
  { x: 1100, y: 150 },
  { x: 1180, y: 220 },
  { x: 1150, y: 300 },
  { x: 1000, y: 330 },
  { x: 750, y: 320 },
  { x: 500, y: 330 },
  { x: 250, y: 330 },
  { x: 130, y: 360 },
  { x: 110, y: 430 },
  { x: 200, y: 500 },
  { x: 450, y: 510 },
  { x: 700, y: 500 },
  { x: 950, y: 510 },
  { x: 1150, y: 500 },
  { x: 1310, y: 500 },
];

export const CANAIS_THREE: LevelDefinition = {
  id: "canais-3",
  name: "Maré Virada",
  subtitle: "A lua puxa a água de um lado para o outro",
  briefing:
    "Três fileiras de canal e a maré mudando de ideia o tempo todo. A corrente que segura o cardume agora vai empurrá-lo daqui a pouco.",
  quote: "Não brigue com a maré: espere ela virar a seu favor.",
  theme: { water: 0x0a3b5e, sand: 0x6d8a92, path: 0x9fd8ea, rock: 0x353c48 },
  startingPearls: 400,
  reefHealth: 20,
  initialWaveDelayMs: 12_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 1.18, speed: 1.5, reward: 1.05 },
  enemyOverrides: { tidebreaker: { maxHealth: 1300 }, queenMoray: { maxHealth: 1500 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "vidas", kind: "minLivesRemaining", value: 12 },
    { id: "sem-venda", kind: "noSell" },
  ],
  objectivesByDifficulty: {
    dificil: [
      { id: "completar", kind: "complete" },
      { id: "vidas", kind: "minLivesRemaining", value: 12 },
      { id: "poucos", kind: "maxGuardians", value: 12 },
    ],
    abissal: [
      { id: "completar", kind: "complete" },
      { id: "intacto", kind: "noLeaks" },
      { id: "especies", kind: "maxDistinctGuardians", value: 3 },
    ],
  },
  waypoints: MAIN_ROUTE,
  placements: [
    { id: "fileira-1a", x: 300, y: 235 },
    { id: "fileira-1b", x: 560, y: 230 },
    { id: "fileira-1c", x: 820, y: 235 },
    { id: "curva-norte", x: 1030, y: 235 },
    { id: "fileira-2a", x: 380, y: 420 },
    { id: "fileira-2b", x: 640, y: 415 },
    { id: "fileira-2c", x: 900, y: 420 },
    { id: "curva-sul", x: 1170, y: 405 },
    { id: "margem-oeste", x: 70, y: 250 },
  ],
  currents: [
    {
      id: "fileira-1",
      x: 380,
      y: 100,
      width: 540,
      height: 70,
      direction: { x: -1, y: 0 },
      speedModifier: 0.3,
      projectileDrift: 40,
      flipEveryMs: 15000,
    },
    {
      id: "fileira-2",
      x: 480,
      y: 290,
      width: 540,
      height: 70,
      direction: { x: 1, y: 0 },
      speedModifier: 0.3,
      projectileDrift: 40,
      flipEveryMs: 15000,
    },
    {
      id: "fileira-3",
      x: 430,
      y: 470,
      width: 540,
      height: 70,
      direction: { x: -1, y: 0 },
      speedModifier: 0.3,
      projectileDrift: 40,
      flipEveryMs: 15000,
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
        { enemyId: "dartfish", count: 5, intervalMs: 460, delayMs: 3360 },
      ],
    },
    {
      name: "Correnteza Suja",
      completionReward: 38,
      groups: [
        { enemyId: "minnow", count: 15, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
      ],
    },
    {
      name: "Ronda Funda",
      completionReward: 34,
      groups: [
        { enemyId: "minnow", count: 14, intervalMs: 200, delayMs: 0 },
        { enemyId: "dartfish", count: 4, intervalMs: 460, delayMs: 2760 },
        { enemyId: "puffer", count: 2, intervalMs: 700, delayMs: 5664 },
      ],
    },
    {
      name: "Olhos no Escuro",
      completionReward: 31,
      groups: [
        { enemyId: "swimmer", count: 3, intervalMs: 650, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2970 },
        { enemyId: "puffer", count: 1, intervalMs: 700, delayMs: 5520 },
      ],
    },
    {
      name: "Fila Indiana",
      completionReward: 28,
      groups: [
        { enemyId: "minnow", count: 17, intervalMs: 200, delayMs: 0 },
        { enemyId: "dartfish", count: 8, intervalMs: 460, delayMs: 2760 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 6768 },
      ],
    },
    {
      name: "Carga Pesada",
      groups: [
        { enemyId: "needlefish", count: 5, intervalMs: 450, delayMs: 0, elite: "regenerating", elitePicks: [4] },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 3150 },
        { enemyId: "shellback", count: 1, intervalMs: 1150, delayMs: 5700 },
      ],
    },
    {
      name: "Enxame",
      groups: [
        { enemyId: "dartfish", count: 12, intervalMs: 460, delayMs: 0 },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 4008 },
      ],
    },
    {
      name: "Escolta",
      groups: [
        { enemyId: "minnow", count: 20, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "puffer", count: 3, intervalMs: 700, delayMs: 5310 },
        { enemyId: "moray", count: 1, intervalMs: 2300, delayMs: 8370 },
      ],
    },
    {
      name: "Dois Braços",
      groups: [
        { enemyId: "swimmer", count: 13, intervalMs: 650, delayMs: 0, elite: "regenerating", elitePicks: [12] },
        { enemyId: "dartfish", count: 13, intervalMs: 460, delayMs: 4920, elite: "camouflaged", elitePicks: [12] },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 8928 },
      ],
    },
    {
      name: "Água Turva",
      groups: [
        { enemyId: "tidebreaker", count: 1, intervalMs: 7000, delayMs: 0 },
        { enemyId: "swimmer", count: 4, intervalMs: 650, delayMs: 6000 },
        { enemyId: "carrier", count: 1, intervalMs: 1250, delayMs: 9360 },
        { enemyId: "corruptedShark", count: 1, intervalMs: 4200, delayMs: 11910 },
        { enemyId: "needlefish", count: 3, intervalMs: 450, delayMs: 16230 },
      ],
    },
    {
      name: "Muralha",
      groups: [
        { enemyId: "dartfish", count: 14, intervalMs: 460, delayMs: 0, elite: "furious", elitePicks: [13] },
        { enemyId: "corruptedShark", count: 2, intervalMs: 4200, delayMs: 4008, elite: "camouflaged", elitePicks: [1] },
        { enemyId: "thief", count: 4, intervalMs: 520, delayMs: 10848 },
      ],
    },
    {
      name: "Investida",
      groups: [
        { enemyId: "minnow", count: 23, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 2, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "shellback", count: 2, intervalMs: 1150, delayMs: 6060 },
      ],
    },
    {
      name: "Maré Alta",
      groups: [
        { enemyId: "needlefish", count: 8, intervalMs: 450, delayMs: 0 },
        { enemyId: "dartfish", count: 15, intervalMs: 460, delayMs: 3960 },
        { enemyId: "puffer", count: 10, intervalMs: 700, delayMs: 7968 },
      ],
    },
    {
      name: "Caçadores",
      groups: [
        { enemyId: "minnow", count: 24, intervalMs: 200, delayMs: 0 },
        { enemyId: "carrier", count: 3, intervalMs: 1250, delayMs: 2760 },
        { enemyId: "puffer", count: 7, intervalMs: 700, delayMs: 6810 },
        { enemyId: "corruptedShark", count: 2, intervalMs: 4200, delayMs: 11550, elite: "armored", elitePicks: [1] },
      ],
    },
    {
      name: "Contracorrente",
      groups: [
        { enemyId: "swimmer", count: 16, intervalMs: 650, delayMs: 0 },
        { enemyId: "dartfish", count: 16, intervalMs: 460, delayMs: 4920, elite: "swift", elitePicks: [15] },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 8928 },
        { enemyId: "ghostJelly", count: 4, intervalMs: 1200, delayMs: 13728, elite: "regenerating", elitePicks: [3] },
      ],
    },
    {
      name: "Tempestade",
      groups: [
        { enemyId: "dartfish", count: 17, intervalMs: 460, delayMs: 0, elite: "armored", elitePicks: [16] },
        { enemyId: "carrier", count: 4, intervalMs: 1250, delayMs: 4008, elite: "resilient", elitePicks: [3] },
        { enemyId: "puffer", count: 7, intervalMs: 700, delayMs: 8808 },
      ],
    },
    {
      name: "Arrastão",
      groups: [
        { enemyId: "dartfish", count: 17, intervalMs: 460, delayMs: 0 },
        { enemyId: "corruptedShark", count: 4, intervalMs: 4200, delayMs: 4008 },
        { enemyId: "ghostJelly", count: 4, intervalMs: 1200, delayMs: 15888 },
      ],
    },
    {
      name: "Maré Virada",
      groups: [
        { enemyId: "tidebreaker", count: 2, intervalMs: 7000, delayMs: 0 },
        { enemyId: "minnow", count: 28, intervalMs: 200, delayMs: 10200 },
        { enemyId: "carrier", count: 6, intervalMs: 1250, delayMs: 12960 },
        { enemyId: "shellback", count: 6, intervalMs: 1150, delayMs: 19260 },
        { enemyId: "corruptedShark", count: 3, intervalMs: 4200, delayMs: 25200 },
      ],
    },
  ],
};
