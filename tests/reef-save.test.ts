import { describe, expect, it } from "vitest";
import { placeDecoration } from "../src/game/core/reef/economy";
import { reconcileReef } from "../src/game/core/reef/planting";
import { createDefaultProgress, MAX_PLACED_DECORATIONS, SAVE_VERSION, sanitizeProgress } from "../src/game/core/save/PlayerProgress";
import { SAVE_KEY, SaveManager, type SaveStorage } from "../src/game/core/save/SaveManager";
import { DECORATION_IDS } from "../src/game/data/reef/decorations";

const registry = {
  levelIds: ["recife-1", "recife-2", "recife-3"],
  guardianIds: ["pistol-shrimp", "jellyfish", "shark"],
  enemyIds: ["swimmer"],
  defaultUnlockedGuardians: ["pistol-shrimp", "jellyfish"],
  decorationIds: DECORATION_IDS,
};

function memoryStorage(initial: Record<string, string> = {}): SaveStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const now = new Date("2026-09-13T00:00:00Z");

describe("reef save", () => {
  it("starts every profile with its own empty reef", () => {
    const first = createDefaultProgress(registry, now);
    const second = createDefaultProgress(registry, now);
    expect(first.reef.placed).toEqual([]);
    expect(first.reef.nextInstanceId).toBe(1);
    // Perfis não podem compartilhar array nenhum: mexer num não pode aparecer no outro.
    first.reef.owned.push("coral-cerebro");
    first.reef.placed.push({ instanceId: "d1", defId: "coral-cerebro", x: 1, y: 2, rotation: 0, scale: 1, flip: false, slotId: null });
    expect(second.reef.owned).toEqual([]);
    expect(second.reef.placed).toEqual([]);
  });

  it("keeps a valid reef intact through sanitize", () => {
    const progress = createDefaultProgress(registry, now);
    reconcileReef(progress);
    const clean = sanitizeProgress(progress, registry, now);
    expect(clean.reef).toEqual(progress.reef);
  });

  it("drops entries it cannot trust", () => {
    const raw = {
      saveVersion: SAVE_VERSION,
      reef: {
        owned: ["coral-cerebro", "nao-existe"],
        placed: [
          { instanceId: "d1", defId: "coral-cerebro", x: 10, y: 20, rotation: 5, scale: 1, flip: false, slotId: "coral-a" },
          { instanceId: "d2", defId: "peca-fantasma", x: 10, y: 20, rotation: 0, scale: 1, flip: false, slotId: null },
          { instanceId: "d1", defId: "coral-chifre", x: 10, y: 20, rotation: 0, scale: 1, flip: false, slotId: null },
          { instanceId: "", defId: "coral-chifre", x: 1, y: 1, rotation: 0, scale: 1, flip: false, slotId: null },
          "lixo",
        ],
        granted: ["coral-cerebro"],
        residents: ["shark", "kraken"],
        nextInstanceId: 1,
      },
    };
    const clean = sanitizeProgress(raw, registry, now);
    expect(clean.reef.placed.map((item) => item.instanceId)).toEqual(["d1"]);
    expect(clean.reef.owned).toEqual(["coral-cerebro"]);
    expect(clean.reef.residents).toEqual(["shark"]);
    // O contador nunca pode colidir com um id que já existe no documento.
    expect(clean.reef.nextInstanceId).toBe(2);
  });

  it("clamps every number and repairs the counter", () => {
    const raw = {
      saveVersion: SAVE_VERSION,
      reef: {
        placed: [
          { instanceId: "d40", defId: "coral-cerebro", x: 999, y: -999, rotation: 900, scale: 99, flip: "sim", slotId: "" },
          { instanceId: "d7", defId: "coral-chifre", x: "abc", y: null, rotation: undefined, scale: 0, flip: false, slotId: null },
        ],
        nextInstanceId: 2,
      },
    };
    const clean = sanitizeProgress(raw, registry, now);
    const [first, second] = clean.reef.placed;
    expect(first).toMatchObject({ x: 100, y: 0, rotation: 180, scale: 4, flip: false, slotId: null });
    expect(second).toMatchObject({ x: 50, y: 50, rotation: 0, scale: 0.25 });
    expect(clean.reef.nextInstanceId).toBe(41);
  });

  it("forces every planted piece to be owned", () => {
    const raw = {
      saveVersion: SAVE_VERSION,
      reef: {
        owned: [],
        placed: [{ instanceId: "d1", defId: "coral-cerebro", x: 5, y: 5, rotation: 0, scale: 1, flip: false, slotId: null }],
      },
    };
    const clean = sanitizeProgress(raw, registry, now);
    expect(clean.reef.owned).toContain("coral-cerebro");
  });

  it("caps the reef so a save can never grow without bound", () => {
    const placed = Array.from({ length: 400 }, (_, index) => ({
      instanceId: `d${index + 1}`,
      defId: "coral-cerebro",
      x: 5,
      y: 5,
      rotation: 0,
      scale: 1,
      flip: false,
      slotId: null,
    }));
    const clean = sanitizeProgress({ saveVersion: SAVE_VERSION, reef: { placed } }, registry, now);
    expect(clean.reef.placed).toHaveLength(MAX_PLACED_DECORATIONS);
  });

  it("migrates a v2 document without losing what was already there", () => {
    const v2 = {
      saveVersion: 2,
      completedLevels: ["recife-1"],
      levelStars: { "recife-1": { stars: 2, objectives: [true, true, false], completions: 1, best: null } },
      currency: { shells: 120, lifetimeShells: 200 },
    };
    const save = new SaveManager(memoryStorage({ [SAVE_KEY]: JSON.stringify(v2) }), { registry });
    expect(save.progress.saveVersion).toBe(SAVE_VERSION);
    expect(save.status.migratedFrom).toBe(2);
    expect(save.progress.completedLevels).toEqual(["recife-1"]);
    expect(save.progress.levelStars["recife-1"].stars).toBe(2);
    expect(save.progress.currency).toEqual({ shells: 120, lifetimeShells: 200 });
    expect(save.progress.reef.placed).toEqual([]);
  });

  /**
   * A armadilha desta feature: `sanitizeProgress` reconstrói o documento campo a campo, e um campo
   * que ela não reconstrói é apagado na gravação SEGUINTE, sem erro nenhum. Este teste grava, recarrega
   * de um storage de verdade e confere que o Recife sobreviveu à ida e à volta.
   */
  it("survives a write and a reload", () => {
    const storage = memoryStorage();
    const save = new SaveManager(storage, { registry });
    save.update((draft) => {
      placeDecoration(draft, "coral-cerebro", { slotId: "coral-a", x: 28, y: 58, rotation: 4, scale: 1.1, flip: true });
      draft.reef.lastSeenStage = 2;
      draft.reef.servedSlots.push("coral-a");
    });
    const written = save.progress.reef;
    expect(written.placed).toHaveLength(1);

    // Uma segunda gravação, sem tocar no Recife: é aqui que um campo esquecido some.
    save.update((draft) => draft.completedLevels.push("recife-1"));
    expect(save.progress.reef).toEqual(written);

    const reloaded = new SaveManager(storage, { registry });
    expect(reloaded.progress.reef).toEqual(written);
    expect(reloaded.progress.reef.placed[0]).toMatchObject({ defId: "coral-cerebro", slotId: "coral-a", flip: true });
    expect(reloaded.progress.reef.servedSlots).toEqual(["coral-a"]);
    expect(reloaded.progress.reef.lastSeenStage).toBe(2);
  });
});
