import { describe, expect, it } from "vitest";
import { BlockingSystem } from "../src/game/core/Blocking";
import { FakeEnemy, FakeGuardian } from "./helpers/fakes";

const noop = { damage: () => undefined };

describe("blocking system", () => {
  it("reproduces the pufferfish: holds up to capacity, deals contact damage, ignores bosses", () => {
    const system = new BlockingSystem();
    const puffer = new FakeGuardian("P", "pufferfish", 400, 0);
    const first = new FakeEnemy("A", "swimmer", 380);
    const second = new FakeEnemy("B", "swimmer", 378);
    const boss = new FakeEnemy("Z", "tidebreaker", 385);
    const damaged: string[] = [];
    system.update([puffer], [first, second, boss], 0, 16, { damage: (enemy) => damaged.push(enemy.id) });
    expect(first.blockedById).toBe("P");
    expect(second.blockedById).toBeNull();
    expect(boss.blockedById).toBeNull();
    expect(damaged).toEqual(["A"]);
    for (let now = 16; now <= 10_000; now += 16) system.update([puffer], [first, second, boss], now, 16, noop);
    expect(first.blockedById).toBe("P");
  });

  it("releases a turtle grab after the hold and refuses to re-grab during the release cooldown", () => {
    const system = new BlockingSystem();
    const turtle = new FakeGuardian("T", "sea-turtle", 400, 0, "a", 1);
    const hold = turtle.stats.blockHold!;
    const enemy = new FakeEnemy("A", "swimmer", 380);
    system.update([turtle], [enemy], 0, 16, noop);
    expect(enemy.blockedById).toBe("T");
    system.update([turtle], [enemy], hold.durationMs - 1, 16, noop);
    expect(enemy.blockedById).toBe("T");
    system.update([turtle], [enemy], hold.durationMs, 16, noop);
    expect(enemy.blockedById).toBeNull();
    system.update([turtle], [enemy], hold.durationMs + 100, 16, noop);
    expect(enemy.blockedById).toBeNull();
    system.update([turtle], [enemy], hold.durationMs + hold.releaseCooldownMs + 1, 16, noop);
    expect(enemy.blockedById).toBe("T");
  });

  it("counts elites as two slots and only slows bosses", () => {
    const system = new BlockingSystem();
    const turtle = new FakeGuardian("T", "sea-turtle", 400, 0, "a", 1);
    expect(turtle.stats.blockCapacity).toBe(3);
    const elite = new FakeEnemy("E", "moray", 385);
    const first = new FakeEnemy("A", "swimmer", 380);
    const second = new FakeEnemy("B", "swimmer", 378);
    const boss = new FakeEnemy("Z", "tidebreaker", 384);
    system.update([turtle], [elite, first, second, boss], 0, 16, noop);
    expect(elite.blockedById).toBe("T");
    expect(first.blockedById).toBe("T");
    expect(second.blockedById).toBeNull();
    expect(boss.blockedById).toBeNull();
    expect(boss.status.slowFactor(10)).toBeLessThan(1);
  });

  it("does not block before the Casco upgrade and forgets sold blockers", () => {
    const system = new BlockingSystem();
    const base = new FakeGuardian("T", "sea-turtle", 400, 0);
    const enemy = new FakeEnemy("A", "swimmer", 380);
    system.update([base], [enemy], 0, 16, noop);
    expect(base.stats.blocks).toBe(false);
    expect(enemy.blockedById).toBeNull();
    base.upgrade("a", 1);
    system.update([base], [enemy], 16, 16, noop);
    expect(enemy.blockedById).toBe("T");
    system.update([], [enemy], 32, 16, noop);
    expect(enemy.blockedById).toBeNull();
    system.forget("T");
    expect(system.heldSince("T", "A")).toBeNull();
  });
});
