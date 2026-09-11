import { describe, expect, it } from "vitest";
import { RECIFE_ONE_BACKGROUND_KEY } from "../src/game/assets/recifeOneAssets";
import { containsPoint } from "../src/game/core/CurrentField";
import { RoutePath } from "../src/game/core/RoutePath";
import { GUARDIAN_BALANCE } from "../src/game/data/balance";
import { GUARDIANS, GUARDIAN_ORDER } from "../src/game/data/guardians";
import { RECIFE_ONE } from "../src/game/data/levels";
import type { GuardianId } from "../src/game/types";

describe("Recife 1 content contracts", () => {
  it("keeps five waves and four platforms", () => {
    expect(RECIFE_ONE.waves).toHaveLength(5);
    expect(RECIFE_ONE.placements).toHaveLength(4);
    expect("routePlacements" in RECIFE_ONE).toBe(false);
  });

  it("assigns distinct placement rules to the five guardians", () => {
    expect(GUARDIAN_ORDER).toHaveLength(5);
    expect(new Set(GUARDIAN_ORDER).size).toBe(5);
    expect(GUARDIANS["pistol-shrimp"].placementMode).toBe("platform");
    expect(GUARDIANS.jellyfish.placementMode).toBe("water");
    expect(GUARDIANS.pufferfish.placementMode).toBe("route");
    expect(GUARDIANS.pufferfish.blocks).toBe(true);
    expect(GUARDIANS["reef-crab"].placementMode).toBe("route");
    expect(GUARDIANS["reef-crab"].blocks).toBe(false);
    expect(GUARDIANS["ink-octopus"].placementMode).toBe("platform");
  });

  it("gives every guardian two branches of two upgrades with shared costs per level", () => {
    (Object.keys(GUARDIANS) as GuardianId[]).forEach((id) => {
      const definition = GUARDIANS[id];
      expect(definition.branches).toHaveLength(2);
      expect(definition.branches.map((branch) => branch.id)).toEqual(["a", "b"]);
      definition.branches.forEach((branch) => {
        expect(branch.upgrades).toHaveLength(2);
        expect(branch.upgrades.map((upgrade) => upgrade.cost)).toEqual([...GUARDIAN_BALANCE[id].upgradeCosts]);
        branch.upgrades.forEach((upgrade) => {
          expect(upgrade.name.length).toBeGreaterThan(0);
          expect(upgrade.description.length).toBeGreaterThan(0);
        });
      });
      expect(definition.cost).toBe(GUARDIAN_BALANCE[id].cost);
    });
  });

  it("places the upper-left shrimp platform within attack range but outside the route", () => {
    const route = new RoutePath(RECIFE_ONE.waypoints);
    const platform = RECIFE_ONE.placements.find((candidate) => candidate.id === "anemona-norte");
    expect(platform).toBeDefined();
    const distance = route.getClosestPoint(platform!).distance;
    expect(distance).toBeLessThan(GUARDIANS["pistol-shrimp"].range);
    expect(distance).toBeGreaterThan(82);
  });

  it("uses the agreed jellyfish field cap and pufferfish boss hold", () => {
    const field = GUARDIANS.jellyfish.branches[0].upgrades[1].electricField;
    expect(field).toMatchObject({ durationMs: 2500, cooldownMs: 5000, maxDamagePerTarget: 30, damage: 6 });
    const hold = GUARDIANS.pufferfish.branches[0].upgrades[1].bossHold;
    expect(hold).toBeDefined();
    expect(hold!.durationMs).toBeLessThanOrEqual(1500);
    expect(hold!.immunityMs).toBeGreaterThan(hold!.durationMs * 4);
  });

  it("paints Recife 1 with the registered background", () => {
    expect(RECIFE_ONE.backgroundKey).toBe(RECIFE_ONE_BACKGROUND_KEY);
  });

  it("aligns platforms and the active current to the painted landmarks", () => {
    expect(RECIFE_ONE.placements).toEqual([
      { id: "anemona-norte", x: 375, y: 245 },
      { id: "estrela-sul", x: 500, y: 500 },
      { id: "concha-norte", x: 750, y: 135 },
      { id: "coral-cerebro-sul", x: 925, y: 500 },
    ]);
    const current = RECIFE_ONE.currents[0];
    RECIFE_ONE.waypoints
      .filter((point) => point.x >= current.x && point.x <= current.x + current.width)
      .forEach((point) => expect(containsPoint(current, point)).toBe(true));
  });
});
