import { describe, expect, it } from "vitest";
import { ChorusState, distinctSpeciesInRange } from "../src/game/core/Chorus";
import { updateChorus, updateSonar, type BehaviorEvent } from "../src/game/core/GuardianBehaviors";
import { SonarCore } from "../src/game/core/Sonar";
import { GUARDIANS } from "../src/game/data/guardians";
import { FakeEnemy, FakeGuardian } from "./helpers/fakes";

const chorus1 = GUARDIANS.dolphin.branches[0].upgrades[0].chorus!;
const sonar2 = GUARDIANS.dolphin.branches[1].upgrades[1].sonar!;

describe("chorus", () => {
  it("counts distinct species only and caps the efficiency", () => {
    const owner = { id: "D", x: 0, y: 0 };
    const allies = [
      { id: "1", guardianId: "pistol-shrimp" as const, x: 10, y: 0 },
      { id: "2", guardianId: "pistol-shrimp" as const, x: 20, y: 0 },
      { id: "3", guardianId: "reef-crab" as const, x: 30, y: 0 },
      { id: "4", guardianId: "jellyfish" as const, x: 500, y: 0 },
      { id: "D", guardianId: "dolphin" as const, x: 0, y: 0 },
    ];
    expect(distinctSpeciesInRange(owner, 100, allies)).toBe(2);
    const state = new ChorusState(chorus1);
    expect(state.efficiency(2)).toBeCloseTo(1.06);
    expect(state.efficiency(9)).toBeCloseTo(1 + chorus1.speciesBonus * chorus1.maxSpecies);
  });

  it("sings for the duration, rests for the cooldown and scales the buff by efficiency", () => {
    const state = new ChorusState(chorus1);
    expect(state.update(0, 0)).toBe(false);
    expect(state.update(0, 2)).toBe(true);
    expect(state.isActive(chorus1.durationMs - 1)).toBe(true);
    expect(state.isActive(chorus1.durationMs)).toBe(false);
    expect(state.update(chorus1.durationMs, 2)).toBe(false);
    expect(state.update(chorus1.cooldownMs, 2)).toBe(true);
    const source = state.asAuraSource({ id: "D", x: 0, y: 0 }, 150, 5, chorus1.cooldownMs + 10)!;
    expect(source.range).toBe(150 * chorus1.radiusMultiplier);
    expect(source.aura.attackSpeedMultiplier).toBeCloseTo(1 + 0.3 * 1.15);
    expect(source.aura.abilityCooldownMultiplier).toBeCloseTo(1 - 0.2 * 1.15);
    expect(state.asAuraSource({ id: "D", x: 0, y: 0 }, 150, 5, chorus1.cooldownMs + chorus1.durationMs)).toBeNull();
  });

  it("emits a start event and becomes an aura source only while active", () => {
    const dolphin = new FakeGuardian("D", "dolphin", 0, 0, "a", 2);
    const crab = new FakeGuardian("C", "reef-crab", 40, 0);
    const events: BehaviorEvent[] = [];
    const source = updateChorus(dolphin, [dolphin, crab], 0, (event) => events.push(event));
    expect(events[0]).toMatchObject({ type: "chorusStart", guardianId: "D" });
    expect(source?.thematic?.["reef-crab"]).toEqual({ damageMultiplier: 1.15 });
    expect(updateChorus(dolphin, [dolphin, crab], 6500)).toBeNull();
  });
});

describe("sonar", () => {
  it("schedules a single wave without echo and three waves with Eco Perfeito", () => {
    const single = new SonarCore(GUARDIANS.dolphin.sonar!);
    expect(single.update(0, 0)).toEqual([]);
    const waves = single.update(0, 1);
    expect(waves).toHaveLength(1);
    expect(waves[0]).toMatchObject({ reveal: true, vulnerability: true, priority: false, coordinate: false });
    expect(single.update(10, 1)).toEqual([]);

    const echo = new SonarCore(sonar2);
    const first = echo.update(0, 2);
    expect(first.map((wave) => wave.index)).toEqual([0]);
    expect(first[0]).toMatchObject({ reveal: true, vulnerability: false, coordinate: false });
    expect(echo.update(sonar2.echo!.intervalMs - 1, 2)).toEqual([]);
    const second = echo.update(sonar2.echo!.intervalMs, 2);
    expect(second[0]).toMatchObject({ index: 1, vulnerability: true, priority: true });
    const third = echo.update(sonar2.echo!.intervalMs * 2, 2);
    expect(third[0]).toMatchObject({ index: 2, coordinate: true });
  });

  it("reveals, applies vulnerability, flags the priority threat and coordinates allies within their own range", () => {
    const dolphin = new FakeGuardian("D", "dolphin", 0, 0, "b", 2);
    const shrimp = new FakeGuardian("S", "pistol-shrimp", 100, 0);
    const farAlly = new FakeGuardian("F", "pistol-shrimp", 900, 0);
    const swimmer = new FakeEnemy("A", "swimmer", 50);
    const elite = new FakeEnemy("E", "moray", 120);
    const events: BehaviorEvent[] = [];
    const hooks = { now: 0, damage: () => undefined, emit: (event: BehaviorEvent) => events.push(event) };
    updateSonar(dolphin, [swimmer, elite], [dolphin, shrimp, farAlly], hooks);
    expect(swimmer.status.isRevealed(10)).toBe(true);
    expect(swimmer.status.damageMultiplier(10)).toBe(1);
    const interval = sonar2.echo!.intervalMs;
    updateSonar(dolphin, [swimmer, elite], [dolphin, shrimp, farAlly], { ...hooks, now: interval });
    expect(swimmer.status.damageMultiplier(interval + 1)).toBeCloseTo(1.25);
    expect(elite.status.isPriority(interval + 1)).toBe(true);
    expect(swimmer.status.isPriority(interval + 1)).toBe(false);
    updateSonar(dolphin, [swimmer, elite], [dolphin, shrimp, farAlly], { ...hooks, now: interval * 2 });
    const coordinate = events.find((event) => event.type === "coordinate");
    expect(coordinate).toMatchObject({ type: "coordinate", targetId: "E", guardianIds: ["D", "S"] });
    expect(shrimp.runtime.preferredTargetId(interval * 2 + 1)).toBe("E");
    expect(farAlly.runtime.preferredTargetId(interval * 2 + 1)).toBeNull();
    expect(shrimp.runtime.preferredTargetId(interval * 2 + sonar2.echo!.coordinateMs + 1)).toBeNull();
  });
});
