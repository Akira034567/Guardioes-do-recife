import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "../src/game/data/levels";
import { STORY_SEQUENCES, storyFor, storySequence } from "../src/game/data/story";
import { hasSeenStory, markStorySeen, pendingStory } from "../src/game/systems/story";

describe("story sequences", () => {
  it("keeps ids unique and every slide with text", () => {
    const ids = STORY_SEQUENCES.map((sequence) => sequence.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sequence of STORY_SEQUENCES) {
      expect(sequence.slides.length, sequence.id).toBeGreaterThan(0);
      for (const slide of sequence.slides) expect(slide.text.length, sequence.id).toBeGreaterThan(30);
    }
  });

  it("points every level trigger at a level that exists", () => {
    for (const sequence of STORY_SEQUENCES) {
      if (sequence.trigger.type === "manual") continue;
      expect(LEVEL_IDS, sequence.id).toContain(sequence.trigger.levelId);
    }
  });

  it("opens every level with a chapter", () => {
    for (const levelId of LEVEL_IDS) {
      expect(storyFor({ type: "levelIntro", levelId }), levelId).toBeDefined();
    }
  });

  it("finds a sequence by id and by trigger", () => {
    expect(storySequence("abertura")?.title).toBe("A maré que mudou");
    expect(storySequence("nao-existe")).toBeUndefined();
    expect(storyFor({ type: "levelOutro", levelId: "recife-6" })?.id).toBe("recife-protegido");
    expect(storyFor({ type: "levelOutro", levelId: "recife-1" })).toBeUndefined();
  });

  it("stops offering a chapter once it has been read", () => {
    const trigger = { type: "levelIntro", levelId: "recife-3" } as const;
    expect(pendingStory(trigger)?.id).toBe("gruta-fria");
    markStorySeen("gruta-fria");
    expect(hasSeenStory("gruta-fria")).toBe(true);
    expect(pendingStory(trigger)).toBeUndefined();
  });
});
