import type { WaveState } from "../../types";
import type { TrapPhase } from "../TrapCore";
import type { MatchStatsSnapshot } from "./MatchStats";

export type MatchStatus = "running" | "victory" | "defeat";

export interface BossSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  speed: number;
  health: number;
  maxHealth: number;
  blockedById: string | null;
}

/** Resumo barato da partida para o HUD (montado sob demanda, não a cada tick). */
export interface MatchSnapshot {
  status: MatchStatus;
  now: number;
  pearls: number;
  reef: number;
  maxReef: number;
  wave: number;
  totalWaves: number;
  waveState: WaveState;
  countdownSeconds: number;
  canStartNextWave: boolean;
  guardianCount: number;
  upgradeCount: number;
  aliveEnemies: number;
  boss: BossSnapshot | null;
  /** Fase da primeira armadilha em campo (hook de teste e2e). */
  trapPhase: TrapPhase | null;
  stats: MatchStatsSnapshot;
}
