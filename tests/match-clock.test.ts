import { describe, expect, it } from "vitest";
import { MatchClock } from "../src/game/core/match/MatchClock";

describe("MatchClock", () => {
  const dt = 1000 / 60;

  it("runs no ticks while paused and resumes without a burst", () => {
    const clock = new MatchClock(dt);
    clock.paused = true;
    expect(clock.advance(500, () => {})).toBe(0);
    clock.paused = false;
    expect(clock.advance(dt, () => {})).toBe(1);
  });

  it("doubles the ticks at 2x and carries the remainder", () => {
    const clock = new MatchClock(dt);
    let ticks = 0;
    clock.advance(dt, () => (ticks += 1));
    expect(ticks).toBe(1);
    clock.speed = 2;
    clock.advance(dt, () => (ticks += 1));
    expect(ticks).toBe(3);
    clock.speed = 1;
    clock.advance(dt / 2, () => (ticks += 1));
    clock.advance(dt / 2, () => (ticks += 1));
    expect(ticks).toBe(4);
  });

  it("caps the ticks per frame and drops the excess after a long stall", () => {
    const clock = new MatchClock(dt, 6, 1000);
    let ticks = 0;
    clock.advance(5000, () => (ticks += 1));
    expect(ticks).toBe(6);
    clock.advance(0, () => (ticks += 1));
    expect(ticks).toBe(6);
  });

  it("clamps a slow frame to the same 80 ms the old loop used", () => {
    const clock = new MatchClock();
    let ticks = 0;
    // Um quadro de 500 ms vale 80 ms de partida: 4 ticks inteiros (o resto é descartado).
    clock.advance(500, () => (ticks += 1));
    expect(ticks).toBe(4);
  });

  it("lets 2x run twice as many ticks in the same slow frame", () => {
    const clock = new MatchClock();
    clock.speed = 2;
    let ticks = 0;
    clock.advance(80, () => (ticks += 1));
    expect(ticks).toBe(9);
  });
});
