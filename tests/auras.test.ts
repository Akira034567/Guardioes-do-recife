import { describe, expect, it } from "vitest";
import { combineAura, NEUTRAL_AURA, resolveAura, sameAura, scaleAura, type AuraSource } from "../src/game/core/Auras";

const source = (id: string, x: number, attackSpeedMultiplier: number, rangeMultiplier = 1): AuraSource => ({
  id,
  x,
  y: 0,
  range: 150,
  aura: { attackSpeedMultiplier, rangeMultiplier },
});

describe("auras", () => {
  it("takes the best value per attribute instead of stacking", () => {
    const aura = resolveAura({ id: "G1", x: 0, y: 0 }, [source("O1", 50, 1.1), source("O2", -60, 1.15, 1.12), source("O3", 20, 1.1, 1.2)]);
    expect(aura).toEqual({ ...NEUTRAL_AURA, attackSpeedMultiplier: 1.15, rangeMultiplier: 1.2 });
  });

  it("ignores sources out of range and the unit itself", () => {
    expect(resolveAura({ id: "G1", x: 0, y: 0 }, [source("O1", 400, 1.15)])).toEqual(NEUTRAL_AURA);
    expect(resolveAura({ id: "O1", x: 0, y: 0 }, [source("O1", 0, 1.15)])).toEqual(NEUTRAL_AURA);
    expect(sameAura(NEUTRAL_AURA, { attackSpeedMultiplier: 1, rangeMultiplier: 1 })).toBe(true);
    expect(sameAura(NEUTRAL_AURA, { attackSpeedMultiplier: 1.1, rangeMultiplier: 1 })).toBe(false);
    expect(sameAura(NEUTRAL_AURA, { abilityCooldownMultiplier: 0.9 })).toBe(false);
  });

  it("treats cooldown multipliers as better when lower and merges thematic bonuses per species", () => {
    const chorus: AuraSource = {
      id: "D1",
      x: 0,
      y: 0,
      range: 200,
      aura: { attackSpeedMultiplier: 1.1, abilityCooldownMultiplier: 0.9 },
      thematic: { "reef-crab": { damageMultiplier: 1.1 }, stonefish: { rearmMultiplier: 0.8 } },
    };
    const weaker: AuraSource = { id: "D2", x: 10, y: 0, range: 200, aura: { abilityCooldownMultiplier: 0.95 } };
    const crab = resolveAura({ id: "G1", guardianId: "reef-crab", x: 0, y: 0 }, [chorus, weaker]);
    expect(crab.abilityCooldownMultiplier).toBeCloseTo(0.9);
    expect(crab.damageMultiplier).toBeCloseTo(1.1);
    expect(crab.rearmMultiplier).toBe(1);
    const trap = resolveAura({ id: "G2", guardianId: "stonefish", x: 0, y: 0 }, [chorus]);
    expect(trap.rearmMultiplier).toBeCloseTo(0.8);
    expect(trap.damageMultiplier).toBe(1);
  });

  it("scales only the part above (or below) one and combines multiplicatively", () => {
    expect(scaleAura({ attackSpeedMultiplier: 1.1, abilityCooldownMultiplier: 0.9 }, 1.1)).toEqual({
      attackSpeedMultiplier: expect.closeTo(1.11, 6),
      abilityCooldownMultiplier: expect.closeTo(0.89, 6),
    });
    expect(combineAura({ rangeMultiplier: 1.1 }, { rangeMultiplier: 1.1, damageMultiplier: 1.2 })).toEqual({
      rangeMultiplier: expect.closeTo(1.21, 6),
      damageMultiplier: 1.2,
    });
  });
});
