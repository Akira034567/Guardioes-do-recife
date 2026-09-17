import { describe, expect, it } from "vitest";
import { TRAP_TRIGGER_MS, TrapCore, trapChargeMultipliers } from "../src/game/core/TrapCore";
import { GUARDIANS } from "../src/game/data/guardians";
import type { TrapEffect } from "../src/game/types";

const base: TrapEffect = GUARDIANS.stonefish.trap!;
const ambush2: TrapEffect = GUARDIANS.stonefish.branches[1].upgrades[1].trap!;

describe("trap core", () => {
  it("arms after armMs, fires when someone is about to escape and rearms after the cooldown", () => {
    const trap = new TrapCore(base, 0);
    expect(trap.phase).toBe("arming");
    expect(trap.update(base.armMs - 1, 1)).toEqual([]);
    expect(trap.update(base.armMs, 0)).toEqual([{ type: "phase", phase: "armed" }]);
    expect(trap.update(base.armMs + 10, 0)).toEqual([]);
    // V3.1: com inimigos dentro mas ninguém saindo, ela SEGURA o tiro.
    expect(trap.update(base.armMs + 15, 2)).toEqual([]);
    const events = trap.update(base.armMs + 20, 2, { leaving: true });
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
    const [trigger] = trap.update(base.armMs + 6000, 1, { leaving: true });
    expect(trigger).toEqual({ type: "trigger", chargeBonus: expect.closeTo(0.18, 6) });
    expect(trapChargeMultipliers(base, 0.15)).toEqual({ damage: expect.closeTo(1.15, 6), control: 1 });
    expect(trapChargeMultipliers(ambush2, 0.15)).toEqual({ damage: 1, control: expect.closeTo(1.15, 6) });
  });

  it("holds the shot until someone is about to leave, and never fires on first contact", () => {
    // V3.1: a armadilha aposta no instante com MAIS gente dentro. Enquanto ninguém está saindo, ela
    // espera — e o que a tira da espera é o inimigo mais avançado chegando na borda.
    expect(base.exitTrigger).toEqual({ exitMargin: 12, maxHoldMs: 2000 });
    const { maxHoldMs } = base.exitTrigger!;

    const patient = new TrapCore(base, 0);
    patient.update(base.armMs, 0);
    const start = base.armMs + 100;
    expect(patient.update(start, 1)).toEqual([]);
    expect(patient.update(start + 400, 3), "grupo crescendo, ninguém saindo: continua esperando").toEqual([]);
    expect(patient.update(start + 500, 3, { leaving: true })[0]).toMatchObject({ type: "trigger" });

    // Rede de segurança: fila parada em cima dela (bloqueador) dispara assim mesmo.
    const stuck = new TrapCore(base, 0);
    stuck.update(base.armMs, 0);
    expect(stuck.update(start, 2)).toEqual([]);
    expect(stuck.update(start + maxHoldMs - 1, 2)).toEqual([]);
    expect(stuck.update(start + maxHoldMs, 2)[0]).toMatchObject({ type: "trigger" });

    // O alvo escapou antes: a espera reinicia no próximo que pisar.
    const reset = new TrapCore(base, 0);
    reset.update(base.armMs, 0);
    reset.update(start, 1);
    reset.update(start + 200, 0);
    expect(reset.update(start + maxHoldMs + 100, 1)).toEqual([]);
  });

  it("applies the rearm multiplier to the cooldown and keeps the phase across upgrades", () => {
    const trap = new TrapCore(base, 0);
    trap.update(base.armMs, 0);
    trap.update(base.armMs + 10, 1, { leaving: true });
    trap.setConfig(ambush2);
    const cooldownAt = base.armMs + 10 + TRAP_TRIGGER_MS;
    trap.update(cooldownAt, 0, { rearmMultiplier: 0.5 });
    expect(trap.phase).toBe("cooldown");
    expect(trap.phaseEndsAt).toBeCloseTo(cooldownAt + ambush2.cooldownMs * 0.5);
  });
});
