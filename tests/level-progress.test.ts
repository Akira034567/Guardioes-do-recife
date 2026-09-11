import { describe, expect, it } from "vitest";
import { LevelProgress, PROGRESS_STORAGE_KEY, type ProgressStorage } from "../src/game/core/LevelProgress";

const memoryStorage = (initial: Record<string, string> = {}): ProgressStorage & { data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
};

const ids = ["recife-1", "recife-2", "recife-3"];

describe("LevelProgress", () => {
  it("unlocks only the first level at the start", () => {
    const progress = new LevelProgress(ids);
    expect(progress.isUnlocked("recife-1")).toBe(true);
    expect(progress.isUnlocked("recife-2")).toBe(false);
    expect(progress.isUnlocked("recife-3")).toBe(false);
    expect(progress.isUnlocked("desconhecida")).toBe(false);
  });

  it("unlocks the next level when the previous one is completed and persists it", () => {
    const storage = memoryStorage();
    const progress = new LevelProgress(ids, storage);
    expect(progress.complete("recife-1")).toBe("recife-2");
    expect(progress.isUnlocked("recife-2")).toBe(true);
    expect(progress.isUnlocked("recife-3")).toBe(false);
    expect(progress.isCompleted("recife-1")).toBe(true);
    expect(JSON.parse(storage.data[PROGRESS_STORAGE_KEY])).toEqual({ completed: ["recife-1"] });

    const reloaded = new LevelProgress(ids, storage);
    expect(reloaded.isUnlocked("recife-2")).toBe(true);
    expect(reloaded.complete("recife-3")).toBeNull();
    expect(reloaded.completed).toEqual(["recife-1", "recife-3"]);
  });

  it("ignores unknown ids, corrupted storage and can be reset", () => {
    const storage = memoryStorage({ [PROGRESS_STORAGE_KEY]: "{not json" });
    const progress = new LevelProgress(ids, storage);
    expect(progress.completed).toEqual([]);
    expect(progress.complete("fase-fantasma")).toBeNull();
    progress.complete("recife-1");
    progress.reset();
    expect(progress.isUnlocked("recife-2")).toBe(false);
    expect(JSON.parse(storage.data[PROGRESS_STORAGE_KEY])).toEqual({ completed: [] });
  });

  it("drops stored ids that no longer exist in the registry", () => {
    const storage = memoryStorage({ [PROGRESS_STORAGE_KEY]: JSON.stringify({ completed: ["recife-1", "removida"] }) });
    const progress = new LevelProgress(ids, storage);
    expect(progress.completed).toEqual(["recife-1"]);
  });
});
