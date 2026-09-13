import type { GuardianDefinition, GuardianState } from "../types";
import type { TrapPhase } from "./TrapCore";
import { GUARDIAN_VISUAL } from "../data/balance";

/**
 * Estado VISUAL do Guardião (item 15). Nada aqui muda regra: dano, alcance e cooldown continuam
 * inteiramente no motor.
 *
 * O problema que isto resolve: `scaledTimings()` estica windup + attack + recovery para somarem
 * EXATAMENTE o `cooldownMs`, e a view mapeava os três para a mesma textura de ataque. Com um
 * inimigo parado no alcance, o Guardião nunca voltava ao repouso — o Camarão ficava com a bolha de
 * ataque na tela os 1,2s inteiros, o Baiacu os 4s inteiros.
 *
 * A saída é ancorar a animação no INSTANTE DO GOLPE e desenhar uma janela curta em volta dele. O
 * resto do ciclo, recuperação e espera, é repouso — que é o que o jogador espera ver.
 */
export type GuardianVisualState = "idle" | "windup" | "attack" | "recovery" | "ability" | "returning" | "disabled";

export interface VisualTimings {
  windupMs: number;
  attackMs: number;
  recoveryMs: number;
}

export interface VisualInput {
  now: number;
  /** Estado do motor, para `disabled` e para saber quando o golpe foi cancelado. */
  engineState: GuardianState;
  /** Quando o motor entrou (ou vai entrar) em `attack`. `null` = não há golpe em curso. */
  strikeAt: number | null;
  timings: VisualTimings;
  /** Até quando a pose de habilidade vale (pulso, sonar, coro). */
  abilityUntilMs: number;
  /** Guardião que se desloca até o alvo (Tubarão) está voltando para o posto. */
  returning: boolean;
  trapPhase: TrapPhase | null;
}

/**
 * Quanto tempo cada pose pode ocupar. Vem de `definition.animation.states` — que até agora era dado
 * morto, só o `impactAtMs` era lido — com dois tetos por cima: um absoluto, e um proporcional ao
 * cooldown, para que SEMPRE sobre repouso visível por mais rápido que o Guardião ataque.
 */
export function visualTimings(definition: GuardianDefinition, cooldownMs: number): VisualTimings {
  const states = definition.animation.states;
  const windupMs = Math.min(states.windup.durationMs, GUARDIAN_VISUAL.maxWindupMs);
  const attackMs = Math.min(states.attack.durationMs, GUARDIAN_VISUAL.maxAttackMs);
  const recoveryMs = Math.min(states.recovery.durationMs, GUARDIAN_VISUAL.maxRecoveryMs);
  const total = windupMs + attackMs + recoveryMs;
  const ceiling = Math.max(1, cooldownMs) * GUARDIAN_VISUAL.maxCycleFraction;
  if (total <= ceiling) return { windupMs, attackMs, recoveryMs };
  const squeeze = ceiling / total;
  return { windupMs: windupMs * squeeze, attackMs: attackMs * squeeze, recoveryMs: recoveryMs * squeeze };
}

export function guardianVisualState(input: VisualInput): GuardianVisualState {
  if (input.engineState === "disabled") return "disabled";
  if (input.now < input.abilityUntilMs) return "ability";
  if (input.trapPhase) {
    // Armadilha: enterrada é repouso; disparada e esfriando são a pose de ataque.
    return input.trapPhase === "triggered" || input.trapPhase === "cooldown" ? "attack" : "idle";
  }
  if (input.strikeAt === null) return "idle";
  const since = input.now - input.strikeAt;
  if (since < -input.timings.windupMs) return "idle";
  if (since < 0) return "windup";
  if (since < input.timings.attackMs) return "attack";
  if (since < input.timings.attackMs + input.timings.recoveryMs) return input.returning ? "returning" : "recovery";
  // Passou a janela: o cooldown continua correndo no motor, mas visualmente já é repouso.
  return "idle";
}

/** As duas texturas que existem em disco. `windup` e `recovery` ficam legíveis por tween, não por arte. */
export function textureFor(state: GuardianVisualState): "idle" | "attack" {
  return state === "attack" || state === "ability" ? "attack" : "idle";
}
