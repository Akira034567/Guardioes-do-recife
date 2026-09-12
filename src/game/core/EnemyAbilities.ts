import type { EnemyAbility, EnemyId, EnemyTag, ResolvedEnemyDefinition, StatMultipliers, Vec2 } from "../types";
import type { ControlTarget } from "./CrowdControl";
import type { CurrentSystem } from "./CurrentSystem";
import type { StatusEffectInput } from "./StatusEffects";

/** Modificadores dinâmicos que habilidades e fases de chefe aplicam por cima da definição. */
export interface EnemyMods {
  speed: number;
  armorBonus: number;
  damageTaken: number;
  /** Multiplica o dano ao Recife quando o inimigo passa (fases de chefe). */
  reefDamage: number;
  hidden: boolean;
}

export const NEUTRAL_MODS: EnemyMods = { speed: 1, armorBonus: 0, damageTaken: 1, reefDamage: 1, hidden: false };

/** O que o sistema de habilidades precisa de um inimigo (`MatchEnemy` satisfaz). */
export interface AbilityEnemy extends ControlTarget {
  definition: ResolvedEnemyDefinition;
  health: number;
  pathId: string;
  mods: EnemyMods;
  /** Estado por habilidade (chave = índice na lista ou tipo). */
  abilityState: Map<string, unknown>;
  /** Já sofreu dano alguma vez (camuflagem "até ser atingido"). */
  hitOnce: boolean;
  /** Habilidades ativas nesta instância (a definição + as adicionadas por fases). */
  abilities: EnemyAbility[];
}

export interface AbilityGuardian extends Vec2 {
  id: string;
  applyStatus(input: StatusEffectInput, now: number): void;
}

export type EnemyAbilityEvent =
  | { type: "currentsReversed"; enemyId: string; reversed: boolean }
  | { type: "enraged"; enemyId: string }
  | { type: "split"; enemyId: string; spawned: number }
  | { type: "phaseChanged"; enemyId: string; announcement?: string }
  | { type: "burst"; enemyId: string; on: boolean }
  | { type: "disrupted"; enemyId: string; guardianIds: string[] };

export interface EnemyAbilityWorld<E extends AbilityEnemy> {
  now: number;
  enemies: readonly E[];
  guardians: readonly AbilityGuardian[];
  currents: CurrentSystem;
  spawnEnemy(enemyId: EnemyId, at: { pathId: string; pathDistance: number }): void;
  heal(enemy: E, amount: number): void;
  emit(event: EnemyAbilityEvent): void;
}

interface Handler<A extends EnemyAbility> {
  /** `world`: uma vez por tick para todos os donos vivos (ciclo compartilhado). `enemy`: por inimigo. */
  scope: "enemy" | "world";
  onSpawn?<E extends AbilityEnemy>(ability: A, enemy: E, world: EnemyAbilityWorld<E>): void;
  onTick?<E extends AbilityEnemy>(ability: A, enemy: E, deltaMs: number, world: EnemyAbilityWorld<E>): void;
  onWorldTick?<E extends AbilityEnemy>(ability: A, owners: readonly E[], deltaMs: number, shared: Map<string, unknown>, world: EnemyAbilityWorld<E>): void;
  onDamaged?<E extends AbilityEnemy>(ability: A, enemy: E, amount: number, world: EnemyAbilityWorld<E>): void;
  onDeath?<E extends AbilityEnemy>(ability: A, enemy: E, shared: Map<string, unknown>, world: EnemyAbilityWorld<E>): void;
}

type HandlerFor<K extends EnemyAbility["type"]> = Handler<Extract<EnemyAbility, { type: K }>>;

const state = <T>(enemy: AbilityEnemy, key: string, initial: () => T): T => {
  let value = enemy.abilityState.get(key) as T | undefined;
  if (value === undefined) {
    value = initial();
    enemy.abilityState.set(key, value);
  }
  return value;
};

const isAlive = (enemy: AbilityEnemy): boolean => !enemy.dead && !enemy.reachedGoal;

interface ReverseState {
  cycleMs: number;
  reverseRemainingMs: number;
  reversed: boolean;
}

const REVERSE_SOURCE = "reverseCurrents";

/**
 * Inversão das correntes do mapa enquanto um chefe está vivo. Ciclo único compartilhado por todos os
 * donos vivos; a morte de um dono desfaz a inversão sem zerar o ciclo (comportamento original).
 */
const reverseCurrents: HandlerFor<"reverseCurrents"> = {
  scope: "world",
  onWorldTick(ability, owners, deltaMs, shared, world) {
    const current = (shared.get(REVERSE_SOURCE) as ReverseState | undefined) ?? { cycleMs: 0, reverseRemainingMs: 0, reversed: false };
    shared.set(REVERSE_SOURCE, current);
    const alive = owners.filter(isAlive);
    if (alive.length === 0) {
      current.cycleMs = 0;
      current.reverseRemainingMs = 0;
      if (current.reversed) {
        current.reversed = false;
        world.currents.setReversed(REVERSE_SOURCE, false);
      }
      return;
    }
    if (current.reversed) {
      current.reverseRemainingMs -= deltaMs;
      if (current.reverseRemainingMs <= 0) {
        current.reversed = false;
        current.cycleMs = 0;
        world.currents.setReversed(REVERSE_SOURCE, false);
        world.emit({ type: "currentsReversed", enemyId: alive[0].id, reversed: false });
      }
      return;
    }
    current.cycleMs += deltaMs;
    if (current.cycleMs >= ability.cycleMs) {
      current.reversed = true;
      current.reverseRemainingMs = ability.reverseMs;
      world.currents.setReversed(REVERSE_SOURCE, true);
      world.emit({ type: "currentsReversed", enemyId: alive[0].id, reversed: true });
    }
  },
  onDeath(_ability, _enemy, shared, world) {
    const current = shared.get(REVERSE_SOURCE) as ReverseState | undefined;
    if (!current) return;
    current.reversed = false;
    world.currents.setReversed(REVERSE_SOURCE, false);
  },
};

const regen: HandlerFor<"regen"> = {
  scope: "enemy",
  onTick(ability, enemy, deltaMs, world) {
    const memory = state(enemy, "regen", () => ({ lastHitAt: Number.NEGATIVE_INFINITY }));
    if (world.now - memory.lastHitAt < (ability.delayAfterHitMs ?? 0)) return;
    const cap = enemy.definition.maxHealth * (ability.maxFraction ?? 1);
    if (enemy.health >= cap) return;
    world.heal(enemy, Math.min(cap - enemy.health, ability.hpPerSecond * (deltaMs / 1000)));
  },
  onDamaged(_ability, enemy, _amount, world) {
    state(enemy, "regen", () => ({ lastHitAt: Number.NEGATIVE_INFINITY })).lastHitAt = world.now;
  },
};

const enrageBelowHp: HandlerFor<"enrageBelowHp"> = {
  scope: "enemy",
  onDamaged(ability, enemy, _amount, world) {
    const memory = state(enemy, "enrage", () => ({ done: false }));
    if (memory.done || enemy.health / enemy.definition.maxHealth > ability.threshold) return;
    memory.done = true;
    enemy.mods.speed *= ability.speedMultiplier ?? 1;
    enemy.mods.armorBonus += ability.armorBonus ?? 0;
    enemy.mods.reefDamage *= ability.reefDamageBonus ?? 1;
    world.emit({ type: "enraged", enemyId: enemy.id });
  },
};

const shieldAllies: HandlerFor<"shieldAllies"> = {
  scope: "enemy",
  onTick(ability, enemy, _deltaMs, world) {
    if (!isAlive(enemy)) return;
    for (const ally of world.enemies) {
      if (ally === enemy || !isAlive(ally)) continue;
      if (ability.onlyTags && !ally.definition.tags.some((tag: EnemyTag) => ability.onlyTags?.includes(tag))) continue;
      if (Math.hypot(ally.x - enemy.x, ally.y - enemy.y) > ability.radius) continue;
      ally.status.container.apply({ type: "shield", strength: ability.damageReduction, durationMs: 200, sourceId: enemy.id }, world.now);
    }
  },
};

const disruptGuardians: HandlerFor<"disruptGuardians"> = {
  scope: "enemy",
  onTick(ability, enemy, _deltaMs, world) {
    const memory = state(enemy, "disrupt", () => ({ nextAt: 0 }));
    if (world.now < memory.nextAt || !isAlive(enemy)) return;
    const hit: string[] = [];
    for (const guardian of world.guardians) {
      if (Math.hypot(guardian.x - enemy.x, guardian.y - enemy.y) > ability.radius) continue;
      guardian.applyStatus({ type: "attackSpeedBuff", strength: ability.attackSpeedMultiplier, durationMs: ability.durationMs, sourceId: enemy.id }, world.now);
      hit.push(guardian.id);
    }
    if (hit.length === 0) return;
    memory.nextAt = world.now + ability.intervalMs;
    world.emit({ type: "disrupted", enemyId: enemy.id, guardianIds: hit });
  },
};

const stealth: HandlerFor<"stealth"> = {
  scope: "enemy",
  onSpawn(ability, enemy) {
    enemy.mods.hidden = !(ability.untilDamaged && enemy.hitOnce);
  },
  onTick(ability, enemy, _deltaMs, world) {
    enemy.mods.hidden = !enemy.status.isRevealed(world.now) && !(ability.untilDamaged && enemy.hitOnce);
  },
};

const splitOnDeath: HandlerFor<"splitOnDeath"> = {
  scope: "enemy",
  onDeath(ability, enemy, _shared, world) {
    const memory = state(enemy, "split", () => ({ done: false }));
    if (memory.done) return;
    memory.done = true;
    const spread = ability.spreadPx ?? 12;
    for (let index = 0; index < ability.count; index += 1) {
      const offset = (index - (ability.count - 1) / 2) * spread;
      world.spawnEnemy(ability.enemyId, { pathId: enemy.pathId, pathDistance: Math.max(0, enemy.pathDistance + offset) });
    }
    world.emit({ type: "split", enemyId: enemy.id, spawned: ability.count });
  },
};

const phaseChangeAtHp: HandlerFor<"phaseChangeAtHp"> = {
  scope: "enemy",
  onDamaged(ability, enemy, _amount, world) {
    const memory = state(enemy, `phase:${ability.threshold}`, () => ({ done: false }));
    if (memory.done || enemy.health / enemy.definition.maxHealth > ability.threshold) return;
    memory.done = true;
    applyStatMultipliers(enemy, ability.statMultipliers);
    for (const extra of ability.addAbilities ?? []) {
      enemy.abilities.push(extra);
      handlerFor(extra).onSpawn?.(extra, enemy, world);
    }
    world.emit({ type: "phaseChanged", enemyId: enemy.id, announcement: ability.announcement });
  },
};

const speedBurst: HandlerFor<"speedBurst"> = {
  scope: "enemy",
  onTick(ability, enemy, _deltaMs, world) {
    const memory = state(enemy, "burst", () => ({ nextAt: ability.intervalMs, until: 0, on: false }));
    if (memory.on && world.now >= memory.until) {
      memory.on = false;
      enemy.mods.speed /= ability.multiplier;
      memory.nextAt = world.now + ability.intervalMs;
      world.emit({ type: "burst", enemyId: enemy.id, on: false });
    } else if (!memory.on && world.now >= memory.nextAt) {
      memory.on = true;
      memory.until = world.now + ability.durationMs;
      enemy.mods.speed *= ability.multiplier;
      world.emit({ type: "burst", enemyId: enemy.id, on: true });
    }
  },
};

/** Aplica multiplicadores de atributos a uma instância viva (fases de chefe, fúria). */
export function applyStatMultipliers(enemy: AbilityEnemy, multipliers: StatMultipliers | undefined): void {
  if (!multipliers) return;
  if (multipliers.speed) enemy.mods.speed *= multipliers.speed;
  if (multipliers.armorBonus) enemy.mods.armorBonus += multipliers.armorBonus;
  if (multipliers.reefDamage) enemy.mods.reefDamage *= multipliers.reefDamage;
}

export const ENEMY_ABILITY_HANDLERS: { [K in EnemyAbility["type"]]: HandlerFor<K> } = {
  regen,
  enrageBelowHp,
  shieldAllies,
  disruptGuardians,
  stealth,
  splitOnDeath,
  phaseChangeAtHp,
  speedBurst,
  reverseCurrents,
};

function handlerFor(ability: EnemyAbility): Handler<EnemyAbility> {
  return ENEMY_ABILITY_HANDLERS[ability.type] as unknown as Handler<EnemyAbility>;
}

/** Despacha as habilidades de todos os inimigos por `type`; sem `switch` por id de inimigo. */
export class EnemyAbilitySystem<E extends AbilityEnemy> {
  private readonly shared = new Map<string, unknown>();

  register(enemy: E, world: EnemyAbilityWorld<E>): void {
    for (const ability of enemy.abilities) handlerFor(ability).onSpawn?.(ability, enemy, world);
  }

  /** Habilidades de escopo de mundo (uma vez por tick, por tipo, com todos os donos vivos). */
  worldTick(deltaMs: number, world: EnemyAbilityWorld<E>): void {
    const owners = new Map<EnemyAbility["type"], { ability: EnemyAbility; enemies: E[] }>();
    for (const enemy of world.enemies) {
      for (const ability of enemy.abilities) {
        if (handlerFor(ability).scope !== "world") continue;
        const entry = owners.get(ability.type) ?? { ability, enemies: [] };
        entry.enemies.push(enemy);
        owners.set(ability.type, entry);
      }
    }
    for (const type of Object.keys(ENEMY_ABILITY_HANDLERS) as EnemyAbility["type"][]) {
      const handler = ENEMY_ABILITY_HANDLERS[type] as unknown as Handler<EnemyAbility>;
      if (handler.scope !== "world" || !handler.onWorldTick) continue;
      const entry = owners.get(type);
      // Sem donos vivos o handler ainda roda (para desfazer estado compartilhado), com lista vazia.
      handler.onWorldTick(entry?.ability ?? this.lastAbility(type), entry?.enemies ?? [], deltaMs, this.shared, world);
    }
  }

  tick(deltaMs: number, world: EnemyAbilityWorld<E>): void {
    for (const enemy of world.enemies) {
      if (!isAlive(enemy)) continue;
      for (const ability of enemy.abilities) {
        const handler = handlerFor(ability);
        if (handler.scope === "enemy") handler.onTick?.(ability, enemy, deltaMs, world);
      }
    }
  }

  damaged(enemy: E, amount: number, world: EnemyAbilityWorld<E>): void {
    enemy.hitOnce = true;
    for (const ability of [...enemy.abilities]) handlerFor(ability).onDamaged?.(ability, enemy, amount, world);
  }

  died(enemy: E, world: EnemyAbilityWorld<E>): void {
    for (const ability of enemy.abilities) handlerFor(ability).onDeath?.(ability, enemy, this.shared, world);
  }

  /** Estado compartilhado de uma habilidade de mundo (debug/testes). */
  sharedState<T>(key: string): T | undefined {
    return this.shared.get(key) as T | undefined;
  }

  private lastAbility(type: EnemyAbility["type"]): EnemyAbility {
    const remembered = this.shared.get(`ability:${type}`) as EnemyAbility | undefined;
    return remembered ?? ({ type } as EnemyAbility);
  }
}
