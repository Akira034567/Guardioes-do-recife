import { describe, expect, it } from "vitest";
import { AbilityCooldown } from "../src/game/core/AbilityCooldown";

describe("AbilityCooldown", () => {
  it("prevents repeated fields until five seconds have elapsed", () => {
    const cooldown = new AbilityCooldown();
    expect(cooldown.tryActivate(1000, 5000)).toBe(true);
    expect(cooldown.nextReadyAt).toBe(6000);
    expect(cooldown.tryActivate(5999, 5000)).toBe(false);
    expect(cooldown.tryActivate(6000, 5000)).toBe(true);
  });
});
