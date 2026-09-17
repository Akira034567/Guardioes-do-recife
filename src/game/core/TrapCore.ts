import type { TrapEffect } from "../types";

/**
 * Fases da emboscada do Peixe-Pedra.
 *
 * `settling` só acontece UMA vez, ao ser colocado: é ele se acomodando na pedra e sumindo no cenário.
 * Daí em diante o ciclo é fechado — `camouflaged → arming → striking → cooldown → camouflaged` — e
 * repete a partida inteira.
 */
export type AmbushPhase = "settling" | "camouflaged" | "arming" | "striking" | "cooldown";

/** Nome antigo, mantido para não quebrar quem importava o tipo. */
export type TrapPhase = AmbushPhase;

export type TrapEvent = { type: "strike"; focused: boolean } | { type: "phase"; phase: AmbushPhase };

/** Quanto tempo os espinhos ficam abertos depois do bote (janela visual do golpe). */
export const TRAP_TRIGGER_MS = 450;

/**
 * Máquina de estados da emboscada, sem Phaser.
 *
 * V3.2, a mudança de identidade: ele não é mais uma mina que explode e morre. Fica camuflado, e no
 * instante em que alguém entra na zona abre os espinhos (`arming`), dá o bote (`striking`), recolhe e
 * volta a se camuflar. A recarga é curta de propósito — a pergunta que ele faz ao jogador deixou de
 * ser "quando vai valer a pena gastar a armadilha" e passou a ser "onde nessa rota os inimigos vão
 * se agrupar".
 *
 * O bote é COMPROMETIDO: depois que os espinhos começam a abrir, ele sai mesmo que o alvo escape. É o
 * que dá peso à leitura do jogador, e o que diferencia uma emboscada de um tiro teleguiado.
 */
export class TrapCore {
  private currentPhase: AmbushPhase = "settling";
  private phaseUntil: number;
  /** Desde quando está camuflado sem atacar. A maestria B2 (Paciência Mortal) lê isto. */
  private camouflagedSince = 0;
  /** O bote em curso travou um alvo forte (Caçador da Corrente)? */
  private focusedStrike = false;

  constructor(
    private config: TrapEffect,
    now = 0,
  ) {
    this.phaseUntil = now + config.settleMs;
  }

  get phase(): AmbushPhase {
    return this.currentPhase;
  }

  get phaseEndsAt(): number {
    return this.phaseUntil;
  }

  /** Está escondido? A apresentação usa para deixá-lo translúcido e parecido com pedra. */
  get hidden(): boolean {
    return this.currentPhase === "settling" || this.currentPhase === "camouflaged";
  }

  /** Upgrade comprado: novos tempos, mesma fase. */
  setConfig(config: TrapEffect): void {
    this.config = config;
  }

  /** Há quanto tempo ele está parado, camuflado, sem dar o bote. */
  patienceMs(now: number): number {
    return this.currentPhase === "camouflaged" ? Math.max(0, now - this.camouflagedSince) : 0;
  }

  /**
   * `focusTarget`: há um alvo forte na zona para travar (Caçador da Corrente). Quando existe, o
   * tempo de armar cai para o do `focus` — os espinhos carregam muito mais rápido.
   */
  update(now: number, enemiesInZone: number, options: { focusTarget?: boolean; rearmMultiplier?: number } = {}): TrapEvent[] {
    const rearmMultiplier = options.rearmMultiplier ?? 1;
    const events: TrapEvent[] = [];
    switch (this.currentPhase) {
      case "settling":
        if (now >= this.phaseUntil) {
          this.camouflagedSince = now;
          events.push(this.enter("camouflaged", Number.POSITIVE_INFINITY));
        }
        break;
      case "camouflaged": {
        if (enemiesInZone <= 0) break;
        const focused = Boolean(options.focusTarget && this.config.focus);
        this.focusedStrike = focused;
        const armMs = focused && this.config.focus ? this.config.focus.armMs : this.config.armMs;
        events.push(this.enter("arming", now + armMs));
        break;
      }
      case "arming":
        // Comprometido: sai o bote mesmo que a zona tenha esvaziado no meio da abertura.
        if (now >= this.phaseUntil) {
          events.push({ type: "strike", focused: this.focusedStrike });
          events.push(this.enter("striking", now + TRAP_TRIGGER_MS));
        }
        break;
      case "striking":
        if (now >= this.phaseUntil) events.push(this.enter("cooldown", now + this.config.cooldownMs * rearmMultiplier));
        break;
      case "cooldown":
        if (now >= this.phaseUntil) {
          this.camouflagedSince = now;
          this.focusedStrike = false;
          events.push(this.enter("camouflaged", Number.POSITIVE_INFINITY));
        }
        break;
    }
    return events;
  }

  private enter(phase: AmbushPhase, until: number): TrapEvent {
    this.currentPhase = phase;
    this.phaseUntil = until;
    return { type: "phase", phase };
  }
}

/**
 * Dano do bote contra um alvo, já com o bônus de Caçador da Corrente.
 *
 * O bônus é proporcional à VIDA MÁXIMA do alvo e tem teto: sem o teto, um chefe com 1600 de vida
 * cairia num bote só, que é exatamente o que essa mecânica não pode fazer. Contra um comum de 90 o
 * bônus é irrelevante; contra um Cascudo ou uma Moreia ele é o motivo de existir.
 */
export function focusedDamage(base: number, focus: TrapEffect["focus"], targetMaxHealth: number): number {
  if (!focus) return base;
  return base + Math.min(focus.maxBonus, targetMaxHealth * focus.bonusPerMaxHealth);
}
