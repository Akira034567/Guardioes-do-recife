import { describe, expect, it } from "vitest";
import { ENEMY_ORDER } from "../src/game/data/enemies";
import { ENEMY_LORE } from "../src/game/data/enemyLore";
import { GUARDIAN_LORE } from "../src/game/data/guardianLore";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";

/**
 * O Álbum do Recife e o Bestiário mostram texto para todo Guardião e todo inimigo do catálogo.
 * Conteúdo novo sem ficha quebraria a tela em silêncio; aqui quebra o teste.
 */
describe("collection and bestiary lore", () => {
  it("describes every guardian in the album", () => {
    for (const guardianId of GUARDIAN_ORDER) {
      const lore = GUARDIAN_LORE[guardianId];
      expect(lore, guardianId).toBeDefined();
      expect(lore.history.length, guardianId).toBeGreaterThan(40);
      expect(lore.tip.length, guardianId).toBeGreaterThan(20);
      expect([1, 2, 3]).toContain(lore.difficulty);
    }
    expect(Object.keys(GUARDIAN_LORE).sort()).toEqual([...GUARDIAN_ORDER].sort());
  });

  it("describes every enemy in the bestiary", () => {
    for (const enemyId of ENEMY_ORDER) {
      const lore = ENEMY_LORE[enemyId];
      expect(lore, enemyId).toBeDefined();
      expect(lore.description.length, enemyId).toBeGreaterThan(40);
      expect(lore.trait.length, enemyId).toBeGreaterThan(20);
      expect(lore.weaknesses.length, enemyId).toBeGreaterThan(0);
    }
    expect(Object.keys(ENEMY_LORE).sort()).toEqual([...ENEMY_ORDER].sort());
  });

  it("keeps resistance notes only where the enemy really resists something", () => {
    expect(ENEMY_LORE.minnow.resistances).toEqual([]);
    expect(ENEMY_LORE.moray.resistances.join(" ")).toContain("Lentidão");
    expect(ENEMY_LORE.tidebreaker.resistances.join(" ")).toContain("Bloqueio");
  });
});
