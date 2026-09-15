import { describe, expect, it } from "vitest";
import { CurrentSystem, MAX_DIRECTIONAL_STRENGTH, zoneFromFlowField, type CurrentZone } from "../src/game/core/CurrentSystem";
import { MIN_FLOW_MULTIPLIER } from "../src/game/core/FlowField";
import { RECIFE_ONE } from "../src/game/data/levels";

const inside = { x: 600, y: 300 };
const alongFlow = { x: 1, y: 0.16 };
const againstFlow = { x: -1, y: -0.16 };

describe("CurrentSystem", () => {
  it("reproduces the map current speed modifiers and amplifies them per source", () => {
    const currents = CurrentSystem.fromLevel(RECIFE_ONE.currents);
    expect(currents.enemySpeedMultiplier(inside, alongFlow)).toBeCloseTo(1.25);
    expect(currents.enemySpeedMultiplier(inside, againstFlow)).toBeCloseTo(0.75);
    expect(currents.enemySpeedMultiplier({ x: 100, y: 100 }, alongFlow)).toBe(1);
    // V3: a Baleia ENGROSSA a corrente em vez de inverter — a favor empurra mais, contra segura mais.
    currents.setAmplified("boss", { strength: 2, drift: 2 });
    expect(currents.amplified).toBe(true);
    expect(currents.enemySpeedMultiplier(inside, alongFlow)).toBeCloseTo(1.5);
    expect(currents.enemySpeedMultiplier(inside, againstFlow)).toBeCloseTo(0.5);
    // Duas fontes: vale a MAIOR, nunca o produto, e a maré só acalma quando as duas soltam.
    currents.setAmplified("event", { strength: 1.5, drift: 1.5 });
    currents.setAmplified("boss", null);
    expect(currents.amplified, "duas fontes: continua grossa até as duas soltarem").toBe(true);
    expect(currents.enemySpeedMultiplier(inside, alongFlow)).toBeCloseTo(1.375);
    currents.setAmplified("event", null);
    expect(currents.enemySpeedMultiplier(inside, alongFlow)).toBeCloseTo(1.25);
  });

  it("never lets amplification stop or reverse an enemy swimming against the flow", () => {
    const currents = CurrentSystem.fromLevel(RECIFE_ONE.currents);
    // strength 0.25 × 10 passaria de 1 e faria o inimigo andar de ré: o teto é justamente para isso.
    currents.setAmplified("boss", { strength: 10, drift: 1 });
    expect(currents.enemySpeedMultiplier(inside, againstFlow)).toBeGreaterThan(0);
    expect(currents.enemySpeedMultiplier(inside, againstFlow)).toBeCloseTo(1 - MAX_DIRECTIONAL_STRENGTH);
  });

  it("amplifies only map currents, never a guardian zone", () => {
    const currents = CurrentSystem.fromLevel(RECIFE_ONE.currents);
    currents.setOwnerZones("G1", [zoneFromFlowField({ ownerId: "G1", x: 600, y: 300, radius: 120, speedFactor: 0.75, mode: "counter" })]);
    const calm = currents.enemySpeedMultiplier(inside, alongFlow);
    currents.setAmplified("boss", { strength: 2, drift: 2 });
    const surge = currents.enemySpeedMultiplier(inside, alongFlow);
    // A zona da Tartaruga (0.75) continua valendo igual; só a parte direcional do mapa engrossou.
    expect(calm).toBeCloseTo(1.25 * 0.75);
    expect(surge).toBeCloseTo(1.5 * 0.75);
  });

  it("multiplies map currents by the strongest guardian zone and respects slow resistance", () => {
    const currents = CurrentSystem.fromLevel(RECIFE_ONE.currents);
    currents.setOwnerZones("G1", [zoneFromFlowField({ ownerId: "G1", x: 600, y: 300, radius: 120, speedFactor: 0.75, mode: "counter" })]);
    currents.setOwnerZones("G2", [zoneFromFlowField({ ownerId: "G2", x: 600, y: 300, radius: 120, speedFactor: 0.9, mode: "counter" })]);
    expect(currents.enemySpeedMultiplier(inside, alongFlow)).toBeCloseTo(1.25 * 0.75);
    expect(currents.enemySpeedMultiplier(inside, alongFlow, 0.5)).toBeCloseTo(1.25 * 0.875);
    currents.setOwnerZones("G1", []);
    expect(currents.enemySpeedMultiplier(inside, alongFlow)).toBeCloseTo(1.25 * 0.9);
    expect(currents.flowFields.map((field) => field.ownerId)).toEqual(["G2"]);
  });

  it("clamps stacked slow zones to the flow floor", () => {
    const currents = new CurrentSystem();
    currents.setOwnerZones("G1", [zoneFromFlowField({ ownerId: "G1", x: 0, y: 0, radius: 50, speedFactor: 0.2, mode: "counter" })]);
    expect(currents.enemySpeedMultiplier({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(MIN_FLOW_MULTIPLIER);
  });

  it("expires temporary currents and only drifts projectiles in directional zones", () => {
    const currents = new CurrentSystem();
    const temporary: CurrentZone = {
      id: "gêiser",
      ownerId: null,
      origin: "interactable",
      shape: { kind: "circle", x: 0, y: 0, radius: 40 },
      direction: { x: 0, y: -1 },
      strength: 0.5,
      projectileDrift: 100,
      affects: ["enemy", "projectile"],
      amplifiable: false,
      expiresAt: 1000,
      respectsSlowResistance: false,
    };
    currents.addTemporary(temporary);
    expect(currents.enemySpeedMultiplier({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(1.5);
    expect(currents.projectileDrift({ x: 0, y: 0 }, 0.5)).toEqual({ x: 0, y: -50 });
    currents.setAmplified("boss", { strength: 2, drift: 2 });
    expect(currents.projectileDrift({ x: 0, y: 0 }, 0.5), "zona não amplificável ignora a maré grossa").toEqual({ x: 0, y: -50 });
    currents.update(1000);
    expect(currents.zones()).toHaveLength(0);
    expect(currents.projectileDrift({ x: 0, y: 0 }, 0.5)).toEqual({ x: 0, y: 0 });
    currents.setOwnerZones("G1", [zoneFromFlowField({ ownerId: "G1", x: 0, y: 0, radius: 50, speedFactor: 0.75, mode: "counter" })]);
    expect(currents.projectileDrift({ x: 0, y: 0 }, 0.5), "zona isotrópica não desloca projéteis").toEqual({ x: 0, y: 0 });
  });
});
