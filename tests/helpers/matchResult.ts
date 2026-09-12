import type { MatchStatsSnapshot } from "../../src/game/core/match/MatchStats";
import type { MatchResult } from "../../src/game/core/progression/MatchResult";

const BASE_STATS: MatchStatsSnapshot = {
  timeMs: 120_000,
  wavesCompleted: 5,
  totalWaves: 5,
  livesLost: 0,
  enemiesKilled: 40,
  enemiesLeaked: 0,
  kills: { swimmer: 40 },
  leaks: {},
  eliteLeaks: 0,
  bossLeaks: 0,
  bossesDefeated: ["tidebreaker"],
  damageDealt: 4000,
  damageByCause: {},
  damageByGuardian: {},
  damageByGuardianType: {},
  killsByGuardianType: {},
  guardiansPlaced: 3,
  guardiansSold: 0,
  placementsByGuardian: {},
  distinctGuardiansUsed: ["pistol-shrimp"],
  maxSimultaneousGuardians: 3,
  upgradesBought: 2,
  maxUpgradeLevel: 1,
  abilitiesUsed: 0,
  earlyWaveCalls: 0,
  pearlsEarned: 300,
  pearlsSpent: 250,
  pearlsBySource: {},
  interactablesCompleted: [],
  secretsFound: [],
  cheated: false,
};

/** Resultado de partida de teste: vitória limpa, com os campos que cada caso quiser trocar. */
export function makeResult(overrides: Partial<Omit<MatchResult, "stats">> & { stats?: Partial<MatchStatsSnapshot> } = {}): MatchResult {
  const { stats, ...rest } = overrides;
  return {
    levelId: "recife-1",
    difficulty: "normal",
    victory: true,
    livesRemaining: 20,
    maxLives: 20,
    loadout: ["pistol-shrimp", "jellyfish", "pufferfish", "reef-crab", "ink-octopus"],
    loadoutOverride: false,
    ...rest,
    stats: { ...BASE_STATS, ...stats },
  };
}
