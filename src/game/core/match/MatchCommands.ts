import type { EliteId } from "../../data/elites";
import type { BranchId, EnemyId, GuardianId, PlayerId } from "../../types";

/**
 * Comandos são a única porta de mutação da partida vinda de fora do motor (jogador, roteiro de
 * balanceamento, futuro jogador remoto). Todos carregam `playerId` (padrão "p1").
 */
export type MatchCommand =
  | { type: "placeGuardian"; guardianId: GuardianId; x: number; y: number; platformId?: string; playerId?: PlayerId }
  | { type: "upgradeGuardian"; instanceId: string; branchId: BranchId; playerId?: PlayerId }
  | { type: "sellGuardian"; instanceId: string; playerId?: PlayerId }
  | { type: "startNextWave"; playerId?: PlayerId }
  // Ferramentas de desenvolvimento (item 40). Toda partida que usar uma delas fica marcada
  // (`stats.cheated`) e não deve render estrelas nem moeda global.
  | { type: "debug.addPearls"; amount: number; playerId?: PlayerId }
  | { type: "debug.spawnEnemy"; enemyId: EnemyId; elite?: EliteId; playerId?: PlayerId }
  | { type: "debug.skipWave"; playerId?: PlayerId }
  | { type: "debug.killAll"; playerId?: PlayerId }
  | { type: "debug.invincible"; on: boolean; playerId?: PlayerId };

export type RejectionReason =
  | "gameOver"
  | "insufficientPearls"
  | "needsPlatform"
  | "platformOccupied"
  | "noPlatformNear"
  | "invalidPlacement"
  | "notFound"
  | "notOwner"
  | "branchLocked"
  | "noOption"
  | "notInCountdown"
  | "unknownCommand";

export type CommandResult =
  | { ok: true; instanceId?: string; refund?: number; earlyStartMs?: number; cost?: number }
  | { ok: false; reason: RejectionReason; message: string };

export const DEFAULT_PLAYER_ID: PlayerId = "p1";
