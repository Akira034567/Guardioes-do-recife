import type { GuardianState, GuardianStateTimings } from "../types";

export type GuardianFsmTimings = GuardianStateTimings & { impactAtMs: number };

export interface GuardianTransition {
  previous: GuardianState;
  current: GuardianState;
  startedAt: number;
  durationMs: number | null;
  targetId: string | null;
}

export interface GuardianFsmSnapshot {
  state: GuardianState;
  stateStartedAt: number;
  stateDurationMs: number | null;
  targetId: string | null;
  impactEmitted: boolean;
}

export type GuardianFsmEvent =
  | { type: "transition"; transition: GuardianTransition }
  | { type: "impact"; targetId: string };

export class GuardianStateMachine {
  private currentState: GuardianState = "idle";
  private stateStartedAt = 0;
  private stateDurationMs: number | null = null;
  private currentTargetId: string | null = null;
  private impactEmitted = false;

  constructor(private readonly timings: GuardianFsmTimings) {}

  get state(): GuardianState {
    return this.currentState;
  }

  get targetId(): string | null {
    return this.currentTargetId;
  }

  beginAttack(targetId: string, now: number): GuardianFsmEvent[] {
    if (this.currentState !== "idle") return [];
    return [this.transition("windup", now, this.timings.windupMs, targetId)];
  }

  disable(now: number): GuardianFsmEvent[] {
    if (this.currentState === "disabled") return [];
    return [this.transition("disabled", now, null, null)];
  }

  enable(now: number): GuardianFsmEvent[] {
    if (this.currentState !== "disabled") return [];
    return [this.transition("idle", now, null, null)];
  }

  update(now: number, targetIsValid: boolean): GuardianFsmEvent[] {
    const events: GuardianFsmEvent[] = [];

    if (
      (this.currentState === "windup" || (this.currentState === "attack" && !this.impactEmitted)) &&
      !targetIsValid
    ) {
      events.push(this.transition("idle", now, null, null));
      return events;
    }

    if (this.currentState === "windup" && this.elapsed(now) >= this.timings.windupMs) {
      events.push(this.transition("attack", now, this.timings.attackMs, this.currentTargetId));
    }

    if (
      this.currentState === "attack" &&
      !this.impactEmitted &&
      this.elapsed(now) >= this.timings.impactAtMs &&
      this.currentTargetId
    ) {
      this.impactEmitted = true;
      events.push({ type: "impact", targetId: this.currentTargetId });
    }

    if (this.currentState === "attack" && this.elapsed(now) >= this.timings.attackMs) {
      events.push(this.transition("recovery", now, this.timings.recoveryMs, null));
    } else if (this.currentState === "recovery" && this.elapsed(now) >= this.timings.recoveryMs) {
      events.push(this.transition("idle", now, null, null));
    }

    return events;
  }

  snapshot(): GuardianFsmSnapshot {
    return {
      state: this.currentState,
      stateStartedAt: this.stateStartedAt,
      stateDurationMs: this.stateDurationMs,
      targetId: this.currentTargetId,
      impactEmitted: this.impactEmitted,
    };
  }

  private elapsed(now: number): number {
    return Math.max(0, now - this.stateStartedAt);
  }

  private transition(
    state: GuardianState,
    now: number,
    durationMs: number | null,
    targetId: string | null,
  ): GuardianFsmEvent {
    const previous = this.currentState;
    this.currentState = state;
    this.stateStartedAt = now;
    this.stateDurationMs = durationMs;
    this.currentTargetId = targetId;
    this.impactEmitted = false;
    return {
      type: "transition",
      transition: { previous, current: state, startedAt: now, durationMs, targetId },
    };
  }
}
