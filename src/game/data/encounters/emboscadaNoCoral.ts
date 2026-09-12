import type { LevelDefinition } from "../../types";

/**
 * Encontro — Emboscada no Coral (Peixe-Pedra). Só abre para quem achou a pedra que pisca na Espiral
 * de Coral. Um toque no leito e ele emerge: a partir daí luta junto, enterrado na rota, e o jogador
 * sente a armadilha antes de tê-lo na coleção.
 */
export const EMBOSCADA_NO_CORAL: LevelDefinition = {
  id: "emboscada-no-coral",
  name: "Emboscada no Coral",
  subtitle: "A pedra que pisca não era uma pedra",
  kind: "encounter",
  encounterId: "emboscada-no-coral",
  theme: { water: 0x0c4a5e, sand: 0x7ab0b8, path: 0x9deaf5, rock: 0x2a4a58 },
  startingPearls: 220,
  reefHealth: 10,
  initialWaveDelayMs: 13_000,
  betweenWaveDelayMs: 9_000,
  enemyScaling: { health: 1, speed: 1.04, reward: 1.25 },
  waypoints: [
    { x: -40, y: 180 },
    { x: 160, y: 180 },
    { x: 320, y: 200 },
    { x: 440, y: 260 },
    { x: 520, y: 350 },
    { x: 600, y: 440 },
    { x: 720, y: 490 },
    { x: 860, y: 470 },
    { x: 960, y: 400 },
    { x: 1020, y: 300 },
    { x: 1080, y: 200 },
    { x: 1320, y: 170 },
  ],
  placements: [
    { id: "coral-norte", x: 300, y: 330 },
    { id: "coral-oeste", x: 120, y: 330 },
    { id: "coral-central", x: 640, y: 290 },
    { id: "coral-sul", x: 760, y: 340 },
    { id: "coral-leste", x: 900, y: 250 },
  ],
  currents: [
    {
      id: "sopro-da-espiral",
      x: 640,
      y: 440,
      width: 250,
      height: 80,
      direction: { x: 1, y: -0.2 },
      speedModifier: 0.24,
      projectileDrift: 28,
    },
  ],
  interactables: [
    {
      id: "pedra-viva",
      x: 470,
      y: 320,
      radius: 34,
      label: "Pedra que pisca",
      goal: { type: "reveal" },
      ally: { guardianId: "stonefish", x: 520, y: 350 },
      messages: {
        idle: "Alguma coisa pisca no leito. Toque.",
        done: "Não era pedra.",
      },
    },
  ],
  waves: [
    {
      name: "Fila do coral",
      groups: [
        { enemyId: "swimmer", count: 6, intervalMs: 820, delayMs: 0 },
        { enemyId: "needlefish", count: 3, intervalMs: 800, delayMs: 3200 },
      ],
    },
    {
      name: "Espinhos",
      groups: [
        { enemyId: "needlefish", count: 5, intervalMs: 650, delayMs: 0 },
        { enemyId: "minnow", count: 10, intervalMs: 250, delayMs: 2500 },
      ],
    },
    {
      name: "Passagem fechada",
      groups: [
        { enemyId: "shellback", count: 3, intervalMs: 1700, delayMs: 0 },
        { enemyId: "dartfish", count: 5, intervalMs: 700, delayMs: 2600 },
        { enemyId: "needlefish", count: 4, intervalMs: 700, delayMs: 5600 },
      ],
    },
  ],
};
