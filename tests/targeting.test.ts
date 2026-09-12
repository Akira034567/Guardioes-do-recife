import { describe, expect, it } from "vitest";
import { compareThreat, selectTarget, selectThreat } from "../src/game/core/Targeting";
import { FakeEnemy } from "./helpers/fakes";

const origin = { x: 100, y: 0 };

describe("targeting policies", () => {
  const near = new FakeEnemy("near", "swimmer", 60);
  const lead = new FakeEnemy("lead", "swimmer", 180);
  const hurt = new FakeEnemy("hurt", "swimmer", 120);
  hurt.health = 10;
  const elite = new FakeEnemy("elite", "moray", 90);
  const boss = new FakeEnemy("boss", "tidebreaker", 40);
  const far = new FakeEnemy("far", "tidebreaker", 900);
  const all = [near, lead, hurt, elite, boss, far];

  it("keeps the leading policy as the default and never picks anything out of range", () => {
    expect(selectTarget(all, origin, 100, { mode: "leading" })?.id).toBe("lead");
    expect(selectTarget(all, origin, 100, { mode: "threat", preferredId: "far" })?.id).toBe("boss");
    expect(selectTarget([far], origin, 100, { mode: "leading" })).toBeUndefined();
  });

  it("prefers the lowest health, then wounded-first, then threat ordering", () => {
    expect(selectTarget(all, origin, 100, { mode: "lowestHealth" })?.id).toBe("hurt");
    expect(selectTarget(all, origin, 100, { mode: "wounded", threshold: 0.4 })?.id).toBe("hurt");
    expect(selectTarget([near, lead], origin, 100, { mode: "wounded", threshold: 0.4 })?.id).toBe("lead");
    expect(selectTarget(all, origin, 100, { mode: "threat" })?.id).toBe("boss");
    expect(selectThreat([near, lead, elite], origin, 100)?.id).toBe("elite");
    expect([lead, near, elite].sort(compareThreat).map((enemy) => enemy.id)).toEqual(["elite", "lead", "near"]);
  });

  it("honours the coordinated target and the marked prey when they are in range", () => {
    expect(selectTarget(all, origin, 100, { mode: "leading", preferredId: "near" })?.id).toBe("near");
    expect(selectTarget(all, origin, 100, { mode: "leading", markedId: "hurt" })?.id).toBe("hurt");
    expect(selectTarget(all, origin, 100, { mode: "leading", preferredId: "near", markedId: "hurt" })?.id).toBe("near");
  });

  it("ignores dead or leaked enemies", () => {
    const dead = new FakeEnemy("dead", "tidebreaker", 100);
    dead.dead = true;
    expect(selectTarget([dead, near], origin, 100, { mode: "threat" })?.id).toBe("near");
  });
});
