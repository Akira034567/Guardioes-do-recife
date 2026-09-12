import type { PearlSink, PearlSource } from "../Economy";
import type { BehaviorEvent, DamageCause } from "../GuardianBehaviors";
import type { AttackKind, BranchId, EnemyId, GuardianId, PlayerId } from "../../types";

export type { DamageCause };

interface Timed {
  now: number;
}

export type MatchEvent =
  // ciclo da partida
  | (Timed & { type: "waveStarted"; waveIndex: number; name: string; isLast: boolean })
  | (Timed & { type: "waveCompleted"; waveIndex: number; bonus: number })
  | (Timed & { type: "levelCompleted"; bonus: number })
  | (Timed & { type: "defeat" })
  | (Timed & { type: "bossStarted"; id: string; enemyId: EnemyId; name: string; title: string; phaseCount: number })
  | (Timed & { type: "bossPhaseChanged"; id: string; phaseIndex: number; phaseCount: number; announcement: string | null })
  | (Timed & { type: "bossDefeated"; id: string; enemyId: EnemyId; name: string; x: number; y: number })
  | (Timed & { type: "currentsReversed"; reversed: boolean; bossName: string | null })
  // inimigos
  | (Timed & { type: "enemySpawned"; id: string; enemyId: EnemyId; x: number; y: number; pathId: string })
  | (Timed & {
      type: "enemyDamaged";
      id: string;
      amount: number;
      health: number;
      maxHealth: number;
      x: number;
      y: number;
      cause: DamageCause;
      sourceId: string | null;
    })
  | (Timed & { type: "enemyKilled"; id: string; enemyId: EnemyId; x: number; y: number; reward: number; killerId: string | null })
  | (Timed & { type: "enemyReachedGoal"; id: string; enemyId: EnemyId; name: string; reefDamage: number; reefLeft: number })
  | (Timed & { type: "enemyHeld"; blockerId: string; enemyId: string; x: number; y: number })
  | (Timed & { type: "enemyReleased"; blockerId: string; enemyId: string; x: number; y: number })
  // guardiões
  | (Timed & {
      type: "guardianPlaced";
      id: string;
      guardianId: GuardianId;
      x: number;
      y: number;
      playerId: PlayerId;
      platformId: string | null;
      cost: number;
    })
  | (Timed & {
      type: "guardianUpgraded";
      id: string;
      guardianId: GuardianId;
      branchId: BranchId;
      level: number;
      optionName: string;
      branchName: string;
      cost: number;
    })
  | (Timed & { type: "guardianSold"; id: string; guardianId: GuardianId; refund: number })
  | (Timed & {
      type: "guardianAttacked";
      id: string;
      guardianId: GuardianId;
      kind: AttackKind;
      x: number;
      y: number;
      targetId: string;
      targetX: number;
      targetY: number;
      /** Inimigos atingidos na ordem em que o golpe os alcançou (cadeia elétrica, área). */
      affectedIds: string[];
      radius: number;
      spinning: boolean;
      stunApplied: boolean;
    })
  | (Timed & { type: "projectileFired"; id: string; ownerId: string; guardianId: GuardianId; x: number; y: number })
  | (Timed & { type: "projectileHit"; id: string; enemyId: string; x: number; y: number; splash: boolean })
  | (Timed & { type: "projectileExpired"; id: string })
  // áreas persistentes
  | (Timed & { type: "fieldCreated"; ownerId: string; x: number; y: number; radius: number; durationMs: number })
  | (Timed & { type: "fieldPulsed"; ownerId: string; x: number; y: number; radius: number; hitCount: number })
  | (Timed & { type: "fieldExpired"; ownerId: string })
  | (Timed & { type: "cloudCreated"; ownerId: string; kind: "ink" | "toxic"; x: number; y: number; radius: number; durationMs: number })
  | (Timed & { type: "cloudExpired"; ownerId: string })
  // economia
  | (Timed & { type: "pearlsChanged"; playerId: PlayerId; pearls: number; delta: number; source: PearlSource | PearlSink })
  // comportamentos compartilhados (visual)
  | (Timed & { type: "behavior"; event: BehaviorEvent });

export type MatchEventType = MatchEvent["type"];
export type MatchListener = (event: MatchEvent) => void;
