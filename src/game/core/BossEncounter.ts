import type { BossDefinition, BossPhase } from "../types";
import { applyStatMultipliers, type AbilityEnemy, type EnemyAbilityWorld } from "./EnemyAbilities";

export interface BossState {
  id: string;
  name: string;
  title: string;
  phaseIndex: number;
  phaseCount: number;
  healthRatio: number;
}

export type BossEncounterEvent =
  | { type: "bossStarted"; enemyId: string; name: string; title: string; phaseCount: number }
  | { type: "bossPhaseChanged"; enemyId: string; phaseIndex: number; phase: BossPhase }
  | { type: "bossDefeated"; enemyId: string; extraPearls: number }
  | { type: "bossLeaked"; enemyId: string };

/** Chefe sem fases declaradas: uma única fase, comportamento igual ao da definição base. */
export const DEFAULT_BOSS: BossDefinition = { phases: [{ id: "unica", hpThreshold: 1 }] };

export function bossDefinitionOf(definition: { isBoss?: boolean; boss?: BossDefinition }): BossDefinition | null {
  if (definition.boss) return definition.boss;
  return definition.isBoss ? DEFAULT_BOSS : null;
}

/**
 * Encontros de chefe (item 8): acompanha as fases por vida, aplica o que cada fase muda e emite os
 * eventos que a apresentação usa para a barra, o aviso e a música. Sem Phaser.
 */
export class BossEncounter<E extends AbilityEnemy> {
  private readonly tracked = new Map<string, { enemy: E; definition: BossDefinition; phaseIndex: number }>();

  /** Registra um chefe recém-nascido. Devolve o evento de entrada (ou nada, se não for chefe). */
  onSpawn(enemy: E): BossEncounterEvent[] {
    const definition = bossDefinitionOf(enemy.definition);
    if (!definition) return [];
    const phases = orderedPhases(definition);
    this.tracked.set(enemy.id, { enemy, definition: { ...definition, phases }, phaseIndex: 0 });
    return [
      {
        type: "bossStarted",
        enemyId: enemy.id,
        name: enemy.definition.name,
        title: definition.title ?? enemy.definition.name,
        phaseCount: phases.length,
      },
    ];
  }

  /** Verifica os limiares depois de um dano; pode atravessar mais de uma fase num golpe só. */
  onDamaged(enemy: E, world: EnemyAbilityWorld<E>): BossEncounterEvent[] {
    const entry = this.tracked.get(enemy.id);
    if (!entry || enemy.dead) return [];
    const events: BossEncounterEvent[] = [];
    const ratio = enemy.health / Math.max(1, enemy.definition.maxHealth);
    const phases = entry.definition.phases;
    while (entry.phaseIndex + 1 < phases.length && ratio <= phases[entry.phaseIndex + 1].hpThreshold) {
      entry.phaseIndex += 1;
      const phase = phases[entry.phaseIndex];
      applyStatMultipliers(enemy, phase.statMultipliers);
      for (const type of phase.removeAbilityTypes ?? []) {
        for (let index = enemy.abilities.length - 1; index >= 0; index -= 1) {
          if (enemy.abilities[index].type === type) enemy.abilities.splice(index, 1);
        }
      }
      for (const ability of phase.addAbilities ?? []) enemy.abilities.push(ability);
      void world;
      events.push({ type: "bossPhaseChanged", enemyId: enemy.id, phaseIndex: entry.phaseIndex, phase });
    }
    return events;
  }

  /** Chefe saiu do mapa: morto (recompensa extra) ou vazou. */
  onRemoved(enemy: E): BossEncounterEvent[] {
    const entry = this.tracked.get(enemy.id);
    if (!entry) return [];
    this.tracked.delete(enemy.id);
    if (!enemy.dead) return [{ type: "bossLeaked", enemyId: enemy.id }];
    return [{ type: "bossDefeated", enemyId: enemy.id, extraPearls: entry.definition.rewards?.pearls ?? 0 }];
  }

  /** Chefe mais avançado em campo (o de menor vida proporcional), para a barra do HUD. */
  snapshot(): BossState | null {
    let best: BossState | null = null;
    for (const entry of this.tracked.values()) {
      if (entry.enemy.dead || entry.enemy.reachedGoal) continue;
      const healthRatio = entry.enemy.health / Math.max(1, entry.enemy.definition.maxHealth);
      if (best && healthRatio >= best.healthRatio) continue;
      best = {
        id: entry.enemy.id,
        name: entry.enemy.definition.name,
        title: entry.definition.title ?? entry.enemy.definition.name,
        phaseIndex: entry.phaseIndex,
        phaseCount: entry.definition.phases.length,
        healthRatio,
      };
    }
    return best;
  }

  get active(): boolean {
    return this.tracked.size > 0;
  }
}

/** Fases da mais cheia para a mais vazia; a primeira sempre começa em 1 (vida cheia). */
function orderedPhases(definition: BossDefinition): BossPhase[] {
  const phases = [...definition.phases].sort((a, b) => b.hpThreshold - a.hpThreshold);
  if (phases.length === 0) return [{ id: "unica", hpThreshold: 1 }];
  return [{ ...phases[0], hpThreshold: 1 }, ...phases.slice(1)];
}
