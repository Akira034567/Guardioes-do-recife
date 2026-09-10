import { describe, expect, it } from "vitest";
import { Economy } from "../src/game/core/Economy";

describe("Economy", () => {
  it("never spends more pearls than available", () => {
    const economy = new Economy(60);
    expect(economy.spend(61)).toBe(false);
    expect(economy.pearls).toBe(60);
    expect(economy.spend(60)).toBe(true);
    expect(economy.pearls).toBe(0);
  });

  it("only earns positive whole pearls", () => {
    const economy = new Economy(0);
    economy.earn(8.9);
    economy.earn(-4);
    expect(economy.pearls).toBe(8);
  });
});
