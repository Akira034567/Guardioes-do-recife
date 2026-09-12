import { describe, expect, it } from "vitest";
import { PROGRESS_STORAGE_KEY } from "../src/game/core/LevelProgress";
import { SAVE_VERSION } from "../src/game/core/save/PlayerProgress";
import { SAVE_KEY, SaveManager, type SaveStorage } from "../src/game/core/save/SaveManager";
import { REWARDS } from "../src/game/data/progression";

const registry = {
  levelIds: ["recife-1", "recife-2", "recife-3"],
  guardianIds: ["pistol-shrimp", "jellyfish", "shark"],
  enemyIds: ["swimmer", "tidebreaker"],
  defaultUnlockedGuardians: ["pistol-shrimp", "jellyfish"],
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

const clock = (iso: string) => () => new Date(iso);

describe("SaveManager", () => {
  it("starts from defaults on empty storage and only writes after the first update", () => {
    const storage = memoryStorage();
    const save = new SaveManager(storage, { registry, now: clock("2026-09-12T10:00:00Z") });
    expect(save.status).toEqual({ source: "storage", migratedFrom: null, corrupted: false });
    expect(save.progress.saveVersion).toBe(SAVE_VERSION);
    expect(save.progress.unlockedGuardians).toEqual(["pistol-shrimp", "jellyfish"]);
    expect(storage.data[SAVE_KEY]).toBeUndefined();
    save.update((draft) => {
      draft.currency.shells += 10;
    });
    expect(JSON.parse(storage.data[SAVE_KEY]).currency.shells).toBe(10);
  });

  it("round-trips through storage and advances updatedAt", () => {
    const storage = memoryStorage();
    const first = new SaveManager(storage, { registry, now: clock("2026-09-12T10:00:00Z") });
    first.update((draft) => {
      draft.completedLevels.push("recife-1");
      draft.settings.muted = true;
      draft.discoveredSecrets.push("recife-4:pedra-que-pisca");
    });
    const second = new SaveManager(storage, { registry, now: clock("2026-09-12T11:00:00Z") });
    expect(second.progress).toEqual(first.progress);
    expect(second.progress.updatedAt).toBe("2026-09-12T10:00:00.000Z");
    expect(second.progress.settings.muted).toBe(true);
    expect(second.progress.discoveredSecrets).toEqual(["recife-4:pedra-que-pisca"]);
  });

  it("migrates the v1 progress key into stars and shells without deleting it", () => {
    const legacy = JSON.stringify({ completed: ["recife-1", "recife-2", "removida"] });
    const storage = memoryStorage({ [PROGRESS_STORAGE_KEY]: legacy });
    const save = new SaveManager(storage, { registry, now: clock("2026-09-12T10:00:00Z") });
    expect(save.status.migratedFrom).toBe(1);
    expect(save.progress.completedLevels).toEqual(["recife-1", "recife-2"]);
    expect(save.progress.levelStars["recife-1"]).toMatchObject({ stars: 1, objectives: [true, false, false], completions: 1 });
    expect(save.progress.currency.shells).toBe(2 * REWARDS.firstCompletion);
    expect(storage.data[PROGRESS_STORAGE_KEY]).toBe(legacy);
    expect(storage.data[SAVE_KEY]).toBeDefined();
    // Na próxima carga o documento novo já existe: nenhuma migração roda de novo.
    const reloaded = new SaveManager(storage, { registry, now: clock("2026-09-12T12:00:00Z") });
    expect(reloaded.status.migratedFrom).toBeNull();
    expect(reloaded.progress.currency.shells).toBe(2 * REWARDS.firstCompletion);
  });

  it("recovers from corrupted JSON, keeps a backup and flags it", () => {
    const storage = memoryStorage({ [SAVE_KEY]: "{not json" });
    const save = new SaveManager(storage, { registry, now: clock("2026-09-12T10:00:00Z") });
    expect(save.status.corrupted).toBe(true);
    expect(save.progress.completedLevels).toEqual([]);
    expect(storage.data[`${SAVE_KEY}.corrupt`]).toBe("{not json");
  });

  it("works in memory without storage and never throws on a failing storage", () => {
    const memory = new SaveManager(null, { registry });
    expect(memory.status.source).toBe("memory");
    memory.update((draft) => draft.completedLevels.push("recife-1"));
    expect(memory.progress.completedLevels).toEqual(["recife-1"]);

    const broken: SaveStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const save = new SaveManager(broken, { registry });
    expect(() => save.update((draft) => draft.completedLevels.push("recife-1"))).not.toThrow();
    expect(save.progress.completedLevels).toEqual(["recife-1"]);
  });

  it("drops unknown ids and fills missing fields from newer or older documents", () => {
    const document = {
      saveVersion: 2,
      completedLevels: ["recife-1", "fase-fantasma", 42],
      unlockedGuardians: ["shark", "kraken"],
      levelStars: { "recife-9": { stars: 3 }, "recife-2": { stars: 7, objectives: [true, true, "x"] } },
      settings: { masterVolume: 4, uiScale: "huge" },
      totals: { matches: "muitos" },
      futureField: { ignored: true },
    };
    const save = new SaveManager(memoryStorage({ [SAVE_KEY]: JSON.stringify(document) }), { registry });
    expect(save.progress.completedLevels).toEqual(["recife-1"]);
    expect(save.progress.unlockedGuardians).toEqual(["pistol-shrimp", "jellyfish", "shark"]);
    expect(Object.keys(save.progress.levelStars)).toEqual(["recife-2"]);
    expect(save.progress.levelStars["recife-2"]).toMatchObject({ stars: 3, objectives: [true, true, false] });
    expect(save.progress.settings.masterVolume).toBe(1);
    expect(save.progress.settings.uiScale).toBe("normal");
    expect(save.progress.totals.matches).toBe(0);
    expect("futureField" in save.progress).toBe(false);
  });

  it("exposes the legacy level-progress API over the new document", () => {
    const storage = memoryStorage();
    const save = new SaveManager(storage, { registry });
    const progress = save.levelProgress();
    expect(progress.isUnlocked("recife-1")).toBe(true);
    expect(progress.isUnlocked("recife-2")).toBe(false);
    expect(progress.isUnlocked("desconhecida")).toBe(false);
    expect(progress.complete("recife-1")).toBe("recife-2");
    expect(progress.isUnlocked("recife-2")).toBe(true);
    expect(progress.isCompleted("recife-1")).toBe(true);
    expect(progress.complete("fase-fantasma")).toBeNull();
    expect(progress.complete("recife-3")).toBeNull();
    expect(progress.completed).toEqual(["recife-1", "recife-3"]);
    expect(save.progress.levelStars["recife-1"]).toMatchObject({ stars: 1, completions: 1 });
    progress.complete("recife-1");
    expect(save.progress.levelStars["recife-1"].completions).toBe(2);

    const reloaded = new SaveManager(storage, { registry }).levelProgress();
    expect(reloaded.isUnlocked("recife-2")).toBe(true);
    reloaded.reset();
    expect(reloaded.isUnlocked("recife-2")).toBe(false);
    expect(JSON.parse(storage.data[SAVE_KEY]).completedLevels).toEqual([]);
  });
});
