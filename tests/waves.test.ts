import { describe, expect, it } from "vitest";
import { normalizeWave, resolveLevelPaths } from "../src/game/core/WaveDefinitions";
import { wavePreview } from "../src/game/core/WavePreview";
import { WaveScheduler, type WaveSchedulerEvent } from "../src/game/core/WaveScheduler";
import { ECONOMY } from "../src/game/data/balance";
import { RECIFE_ONE } from "../src/game/data/levels";
import type { WaveDefinition } from "../src/game/types";

const waves: WaveDefinition[] = [
  { name: "one", groups: [{ enemyId: "swimmer", count: 2, intervalMs: 100, delayMs: 0 }] },
  { name: "two", groups: [{ enemyId: "dartfish", count: 1, intervalMs: 100, delayMs: 0 }] },
];

/** Roda o agendador (sem inimigos vivos) até o próximo evento do tipo pedido. */
function runUntil<T extends WaveSchedulerEvent["type"]>(
  scheduler: WaveScheduler,
  type: T,
  stepMs = 100,
  maxSteps = 2000,
): Extract<WaveSchedulerEvent, { type: T }> {
  for (let step = 0; step < maxSteps; step += 1) {
    const found = scheduler.tick(stepMs, 0).find((event) => event.type === type);
    if (found) return found as Extract<WaveSchedulerEvent, { type: T }>;
  }
  throw new Error(`O agendador não emitiu "${type}" a tempo.`);
}

describe("WaveScheduler", () => {
  it("counts down, spawns exactly once and waits for living enemies", () => {
    const scheduler = new WaveScheduler(waves, 500, 300);
    expect(scheduler.tick(499, 0)).toEqual([]);
    expect(scheduler.tick(1, 0)).toContainEqual(expect.objectContaining({ type: "waveStarted", waveIndex: 0 }));
    expect(scheduler.tick(1, 0).filter((event) => event.type === "spawn")).toHaveLength(1);
    expect(scheduler.tick(99, 1).filter((event) => event.type === "spawn")).toHaveLength(1);
    expect(scheduler.tick(1, 2)).toEqual([]);
    expect(scheduler.tick(1, 0)).toContainEqual(expect.objectContaining({ type: "waveCleared", waveIndex: 0 }));
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
    expect(scheduler.tick(1, 0)).toEqual([expect.objectContaining({ type: "waveStarted", waveIndex: 0 })]);
    expect(scheduler.skipCountdown()).toBe(false);
    expect(scheduler.tick(1, 0).filter((event) => event.type === "waveStarted")).toHaveLength(0);
  });

  it("reports how much preparation an early call skipped, once", () => {
    const scheduler = new WaveScheduler(waves, 10_000, 8_000);
    scheduler.tick(2_000, 0);
    expect(scheduler.startNextWave()).toBe(8_000);
    expect(scheduler.startNextWave()).toBeNull();
    expect(runUntil(scheduler, "waveStarted")).toMatchObject({ waveIndex: 0, earlyStartMs: 8_000 });
    // A onda seguinte, deixada correr até o fim da preparação, não repete o bônus.
    expect(runUntil(scheduler, "waveStarted")).toMatchObject({ waveIndex: 1, earlyStartMs: 0 });
  });

  it("carries each wave's own completion reward and boss flag", () => {
    const scheduler = new WaveScheduler(
      [
        { name: "rica", groups: [{ enemyId: "swimmer", count: 1, intervalMs: 0, delayMs: 0 }], completionReward: 120 },
        { name: "chefe", groups: [{ enemyId: "tidebreaker", count: 1, intervalMs: 0, delayMs: 0 }] },
      ],
      0,
      0,
    );
    expect(runUntil(scheduler, "waveStarted")).toMatchObject({ waveIndex: 0, isBossWave: false });
    expect(runUntil(scheduler, "waveCleared")).toMatchObject({ waveIndex: 0, reward: 120 });
    expect(runUntil(scheduler, "waveStarted")).toMatchObject({ waveIndex: 1, isBossWave: true });
  });
});

describe("wave normalization", () => {
  it("accepts the authoring aliases and fills the default path", () => {
    const wave = normalizeWave(
      { name: "alias", groups: [], enemyGroups: [{ enemyId: "minnow", count: 3, spawnInterval: 250, spawnDelay: 500 }] },
      0,
    );
    expect(wave.groups).toEqual([
      { enemyId: "minnow", count: 3, intervalMs: 250, delayMs: 500, pathId: "main", elites: [null, null, null] },
    ]);
    expect(wave.completionReward).toBe(ECONOMY.waveClearBonus);
    expect(wave.isBossWave).toBe(false);
  });

  it("marks every spawn as elite by default and only the picked ones with elitePicks", () => {
    const all = normalizeWave({ name: "elites", groups: [{ enemyId: "swimmer", count: 3, intervalMs: 0, delayMs: 0, elite: "swift" }] }, 0);
    expect(all.groups[0].elites).toEqual(["swift", "swift", "swift"]);
    const picked = normalizeWave(
      { name: "mistos", groups: [{ enemyId: "swimmer", count: 4, intervalMs: 0, delayMs: 0, elite: ["armored", "swift"], elitePicks: [1, 3, 9] }] },
      0,
    );
    expect(picked.groups[0].elites).toEqual([null, "armored", null, "swift"]);
  });

  it("emits the elite and the path of each spawn", () => {
    const scheduler = new WaveScheduler(
      [{ name: "canal", groups: [{ enemyId: "swimmer", count: 2, intervalMs: 0, delayMs: 0, elite: "armored", elitePicks: [1], pathId: "leste" }] }],
      0,
      0,
    );
    scheduler.tick(0, 0);
    const spawns = scheduler.tick(1, 0).filter((event) => event.type === "spawn");
    expect(spawns).toHaveLength(2);
    expect(spawns[0]).toMatchObject({ pathId: "leste", eliteId: null, spawnIndex: 0 });
    expect(spawns[1]).toMatchObject({ pathId: "leste", eliteId: "armored", spawnIndex: 1 });
  });

  it("treats waypoints as the main path, with or without extra paths", () => {
    expect(resolveLevelPaths(RECIFE_ONE)).toEqual([{ id: "main", waypoints: RECIFE_ONE.waypoints }]);
    const extra = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const paths = resolveLevelPaths({ waypoints: RECIFE_ONE.waypoints, paths: [{ id: "principal", waypoints: [] }, { id: "atalho", waypoints: extra }] });
    expect(paths[0]).toEqual({ id: "principal", waypoints: RECIFE_ONE.waypoints });
    expect(paths[1]).toEqual({ id: "atalho", waypoints: extra });
  });
});

describe("wave preview", () => {
  it("groups the next wave by enemy and elite variant", () => {
    const wave = normalizeWave(
      {
        name: "Pressão",
        groups: [
          { enemyId: "swimmer", count: 3, intervalMs: 0, delayMs: 0 },
          { enemyId: "swimmer", count: 2, intervalMs: 0, delayMs: 0, elite: "armored" },
          { enemyId: "tidebreaker", count: 1, intervalMs: 0, delayMs: 0 },
        ],
      },
      6,
    );
    const preview = wavePreview(wave);
    expect(preview).toMatchObject({ waveIndex: 6, name: "Pressão", isBossWave: true, totalCount: 6 });
    expect(preview?.entries).toEqual([
      expect.objectContaining({ enemyId: "swimmer", eliteId: null, count: 3, isBoss: false }),
      expect.objectContaining({ enemyId: "swimmer", eliteId: "armored", count: 2, name: "Peixe Invasor Blindado" }),
      expect.objectContaining({ enemyId: "tidebreaker", count: 1, isBoss: true }),
    ]);
    expect(wavePreview(null)).toBeNull();
  });

  it("previews the wave that is counting down and nothing after the last one", () => {
    const scheduler = new WaveScheduler(waves, 100, 100);
    expect(wavePreview(scheduler.upcomingWave)).toMatchObject({ waveIndex: 0, name: "one" });
    scheduler.tick(100, 0);
    expect(wavePreview(scheduler.upcomingWave), "em combate o preview mostra a PRÓXIMA onda").toMatchObject({ waveIndex: 1, name: "two" });
    while (scheduler.state !== "victory") scheduler.tick(100, 0);
    expect(wavePreview(scheduler.upcomingWave)).toBeNull();
  });
});
