import type { EconomySnapshot } from "../Economy";
import type { EnemyId, GuardianId } from "../../types";
import type { DamageCause } from "./MatchEvents";

/** Contadores de uma partida (item 36). Só o motor escreve; telas de resultado e conquistas leem. */
export interface MatchStatsSnapshot {
  timeMs: number;
  wavesCompleted: number;
  totalWaves: number;
  livesLost: number;
  enemiesKilled: number;
  enemiesLeaked: number;
  kills: Partial<Record<EnemyId, number>>;
  leaks: Partial<Record<EnemyId, number>>;
  eliteLeaks: number;
  bossLeaks: number;
  bossesDefeated: EnemyId[];
  damageDealt: number;
  damageByCause: Partial<Record<DamageCause, number>>;
  damageByGuardian: Record<string, number>;
  damageByGuardianType: Partial<Record<GuardianId, number>>;
  killsByGuardianType: Partial<Record<GuardianId, number>>;
  guardiansPlaced: number;
  guardiansSold: number;
  placementsByGuardian: Partial<Record<GuardianId, number>>;
  distinctGuardiansUsed: GuardianId[];
  maxSimultaneousGuardians: number;
  upgradesBought: number;
  maxUpgradeLevel: number;
  abilitiesUsed: number;
  earlyWaveCalls: number;
  pearlsEarned: number;
  pearlsSpent: number;
  pearlsBySource: EconomySnapshot["earned"];
  cheated: boolean;
}

export class MatchStats {
  timeMs = 0;
  wavesCompleted = 0;
  totalWaves = 0;
  livesLost = 0;
  enemiesKilled = 0;
  enemiesLeaked = 0;
  readonly kills: Partial<Record<EnemyId, number>> = {};
  readonly leaks: Partial<Record<EnemyId, number>> = {};
  eliteLeaks = 0;
  bossLeaks = 0;
  readonly bossesDefeated: EnemyId[] = [];
  damageDealt = 0;
  readonly damageByCause: Partial<Record<DamageCause, number>> = {};
  readonly damageByGuardian: Record<string, number> = {};
  readonly damageByGuardianType: Partial<Record<GuardianId, number>> = {};
  readonly killsByGuardianType: Partial<Record<GuardianId, number>> = {};
  guardiansPlaced = 0;
  guardiansSold = 0;
  readonly placementsByGuardian: Partial<Record<GuardianId, number>> = {};
  readonly distinctGuardiansUsed = new Set<GuardianId>();
  maxSimultaneousGuardians = 0;
  upgradesBought = 0;
  maxUpgradeLevel = 0;
  abilitiesUsed = 0;
  earlyWaveCalls = 0;
  cheated = false;

  recordDamage(amount: number, cause: DamageCause, sourceId: string | null, guardianId: GuardianId | null): void {
    if (amount <= 0) return;
    this.damageDealt += amount;
    this.damageByCause[cause] = (this.damageByCause[cause] ?? 0) + amount;
    if (sourceId) this.damageByGuardian[sourceId] = (this.damageByGuardian[sourceId] ?? 0) + amount;
    if (guardianId) this.damageByGuardianType[guardianId] = (this.damageByGuardianType[guardianId] ?? 0) + amount;
  }

  recordKill(enemyId: EnemyId, isBoss: boolean, killerType: GuardianId | null): void {
    this.enemiesKilled += 1;
    this.kills[enemyId] = (this.kills[enemyId] ?? 0) + 1;
    if (isBoss) this.bossesDefeated.push(enemyId);
    if (killerType) this.killsByGuardianType[killerType] = (this.killsByGuardianType[killerType] ?? 0) + 1;
  }

  recordLeak(enemyId: EnemyId, reefDamage: number, tier: "common" | "elite" | "boss"): void {
    this.enemiesLeaked += 1;
    this.leaks[enemyId] = (this.leaks[enemyId] ?? 0) + 1;
    this.livesLost += reefDamage;
    if (tier === "elite") this.eliteLeaks += 1;
    if (tier === "boss") this.bossLeaks += 1;
  }

  recordPlacement(guardianId: GuardianId, simultaneous: number): void {
    this.guardiansPlaced += 1;
    this.placementsByGuardian[guardianId] = (this.placementsByGuardian[guardianId] ?? 0) + 1;
    this.distinctGuardiansUsed.add(guardianId);
    this.maxSimultaneousGuardians = Math.max(this.maxSimultaneousGuardians, simultaneous);
  }

  recordUpgrade(level: number): void {
    this.upgradesBought += 1;
    this.maxUpgradeLevel = Math.max(this.maxUpgradeLevel, level);
  }

  snapshot(economy: EconomySnapshot): MatchStatsSnapshot {
    return {
      timeMs: this.timeMs,
      wavesCompleted: this.wavesCompleted,
      totalWaves: this.totalWaves,
      livesLost: this.livesLost,
      enemiesKilled: this.enemiesKilled,
      enemiesLeaked: this.enemiesLeaked,
      kills: { ...this.kills },
      leaks: { ...this.leaks },
      eliteLeaks: this.eliteLeaks,
      bossLeaks: this.bossLeaks,
      bossesDefeated: [...this.bossesDefeated],
      damageDealt: this.damageDealt,
      damageByCause: { ...this.damageByCause },
      damageByGuardian: { ...this.damageByGuardian },
      damageByGuardianType: { ...this.damageByGuardianType },
      killsByGuardianType: { ...this.killsByGuardianType },
      guardiansPlaced: this.guardiansPlaced,
      guardiansSold: this.guardiansSold,
      placementsByGuardian: { ...this.placementsByGuardian },
      distinctGuardiansUsed: [...this.distinctGuardiansUsed],
      maxSimultaneousGuardians: this.maxSimultaneousGuardians,
      upgradesBought: this.upgradesBought,
      maxUpgradeLevel: this.maxUpgradeLevel,
      abilitiesUsed: this.abilitiesUsed,
      earlyWaveCalls: this.earlyWaveCalls,
      pearlsEarned: economy.totalEarned,
      pearlsSpent: economy.totalSpent,
      pearlsBySource: economy.earned,
      cheated: this.cheated,
    };
  }
}
