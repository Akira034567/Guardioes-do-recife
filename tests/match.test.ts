import { describe, expect, it } from "vitest";
import { Match } from "../src/game/core/match/Match";
import type { MatchEvent } from "../src/game/core/match/MatchEvents";
import { ECONOMY } from "../src/game/data/balance";
import { GUARDIANS } from "../src/game/data/guardians";
import { RECIFE_ONE } from "../src/game/data/levels";
import type { LevelDefinition } from "../src/game/types";

/** Fase mínima: rota curta, um único Peixe Invasor, uma plataforma perto da rota. */
const TINY: LevelDefinition = {
  ...RECIFE_ONE,
  id: "tiny",
  startingPearls: 200,
  reefHealth: 1,
  initialWaveDelayMs: 500,
  betweenWaveDelayMs: 500,
  enemyScaling: { health: 1, speed: 1, reward: 1 },
  enemyOverrides: {},
  waypoints: [
    { x: -40, y: 300 },
    { x: 200, y: 300 },
    { x: 400, y: 300 },
    { x: 700, y: 300 },
  ],
  placements: [{ id: "p1", x: 300, y: 200 }],
  currents: [],
  waves: [{ name: "um", groups: [{ enemyId: "swimmer", count: 1, intervalMs: 500, delayMs: 0 }] }],
};

function record(match: Match): MatchEvent[] {
  const events: MatchEvent[] = [];
  match.setListener((event) => events.push(event));
  return events;
}

function run(match: Match, ms: number): void {
  const ticks = Math.ceil(ms / match.dtMs);
  for (let index = 0; index < ticks; index += 1) match.tick();
}

describe("Match commands", () => {
  it("rejects a placement with 0 pearls and keeps the state untouched", () => {
    const match = new Match({ ...TINY, startingPearls: 0 });
    const result = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 300, y: 200 });
    expect(result).toMatchObject({ ok: false, reason: "insufficientPearls" });
    expect(match.guardians).toHaveLength(0);
    expect(match.pearls()).toBe(0);
  });

  it("places on a platform, charges the cost and refuses a second unit on the same platform", () => {
    const match = new Match(TINY);
    const events = record(match);
    const placed = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 300, y: 200 });
    expect(placed).toMatchObject({ ok: true, instanceId: "G1", cost: GUARDIANS["pistol-shrimp"].cost });
    expect(match.pearls()).toBe(200 - GUARDIANS["pistol-shrimp"].cost);
    expect(match.platformOccupant("p1")).toBe("G1");
    expect(events.map((event) => event.type)).toEqual(["pearlsChanged", "guardianPlaced"]);

    const again = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 300, y: 200, platformId: "p1" });
    expect(again).toMatchObject({ ok: false, reason: "platformOccupied" });
    const water = match.execute({ type: "placeGuardian", guardianId: "jellyfish", x: 300, y: 200, platformId: "p1" });
    expect(water).toMatchObject({ ok: false, reason: "needsPlatform" });
  });

  it("locks the other branch after the first upgrade and reports the reason", () => {
    const match = new Match(RECIFE_ONE);
    match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 375, y: 245 });
    expect(match.execute({ type: "upgradeGuardian", instanceId: "G1", branchId: "a" })).toMatchObject({ ok: true });
    expect(match.execute({ type: "upgradeGuardian", instanceId: "G1", branchId: "b" })).toMatchObject({ ok: false, reason: "branchLocked" });
    expect(match.execute({ type: "upgradeGuardian", instanceId: "G9", branchId: "a" })).toMatchObject({ ok: false, reason: "notFound" });
    expect(match.stats.upgradesBought).toBe(1);
  });

  it("sells a blocker while it holds an enemy: frees the enemy, refunds 25% and clears route occupancy", () => {
    const match = new Match(TINY);
    const placed = match.execute({ type: "placeGuardian", guardianId: "pufferfish", x: 400, y: 300 });
    expect(placed.ok).toBe(true);
    expect(match.routeOccupants).toHaveLength(1);
    run(match, 10_000);
    const enemy = match.enemies[0];
    expect(enemy, "o inimigo deveria estar preso no Baiacu").toBeDefined();
    expect(enemy.blockedById).toBe("G1");

    const before = match.pearls();
    const sold = match.execute({ type: "sellGuardian", instanceId: "G1" });
    const expectedRefund = Math.floor(GUARDIANS.pufferfish.cost * ECONOMY.sellRefundRate);
    expect(sold).toMatchObject({ ok: true, refund: expectedRefund });
    expect(match.pearls()).toBe(before + expectedRefund);
    expect(match.guardians).toHaveLength(0);
    expect(match.routeOccupants).toHaveLength(0);
    expect(enemy.blockedById).toBeNull();
    expect(match.stats.guardiansSold).toBe(1);
    expect(match.economySnapshot().earned.SellRefund).toBe(expectedRefund);
  });

  it("removes electric fields and marks owned by a sold guardian", () => {
    const match = new Match({ ...TINY, startingPearls: 1000 });
    expect(match.execute({ type: "placeGuardian", guardianId: "jellyfish", x: 480, y: 215 })).toMatchObject({ ok: true });
    match.execute({ type: "upgradeGuardian", instanceId: "G1", branchId: "a" });
    match.execute({ type: "upgradeGuardian", instanceId: "G1", branchId: "a" });
    while (match.fields.length === 0 && match.now < 12_000 && match.status === "running") match.tick();
    expect(match.fields.length, "a Água-viva Elétrica II deveria ter criado um campo").toBe(1);
    const events = record(match);
    match.execute({ type: "sellGuardian", instanceId: "G1" });
    expect(match.fields).toHaveLength(0);
    expect(events.some((event) => event.type === "fieldExpired")).toBe(true);
  });

  it("starts the next wave only during the countdown and reports the time skipped", () => {
    const match = new Match(TINY);
    const result = match.execute({ type: "startNextWave" });
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.earlyStartMs).toBe(500);
    match.tick();
    expect(match.execute({ type: "startNextWave" })).toMatchObject({ ok: false, reason: "notInCountdown" });
    expect(match.stats.earlyWaveCalls).toBe(1);
  });
});

describe("Match lifecycle", () => {
  it("loses on the last life, then ignores ticks and commands", () => {
    const match = new Match(TINY);
    const events = record(match);
    run(match, 30_000);
    expect(match.status).toBe("defeat");
    expect(match.reef).toBe(0);
    expect(events.filter((event) => event.type === "defeat")).toHaveLength(1);
    const before = match.now;
    match.tick();
    expect(match.now).toBe(before);
    expect(match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 300, y: 200 })).toMatchObject({ ok: false, reason: "gameOver" });
    expect(match.stats.livesLost).toBe(1);
  });

  it("wins with a defended reef, pays the level bonus once and settles alive projectiles without further ticks", () => {
    const match = new Match({ ...TINY, reefHealth: 20 });
    const events = record(match);
    match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 300, y: 200 });
    run(match, 60_000);
    expect(match.status).toBe("victory");
    expect(events.filter((event) => event.type === "levelCompleted")).toHaveLength(1);
    expect(events.some((event) => event.type === "projectileFired")).toBe(true);
    expect(match.stats.kills.swimmer).toBe(1);
    expect(match.economySnapshot().earned.LevelReward).toBe(ECONOMY.levelClearBonus);
    const snapshot = match.snapshot();
    expect(snapshot.status).toBe("victory");
    expect(snapshot.aliveEnemies).toBe(0);
  });

  it("can start at a later wave (debug shortcut) and exposes it in the snapshot", () => {
    const match = new Match(RECIFE_ONE, { startWaveIndex: 4 });
    expect(match.snapshot().wave).toBe(5);
    expect(match.snapshot().totalWaves).toBe(RECIFE_ONE.waves.length);
  });

  it("emits enemyDamaged with a cause and attributes damage to the guardian", () => {
    const match = new Match({ ...TINY, reefHealth: 20 });
    const events = record(match);
    match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 300, y: 200 });
    run(match, 60_000);
    const damaged = events.filter((event): event is Extract<MatchEvent, { type: "enemyDamaged" }> => event.type === "enemyDamaged");
    expect(damaged.length).toBeGreaterThan(0);
    expect(damaged.every((event) => event.cause === "projectile" || event.cause === "splash")).toBe(true);
    expect(match.stats.damageByGuardian.G1).toBeGreaterThan(0);
    expect(match.stats.damageByGuardianType["pistol-shrimp"]).toBeGreaterThan(0);
  });
});
