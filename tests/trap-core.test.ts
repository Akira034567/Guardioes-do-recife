import { describe, expect, it } from "vitest";
import { TRAP_TRIGGER_MS, TrapCore, trapChargeMultipliers } from "../src/game/core/TrapCore";
import { GUARDIANS } from "../src/game/data/guardians";
import type { TrapEffect } from "../src/game/types";

const base: TrapEffect = GUARDIANS.stonefish.trap!;
const ambush2: TrapEffect = GUARDIANS.stonefish.branches[1].upgrades[1].trap!;

describe("trap core", () => {
  it("arms after armMs, fires on the first enemy and rearms after the cooldown", () => {
    const trap = new TrapCore(base, 0);
    expect(trap.phase).toBe("arming");
    expect(trap.update(base.armMs - 1, 1)).toEqual([]);
    expect(trap.update(base.armMs, 0)).toEqual([{ type: "phase", phase: "armed" }]);
    expect(trap.update(base.armMs + 10, 0)).toEqual([]);
    const events = trap.update(base.armMs + 20, 2);
    expect(events[0]).toEqual({ type: "trigger", chargeBonus: 0 });
    expect(events[1]).toEqual({ type: "phase", phase: "triggered" });
    const cooldownAt = base.armMs + 20 + TRAP_TRIGGER_MS;
    expect(trap.update(cooldownAt, 3)).toEqual([{ type: "phase", phase: "cooldown" }]);
    expect(trap.update(cooldownAt + base.cooldownMs - 1, 3)).toEqual([]);
    expect(trap.update(cooldownAt + base.cooldownMs, 3)).toEqual([{ type: "phase", phase: "arming" }]);
  });

  it("grows the charge +6% every 2 s while armed, capped at +36%", () => {
    const trap = new TrapCore(base, 0);
    trap.update(base.armMs, 0);
    expect(trap.chargeBonus(base.armMs + 1999)).toBe(0);
    expect(trap.chargeBonus(base.armMs + 2000)).toBeCloseTo(0.06);
    expect(trap.chargeBonus(base.armMs + 60_000)).toBeCloseTo(0.36);
    const [trigger] = trap.update(base.armMs + 6000, 1);
    expect(trigger).toEqual({ type: "trigger", chargeBonus: expect.closeTo(0.18, 6) });
    expect(trapChargeMultipliers(base, 0.15)).toEqual({ damage: expect.closeTo(1.15, 6), control: 1 });
    expect(trapChargeMultipliers(ambush2, 0.15)).toEqual({ damage: 1, control: expect.closeTo(1.15, 6) });
  });

  it("opens a short window on first contact: detonates early on a crowd, alone when nobody follows", () => {
    // V3: a espera longa (2 inimigos OU 2s) virou uma janela curta. O primeiro contato abre 500ms;
    // se chegar o segundo dentro dela, detona na hora; se não chegar, detona no primeiro mesmo.
    expect(ambush2.waitFor).toEqual({ windowMs: 500, detonateAt: 2 });
    const { windowMs, detonateAt } = ambush2.waitFor!;

    // Chegou companhia dentro da janela: dispara sem esperar o resto dela.
    const crowd = new TrapCore(ambush2, 0);
    crowd.update(ambush2.armMs, 0);
    const start = ambush2.armMs + 100;
    expect(crowd.update(start, 1)).toEqual([]);
    expect(crowd.update(start + 200, detonateAt)[0]).toMatchObject({ type: "trigger" });

    // Ninguém veio: segura até o fim da janela e detona no primeiro.
    const alone = new TrapCore(ambush2, 0);
    alone.update(ambush2.armMs, 0);
    expect(alone.update(start, 1)).toEqual([]);
    expect(alone.update(start + windowMs - 1, 1)).toEqual([]);
    expect(alone.update(start + windowMs, 1)[0]).toMatchObject({ type: "trigger" });

    // O alvo escapou antes de a janela fechar: a espera reinicia no próximo que pisar.
    const reset = new TrapCore(ambush2, 0);
    reset.update(ambush2.armMs, 0);
    reset.update(start, 1);
    reset.update(start + 200, 0);
    expect(reset.update(start + windowMs + 100, 1)).toEqual([]);
  });

  it("applies the rearm multiplier to the cooldown and keeps the phase across upgrades", () => {
    const trap = new TrapCore(base, 0);
    trap.update(base.armMs, 0);
    trap.update(base.armMs + 10, 1);
    trap.setConfig(ambush2);
    const cooldownAt = base.armMs + 10 + TRAP_TRIGGER_MS;
    trap.update(cooldownAt, 0, 0.5);
    expect(trap.phase).toBe("cooldown");
    expect(trap.phaseEndsAt).toBeCloseTo(cooldownAt + ambush2.cooldownMs * 0.5);
  });
});
