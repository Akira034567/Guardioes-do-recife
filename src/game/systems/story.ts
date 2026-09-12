import { storyFor, type StorySequence, type StoryTrigger } from "../data/story";
import { getSaveManager } from "./ProgressStore";

/** Histórias já lidas ficam no save (`storyProgress.seen`). */
export function hasSeenStory(id: string): boolean {
  return getSaveManager().progress.storyProgress.seen.includes(id);
}

export function markStorySeen(id: string): void {
  getSaveManager().update((draft) => {
    if (!draft.storyProgress.seen.includes(id)) draft.storyProgress.seen.push(id);
  });
}

/** A sequência de um gatilho, só quando o jogador ainda não a viu. */
export function pendingStory(trigger: StoryTrigger): StorySequence | undefined {
  const sequence = storyFor(trigger);
  return sequence && !hasSeenStory(sequence.id) ? sequence : undefined;
}
