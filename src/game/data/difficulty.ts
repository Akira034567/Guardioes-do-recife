import { createRng, hashSeed } from "../core/Rng";
import type { LevelDefinition, WaveDefinition, WaveGroupDefinition } from "../types";
import { ENEMIES } from "./enemies";
import { eliteAllowedFor, ELITE_IDS, type EliteId } from "./elites";

export type DifficultyId = "normal" | "dificil" | "abissal";

/**
 * Dificuldade (item 31): nunca é só "multiplicar vida". Cada nível mexe em vida, velocidade, contagem,
 * chance de elite, recompensa e pérolas iniciais. O motor não conhece dificuldade: `resolveLevelForDifficulty`
 * produz uma fase nova e o resto do jogo segue igual.
 */
export interface DifficultyDefinition {
  id: DifficultyId;
  name: string;
  description: string;
  /** Cor da dificuldade nas telas (o marcador de ondas e a borda do cartão escolhido). */
  accent: string;
  /** Uma linha sobre o que muda, para o cartão da tela de preparação. */
  pitch: string;
  /** Multiplicadores aplicados por cima de `enemyScaling` da fase. */
  enemyHealth: number;
  enemySpeed: number;
  /** Multiplica a quantidade de cada grupo (mínimo 1 inimigo por grupo existente). */
  enemyCount: number;
  /** 0..1: chance de cada spawn elegível virar elite. */
  eliteChance: number;
  eliteAllowed?: EliteId[];
  /** Multiplica recompensas por abate e bônus de onda/fase. */
  pearlReward: number;
  /** Multiplica as pérolas iniciais. */
  startingPearls: number;
  /** Multiplica as vidas do Recife (ausente = iguais). */
  reefHealth?: number;
  /** Último retoque na onda já resolvida (eventos, composições especiais). */
  waveComposition?: (wave: WaveDefinition, context: { level: LevelDefinition; waveIndex: number; random: () => number }) => WaveDefinition;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDefinition> = {
  normal: {
    id: "normal",
    name: "Normal",
    description: "O Recife como foi desenhado.",
    accent: "#5fe0b4",
    pitch: "Equilíbrio para explorar a fase.",
    enemyHealth: 1,
    enemySpeed: 1,
    enemyCount: 1,
    eliteChance: 0,
    pearlReward: 1,
    startingPearls: 1,
  },
  dificil: {
    id: "dificil",
    name: "Difícil",
    description: "Invasores mais resistentes e em maior número; elites aparecem de vez em quando.",
    accent: "#ffa23c",
    pitch: "Inimigos mais fortes e mais numerosos.",
    enemyHealth: 1.25,
    enemySpeed: 1.05,
    enemyCount: 1.15,
    eliteChance: 0.15,
    pearlReward: 1.1,
    startingPearls: 0.9,
  },
  abissal: {
    id: "abissal",
    name: "Abissal",
    description: "A maré negra: cardumes maiores, elites frequentes e poucas pérolas para começar.",
    accent: "#c08bff",
    pitch: "Um verdadeiro teste para os guardiões.",
    enemyHealth: 1.6,
    enemySpeed: 1.12,
    enemyCount: 1.3,
    eliteChance: 0.35,
    pearlReward: 1.2,
    startingPearls: 0.8,
    reefHealth: 0.75,
  },
};

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as DifficultyId[];

export function isDifficultyId(value: string | null | undefined): value is DifficultyId {
  return typeof value === "string" && (DIFFICULTY_IDS as string[]).includes(value);
}

export function difficultyOf(value: string | null | undefined): DifficultyDefinition {
  return isDifficultyId(value) ? DIFFICULTIES[value] : DIFFICULTIES.normal;
}

/**
 * Devolve uma NOVA fase com a dificuldade aplicada (a original nunca é tocada). Os sorteios de elite
 * são resolvidos aqui, com semente estável, para que a simulação, o preview da onda e a partida real
 * vejam exatamente a mesma composição.
 */
export function resolveLevelForDifficulty(level: LevelDefinition, difficulty: DifficultyDefinition, seed: string = level.id): LevelDefinition {
  if (difficulty.id === "normal") return level;
  const pool = difficulty.eliteAllowed ?? ELITE_IDS;
  const waves = level.waves.map((wave, waveIndex) => {
    const random = createRng(hashSeed(seed, difficulty.id, waveIndex)).next;
    const scaled: WaveDefinition = {
      ...wave,
      groups: wave.groups.map((group, groupIndex) => scaleGroup(group, groupIndex, difficulty, pool, random)),
      completionReward: wave.completionReward === undefined ? undefined : Math.round(wave.completionReward * difficulty.pearlReward),
    };
    return difficulty.waveComposition ? difficulty.waveComposition(scaled, { level, waveIndex, random }) : scaled;
  });
  return {
    ...level,
    startingPearls: Math.round(level.startingPearls * difficulty.startingPearls),
    reefHealth: Math.max(1, Math.round(level.reefHealth * (difficulty.reefHealth ?? 1))),
    enemyScaling: {
      health: level.enemyScaling.health * difficulty.enemyHealth,
      speed: level.enemyScaling.speed * difficulty.enemySpeed,
      reward: level.enemyScaling.reward * difficulty.pearlReward,
    },
    levelClearBonus: level.levelClearBonus === undefined ? undefined : Math.round(level.levelClearBonus * difficulty.pearlReward),
    waves,
  };
}

function scaleGroup(
  group: WaveGroupDefinition,
  groupIndex: number,
  difficulty: DifficultyDefinition,
  pool: readonly EliteId[],
  random: () => number,
): WaveGroupDefinition {
  const base = ENEMIES[group.enemyId];
  // Chefes nunca se multiplicam: um chefe é um chefe.
  const count = base.isBoss ? group.count : Math.max(1, Math.round(group.count * difficulty.enemyCount));
  const scaled: WaveGroupDefinition = { ...group, count };
  if (group.elite || difficulty.eliteChance <= 0 || !eliteAllowedFor(base) || pool.length === 0) return scaled;
  const picks: number[] = [];
  const elites: EliteId[] = [];
  for (let spawnIndex = 0; spawnIndex < count; spawnIndex += 1) {
    if (random() >= difficulty.eliteChance) continue;
    picks.push(spawnIndex);
    elites.push(pool[Math.floor(random() * pool.length) % pool.length]);
  }
  void groupIndex;
  if (picks.length === 0) return scaled;
  return { ...scaled, elite: elites, elitePicks: picks };
}
