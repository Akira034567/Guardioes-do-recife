import type { EnemyId, WaveDefinition, WaveState } from "../types";

interface GroupRuntime {
  spawned: number;
}

export type WaveSchedulerEvent =
  | { type: "spawn"; enemyId: EnemyId }
  | { type: "waveStarted"; waveIndex: number }
  | { type: "waveCleared"; waveIndex: number }
  | { type: "victory" };

export class WaveScheduler {
  private waveIndex = 0;
  private currentState: WaveState = "countdown";
  private countdownRemainingMs: number;
  private waveElapsedMs = 0;
  private groups: GroupRuntime[] = [];

  constructor(
    private readonly waves: readonly WaveDefinition[],
    initialDelayMs: number,
    private readonly betweenWaveDelayMs: number,
  ) {
    if (waves.length === 0) throw new Error("At least one wave is required.");
    this.countdownRemainingMs = initialDelayMs;
    this.resetGroups();
  }

  get state(): WaveState {
    return this.currentState;
  }

  get currentWave(): number {
    return Math.min(this.waveIndex + 1, this.waves.length);
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  get countdownSeconds(): number {
    return this.currentState === "countdown" ? Math.max(0, Math.ceil(this.countdownRemainingMs / 1000)) : 0;
  }

  tick(deltaMs: number, aliveEnemyCount: number): WaveSchedulerEvent[] {
    const events: WaveSchedulerEvent[] = [];
    if (this.currentState === "victory") return events;

    if (this.currentState === "countdown") {
      this.countdownRemainingMs -= Math.max(0, deltaMs);
      if (this.countdownRemainingMs <= 0) {
        this.currentState = "spawning";
        this.waveElapsedMs = 0;
        events.push({ type: "waveStarted", waveIndex: this.waveIndex });
      }
      return events;
    }

    this.waveElapsedMs += Math.max(0, deltaMs);
    const wave = this.waves[this.waveIndex];
    wave.groups.forEach((group, index) => {
      const runtime = this.groups[index];
      while (
        runtime.spawned < group.count &&
        this.waveElapsedMs >= group.delayMs + runtime.spawned * group.intervalMs
      ) {
        runtime.spawned += 1;
        events.push({ type: "spawn", enemyId: group.enemyId });
      }
    });

    const allSpawned = wave.groups.every((group, index) => this.groups[index].spawned >= group.count);
    if (allSpawned) this.currentState = "active";

    const spawnedThisTick = events.some((event) => event.type === "spawn");
    if (allSpawned && aliveEnemyCount === 0 && !spawnedThisTick) {
      events.push({ type: "waveCleared", waveIndex: this.waveIndex });
      if (this.waveIndex === this.waves.length - 1) {
        this.currentState = "victory";
        events.push({ type: "victory" });
      } else {
        this.waveIndex += 1;
        this.currentState = "countdown";
        this.countdownRemainingMs = this.betweenWaveDelayMs;
        this.waveElapsedMs = 0;
        this.resetGroups();
      }
    }

    return events;
  }

  private resetGroups(): void {
    this.groups = this.waves[this.waveIndex].groups.map(() => ({ spawned: 0 }));
  }
}
