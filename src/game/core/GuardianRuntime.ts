import { AbilityCooldown } from "./AbilityCooldown";
import { ChorusState } from "./Chorus";
import type { GuardianStats } from "./GuardianStats";
import { SonarCore } from "./Sonar";
import { StatusContainer } from "./StatusEffects";
import { TrapCore } from "./TrapCore";

/** Chaves de recarga por habilidade: cada Guardião pode ter várias ao mesmo tempo. */
export type AbilityKey = "electricField" | "inkCloud" | "mark" | "pushWave";

/**
 * Estado por unidade que não cabe nos stats (recargas, máquinas de estado, alvo coordenado, presa).
 * Cena e simulação guardam um por Guardião e descartam na venda.
 */
export class GuardianRuntime {
  private readonly cooldowns = new Map<AbilityKey, AbilityCooldown>();
  /** Buffs e debuffs recebidos pelo Guardião (velocidade de ataque, dano, interferência de inimigos). */
  readonly status = new StatusContainer("guardian");
  trap: TrapCore | null = null;
  sonar: SonarCore | null = null;
  chorus: ChorusState | null = null;
  /** Alvo coordenado pelo Sonar II. */
  preferredTarget: { id: string; until: number } | null = null;
  /** Presa marcada (Alfa) e acúmulo de golpes seguidos nela. */
  preyId: string | null = null;
  preyStacks = 0;
  lastHitId: string | null = null;
  /** Bônus de velocidade de ataque em vigor (Frenesi). */
  attackSpeedBonus = 0;

  cooldown(key: AbilityKey): AbilityCooldown {
    let cooldown = this.cooldowns.get(key);
    if (!cooldown) {
      cooldown = new AbilityCooldown();
      this.cooldowns.set(key, cooldown);
    }
    return cooldown;
  }

  preferredTargetId(now: number): string | null {
    if (this.preferredTarget && now >= this.preferredTarget.until) this.preferredTarget = null;
    return this.preferredTarget?.id ?? null;
  }

  /** Cria ou atualiza as máquinas de estado conforme os stats atuais (na compra e a cada upgrade). */
  syncStats(stats: GuardianStats, now: number): void {
    if (stats.trap) {
      if (this.trap) this.trap.setConfig(stats.trap);
      else this.trap = new TrapCore(stats.trap, now);
    } else {
      this.trap = null;
    }
    if (stats.sonar) {
      if (this.sonar) this.sonar.setConfig(stats.sonar);
      else this.sonar = new SonarCore(stats.sonar);
    } else {
      this.sonar = null;
    }
    if (stats.chorus) {
      if (this.chorus) this.chorus.setConfig(stats.chorus);
      else this.chorus = new ChorusState(stats.chorus);
    } else {
      this.chorus = null;
    }
    if (!stats.mark) {
      this.preyId = null;
      this.preyStacks = 0;
    }
  }
}
