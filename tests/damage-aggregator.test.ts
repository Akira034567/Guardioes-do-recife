import { describe, expect, it } from "vitest";
import { DamageAggregator } from "../src/game/core/DamageAggregator";

describe("damage aggregator", () => {
  it("soma os acertos do mesmo alvo dentro da janela", () => {
    const aggregator = new DamageAggregator({ windowMs: 200 });
    aggregator.add("e1", 10, 10, 4, 0);
    aggregator.add("e1", 12, 11, 3, 80);
    aggregator.add("e1", 14, 12, 5, 150);
    expect(aggregator.flush(190)).toEqual([]);
    const [entry] = aggregator.flush(200);
    expect(entry.amount).toBe(12);
    // A posição acompanha o último acerto: o inimigo se move enquanto apanha.
    expect(entry.x).toBe(14);
    expect(aggregator.pendingCount).toBe(0);
  });

  it("mantém uma conta por alvo", () => {
    const aggregator = new DamageAggregator({ windowMs: 100 });
    aggregator.add("e1", 0, 0, 5, 0);
    aggregator.add("e2", 50, 0, 9, 0);
    const flushed = aggregator.flush(100).sort((a, b) => a.amount - b.amount);
    expect(flushed.map((entry) => entry.key)).toEqual(["e1", "e2"]);
    expect(flushed.map((entry) => entry.amount)).toEqual([5, 9]);
  });

  it("guarda o tom e a fatia do golpe mais forte", () => {
    const aggregator = new DamageAggregator({ windowMs: 100 });
    aggregator.add("e1", 0, 0, 2, 0, "poison", 0.02);
    aggregator.add("e1", 0, 0, 40, 10, "hit", 0.4);
    aggregator.add("e1", 0, 0, 1, 20, "area", 0.01);
    const [entry] = aggregator.flush(100);
    expect(entry.amount).toBe(43);
    expect(entry.tone).toBe("hit");
    expect(entry.share).toBeCloseTo(0.4);
  });

  it("ignora dano zero ou negativo", () => {
    const aggregator = new DamageAggregator();
    aggregator.add("e1", 0, 0, 0, 0);
    aggregator.add("e1", 0, 0, -5, 0);
    expect(aggregator.pendingCount).toBe(0);
  });

  it("descarta o alvo mais antigo quando estoura o teto", () => {
    const aggregator = new DamageAggregator({ windowMs: 500, maxPending: 3 });
    ["a", "b", "c", "d"].forEach((key, index) => aggregator.add(key, index, 0, 1, 0));
    expect(aggregator.pendingCount).toBe(3);
    expect(aggregator.flush(500).map((entry) => entry.key)).toEqual(["b", "c", "d"]);
  });

  it("entrega a conta pendente de um alvo antes do prazo (morte)", () => {
    const aggregator = new DamageAggregator({ windowMs: 400 });
    aggregator.add("e1", 5, 5, 7, 0);
    const taken = aggregator.take("e1");
    expect(taken?.amount).toBe(7);
    expect(aggregator.take("e1")).toBeNull();
    expect(aggregator.flush(1000)).toEqual([]);
  });
});
