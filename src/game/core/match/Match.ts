import { ECONOMY, PLACEMENT } from "../../data/balance";
import { ENEMIES, scaleEnemy } from "../../data/enemies";
import { applyElite, ELITES, type EliteId } from "../../data/elites";
import { GUARDIANS } from "../../data/guardians";
import type { EnemyId, GuardianDefinition, LevelDefinition, PlayerId, TeamId } from "../../types";
import { resolveAura, type AuraSource } from "../Auras";
import { BlockingSystem } from "../Blocking";
import { BossEncounter, type BossEncounterEvent } from "../BossEncounter";
import { controlTier } from "../CrowdControl";
import { CurrentSystem, zoneFromFlowField } from "../CurrentSystem";
import { Economy, type PearlSink, type PearlSource } from "../Economy";
import { EnemyAbilitySystem, type EnemyAbilityEvent, type EnemyAbilityWorld } from "../EnemyAbilities";
import type { FlowField } from "../FlowField";
import {
  flowFieldsFor,
  updateChorus,
  updateFrenzy,
  updateMark,
  updatePushWave,
  updateIncome,
  updateSonar,
  updateTrap,
  type BehaviorHooks,
  type DamageOptions,
} from "../GuardianBehaviors";
import { validatePlacement, type PlacementContext } from "../PlacementRules";
import { createRng, type Rng } from "../Rng";
import { RoutePath } from "../RoutePath";
import { MAIN_PATH_ID, resolveLevelPaths } from "../WaveDefinitions";
import { wavePreview, type WavePreview } from "../WavePreview";
import { WaveScheduler } from "../WaveScheduler";
import { DEFAULT_PLAYER_ID, type CommandResult, type MatchCommand } from "./MatchCommands";
import { MatchEnemy } from "./MatchEnemy";
import type { MatchEvent, MatchListener } from "./MatchEvents";
import { MatchGuardian, type GuardianPlacement } from "./MatchGuardian";
import type { MatchSnapshot, MatchStatus } from "./MatchSnapshot";
import { MatchStats } from "./MatchStats";
import { AreaEffects } from "./systems/AreaEffects";
import { resolveAttack } from "./systems/CombatSystem";
import { ProjectileSystem } from "./systems/ProjectileSystem";

export interface PlayerConfig {
  id: PlayerId;
  teamId: TeamId;
}

/** Quem age dentro do tick, logo após o relógio avançar (roteiro de balanceamento, IA, replay). */
export interface MatchController {
  act(match: Match): void;
}

export interface MatchOptions {
  /** Passo fixo da simulação. */
  dtMs?: number;
  /** Começa direto em uma onda (atalho de debug `?wave=`). */
  startWaveIndex?: number;
  seed?: number | string;
  players?: PlayerConfig[];
  controller?: MatchController | null;
}

interface RouteUnit {
  x: number;
  y: number;
  guardianId: string;
}

/**
 * Motor único da partida (item 43): estado + regras, sem Phaser. Mutação só por `execute(command)`;
 * observação por `snapshot()`, pelas listas de entidades (read views) e pelos eventos do `listener`.
 * A `GameScene` é apenas apresentação em cima dele; `simulateLevel` o roda headless.
 */
export class Match {
  readonly dtMs: number;
  readonly rng: Rng;
  readonly stats = new MatchStats();
  /** Rota principal (compatibilidade); todas as rotas ficam em `routes`. */
  readonly route: RoutePath;
  readonly routes: ReadonlyMap<string, RoutePath>;
  private readonly economy: Economy;
  private readonly scheduler: WaveScheduler;
  private readonly enemyList: MatchEnemy[] = [];
  private readonly guardianList: MatchGuardian[] = [];
  private readonly projectileSystem = new ProjectileSystem();
  private readonly areas = new AreaEffects();
  private readonly blocking = new BlockingSystem();
  private readonly abilitySystem = new EnemyAbilitySystem<MatchEnemy>();
  private readonly bossEncounter = new BossEncounter<MatchEnemy>();
  private readonly routeUnits: RouteUnit[] = [];
  private readonly platformOccupants = new Map<string, string>();
  private readonly players: PlayerConfig[];
  private readonly controller: MatchController | null;
  readonly currents: CurrentSystem;
  private reefValue: number;
  private statusValue: MatchStatus = "running";
  private nowMs = 0;
  private enemySerial = 0;
  private guardianSerial = 0;
  private listener: MatchListener | null = null;
  /** Debug: o Recife não perde vidas. */
  private invincible = false;

  constructor(
    readonly level: LevelDefinition,
    options: MatchOptions = {},
  ) {
    this.dtMs = options.dtMs ?? 1000 / 60;
    this.rng = createRng(options.seed ?? level.id);
    this.players = options.players ?? [{ id: DEFAULT_PLAYER_ID, teamId: "t1" }];
    this.controller = options.controller ?? null;
    const paths = resolveLevelPaths(level);
    this.routes = new Map(paths.map((path) => [path.id, new RoutePath(path.waypoints)]));
    this.route = this.routes.get(paths[0].id) as RoutePath;
    this.economy = new Economy(level.startingPearls);
    this.scheduler = new WaveScheduler(level.waves, level.initialWaveDelayMs, level.betweenWaveDelayMs, options.startWaveIndex ?? 0);
    this.currents = CurrentSystem.fromLevel(level.currents);
    this.reefValue = level.reefHealth;
    this.stats.totalWaves = level.waves.length;
  }

  // ----------------------------------------------------------------- leitura

  get now(): number {
    return this.nowMs;
  }

  get status(): MatchStatus {
    return this.statusValue;
  }

  get reef(): number {
    return this.reefValue;
  }

  get enemies(): readonly MatchEnemy[] {
    return this.enemyList;
  }

  get guardians(): readonly MatchGuardian[] {
    return this.guardianList;
  }

  get projectiles() {
    return this.projectileSystem.projectiles;
  }

  get fields() {
    return this.areas.fields;
  }

  get clouds() {
    return this.areas.clouds;
  }

  get flowFields(): readonly FlowField[] {
    return this.currents.flowFields;
  }

  get currentReversed(): boolean {
    return this.currents.reversed;
  }

  get playerIds(): readonly PlayerId[] {
    return this.players.map((player) => player.id);
  }

  pearls(_playerId: PlayerId = DEFAULT_PLAYER_ID): number {
    return this.economy.pearls;
  }

  economySnapshot() {
    return this.economy.snapshot();
  }

  guardian(id: string): MatchGuardian | undefined {
    return this.guardianList.find((guardian) => guardian.id === id);
  }

  enemy(id: string): MatchEnemy | undefined {
    return this.enemyList.find((enemy) => enemy.id === id);
  }

  platformOccupant(platformId: string): string | null {
    return this.platformOccupants.get(platformId) ?? null;
  }

  /** Bloqueadores em cima da rota (para o overlay de debug). */
  get routeOccupants(): readonly RouteUnit[] {
    return this.routeUnits;
  }

  heldSince(blockerId: string, enemyId: string): number | null {
    return this.blocking.heldSince(blockerId, enemyId);
  }

  /** Debug: elimina todos os inimigos em campo, sem pagar recompensa. */
  private killAll(): void {
    for (const enemy of [...this.enemyList]) {
      if (enemy.dead || enemy.reachedGoal) continue;
      enemy.dead = true;
      this.abilitySystem.died(enemy, this.abilityWorld());
      this.bossEncounter.onRemoved(enemy);
      this.emit({ type: "enemyKilled", now: this.nowMs, id: enemy.id, enemyId: enemy.definition.id, x: enemy.x, y: enemy.y, reward: 0, killerId: null });
    }
  }

  /** Composição da próxima onda para o HUD (null na última). */
  nextWavePreview(): WavePreview | null {
    return wavePreview(this.scheduler.upcomingWave);
  }

  /** Contexto puro para a apresentação pré-validar um ponto (preview) sem mutar nada. */
  placementContext(): PlacementContext {
    return {
      route: this.route,
      platforms: this.level.placements,
      guardians: this.guardianList,
      routeUnits: this.routeUnits,
    };
  }

  setListener(listener: MatchListener | null): void {
    this.listener = listener;
  }

  snapshot(): MatchSnapshot {
    const bossState = this.bossEncounter.snapshot();
    const boss = bossState ? (this.enemy(bossState.id) ?? null) : null;
    const trap = this.guardianList.find((guardian) => guardian.trapPhase !== null);
    return {
      status: this.statusValue,
      now: this.nowMs,
      pearls: this.economy.pearls,
      reef: this.reefValue,
      maxReef: this.level.reefHealth,
      wave: this.scheduler.currentWave,
      totalWaves: this.scheduler.totalWaves,
      waveState: this.scheduler.state,
      countdownSeconds: this.scheduler.countdownSeconds,
      canStartNextWave: this.statusValue === "running" && this.scheduler.state === "countdown",
      guardianCount: this.guardianList.length,
      upgradeCount: this.guardianList.reduce((total, guardian) => total + guardian.upgradeLevel, 0),
      aliveEnemies: this.enemyList.filter((enemy) => !enemy.dead && !enemy.reachedGoal).length,
      boss:
        boss && bossState
          ? {
              id: boss.id,
              name: boss.definition.name,
              title: bossState.title,
              x: boss.x,
              y: boss.y,
              speed: boss.effectiveSpeed,
              health: boss.health,
              maxHealth: boss.definition.maxHealth,
              healthRatio: bossState.healthRatio,
              phaseIndex: bossState.phaseIndex,
              phaseCount: bossState.phaseCount,
              blockedById: boss.blockedById,
            }
          : null,
      nextWave: this.nextWavePreview(),
      trapPhase: trap?.trapPhase ?? null,
      stats: this.stats.snapshot(this.economy.snapshot()),
    };
  }

  // ---------------------------------------------------------------- comandos

  execute(command: MatchCommand): CommandResult {
    if (this.statusValue !== "running") return { ok: false, reason: "gameOver", message: "A partida terminou." };
    switch (command.type) {
      case "placeGuardian":
        return this.placeGuardian(command);
      case "upgradeGuardian":
        return this.upgradeGuardian(command);
      case "sellGuardian":
        return this.sellGuardian(command);
      case "startNextWave":
        return this.startNextWave();
      case "debug.addPearls":
        this.stats.cheated = true;
        this.earn(Math.max(0, command.amount), "SpecialReward", command.playerId ?? DEFAULT_PLAYER_ID);
        return { ok: true };
      case "debug.spawnEnemy":
        this.stats.cheated = true;
        this.spawnEnemy(command.enemyId, { pathId: MAIN_PATH_ID, pathDistance: 0 }, command.elite ?? null);
        return { ok: true };
      case "debug.skipWave":
        this.stats.cheated = true;
        this.scheduler.forceCompleteSpawns();
        this.killAll();
        return { ok: true };
      case "debug.killAll":
        this.stats.cheated = true;
        this.killAll();
        return { ok: true };
      case "debug.invincible":
        this.stats.cheated = true;
        this.invincible = command.on;
        return { ok: true };
      default: {
        const exhaustive: never = command;
        return { ok: false, reason: "unknownCommand", message: `Comando desconhecido: ${String((exhaustive as { type?: string }).type)}` };
      }
    }
  }

  private placeGuardian(command: Extract<MatchCommand, { type: "placeGuardian" }>): CommandResult {
    const definition: GuardianDefinition = GUARDIANS[command.guardianId];
    const playerId = command.playerId ?? DEFAULT_PLAYER_ID;
    if (!this.economy.canAfford(definition.cost)) {
      return { ok: false, reason: "insufficientPearls", message: `Faltam pérolas para ${definition.name}.` };
    }
    let placement: GuardianPlacement;
    if (definition.placementMode === "platform") {
      const platform = command.platformId
        ? this.level.placements.find((candidate) => candidate.id === command.platformId)
        : this.level.placements.find(
            (candidate) => !this.platformOccupants.has(candidate.id) && Math.hypot(candidate.x - command.x, candidate.y - command.y) <= PLACEMENT.platformHitRadius,
          );
      if (!platform) {
        return command.platformId
          ? { ok: false, reason: "notFound", message: "Plataforma desconhecida." }
          : { ok: false, reason: "noPlatformNear", message: `${definition.name} precisa de uma plataforma de pedra.` };
      }
      if (this.platformOccupants.has(platform.id)) return { ok: false, reason: "platformOccupied", message: "Plataforma ocupada." };
      placement = { x: platform.x, y: platform.y, routeDistance: null, platformId: platform.id };
    } else {
      if (command.platformId) return { ok: false, reason: "needsPlatform", message: `${definition.name} não fica em plataformas.` };
      const validation = validatePlacement(definition.placementMode, this.placementContext(), { x: command.x, y: command.y });
      if (!validation.valid) return { ok: false, reason: "invalidPlacement", message: validation.reason };
      placement = { x: validation.x, y: validation.y, routeDistance: validation.routeDistance, platformId: null };
    }

    this.spend(definition.cost, "Place", playerId);
    const guardian = new MatchGuardian(`G${++this.guardianSerial}`, definition, placement, playerId, this.nowMs);
    this.guardianList.push(guardian);
    if (placement.platformId) this.platformOccupants.set(placement.platformId, guardian.id);
    if (placement.routeDistance !== null) this.routeUnits.push({ x: placement.x, y: placement.y, guardianId: guardian.id });
    this.stats.recordPlacement(definition.id, this.guardianList.length);
    this.emit({
      type: "guardianPlaced",
      now: this.nowMs,
      id: guardian.id,
      guardianId: definition.id,
      x: placement.x,
      y: placement.y,
      playerId,
      platformId: placement.platformId,
      cost: definition.cost,
    });
    return { ok: true, instanceId: guardian.id, cost: definition.cost };
  }

  private upgradeGuardian(command: Extract<MatchCommand, { type: "upgradeGuardian" }>): CommandResult {
    const guardian = this.guardian(command.instanceId);
    if (!guardian) return { ok: false, reason: "notFound", message: "Guardião não encontrado." };
    const option = guardian.options.find((candidate) => candidate.branchId === command.branchId);
    if (!option) {
      const locked = guardian.branchStatuses.find((status) => status.id === command.branchId);
      if (locked?.state === "locked") {
        return {
          ok: false,
          reason: "branchLocked",
          message: `Ramo ${locked.name} bloqueado: esta unidade seguiu ${guardian.branch?.name ?? "outro ramo"}.`,
        };
      }
      return { ok: false, reason: "noOption", message: "Nenhum upgrade disponível neste ramo." };
    }
    if (!this.economy.canAfford(option.cost)) {
      return { ok: false, reason: "insufficientPearls", message: "Pérolas insuficientes para este upgrade." };
    }
    if (!guardian.applyUpgrade(command.branchId, this.nowMs)) return { ok: false, reason: "noOption", message: "Upgrade indisponível." };
    this.spend(option.cost, "Upgrade", command.playerId ?? DEFAULT_PLAYER_ID);
    this.stats.recordUpgrade(guardian.upgradeLevel);
    this.emit({
      type: "guardianUpgraded",
      now: this.nowMs,
      id: guardian.id,
      guardianId: guardian.guardianId,
      branchId: command.branchId,
      level: guardian.upgradeLevel,
      optionName: option.name,
      branchName: option.branchName,
      cost: option.cost,
    });
    return { ok: true, instanceId: guardian.id, cost: option.cost };
  }

  /** Venda: devolve parte do investimento e limpa tudo que a unidade mantinha no mapa. */
  private sellGuardian(command: Extract<MatchCommand, { type: "sellGuardian" }>): CommandResult {
    const guardian = this.guardian(command.instanceId);
    if (!guardian) return { ok: false, reason: "notFound", message: "Guardião não encontrado." };
    const refund = guardian.sellValueAt(ECONOMY.sellRefundRate);
    this.removeGuardian(guardian);
    this.earn(refund, "SellRefund", command.playerId ?? DEFAULT_PLAYER_ID);
    this.stats.guardiansSold += 1;
    this.emit({ type: "guardianSold", now: this.nowMs, id: guardian.id, guardianId: guardian.guardianId, refund });
    return { ok: true, instanceId: guardian.id, refund };
  }

  private removeGuardian(guardian: MatchGuardian): void {
    const index = this.guardianList.indexOf(guardian);
    if (index >= 0) this.guardianList.splice(index, 1);
    if (guardian.platformId) this.platformOccupants.delete(guardian.platformId);
    for (let unit = this.routeUnits.length - 1; unit >= 0; unit -= 1) {
      if (this.routeUnits[unit].guardianId === guardian.id) this.routeUnits.splice(unit, 1);
    }
    this.areas.removeOwner(guardian.id, this.nowMs, this.emitBound);
    this.currents.setOwnerZones(guardian.id, []);
    this.blocking.forget(guardian.id);
    for (const enemy of this.enemyList) {
      if (enemy.blockedById === guardian.id) enemy.clearBlocked();
      if (enemy.status.markedBy(this.nowMs) === guardian.id) enemy.status.clearMark();
    }
    // Regra herdada da cena: vender um Golfinho com sonar solta a coordenação de todos os aliados.
    if (guardian.runtime.sonar) {
      for (const other of this.guardianList) if (other.runtime.preferredTarget) other.runtime.preferredTarget = null;
    }
  }

  private startNextWave(): CommandResult {
    if (this.scheduler.state !== "countdown") return { ok: false, reason: "notInCountdown", message: "A onda já está em curso." };
    const remainingMs = this.scheduler.countdownMs;
    if (!this.scheduler.skipCountdown()) return { ok: false, reason: "notInCountdown", message: "A onda já está em curso." };
    this.stats.earlyWaveCalls += 1;
    return { ok: true, earlyStartMs: remainingMs };
  }

  // -------------------------------------------------------------------- tick

  /** Um passo fixo de `dtMs`. Não faz nada depois da vitória ou derrota. */
  tick(): void {
    if (this.statusValue !== "running") return;
    const deltaMs = this.dtMs;
    this.nowMs += deltaMs;
    this.stats.timeMs = this.nowMs;
    this.controller?.act(this);
    // Habilidades de escopo de mundo (inversão de corrente do chefe) rodam antes das ondas, como antes.
    this.abilitySystem.worldTick(deltaMs, this.abilityWorld());

    const alive = this.enemyList.filter((enemy) => !enemy.dead && !enemy.reachedGoal).length;
    for (const event of this.scheduler.tick(deltaMs, alive)) {
      if (event.type === "spawn") {
        this.spawnEnemy(event.enemyId, { pathId: event.pathId, pathDistance: 0 }, event.eliteId);
      } else if (event.type === "waveStarted") {
        // Chamar a onda antes da hora rende pérolas por segundo poupado (taxa 0 = desligado).
        const bonus = this.earn(Math.floor((event.earlyStartMs / 1000) * ECONOMY.earlyStartBonusPerSecond), "EarlyWaveBonus", DEFAULT_PLAYER_ID);
        void bonus;
        this.emit({
          type: "waveStarted",
          now: this.nowMs,
          waveIndex: event.waveIndex,
          name: this.level.waves[event.waveIndex]?.name ?? "",
          isLast: event.waveIndex === this.level.waves.length - 1,
        });
      } else if (event.type === "waveCleared") {
        this.stats.wavesCompleted += 1;
        const bonus = this.earn(event.reward, "WaveReward", DEFAULT_PLAYER_ID);
        this.emit({ type: "waveCompleted", now: this.nowMs, waveIndex: event.waveIndex, bonus });
      } else if (event.type === "victory") {
        const bonus = this.earn(this.level.levelClearBonus ?? ECONOMY.levelClearBonus, "LevelReward", DEFAULT_PLAYER_ID);
        this.statusValue = "victory";
        this.emit({ type: "levelCompleted", now: this.nowMs, bonus });
      }
    }

    this.currents.update(this.nowMs);
    this.syncGuardianCurrents();
    this.blocking.update(this.guardianList, this.enemyList, this.nowMs, deltaMs, {
      damage: (enemy, amount) => this.damage(enemy, amount, { continuous: true, cause: "contact" }),
      onBossHeld: (blocker, enemy) => this.emit({ type: "enemyHeld", now: this.nowMs, blockerId: blocker.id, enemyId: enemy.id, x: enemy.x, y: enemy.y }),
      onReleased: (blocker, enemy) => this.emit({ type: "enemyReleased", now: this.nowMs, blockerId: blocker.id, enemyId: enemy.id, x: enemy.x, y: enemy.y }),
    });
    this.abilitySystem.tick(deltaMs, this.abilityWorld());
    for (const enemy of this.enemyList) {
      if (enemy.tick(this.nowMs, deltaMs, this.currents)) this.leak(enemy);
    }
    this.drainPoison();

    const hooks = this.behaviorHooks();
    for (const guardian of this.guardianList) {
      updateIncome(guardian, hooks);
      updateTrap(guardian, this.enemyList, hooks);
    }
    this.updateAuras();
    for (const guardian of this.guardianList) {
      guardian.syncStatus(this.nowMs);
      updateFrenzy(guardian, this.enemyList, this.nowMs);
      updateMark(guardian, this.enemyList, hooks);
      guardian.tick(this.nowMs, this.enemyList, (attacker, target) => this.resolveAttack(attacker, target));
    }
    for (const guardian of this.guardianList) {
      updatePushWave(guardian, this.enemyList, hooks);
      updateSonar(guardian, this.enemyList, this.guardianList, hooks);
    }
    const damage = (enemy: MatchEnemy, amount: number, options?: DamageOptions) => this.damage(enemy, amount, options);
    this.areas.update({ now: this.nowMs, enemies: this.enemyList, damage, emit: this.emitBound });
    this.projectileSystem.update(deltaMs, { now: this.nowMs, enemies: this.enemyList, currents: this.currents, damage, emit: this.emitBound });

    for (let index = this.enemyList.length - 1; index >= 0; index -= 1) {
      if (this.enemyList[index].dead || this.enemyList[index].reachedGoal) this.enemyList.splice(index, 1);
    }
  }

  // ----------------------------------------------------------------- internos

  private readonly emitBound = (event: MatchEvent): void => this.emit(event);

  private emit(event: MatchEvent): void {
    this.listener?.(event);
  }

  private spawnEnemy(
    enemyId: EnemyId,
    at: { pathId: string; pathDistance: number } = { pathId: MAIN_PATH_ID, pathDistance: 0 },
    eliteId: EliteId | null = null,
  ): void {
    const base = eliteId ? applyElite(ENEMIES[enemyId], ELITES[eliteId]) : ENEMIES[enemyId];
    const definition = scaleEnemy(base, this.level.enemyScaling, this.level.enemyOverrides?.[enemyId]);
    const route = this.routes.get(at.pathId) ?? this.route;
    const enemy = new MatchEnemy(`E${++this.enemySerial}`, definition, route, at.pathId);
    if (at.pathDistance > 0) enemy.setPathDistance(at.pathDistance);
    this.enemyList.push(enemy);
    this.abilitySystem.register(enemy, this.abilityWorld());
    this.emit({ type: "enemySpawned", now: this.nowMs, id: enemy.id, enemyId, x: enemy.x, y: enemy.y, pathId: at.pathId });
    this.onBossEvents(this.bossEncounter.onSpawn(enemy), enemy);
  }

  /** Traduz os eventos do encontro de chefe para eventos de partida (e paga a recompensa extra). */
  private onBossEvents(events: readonly BossEncounterEvent[], enemy: MatchEnemy): void {
    for (const event of events) {
      switch (event.type) {
        case "bossStarted":
          this.emit({
            type: "bossStarted",
            now: this.nowMs,
            id: enemy.id,
            enemyId: enemy.definition.baseId ?? enemy.definition.id,
            name: event.name,
            title: event.title,
            phaseCount: event.phaseCount,
          });
          break;
        case "bossPhaseChanged":
          this.emit({
            type: "bossPhaseChanged",
            now: this.nowMs,
            id: enemy.id,
            phaseIndex: event.phaseIndex,
            phaseCount: this.bossEncounter.snapshot()?.phaseCount ?? event.phaseIndex + 1,
            announcement: event.phase.announcement ?? null,
          });
          break;
        case "bossDefeated":
          if (event.extraPearls > 0) this.earn(event.extraPearls, "SpecialReward", DEFAULT_PLAYER_ID);
          this.emit({
            type: "bossDefeated",
            now: this.nowMs,
            id: enemy.id,
            enemyId: enemy.definition.baseId ?? enemy.definition.id,
            name: enemy.definition.name,
            x: enemy.x,
            y: enemy.y,
          });
          break;
        case "bossLeaked":
          break;
      }
    }
  }

  /** Contexto que as habilidades de inimigo enxergam (item 6): sem Phaser, sem acesso à cena. */
  private abilityWorld(): EnemyAbilityWorld<MatchEnemy> {
    return {
      now: this.nowMs,
      enemies: this.enemyList,
      guardians: this.guardianList,
      currents: this.currents,
      spawnEnemy: (enemyId, at) => this.spawnEnemy(enemyId, at),
      heal: (enemy, amount) => enemy.heal(amount),
      emit: (event) => this.onAbilityEvent(event),
    };
  }

  private onAbilityEvent(event: EnemyAbilityEvent): void {
    if (event.type !== "currentsReversed") return;
    const boss = this.enemy(event.enemyId);
    this.emit({ type: "currentsReversed", now: this.nowMs, reversed: event.reversed, bossName: boss?.definition.name ?? null });
  }

  private leak(enemy: MatchEnemy): void {
    this.bossEncounter.onRemoved(enemy);
    const damage = this.invincible ? 0 : Math.round(enemy.definition.reefDamage * enemy.mods.reefDamage);
    this.reefValue = Math.max(0, this.reefValue - damage);
    this.stats.recordLeak(enemy.definition.id, damage, controlTier(enemy.definition));
    this.emit({
      type: "enemyReachedGoal",
      now: this.nowMs,
      id: enemy.id,
      enemyId: enemy.definition.id,
      name: enemy.definition.name,
      reefDamage: damage,
      reefLeft: this.reefValue,
    });
    if (this.reefValue <= 0 && this.statusValue === "running") {
      this.statusValue = "defeat";
      this.emit({ type: "defeat", now: this.nowMs });
    }
  }

  private behaviorHooks(): BehaviorHooks<MatchEnemy> {
    return {
      now: this.nowMs,
      damage: (enemy, amount, options) => this.damage(enemy, amount, { cause: "trap", ...options }),
      earn: (amount) => this.earn(amount, "GuardianGeneration", DEFAULT_PLAYER_ID),
      spawnCloud: (ownerId, x, y, cloud) => this.areas.createToxicCloud(ownerId, x, y, cloud, this.nowMs, this.emitBound),
      onEscaped: (blockerId, enemyId) => {
        const blocker = this.guardian(blockerId);
        const cooldown = blocker?.stats.blockHold?.releaseCooldownMs ?? 500;
        this.blocking.notifyEscaped(blockerId, enemyId, this.nowMs, cooldown);
      },
      emit: (event) => this.emit({ type: "behavior", now: this.nowMs, event }),
    };
  }

  private drainPoison(): void {
    for (const enemy of this.enemyList) {
      if (enemy.dead || enemy.reachedGoal) continue;
      const owed = enemy.status.drainPoison(this.nowMs);
      if (owed > 0) this.damage(enemy, owed, { continuous: true, cause: "poison" });
    }
  }

  private resolveAttack(guardian: MatchGuardian, target: MatchEnemy): void {
    resolveAttack(
      {
        now: this.nowMs,
        enemies: this.enemyList,
        damage: (enemy, amount, options) => this.damage(enemy, amount, options),
        fireProjectile: (owner, enemy) => this.projectileSystem.fire(owner, enemy, this.nowMs, this.emitBound),
        createField: (owner, x, y) => {
          if (this.areas.createField(owner, x, y, this.nowMs, this.emitBound)) this.stats.abilitiesUsed += 1;
        },
        createCloud: (owner, x, y) => {
          if (this.areas.createInkCloud(owner, x, y, this.nowMs, this.emitBound)) this.stats.abilitiesUsed += 1;
        },
        emit: this.emitBound,
      },
      guardian,
      target,
    );
  }

  private damage(enemy: MatchEnemy, amount: number, options: DamageOptions = {}): void {
    const outcome = options.continuous ? enemy.takeContinuousDamage(amount, options) : enemy.takeDamage(amount, options);
    if (outcome.applied <= 0 && !outcome.killed) return;
    const cause = options.cause ?? (options.continuous ? "contact" : "melee");
    const source = options.sourceId ? this.guardian(options.sourceId) : undefined;
    this.abilitySystem.damaged(enemy, outcome.applied, this.abilityWorld());
    this.onBossEvents(this.bossEncounter.onDamaged(enemy, this.abilityWorld()), enemy);
    this.stats.recordDamage(outcome.applied, cause, options.sourceId ?? null, source?.guardianId ?? null);
    if (this.listener) {
      this.emit({
        type: "enemyDamaged",
        now: this.nowMs,
        id: enemy.id,
        amount: outcome.applied,
        health: enemy.health,
        maxHealth: enemy.definition.maxHealth,
        x: enemy.x,
        y: enemy.y,
        cause,
        sourceId: options.sourceId ?? null,
      });
    }
    if (!outcome.killed) return;
    this.abilitySystem.died(enemy, this.abilityWorld());
    this.onBossEvents(this.bossEncounter.onRemoved(enemy), enemy);
    const reward = this.earn(enemy.definition.reward, "EnemyReward", DEFAULT_PLAYER_ID);
    this.stats.recordKill(enemy.definition.id, Boolean(enemy.definition.isBoss), source?.guardianId ?? null);
    this.emit({
      type: "enemyKilled",
      now: this.nowMs,
      id: enemy.id,
      enemyId: enemy.definition.id,
      x: enemy.x,
      y: enemy.y,
      reward,
      killerId: options.sourceId ?? null,
    });
  }

  private updateAuras(): void {
    const sources: AuraSource[] = [];
    for (const guardian of this.guardianList) {
      const provided = guardian.stats.providedAura;
      if (provided) sources.push({ id: guardian.id, x: guardian.x, y: guardian.y, range: guardian.range, aura: provided });
      const chorus = updateChorus(guardian, this.guardianList, this.nowMs, (event) => this.emit({ type: "behavior", now: this.nowMs, event }));
      if (chorus) sources.push(chorus);
    }
    this.guardianList.forEach((guardian) =>
      guardian.setAura(resolveAura({ id: guardian.id, guardianId: guardian.guardianId, x: guardian.x, y: guardian.y }, sources)),
    );
  }

  /** Zonas de corrente presas a Guardiões (Tartaruga): recalculadas a cada tick a partir dos stats. */
  private syncGuardianCurrents(): void {
    const owners = new Set<string>();
    for (const field of flowFieldsFor(this.guardianList)) {
      owners.add(field.ownerId);
      this.currents.setOwnerZones(field.ownerId, [zoneFromFlowField(field)]);
    }
    for (const guardian of this.guardianList) if (!owners.has(guardian.id)) this.currents.setOwnerZones(guardian.id, []);
  }

  private earn(amount: number, source: PearlSource, playerId: PlayerId): number {
    const credited = this.economy.earn(amount, source);
    if (credited > 0) this.emit({ type: "pearlsChanged", now: this.nowMs, playerId, pearls: this.economy.pearls, delta: credited, source });
    return credited;
  }

  private spend(cost: number, sink: PearlSink, playerId: PlayerId): void {
    this.economy.spend(cost, sink);
    this.emit({ type: "pearlsChanged", now: this.nowMs, playerId, pearls: this.economy.pearls, delta: -cost, source: sink });
  }
}
