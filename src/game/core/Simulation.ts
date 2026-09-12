import { GUARDIANS } from "../data/guardians";
import type { BranchId, EnemyId, GuardianId, LevelDefinition } from "../types";
import { Match, type MatchController } from "./match/Match";

/**
 * Simulação headless de uma fase com um roteiro de compras, usada para calibrar fases em segundos.
 * Roda o MESMO motor da partida real (`core/match/Match.ts`); as sondas e2e em
 * `tests/e2e/balance.spec.ts` confirmam os mesmos roteiros no jogo.
 */

export type SimPoint = [number, number];
export type SimStep = { place: GuardianId; at: SimPoint } | { upgrade: SimPoint; branch: BranchId };

export interface SimOptions {
  dtMs?: number;
  maxMs?: number;
}

export interface SimResult {
  state: "victory" | "defeat";
  reef: number;
  pearls: number;
  guardians: number;
  upgrades: number;
  timeMs: number;
  wavesCleared: number;
  totalWaves: number;
  kills: Partial<Record<EnemyId, number>>;
  leaks: Partial<Record<EnemyId, number>>;
  stepsExecuted: number;
}

/**
 * Jogador roteirizado: executa os passos em ordem assim que houver pérolas. Placement inválido é
 * erro de roteiro (lança); falta de pérolas só espera.
 */
export class ScriptedPlayer implements MatchController {
  private stepIndex = 0;

  constructor(private readonly steps: readonly SimStep[]) {}

  get stepsExecuted(): number {
    return this.stepIndex;
  }

  act(match: Match): void {
    while (this.stepIndex < this.steps.length) {
      const step = this.steps[this.stepIndex];
      if ("place" in step) {
        const definition = GUARDIANS[step.place];
        const result = match.execute({ type: "placeGuardian", guardianId: step.place, x: step.at[0], y: step.at[1] });
        if (!result.ok) {
          if (result.reason === "insufficientPearls") return;
          throw new Error(`${match.level.id}: ${definition.placementMode} inválido em ${step.at.join(",")} (${result.message})`);
        }
      } else {
        const guardian = match.guardians.find((candidate) => Math.hypot(candidate.x - step.upgrade[0], candidate.y - step.upgrade[1]) <= 40);
        if (!guardian) throw new Error(`${match.level.id}: nenhuma unidade em ${step.upgrade.join(",")}`);
        const result = match.execute({ type: "upgradeGuardian", instanceId: guardian.id, branchId: step.branch });
        if (!result.ok) {
          if (result.reason === "insufficientPearls") return;
          throw new Error(`${match.level.id}: upgrade ${step.branch} indisponível em ${step.upgrade.join(",")}`);
        }
      }
      this.stepIndex += 1;
    }
  }
}

export function simulateLevel(level: LevelDefinition, steps: readonly SimStep[], options: SimOptions = {}): SimResult {
  const dtMs = options.dtMs ?? 1000 / 60;
  const maxMs = options.maxMs ?? 900_000;
  const player = new ScriptedPlayer(steps);
  const match = new Match(level, { dtMs, controller: player });
  while (match.status === "running" && match.now < maxMs) match.tick();
  if (match.status === "running") throw new Error(`Simulation of ${level.id} did not finish within ${maxMs} ms`);
  const snapshot = match.snapshot();
  return {
    state: match.status,
    reef: match.reef,
    pearls: match.pearls(),
    guardians: snapshot.guardianCount,
    upgrades: snapshot.upgradeCount,
    timeMs: match.now,
    wavesCleared: match.stats.wavesCompleted,
    totalWaves: level.waves.length,
    kills: { ...match.stats.kills },
    leaks: { ...match.stats.leaks },
    stepsExecuted: player.stepsExecuted,
  };
}
