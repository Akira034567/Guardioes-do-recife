import { describe, expect, it } from "vitest";
import { focusedDamage, TRAP_TRIGGER_MS, TrapCore } from "../src/game/core/TrapCore";
import { GUARDIANS } from "../src/game/data/guardians";
import type { TrapEffect } from "../src/game/types";

const base: TrapEffect = GUARDIANS.stonefish.trap!;
const predator: TrapEffect = GUARDIANS.stonefish.branches[1].upgrades[1].trap!;

describe("ciclo da emboscada", () => {
  it("acomoda uma vez, camufla, e só abre os espinhos quando alguém entra", () => {
    const core = new TrapCore(base, 0);
    expect(core.phase).toBe("settling");
    expect(core.hidden, "acomodando também é estar escondido").toBe(true);

    // Enquanto se acomoda, inimigo na zona não muda nada.
    expect(core.update(base.settleMs - 1, 3)).toEqual([]);
    expect(core.update(base.settleMs, 0)).toEqual([{ type: "phase", phase: "camouflaged" }]);
    expect(core.hidden).toBe(true);

    // Camuflado e sozinho: continua parado, acumulando paciência.
    expect(core.update(base.settleMs + 500, 0)).toEqual([]);
    expect(core.patienceMs(base.settleMs + 500)).toBe(500);

    // Chegou alguém: abre os espinhos. O bote ainda NÃO saiu.
    const seen = base.settleMs + 600;
    expect(core.update(seen, 1)).toEqual([{ type: "phase", phase: "arming" }]);
    expect(core.hidden, "de espinhos abertos ele está à mostra").toBe(false);
    expect(core.update(seen + base.armMs - 1, 1)).toEqual([]);

    const events = core.update(seen + base.armMs, 1);
    expect(events[0]).toEqual({ type: "strike", focused: false });
    expect(events[1]).toEqual({ type: "phase", phase: "striking" });
  });

  it("o bote é comprometido: sai mesmo se a presa escapar durante a abertura", () => {
    const core = new TrapCore(base, 0);
    core.update(base.settleMs, 0);
    const seen = base.settleMs + 10;
    core.update(seen, 1);
    // A zona esvaziou no meio da abertura — e ele sai assim mesmo.
    const events = core.update(seen + base.armMs, 0);
    expect(events[0]).toMatchObject({ type: "strike" });
  });

  it("fecha o ciclo e volta a emboscar: recarga, camuflagem e bote de novo", () => {
    const core = new TrapCore(base, 0);
    core.update(base.settleMs, 0);
    const seen = base.settleMs + 10;
    core.update(seen, 1);
    const struckAt = seen + base.armMs;
    core.update(struckAt, 1);
    expect(core.phase).toBe("striking");

    const cooldownAt = struckAt + TRAP_TRIGGER_MS;
    expect(core.update(cooldownAt, 1)).toEqual([{ type: "phase", phase: "cooldown" }]);
    const readyAt = cooldownAt + base.cooldownMs;
    expect(core.update(readyAt - 1, 1)).toEqual([]);
    expect(core.update(readyAt, 0)).toEqual([{ type: "phase", phase: "camouflaged" }]);

    // E emboscar de novo — a armadilha antiga morria aqui.
    expect(core.update(readyAt + 1, 1)).toEqual([{ type: "phase", phase: "arming" }]);
  });

  it("aplica o multiplicador de rearme na recarga", () => {
    const core = new TrapCore(base, 0);
    core.update(base.settleMs, 0);
    core.update(base.settleMs + 10, 1);
    const struckAt = base.settleMs + 10 + base.armMs;
    core.update(struckAt, 1, { rearmMultiplier: 0.5 });
    const cooldownAt = struckAt + TRAP_TRIGGER_MS;
    core.update(cooldownAt, 0, { rearmMultiplier: 0.5 });
    expect(core.phase).toBe("cooldown");
    expect(core.phaseEndsAt).toBeCloseTo(cooldownAt + base.cooldownMs * 0.5);
  });
});

describe("Caçador da Corrente", () => {
  it("carrega mais rápido quando trava uma presa", () => {
    const core = new TrapCore(predator, 0);
    core.update(predator.settleMs, 0);
    const seen = predator.settleMs + 10;
    core.update(seen, 1, { focusTarget: true });
    // Com alvo travado o tempo de abertura é o do `focus`, bem menor que o normal.
    expect(predator.focus!.armMs).toBeLessThan(predator.armMs);
    expect(core.update(seen + predator.focus!.armMs, 1)[0]).toEqual({ type: "strike", focused: true });
  });

  it("cobra pela vida máxima do alvo, com teto para o chefe não cair num bote", () => {
    const focus = predator.focus!;
    // Contra um comum o bônus é ruído; contra um Cascudo pesa; contra um chefe o teto segura.
    expect(focusedDamage(100, focus, 90)).toBeCloseTo(109);
    expect(focusedDamage(100, focus, 210)).toBeCloseTo(121);
    expect(focusedDamage(100, focus, 1601)).toBeCloseTo(100 + focus.maxBonus);
    // Sem foco declarado, nada muda.
    expect(focusedDamage(100, undefined, 1601)).toBe(100);
  });
});
