import { describe, expect, it } from "vitest";
import { masteryLevelOf, masteryPowerPercent, NEUTRAL_MASTERY, resolveMastery } from "../src/game/core/progression/mastery";
import { resolveGuardianStats } from "../src/game/core/GuardianStats";
import { MASTERY, MASTERY_COSTS, MASTERY_MAX_LEVEL, MASTERY_ORDER, masteryNextCost, masteryTotalCost } from "../src/game/data/mastery";
import { GOLDEN_FISH } from "../src/game/data/goldenFish";
import { GUARDIANS, GUARDIAN_ORDER } from "../src/game/data/guardians";
import type { GuardianId } from "../src/game/types";

describe("catálogo de maestria", () => {
  it("cobre os nove Guardiões com quatro nós pequenos e um nó final", () => {
    expect(MASTERY_ORDER).toEqual(GUARDIAN_ORDER);
    for (const guardianId of MASTERY_ORDER) {
      const tree = MASTERY[guardianId];
      expect(tree.guardianId).toBe(guardianId);
      expect(tree.nodes.map((node) => node.level)).toEqual([1, 2, 3, 4]);
      expect(tree.nodes.map((node) => node.cost)).toEqual([...MASTERY_COSTS].slice(0, 4));
      expect(tree.capstone.cost).toBe(MASTERY_COSTS[4]);
      // O nó 5 precisa dizer o que faz nos DOIS ramos: é ele que muda com a escolha da partida.
      expect(tree.capstone.branches.a.length).toBeGreaterThan(10);
      expect(tree.capstone.branches.b.length).toBeGreaterThan(10);
    }
  });

  it("mantém cada nó pequeno e a soma nominal na faixa combinada", () => {
    for (const guardianId of MASTERY_ORDER) {
      for (const node of MASTERY[guardianId].nodes) {
        const values = Object.entries(node.effect).filter(([key]) => key !== "chargeMaxBonus");
        for (const [key, value] of values) {
          // Nenhum nó isolado passa de 5% para cima ou para baixo: a maestria não substitui upgrade.
          expect(Math.abs((value as number) - 1), `${guardianId}.${node.name}.${key}`).toBeLessThanOrEqual(0.05001);
        }
      }
      // Soma NOMINAL de eixos diferentes, não poder efetivo: ver a nota em `data/mastery.ts`.
      const total = masteryPowerPercent(guardianId, MASTERY_MAX_LEVEL);
      expect(total, `${guardianId} total`).toBeGreaterThanOrEqual(13);
      expect(total, `${guardianId} total`).toBeLessThanOrEqual(16);
    }
  });

  it("soma os custos em ordem crescente e sabe qual é o próximo", () => {
    expect(masteryTotalCost(0)).toBe(0);
    expect(masteryTotalCost(5)).toBe(500 + 1500 + 4000 + 10_000 + 25_000);
    expect(masteryNextCost(0)).toBe(500);
    expect(masteryNextCost(4)).toBe(25_000);
    expect(masteryNextCost(MASTERY_MAX_LEVEL)).toBeNull();
    MASTERY_COSTS.slice(1).forEach((cost, index) => expect(cost).toBeGreaterThan(MASTERY_COSTS[index]));
  });
});

describe("resolução da maestria", () => {
  it("nível 0 é exatamente o neutro", () => {
    expect(resolveMastery("pistol-shrimp", 0)).toEqual(NEUTRAL_MASTERY);
  });

  it("acumula só os nós já comprados, na ordem", () => {
    const one = resolveMastery("pistol-shrimp", 1);
    expect(one.damageMultiplier).toBeCloseTo(1.03);
    expect(one.projectileSpeedMultiplier).toBe(1);
    const two = resolveMastery("pistol-shrimp", 2);
    expect(two.damageMultiplier).toBeCloseTo(1.03);
    expect(two.projectileSpeedMultiplier).toBeCloseTo(1.05);
  });

  it("satura no teto e ignora nível inválido", () => {
    expect(resolveMastery("dolphin", 99)).toEqual(resolveMastery("dolphin", MASTERY_MAX_LEVEL));
    expect(masteryLevelOf({ dolphin: -3 }, "dolphin")).toBe(0);
    expect(masteryLevelOf({ dolphin: 2.7 }, "dolphin")).toBe(2);
    expect(masteryLevelOf(undefined, "dolphin")).toBe(0);
    expect(masteryLevelOf({ dolphin: 99 }, "dolphin")).toBe(MASTERY_MAX_LEVEL);
  });

  it("só acende o nó final quando a unidade chega ao nível 2 de um ramo", () => {
    const full = MASTERY_MAX_LEVEL;
    expect(resolveMastery("shark", full, { branchId: null, upgradeLevel: 0 }).capstone).toBeNull();
    expect(resolveMastery("shark", full, { branchId: "a", upgradeLevel: 1 }).capstone, "nível 1 ainda não basta").toBeNull();
    expect(resolveMastery("shark", full, { branchId: "a", upgradeLevel: 2 }).capstone).toEqual({ id: MASTERY.shark.capstone.id, branchId: "a" });
    expect(resolveMastery("shark", full, { branchId: "b", upgradeLevel: 2 }).capstone?.branchId).toBe("b");
    // E nunca antes do nó 5, por mais evoluída que a unidade esteja.
    expect(resolveMastery("shark", 4, { branchId: "b", upgradeLevel: 2 }).capstone).toBeNull();
  });
});

describe("maestria nos atributos efetivos", () => {
  const progress = { branchId: null, upgradeLevel: 0 } as const;

  it("não muda nada com nível 0", () => {
    const definition = GUARDIANS["pistol-shrimp"];
    const plain = resolveGuardianStats(definition, progress);
    const zero = resolveGuardianStats(definition, progress, undefined, {}, resolveMastery("pistol-shrimp", 0));
    expect(zero.damage).toBe(plain.damage);
    expect(zero.cooldownMs).toBe(plain.cooldownMs);
    expect(zero.range).toBe(plain.range);
  });

  it("aplica dano, cadência, alcance e projétil do Camarão com a árvore cheia", () => {
    const definition = GUARDIANS["pistol-shrimp"];
    const plain = resolveGuardianStats(definition, progress);
    const full = resolveGuardianStats(definition, progress, undefined, {}, resolveMastery("pistol-shrimp", MASTERY_MAX_LEVEL));
    expect(full.damage).toBeCloseTo(plain.damage * 1.03);
    expect(full.cooldownMs).toBeCloseTo(plain.cooldownMs / 1.03);
    expect(full.range).toBeCloseTo(plain.range * 1.04);
    expect(full.projectileSpeed).toBeCloseTo(plain.projectileSpeed * 1.05);
  });

  it("aplica dano de contato no Baiacu e tempo de armação no Peixe-Pedra", () => {
    const puffer = resolveGuardianStats(GUARDIANS.pufferfish, progress, undefined, {}, resolveMastery("pufferfish", MASTERY_MAX_LEVEL));
    const plainPuffer = resolveGuardianStats(GUARDIANS.pufferfish, progress);
    expect(puffer.contactDamagePerSecond).toBeCloseTo(plainPuffer.contactDamagePerSecond * 1.04 * 1.04);

    const stone = resolveGuardianStats(GUARDIANS.stonefish, progress, undefined, {}, resolveMastery("stonefish", MASTERY_MAX_LEVEL));
    const plainStone = resolveGuardianStats(GUARDIANS.stonefish, progress);
    expect(stone.trap?.armMs).toBeCloseTo((plainStone.trap?.armMs ?? 0) * 0.96);
  });

  it("nunca deixa a maestria mexer no que é decisão de ramo", () => {
    // A maestria multiplica atributos; ela não escolhe ramo, não some com upgrade nem muda a mira.
    const definition = GUARDIANS["reef-crab"];
    const base = resolveGuardianStats(definition, { branchId: "b", upgradeLevel: 2 });
    const mastered = resolveGuardianStats(definition, { branchId: "b", upgradeLevel: 2 }, undefined, {}, resolveMastery("reef-crab", MASTERY_MAX_LEVEL));
    expect(mastered.spin).toEqual(base.spin);
    expect(mastered.areaAttack).toBe(base.areaAttack);
    expect(mastered.targeting).toBe(base.targeting);
  });
});

describe("Peixinho Dourado é outra coisa", () => {
  it("descreve os dois ramos de cada Guardião sem repetir o texto da maestria", () => {
    for (const guardianId of GUARDIAN_ORDER as GuardianId[]) {
      const golden = GOLDEN_FISH[guardianId];
      expect(golden.guardianId).toBe(guardianId);
      expect(golden.base.summary.length).toBeGreaterThan(10);
      for (const branch of ["a", "b"] as const) {
        expect(golden.branches[branch].summary.length).toBeGreaterThan(10);
        // A coroa e o nó 5 podem cobrir o mesmo tema, mas nunca são o MESMO texto: são efeitos
        // separados, de fontes separadas, e a interface precisa poder dizer isso.
        expect(golden.branches[branch].summary).not.toBe(MASTERY[guardianId].capstone.branches[branch]);
      }
    }
  });
});
