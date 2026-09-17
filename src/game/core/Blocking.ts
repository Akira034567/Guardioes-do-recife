import { hasReachedBlockerContact } from "./Combat";
import { BLOCKER_BODY_RADIUS, controlTier, type ControlTarget } from "./CrowdControl";
import type { GuardianStats } from "./GuardianStats";

/** O que o bloqueio precisa de um Guardião da correnteza. */
export interface BlockerLike {
  id: string;
  /** Distância ao longo da rota; unidades fora dela (null) nunca bloqueiam. */
  routeDistance: number | null;
  stats: Pick<GuardianStats, "blocks" | "blockCapacity" | "contactDamagePerSecond" | "bossHold" | "blockHold" | "controlDurationMultiplier">;
}

export interface BlockableEnemy extends ControlTarget {
  isBlockable: boolean;
  setBlocked(blockerId: string, stopDistance: number): void;
}

export interface BlockingHooks<E extends BlockableEnemy, B extends BlockerLike> {
  /** Dano contínuo de contato (ignora armadura). */
  damage(enemy: E, amount: number): void;
  /** Um chefe acabou de ser pausado (Fortaleza). */
  onBossHeld?(blocker: B, enemy: E): void;
  /** Um inimigo foi solto pelo bloqueio temporário (Tartaruga). */
  onReleased?(blocker: B, enemy: E): void;
}

interface Grab {
  grabbedAt: number;
}

/**
 * Bloqueio de rota compartilhado por cena e simulação. Reproduz o Baiacu (segura até a capacidade,
 * dano de contato, pausa de chefe) e acrescenta o bloqueio temporário da Tartaruga (`blockHold`):
 * cada inimigo fica preso por `durationMs`, depois é solto e ignorado por `releaseCooldownMs`;
 * elites ocupam `eliteSlots` vagas; chefes só sofrem `bossSlow` enquanto encostam.
 */
export class BlockingSystem {
  private readonly grabs = new Map<string, Grab>();
  private readonly releasedUntil = new Map<string, number>();

  update<E extends BlockableEnemy, B extends BlockerLike>(
    blockers: readonly B[],
    enemies: readonly E[],
    now: number,
    deltaMs: number,
    hooks: BlockingHooks<E, B>,
  ): void {
    const active = blockers.filter((blocker) => blocker.stats.blocks && blocker.routeDistance !== null);
    const blockerIds = new Set(active.map((blocker) => blocker.id));
    enemies.forEach((enemy) => {
      if (enemy.blockedById && !blockerIds.has(enemy.blockedById)) enemy.clearBlocked();
    });

    for (const blocker of active) {
      const stats = blocker.stats;
      const anchor = blocker.routeDistance as number;
      const hold = stats.blockHold;
      const holdMs = hold ? hold.durationMs * stats.controlDurationMultiplier : Number.POSITIVE_INFINITY;
      const weight = (enemy: E): number => (hold && controlTier(enemy.definition) === "elite" ? hold.eliteSlots : 1);

      // Quem já está preso: solta quem estourou o tempo e quem não cabe mais na capacidade.
      const held: E[] = [];
      let used = 0;
      for (const enemy of enemies) {
        if (enemy.blockedById !== blocker.id || enemy.dead || enemy.reachedGoal) continue;
        const key = this.key(blocker.id, enemy.id);
        const grab = this.grabs.get(key);
        if (hold && grab && now - grab.grabbedAt >= holdMs) {
          this.release(blocker, enemy, now, hooks);
          continue;
        }
        if (used + weight(enemy) > stats.blockCapacity) {
          enemy.clearBlocked();
          this.grabs.delete(key);
          continue;
        }
        used += weight(enemy);
        held.push(enemy);
      }

      /**
       * Quem está ENCOSTANDO nele, preso ou não.
       *
       * V3.1: o dano de contato é do CORPO do Baiacu, não do agarrão. Antes só quem estava preso se
       * machucava, então um Baiacu lotado — ou em recarga depois de soltar — virava enfeite enquanto a
       * fila passava raspando nos espinhos. A janela de contato é curta por natureza, então passar de
       * raspão custa uma fração de segundo de dano e ficar preso custa o fluxo inteiro: o dano por
       * inimigo continua saindo do tempo que ele passa encostado.
       */
      const touching = enemies.filter(
        (enemy) =>
          !enemy.dead &&
          !enemy.reachedGoal &&
          hasReachedBlockerContact(enemy.pathDistance, anchor, BLOCKER_BODY_RADIUS + enemy.definition.hitRadius),
      );
      if (stats.contactDamagePerSecond > 0) {
        for (const enemy of touching) hooks.damage(enemy, stats.contactDamagePerSecond * (deltaMs / 1000));
      }

      const inContact = touching.filter((enemy) => !enemy.blockedById);
      const candidates = inContact
        .filter((enemy) => enemy.isBlockable && !this.isReleased(blocker.id, enemy.id, now))
        .sort((first, second) => second.pathDistance - first.pathDistance);
      for (const enemy of candidates) {
        if (used + weight(enemy) > stats.blockCapacity) continue;
        used += weight(enemy);
        held.push(enemy);
      }

      for (const enemy of held) {
        enemy.setBlocked(blocker.id, enemy.pathDistance);
        const key = this.key(blocker.id, enemy.id);
        if (!this.grabs.has(key)) this.grabs.set(key, { grabbedAt: now });
      }

      // Chefes não são bloqueados: a Fortaleza pausa por pouco tempo; a Tartaruga só desacelera.
      inContact
        .filter((enemy) => !enemy.isBlockable)
        .forEach((enemy) => {
          if (stats.bossHold && enemy.status.tryHold(stats.bossHold.durationMs * stats.controlDurationMultiplier, stats.bossHold.immunityMs, now)) {
            hooks.onBossHeld?.(blocker, enemy);
          }
          if (hold) enemy.status.applySlow(hold.bossSlow.factor, hold.bossSlow.durationMs * stats.controlDurationMultiplier, now);
        });
    }
  }

  /** Marca que o inimigo saiu do bloqueio por fora (knockback): não pode ser re-agarrado já. */
  notifyEscaped(blockerId: string, enemyId: string, now: number, cooldownMs: number): void {
    this.grabs.delete(this.key(blockerId, enemyId));
    this.releasedUntil.set(this.key(blockerId, enemyId), now + cooldownMs);
  }

  /** Esquece um bloqueador vendido. */
  forget(blockerId: string): void {
    for (const key of [...this.grabs.keys()]) if (key.startsWith(`${blockerId}|`)) this.grabs.delete(key);
    for (const key of [...this.releasedUntil.keys()]) if (key.startsWith(`${blockerId}|`)) this.releasedUntil.delete(key);
  }

  /** Há quanto tempo o inimigo está preso neste bloqueador (para debug/visual). */
  heldSince(blockerId: string, enemyId: string): number | null {
    return this.grabs.get(this.key(blockerId, enemyId))?.grabbedAt ?? null;
  }

  private release<E extends BlockableEnemy, B extends BlockerLike>(blocker: B, enemy: E, now: number, hooks: BlockingHooks<E, B>): void {
    const hold = blocker.stats.blockHold;
    enemy.clearBlocked();
    this.grabs.delete(this.key(blocker.id, enemy.id));
    if (hold) this.releasedUntil.set(this.key(blocker.id, enemy.id), now + hold.releaseCooldownMs);
    hooks.onReleased?.(blocker, enemy);
  }

  private isReleased(blockerId: string, enemyId: string, now: number): boolean {
    const until = this.releasedUntil.get(this.key(blockerId, enemyId));
    if (until === undefined) return false;
    if (now >= until) {
      this.releasedUntil.delete(this.key(blockerId, enemyId));
      return false;
    }
    return true;
  }

  private key(blockerId: string, enemyId: string): string {
    return `${blockerId}|${enemyId}`;
  }
}
