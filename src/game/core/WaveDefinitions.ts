import { ECONOMY } from "../data/balance";
import { ENEMIES } from "../data/enemies";
import type { EliteId } from "../data/elites";
import type { EnemyId, LevelDefinition, PathDefinition, WaveDefinition, WaveGroupDefinition, WaveModifier } from "../types";

export const MAIN_PATH_ID = "main";

/** Grupo de onda com todos os campos resolvidos (aliases de autoria já normalizados). */
export interface ResolvedWaveGroup {
  enemyId: EnemyId;
  count: number;
  intervalMs: number;
  delayMs: number;
  pathId: string;
  /** Elite de cada spawn do grupo (null = inimigo comum). Sempre com `count` entradas. */
  elites: Array<EliteId | null>;
}

export interface ResolvedWave {
  index: number;
  name: string;
  groups: ResolvedWaveGroup[];
  modifiers: WaveModifier[];
  completionReward: number;
  isBossWave: boolean;
}

/** Rotas da fase: `waypoints` é sempre a rota principal; `paths` acrescenta alternativas. */
export function resolveLevelPaths(level: Pick<LevelDefinition, "waypoints" | "paths">): PathDefinition[] {
  if (!level.paths || level.paths.length === 0) return [{ id: MAIN_PATH_ID, waypoints: level.waypoints }];
  const [first, ...rest] = level.paths;
  // Por contrato, a primeira rota é a principal e coincide com `waypoints`.
  return [{ ...first, waypoints: level.waypoints }, ...rest];
}

/**
 * Normaliza uma onda de dados para a forma que o motor consome: aceita os aliases de autoria
 * (`enemyGroups`, `spawnInterval`, `spawnDelay`), preenche a rota padrão, expande a marcação de elites
 * e resolve a recompensa e a bandeira de chefe. Onda antiga sem campos novos = comportamento atual.
 */
export function normalizeWave(wave: WaveDefinition, index: number): ResolvedWave {
  const groups = (wave.enemyGroups ?? wave.groups).map((group) => normalizeGroup(group));
  return {
    index,
    name: wave.name,
    groups,
    modifiers: wave.specialModifiers ?? [],
    completionReward: wave.completionReward ?? ECONOMY.waveClearBonus,
    isBossWave: wave.isBossWave ?? groups.some((group) => ENEMIES[group.enemyId]?.isBoss === true),
  };
}

export function normalizeWaves(waves: readonly WaveDefinition[]): ResolvedWave[] {
  return waves.map((wave, index) => normalizeWave(wave, index));
}

function normalizeGroup(group: WaveGroupDefinition): ResolvedWaveGroup {
  const count = Math.max(0, Math.floor(group.count));
  return {
    enemyId: group.enemyId,
    count,
    intervalMs: group.intervalMs ?? group.spawnInterval ?? 0,
    delayMs: group.delayMs ?? group.spawnDelay ?? 0,
    pathId: group.pathId ?? MAIN_PATH_ID,
    elites: resolveElites(group, count),
  };
}

/** `elite` sem `elitePicks` marca todos os spawns; com `elitePicks`, só os índices listados. */
function resolveElites(group: WaveGroupDefinition, count: number): Array<EliteId | null> {
  const elites: Array<EliteId | null> = new Array(count).fill(null);
  if (!group.elite) return elites;
  const pool = Array.isArray(group.elite) ? group.elite : [group.elite];
  if (pool.length === 0) return elites;
  const picks = group.elitePicks ?? elites.map((_, index) => index);
  picks.forEach((spawnIndex, order) => {
    if (spawnIndex < 0 || spawnIndex >= count) return;
    elites[spawnIndex] = pool[order % pool.length];
  });
  return elites;
}
