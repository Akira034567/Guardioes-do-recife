/**
 * Sistema central de efeitos de status (item 13). Cada efeito tem tipo, fonte, alvo, duração, força e
 * regra de acúmulo. O registro por tipo define como forças e durações se combinam, para que Guardiões
 * atuais e futuros apliquem status sem regras espalhadas. Sem Phaser.
 */
export type StatusType =
  | "slow"
  | "stun"
  | "hold"
  | "root"
  | "knockback"
  | "mark"
  | "armorBreak"
  | "attackSpeedBuff"
  | "damageBuff"
  | "reveal"
  | "priority"
  | "poison"
  | "vulnerability"
  | "shield";

export type StackBehavior = "REFRESH" | "STACK" | "REPLACE" | "IGNORE";
export type StatusTag = "control" | "debuff" | "buff" | "dot" | "flag";
export type StatusOwner = "enemy" | "guardian";

export interface StatusEffect {
  type: StatusType;
  sourceId: string | null;
  appliedAt: number;
  until: number;
  /** slow: fator (0.68); vulnerability/mark/buffs: multiplicador; poison: dano por tique; shield: redução. */
  strength: number;
  stacks: number;
  maxStacks: number;
  stackBehavior: StackBehavior;
  /** Dados de tique (veneno) e janela de imunidade após o efeito (stun/hold). */
  tickMs: number;
  nextTickAt: number;
  immunityMs: number;
}

export interface StatusEffectInput {
  type: StatusType;
  strength: number;
  durationMs: number;
  sourceId?: string | null;
  maxStacks?: number;
  immunityMs?: number;
  tickMs?: number;
  stackBehavior?: StackBehavior;
}

export type ApplyOutcome = "applied" | "refreshed" | "stacked" | "replaced" | "ignored" | "immune";

export interface StatusTypeSpec {
  defaultStack: StackBehavior;
  /** Como combinar a força com um efeito ativo do mesmo tipo. */
  combine: "min" | "max" | "latest";
  /** slow/vulnerabilidade/reveal estendem; stun/hold/marca substituem a duração. */
  durationRule: "max" | "replace";
  /** Recusa enquanto ativo e respeita a janela de imunidade após terminar (stun, hold). */
  immunity: boolean;
  /** Entra nos retornos decrescentes de elites/chefes (`controlScale`). */
  countsAsControl: boolean;
  appliesTo: ReadonlyArray<StatusOwner>;
  /** Removido quando o Guardião de origem sai do mapa (hoje só a marca). */
  clearOnSourceRemoved: boolean;
  tags: StatusTag[];
}

export const STATUS_REGISTRY: Record<StatusType, StatusTypeSpec> = {
  slow: { defaultStack: "REFRESH", combine: "min", durationRule: "max", immunity: false, countsAsControl: false, appliesTo: ["enemy", "guardian"], clearOnSourceRemoved: false, tags: ["debuff"] },
  stun: { defaultStack: "IGNORE", combine: "latest", durationRule: "replace", immunity: true, countsAsControl: true, appliesTo: ["enemy", "guardian"], clearOnSourceRemoved: false, tags: ["control"] },
  hold: { defaultStack: "IGNORE", combine: "latest", durationRule: "replace", immunity: true, countsAsControl: true, appliesTo: ["enemy"], clearOnSourceRemoved: false, tags: ["control"] },
  root: { defaultStack: "REFRESH", combine: "latest", durationRule: "max", immunity: false, countsAsControl: true, appliesTo: ["enemy"], clearOnSourceRemoved: false, tags: ["control"] },
  knockback: { defaultStack: "REPLACE", combine: "latest", durationRule: "replace", immunity: false, countsAsControl: true, appliesTo: ["enemy"], clearOnSourceRemoved: false, tags: ["control", "flag"] },
  mark: { defaultStack: "REPLACE", combine: "latest", durationRule: "replace", immunity: false, countsAsControl: false, appliesTo: ["enemy"], clearOnSourceRemoved: true, tags: ["debuff", "flag"] },
  armorBreak: { defaultStack: "REFRESH", combine: "max", durationRule: "max", immunity: false, countsAsControl: false, appliesTo: ["enemy"], clearOnSourceRemoved: false, tags: ["debuff"] },
  attackSpeedBuff: { defaultStack: "REFRESH", combine: "max", durationRule: "max", immunity: false, countsAsControl: false, appliesTo: ["guardian"], clearOnSourceRemoved: false, tags: ["buff"] },
  damageBuff: { defaultStack: "REFRESH", combine: "max", durationRule: "max", immunity: false, countsAsControl: false, appliesTo: ["guardian"], clearOnSourceRemoved: false, tags: ["buff"] },
  reveal: { defaultStack: "REFRESH", combine: "latest", durationRule: "max", immunity: false, countsAsControl: false, appliesTo: ["enemy"], clearOnSourceRemoved: false, tags: ["flag"] },
  priority: { defaultStack: "REFRESH", combine: "latest", durationRule: "max", immunity: false, countsAsControl: false, appliesTo: ["enemy"], clearOnSourceRemoved: false, tags: ["flag"] },
  poison: { defaultStack: "STACK", combine: "max", durationRule: "max", immunity: false, countsAsControl: false, appliesTo: ["enemy"], clearOnSourceRemoved: false, tags: ["debuff", "dot"] },
  vulnerability: { defaultStack: "REFRESH", combine: "max", durationRule: "max", immunity: false, countsAsControl: false, appliesTo: ["enemy"], clearOnSourceRemoved: false, tags: ["debuff"] },
  shield: { defaultStack: "REFRESH", combine: "max", durationRule: "max", immunity: false, countsAsControl: false, appliesTo: ["enemy", "guardian"], clearOnSourceRemoved: false, tags: ["buff"] },
};

/** Um efeito por tipo (a marca guarda a fonte; um novo dono substitui o anterior). */
export class StatusContainer {
  private readonly effects = new Map<StatusType, StatusEffect>();

  constructor(
    readonly owner: StatusOwner,
    private readonly immunities: ReadonlySet<StatusType> = new Set(),
  ) {}

  apply(input: StatusEffectInput, now: number): ApplyOutcome {
    const spec = STATUS_REGISTRY[input.type];
    if (!spec.appliesTo.includes(this.owner) || this.immunities.has(input.type)) return "immune";
    if (input.durationMs <= 0) return "ignored";
    const behavior = input.stackBehavior ?? spec.defaultStack;
    const current = this.effects.get(input.type);
    const active = current !== undefined && this.isActive(current, now);
    if (spec.immunity && current && now < current.until + current.immunityMs) return active ? "ignored" : "immune";
    if (!active) {
      this.effects.set(input.type, this.create(input, now, behavior));
      return "applied";
    }
    if (behavior === "IGNORE") return "ignored";
    if (behavior === "REPLACE") {
      this.effects.set(input.type, this.create(input, now, behavior));
      return "replaced";
    }
    const until = spec.durationRule === "max" ? Math.max(current.until, now + input.durationMs) : now + input.durationMs;
    current.until = until;
    current.strength = combine(spec.combine, current.strength, input.strength);
    current.immunityMs = input.immunityMs ?? current.immunityMs;
    if (behavior === "STACK") {
      current.maxStacks = input.maxStacks ?? current.maxStacks;
      current.stacks = Math.min(current.maxStacks, current.stacks + 1);
      if (input.tickMs !== undefined) current.tickMs = Math.min(current.tickMs, input.tickMs);
      return "stacked";
    }
    return "refreshed";
  }

  /** Força do efeito ativo (null quando não há). Com `sourceId`, exige a mesma fonte (marca). */
  strength(type: StatusType, now: number, sourceId?: string | null): number | null {
    const effect = this.effects.get(type);
    if (!effect || !this.isActive(effect, now)) return null;
    if (sourceId !== undefined && effect.sourceId !== sourceId) return null;
    return effect.strength;
  }

  has(type: StatusType, now: number, sourceId?: string | null): boolean {
    return this.strength(type, now, sourceId) !== null;
  }

  sourceOf(type: StatusType, now: number): string | null {
    const effect = this.effects.get(type);
    return effect && this.isActive(effect, now) ? effect.sourceId : null;
  }

  stacks(type: StatusType, now: number): number {
    const effect = this.effects.get(type);
    return effect && this.isActive(effect, now) ? effect.stacks : 0;
  }

  /** Janela de imunidade depois do efeito terminar (stun/hold). */
  isImmune(type: StatusType, now: number): boolean {
    const effect = this.effects.get(type);
    return Boolean(effect) && !this.isActive(effect as StatusEffect, now) && now < (effect as StatusEffect).until + (effect as StatusEffect).immunityMs;
  }

  until(type: StatusType, now: number): number {
    const effect = this.effects.get(type);
    return effect && this.isActive(effect, now) ? effect.until : 0;
  }

  /** Reforça a força de um efeito ativo da mesma fonte sem mexer na duração (Alfa II). */
  boost(type: StatusType, sourceId: string | null, strength: number, now: number): boolean {
    const effect = this.effects.get(type);
    if (!effect || !this.isActive(effect, now) || effect.sourceId !== sourceId) return false;
    effect.strength = strength;
    return true;
  }

  /** Dano devido pelos tiques vencidos de um efeito periódico; avança o relógio do efeito. */
  drainTicks(type: StatusType, now: number): number {
    const effect = this.effects.get(type);
    if (!effect || effect.tickMs <= 0) return 0;
    let owed = 0;
    while (effect.nextTickAt <= now && effect.nextTickAt <= effect.until) {
      owed += effect.strength * effect.stacks;
      effect.nextTickAt += effect.tickMs;
    }
    if (now >= effect.until && effect.nextTickAt > effect.until) this.effects.delete(type);
    return owed;
  }

  removeBySource(sourceId: string): StatusType[] {
    const removed: StatusType[] = [];
    for (const [type, effect] of this.effects) {
      if (effect.sourceId === sourceId && STATUS_REGISTRY[type].clearOnSourceRemoved) {
        this.effects.delete(type);
        removed.push(type);
      }
    }
    return removed;
  }

  remove(type: StatusType, sourceId?: string | null): void {
    const effect = this.effects.get(type);
    if (!effect) return;
    if (sourceId !== undefined && effect.sourceId !== sourceId) return;
    this.effects.delete(type);
  }

  clear(): void {
    this.effects.clear();
  }

  /** Descarta efeitos vencidos (e cuja janela de imunidade já passou). */
  update(now: number): void {
    for (const [type, effect] of this.effects) {
      if (this.isActive(effect, now)) continue;
      if (now < effect.until + effect.immunityMs) continue;
      this.effects.delete(type);
    }
  }

  list(now: number): StatusEffect[] {
    return [...this.effects.values()].filter((effect) => this.isActive(effect, now));
  }

  private isActive(effect: StatusEffect, now: number): boolean {
    if (now < effect.until) return true;
    // Efeitos periódicos continuam vivos até o último tique devido ser drenado.
    return effect.tickMs > 0 && now < effect.nextTickAt;
  }

  private create(input: StatusEffectInput, now: number, behavior: StackBehavior): StatusEffect {
    const tickMs = input.tickMs ?? 0;
    return {
      type: input.type,
      sourceId: input.sourceId ?? null,
      appliedAt: now,
      until: now + input.durationMs,
      strength: input.strength,
      stacks: 1,
      maxStacks: input.maxStacks ?? 1,
      stackBehavior: behavior,
      tickMs,
      nextTickAt: tickMs > 0 ? now + tickMs : Number.POSITIVE_INFINITY,
      immunityMs: input.immunityMs ?? 0,
    };
  }
}

function combine(rule: StatusTypeSpec["combine"], current: number, incoming: number): number {
  if (rule === "min") return Math.min(current, incoming);
  if (rule === "max") return Math.max(current, incoming);
  return incoming;
}
