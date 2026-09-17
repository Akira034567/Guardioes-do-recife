import { describe, expect, it } from "vitest";
import { Match } from "../src/game/core/match/Match";
import { GOLDEN_AMPLIFICATION, GOLDEN_AWARD_WAVE_FRACTION, GOLDEN_BOOSTS, goldenAwardWaveIndex, goldenBoostFor, GOLDEN_FISH } from "../src/game/data/goldenFish";
import { GUARDIANS } from "../src/game/data/guardians";
import { getLevel } from "../src/game/data/levels";
import type { MatchEvent } from "../src/game/core/match/MatchEvents";
import type { LevelDefinition } from "../src/game/types";

const level = getLevel("recife-1") as LevelDefinition;

/** Roda a partida até o evento pedido (ou até acabar), devolvendo tudo que foi emitido. */
function runUntil(match: Match, type: MatchEvent["type"], maxMs = 900_000): MatchEvent[] {
  const events: MatchEvent[] = [];
  match.setListener((event) => events.push(event));
  while (match.status === "running" && match.now < maxMs) {
    match.tick();
    if (events.some((event) => event.type === type)) break;
  }
  return events;
}

describe("quando o Peixinho Dourado chega", () => {
  it("cai por volta de 60% da fase e nunca na última onda", () => {
    // 7 ondas: 60% dá a onda 4 (índice 3). O índice é o da onda JÁ limpa.
    expect(goldenAwardWaveIndex(7)).toBe(3);
    expect(goldenAwardWaveIndex(18)).toBe(10);
    expect(GOLDEN_AWARD_WAVE_FRACTION).toBe(0.6);
    // Nunca na última nem depois dela: a coroa tem que dar tempo de ser usada.
    for (const total of [5, 7, 10, 12, 15, 16, 18]) {
      expect(goldenAwardWaveIndex(total), `${total} ondas`).toBeLessThanOrEqual(total - 2);
      expect(goldenAwardWaveIndex(total)).toBeGreaterThanOrEqual(0);
    }
  });

  it("é recompensa garantida: a mesma fase entrega na mesma onda, sempre", () => {
    const first = new Match(level, { seed: "a" });
    const second = new Match(level, { seed: "b" });
    const waveOf = (match: Match): number => {
      // Precisa de defesa para chegar lá: um Recife vazio cai antes da onda da recompensa.
      match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 375, y: 245 });
      match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 925, y: 500 });
      const events = runUntil(match, "goldenFishAwarded");
      const awarded = events.find((event) => event.type === "goldenFishAwarded");
      return awarded && awarded.type === "goldenFishAwarded" ? awarded.waveIndex : -1;
    };
    // Sementes diferentes, mesma onda: não há sorteio nenhum no caminho. Cada partida é medida
    // UMA vez — reexecutar `waveOf` numa partida já adiantada não veria o evento de novo.
    const a = waveOf(first);
    const b = waveOf(second);
    expect(a).toBe(goldenAwardWaveIndex(level.waves.length));
    expect(b).toBe(a);
  });

  it("não deixa coroar antes de o Peixinho aparecer", () => {
    const match = new Match(level);
    const placed = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 375, y: 245 });
    expect(placed.ok).toBe(true);
    const crown = match.execute({ type: "crownGuardian", instanceId: placed.ok ? (placed.instanceId as string) : "" });
    expect(crown).toMatchObject({ ok: false, reason: "goldenUnavailable" });
    expect(match.goldenFishAvailable).toBe(false);
  });
});

describe("coroação", () => {
  /** Partida com o Peixinho já concedido e uma unidade em campo. */
  function ready(): { match: Match; id: string } {
    const match = new Match(level);
    const placed = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 375, y: 245 });
    const id = placed.ok ? (placed.instanceId as string) : "";
    runUntil(match, "goldenFishAwarded");
    return { match, id };
  }

  it("coroa uma unidade e marca a partida como gasta", () => {
    const { match, id } = ready();
    expect(match.goldenFishAvailable).toBe(true);
    const crown = match.execute({ type: "crownGuardian", instanceId: id });
    expect(crown.ok).toBe(true);
    expect(match.crownedGuardianId).toBe(id);
    expect(match.guardian(id)?.isCrowned).toBe(true);
    // Uma por partida: a segunda tentativa é recusada, e a primeira escolha não muda.
    expect(match.goldenFishAvailable).toBe(false);
    expect(match.execute({ type: "crownGuardian", instanceId: id })).toMatchObject({ ok: false, reason: "goldenSpent" });
  });

  it("recusa unidade inexistente sem gastar o Peixinho", () => {
    const { match } = ready();
    expect(match.execute({ type: "crownGuardian", instanceId: "nao-existe" })).toMatchObject({ ok: false, reason: "notFound" });
    expect(match.goldenFishAvailable, "recusa não consome a recompensa").toBe(true);
  });

  it("anuncia o que a coroa amplifica naquele ramo", () => {
    const match = new Match(level);
    const placed = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 375, y: 245 });
    const id = placed.ok ? (placed.instanceId as string) : "";
    runUntil(match, "goldenFishAwarded");
    const events: MatchEvent[] = [];
    match.setListener((event) => events.push(event));
    match.execute({ type: "crownGuardian", instanceId: id });
    const crowned = events.find((event) => event.type === "goldenFishCrowned");
    expect(crowned).toMatchObject({
      type: "goldenFishCrowned",
      id,
      guardianId: "pistol-shrimp",
      // Sem ramo escolhido ainda, vale o texto base.
      branchId: null,
      summary: GOLDEN_FISH["pistol-shrimp"].base.summary,
    });
  });

  it("escolhe o texto do ramo quando a unidade já evoluiu", () => {
    const match = new Match(level);
    const placed = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 375, y: 245 });
    const id = placed.ok ? (placed.instanceId as string) : "";
    runUntil(match, "goldenFishAwarded");
    match.execute({ type: "upgradeGuardian", instanceId: id, branchId: "b" });
    const events: MatchEvent[] = [];
    match.setListener((event) => events.push(event));
    match.execute({ type: "crownGuardian", instanceId: id });
    const crowned = events.find((event) => event.type === "goldenFishCrowned");
    expect(crowned).toMatchObject({ branchId: "b", summary: goldenBoostFor("pistol-shrimp", "b").summary });
  });
});

describe("o que a coroa faz", () => {
  it("amplifica os atributos da unidade coroada, e só dela", () => {
    const match = new Match(level);
    const first = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 375, y: 245 });
    const second = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 925, y: 500 });
    const crownedId = first.ok ? (first.instanceId as string) : "";
    const plainId = second.ok ? (second.instanceId as string) : "";
    const before = match.guardian(crownedId)!.stats.damage;

    runUntil(match, "goldenFishAwarded");
    expect(match.execute({ type: "crownGuardian", instanceId: crownedId }).ok).toBe(true);

    const boost = GOLDEN_BOOSTS["pistol-shrimp"].base;
    expect(match.guardian(crownedId)!.stats.damage).toBeCloseTo(before * boost.damageMultiplier!);
    expect(match.guardian(crownedId)!.stats.cooldownMs).toBeCloseTo(GUARDIANS["pistol-shrimp"].cooldownMs / boost.attackSpeedMultiplier!);
    // A unidade do lado não ganha nada: a coroa é de UMA, não do esquadrão.
    expect(match.guardian(plainId)!.stats.damage).toBe(before);
  });

  it("segue o ramo da unidade: coroar depois de evoluir usa o pacote daquele ramo", () => {
    const match = new Match(level);
    const placed = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 375, y: 245 });
    const id = placed.ok ? (placed.instanceId as string) : "";
    runUntil(match, "goldenFishAwarded");
    match.execute({ type: "upgradeGuardian", instanceId: id, branchId: "b" });
    const beforeCrown = match.guardian(id)!.stats.damage;
    match.execute({ type: "crownGuardian", instanceId: id });
    expect(match.guardian(id)!.stats.damage).toBeCloseTo(beforeCrown * GOLDEN_BOOSTS["pistol-shrimp"].b.damageMultiplier!);
  });

  it("mira a faixa declarada em todo Guardião e em todo ramo", () => {
    for (const guardianId of Object.keys(GOLDEN_BOOSTS) as Array<keyof typeof GOLDEN_BOOSTS>) {
      for (const key of ["base", "a", "b"] as const) {
        const boost = GOLDEN_BOOSTS[guardianId][key];
        // Soma nominal dos eixos, como na maestria: aqui o alvo é bem mais alto porque vale para UMA
        // unidade e por UMA partida.
        const gain = Object.entries(boost).reduce((total, [field, value]) => {
          if (field.endsWith("Bonus")) return total;
          const lowerIsBetter = field === "abilityCooldownMultiplier" || field === "rearmMultiplier" || field === "trapArmMultiplier";
          return total + (lowerIsBetter ? 1 - (value as number) : (value as number) - 1);
        }, 0);
        // Margem de ponto flutuante: 1.2 - 1 dá 0,19999… As vagas de bloqueio (`*Bonus`) somam por
        // fora e não entram nesta conta, então quem as tem fica acima do que o número mostra.
        expect(gain, `${guardianId}.${key}`).toBeGreaterThan(GOLDEN_AMPLIFICATION.min - 0.001);
        expect(gain, `${guardianId}.${key}`).toBeLessThanOrEqual(0.55);
      }
    }
  });
});

describe("o Peixinho não se confunde com a maestria", () => {
  it("mira uma faixa própria de ganho, declarada e estreita", () => {
    expect(GOLDEN_AMPLIFICATION.min).toBe(0.2);
    expect(GOLDEN_AMPLIFICATION.max).toBe(0.3);
    // Bem acima do que a maestria inteira dá (13% a 16% nominais), porque vale para UMA unidade
    // e por UMA partida — é holofote, não progressão.
    expect(GOLDEN_AMPLIFICATION.min).toBeGreaterThan(0.16);
  });
});
