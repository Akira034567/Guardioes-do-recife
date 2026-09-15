import { describe, expect, it } from "vitest";
import { controlTier } from "../src/game/core/CrowdControl";
import { ELITE_BALANCE } from "../src/game/data/balance";
import { ENEMIES, resolveEnemy, scaleEnemy } from "../src/game/data/enemies";
import { applyElite, ELITE_IDS, ELITES, eliteAllowedFor, eliteInstanceKey } from "../src/game/data/elites";

describe("elite modifiers", () => {
  it("keeps the base id, records the variant and never mutates the catalogue", () => {
    const before = JSON.stringify(ENEMIES.shellback);
    const elite = applyElite(ENEMIES.shellback, ELITES.armored);
    expect(elite.id, "as contagens de abate e os overrides continuam usando o id base").toBe("shellback");
    expect(elite.baseId).toBe("shellback");
    expect(elite.eliteId).toBe("armored");
    expect(elite.name).toBe("Cascudo Blindado");
    expect(JSON.stringify(ENEMIES.shellback)).toBe(before);
  });

  it("multiplies stats, adds armor and raises the reward", () => {
    const base = resolveEnemy(ENEMIES.swimmer);
    const elite = applyElite(ENEMIES.swimmer, ELITES.armored);
    expect(elite.maxHealth).toBe(Math.round(base.maxHealth * ELITE_BALANCE.armored.maxHealth));
    expect(elite.armor).toBe(base.armor + ELITE_BALANCE.armored.armorBonus);
    expect(elite.speed).toBe(Math.round(base.speed * ELITE_BALANCE.armored.speed));
    expect(elite.reward).toBe(Math.round(base.reward * ELITE_BALANCE.armored.rewardMultiplier));
  });

  it("promotes a common enemy to the elite control tier and tags", () => {
    const elite = applyElite(ENEMIES.swimmer, ELITES.swift);
    expect(elite.role).toBe("elite");
    expect(controlTier(elite)).toBe("elite");
    expect(elite.tags).toContain("ELITE");
    expect(elite.tags).toContain("FAST");
    expect(elite.threatLevel).toBeGreaterThanOrEqual(2);
  });

  it("keeps a boss a boss, stacking both tags and its own ability", () => {
    const elite = applyElite(ENEMIES.tidebreaker, ELITES.swift);
    expect(elite.isBoss).toBe(true);
    expect(elite.unblockable).toBe(true);
    expect(controlTier(elite)).toBe("boss");
    expect(elite.tags).toEqual(expect.arrayContaining(["BOSS", "ELITE"]));
    expect(elite.abilities.some((ability) => ability.type === "amplifyCurrents")).toBe(true);
  });

  it("adds resistances on top of the base ones, clamped to 1", () => {
    const elite = applyElite(ENEMIES.moray, ELITES.resilient);
    expect(elite.resistances.slow).toBeCloseTo(0.5 + ELITE_BALANCE.resilient.slowResistance);
    expect(elite.resistances.stun).toBeCloseTo(ELITE_BALANCE.resilient.stunResistance);
    const twice = applyElite(applyElite(ENEMIES.moray, ELITES.resilient), ELITES.resilient);
    expect(twice.resistances.slow).toBeLessThanOrEqual(1);
  });

  it("resolves the regenerator's rate from the elite's own max health", () => {
    const elite = applyElite(ENEMIES.shellback, ELITES.regenerating);
    const regen = elite.abilities.find((ability) => ability.type === "regen");
    expect(regen).toBeDefined();
    expect(regen?.type === "regen" && regen.hpPerSecond).toBeCloseTo(elite.maxHealth * ELITE_BALANCE.regenerating.hpPerSecond, 1);
  });

  it("still takes the level scaling and per-level overrides of the base enemy", () => {
    const elite = applyElite(ENEMIES.tidebreaker, ELITES.armored);
    const scaled = scaleEnemy(elite, { health: 0.75, speed: 1, reward: 1.2 }, { maxHealth: 360 });
    expect(scaled.maxHealth, "o override da fase vence os multiplicadores do elite").toBe(270);
    expect(scaled.eliteId).toBe("armored");
  });

  it("names a counting key per variant and allows elites only where they make sense", () => {
    expect(eliteInstanceKey(applyElite(ENEMIES.swimmer, ELITES.swift))).toBe("swimmer#swift");
    expect(eliteInstanceKey(resolveEnemy(ENEMIES.swimmer))).toBe("swimmer");
    expect(eliteAllowedFor(ENEMIES.swimmer)).toBe(true);
    expect(eliteAllowedFor(ENEMIES.minnow), "cardume não vira elite").toBe(false);
    expect(eliteAllowedFor(ENEMIES.tidebreaker), "chefe não vira elite por sorteio").toBe(false);
  });

  it("has a complete, coherent catalogue", () => {
    expect(ELITE_IDS.length).toBeGreaterThanOrEqual(6);
    for (const id of ELITE_IDS) {
      const modifier = ELITES[id];
      expect(modifier.id).toBe(id);
      expect(modifier.name.length).toBeGreaterThan(0);
      expect(modifier.description.length).toBeGreaterThan(0);
      expect(modifier.rewardMultiplier).toBeGreaterThan(1);
    }
  });
});
