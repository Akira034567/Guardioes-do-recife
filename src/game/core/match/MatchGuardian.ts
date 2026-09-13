import type { BranchId, BranchStatus, GuardianDefinition, GuardianId, GuardianState, PlayerId, ResolvedAura, UpgradeBranch, UpgradeOption } from "../../types";
import { NEUTRAL_AURA, sameAura } from "../Auras";
import { targetPolicyFor } from "../GuardianBehaviors";
import { GuardianRuntime } from "../GuardianRuntime";
import { GuardianStateMachine, type GuardianFsmSnapshot } from "../GuardianStateMachine";
import { resolveGuardianStats, scaledTimings, type GuardianStats } from "../GuardianStats";
import type { StatusEffectInput } from "../StatusEffects";
import { selectTarget } from "../Targeting";
import type { TrapPhase } from "../TrapCore";
import {
  applyUpgrade,
  branchOf,
  branchStatuses,
  investedValue,
  MAX_UPGRADE_LEVEL,
  sellValue,
  upgradeOptions,
  type UpgradeProgress,
} from "../UpgradeTree";
import type { MatchEnemy } from "./MatchEnemy";

export interface GuardianPlacement {
  x: number;
  y: number;
  /** Distância ao longo da rota quando a unidade fica em cima dela (bloqueadores, armadilhas). */
  routeDistance: number | null;
  /** Plataforma ocupada (modo `platform`). */
  platformId: string | null;
}

/**
 * Guardião da partida: stats, árvore, FSM de ataque e estado de habilidades. Sem Phaser. Satisfaz
 * `BehaviorGuardian` e `BlockerLike`. `ownerId` identifica o jogador dono (coop futuro).
 */
export class MatchGuardian {
  branchId: BranchId | null = null;
  upgradeLevel = 0;
  attacksPerformed = 0;
  aura: ResolvedAura = NEUTRAL_AURA;
  readonly x: number;
  readonly y: number;
  readonly routeDistance: number | null;
  readonly platformId: string | null;
  readonly fsm: GuardianStateMachine;
  readonly runtime = new GuardianRuntime();
  private cachedStats: GuardianStats | null = null;
  private statusAttackSpeed = 1;
  private statusDamage = 1;

  constructor(
    readonly id: string,
    readonly definition: GuardianDefinition,
    placement: GuardianPlacement,
    readonly ownerId: PlayerId,
    now: number,
  ) {
    this.x = placement.x;
    this.y = placement.y;
    this.routeDistance = placement.routeDistance;
    this.platformId = placement.platformId;
    this.fsm = new GuardianStateMachine(scaledTimings(definition, this.stats.cooldownMs));
    this.runtime.syncStats(this.stats, now);
  }

  get guardianId(): GuardianId {
    return this.definition.id;
  }

  get progress(): UpgradeProgress {
    return { branchId: this.branchId, upgradeLevel: this.upgradeLevel };
  }

  get stats(): GuardianStats {
    if (!this.cachedStats) {
      this.cachedStats = resolveGuardianStats(this.definition, this.progress, this.aura, {
        attackSpeedBonus: this.runtime.attackSpeedBonus,
        attackSpeedMultiplier: this.statusAttackSpeed,
        damageMultiplier: this.statusDamage,
      });
    }
    return this.cachedStats;
  }

  get range(): number {
    return this.stats.range;
  }

  get targetId(): string | null {
    return this.fsm.targetId;
  }

  get state(): GuardianState {
    return this.fsm.state;
  }

  get branch(): UpgradeBranch | null {
    return branchOf(this.definition, this.branchId);
  }

  get options(): UpgradeOption[] {
    return upgradeOptions(this.definition, this.progress);
  }

  get branchStatuses(): BranchStatus[] {
    return branchStatuses(this.definition, this.progress);
  }

  get maxUpgradeLevel(): number {
    return MAX_UPGRADE_LEVEL;
  }

  get invested(): number {
    return investedValue(this.definition, this.progress);
  }

  get trapPhase(): TrapPhase | null {
    return this.runtime.trap?.phase ?? null;
  }

  fsmSnapshot(): GuardianFsmSnapshot {
    return this.fsm.snapshot();
  }

  sellValueAt(refundRate: number): number {
    return sellValue(this.invested, refundRate);
  }

  nextCost(branchId: BranchId): number | null {
    return this.options.find((option) => option.branchId === branchId)?.cost ?? null;
  }

  applyUpgrade(branchId: BranchId, now: number): boolean {
    const next = applyUpgrade(this.definition, this.progress, branchId);
    if (!next) return false;
    this.branchId = next.branchId;
    this.upgradeLevel = next.upgradeLevel;
    this.invalidate();
    this.runtime.syncStats(this.stats, now);
    return true;
  }

  setAura(aura: ResolvedAura): void {
    if (sameAura(this.aura, aura)) return;
    this.aura = { ...aura };
    this.invalidate();
  }

  setAttackSpeedBonus(bonus: number): void {
    if (Math.abs(this.runtime.attackSpeedBonus - bonus) < 1e-6) return;
    this.runtime.attackSpeedBonus = bonus;
    this.invalidate();
  }

  /** Recebe um status (buff de aliado, interferência de inimigo). */
  applyStatus(input: StatusEffectInput, now: number): void {
    this.runtime.status.apply(input, now);
    this.syncStatus(now);
  }

  /** Expira status e reflete buffs/debuffs ativos nos stats (só invalida quando algo mudou). */
  syncStatus(now: number): void {
    this.runtime.status.update(now);
    const attackSpeed = this.runtime.status.strength("attackSpeedBuff", now) ?? 1;
    const damage = this.runtime.status.strength("damageBuff", now) ?? 1;
    if (Math.abs(attackSpeed - this.statusAttackSpeed) < 1e-6 && Math.abs(damage - this.statusDamage) < 1e-6) return;
    this.statusAttackSpeed = attackSpeed;
    this.statusDamage = damage;
    this.invalidate();
  }

  /** Avança a FSM de ataque; `onImpact` recebe cada golpe no instante do impacto. */
  tick(now: number, enemies: readonly MatchEnemy[], onImpact: (guardian: MatchGuardian, target: MatchEnemy) => void): void {
    if (!this.stats.canAttack) return;
    if (this.fsm.state === "idle") {
      const target = selectTarget(enemies, this, this.range, targetPolicyFor(this, now), now);
      if (target) this.consume(this.fsm.beginAttack(target.id, now), enemies, onImpact);
    }
    const target = enemies.find((enemy) => enemy.id === this.fsm.targetId);
    // TRAVA DE ALVO (item 16). O alcance decide a AQUISIÇÃO — o `selectTarget` acima já filtra por
    // forma e raio — e nada mais. Depois que o golpe começou, ele vai até o fim mesmo que o inimigo
    // saia do alcance; só desiste se o alvo deixar de existir (morreu ou chegou ao Recife).
    //
    // Antes, um inimigo que apenas passava de largada cancelava o golpe no meio e devolvia a unidade
    // ao repouso sem custo, então ela reengajava no mesmo tique: animação quebrada em looping.
    const valid = Boolean(target && !target.dead && !target.reachedGoal);
    this.consume(this.fsm.update(now, valid), enemies, onImpact);
  }

  private consume(
    events: ReturnType<GuardianStateMachine["update"]>,
    enemies: readonly MatchEnemy[],
    onImpact: (guardian: MatchGuardian, target: MatchEnemy) => void,
  ): void {
    for (const event of events) {
      if (event.type !== "impact") continue;
      const target = enemies.find((enemy) => enemy.id === event.targetId);
      if (target && !target.dead && !target.reachedGoal) {
        this.attacksPerformed += 1;
        onImpact(this, target);
      }
    }
  }

  private invalidate(): void {
    this.cachedStats = null;
    this.fsm.setTimings(scaledTimings(this.definition, this.stats.cooldownMs));
  }
}
