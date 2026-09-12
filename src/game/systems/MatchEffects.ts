import Phaser from "phaser";
import { artTextureKey, artVariant, GUARDIAN_ART, type AbilityStyle } from "../assets/guardianArt";
import { DEPTH } from "../constants";
import type { BehaviorEvent } from "../core/GuardianBehaviors";
import type { Match } from "../core/match/Match";
import type { MatchEvent } from "../core/match/MatchEvents";
import type { MatchGuardian } from "../core/match/MatchGuardian";
import type { GuardianView } from "../objects/GuardianView";
import type { ProjectileView } from "../objects/ProjectileView";
import type { GuardianId } from "../types";
import type { ArtEffects } from "./ArtEffects";
import type { AudioManager } from "./AudioManager";

export interface MatchEffectsHost {
  readonly scene: Phaser.Scene;
  readonly match: Match;
  readonly effects: ArtEffects;
  readonly audio: AudioManager;
  guardianView(id: string): GuardianView | undefined;
  projectileView(id: string): ProjectileView | undefined;
  showMessage(text: string, durationMs: number): void;
}

/**
 * Tradução de eventos do motor em efeitos visuais, sons e mensagens. É a única camada que sabe de
 * áudio e de arte; o motor nunca chama nada daqui. Toda regra continua em `core/match`.
 */
export class MatchEffects {
  constructor(private readonly host: MatchEffectsHost) {}

  handle(event: MatchEvent): void {
    const { audio } = this.host;
    switch (event.type) {
      case "enemyDamaged":
        if (["projectile", "chain", "pulse", "melee", "spin", "ink", "sonar"].includes(event.cause)) audio.play("impact");
        if (event.cause === "poison") this.poisonPuff(event.x, event.y);
        return;
      case "enemyReachedGoal":
        audio.play("warning");
        this.host.showMessage(`${event.name} atingiu o Recife! (-${event.reefDamage})`, 1400);
        return;
      case "bossDefeated":
        this.host.showMessage(`${event.name} caiu! A corrente se estabilizou.`, 2400);
        return;
      case "currentsReversed":
        if (event.reversed) {
          audio.play("warning");
          this.host.showMessage(`${event.bossName ?? "O chefe"} inverteu a corrente!`, 2200);
        } else {
          this.host.showMessage("A corrente voltou ao fluxo normal.", 1300);
        }
        return;
      case "waveStarted":
        audio.play(event.isLast ? "warning" : "wave");
        this.host.showMessage(`Onda ${event.waveIndex + 1}: ${event.name}`, 2200);
        return;
      case "waveCompleted":
        this.host.showMessage(`Onda ${event.waveIndex + 1} vencida! +${event.bonus} pérolas`, 1800);
        return;
      case "guardianPlaced":
        audio.play("buy");
        return;
      case "guardianUpgraded":
        audio.play("upgrade");
        this.host.showMessage(`${event.optionName} adquirido! Ramo ${event.branchName}.`, 1900);
        return;
      case "guardianSold":
        audio.play("buy");
        return;
      case "guardianAttacked":
        this.attack(event);
        return;
      case "projectileFired": {
        audio.play("shot");
        const view = this.host.guardianView(event.ownerId);
        this.shockwave(event.x, event.y, view?.guardian.definition.accent ?? 0x5ae8ff, 34);
        return;
      }
      case "projectileHit": {
        if (event.splash) return;
        const projectile = this.host.projectileView(event.id);
        if (projectile) this.host.effects.burst(projectile.impactKey, event.x, event.y, { scale: projectile.impactScale });
        return;
      }
      case "fieldPulsed":
        audio.play("zap");
        this.shockwave(event.x, event.y, 0x8ff4ff, event.radius);
        return;
      case "enemyHeld": {
        const blocker = this.host.match.guardian(event.blockerId);
        const enemy = this.host.match.enemy(event.enemyId);
        this.host.showMessage(`${blocker?.definition.name ?? "O bloqueador"} segurou ${enemy?.definition.name ?? "o chefe"} por um instante!`, 1500);
        this.shockwave(event.x, event.y, 0xffe082, 50);
        return;
      }
      case "enemyReleased":
        this.shockwave(event.x, event.y, 0x8cd98a, 20);
        return;
      case "behavior":
        this.behavior(event.event);
        return;
      default:
        return;
    }
  }

  // ---------------------------------------------------------------- golpes

  private attack(event: Extract<MatchEvent, { type: "guardianAttacked" }>): void {
    const guardian = this.host.match.guardian(event.id);
    const view = this.host.guardianView(event.id);
    if (!guardian || !view) return;
    const { effects, audio } = this.host;
    const accent = guardian.definition.accent;
    switch (event.kind) {
      case "chain": {
        const targets = event.affectedIds.map((id) => this.host.match.enemy(id)).filter((enemy): enemy is NonNullable<typeof enemy> => Boolean(enemy));
        if (event.stunApplied) this.shockwave(event.targetX, event.targetY, 0xfff27a, 26);
        this.chainEffect(guardian, view, targets.map((enemy) => ({ x: enemy.x, y: enemy.y })));
        audio.play("zap");
        return;
      }
      case "area": {
        effects.ring(this.abilityKeyFor(guardian, "ring"), event.x, event.y + 8, guardian.range * 2);
        this.burstAt(view, event.affectedIds.slice(0, 4), 0.7);
        this.shockwave(event.x, event.y, accent, guardian.range);
        audio.play("pulse");
        return;
      }
      case "melee": {
        const stats = guardian.stats;
        const abilityStyle = artVariant(guardian.guardianId, guardian.progress).ability;
        if (stats.areaAttack || event.spinning) {
          effects.ring(this.abilityKeyFor(guardian, "ring"), event.x, event.y + 8, event.radius * 2, { spin: event.spinning });
        } else if (abilityStyle === "ring") {
          effects.ring(this.abilityKeyFor(guardian, "ring"), event.x, event.y + 8, guardian.range * 2, { alpha: 0.75 });
        } else {
          effects.burst(this.abilityKeyFor(guardian, "burst"), event.targetX, event.targetY, {
            scale: GUARDIAN_ART[guardian.guardianId].effectScale,
            rotation: Math.atan2(event.targetY - event.y, event.targetX - event.x),
          });
        }
        if (stats.dash) this.dashTrail(guardian, event.targetX, event.targetY);
        event.affectedIds.slice(0, 4).forEach((id) => {
          const enemy = this.host.match.enemy(id);
          if (enemy) this.impactBurst(view, enemy.x, enemy.y, id === event.targetId ? 1 : 0.7);
        });
        this.shockwave(event.x, event.y, accent, event.spinning ? event.radius : 30);
        audio.play(event.spinning ? "pulse" : "impact");
        return;
      }
      case "ink": {
        const jet = effects.beam(this.abilityKeyFor(guardian, "beam"), event.x + 14, event.y - 6, event.targetX, event.targetY, 0.5);
        if (!jet) this.inkSplash(guardian, event.targetX, event.targetY);
        // Ramo Maré Aliada: o desenho da habilidade é a onda de buff, exibida como pulso no próprio Polvo.
        if (artVariant(guardian.guardianId, guardian.progress).ability === "ring" && !guardian.stats.inkCloud) {
          effects.ring(this.abilityKeyFor(guardian, "ring"), event.x, event.y + 8, guardian.range * 2, { alpha: 0.6 });
        }
        this.impactBurst(view, event.targetX, event.targetY);
        audio.play("zap");
        return;
      }
      case "sonar": {
        const beam = effects.beam(this.abilityKeyFor(guardian, "beam"), event.x + 12, event.y - 4, event.targetX, event.targetY, 0.4);
        if (!beam) {
          const graphics = this.host.scene.add.graphics().setDepth(DEPTH.effects);
          graphics.lineStyle(2, accent, 0.8);
          graphics.lineBetween(event.x, event.y - 6, event.targetX, event.targetY);
          graphics.lineStyle(1, accent, 0.5);
          graphics.strokeCircle(event.targetX, event.targetY, 10);
          this.host.scene.tweens.add({ targets: graphics, alpha: 0, duration: 200, onComplete: () => graphics.destroy() });
        }
        this.impactBurst(view, event.targetX, event.targetY, 0.7);
        audio.play("zap");
        return;
      }
      default:
        return;
    }
  }

  /** Visual e áudio dos comportamentos compartilhados (Tubarão, Tartaruga, Peixe-Pedra, Golfinho). */
  private behavior(event: BehaviorEvent): void {
    const { scene, audio, effects } = this.host;
    const guardian = "guardianId" in event ? this.host.match.guardian(event.guardianId) : undefined;
    const view = guardian ? this.host.guardianView(guardian.id) : undefined;
    switch (event.type) {
      case "trapPhase":
        if (event.phase === "armed" && guardian) this.shockwave(guardian.x, guardian.y, 0xffd166, 22);
        return;
      case "trapTrigger": {
        if (!guardian || !view) return;
        const key = this.abilityKeyFor(guardian, "ring");
        if (!effects.ring(key, event.x, event.y + 6, event.radius * 2.4, { durationMs: 420 })) {
          const graphics = scene.add.graphics().setDepth(DEPTH.effects);
          graphics.fillStyle(0xd9b36b, 0.55);
          graphics.fillCircle(event.x, event.y, event.radius);
          graphics.lineStyle(3, 0xffd166, 0.9);
          graphics.strokeCircle(event.x, event.y, event.radius);
          scene.tweens.add({ targets: graphics, alpha: 0, scale: 1.3, duration: 380, onComplete: () => graphics.destroy() });
        }
        this.burstAt(view, event.targetIds, 0.8);
        this.shockwave(event.x, event.y, 0xffd166, event.radius * 1.4);
        audio.play("pulse");
        return;
      }
      case "mark": {
        const enemy = this.host.match.enemy(event.enemyId);
        if (enemy) this.shockwave(enemy.x, enemy.y, 0xff4d5e, 30);
        return;
      }
      case "pushWave": {
        if (!guardian) return;
        effects.ring(this.abilityKeyFor(guardian, "ring"), event.x, event.y + 6, event.radius * 2, { durationMs: event.visualMs, alpha: 0.8 });
        const surge = scene.add.circle(event.x, event.y, event.radius * 0.4).setStrokeStyle(4, 0x6fe3ff, 0.85).setDepth(DEPTH.effects);
        scene.tweens.add({ targets: surge, radius: event.radius, alpha: 0, duration: event.visualMs, ease: "Quad.Out", onComplete: () => surge.destroy() });
        event.pushedIds.forEach((id) => {
          const enemy = this.host.match.enemy(id);
          if (enemy) this.shockwave(enemy.x, enemy.y, 0x9fefff, 18);
        });
        audio.play("pulse");
        return;
      }
      case "sonarWave": {
        const color = event.wave.coordinate ? 0x9b7bff : event.wave.vulnerability ? 0xb59cff : 0x6fd6ff;
        const circle = scene.add.circle(event.x, event.y, 12).setStrokeStyle(3, color, 0.85).setDepth(DEPTH.effects);
        scene.tweens.add({ targets: circle, radius: event.radius, alpha: 0, duration: 520, ease: "Sine.Out", onComplete: () => circle.destroy() });
        if (guardian) effects.ring(this.abilityKeyFor(guardian, "ring"), event.x, event.y + 6, event.radius * 2, { alpha: 0.45, durationMs: 520 });
        if (event.wave.index === 0) audio.play("zap");
        return;
      }
      case "coordinate": {
        const target = this.host.match.enemy(event.targetId);
        if (target) this.shockwave(target.x, target.y, 0x9b7bff, 44);
        if (guardian) this.host.showMessage(`${guardian.definition.name} coordena o cardume contra ${target?.definition.name ?? "a ameaça"}!`, 1500);
        return;
      }
      case "chorusStart": {
        if (!guardian) return;
        effects.ring(this.abilityKeyFor(guardian, "ring"), guardian.x, guardian.y + 6, event.radius * 2, { alpha: 0.7, durationMs: 600 });
        const notes = scene.add.graphics().setDepth(DEPTH.effects);
        notes.lineStyle(3, 0xffd76a, 0.9);
        notes.strokeCircle(guardian.x, guardian.y, 20);
        notes.strokeCircle(guardian.x, guardian.y, 36);
        scene.tweens.add({ targets: notes, alpha: 0, duration: event.durationMs * 0.4, onComplete: () => notes.destroy() });
        audio.play("upgrade");
        return;
      }
      case "stunned": {
        const enemy = this.host.match.enemy(event.enemyId);
        if (enemy) this.shockwave(enemy.x, enemy.y, 0xfff27a, 26);
        return;
      }
      case "poisoned":
        return;
    }
  }

  // --------------------------------------------------------------- helpers

  /**
   * Imagem "Habilidade" da variante atual quando ela é exibida no estilo pedido; senão, a do primeiro
   * nível abaixo que seja (por exemplo, o raio do Elétrico I serve à descarga do Elétrico II).
   */
  abilityKeyFor(guardian: MatchGuardian, style: AbilityStyle): string | null {
    return abilityKeyForProgress(guardian.guardianId, guardian.branchId, guardian.upgradeLevel, style);
  }

  private impactBurst(view: GuardianView, x: number, y: number, factor = 1): void {
    const profile = GUARDIAN_ART[view.guardian.guardianId];
    this.host.effects.burst(view.artTexture("impact"), x, y, { scale: profile.effectScale * 0.9 * factor });
  }

  private burstAt(view: GuardianView, enemyIds: readonly string[], factor: number): void {
    enemyIds.forEach((id) => {
      const enemy = this.host.match.enemy(id);
      if (enemy) this.impactBurst(view, enemy.x, enemy.y, factor);
    });
  }

  /** Descarga da Água-viva: raio esticado até cada alvo em sequência, ou espiral sobre os alvos. */
  private chainEffect(guardian: MatchGuardian, view: GuardianView, targets: ReadonlyArray<{ x: number; y: number }>): void {
    const { effects } = this.host;
    const beamKey = this.abilityKeyFor(guardian, "beam");
    const burstKey = this.abilityKeyFor(guardian, "burst");
    let drawn = false;
    if (targets.length > 0 && effects.has(beamKey)) {
      let fromX = guardian.x;
      let fromY = guardian.y - 10;
      targets.forEach((target, index) => {
        effects.beam(beamKey, fromX, fromY, target.x, target.y, index === 0 ? 0.55 : 0.4);
        fromX = target.x;
        fromY = target.y;
      });
      drawn = true;
    } else if (effects.has(burstKey)) {
      const profile = GUARDIAN_ART[guardian.guardianId];
      targets.forEach((target, index) => {
        effects.burst(burstKey, target.x, target.y, { scale: profile.effectScale * (index === 0 ? 1 : 0.7), spin: true });
      });
      drawn = targets.length > 0;
    }
    if (!drawn) this.lightningEffect(guardian, targets);
    targets.forEach((target, index) => this.impactBurst(view, target.x, target.y, index === 0 ? 1 : 0.7));
  }

  shockwave(x: number, y: number, color: number, radius: number): void {
    const circle = this.host.scene.add.circle(x, y, 10).setStrokeStyle(4, color, 0.9).setDepth(DEPTH.effects);
    this.host.scene.tweens.add({ targets: circle, radius, alpha: 0, duration: 260, ease: "Quad.Out", onComplete: () => circle.destroy() });
  }

  /** Rastro da investida do Tubarão: afterimages entre a margem e o alvo (mais vermelhas no Frenesi). */
  private dashTrail(guardian: MatchGuardian, targetX: number, targetY: number): void {
    const frenzy = guardian.stats.frenzy !== null;
    const color = frenzy ? 0xff4d5e : 0x9fc9ff;
    const steps = frenzy ? 4 : 2;
    for (let index = 1; index <= steps; index += 1) {
      const t = index / (steps + 1);
      const x = guardian.x + (targetX - guardian.x) * t;
      const y = guardian.y + (targetY - guardian.y) * t;
      const ghost = this.host.scene.add.ellipse(x, y, 40, 14, color, 0.28 - index * 0.04).setDepth(DEPTH.effects - 1);
      ghost.setRotation(Math.atan2(targetY - guardian.y, targetX - guardian.x));
      this.host.scene.tweens.add({ targets: ghost, alpha: 0, scaleX: 0.6, duration: 260 + index * 40, onComplete: () => ghost.destroy() });
    }
  }

  private poisonPuff(x: number, y: number): void {
    const puff = this.host.scene.add.circle(x + 6, y - 10, 4, 0x8ef26b, 0.7).setDepth(DEPTH.effects);
    this.host.scene.tweens.add({ targets: puff, y: y - 26, alpha: 0, duration: 420, onComplete: () => puff.destroy() });
  }

  private lightningEffect(guardian: MatchGuardian, targets: ReadonlyArray<{ x: number; y: number }>): void {
    const graphics = this.host.scene.add.graphics().setDepth(DEPTH.effects);
    graphics.lineStyle(4, guardian.definition.accent, 0.92);
    let fromX = guardian.x;
    let fromY = guardian.y;
    targets.forEach((target) => {
      graphics.lineBetween(fromX, fromY, target.x, target.y);
      fromX = target.x;
      fromY = target.y;
    });
    this.host.scene.tweens.add({ targets: graphics, alpha: 0, duration: 170, onComplete: () => graphics.destroy() });
  }

  private inkSplash(guardian: MatchGuardian, targetX: number, targetY: number): void {
    const graphics = this.host.scene.add.graphics().setDepth(DEPTH.effects);
    graphics.lineStyle(3, guardian.definition.color, 0.85);
    graphics.lineBetween(guardian.x, guardian.y - 10, targetX, targetY);
    graphics.fillStyle(0x2a1a4a, 0.6);
    graphics.fillCircle(targetX, targetY, 14);
    this.host.scene.tweens.add({ targets: graphics, alpha: 0, duration: 220, onComplete: () => graphics.destroy() });
  }
}

/** Chave da imagem "Habilidade" mais próxima do progresso atual que use o estilo pedido. */
export function abilityKeyForProgress(guardianId: GuardianId, branchId: "a" | "b" | null, upgradeLevel: number, style: AbilityStyle): string | null {
  for (let level = upgradeLevel; level >= 0; level -= 1) {
    const variant = artVariant(guardianId, { branchId, upgradeLevel: level });
    if (variant.ability === style) return artTextureKey(guardianId, variant, "projectile");
  }
  return null;
}
