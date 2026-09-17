import { describe, expect, it } from "vitest";
import { RECIFE_ONE_BACKGROUND_KEY } from "../src/game/assets/recifeOneAssets";
import { containsPoint } from "../src/game/core/CurrentField";
import { RoutePath } from "../src/game/core/RoutePath";
import { GUARDIAN_BALANCE, PLACEMENT } from "../src/game/data/balance";
import { ENEMIES } from "../src/game/data/enemies";
import { DEFAULT_LOADOUT, GUARDIANS, GUARDIAN_ORDER, LOADOUT_SIZE, resolveLoadout } from "../src/game/data/guardians";
import { RECIFE_ONE } from "../src/game/data/levels";
import type { GuardianId } from "../src/game/types";

describe("Recife 1 content contracts", () => {
  it("keeps seven waves and four platforms", () => {
    // V3: a fase 1 saiu de 5 para 7 ondas (a curva da campanha é 7/10/12/15/16/18).
    expect(RECIFE_ONE.waves).toHaveLength(7);
    expect(RECIFE_ONE.placements).toHaveLength(4);
    expect("routePlacements" in RECIFE_ONE).toBe(false);
  });

  it("registers nine guardians and a default squad of five", () => {
    expect(GUARDIAN_ORDER).toHaveLength(9);
    expect(new Set(GUARDIAN_ORDER).size).toBe(9);
    expect(DEFAULT_LOADOUT).toHaveLength(LOADOUT_SIZE);
    expect(DEFAULT_LOADOUT).toEqual(["pistol-shrimp", "jellyfish", "pufferfish", "reef-crab", "ink-octopus"]);
    expect(resolveLoadout(null)).toEqual(DEFAULT_LOADOUT);
    expect(resolveLoadout("shark, dolphin,shark,nao-existe")).toEqual(["shark", "dolphin", "pistol-shrimp", "jellyfish", "pufferfish"]);
    expect(resolveLoadout("shark,sea-turtle,stonefish,dolphin,reef-crab,pistol-shrimp")).toEqual([
      "shark",
      "sea-turtle",
      "stonefish",
      "dolphin",
      "reef-crab",
    ]);
  });

  it("assigns distinct placement rules to every guardian", () => {
    expect(GUARDIANS["pistol-shrimp"].placementMode).toBe("platform");
    expect(GUARDIANS.jellyfish.placementMode).toBe("water");
    expect(GUARDIANS.pufferfish.placementMode).toBe("route");
    expect(GUARDIANS.pufferfish.blocks).toBe(true);
    expect(GUARDIANS["reef-crab"].placementMode).toBe("route");
    expect(GUARDIANS["reef-crab"].blocks).toBe(false);
    expect(GUARDIANS["ink-octopus"].placementMode).toBe("platform");
    expect(GUARDIANS.shark.placementMode).toBe("margin");
    expect(GUARDIANS.shark.dash).toBe(true);
    expect(GUARDIANS["sea-turtle"].placementMode).toBe("route");
    // V3.1: ela bloqueia desde a base e os DOIS ramos seguram — o que separa os ramos é a água.
    expect(GUARDIANS["sea-turtle"].blocks).toBe(true);
    expect(GUARDIANS["sea-turtle"].branches.every((branch) => branch.upgrades.every((upgrade) => upgrade.blocks))).toBe(true);
    expect(GUARDIANS.stonefish.placementMode).toBe("route");
    expect(GUARDIANS.stonefish.attackKind).toBe("trap");
    expect(GUARDIANS.stonefish.damage).toBe(0);
    expect(GUARDIANS.dolphin.placementMode).toBe("water");
    expect(GUARDIANS.dolphin.attackKind).toBe("sonar");
  });

  it("lets the shark reach the route from anywhere in the margin band", () => {
    const largestEnemy = Math.max(...Object.values(ENEMIES).map((enemy) => enemy.hitRadius));
    expect(GUARDIANS.shark.range).toBeGreaterThanOrEqual(PLACEMENT.marginMax + largestEnemy);
    expect(PLACEMENT.marginMin).toBeLessThan(PLACEMENT.routeClearance);
    expect(PLACEMENT.marginMax).toBeGreaterThan(PLACEMENT.waterRouteClearance);
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
    expect(field).toMatchObject({ durationMs: 3200, cooldownMs: 5200, maxDamagePerTarget: 56, damage: 8 });
    const hold = GUARDIANS.pufferfish.branches[0].upgrades[1].bossHold;
    expect(hold).toBeDefined();
    expect(hold!.durationMs).toBeLessThanOrEqual(2000);
    expect(hold!.immunityMs).toBeGreaterThan(hold!.durationMs * 4);
  });

  it("wires the new guardians' abilities to their branches", () => {
    const shark = GUARDIANS.shark;
    expect(shark.branches[0].upgrades.map((upgrade) => upgrade.frenzy?.attackSpeedBonus)).toEqual([0.4, 0.4]);
    expect(shark.branches[0].upgrades[1].frenzy).toMatchObject({ perWoundedBonus: 0.12, maxBonus: 0.65 });
    expect(shark.branches[1].upgrades[0].mark).toMatchObject({ damageMultiplier: 1.35, durationMs: 6000, cooldownMs: 7000 });
    expect(shark.branches[1].upgrades[1].mark?.stacking).toEqual({ perHit: 0.1, max: 0.5 });

    const turtle = GUARDIANS["sea-turtle"];
    expect(turtle.branches[0].upgrades.map((upgrade) => upgrade.blockCapacity)).toEqual([4, 6]);
    expect(turtle.branches[0].upgrades.map((upgrade) => upgrade.blockHold?.durationMs)).toEqual([4000, 5000]);
    expect(turtle.branches[0].upgrades[1].pushWave).toBeDefined();
    expect(turtle.branches[1].upgrades[0].flowField?.speedFactor).toBe(0.62);
    expect(turtle.branches[1].upgrades[1].pushWave?.cooldownMs).toBe(9000);

    const stonefish = GUARDIANS.stonefish;
    expect(stonefish.trap?.armMs).toBe(2600);
    expect(stonefish.branches[0].upgrades[0].trap?.poison).toMatchObject({ durationMs: 5000, tickMs: 1000 });
    expect(stonefish.branches[0].upgrades[1].trap?.cloud).toBeDefined();
    expect(stonefish.branches[1].upgrades[0].trap?.stun?.durationMs).toBe(1100);
    expect(stonefish.branches[1].upgrades[1].trap).toMatchObject({ stun: { durationMs: 1600 }, exitTrigger: { exitMargin: 12, maxHoldMs: 2000 } });
    expect(stonefish.branches[1].upgrades.every((upgrade) => upgrade.trap?.charge.applyTo === "control")).toBe(true);
    expect(stonefish.branches[0].upgrades.every((upgrade) => upgrade.trap?.charge.applyTo === "damage")).toBe(true);

    const dolphin = GUARDIANS.dolphin;
    expect(dolphin.sonar?.vulnerability).toEqual({ multiplier: 1.1, durationMs: 4500 });
    expect(dolphin.branches[0].upgrades[0].chorus).toMatchObject({ durationMs: 6000, cooldownMs: 11000, speciesBonus: 0.03, maxSpecies: 5 });
    expect(Object.keys(dolphin.branches[0].upgrades[1].chorus?.thematic ?? {})).toHaveLength(7);
    expect(dolphin.branches[1].upgrades[0].sonar?.vulnerability.multiplier).toBe(1.22);
    expect(dolphin.branches[1].upgrades[1].sonar?.echo?.waves).toBe(3);
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
