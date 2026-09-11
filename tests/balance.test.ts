import { describe, expect, it } from "vitest";
import { ECONOMY, ENEMY_BALANCE, GUARDIAN_BALANCE } from "../src/game/data/balance";
import { ENEMIES, ENEMY_ORDER, scaleEnemy } from "../src/game/data/enemies";
import { GUARDIANS } from "../src/game/data/guardians";
import type { EnemyId, GuardianId } from "../src/game/types";

describe("balance sheet", () => {
  it("uses the agreed guardian prices", () => {
    const expected: Record<GuardianId, [number, number, number]> = {
      "pistol-shrimp": [80, 70, 130],
      jellyfish: [100, 85, 145],
      pufferfish: [110, 90, 150],
      "reef-crab": [90, 80, 140],
      "ink-octopus": [120, 100, 170],
    };
    (Object.keys(expected) as GuardianId[]).forEach((id) => {
      expect(GUARDIAN_BALANCE[id].cost).toBe(expected[id][0]);
      expect([...GUARDIAN_BALANCE[id].upgradeCosts]).toEqual(expected[id].slice(1));
    });
    expect(ECONOMY.startingPearls).toBe(180);
    expect(ECONOMY.sellRefundRate).toBe(0.25);
    expect(ECONOMY.waveClearBonus).toBe(25);
    expect(ECONOMY.levelClearBonus).toBe(75);
    expect(ECONOMY.reefHealth).toBe(20);
  });

  it("uses the agreed enemy rewards, health and leak damage", () => {
    const expected: Record<EnemyId, { maxHealth: number; reward: number; reefDamage: number }> = {
      minnow: { maxHealth: 18, reward: 2, reefDamage: 1 },
      swimmer: { maxHealth: 55, reward: 5, reefDamage: 1 },
      dartfish: { maxHealth: 35, reward: 6, reefDamage: 1 },
      needlefish: { maxHealth: 45, reward: 7, reefDamage: 2 },
      shellback: { maxHealth: 130, reward: 10, reefDamage: 2 },
      moray: { maxHealth: 250, reward: 18, reefDamage: 4 },
      tidebreaker: { maxHealth: 550, reward: 60, reefDamage: 10 },
    };
    (Object.keys(expected) as EnemyId[]).forEach((id) => {
      expect(ENEMY_BALANCE[id]).toMatchObject(expected[id]);
      expect(ENEMIES[id].id).toBe(id);
      expect(ENEMIES[id].reefDamage).toBeGreaterThanOrEqual(1);
      expect(ENEMIES[id].reefDamage).toBeLessThanOrEqual(10);
    });
    expect(ENEMY_ORDER).toHaveLength(7);
    expect(ENEMIES.shellback.armor).toBe(4);
    expect(ENEMIES.tidebreaker.isBoss).toBe(true);
    expect(ENEMIES.tidebreaker.unblockable).toBe(true);
    expect(ENEMIES.tidebreaker.reefDamage).toBeLessThan(ECONOMY.reefHealth);
  });

  it("scales enemies per level without touching the reference sheet", () => {
    const scaled = scaleEnemy(ENEMIES.swimmer, { health: 1.3, speed: 1.05, reward: 1 });
    expect(scaled.maxHealth).toBe(72);
    expect(scaled.speed).toBe(61);
    expect(scaled.reward).toBe(5);
    expect(ENEMIES.swimmer.maxHealth).toBe(55);
    const softened = scaleEnemy(ENEMIES.tidebreaker, { health: 0.85, speed: 1, reward: 1.2 }, { maxHealth: 400 });
    expect(softened).toMatchObject({ maxHealth: 340, reward: 72, armor: 3, reefDamage: 10, isBoss: true });
  });

  it("matches the agreed damage profile for the first version", () => {
    expect(GUARDIANS["pistol-shrimp"]).toMatchObject({ damage: 20, cooldownMs: 1200 });
    expect(GUARDIANS["pistol-shrimp"].branches[0].upgrades[0].pierceDamages).toEqual([20, 15]);
    expect(GUARDIANS["pistol-shrimp"].branches[0].upgrades[1].pierceDamages).toEqual([24, 19, 15]);
    expect(GUARDIANS["pistol-shrimp"].branches[1].upgrades[0]).toMatchObject({ damage: 34, cooldownMs: 1350 });
    expect(GUARDIANS["pistol-shrimp"].branches[1].upgrades[1]).toMatchObject({ damage: 50, cooldownMs: 1400 });
    expect(GUARDIANS.jellyfish.damage / (GUARDIANS.jellyfish.cooldownMs / 1000)).toBeCloseTo(9);
    expect(GUARDIANS.jellyfish.branches[0].upgrades[0].chainDamages).toEqual([9, 6, 4]);
    expect(GUARDIANS.pufferfish.contactDamagePerSecond).toBe(8);
    expect(GUARDIANS.pufferfish.branches[0].upgrades.map((upgrade) => upgrade.contactDamagePerSecond)).toEqual([12, 15]);
    expect(GUARDIANS.pufferfish.branches[1].upgrades.map((upgrade) => upgrade.damage)).toEqual([25, 40]);
    expect(GUARDIANS["reef-crab"]).toMatchObject({ damage: 28, cooldownMs: 1400 });
    expect(GUARDIANS["reef-crab"].branches[0].upgrades.map((upgrade) => upgrade.damage)).toEqual([32, 45]);
    expect(GUARDIANS["reef-crab"].branches[1].upgrades[1].spin).toMatchObject({ everyAttacks: 4, damage: 35 });
    expect(GUARDIANS["ink-octopus"]).toMatchObject({ damage: 10, cooldownMs: 1600 });
    expect(GUARDIANS["ink-octopus"].vulnerability?.multiplier).toBe(1.1);
    expect(GUARDIANS["ink-octopus"].branches[1].upgrades.map((upgrade) => upgrade.aura?.attackSpeedMultiplier)).toEqual([1.1, 1.15]);
    expect(GUARDIANS["ink-octopus"].branches[1].upgrades.every((upgrade) => upgrade.damage === undefined)).toBe(true);
  });
});
