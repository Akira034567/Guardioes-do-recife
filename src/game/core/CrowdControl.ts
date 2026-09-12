import { CROWD_CONTROL } from "../data/balance";
import type { BossSlow, ControlResistance, ControlTier, EnemyDefinition, PoisonEffect, Vec2 } from "../types";
import type { EnemyStatus } from "./EnemyStatus";
import { STATUS_REGISTRY, type ApplyOutcome, type StatusEffectInput } from "./StatusEffects";

/**
 * Camada única de controle. Toda habilidade que atordoa, empurra, envenena ou marca passa por aqui,
 * para que elites e chefes resistam de forma uniforme (`CROWD_CONTROL` em `balance.ts`) e para que
 * o knockback sempre siga o path.
 */

/** O que o controle precisa de um inimigo (`Enemy` e `SimEnemy` satisfazem). */
export interface ControlTarget extends Vec2 {
  id: string;
  definition: EnemyDefinition;
  status: EnemyStatus;
  pathDistance: number;
  blockedById: string | null;
  dead: boolean;
  reachedGoal: boolean;
  /** Move o inimigo ao longo da rota (clampado em [0, comprimento]) e atualiza x/y. */
  setPathDistance(distance: number): void;
  clearBlocked(): void;
}

export type ControlConfig = Partial<Record<Exclude<ControlTier, "common">, ControlResistance>>;

/** Raio do corpo de um bloqueador na rota (ver `hasReachedBlockerContact`). */
export const BLOCKER_BODY_RADIUS = 28;

export function controlTier(definition: Pick<EnemyDefinition, "role" | "isBoss">): ControlTier {
  if (definition.isBoss || definition.role === "boss") return "boss";
  if (definition.role === "elite") return "elite";
  return "common";
}

export function resistanceFor(tier: ControlTier, config: ControlConfig = CROWD_CONTROL): ControlResistance | null {
  if (tier === "common") return null;
  const entry = config[tier];
  return entry ? { windowMs: entry.windowMs, steps: [...entry.steps], immunityMs: entry.immunityMs } : null;
}

export interface StunOptions {
  /** Fração da duração aplicada a elites (1 = cheia). */
  eliteFactor?: number;
  /** Fração da duração aplicada a chefes. */
  bossFactor?: number;
  /** Imunidade própria da habilidade (Água-viva). 0 deixa a repetição a cargo da resistência global. */
  immunityMs?: number;
  durationMultiplier?: number;
}

function tierFactor(tier: ControlTier, elite: number | undefined, boss: number | undefined): number {
  if (tier === "boss") return boss ?? 1;
  if (tier === "elite") return elite ?? 1;
  return 1;
}

/** Atordoa respeitando fatores por tier e retornos decrescentes. Devolve a duração aplicada (0 = resistiu). */
export function applyStun(
  target: ControlTarget,
  durationMs: number,
  now: number,
  options: StunOptions = {},
  config: ControlConfig = CROWD_CONTROL,
): number {
  if (target.dead || target.reachedGoal) return 0;
  const tier = controlTier(target.definition);
  const resistance = resistanceFor(tier, config);
  const scale = target.status.controlScale(now, tier, resistance);
  const duration = durationMs * tierFactor(tier, options.eliteFactor, options.bossFactor) * scale * (options.durationMultiplier ?? 1);
  if (duration <= 0) return 0;
  if (!target.status.tryStun(duration, options.immunityMs ?? 0, now)) return 0;
  target.status.registerControl(now, tier, resistance);
  return duration;
}

export interface KnockbackOptions {
  /** Fração do deslocamento aplicada a elites. */
  eliteFactor?: number;
  /** Chefes não são empurrados: sofrem este slow (se houver). */
  bossSlow?: BossSlow | null;
  durationMultiplier?: number;
}

export type KnockbackResult = "pushed" | "slowed" | "none";

/**
 * Empurra o inimigo para trás ao longo da rota. Nunca move para coordenadas livres.
 * Um inimigo preso por um bloqueador só é empurrado se sair da janela de contato dele; caso contrário
 * seria re-agarrado no mesmo lugar no próximo tick.
 */
export function knockbackAlongPath(
  target: ControlTarget,
  distance: number,
  now: number,
  options: KnockbackOptions = {},
  config: ControlConfig = CROWD_CONTROL,
): KnockbackResult {
  if (target.dead || target.reachedGoal) return "none";
  const tier = controlTier(target.definition);
  if (tier === "boss") {
    if (!options.bossSlow) return "none";
    target.status.applySlow(options.bossSlow.factor, options.bossSlow.durationMs * (options.durationMultiplier ?? 1), now);
    return "slowed";
  }
  const resistance = resistanceFor(tier, config);
  const scale = target.status.controlScale(now, tier, resistance);
  const push = distance * (tier === "elite" ? (options.eliteFactor ?? 1) : 1) * scale;
  if (push <= 0) return "none";
  if (target.blockedById && push <= BLOCKER_BODY_RADIUS + target.definition.hitRadius + 4) return "none";
  target.setPathDistance(target.pathDistance - push);
  target.clearBlocked();
  target.status.registerControl(now, tier, resistance);
  return "pushed";
}

export function applySlowTo(target: ControlTarget, factor: number, durationMs: number, now: number): void {
  if (target.dead || target.reachedGoal) return;
  target.status.applySlow(factor, durationMs, now);
}

export function applyPoisonTo(target: ControlTarget, effect: PoisonEffect, now: number, durationMultiplier = 1): void {
  if (target.dead || target.reachedGoal) return;
  target.status.applyPoison(effect, now, durationMultiplier);
}

export function applyMarkTo(target: ControlTarget, sourceId: string, multiplier: number, durationMs: number, now: number): void {
  if (target.dead || target.reachedGoal) return;
  target.status.applyMark(sourceId, multiplier, durationMs, now);
}

export function applyVulnerabilityTo(target: ControlTarget, multiplier: number, durationMs: number, now: number): void {
  if (target.dead || target.reachedGoal) return;
  target.status.applyVulnerability(multiplier, durationMs, now);
}

/**
 * Aplicação genérica de um status a um inimigo. Controles fortes passam pelos retornos decrescentes de
 * elites/chefes; resistências por tipo reduzem a duração. Devolve o resultado do container.
 */
export function applyStatusTo(target: ControlTarget, input: StatusEffectInput, now: number, config: ControlConfig = CROWD_CONTROL): ApplyOutcome {
  if (target.dead || target.reachedGoal) return "ignored";
  const spec = STATUS_REGISTRY[input.type];
  const tier = controlTier(target.definition);
  const resistance = spec.countsAsControl ? resistanceFor(tier, config) : null;
  const scale = spec.countsAsControl ? target.status.controlScale(now, tier, resistance) : 1;
  const durationMs = input.durationMs * scale * (1 - target.status.resistance(input.type));
  if (durationMs <= 0) return "ignored";
  const outcome = target.status.container.apply({ ...input, durationMs }, now);
  if (spec.countsAsControl && outcome === "applied") target.status.registerControl(now, tier, resistance);
  return outcome;
}
