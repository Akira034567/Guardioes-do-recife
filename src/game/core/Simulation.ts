import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { BOSS_CURRENT, ECONOMY, GUARDIAN_BALANCE } from "../data/balance";
import { ENEMIES, scaleEnemy } from "../data/enemies";
import { GUARDIANS } from "../data/guardians";
import type { AuraEffect, BranchId, EnemyDefinition, EnemyId, GuardianDefinition, GuardianId, LevelDefinition, Vec2 } from "../types";
import { AbilityCooldown } from "./AbilityCooldown";
import { NEUTRAL_AURA, resolveAura, sameAura, type AuraSource } from "./Auras";
import { hasReachedBlockerContact, mitigatedDamage, selectLeadingTarget } from "./Combat";
import { containsPoint, enemySpeedMultiplier, projectileDrift } from "./CurrentField";
import { Economy } from "./Economy";
import { EnemyStatus } from "./EnemyStatus";
import { GuardianStateMachine } from "./GuardianStateMachine";
import { resolveGuardianStats, scaledTimings, type GuardianStats } from "./GuardianStats";
import { ProjectileCore, type ProjectileTarget } from "./ProjectileCore";
import { RoutePath } from "./RoutePath";
import { applyUpgrade, upgradeOptions, type UpgradeProgress } from "./UpgradeTree";
import { WaveScheduler } from "./WaveScheduler";

/**
 * Simulação headless de uma fase com um roteiro de compras. Reproduz as regras
 * de `GameScene` (posicionamento, alvos, projéteis, bloqueio, correntes, status,
 * economia) sem Phaser, para calibrar fases em segundos. As sondas e2e em
 * `tests/e2e/balance.spec.ts` confirmam os mesmos roteiros no jogo real.
 */

export type SimPoint = [number, number];
export type SimStep = { place: GuardianId; at: SimPoint } | { upgrade: SimPoint; branch: BranchId };

export interface SimOptions {
  dtMs?: number;
  maxMs?: number;
}

export interface SimResult {
  state: "victory" | "defeat";
  reef: number;
  pearls: number;
  guardians: number;
  upgrades: number;
  timeMs: number;
  wavesCleared: number;
  totalWaves: number;
  kills: Partial<Record<EnemyId, number>>;
  leaks: Partial<Record<EnemyId, number>>;
  stepsExecuted: number;
}

const ROUTE_PLACEMENT_CLEARANCE = 52;
const ROUTE_UNIT_SEPARATION = 78;
const WATER_ROUTE_CLEARANCE = 82;
const WATER_SEPARATION = 78;
const PLATFORM_HIT_RADIUS = 47;

class SimEnemy {
  x: number;
  y: number;
  health: number;
  pathDistance = 0;
  effectiveSpeed: number;
  dead = false;
  reachedGoal = false;
  blockedById: string | null = null;
  readonly status: EnemyStatus;
  private now = 0;

  constructor(
    readonly id: string,
    readonly definition: EnemyDefinition,
    private readonly route: RoutePath,
  ) {
    const start = route.getPointAtDistance(0);
    this.x = start.x;
    this.y = start.y;
    this.health = definition.maxHealth;
    this.effectiveSpeed = definition.speed;
    this.status = new EnemyStatus(definition.slowResistance ?? 0);
  }

  get progress(): number {
    return this.route.getProgress(this.pathDistance);
  }

  get velocity(): Vec2 {
    if (this.blockedById) return { x: 0, y: 0 };
    const tangent = this.route.getTangentAtDistance(this.pathDistance);
    return { x: tangent.x * this.effectiveSpeed, y: tangent.y * this.effectiveSpeed };
  }

  get isBlockable(): boolean {
    return !this.definition.unblockable;
  }

  setBlocked(blockerId: string, stopDistance: number): void {
    this.blockedById = blockerId;
    this.pathDistance = Math.max(0, stopDistance);
    const point = this.route.getPointAtDistance(this.pathDistance);
    this.x = point.x;
    this.y = point.y;
    this.effectiveSpeed = 0;
  }

  clearBlocked(): void {
    this.blockedById = null;
  }

  tick(now: number, deltaMs: number, currents: LevelDefinition["currents"], reversed: boolean): boolean {
    if (this.dead || this.reachedGoal) return false;
    this.now = now;
    this.status.update(now);
    const tangent = this.route.getTangentAtDistance(this.pathDistance);
    if (this.blockedById) {
      this.effectiveSpeed = 0;
      return false;
    }
    const zone = currents.find((candidate) => containsPoint(candidate, this));
    const currentMultiplier = zone ? enemySpeedMultiplier(zone, tangent, reversed) : 1;
    this.effectiveSpeed = this.definition.speed * this.status.speedMultiplier(now) * currentMultiplier;
    this.pathDistance += this.effectiveSpeed * (deltaMs / 1000);
    const point = this.route.getPointAtDistance(this.pathDistance);
    this.x = point.x;
    this.y = point.y;
    if (this.pathDistance >= this.route.totalLength) {
      this.reachedGoal = true;
      return true;
    }
    return false;
  }

  takeDamage(rawDamage: number, armorPiercing = false): boolean {
    if (this.dead || this.reachedGoal) return false;
    const base = armorPiercing ? Math.max(1, rawDamage) : mitigatedDamage(rawDamage, this.definition.armor);
    return this.loseHealth(base * this.status.damageMultiplier(this.now));
  }

  takeContinuousDamage(amount: number): boolean {
    if (this.dead || this.reachedGoal) return false;
    return this.loseHealth(Math.max(0, amount) * this.status.damageMultiplier(this.now));
  }

  distanceTo(x: number, y: number): number {
    return Math.hypot(this.x - x, this.y - y);
  }

  private loseHealth(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
    return this.dead;
  }
}

class SimGuardian {
  branchId: BranchId | null = null;
  upgradeLevel = 0;
  attacksPerformed = 0;
  aura: AuraEffect = NEUTRAL_AURA;
  readonly fsm: GuardianStateMachine;
  private cachedStats: GuardianStats | null = null;

  constructor(
    readonly id: string,
    readonly definition: GuardianDefinition,
    readonly x: number,
    readonly y: number,
    readonly routeDistance: number | null,
  ) {
    this.fsm = new GuardianStateMachine(scaledTimings(definition, this.stats.cooldownMs));
  }

  get progress(): UpgradeProgress {
    return { branchId: this.branchId, upgradeLevel: this.upgradeLevel };
  }

  get stats(): GuardianStats {
    if (!this.cachedStats) this.cachedStats = resolveGuardianStats(this.definition, this.progress, this.aura);
    return this.cachedStats;
  }

  get range(): number {
    return this.stats.range;
  }

  get targetId(): string | null {
    return this.fsm.targetId;
  }

  nextCost(branchId: BranchId): number | null {
    return upgradeOptions(this.definition, this.progress).find((option) => option.branchId === branchId)?.cost ?? null;
  }

  applyUpgrade(branchId: BranchId): boolean {
    const next = applyUpgrade(this.definition, this.progress, branchId);
    if (!next) return false;
    this.branchId = next.branchId;
    this.upgradeLevel = next.upgradeLevel;
    this.invalidate();
    return true;
  }

  setAura(aura: AuraEffect): void {
    if (sameAura(this.aura, aura)) return;
    this.aura = { ...aura };
    this.invalidate();
  }

  tick(now: number, enemies: readonly SimEnemy[], onImpact: (guardian: SimGuardian, target: SimEnemy) => void): void {
    if (!this.stats.canAttack) return;
    if (this.fsm.state === "idle") {
      const target = selectLeadingTarget(enemies, this, this.range);
      if (target) this.consume(this.fsm.beginAttack(target.id, now), enemies, onImpact);
    }
    const target = enemies.find((enemy) => enemy.id === this.fsm.targetId);
    const valid = Boolean(target && !target.dead && !target.reachedGoal && target.distanceTo(this.x, this.y) <= this.range);
    this.consume(this.fsm.update(now, valid), enemies, onImpact);
  }

  private consume(
    events: ReturnType<GuardianStateMachine["update"]>,
    enemies: readonly SimEnemy[],
    onImpact: (guardian: SimGuardian, target: SimEnemy) => void,
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

interface SimField {
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
  nextPulseAt: number;
  pulseIntervalMs: number;
  damage: number;
  maxDamagePerTarget: number;
  slowFactor: number;
  slowDurationMs: number;
  damageDealt: Map<string, number>;
}

interface SimCloud {
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
  slowFactor: number;
  vulnerabilityMultiplier: number;
}

interface SimRouteUnit extends Vec2 {
  guardianId: string;
}

export class LevelSimulation {
  private readonly route: RoutePath;
  private readonly economy: Economy;
  private readonly scheduler: WaveScheduler;
  private readonly enemies: SimEnemy[] = [];
  private readonly guardians: SimGuardian[] = [];
  private readonly projectiles: ProjectileCore[] = [];
  private readonly fields: SimField[] = [];
  private readonly clouds: SimCloud[] = [];
  private readonly cooldowns = new Map<string, AbilityCooldown>();
  private readonly routeUnits: SimRouteUnit[] = [];
  private readonly occupiedPlatforms = new Set<string>();
  private readonly kills: Partial<Record<EnemyId, number>> = {};
  private readonly leaks: Partial<Record<EnemyId, number>> = {};
  private reef: number;
  private state: "running" | "victory" | "defeat" = "running";
  private now = 0;
  private currentReversed = false;
  private bossCycleMs = 0;
  private bossReverseRemainingMs = 0;
  private enemySerial = 0;
  private guardianSerial = 0;
  private stepIndex = 0;
  private wavesCleared = 0;

  constructor(
    private readonly level: LevelDefinition,
    private readonly steps: readonly SimStep[],
    private readonly options: Required<SimOptions> = { dtMs: 1000 / 60, maxMs: 900_000 },
  ) {
    this.route = new RoutePath(level.waypoints);
    this.economy = new Economy(level.startingPearls);
    this.scheduler = new WaveScheduler(level.waves, level.initialWaveDelayMs, level.betweenWaveDelayMs);
    this.reef = level.reefHealth;
  }

  run(): SimResult {
    while (this.state === "running" && this.now < this.options.maxMs) this.tick(this.options.dtMs);
    if (this.state === "running") throw new Error(`Simulation of ${this.level.id} did not finish within ${this.options.maxMs} ms`);
    return {
      state: this.state,
      reef: this.reef,
      pearls: this.economy.pearls,
      guardians: this.guardians.length,
      upgrades: this.guardians.reduce((total, guardian) => total + guardian.upgradeLevel, 0),
      timeMs: this.now,
      wavesCleared: this.wavesCleared,
      totalWaves: this.level.waves.length,
      kills: this.kills,
      leaks: this.leaks,
      stepsExecuted: this.stepIndex,
    };
  }

  // ------------------------------------------------------------------ loop

  private tick(deltaMs: number): void {
    this.now += deltaMs;
    this.executeSteps();
    this.updateBossCurrent(deltaMs);

    const alive = this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal).length;
    for (const event of this.scheduler.tick(deltaMs, alive)) {
      if (event.type === "spawn") {
        const definition = scaleEnemy(ENEMIES[event.enemyId], this.level.enemyScaling, this.level.enemyOverrides?.[event.enemyId]);
        this.enemies.push(new SimEnemy(`E${++this.enemySerial}`, definition, this.route));
      } else if (event.type === "waveCleared") {
        this.wavesCleared += 1;
        this.economy.earn(ECONOMY.waveClearBonus);
      } else if (event.type === "victory") {
        this.economy.earn(ECONOMY.levelClearBonus);
        this.state = "victory";
      }
    }

    this.updateBlockers(deltaMs);
    for (const enemy of this.enemies) {
      if (enemy.tick(this.now, deltaMs, this.level.currents, this.currentReversed)) {
        this.reef = Math.max(0, this.reef - enemy.definition.reefDamage);
        this.leaks[enemy.definition.id] = (this.leaks[enemy.definition.id] ?? 0) + 1;
        if (this.reef <= 0) this.state = "defeat";
      }
    }

    this.updateAuras();
    for (const guardian of this.guardians) {
      guardian.tick(this.now, this.enemies, (attacker, target) => this.resolveAttack(attacker, target));
    }
    this.updateFields();
    this.updateClouds();
    this.updateProjectiles(deltaMs);

    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      if (this.enemies[index].dead || this.enemies[index].reachedGoal) this.enemies.splice(index, 1);
    }
  }

  // ------------------------------------------------------------ roteiro

  private executeSteps(): void {
    while (this.stepIndex < this.steps.length) {
      const step = this.steps[this.stepIndex];
      if ("place" in step) {
        const definition = GUARDIANS[step.place];
        if (!this.economy.canAfford(definition.cost)) return;
        this.place(definition, step.at);
      } else {
        const guardian = this.guardianAt(step.upgrade);
        if (!guardian) throw new Error(`${this.level.id}: nenhuma unidade em ${step.upgrade.join(",")}`);
        const cost = guardian.nextCost(step.branch);
        if (cost === null) throw new Error(`${this.level.id}: upgrade ${step.branch} indisponível em ${step.upgrade.join(",")}`);
        if (!this.economy.canAfford(cost)) return;
        guardian.applyUpgrade(step.branch);
        this.economy.spend(cost);
      }
      this.stepIndex += 1;
    }
  }

  private guardianAt(point: SimPoint): SimGuardian | undefined {
    return this.guardians.find((guardian) => Math.hypot(guardian.x - point[0], guardian.y - point[1]) <= 40);
  }

  private place(definition: GuardianDefinition, at: SimPoint): void {
    let x = at[0];
    let y = at[1];
    let routeDistance: number | null = null;
    if (definition.placementMode === "platform") {
      const platform = this.level.placements.find(
        (candidate) => !this.occupiedPlatforms.has(candidate.id) && Math.hypot(candidate.x - x, candidate.y - y) <= PLATFORM_HIT_RADIUS,
      );
      if (!platform) throw new Error(`${this.level.id}: nenhuma plataforma livre em ${at.join(",")}`);
      this.occupiedPlatforms.add(platform.id);
      x = platform.x;
      y = platform.y;
    } else if (definition.placementMode === "water") {
      const reason = this.waterPlacementError(x, y);
      if (reason) throw new Error(`${this.level.id}: água inválida em ${at.join(",")} (${reason})`);
    } else {
      const closest = this.route.getClosestPoint({ x, y });
      if (closest.distance > ROUTE_PLACEMENT_CLEARANCE) throw new Error(`${this.level.id}: fora da correnteza em ${at.join(",")}`);
      if (closest.routeDistance < 60 || closest.routeDistance > this.route.totalLength - 60) {
        throw new Error(`${this.level.id}: muito perto da entrada/saída em ${at.join(",")}`);
      }
      if (this.routeUnits.some((unit) => Math.hypot(closest.point.x - unit.x, closest.point.y - unit.y) < ROUTE_UNIT_SEPARATION)) {
        throw new Error(`${this.level.id}: muito perto de outra unidade da correnteza em ${at.join(",")}`);
      }
      x = closest.point.x;
      y = closest.point.y;
      routeDistance = closest.routeDistance;
    }
    this.economy.spend(definition.cost);
    const guardian = new SimGuardian(`G${++this.guardianSerial}`, definition, x, y, routeDistance);
    this.guardians.push(guardian);
    if (routeDistance !== null) this.routeUnits.push({ x, y, guardianId: guardian.id });
  }

  private waterPlacementError(x: number, y: number): string | null {
    if (x < 44 || x > GAME_WIDTH - 44 || y < HUD_TOP + 38 || y > GAME_HEIGHT - HUD_BOTTOM - 38) return "fora da área";
    if (this.route.getClosestPoint({ x, y }).distance < WATER_ROUTE_CLEARANCE) return "perto da rota";
    if (this.level.placements.some((placement) => Math.hypot(x - placement.x, y - placement.y) < WATER_SEPARATION)) return "plataforma";
    if (this.guardians.some((guardian) => Math.hypot(x - guardian.x, y - guardian.y) < WATER_SEPARATION)) return "outro guardião";
    return null;
  }

  // -------------------------------------------------------------- combate

  private resolveAttack(guardian: SimGuardian, target: SimEnemy): void {
    switch (guardian.definition.attackKind) {
      case "projectile":
        this.fireProjectile(guardian, target);
        return;
      case "chain":
        this.resolveChain(guardian, target);
        return;
      case "melee":
        this.resolveMelee(guardian, target);
        return;
      case "ink":
        this.resolveInk(guardian, target);
        return;
      default:
        this.resolvePulse(guardian);
    }
  }

  private snapshot(enemy: SimEnemy): ProjectileTarget {
    return {
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      hitRadius: enemy.definition.hitRadius,
      velocity: enemy.velocity,
      alive: !enemy.dead && !enemy.reachedGoal,
    };
  }

  private fireProjectile(guardian: SimGuardian, target: SimEnemy): void {
    const stats = guardian.stats;
    this.projectiles.push(
      new ProjectileCore({ x: guardian.x + 22, y: guardian.y }, this.snapshot(target), {
        speed: stats.projectileSpeed,
        damages: stats.pierceDamages,
        predictiveAim: stats.predictiveAim,
        straightRicochet: stats.straightRicochet,
        ricochetRange: GUARDIAN_BALANCE["pistol-shrimp"].ricochetRange,
        splash: stats.splash ?? undefined,
        radius: 6,
        lifetimeMs: 2200,
        bounds: { minX: -80, maxX: GAME_WIDTH + 80, minY: -80, maxY: GAME_HEIGHT + 80 },
      }),
    );
  }

  private updateProjectiles(deltaMs: number): void {
    const targets = this.enemies.map((enemy) => this.snapshot(enemy));
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      const result = projectile.step(deltaMs, targets);
      const zone = this.level.currents.find((candidate) => containsPoint(candidate, projectile));
      if (zone) {
        const drift = projectileDrift(zone, deltaMs / 1000, this.currentReversed);
        projectile.x += drift.x;
        projectile.y += drift.y;
      }
      for (const hit of result.hits) {
        const enemy = this.enemies.find((candidate) => candidate.id === hit.targetId);
        if (enemy) this.damage(enemy, hit.damage);
      }
      if (result.expired) this.projectiles.splice(index, 1);
    }
  }

  private inRange(guardian: SimGuardian, radius = guardian.range): SimEnemy[] {
    return this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= radius);
  }

  private resolveChain(guardian: SimGuardian, target: SimEnemy): void {
    const stats = guardian.stats;
    const damages = stats.chainDamages;
    const candidates = this.inRange(guardian)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, damages.length);
    candidates.forEach((enemy, index) => {
      this.damage(enemy, damages[index] ?? damages[damages.length - 1]);
      if (stats.slowFactor !== null) enemy.status.applySlow(stats.slowFactor, stats.slowDurationMs, this.now);
    });
    if (stats.stun && !target.dead) target.status.tryStun(stats.stun.durationMs, stats.stun.immunityMs, this.now);
    if (stats.electricField) this.createField(guardian, target.x, target.y);
  }

  private resolvePulse(guardian: SimGuardian): void {
    const stats = guardian.stats;
    this.inRange(guardian).forEach((enemy) => {
      this.damage(enemy, stats.damage);
      if (stats.slowFactor !== null) enemy.status.applySlow(stats.slowFactor, stats.slowDurationMs, this.now);
    });
  }

  private resolveMelee(guardian: SimGuardian, target: SimEnemy): void {
    const stats = guardian.stats;
    const spinning = stats.spin !== null && guardian.attacksPerformed % stats.spin.everyAttacks === 0;
    const radius = spinning && stats.spin ? guardian.range * stats.spin.radiusMultiplier : guardian.range;
    const damage = spinning && stats.spin ? stats.spin.damage : stats.damage;
    const targets = stats.areaAttack || spinning ? this.inRange(guardian, radius) : [target];
    targets.forEach((enemy) => {
      this.damage(enemy, damage, stats.armorPiercing);
      if (stats.vulnerability) enemy.status.applyVulnerability(stats.vulnerability.multiplier, stats.vulnerability.durationMs, this.now);
    });
  }

  private resolveInk(guardian: SimGuardian, target: SimEnemy): void {
    const stats = guardian.stats;
    const vulnerability = stats.vulnerability;
    const affected = vulnerability?.radius
      ? this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(target.x, target.y) <= (vulnerability.radius ?? 0))
      : [target];
    if (!affected.includes(target)) affected.push(target);
    affected.forEach((enemy) => {
      this.damage(enemy, enemy === target ? stats.damage : Math.ceil(stats.damage * 0.5));
      if (vulnerability) enemy.status.applyVulnerability(vulnerability.multiplier, vulnerability.durationMs, this.now);
    });
    if (stats.inkCloud) this.createCloud(guardian, target.x, target.y);
  }

  private damage(enemy: SimEnemy, amount: number, armorPiercing = false, continuous = false): void {
    const killed = continuous ? enemy.takeContinuousDamage(amount) : enemy.takeDamage(amount, armorPiercing);
    if (!killed) return;
    this.economy.earn(enemy.definition.reward);
    this.kills[enemy.definition.id] = (this.kills[enemy.definition.id] ?? 0) + 1;
    if (enemy.definition.isBoss) this.currentReversed = false;
  }

  private updateBlockers(deltaMs: number): void {
    const blockers = this.guardians.filter((guardian) => guardian.stats.blocks && guardian.routeDistance !== null);
    const blockerIds = new Set(blockers.map((guardian) => guardian.id));
    this.enemies.forEach((enemy) => {
      if (enemy.blockedById && !blockerIds.has(enemy.blockedById)) enemy.clearBlocked();
    });
    for (const blocker of blockers) {
      const stats = blocker.stats;
      const anchor = blocker.routeDistance as number;
      const alreadyBlocked = this.enemies
        .filter((enemy) => enemy.blockedById === blocker.id && !enemy.dead && !enemy.reachedGoal)
        .slice(0, stats.blockCapacity);
      this.enemies
        .filter((enemy) => enemy.blockedById === blocker.id && !alreadyBlocked.includes(enemy))
        .forEach((enemy) => enemy.clearBlocked());
      const inContact = this.enemies.filter(
        (enemy) =>
          !enemy.dead &&
          !enemy.reachedGoal &&
          !enemy.blockedById &&
          hasReachedBlockerContact(enemy.pathDistance, anchor, 28 + enemy.definition.hitRadius),
      );
      const candidates = inContact.filter((enemy) => enemy.isBlockable).sort((first, second) => second.pathDistance - first.pathDistance);
      const blocked = [...alreadyBlocked, ...candidates.slice(0, Math.max(0, stats.blockCapacity - alreadyBlocked.length))];
      blocked.forEach((enemy) => {
        enemy.setBlocked(blocker.id, enemy.pathDistance);
        if (stats.contactDamagePerSecond > 0) this.damage(enemy, stats.contactDamagePerSecond * (deltaMs / 1000), false, true);
      });
      inContact
        .filter((enemy) => !enemy.isBlockable)
        .forEach((enemy) => {
          if (stats.bossHold) enemy.status.tryHold(stats.bossHold.durationMs, stats.bossHold.immunityMs, this.now);
          if (enemy.status.isHeld(this.now) && stats.contactDamagePerSecond > 0) {
            this.damage(enemy, stats.contactDamagePerSecond * (deltaMs / 1000), false, true);
          }
        });
    }
  }

  private updateAuras(): void {
    const sources: AuraSource[] = this.guardians
      .filter((guardian) => guardian.stats.providedAura)
      .map((guardian) => ({ id: guardian.id, x: guardian.x, y: guardian.y, range: guardian.range, aura: guardian.stats.providedAura! }));
    this.guardians.forEach((guardian) => guardian.setAura(resolveAura({ id: guardian.id, x: guardian.x, y: guardian.y }, sources)));
  }

  private cooldownFor(id: string): AbilityCooldown {
    let cooldown = this.cooldowns.get(id);
    if (!cooldown) {
      cooldown = new AbilityCooldown();
      this.cooldowns.set(id, cooldown);
    }
    return cooldown;
  }

  private createField(guardian: SimGuardian, x: number, y: number): void {
    const definition = guardian.stats.electricField;
    if (!definition || !this.cooldownFor(guardian.id).tryActivate(this.now, definition.cooldownMs)) return;
    for (let index = this.fields.length - 1; index >= 0; index -= 1) {
      if (this.fields[index].ownerId === guardian.id) this.fields.splice(index, 1);
    }
    this.fields.push({
      ownerId: guardian.id,
      x,
      y,
      radius: definition.radius,
      expiresAt: this.now + definition.durationMs,
      nextPulseAt: this.now,
      pulseIntervalMs: definition.pulseIntervalMs,
      damage: definition.damage,
      maxDamagePerTarget: definition.maxDamagePerTarget,
      slowFactor: definition.slowFactor,
      slowDurationMs: definition.slowDurationMs,
      damageDealt: new Map(),
    });
  }

  private updateFields(): void {
    for (let index = this.fields.length - 1; index >= 0; index -= 1) {
      const field = this.fields[index];
      if (this.now >= field.expiresAt) {
        this.fields.splice(index, 1);
        continue;
      }
      if (this.now < field.nextPulseAt) continue;
      field.nextPulseAt += field.pulseIntervalMs;
      this.enemies
        .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(field.x, field.y) <= field.radius)
        .forEach((enemy) => {
          const dealt = field.damageDealt.get(enemy.id) ?? 0;
          const allowed = Math.max(0, Math.min(field.damage, field.maxDamagePerTarget - dealt));
          if (allowed > 0) {
            field.damageDealt.set(enemy.id, dealt + allowed);
            this.damage(enemy, allowed, false, true);
          }
          enemy.status.applySlow(field.slowFactor, field.slowDurationMs, this.now);
        });
    }
  }

  private createCloud(guardian: SimGuardian, x: number, y: number): void {
    const definition = guardian.stats.inkCloud;
    if (!definition || !this.cooldownFor(guardian.id).tryActivate(this.now, definition.cooldownMs)) return;
    for (let index = this.clouds.length - 1; index >= 0; index -= 1) {
      if (this.clouds[index].ownerId === guardian.id) this.clouds.splice(index, 1);
    }
    this.clouds.push({
      ownerId: guardian.id,
      x,
      y,
      radius: definition.radius,
      expiresAt: this.now + definition.durationMs,
      slowFactor: definition.slowFactor,
      vulnerabilityMultiplier: definition.vulnerabilityMultiplier,
    });
  }

  private updateClouds(): void {
    for (let index = this.clouds.length - 1; index >= 0; index -= 1) {
      const cloud = this.clouds[index];
      if (this.now >= cloud.expiresAt) {
        this.clouds.splice(index, 1);
        continue;
      }
      this.enemies
        .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(cloud.x, cloud.y) <= cloud.radius)
        .forEach((enemy) => {
          enemy.status.applySlow(cloud.slowFactor, 320, this.now);
          enemy.status.applyVulnerability(cloud.vulnerabilityMultiplier, 320, this.now);
        });
    }
  }

  private updateBossCurrent(deltaMs: number): void {
    const bossAlive = this.enemies.some((enemy) => enemy.definition.isBoss && !enemy.dead && !enemy.reachedGoal);
    if (!bossAlive) {
      this.currentReversed = false;
      this.bossCycleMs = 0;
      this.bossReverseRemainingMs = 0;
      return;
    }
    if (this.currentReversed) {
      this.bossReverseRemainingMs -= deltaMs;
      if (this.bossReverseRemainingMs <= 0) {
        this.currentReversed = false;
        this.bossCycleMs = 0;
      }
    } else {
      this.bossCycleMs += deltaMs;
      if (this.bossCycleMs >= BOSS_CURRENT.cycleMs) {
        this.currentReversed = true;
        this.bossReverseRemainingMs = BOSS_CURRENT.reverseMs;
      }
    }
  }
}

export function simulateLevel(level: LevelDefinition, steps: readonly SimStep[], options: SimOptions = {}): SimResult {
  return new LevelSimulation(level, steps, { dtMs: options.dtMs ?? 1000 / 60, maxMs: options.maxMs ?? 900_000 }).run();
}
