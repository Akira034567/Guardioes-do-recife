import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/game/data/enemies";
import { GUARDIANS } from "../src/game/data/guardians";
import { LEVELS } from "../src/game/data/levels";
import { armorReduction } from "../src/game/core/Combat";
import type { LevelDefinition } from "../src/game/types";

/** Ondas por fase que a V3 combinou: a campanha cresce de 7 para 18. */
const EXPECTED_WAVES = [7, 10, 12, 15, 16, 18];

const enemiesIn = (level: LevelDefinition): number =>
  level.waves.reduce((total, wave) => total + wave.groups.reduce((sum, group) => sum + group.count, 0), 0);

/** Vida total que a fase joga no jogador, já com o escalonamento e descontando a armadura. */
const effectiveHealth = (level: LevelDefinition): number =>
  level.waves.reduce(
    (total, wave) =>
      total +
      wave.groups.reduce((sum, group) => {
        const base = level.enemyOverrides?.[group.enemyId]?.maxHealth ?? ENEMIES[group.enemyId].maxHealth;
        const health = Math.round(base * level.enemyScaling.health);
        return sum + (group.count * health) / (1 - armorReduction(ENEMIES[group.enemyId].armor));
      }, 0),
    0,
  );

describe("curva da campanha (V3)", () => {
  it("entrega a contagem de ondas combinada", () => {
    expect(LEVELS.map((level) => level.waves.length)).toEqual(EXPECTED_WAVES);
  });

  it("cresce em ondas, em inimigos e em vida efetiva, fase a fase", () => {
    const counts = LEVELS.map(enemiesIn);
    const health = LEVELS.map(effectiveHealth);
    counts.slice(1).forEach((count, index) => expect(count, `inimigos ${LEVELS[index + 1].id}`).toBeGreaterThan(counts[index]));
    health.slice(1).forEach((value, index) => expect(value, `vida ${LEVELS[index + 1].id}`).toBeGreaterThan(health[index]));
  });

  it("abre toda fase com uma onda leve, para o tabuleiro ainda vazio", () => {
    for (const level of LEVELS) {
      const first = level.waves[0].groups.reduce((sum, group) => sum + group.count, 0);
      const biggest = Math.max(...level.waves.map((wave) => wave.groups.reduce((sum, group) => sum + group.count, 0)));
      // A primeira onda nunca passa de 40% da maior: foi o que quebrou as fases 5 e 6 na primeira
      // tentativa desta rodada — abertura pesada contra um Recife de três unidades.
      expect(first / biggest, `${level.id} abertura`).toBeLessThanOrEqual(0.4);
    }
  });

  it("nunca põe um chefe nas primeiras ondas de uma fase longa", () => {
    for (const level of LEVELS) {
      level.waves.forEach((wave, index) => {
        if (!wave.groups.some((group) => ENEMIES[group.enemyId].isBoss)) return;
        // O primeiro chefe cai no mínimo depois de 40% da fase; antes disso não há economia para ele.
        expect(index / level.waves.length, `${level.id} chefe na onda ${index + 1}`).toBeGreaterThanOrEqual(0.4);
      });
    }
  });
});

describe("curva de vida dos inimigos (V3)", () => {
  it("mantém o Peixinho descartável e os comuns em 2 a 3 golpes relevantes", () => {
    const crabSpin = GUARDIANS["reef-crab"].branches[1].upgrades[1].spin?.damage ?? 0;
    const crabHit = GUARDIANS["reef-crab"].damage;
    const shrimpHit = GUARDIANS["pistol-shrimp"].damage;

    // Peixinho: o contrato é morrer a UM AoE grande, em qualquer fase. Um tiro cheio do Camarão
    // basta até a fase 5; na 6 ele passa a exigir dois, e isso é aceitável — o que não pode é o
    // cardume virar parede.
    for (const level of LEVELS) {
      const minnow = Math.round(ENEMIES.minnow.maxHealth * level.enemyScaling.health);
      expect(minnow, `${level.id} peixinho vs giro`).toBeLessThanOrEqual(crabSpin);
      expect(Math.ceil(minnow / shrimpHit), `${level.id} peixinho vs camarão`).toBeLessThanOrEqual(2);
    }

    // Peixe Invasor: nunca cai num golpe só, e nunca exige mais que 4 pinçadas.
    for (const level of LEVELS) {
      const swimmer = Math.round(ENEMIES.swimmer.maxHealth * level.enemyScaling.health);
      expect(Math.ceil(swimmer / crabSpin), `${level.id} invasor vs giro`).toBeGreaterThanOrEqual(2);
      expect(Math.ceil(swimmer / crabHit), `${level.id} invasor vs pinçada`).toBeGreaterThanOrEqual(2);
      expect(Math.ceil(swimmer / crabHit), `${level.id} invasor vs pinçada`).toBeLessThanOrEqual(4);
    }
  });

  it("mantém a ordem de ameaça do bestiário", () => {
    const order = ["minnow", "dartfish", "needlefish", "swimmer", "ghostJelly", "shellback", "moray", "corruptedShark"] as const;
    order.slice(1).forEach((id, index) => {
      expect(ENEMIES[id].maxHealth, `${id} vs ${order[index]}`).toBeGreaterThanOrEqual(ENEMIES[order[index]].maxHealth);
    });
  });
});
