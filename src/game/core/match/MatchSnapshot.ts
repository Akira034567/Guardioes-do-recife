import type { WaveState } from "../../types";
import type { WavePreview } from "../WavePreview";
import type { TrapPhase } from "../TrapCore";
import type { MatchStatsSnapshot } from "./MatchStats";

export type MatchStatus = "running" | "victory" | "defeat";

export interface BossSnapshot {
  id: string;
  name: string;
  /** Nome de exibição do encontro (pode diferir do nome do inimigo). */
  title: string;
  x: number;
  y: number;
  speed: number;
  health: number;
  maxHealth: number;
  healthRatio: number;
  phaseIndex: number;
  phaseCount: number;
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
  /** Composição da próxima onda (item 9); null na última. */
  nextWave: WavePreview | null;
  /** Fase da primeira armadilha em campo (hook de teste e2e). */
  trapPhase: TrapPhase | null;
  stats: MatchStatsSnapshot;
}
