import { BOSS_CURRENT } from "../../../data/balance";
import type { MatchEnemy } from "../MatchEnemy";

/**
 * Ciclo de inversão das correntes do mapa enquanto um chefe está vivo (Quebra-Marés). Um único ciclo
 * compartilhado por todos os chefes vivos; a morte de um chefe desfaz a inversão sem zerar o ciclo.
 * Na Fase 2 vira a habilidade de inimigo `reverseCurrents` declarada em dados.
 */
export class BossCurrent {
  reversed = false;
  private cycleMs = 0;
  private reverseRemainingMs = 0;

  /** Devolve a mudança ocorrida neste passo (para a apresentação avisar), ou null. */
  update(deltaMs: number, enemies: readonly MatchEnemy[]): { reversed: boolean; boss: MatchEnemy | null } | null {
    const boss = enemies.find((enemy) => enemy.definition.isBoss && !enemy.dead && !enemy.reachedGoal) ?? null;
    if (!boss) {
      this.reversed = false;
      this.cycleMs = 0;
      this.reverseRemainingMs = 0;
      return null;
    }
    if (this.reversed) {
      this.reverseRemainingMs -= deltaMs;
      if (this.reverseRemainingMs <= 0) {
        this.reversed = false;
        this.cycleMs = 0;
        return { reversed: false, boss };
      }
      return null;
    }
    this.cycleMs += deltaMs;
    if (this.cycleMs >= BOSS_CURRENT.cycleMs) {
      this.reversed = true;
      this.reverseRemainingMs = BOSS_CURRENT.reverseMs;
      return { reversed: true, boss };
    }
    return null;
  }

  /** Um chefe caiu: a corrente volta ao normal imediatamente. */
  onBossKilled(): void {
    this.reversed = false;
  }
}
