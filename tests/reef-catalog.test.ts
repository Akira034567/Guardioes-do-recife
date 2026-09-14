import { describe, expect, it } from "vitest";
import { DECORATIONS, DECORATION_IDS, decoration, decorationsForSlot } from "../src/game/data/reef/decorations";
import {
  REEF_LANDMARKS,
  REEF_REST_SPOTS,
  REEF_SLOTS,
  REEF_ZONES,
  SLOT_KINDS,
  reefZone,
  slotById,
} from "../src/game/data/reef/layout";
import { SCALE_JITTER } from "../src/game/core/reef/planting";
import { ACHIEVEMENT_IDS } from "../src/game/data/achievements";
import { ENCOUNTERS } from "../src/game/data/encounters";
import { LEVEL_IDS } from "../src/game/data/levels";

/** Os segredos que o jogo realmente esconde nos mapas. */
const SECRET_IDS = ["pedra-que-pisca"];

describe("reef catalog", () => {
  it("names every decoration exactly once", () => {
    expect(new Set(DECORATION_IDS).size).toBe(DECORATIONS.length);
    for (const definition of DECORATIONS) {
      expect(definition.id.length).toBeGreaterThan(0);
      expect(definition.name.length).toBeGreaterThan(0);
      expect(definition.tagline.length).toBeGreaterThan(0);
      expect(decoration(definition.id)).toBe(definition);
    }
  });

  it("only points at slot kinds that exist in the reef", () => {
    for (const definition of DECORATIONS) {
      expect(definition.slots.length).toBeGreaterThan(0);
      for (const kind of definition.slots) {
        expect(SLOT_KINDS).toContain(kind);
        expect(REEF_SLOTS.some((slot) => slot.kind === kind), `nenhum canteiro do tipo ${kind}`).toBe(true);
      }
    }
    for (const kind of SLOT_KINDS) {
      expect(decorationsForSlot(kind).length, `${kind} sem nenhuma peça possível`).toBeGreaterThan(0);
    }
  });

  it("only unlocks against content that really exists", () => {
    for (const definition of DECORATIONS) {
      expect(definition.unlock.length).toBeGreaterThan(0);
      for (const condition of definition.unlock) {
        if (condition.type === "levelCompleted") expect(LEVEL_IDS).toContain(condition.levelId);
        if (condition.type === "encounterCompleted") {
          expect(ENCOUNTERS.map((encounter) => encounter.id)).toContain(condition.encounterId);
        }
        if (condition.type === "achievement") expect(ACHIEVEMENT_IDS).toContain(condition.achievementId);
        if (condition.type === "secretFound") expect(SECRET_IDS).toContain(condition.secretId);
        if (condition.type === "starsTotal") expect(condition.stars).toBeGreaterThan(0);
      }
    }
  });

  it("prices and limits stay sane", () => {
    for (const definition of DECORATIONS) {
      expect(definition.cost).toBeGreaterThanOrEqual(0);
      if (definition.cost > 0) {
        expect(definition.cost).toBeGreaterThanOrEqual(25);
        expect(definition.cost % 5).toBe(0);
      }
      expect(definition.maxCount).toBeGreaterThanOrEqual(1);
      expect(definition.footprint.w).toBeGreaterThan(0);
      expect(definition.footprint.w).toBeLessThanOrEqual(40);
      expect(definition.footprint.h).toBeGreaterThan(0);
      expect(definition.footprint.h).toBeLessThanOrEqual(40);
    }
  });

  it("keeps story rewards out of any future shop", () => {
    // Estátua, pedra e farol são memória de Encontro: comprar isso esvaziaria o significado.
    for (const id of ["estatua-guardia", "pedra-que-pisca"]) {
      expect(decoration(id)!.cost, `${id} não pode ser vendida`).toBe(0);
    }
  });

  it("describes drawable vector art", () => {
    for (const definition of DECORATIONS) {
      if (definition.art.type !== "vector") continue;
      expect(definition.art.layers.length).toBeGreaterThan(0);
      for (const layer of definition.art.layers) {
        expect(layer.size).toBeGreaterThan(0);
        expect(layer.color).toBeGreaterThanOrEqual(0);
        expect(layer.color).toBeLessThanOrEqual(0xffffff);
        if (layer.repeat !== undefined) expect(layer.repeat).toBeGreaterThanOrEqual(1);
        if (layer.alpha !== undefined) {
          expect(layer.alpha).toBeGreaterThan(0);
          expect(layer.alpha).toBeLessThanOrEqual(1);
        }
        if (layer.glow) expect(layer.glow.max).toBeGreaterThan(layer.glow.min);
      }
    }
  });

  it("lays out six landmarks, all inside the reef", () => {
    expect(REEF_LANDMARKS).toHaveLength(6);
    expect(REEF_LANDMARKS.map((landmark) => landmark.id).sort()).toEqual(
      ["achievements", "bestiary", "collection", "map", "settings", "stories"].sort(),
    );
    for (const landmark of REEF_LANDMARKS) {
      expect(landmark.at.x).toBeGreaterThanOrEqual(0);
      expect(landmark.at.x).toBeLessThanOrEqual(100);
      expect(landmark.at.y).toBeGreaterThanOrEqual(0);
      expect(landmark.at.y).toBeLessThanOrEqual(100);
      expect(landmark.radius).toBeGreaterThan(0);
      expect(landmark.label.length).toBeGreaterThan(0);
    }
    // O mapa e as configurações precisam existir desde a primeira visita.
    expect(REEF_LANDMARKS.find((landmark) => landmark.id === "map")!.minStage).toBe(0);
    expect(REEF_LANDMARKS.find((landmark) => landmark.id === "settings")!.minStage).toBe(0);
  });

  it("keeps the slot order dense so growth never skips a step", () => {
    const orders = REEF_SLOTS.map((slot) => slot.order).sort((a, b) => a - b);
    orders.forEach((order, index) => expect(order).toBe(index));
    for (const slot of REEF_SLOTS) {
      expect(slotById(slot.id)).toBe(slot);
      expect(slot.at.x).toBeGreaterThanOrEqual(0);
      expect(slot.at.x).toBeLessThanOrEqual(100);
      expect(slot.at.y).toBeGreaterThanOrEqual(0);
      expect(slot.at.y).toBeLessThanOrEqual(100);
      expect(slot.scale).toBeGreaterThan(0);
    }
  });

  it("never lets a decoration cover a painted landmark", () => {
    // Os seis lugares vêm pintados no fundo, com plaquinha e tudo. Uma peça plantada por cima
    // esconderia o desenho ou o nome — e o jogador perderia o caminho para a tela. A área usada é a
    // que o lugar realmente OCUPA na arte (`keepOut`), não o alvo de clique, que é bem menor.
    for (const slot of REEF_SLOTS) {
      const candidates = DECORATIONS.filter((definition) => definition.slots.includes(slot.kind));
      expect(candidates.length, `${slot.id} sem peça possível`).toBeGreaterThan(0);
      const biggest = slot.scale * (1 + SCALE_JITTER);
      const width = Math.max(...candidates.map((d) => d.footprint.w)) * biggest;
      const height = Math.max(...candidates.map((d) => d.footprint.h)) * biggest;
      // A peça é ancorada pela base: cresce para cima a partir do canteiro.
      const box = { x0: slot.at.x - width / 2, x1: slot.at.x + width / 2, y0: slot.at.y - height, y1: slot.at.y };
      for (const landmark of REEF_LANDMARKS) {
        const keep = landmark.keepOut;
        const overlaps = box.x0 < keep.x1 && box.x1 > keep.x0 && box.y0 < keep.y1 && box.y1 > keep.y0;
        expect(overlaps, `${slot.id} pode tapar ${landmark.id}`).toBe(false);
      }
    }
  });

  it("puts every rest spot inside the zone it belongs to", () => {
    for (const spot of REEF_REST_SPOTS) {
      const zone = reefZone(spot.habitat);
      expect(zone.habitat).toBe(spot.habitat);
      expect(spot.at.x).toBeGreaterThanOrEqual(zone.bounds.x);
      expect(spot.at.x).toBeLessThanOrEqual(zone.bounds.x + zone.bounds.w);
      expect(spot.at.y).toBeGreaterThanOrEqual(zone.bounds.y);
      expect(spot.at.y).toBeLessThanOrEqual(zone.bounds.y + zone.bounds.h);
      expect(spot.radius).toBeGreaterThan(0);
    }
    // Toda zona precisa caber dentro do Recife.
    for (const zone of REEF_ZONES) {
      expect(zone.bounds.x).toBeGreaterThanOrEqual(0);
      expect(zone.bounds.y).toBeGreaterThanOrEqual(0);
      expect(zone.bounds.x + zone.bounds.w).toBeLessThanOrEqual(100);
      expect(zone.bounds.y + zone.bounds.h).toBeLessThanOrEqual(100);
    }
  });
});
