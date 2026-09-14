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

  it("waits for two enemies or the maximum wait before Fúria Abissal fires", () => {
    const trap = new TrapCore(ambush2, 0);
    trap.update(ambush2.armMs, 0);
    const start = ambush2.armMs + 100;
    // V2: a Fúria virou punição de alvo único — espera 2, não 3, e o dano é que subiu.
    expect(ambush2.waitFor?.count).toBe(2);
    expect(trap.update(start, 1)).toEqual([]);
    expect(trap.update(start + 1000, 2)[0]).toMatchObject({ type: "trigger" });
    const patient = new TrapCore(ambush2, 0);
    patient.update(ambush2.armMs, 0);
    expect(patient.update(start, 1)).toEqual([]);
    expect(patient.update(start + ambush2.waitFor!.maxWaitMs - 1, 1)).toEqual([]);
    expect(patient.update(start + ambush2.waitFor!.maxWaitMs, 1)[0]).toMatchObject({ type: "trigger" });
    const reset = new TrapCore(ambush2, 0);
    reset.update(ambush2.armMs, 0);
    reset.update(start, 1);
    reset.update(start + 500, 0);
    expect(reset.update(start + ambush2.waitFor!.maxWaitMs + 100, 1)).toEqual([]);
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
