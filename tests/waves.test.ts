import { describe, expect, it } from "vitest";
import { WaveScheduler } from "../src/game/core/WaveScheduler";
import type { WaveDefinition } from "../src/game/types";

const waves: WaveDefinition[] = [
  { name: "one", groups: [{ enemyId: "swimmer", count: 2, intervalMs: 100, delayMs: 0 }] },
  { name: "two", groups: [{ enemyId: "dartfish", count: 1, intervalMs: 100, delayMs: 0 }] },
];

describe("WaveScheduler", () => {
  it("counts down, spawns exactly once and waits for living enemies", () => {
    const scheduler = new WaveScheduler(waves, 500, 300);
    expect(scheduler.tick(499, 0)).toEqual([]);
    expect(scheduler.tick(1, 0)).toContainEqual({ type: "waveStarted", waveIndex: 0 });
    expect(scheduler.tick(1, 0).filter((event) => event.type === "spawn")).toHaveLength(1);
    expect(scheduler.tick(99, 1).filter((event) => event.type === "spawn")).toHaveLength(1);
    expect(scheduler.tick(1, 2)).toEqual([]);
    expect(scheduler.tick(1, 0)).toContainEqual({ type: "waveCleared", waveIndex: 0 });
    expect(scheduler.state).toBe("countdown");
  });

  it("emits victory after the final wave is cleared", () => {
    const scheduler = new WaveScheduler([waves[1]], 0, 0);
    scheduler.tick(0, 0);
    scheduler.tick(1, 0);
    const events = scheduler.tick(1, 0);
    expect(events).toContainEqual({ type: "victory" });
    expect(scheduler.state).toBe("victory");
  });

  it("allows countdowns to be skipped without duplicating wave starts", () => {
    const scheduler = new WaveScheduler(waves, 10_000, 8_000);
    expect(scheduler.skipCountdown()).toBe(true);
    expect(scheduler.countdownSeconds).toBe(0);
    expect(scheduler.tick(1, 0)).toEqual([{ type: "waveStarted", waveIndex: 0 }]);
    expect(scheduler.skipCountdown()).toBe(false);
    expect(scheduler.tick(1, 0).filter((event) => event.type === "waveStarted")).toHaveLength(0);
  });
});
