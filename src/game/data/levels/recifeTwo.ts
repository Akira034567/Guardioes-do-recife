import { LEVEL_BACKGROUND_KEYS } from "../../assets/levelBackgrounds";
import type { LevelDefinition } from "../../types";
import { ECONOMY } from "../balance";

/**
 * Fase 2 — Canal das Algas. Dois laços ligados por um canal reto: os peixes
 * sobem pela esquerda, dão a volta no laço oeste, cruzam o canal, contornam o
 * laço leste e descem pela direita. Introduz cardumes e Cascudos.
 * Geometria alinhada ao fundo pintado (`recife-two/background.png`).
 */
export const RECIFE_TWO: LevelDefinition = {
  id: "recife-2",
  name: "Canal das Algas",
  subtitle: "Cardumes e os primeiros Cascudos",
  briefing:
    "As algas altas escondem o canal e o que vem por dentro dele. Cardumes inteiros sobem pelo laço oeste, e atrás deles chegam os primeiros Cascudos.",
  quote: "Quem se esconde nas algas já decidiu atacar.",
  backgroundKey: LEVEL_BACKGROUND_KEYS["recife-2"],
  theme: { water: 0x0d6b8a, sand: 0x7fb8c7, path: 0x9ff0ff, rock: 0x2b4f66 },
  startingPearls: ECONOMY.startingPearls + 40,
  reefHealth: ECONOMY.reefHealth,
  initialWaveDelayMs: 10_000,
  betweenWaveDelayMs: 8_000,
  enemyScaling: { health: 0.9, speed: 1.03, reward: 1.15 },
  enemyOverrides: { tidebreaker: { maxHealth: 480 } },
  objectives: [
    { id: "completar", kind: "complete" },
    { id: "intacto", kind: "noLeaks" },
    { id: "rapido", kind: "underTimeMs", value: 360_000 },
  ],
  waypoints: [
    { x: 397, y: 681 },
    { x: 397, y: 655 },
    { x: 397, y: 581 },
    { x: 397, y: 501 },
    { x: 397, y: 421 },
    { x: 397, y: 333 },
    { x: 398, y: 301 },
    { x: 398, y: 241 },
    { x: 399, y: 182 },
    { x: 378, y: 140 },
    { x: 347, y: 116 },
    { x: 299, y: 100 },
    { x: 252, y: 103 },
    { x: 207, y: 121 },
    { x: 171, y: 147 },
    { x: 144, y: 185 },
    { x: 136, y: 231 },
    { x: 147, y: 266 },
    { x: 173, y: 292 },
    { x: 215, y: 305 },
    { x: 280, y: 305 },
    { x: 353, y: 307 },
    { x: 400, y: 305 },
    { x: 480, y: 305 },
    { x: 560, y: 305 },
    { x: 640, y: 305 },
    { x: 720, y: 305 },
    { x: 800, y: 305 },
    { x: 880, y: 305 },
    { x: 960, y: 305 },
    { x: 1040, y: 305 },
    { x: 1098, y: 298 },
    { x: 1132, y: 275 },
    { x: 1150, y: 237 },
    { x: 1148, y: 198 },
    { x: 1134, y: 167 },
    { x: 1106, y: 139 },
    { x: 1067, y: 118 },
    { x: 1019, y: 107 },
    { x: 966, y: 110 },
    { x: 922, y: 132 },
    { x: 887, y: 177 },
    { x: 882, y: 233 },
    { x: 881, y: 298 },
    { x: 882, y: 314 },
    { x: 883, y: 401 },
    { x: 884, y: 481 },
    { x: 885, y: 581 },
    { x: 885, y: 655 },
    { x: 885, y: 681 },
  ],
  placements: [
    { id: "laco-oeste", x: 268, y: 206 },
    { id: "laco-leste", x: 1010, y: 206 },
    { id: "pedra-norte", x: 515, y: 171 },
    { id: "pedra-nordeste", x: 770, y: 186 },
    { id: "pedra-central", x: 640, y: 421 },
    { id: "pedra-sudoeste", x: 270, y: 471 },
    { id: "pedra-sudeste", x: 1000, y: 461 },
  ],
  currents: [
    {
      id: "canal-das-algas",
      x: 470,
      y: 262,
      width: 400,
      height: 86,
      direction: { x: 1, y: 0 },
      speedModifier: 0.25,
      projectileDrift: 40,
    },
  ],
  waves: [
    {
      name: "Reconhecimento",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 850, delayMs: 0 },
        { enemyId: "dartfish", count: 3, intervalMs: 850, delayMs: 3500 },
      ],
    },
    {
      name: "Cardume",
      groups: [
        { enemyId: "minnow", count: 10, intervalMs: 250, delayMs: 0 },
        { enemyId: "swimmer", count: 4, intervalMs: 850, delayMs: 3000 },
      ],
    },
    {
      name: "Cascos Duros",
      groups: [
        { enemyId: "shellback", count: 3, intervalMs: 1700, delayMs: 0 },
        { enemyId: "swimmer", count: 6, intervalMs: 800, delayMs: 1500 },
      ],
    },
    {
      name: "Enxurrada",
      groups: [
        { enemyId: "minnow", count: 10, intervalMs: 240, delayMs: 0 },
        { enemyId: "dartfish", count: 5, intervalMs: 700, delayMs: 2600 },
        { enemyId: "shellback", count: 3, intervalMs: 1900, delayMs: 5000 },
      ],
    },
    {
      name: "Maré Cheia",
      groups: [
        { enemyId: "swimmer", count: 8, intervalMs: 720, delayMs: 0 },
        { enemyId: "minnow", count: 10, intervalMs: 230, delayMs: 3000 },
        { enemyId: "dartfish", count: 5, intervalMs: 650, delayMs: 6500 },
      ],
    },
    {
      name: "Quebra-Marés Blindado",
      groups: [
        { enemyId: "shellback", count: 3, intervalMs: 1500, delayMs: 0 },
        { enemyId: "minnow", count: 10, intervalMs: 250, delayMs: 3000 },
        { enemyId: "tidebreaker", count: 1, intervalMs: 1000, delayMs: 7000 },
      ],
    },
  ],
};
