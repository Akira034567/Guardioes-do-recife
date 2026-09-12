import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../src/game/constants";
import { InteractableSystem } from "../src/game/core/Interactables";
import { Match } from "../src/game/core/match/Match";
import { RoutePath } from "../src/game/core/RoutePath";
import { containsPoint } from "../src/game/core/CurrentField";
import { ENEMIES } from "../src/game/data/enemies";
import { ENCOUNTERS, ENCOUNTER_LEVELS, encounterForLevel, getEncounter } from "../src/game/data/encounters";
import { GUARDIANS } from "../src/game/data/guardians";
import { getCampaignLevel, getLevel, LEVELS, LEVEL_IDS } from "../src/game/data/levels";
import { GUARDIAN_UNLOCKS } from "../src/game/data/unlocks";

describe("encounter registry", () => {
  it("mantém os Encontros fora da campanha, mas jogáveis por id", () => {
    expect(ENCOUNTERS).toHaveLength(4);
    expect(LEVELS).toHaveLength(6);
    for (const encounter of ENCOUNTERS) {
      expect(LEVEL_IDS).not.toContain(encounter.level.id);
      expect(getLevel(encounter.level.id), "jogável por id").toBe(encounter.level);
      expect(getCampaignLevel(encounter.level.id), "mas não é fase da campanha").toBeUndefined();
      expect(encounter.level.kind).toBe("encounter");
      expect(encounter.level.encounterId).toBe(encounter.id);
      expect(encounterForLevel(encounter.level.id)).toBe(encounter);
      expect(getEncounter(encounter.id)).toBe(encounter);
    }
    expect(getEncounter("nao-existe")).toBeUndefined();
  });

  it("liga cada Encontro ao desbloqueio de um Guardião diferente", () => {
    const guardians = ENCOUNTERS.map((encounter) => encounter.guardianId);
    expect(new Set(guardians).size).toBe(guardians.length);
    for (const encounter of ENCOUNTERS) {
      const unlock = GUARDIAN_UNLOCKS.find((definition) => definition.guardianId === encounter.guardianId);
      expect(unlock, encounter.guardianId).toBeDefined();
      expect(unlock?.conditions, `${encounter.guardianId} depende do Encontro`).toContainEqual({ type: "encounterCompleted", encounterId: encounter.id });
      // Nenhum Guardião de Encontro cai de graça ao concluir uma fase da campanha.
      expect(unlock?.conditions.some((condition) => condition.type === "levelCompleted")).toBe(false);
    }
  });

  it("abre cada Encontro a partir de algo que o jogador viveu", () => {
    for (const encounter of ENCOUNTERS) {
      const requires = encounter.requires;
      expect(Boolean(requires.levelCompleted || requires.secretFound), encounter.id).toBe(true);
      if (requires.levelCompleted) expect(LEVEL_IDS).toContain(requires.levelCompleted);
      expect(LEVEL_IDS).toContain(encounter.after);
    }
    // O Peixe-Pedra depende do segredo escondido na fase 4, e o segredo existe lá.
    const stonefish = ENCOUNTERS.find((encounter) => encounter.guardianId === "stonefish");
    expect(stonefish?.requires.secretFound).toBe("pedra-que-pisca");
    const secrets = LEVELS.flatMap((level) => level.interactables ?? []).filter((item) => item.secretId);
    expect(secrets.map((item) => item.secretId)).toContain("pedra-que-pisca");
  });

  describe.each(ENCOUNTER_LEVELS.map((level) => [level.id, level] as const))("%s", (_id, level) => {
    const route = new RoutePath(level.waypoints);

    it("é uma fase curta e completa: rota, plataformas, corrente e ondas", () => {
      const offscreen = (point: { x: number; y: number }): boolean =>
        point.x < 0 || point.x > GAME_WIDTH || point.y < HUD_TOP || point.y > GAME_HEIGHT - HUD_BOTTOM;
      expect(offscreen(level.waypoints[0])).toBe(true);
      expect(offscreen(level.waypoints[level.waypoints.length - 1])).toBe(true);
      expect(route.totalLength).toBeGreaterThan(900);

      expect(level.placements.length).toBeGreaterThanOrEqual(4);
      level.placements.forEach((placement) => {
        const distance = route.getClosestPoint(placement).distance;
        expect(distance, `${placement.id} longe da rota`).toBeGreaterThan(82);
        expect(distance, `${placement.id} ao alcance do Camarão`).toBeLessThan(GUARDIANS["pistol-shrimp"].range - 10);
        expect(placement.y).toBeGreaterThanOrEqual(HUD_TOP + 28);
        expect(placement.y).toBeLessThanOrEqual(GAME_HEIGHT - HUD_BOTTOM - 40);
      });
      level.placements.forEach((first, index) => {
        level.placements.slice(index + 1).forEach((second) => {
          expect(Math.hypot(first.x - second.x, first.y - second.y), `${first.id}/${second.id}`).toBeGreaterThan(90);
        });
      });

      level.currents.forEach((current) => {
        const inside = level.waypoints.filter((point) => containsPoint(current, point));
        expect(inside.length, `${current.id} cobre a rota`).toBeGreaterThanOrEqual(2);
      });

      // Encontro é curto e sem chefe: o prêmio é o Guardião, não a escalada.
      expect(level.waves.length).toBeGreaterThanOrEqual(3);
      expect(level.waves.length).toBeLessThanOrEqual(4);
      expect(level.waves.every((wave) => wave.groups.every((group) => !ENEMIES[group.enemyId].isBoss))).toBe(true);
      expect(level.objectives, "Encontro não vale estrela").toBeUndefined();
    });

    it("tem um interagível que entrega o Guardião prometido", () => {
      const interactables = level.interactables ?? [];
      expect(interactables.length).toBeGreaterThanOrEqual(1);
      const rescue = interactables.find((item) => item.ally);
      const encounter = encounterForLevel(level.id);
      expect(rescue?.ally?.guardianId).toBe(encounter?.guardianId);
      interactables.forEach((item) => {
        expect(item.x).toBeGreaterThan(0);
        expect(item.x).toBeLessThan(GAME_WIDTH);
        expect(item.y).toBeGreaterThan(HUD_TOP);
        expect(item.y).toBeLessThan(GAME_HEIGHT - HUD_BOTTOM);
        expect(InteractableSystem.radiusOf(item)).toBeGreaterThan(20);
      });
    });
  });
});

describe("encounter match", () => {
  it("liberta o Guardião e ele entra de graça, sem poder ser vendido", () => {
    const level = ENCOUNTERS[1].level; // Rede Fantasma: cinco toques.
    const match = new Match(level);
    const pearlsBefore = match.pearls();
    expect(match.guardians).toHaveLength(0);

    for (let tap = 0; tap < 5; tap += 1) {
      const result = match.execute({ type: "interact", interactableId: "rede" });
      expect(result.ok, `toque ${tap + 1}`).toBe(true);
      // Sem esperar, o próximo toque é recusado: a rede precisa de fôlego entre os cortes.
      const immediate = match.execute({ type: "interact", interactableId: "rede" });
      expect(immediate).toMatchObject({ ok: false, reason: tap === 4 ? "interactableDone" : "interactableBusy" });
      for (let step = 0; step < 60; step += 1) match.tick();
    }

    expect(match.guardians).toHaveLength(1);
    const ally = match.guardians[0];
    expect(ally.guardianId).toBe("sea-turtle");
    expect(ally.ownerId).toBe("npc");
    expect(match.pearls(), "aliado não custa pérolas").toBe(pearlsBefore);
    expect(match.execute({ type: "sellGuardian", instanceId: ally.id })).toMatchObject({ ok: false, reason: "notOwner" });
    // A corrente temporária da Tartaruga entra em campo com ela.
    expect(match.currents.zones().some((zone) => zone.id === "interact:rede")).toBe(true);
    expect(match.snapshot().stats.interactablesCompleted).toEqual(["rede"]);
  });

  it("guarda o segredo achado na fase da campanha", () => {
    const match = new Match(LEVELS[3]);
    expect(match.execute({ type: "interact", interactableId: "pedra-que-pisca" })).toMatchObject({ ok: true, completed: true });
    expect(match.snapshot().stats.secretsFound).toEqual(["pedra-que-pisca"]);
    // Segredo não coloca ninguém em campo: ele só abre o Encontro.
    expect(match.guardians).toHaveLength(0);
  });

  it("não tem interagível nenhum nas fases comuns", () => {
    expect(new Match(LEVELS[0]).snapshot().interactables).toEqual([]);
  });
});
