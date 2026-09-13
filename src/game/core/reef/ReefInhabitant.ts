import type { DecorationKind } from "../../data/reef/decorations";
import type { HubBehaviorProfile, HubQuirk } from "../../data/reef/hubBehaviors";
import { reefZone, type ReefPoint, type ReefRestSpot } from "../../data/reef/layout";
import { createRng, hashSeed, type Rng } from "../Rng";

/**
 * Um Guardião morando no Recife: só posição, estado e vontade. Nada de Phaser aqui — a cena lê o
 * retrato e escreve nos sprites, o que deixa todo o comportamento testável no vitest.
 *
 * Duas garantias que valem a pena não perder de vista:
 *
 * - O sorteio é consultado só nos PONTOS DE DECISÃO (escolher destino, sortear pausa), nunca por
 *   quadro. A taxa de quadros muda quantas decisões cabem por segundo, não quais são.
 * - A posição é sempre travada nos limites do habitat. Nenhum `dt` patológico solta ninguém.
 */

export type InhabitantState = "swim" | "pause" | "quirk" | "rest" | "flee" | "approach";

export interface InhabitantSnapshot {
  guardianId: string;
  state: InhabitantState;
  /** % da área do Recife. A cena multiplica por largura e altura; o core nunca vê pixel. */
  x: number;
  y: number;
  /** % por segundo. */
  vx: number;
  vy: number;
  facing: 1 | -1;
  quirk: HubQuirk | null;
  /** 0..1 dentro do quirk: a cena interpola o inflar, o pulsar, o anel do sonar. */
  quirkT: number;
  /** O seno já calculado, em % da altura: a cena só soma. */
  bobOffset: number;
}

/** O que o mundo conta para a criatura. Objeto simples: dá para montar num teste em três linhas. */
export interface ReefWorld {
  restSpots: readonly ReefRestSpot[];
  /** Decorações plantadas, para "esconder atrás da pedra". */
  cover: readonly { x: number; y: number; kind: DecorationKind }[];
  /** Cursor em %, ou null quando está fora da cena. */
  pointer: ReefPoint | null;
}

/** Trocar de aba não pode teleportar nove criaturas pelo Recife. */
export const MAX_TICK_MS = 100;

const ARRIVE_EPS = 0.6;
const FACING_EPS = 0.01;
const TAU = Math.PI * 2;

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class ReefInhabitant {
  readonly guardianId: string;
  readonly profile: HubBehaviorProfile;

  private readonly rng: Rng;
  private readonly bounds: Bounds;
  private readonly phase: number;
  private x: number;
  private y: number;
  private vx = 0;
  private vy = 0;
  private facing: 1 | -1 = 1;
  private state: InhabitantState = "swim";
  private target: ReefPoint;
  private elapsed = 0;
  private stateUntil = 0;
  private quirkAt: number;
  private quirkKind: HubQuirk | null = null;
  private quirkStartedAt = 0;
  /** O descansador já chegou no cantinho? Enquanto não, o relógio do descanso nem começou. */
  private restArrived = false;
  private speedScale = 1;

  constructor(profile: HubBehaviorProfile, seed: number | string, start?: ReefPoint) {
    this.profile = profile;
    this.guardianId = profile.guardianId;
    this.rng = createRng(hashSeed(String(seed), profile.guardianId));
    this.bounds = reefZone(profile.habitat).bounds;
    // Fases distintas: nove Guardiões não podem balançar em uníssono.
    this.phase = this.rng.next() * TAU;
    const anchor = this.clampPoint(profile.anchor);
    this.x = start ? this.clamp(start.x, this.bounds.x, this.bounds.x + this.bounds.w) : anchor.x;
    this.y = start ? this.clamp(start.y, this.bounds.y, this.bounds.y + this.bounds.h) : anchor.y;
    this.target = this.pickTarget();
    this.quirkAt = this.between(profile.quirkIntervalMs.min, profile.quirkIntervalMs.max);
    this.speedScale = this.jitteredSpeedScale();
  }

  snapshot(): InhabitantSnapshot {
    return {
      guardianId: this.guardianId,
      state: this.state,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      facing: this.facing,
      quirk: this.quirkKind,
      quirkT: this.quirkProgress(),
      bobOffset: this.profile.bob.amplitude * Math.sin((TAU * this.elapsed) / this.profile.bob.periodMs + this.phase),
    };
  }

  teleport(at: ReefPoint): void {
    const point = this.clampPoint(at);
    this.x = point.x;
    this.y = point.y;
    this.target = this.pickTarget();
  }

  /** Determinístico: mesma semente e mesma sequência de `(dt, world)` dão o mesmo resultado. */
  tick(dtMs: number, world: ReefWorld): void {
    const dt = Math.max(0, Math.min(dtMs, MAX_TICK_MS));
    this.elapsed += dt;

    this.reactToPointer(world);
    this.advanceQuirk(world);
    this.move(dt);
  }

  // ------------------------------------------------------------------- interno

  private reactToPointer(world: ReefWorld): void {
    const { reaction, radius } = this.profile.cursor;
    if (reaction === "ignore" || !world.pointer) {
      if (this.state === "flee" || this.state === "approach") this.state = "swim";
      return;
    }
    const distance = Math.hypot(world.pointer.x - this.x, world.pointer.y - this.y);
    if (distance > radius) {
      if (this.state === "flee" || this.state === "approach") {
        this.state = "swim";
        this.target = this.pickTarget();
      }
      return;
    }
    if (reaction === "look") {
      // Só vira a cabeça: o trajeto não muda.
      this.facing = world.pointer.x >= this.x ? 1 : -1;
      return;
    }
    if (reaction === "flee") {
      this.state = "flee";
      this.target = this.shelterFrom(world);
      return;
    }
    this.state = "approach";
    const away = Math.max(distance, 0.001);
    const ring = radius * 0.4;
    this.target = this.clampPoint({
      x: world.pointer.x + ((this.x - world.pointer.x) / away) * ring,
      y: world.pointer.y + ((this.y - world.pointer.y) / away) * ring,
    });
  }

  private advanceQuirk(world: ReefWorld): void {
    if (this.state === "quirk" || this.state === "rest") {
      if (this.elapsed >= this.stateUntil) {
        // Uma manha é algo que se faz NO CAMINHO: só quem estava descansando escolhe destino novo.
        // Refazer o destino a cada manha cancelaria a travessia de quem patrulha o Recife inteiro.
        const wasResting = this.state === "rest";
        this.quirkKind = null;
        this.state = "swim";
        if (wasResting) this.target = this.pickTarget();
        this.quirkAt = this.elapsed + this.between(this.profile.quirkIntervalMs.min, this.profile.quirkIntervalMs.max);
      }
      return;
    }
    if (this.state !== "swim" && this.state !== "pause") return;
    if (this.elapsed < this.quirkAt) return;
    this.quirkKind = this.profile.quirk;
    this.quirkStartedAt = this.elapsed;
    this.stateUntil = this.elapsed + this.profile.quirkDurationMs;
    if (this.profile.quirk === "rest") {
      // Descansar é ir até um canto aconchegante e ficar lá. O relógio do descanso só começa quando
      // ela chega: senão o tempo acaba no meio do caminho e ela nunca deita perto do coral.
      const spot = this.nearestRestSpot(world);
      if (spot) this.target = this.clampPoint(spot.at);
      this.state = "rest";
      this.restArrived = spot === null;
      this.stateUntil = Number.POSITIVE_INFINITY;
      return;
    }
    this.state = "quirk";
  }

  private move(dt: number): void {
    if (this.state === "pause" || this.state === "quirk") {
      this.vx = 0;
      this.vy = 0;
      if (this.state === "pause" && this.elapsed >= this.stateUntil) {
        this.state = "swim";
        this.target = this.pickTarget();
        this.speedScale = this.jitteredSpeedScale();
      }
      return;
    }

    const seconds = dt / 1000;
    const reacting = this.state === "flee" || this.state === "approach";
    const speed = this.profile.speed * this.speedScale * (reacting ? this.profile.cursor.speedMultiplier : 1);
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= ARRIVE_EPS) {
      this.vx = 0;
      this.vy = 0;
      if (this.state === "swim") {
        this.state = "pause";
        this.stateUntil = this.elapsed + this.between(this.profile.pauseMs.min, this.profile.pauseMs.max);
      } else if (this.state === "rest" && !this.restArrived) {
        this.restArrived = true;
        this.quirkStartedAt = this.elapsed;
        this.stateUntil = this.elapsed + this.profile.quirkDurationMs;
      }
      return;
    }

    const step = Math.min(speed * seconds, distance);
    this.vx = (dx / distance) * speed;
    this.vy = (dy / distance) * speed;
    this.x = this.clamp(this.x + (dx / distance) * step, this.bounds.x, this.bounds.x + this.bounds.w);
    this.y = this.clamp(this.y + (dy / distance) * step, this.bounds.y, this.bounds.y + this.bounds.h);
    if (this.profile.facesMovement && Math.abs(this.vx) > FACING_EPS) this.facing = this.vx > 0 ? 1 : -1;
  }

  /** Um ponto dentro dos limites e do raio de perambulação, com o feitio do trajeto do perfil. */
  private pickTarget(): ReefPoint {
    const { axisBias, wanderRadius, pathStyle } = this.profile;
    const anchor = this.profile.anchor;

    // Quem patrulha atravessa o Recife de propósito: mira no lado oposto de onde está, não num ponto
    // sorteado que por acaso ficou longe. É o que dá o vaivém contínuo do tubarão e do golfinho.
    if (pathStyle === "cruise") {
      const left = this.bounds.x;
      const right = this.bounds.x + this.bounds.w;
      const middle = (left + right) / 2;
      const towardLeft = this.x > middle;
      const edge = towardLeft ? left : right;
      const margin = Math.min(wanderRadius, this.bounds.w) * 0.12;
      const spread = (this.rng.next() - 0.5) * this.bounds.h * axisBias;
      return this.clampPoint({
        x: towardLeft ? edge + margin : edge - margin,
        y: anchor.y + spread,
      });
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = this.rng.next() * TAU;
      const reach = wanderRadius * (0.35 + this.rng.next() * 0.65);
      const candidate = this.clampPoint({
        x: anchor.x + Math.cos(angle) * reach * (1 - axisBias) * 2,
        y: anchor.y + Math.sin(angle) * reach * axisBias * 2,
      });
      const leg = Math.hypot(candidate.x - this.x, candidate.y - this.y);
      if (pathStyle === "hover" && leg > 4 && attempt < 7) continue;
      if (leg <= ARRIVE_EPS && attempt < 7) continue;
      return candidate;
    }
    return this.clampPoint(anchor);
  }

  /** Para onde fugir: o abrigo mais próximo do tipo certo, ou o lado oposto ao cursor. */
  private shelterFrom(world: ReefWorld): ReefPoint {
    const kinds = this.profile.coverKinds;
    if (kinds && world.cover.length > 0) {
      const shelters = world.cover.filter((item) => kinds.includes(item.kind));
      if (shelters.length > 0) {
        let best = shelters[0];
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const shelter of shelters) {
          const distance = Math.hypot(shelter.x - this.x, shelter.y - this.y);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = shelter;
          }
        }
        return this.clampPoint({ x: best.x, y: best.y });
      }
    }
    const pointer = world.pointer;
    if (!pointer) return this.pickTarget();
    const dx = this.x - pointer.x;
    const dy = this.y - pointer.y;
    const away = Math.max(Math.hypot(dx, dy), 0.001);
    const reach = this.profile.cursor.radius * 1.6;
    return this.clampPoint({ x: this.x + (dx / away) * reach, y: this.y + (dy / away) * reach });
  }

  private nearestRestSpot(world: ReefWorld): ReefRestSpot | null {
    const wanted = this.profile.restsAt;
    const spots = wanted ? world.restSpots.filter((spot) => spot.habitat === wanted) : world.restSpots;
    if (spots.length === 0) return null;
    let best = spots[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const spot of spots) {
      const distance = Math.hypot(spot.at.x - this.x, spot.at.y - this.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = spot;
      }
    }
    return best;
  }

  private quirkProgress(): number {
    if (!this.quirkKind || this.profile.quirkDurationMs <= 0) return 0;
    return Math.max(0, Math.min(1, (this.elapsed - this.quirkStartedAt) / this.profile.quirkDurationMs));
  }

  private jitteredSpeedScale(): number {
    return 1 + (this.rng.next() * 2 - 1) * this.profile.speedJitter;
  }

  private between(min: number, max: number): number {
    return min + this.rng.next() * Math.max(0, max - min);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private clampPoint(point: ReefPoint): ReefPoint {
    return {
      x: this.clamp(point.x, this.bounds.x, this.bounds.x + this.bounds.w),
      y: this.clamp(point.y, this.bounds.y, this.bounds.y + this.bounds.h),
    };
  }
}
