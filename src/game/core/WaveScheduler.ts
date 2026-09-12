import type { EliteId } from "../data/elites";
import type { EnemyId, WaveDefinition, WaveState } from "../types";
import { normalizeWaves, type ResolvedWave } from "./WaveDefinitions";

interface GroupRuntime {
  spawned: number;
}

export type WaveSchedulerEvent =
  | { type: "spawn"; enemyId: EnemyId; pathId: string; eliteId: EliteId | null; waveIndex: number; groupIndex: number; spawnIndex: number }
  | { type: "waveStarted"; waveIndex: number; isBossWave: boolean; earlyStartMs: number }
  | { type: "waveCleared"; waveIndex: number; reward: number }
  | { type: "victory" };

export class WaveScheduler {
  private readonly waves: ResolvedWave[];
  private waveIndex = 0;
  private currentState: WaveState = "countdown";
  private countdownRemainingMs: number;
  private waveElapsedMs = 0;
  private groups: GroupRuntime[] = [];
  /** Quanto tempo de preparação foi pulado ao chamar a onda antes da hora (bônus de início). */
  private lastEarlyStartMs = 0;

  constructor(
    waves: readonly WaveDefinition[],
    initialDelayMs: number,
    private readonly betweenWaveDelayMs: number,
    startWaveIndex = 0,
  ) {
    if (waves.length === 0) throw new Error("At least one wave is required.");
    this.waves = normalizeWaves(waves);
    this.waveIndex = Math.max(0, Math.min(waves.length - 1, Math.floor(startWaveIndex)));
    this.countdownRemainingMs = initialDelayMs;
    this.resetGroups();
  }

  get state(): WaveState {
    return this.currentState;
  }

  get currentWave(): number {
    return Math.min(this.waveIndex + 1, this.waves.length);
  }

  get currentWaveIndex(): number {
    return this.waveIndex;
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  /** Milissegundos restantes da contagem (0 fora dela). */
  get countdownMs(): number {
    return this.currentState === "countdown" ? Math.max(0, this.countdownRemainingMs) : 0;
  }

  get countdownSeconds(): number {
    return this.currentState === "countdown" ? Math.max(0, Math.ceil(this.countdownRemainingMs / 1000)) : 0;
  }

  /** Próxima onda a começar (a atual enquanto a contagem corre), para o preview do HUD. */
  get upcomingWave(): ResolvedWave | null {
    return this.currentState === "countdown" ? (this.waves[this.waveIndex] ?? null) : (this.waves[this.waveIndex + 1] ?? null);
  }

  wave(index: number): ResolvedWave | null {
    return this.waves[index] ?? null;
  }

  /**
   * Chama a próxima onda agora. Devolve quantos milissegundos de preparação foram pulados (base do
   * bônus de início antecipado) ou `null` quando não há contagem em curso.
   */
  startNextWave(): number | null {
    if (this.currentState !== "countdown" || this.countdownRemainingMs <= 0) return null;
    const remaining = this.countdownRemainingMs;
    this.countdownRemainingMs = 0;
    this.lastEarlyStartMs = remaining;
    return remaining;
  }

  /** Nome antigo de `startNextWave` (botão "PULAR"). */
  skipCountdown(): boolean {
    return this.startNextWave() !== null;
  }

  /** Ferramenta de debug: marca a onda atual como totalmente gerada, para ela poder fechar. */
  forceCompleteSpawns(): void {
    const wave = this.waves[this.waveIndex];
    this.groups.forEach((runtime, index) => (runtime.spawned = wave.groups[index].count));
    if (this.currentState === "countdown") {
      this.countdownRemainingMs = 0;
      this.lastEarlyStartMs = 0;
    }
  }

  tick(deltaMs: number, aliveEnemyCount: number): WaveSchedulerEvent[] {
    const events: WaveSchedulerEvent[] = [];
    if (this.currentState === "victory") return events;

    if (this.currentState === "countdown") {
      this.countdownRemainingMs -= Math.max(0, deltaMs);
      if (this.countdownRemainingMs <= 0) {
        this.currentState = "spawning";
        this.waveElapsedMs = 0;
        events.push({
          type: "waveStarted",
          waveIndex: this.waveIndex,
          isBossWave: this.waves[this.waveIndex].isBossWave,
          earlyStartMs: this.lastEarlyStartMs,
        });
        this.lastEarlyStartMs = 0;
      }
      return events;
    }

    this.waveElapsedMs += Math.max(0, deltaMs);
    const wave = this.waves[this.waveIndex];
    wave.groups.forEach((group, index) => {
      const runtime = this.groups[index];
      while (runtime.spawned < group.count && this.waveElapsedMs >= group.delayMs + runtime.spawned * group.intervalMs) {
        const spawnIndex = runtime.spawned;
        runtime.spawned += 1;
        events.push({
          type: "spawn",
          enemyId: group.enemyId,
          pathId: group.pathId,
          eliteId: group.elites[spawnIndex] ?? null,
          waveIndex: this.waveIndex,
          groupIndex: index,
          spawnIndex,
        });
      }
    });

    const allSpawned = wave.groups.every((group, index) => this.groups[index].spawned >= group.count);
    if (allSpawned) this.currentState = "active";

    const spawnedThisTick = events.some((event) => event.type === "spawn");
    if (allSpawned && aliveEnemyCount === 0 && !spawnedThisTick) {
      events.push({ type: "waveCleared", waveIndex: this.waveIndex, reward: wave.completionReward });
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
