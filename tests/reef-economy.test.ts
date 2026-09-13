import { describe, expect, it } from "vitest";
import { buyDecoration, canAfford, grantDecoration, placeDecoration, removeDecoration, spendShells } from "../src/game/core/reef/economy";
import { createDefaultProgress, type PlayerProgress } from "../src/game/core/save/PlayerProgress";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";
import { LEVEL_IDS } from "../src/game/data/levels";

const registry = {
  levelIds: LEVEL_IDS,
  guardianIds: GUARDIAN_ORDER,
  enemyIds: [],
  defaultUnlockedGuardians: ["pistol-shrimp", "jellyfish"],
};

function progressWith(shells: number): PlayerProgress {
  const progress = createDefaultProgress(registry, new Date("2026-09-13T00:00:00Z"));
  progress.currency.shells = shells;
  progress.currency.lifetimeShells = shells;
  return progress;
}

/** `concha-leque` custa 40 Conchas e pede o Recife 2 concluído. */
function unlockShellFan(progress: PlayerProgress): PlayerProgress {
  progress.completedLevels = ["recife-1", "recife-2"];
  return progress;
}

describe("reef economy", () => {
  it("refuses anything that is not a real amount", () => {
    const progress = progressWith(100);
    for (const amount of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(spendShells(progress, amount)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(progress.currency.shells).toBe(100);
  });

  it("refuses to spend what the player does not have", () => {
    const progress = progressWith(30);
    expect(spendShells(progress, 31)).toEqual({ ok: false, reason: "insufficient" });
    expect(progress.currency.shells).toBe(30);
    expect(canAfford(progress, 31)).toBe(false);
    expect(canAfford(progress, 30)).toBe(true);
  });

  it("spends the balance without ever touching the lifetime total", () => {
    const progress = progressWith(100);
    expect(spendShells(progress, 40)).toEqual({ ok: true, shells: 60 });
    expect(progress.currency.shells).toBe(60);
    // `lifetimeShells` é histórico do que o jogador ganhou, não saldo: gastar não pode reduzi-lo.
    expect(progress.currency.lifetimeShells).toBe(100);
  });

  it("covers every reason a purchase can fail", () => {
    expect(buyDecoration(progressWith(999), "peca-que-nao-existe")).toEqual({ ok: false, reason: "unknown" });
    // Recompensa narrativa nunca é vendida.
    expect(buyDecoration(progressWith(999), "estatua-guardia")).toEqual({ ok: false, reason: "notForSale" });
    // Ainda sem cumprir a condição.
    expect(buyDecoration(progressWith(999), "concha-leque")).toEqual({ ok: false, reason: "locked" });
    // Liberada, mas sem Conchas.
    expect(buyDecoration(unlockShellFan(progressWith(10)), "concha-leque")).toEqual({ ok: false, reason: "insufficient" });

    const owned = unlockShellFan(progressWith(999));
    expect(buyDecoration(owned, "concha-leque").ok).toBe(true);
    expect(buyDecoration(owned, "concha-leque")).toEqual({ ok: false, reason: "owned" });
  });

  it("debits exactly the price and registers the purchase", () => {
    const progress = unlockShellFan(progressWith(100));
    const result = buyDecoration(progress, "concha-leque", { slotId: "sand-a", x: 50, y: 84 });
    expect(result.ok).toBe(true);
    expect(progress.currency.shells).toBe(60);
    expect(progress.reef.owned).toContain("concha-leque");
    expect(progress.reef.placed).toHaveLength(1);
    expect(progress.reef.placed[0]).toMatchObject({ defId: "concha-leque", slotId: "sand-a" });
  });

  it("stops planting at maxCount, even for a piece the player owns", () => {
    const progress = progressWith(0);
    // `concha-nautilo` aceita duas cópias; a terceira não entra.
    expect(placeDecoration(progress, "concha-nautilo", { x: 10, y: 10 })).not.toBeNull();
    expect(placeDecoration(progress, "concha-nautilo", { x: 20, y: 20 })).not.toBeNull();
    expect(placeDecoration(progress, "concha-nautilo", { x: 30, y: 30 })).toBeNull();
    expect(progress.reef.placed).toHaveLength(2);
  });

  it("grants without charging and only once", () => {
    const progress = progressWith(50);
    expect(grantDecoration(progress, "coral-cerebro")).toBe(true);
    expect(grantDecoration(progress, "coral-cerebro")).toBe(false);
    expect(grantDecoration(progress, "peca-que-nao-existe")).toBe(false);
    expect(progress.currency.shells).toBe(50);
    expect(progress.reef.owned).toEqual(["coral-cerebro"]);
  });

  it("hands out a fresh instance id every time it plants", () => {
    const progress = progressWith(0);
    const first = placeDecoration(progress, "alga-fita", { x: 10, y: 50 });
    const second = placeDecoration(progress, "alga-fita", { x: 20, y: 50 });
    expect(first!.instanceId).not.toBe(second!.instanceId);
    expect(progress.reef.nextInstanceId).toBe(3);
    expect(placeDecoration(progress, "peca-que-nao-existe", { x: 0, y: 0 })).toBeNull();
  });

  it("removes only what is really there", () => {
    const progress = progressWith(0);
    const planted = placeDecoration(progress, "alga-fita", { x: 10, y: 50 })!;
    expect(removeDecoration(progress, "instancia-fantasma")).toBe(false);
    expect(progress.reef.placed).toHaveLength(1);
    expect(removeDecoration(progress, planted.instanceId)).toBe(true);
    expect(progress.reef.placed).toHaveLength(0);
    // A posse continua: o jogador pode replantar o que é dele.
    expect(progress.reef.owned).toContain("alga-fita");
  });
});
