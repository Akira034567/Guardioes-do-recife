import { describe, expect, it } from "vitest";
import {
  guardianVisualState,
  strikeAnimationPhase,
  strikeFrameAt,
  textureFor,
  visualTimings,
  type GuardianVisualState,
} from "../src/game/core/GuardianVisualState";
import { scaledTimings } from "../src/game/core/GuardianStats";
import { GUARDIANS } from "../src/game/data/guardians";
import type { GuardianDefinition } from "../src/game/types";

const base = (overrides: Partial<Parameters<typeof guardianVisualState>[0]> = {}) => ({
  now: 1000,
  engineState: "idle" as const,
  strikeAt: null,
  timings: { windupMs: 150, attackMs: 300, recoveryMs: 200 },
  abilityUntilMs: 0,
  returning: false,
  trapPhase: null,
  ...overrides,
});

/**
 * Simula um ciclo inteiro do motor com um inimigo permanentemente ao alcance e devolve quanto do
 * tempo o Guardião passou visualmente em repouso.
 */
function idleShareOverCycle(definition: GuardianDefinition, cooldownMs: number): number {
  const engine = scaledTimings(definition, cooldownMs);
  const timings = visualTimings(definition, cooldownMs);
  const strikeAt = engine.windupMs;
  let idle = 0;
  const step = 5;
  for (let now = 0; now < cooldownMs; now += step) {
    const engineState = now < engine.windupMs ? "windup" : now < engine.windupMs + engine.attackMs ? "attack" : "recovery";
    const state = guardianVisualState(base({ now, engineState, strikeAt, timings }));
    if (state === "idle") idle += step;
  }
  return idle / cooldownMs;
}

describe("estado visual do Guardião", () => {
  it("descansa entre os golpes mesmo com inimigo parado no alcance", () => {
    // A queixa original: o Camarão ficava exibindo a bolha de ataque durante o cooldown inteiro,
    // porque o motor estica windup+attack+recovery para somarem exatamente o cooldown.
    const shrimp = GUARDIANS["pistol-shrimp"];
    expect(idleShareOverCycle(shrimp, shrimp.cooldownMs)).toBeGreaterThan(0.4);
  });

  it("sobra ainda mais repouso para quem ataca devagar", () => {
    // O Baiacu tem cooldown de vários segundos: a sequência visual não pode ocupar tudo isso.
    const puffer = GUARDIANS.pufferfish;
    const timings = visualTimings(puffer, puffer.cooldownMs);
    expect(timings.windupMs + timings.attackMs + timings.recoveryMs).toBeLessThanOrEqual(800);
    expect(idleShareOverCycle(puffer, puffer.cooldownMs)).toBeGreaterThan(0.75);
  });

  it("garante repouso para todo Guardião, em qualquer cooldown", () => {
    for (const definition of Object.values(GUARDIANS)) {
      const share = idleShareOverCycle(definition, definition.cooldownMs);
      expect(share, `${definition.id} descansa entre golpes`).toBeGreaterThan(0.2);
    }
  });

  it("percorre windup, ataque, recuperação e volta ao repouso", () => {
    const timings = { windupMs: 150, attackMs: 300, recoveryMs: 200 };
    const strikeAt = 1000;
    const at = (now: number): GuardianVisualState => guardianVisualState(base({ now, strikeAt, timings, engineState: "attack" }));
    expect(at(800)).toBe("idle");
    expect(at(900)).toBe("windup");
    expect(at(1000)).toBe("attack");
    expect(at(1250)).toBe("attack");
    expect(at(1400)).toBe("recovery");
    expect(at(1600)).toBe("idle");
  });

  it("nunca mostra ataque quando o golpe foi abortado", () => {
    // Alvo perdido durante o windup: `strikeAt` volta a null e a pose de ataque não chega a sair.
    expect(guardianVisualState(base({ strikeAt: null, engineState: "idle" }))).toBe("idle");
  });

  it("troca a recuperação por retorno quando o Guardião se desloca até o alvo", () => {
    const timings = { windupMs: 150, attackMs: 300, recoveryMs: 200 };
    expect(guardianVisualState(base({ now: 1400, strikeAt: 1000, timings, returning: true }))).toBe("returning");
  });

  it("dá precedência a desativado e a habilidade", () => {
    expect(guardianVisualState(base({ engineState: "disabled", strikeAt: 1000, abilityUntilMs: 9999 }))).toBe("disabled");
    expect(guardianVisualState(base({ strikeAt: 1000, abilityUntilMs: 9999 }))).toBe("ability");
  });

  it("mapeia os sete estados nas duas texturas que existem em disco", () => {
    expect(textureFor("attack")).toBe("attack");
    expect(textureFor("ability")).toBe("attack");
    for (const state of ["idle", "windup", "recovery", "returning", "disabled"] as const) {
      expect(textureFor(state), state).toBe("idle");
    }
  });

  it("percorre os quadros do golpe pela janela inteira do gesto, e o canto pela própria duração", () => {
    const timings = { windupMs: 150, attackMs: 300, recoveryMs: 200 };
    const ability = { fromMs: 0, untilMs: 0 };
    // A antecipação é o COMEÇO da sequência: a 150ms do golpe, a animação está no quadro zero.
    expect(strikeAnimationPhase("windup", 850, 1000, timings, ability)).toBe(0);
    expect(strikeAnimationPhase("attack", 1000, 1000, timings, ability)).toBeCloseTo(150 / 650);
    expect(strikeAnimationPhase("recovery", 1500, 1000, timings, ability)).toBe(1);
    // Fora da janela (repouso, desativado) manda a pose estática.
    expect(strikeAnimationPhase("idle", 1000, 1000, timings, ability)).toBeNull();
    expect(strikeAnimationPhase("attack", 1000, null, timings, ability)).toBeNull();
    // O canto tem a própria janela, que não é a do golpe.
    expect(strikeAnimationPhase("ability", 1210, null, timings, { fromMs: 1000, untilMs: 1420 })).toBeCloseTo(0.5);

    expect(strikeFrameAt(0, 10)).toBe(0);
    expect(strikeFrameAt(0.55, 10)).toBe(5);
    // A fração cheia não pode pedir um décimo-primeiro quadro.
    expect(strikeFrameAt(1, 10)).toBe(9);
  });

  it("trata o Peixe-Pedra camuflado como repouso e a abertura dos espinhos como ataque", () => {
    // V3.2: abrir os espinhos (`arming`) JÁ é a pose de ataque — é o aviso que o jogador precisa ver
    // antes do bote. Camuflado e se acomodando são repouso.
    expect(guardianVisualState(base({ trapPhase: "camouflaged", strikeAt: 1000 }))).toBe("idle");
    expect(guardianVisualState(base({ trapPhase: "settling" }))).toBe("idle");
    expect(guardianVisualState(base({ trapPhase: "arming" }))).toBe("attack");
    expect(guardianVisualState(base({ trapPhase: "striking" }))).toBe("attack");
  });
});
