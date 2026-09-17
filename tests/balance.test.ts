import { describe, expect, it } from "vitest";
import { CROWD_CONTROL, ECONOMY, ENEMY_BALANCE, GUARDIAN_BALANCE, PLACEMENT } from "../src/game/data/balance";
import { ENEMIES, ENEMY_ORDER, resolveEnemy, scaleEnemy } from "../src/game/data/enemies";
import { GUARDIANS } from "../src/game/data/guardians";
import type { EnemyId, GuardianId } from "../src/game/types";

describe("balance sheet", () => {
  it("uses the agreed guardian prices", () => {
    const expected: Record<GuardianId, [number, number, number]> = {
      // V2: quem não mata custa menos. O desconto de utilidade é o que faz a comp de controle
      // caber no tabuleiro junto com dois DPS.
      "pistol-shrimp": [80, 70, 130],
      jellyfish: [90, 80, 135],
      pufferfish: [105, 85, 145],
      "reef-crab": [90, 80, 140],
      "ink-octopus": [105, 90, 155],
      shark: [110, 90, 150],
      "sea-turtle": [85, 75, 130],
      stonefish: [95, 80, 140],
      dolphin: [110, 95, 160],
    };
    (Object.keys(expected) as GuardianId[]).forEach((id) => {
      expect(GUARDIAN_BALANCE[id].cost).toBe(expected[id][0]);
      expect([...GUARDIAN_BALANCE[id].upgradeCosts]).toEqual(expected[id].slice(1));
    });
    expect(ECONOMY.startingPearls).toBe(180);
    expect(ECONOMY.sellRefundRate).toBe(0.25);
    expect(ECONOMY.waveClearBonus).toBe(25);
    expect(ECONOMY.levelClearBonus).toBe(75);
    expect(ECONOMY.reefHealth).toBe(20);
  });

  it("uses the agreed enemy rewards, health and leak damage", () => {
    const expected: Record<EnemyId, { maxHealth: number; reward: number; reefDamage: number }> = {
      // V3: todo comum custa 2–3 golpes relevantes, menos o Peixinho, que segue descartável.
      minnow: { maxHealth: 24, reward: 2, reefDamage: 1 },
      swimmer: { maxHealth: 90, reward: 6, reefDamage: 1 },
      dartfish: { maxHealth: 60, reward: 7, reefDamage: 1 },
      needlefish: { maxHealth: 78, reward: 9, reefDamage: 2 },
      ghostJelly: { maxHealth: 100, reward: 11, reefDamage: 1 },
      shellback: { maxHealth: 210, reward: 13, reefDamage: 2 },
      moray: { maxHealth: 390, reward: 22, reefDamage: 4 },
      corruptedShark: { maxHealth: 500, reward: 32, reefDamage: 5 },
      tidebreaker: { maxHealth: 550, reward: 60, reefDamage: 10 },
    };
    (Object.keys(expected) as EnemyId[]).forEach((id) => {
      expect(ENEMY_BALANCE[id]).toMatchObject(expected[id]);
      expect(ENEMIES[id].id).toBe(id);
      expect(ENEMIES[id].reefDamage).toBeGreaterThanOrEqual(1);
      expect(ENEMIES[id].reefDamage).toBeLessThanOrEqual(10);
    });
    expect(ENEMY_ORDER).toHaveLength(9);
    // V2: armadura na curva percentual — 9 = 36% do dano absorvido.
    expect(ENEMIES.shellback.armor).toBe(9);
    expect(ENEMIES.tidebreaker.isBoss).toBe(true);
    expect(ENEMIES.tidebreaker.unblockable).toBe(true);
    expect(ENEMIES.tidebreaker.reefDamage).toBeLessThan(ECONOMY.reefHealth);
  });

  it("makes the corrupted shark an elite hunter: bursts, rage and control resistance", () => {
    const shark = resolveEnemy(ENEMIES.corruptedShark);
    // Mais forte que o Peixe-Flecha de quem herdou a arte, e sem virar chefe.
    expect(shark.maxHealth).toBeGreaterThan(ENEMIES.dartfish.maxHealth);
    expect(shark.maxHealth).toBeLessThan(ENEMIES.tidebreaker.maxHealth);
    expect(shark.isBoss).toBeUndefined();
    expect(shark.threatLevel).toBe(2);
    expect(shark.resistances).toMatchObject({ slow: 0.4, stun: 0.35 });
    expect(shark.armor).toBe(6);
    expect(shark.abilities.map((ability) => ability.type).sort()).toEqual(["enrageBelowHp", "speedBurst"]);
  });

  it("scales enemies per level without touching the reference sheet", () => {
    const scaled = scaleEnemy(ENEMIES.swimmer, { health: 1.3, speed: 1.05, reward: 1 });
    expect(scaled.maxHealth).toBe(117);
    expect(scaled.speed).toBe(61);
    expect(scaled.reward).toBe(6);
    expect(ENEMIES.swimmer.maxHealth).toBe(90);
    const softened = scaleEnemy(ENEMIES.tidebreaker, { health: 0.75, speed: 1, reward: 1.2 }, { maxHealth: 400 });
    expect(softened).toMatchObject({ maxHealth: 300, reward: 72, armor: 7, reefDamage: 10, isBoss: true });
  });

  it("matches the agreed V2 damage profile", () => {
    // Camarão: DPS puro, a régua do jogo.
    expect(GUARDIANS["pistol-shrimp"]).toMatchObject({ damage: 24, cooldownMs: 1100, range: 190 });
    expect(GUARDIANS["pistol-shrimp"].branches[0].upgrades[0].pierceDamages).toEqual([24, 18]);
    expect(GUARDIANS["pistol-shrimp"].branches[0].upgrades[1].pierceDamages).toEqual([26, 21, 16]);
    expect(GUARDIANS["pistol-shrimp"].branches[1].upgrades[0]).toMatchObject({ damage: 44, cooldownMs: 1300 });
    expect(GUARDIANS["pistol-shrimp"].branches[1].upgrades[1]).toMatchObject({ damage: 72, cooldownMs: 1400 });
    // Água-viva: dano distribuído + controle que segura de verdade.
    expect(GUARDIANS.jellyfish).toMatchObject({ damage: 12, cooldownMs: 950, slowFactor: 0.7 });
    expect(GUARDIANS.jellyfish.branches[0].upgrades[0].chainDamages).toEqual([14, 11, 9]);
    expect(GUARDIANS.jellyfish.branches[1].upgrades[0]).toMatchObject({ slowFactor: 0.45, slowDurationMs: 2200 });
    expect(GUARDIANS.jellyfish.branches[1].upgrades[1].stun).toEqual({ durationMs: 900, immunityMs: 3000 });
    // V3: os utilitários ganharam dano moderado sem deixarem de ser utilitários.
    expect(GUARDIANS.jellyfish.branches[1].upgrades.map((upgrade) => upgrade.damage)).toEqual([18, 18]);
    expect(GUARDIANS["ink-octopus"].branches[0].upgrades[0].damage).toBe(17);
    // Baiacu: ramo A segura mais, ramo B pulsa.
    expect(GUARDIANS.pufferfish.contactDamagePerSecond).toBe(11);
    expect(GUARDIANS.pufferfish.branches[0].upgrades.map((upgrade) => upgrade.blockCapacity)).toEqual([3, 5]);
    // V3.1: o agarrão do Baiacu deixou de ser permanente em todos os níveis.
    expect(GUARDIANS.pufferfish.blockHold?.durationMs).toBe(3500);
    expect(GUARDIANS.pufferfish.branches[0].upgrades.map((upgrade) => upgrade.blockHold?.durationMs)).toEqual([4500, 5500]);
    // V3.2: a Tartaruga SEGURA; o Baiacu belisca. O agarrão dela é 2,5x mais longo em todo nível —
    // sem essa distância os dois eram a mesma unidade com números diferentes.
    const turtleHolds = [
      GUARDIANS["sea-turtle"].blockHold?.durationMs ?? 0,
      ...GUARDIANS["sea-turtle"].branches.flatMap((branch) => branch.upgrades.map((upgrade) => upgrade.blockHold?.durationMs ?? 0)),
    ];
    const pufferHolds = [
      GUARDIANS.pufferfish.blockHold?.durationMs ?? 0,
      ...GUARDIANS.pufferfish.branches[0].upgrades.map((upgrade) => upgrade.blockHold?.durationMs ?? 0),
    ];
    expect(Math.min(...turtleHolds)).toBeGreaterThan(Math.max(...pufferHolds) * 1.5);
    expect(GUARDIANS.pufferfish.branches[0].upgrades.map((upgrade) => upgrade.contactDamagePerSecond)).toEqual([15, 19]);
    expect(GUARDIANS.pufferfish.branches[1].upgrades.map((upgrade) => upgrade.damage)).toEqual([34, 58]);
    // Caranguejo: brawler de alcance curtíssimo.
    expect(GUARDIANS["reef-crab"]).toMatchObject({ damage: 34, cooldownMs: 1250, range: 78 });
    expect(GUARDIANS["reef-crab"].branches[0].upgrades.map((upgrade) => upgrade.damage)).toEqual([40, 58]);
    expect(GUARDIANS["reef-crab"].branches[0].upgrades.every((upgrade) => upgrade.armorPiercing)).toBe(true);
    // V3: o giro saiu de 3 para 4 ataques — 37,3 de dano médio por ataque viraram 35,0.
    expect(GUARDIANS["reef-crab"].branches[1].upgrades[1].spin).toMatchObject({ everyAttacks: 4, damage: 56 });
    // Polvo: debuffer. Ramo B não causa dano nenhum, só buffa.
    expect(GUARDIANS["ink-octopus"]).toMatchObject({ damage: 14, cooldownMs: 1500 });
    expect(GUARDIANS["ink-octopus"].vulnerability?.multiplier).toBe(1.12);
    expect(GUARDIANS["ink-octopus"].branches[0].upgrades[1].inkCloud?.vulnerabilityMultiplier).toBe(1.3);
    expect(GUARDIANS["ink-octopus"].branches[1].upgrades.map((upgrade) => upgrade.aura?.attackSpeedMultiplier)).toEqual([1.18, 1.25]);
    expect(GUARDIANS["ink-octopus"].branches[1].upgrades.every((upgrade) => upgrade.damage === undefined)).toBe(true);
    // Tubarão: dano direto; ramo B é a investida (alcance + impacto).
    expect(GUARDIANS.shark).toMatchObject({ damage: 36, cooldownMs: 1250, range: 165 });
    expect(GUARDIANS.shark.branches[1].upgrades.map((upgrade) => upgrade.damage)).toEqual([46, 58]);
    expect(GUARDIANS.shark.branches[1].upgrades.every((upgrade) => upgrade.rangeMultiplier === 1.25)).toBe(true);
    // Tartaruga: controle em área, dano irrelevante de propósito.
    expect(GUARDIANS["sea-turtle"]).toMatchObject({ damage: 11, cooldownMs: 1500, slowFactor: 0.75 });
    expect(GUARDIANS["sea-turtle"].branches[0].upgrades.map((upgrade) => upgrade.blockCapacity)).toEqual([4, 6]);
    // V3.1: ela bloqueia desde a base, e a Correnteza também segura — menos, mas segura.
    expect(GUARDIANS["sea-turtle"]).toMatchObject({ blocks: true, blockCapacity: 2 });
    expect(GUARDIANS["sea-turtle"].branches[1].upgrades.map((upgrade) => upgrade.blockCapacity)).toEqual([3, 5]);
    // A turbulência é EXCLUSIVA do ramo Correnteza: o Casco não mexe na água.
    expect(GUARDIANS["sea-turtle"].branches[0].upgrades.every((upgrade) => upgrade.flowField === undefined)).toBe(true);
    expect(GUARDIANS["sea-turtle"].branches[1].upgrades.every((upgrade) => upgrade.flowField !== undefined)).toBe(true);
    expect(GUARDIANS["sea-turtle"].branches[1].upgrades.map((upgrade) => upgrade.flowField?.speedFactor)).toEqual([0.62, 0.55]);
    expect(GUARDIANS["sea-turtle"].branches[1].upgrades[1].pushWave?.distance).toBe(170);
    // Peixe-Pedra (V3.2): emboscada RECORRENTE na borda da correnteza, não mais armadilha descartável.
    expect(GUARDIANS.stonefish.trap).toMatchObject({ damage: 46, settleMs: 1600, armMs: 420, cooldownMs: 4500, triggerRadius: 70 });
    expect(GUARDIANS.stonefish.placementMode).toBe("ambush");
    expect(GUARDIANS.stonefish.role).toBe("Emboscada • Veneno");
    // Ramo A troca dano por território; ramo B troca área por punição.
    expect(GUARDIANS.stonefish.branches[0].upgrades.map((upgrade) => upgrade.trap?.cloud?.radius)).toEqual([88, 108]);
    expect(GUARDIANS.stonefish.branches[0].upgrades[1].trap?.spreadOnDeath?.radius).toBe(72);
    expect(GUARDIANS.stonefish.branches[1].upgrades.map((upgrade) => upgrade.trap?.damage)).toEqual([82, 96]);
    expect(GUARDIANS.stonefish.branches[1].upgrades.every((upgrade) => upgrade.trap?.armorPiercing)).toBe(true);
    expect(GUARDIANS.stonefish.branches[1].upgrades[1].trap?.focus).toEqual({ bonusPerMaxHealth: 0.1, maxBonus: 80, armMs: 240 });
    // Golfinho: suporte puro; base com 10% de vulnerabilidade.
    expect(GUARDIANS.dolphin).toMatchObject({ damage: 11, cooldownMs: 1400 });
    expect(GUARDIANS.dolphin.sonar?.vulnerability.multiplier).toBe(1.1);
    expect(GUARDIANS.dolphin.branches[0].upgrades.map((upgrade) => upgrade.chorus?.aura.attackSpeedMultiplier)).toEqual([1.3, 1.38]);
    expect(GUARDIANS.dolphin.branches[1].upgrades[1].sonar?.echo?.waves).toBe(3);
    expect(CROWD_CONTROL.boss).toEqual({ windowMs: 8000, steps: [1, 0.6, 0.3], immunityMs: 4000 });
    expect(PLACEMENT).toMatchObject({ marginMin: 30, marginMax: 120, routeClearance: 52, waterRouteClearance: 82, separation: 78 });
  });
});
