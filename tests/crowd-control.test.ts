import { describe, expect, it } from "vitest";
import { applyStun, controlTier, knockbackAlongPath, resistanceFor } from "../src/game/core/CrowdControl";
import { CROWD_CONTROL } from "../src/game/data/balance";
import { FakeEnemy } from "./helpers/fakes";

describe("crowd control layer", () => {
  it("classifies enemies into control tiers", () => {
    expect(controlTier({ role: "common" })).toBe("common");
    expect(controlTier({ role: "elite" })).toBe("elite");
    expect(controlTier({ role: "boss", isBoss: true })).toBe("boss");
    expect(resistanceFor("common")).toBeNull();
    expect(resistanceFor("boss")?.steps).toEqual([...CROWD_CONTROL.boss.steps]);
  });

  it("applies the boss diminishing returns 100% → 60% → 30% → immune, then resets after the window", () => {
    const boss = new FakeEnemy("B", "tidebreaker", 500);
    const { windowMs, immunityMs } = CROWD_CONTROL.boss;
    expect(applyStun(boss, 1000, 0)).toBeCloseTo(1000);
    expect(applyStun(boss, 1000, 1100)).toBeCloseTo(600);
    expect(applyStun(boss, 1000, 1800)).toBeCloseTo(300);
    expect(boss.status.isControlImmune(2200)).toBe(true);
    expect(applyStun(boss, 1000, 2200)).toBe(0);
    const later = 1800 + immunityMs + windowMs + 1;
    expect(boss.status.isControlImmune(later)).toBe(false);
    expect(applyStun(boss, 1000, later)).toBeCloseTo(1000);
  });

  it("stuns commons at full duration every time and scales elites by the per-ability factor", () => {
    const common = new FakeEnemy("C", "swimmer");
    expect(applyStun(common, 800, 0)).toBe(800);
    expect(applyStun(common, 800, 900)).toBe(800);
    const elite = new FakeEnemy("E", "moray");
    expect(applyStun(elite, 800, 0, { eliteFactor: 0.6 })).toBeCloseTo(480);
    expect(applyStun(elite, 800, 600, { eliteFactor: 0.6 })).toBeCloseTo(480 * CROWD_CONTROL.elite.steps[1]);
  });

  it("knocks commons back along the path, elites partially, and never below the start", () => {
    const common = new FakeEnemy("C", "swimmer", 300);
    expect(knockbackAlongPath(common, 90, 0, { eliteFactor: 0.5 })).toBe("pushed");
    expect(common.pathDistance).toBe(210);
    expect(common.x).toBe(210);
    const elite = new FakeEnemy("E", "moray", 300);
    expect(knockbackAlongPath(elite, 90, 0, { eliteFactor: 0.5 })).toBe("pushed");
    expect(elite.pathDistance).toBe(255);
    const early = new FakeEnemy("S", "swimmer", 20);
    knockbackAlongPath(early, 90, 0, {});
    expect(early.pathDistance).toBe(0);
  });

  it("only slows bosses instead of moving them", () => {
    const boss = new FakeEnemy("B", "tidebreaker", 600);
    expect(knockbackAlongPath(boss, 120, 0, { bossSlow: { factor: 0.5, durationMs: 1500 } })).toBe("slowed");
    expect(boss.pathDistance).toBe(600);
    expect(boss.status.slowFactor(100)).toBeLessThan(1);
    expect(knockbackAlongPath(boss, 120, 0, { bossSlow: null })).toBe("none");
  });

  it("frees a blocked enemy only when the push leaves the blocker's contact window", () => {
    const stuck = new FakeEnemy("S", "swimmer", 400);
    stuck.setBlocked("G1", 400);
    expect(knockbackAlongPath(stuck, 20, 0, {})).toBe("none");
    expect(stuck.blockedById).toBe("G1");
    expect(knockbackAlongPath(stuck, 90, 0, {})).toBe("pushed");
    expect(stuck.blockedById).toBeNull();
    expect(stuck.pathDistance).toBe(310);
  });
});
