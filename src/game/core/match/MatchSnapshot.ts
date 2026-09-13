import type { WaveState } from "../../types";
import type { WavePreview } from "../WavePreview";
import type { TrapPhase } from "../TrapCore";
import type { MatchStatsSnapshot } from "./MatchStats";
import type { InteractableState } from "../Interactables";

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
  /** Pontos fracos deste chefe; `null` quando a dificuldade não os concede (item 11). */
  weakPoints: { total: number; remaining: number } | null;
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
  /** Elementos interativos do mapa e o progresso de cada um (item 28). */
  interactables: InteractableSnapshot[];
  stats: MatchStatsSnapshot;
}

/** Um interagível do mapa como a apresentação precisa vê-lo. */
export interface InteractableSnapshot {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  state: InteractableState;
  /** 0..1 para a argola de progresso. */
  progress: number;
  /** Responde a toque do jogador (rede, pedra); os demais dependem do que acontece em campo. */
  tappable: boolean;
  hint: string;
}
