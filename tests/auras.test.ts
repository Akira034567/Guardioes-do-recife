import { describe, expect, it } from "vitest";
import { NEUTRAL_AURA, resolveAura, sameAura, type AuraSource } from "../src/game/core/Auras";

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
    expect(aura).toEqual({ attackSpeedMultiplier: 1.15, rangeMultiplier: 1.2 });
  });

  it("ignores sources out of range and the unit itself", () => {
    expect(resolveAura({ id: "G1", x: 0, y: 0 }, [source("O1", 400, 1.15)])).toEqual(NEUTRAL_AURA);
    expect(resolveAura({ id: "O1", x: 0, y: 0 }, [source("O1", 0, 1.15)])).toEqual(NEUTRAL_AURA);
    expect(sameAura(NEUTRAL_AURA, { attackSpeedMultiplier: 1, rangeMultiplier: 1 })).toBe(true);
    expect(sameAura(NEUTRAL_AURA, { attackSpeedMultiplier: 1.1, rangeMultiplier: 1 })).toBe(false);
  });
});
