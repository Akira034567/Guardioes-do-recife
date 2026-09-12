import { ENEMIES, resolveEnemy } from "../data/enemies";
import { applyElite, ELITES, type EliteId } from "../data/elites";
import type { EnemyId, EnemyTag, WaveModifier } from "../types";
import type { ResolvedWave } from "./WaveDefinitions";

export interface WavePreviewEntry {
  enemyId: EnemyId;
  eliteId: EliteId | null;
  /** Nome já com o sufixo de elite ("Cascudo Blindado"). */
  name: string;
  count: number;
  isBoss: boolean;
  tags: EnemyTag[];
  threatLevel: number;
}

export interface WavePreview {
  waveIndex: number;
  name: string;
  isBossWave: boolean;
  totalCount: number;
  entries: WavePreviewEntry[];
  modifiers: WaveModifier[];
  /** Soma dos níveis de ameaça, para ordenar/colorir o aviso no HUD. */
  threat: number;
}

/**
 * Composição da próxima onda para o HUD (item 9): agrupa por inimigo e variação de elite, na ordem em
 * que aparecem. Sem elites nem chefes, é só "🐟 x12".
 */
export function wavePreview(wave: ResolvedWave | null): WavePreview | null {
  if (!wave) return null;
  const entries = new Map<string, WavePreviewEntry>();
  for (const group of wave.groups) {
    group.elites.forEach((eliteId) => {
      const key = `${group.enemyId}#${eliteId ?? ""}`;
      const existing = entries.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      const base = ENEMIES[group.enemyId];
      const definition = eliteId ? applyElite(base, ELITES[eliteId]) : resolveEnemy(base);
      entries.set(key, {
        enemyId: group.enemyId,
        eliteId,
        name: definition.name,
        count: 1,
        isBoss: Boolean(definition.isBoss),
        tags: definition.tags,
        threatLevel: definition.threatLevel,
      });
    });
  }
  const list = [...entries.values()];
  return {
    waveIndex: wave.index,
    name: wave.name,
    isBossWave: wave.isBossWave,
    totalCount: list.reduce((total, entry) => total + entry.count, 0),
    entries: list,
    modifiers: wave.modifiers,
    threat: list.reduce((total, entry) => total + entry.threatLevel * entry.count, 0),
  };
}
