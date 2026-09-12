import { describe, expect, it } from "vitest";
import { InteractableSystem } from "../src/game/core/Interactables";
import type { InteractableDefinition } from "../src/game/types";

const net: InteractableDefinition = {
  id: "rede",
  x: 100,
  y: 100,
  label: "Rede fantasma",
  goal: { type: "taps", taps: 5, cooldownMs: 800 },
};

const cave: InteractableDefinition = {
  id: "gruta",
  x: 300,
  y: 200,
  label: "Gruta",
  goal: { type: "guardNearby", radius: 150, durationMs: 10_000 },
};

const guarded: InteractableDefinition = {
  id: "guarda",
  x: 400,
  y: 300,
  label: "Moreia",
  goal: { type: "enemyDefeated", enemyId: "moray", count: 2 },
};

const context = (guardians: Array<{ x: number; y: number }> = [], deltaMs = 1000, wave = 1) => ({ wave, guardians, deltaMs });

describe("interactables", () => {
  it("corta a rede em toques espaçados", () => {
    const system = new InteractableSystem([net]);
    expect(system.interact("rede", 0)).toEqual({ ok: true, completed: false, progress: 0.2 });
    // Toque cedo demais não conta: a rede precisa de fôlego entre os cortes.
    expect(system.interact("rede", 500)).toEqual({ ok: false, reason: "cooldown" });
    expect(system.interact("rede", 800).ok).toBe(true);
    expect(system.interact("rede", 1600).ok).toBe(true);
    expect(system.interact("rede", 2400).ok).toBe(true);
    const last = system.interact("rede", 3200);
    expect(last).toEqual({ ok: true, completed: true, progress: 1 });
    expect(system.get("rede")?.state).toBe("done");
    expect(system.interact("rede", 4000)).toEqual({ ok: false, reason: "done" });
    expect(system.completed()).toEqual(["rede"]);
  });

  it("acumula o tempo com um Guardião por perto e guarda o progresso quando ele sai", () => {
    const system = new InteractableSystem([cave]);
    expect(system.tick(0, context([{ x: 320, y: 210 }], 4000))).toEqual([]);
    expect(system.get("gruta")?.progress).toBeCloseTo(0.4);
    // Guardião longe: o progresso para, mas não volta a zero.
    system.tick(4000, context([{ x: 900, y: 600 }], 3000));
    expect(system.get("gruta")?.progress).toBeCloseTo(0.4);
    const finished = system.tick(7000, context([{ x: 300, y: 200 }], 6000));
    expect(finished.map((runtime) => runtime.definition.id)).toEqual(["gruta"]);
    expect(system.get("gruta")?.state).toBe("done");
  });

  it("não deixa tocar no que só se resolve com um Guardião perto", () => {
    const system = new InteractableSystem([cave]);
    expect(system.interact("gruta", 0)).toEqual({ ok: false, reason: "notTappable" });
  });

  it("conta os inimigos que guardam o lugar", () => {
    const system = new InteractableSystem([guarded]);
    expect(system.onEnemyKilled("swimmer")).toEqual([]);
    expect(system.onEnemyKilled("moray")).toEqual([]);
    expect(system.get("guarda")?.progress).toBeCloseTo(0.5);
    const finished = system.onEnemyKilled("moray");
    expect(finished.map((runtime) => runtime.definition.id)).toEqual(["guarda"]);
    // Depois de concluído, mais mortes não mudam nada.
    expect(system.onEnemyKilled("moray")).toEqual([]);
  });

  it("segura o interagível até a onda combinada", () => {
    const system = new InteractableSystem([{ ...net, availableFromWave: 3 }]);
    expect(system.get("rede")?.state).toBe("locked");
    expect(system.interact("rede", 0)).toEqual({ ok: false, reason: "locked" });
    system.tick(0, context([], 100, 2));
    expect(system.get("rede")?.state).toBe("locked");
    system.tick(100, context([], 100, 3));
    expect(system.get("rede")?.state).toBe("available");
    expect(system.interact("rede", 200).ok).toBe(true);
  });

  it("resolve o segredo em um toque só", () => {
    const system = new InteractableSystem([{ id: "pedra", x: 10, y: 10, label: "Pedra", goal: { type: "reveal" }, secretId: "pedra-que-pisca" }]);
    expect(system.interact("pedra", 0)).toEqual({ ok: true, completed: true, progress: 1 });
  });

  it("um id desconhecido nunca derruba a partida", () => {
    const system = new InteractableSystem([net]);
    expect(system.interact("nao-existe", 0)).toEqual({ ok: false, reason: "notFound" });
    expect(new InteractableSystem().isEmpty).toBe(true);
  });
});
