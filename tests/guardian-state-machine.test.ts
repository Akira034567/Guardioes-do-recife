import { describe, expect, it } from "vitest";
import { GuardianStateMachine } from "../src/game/core/GuardianStateMachine";

const timings = { windupMs: 100, attackMs: 120, impactAtMs: 40, recoveryMs: 200 };

describe("GuardianStateMachine", () => {
  it("runs the full attack lifecycle and emits one impact", () => {
    const fsm = new GuardianStateMachine(timings);
    fsm.beginAttack("E1", 0);
    expect(fsm.state).toBe("windup");
    fsm.update(100, true);
    expect(fsm.state).toBe("attack");
    const impactEvents = fsm.update(140, true).filter((event) => event.type === "impact");
    expect(impactEvents).toHaveLength(1);
    expect(fsm.update(180, true).filter((event) => event.type === "impact")).toHaveLength(0);
    fsm.update(220, true);
    expect(fsm.state).toBe("recovery");
    fsm.update(420, false);
    expect(fsm.state).toBe("idle");
  });

  it("cancels before impact when the target is lost", () => {
    const fsm = new GuardianStateMachine(timings);
    fsm.beginAttack("E1", 0);
    const events = fsm.update(50, false);
    expect(fsm.state).toBe("idle");
    expect(events.some((event) => event.type === "impact")).toBe(false);
  });

  it("can be interrupted and explicitly re-enabled", () => {
    const fsm = new GuardianStateMachine(timings);
    fsm.beginAttack("E1", 0);
    fsm.disable(30);
    expect(fsm.snapshot()).toMatchObject({ state: "disabled", targetId: null });
    expect(fsm.beginAttack("E2", 40)).toEqual([]);
    fsm.enable(100);
    expect(fsm.state).toBe("idle");
  });
});
