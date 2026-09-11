import { describe, expect, it } from "vitest";
import {
  applyUpgrade,
  canApplyUpgrade,
  investedValue,
  resolveLast,
  sellValue,
  upgradeOptions,
} from "../src/game/core/UpgradeTree";
import { ECONOMY } from "../src/game/data/balance";
import { GUARDIANS } from "../src/game/data/guardians";

const shrimp = GUARDIANS["pistol-shrimp"];

describe("upgrade tree", () => {
  it("offers one option per branch before a branch is chosen", () => {
    const options = upgradeOptions(shrimp, { branchId: null, upgradeLevel: 0 });
    expect(options.map((option) => option.branchId)).toEqual(["a", "b"]);
    expect(options.map((option) => option.level)).toEqual([1, 1]);
    expect(options.map((option) => option.cost)).toEqual([70, 70]);
  });

  it("locks the unit into the chosen branch and exposes only its next step", () => {
    const afterFirst = applyUpgrade(shrimp, { branchId: null, upgradeLevel: 0 }, "a");
    expect(afterFirst).toEqual({ branchId: "a", upgradeLevel: 1 });
    const options = upgradeOptions(shrimp, afterFirst!);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ branchId: "a", level: 2, cost: 130, name: "Ricochete Reto" });
    expect(canApplyUpgrade(shrimp, afterFirst!, "b")).toBe(false);
    expect(applyUpgrade(shrimp, afterFirst!, "b")).toBeNull();
  });

  it("stops at two upgrades per unit", () => {
    const maxed = applyUpgrade(shrimp, { branchId: "b", upgradeLevel: 1 }, "b");
    expect(maxed).toEqual({ branchId: "b", upgradeLevel: 2 });
    expect(upgradeOptions(shrimp, maxed!)).toEqual([]);
    expect(applyUpgrade(shrimp, maxed!, "b")).toBeNull();
  });

  it("refunds a quarter of everything invested, rounding down", () => {
    expect(investedValue(shrimp, { branchId: null, upgradeLevel: 0 })).toBe(80);
    expect(investedValue(shrimp, { branchId: "a", upgradeLevel: 1 })).toBe(150);
    expect(investedValue(shrimp, { branchId: "a", upgradeLevel: 2 })).toBe(280);
    expect(sellValue(80, ECONOMY.sellRefundRate)).toBe(20);
    expect(sellValue(150, ECONOMY.sellRefundRate)).toBe(37);
    expect(sellValue(280, ECONOMY.sellRefundRate)).toBe(70);
    expect(sellValue(0, ECONOMY.sellRefundRate)).toBe(0);
  });

  it("resolves the latest value along the applied path", () => {
    const heavy = shrimp.branches[1].upgrades;
    expect(resolveLast(heavy.slice(0, 1), "damage")).toBe(34);
    expect(resolveLast(heavy, "damage")).toBe(50);
    expect(resolveLast(heavy, "splash")).toEqual({ radius: 42, damageMultiplier: 0.45 });
    expect(resolveLast(heavy, "pierceDamages")).toBeUndefined();
    const pierce = shrimp.branches[0].upgrades;
    expect(resolveLast(pierce.slice(0, 1), "pierceDamages")).toEqual([20, 15]);
    expect(resolveLast(pierce, "pierceDamages")).toEqual([24, 19, 15]);
    expect(resolveLast(pierce, "straightRicochet")).toBe(true);
  });
});
