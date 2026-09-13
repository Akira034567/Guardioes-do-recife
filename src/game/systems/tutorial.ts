import { getSaveManager } from "./ProgressStore";

/**
 * Estado do tutorial no save. A `GameScene` escreve o progresso conforme os passos acontecem; aqui
 * fica só o que as telas de menu precisam — ver e zerar.
 */
export function tutorialDone(): boolean {
  return getSaveManager().progress.tutorial.done || getSaveManager().progress.tutorial.skipped;
}

/** Zera as dicas do tutorial: a próxima partida volta a explicar o básico. */
export function resetTutorial(): void {
  getSaveManager().update((draft) => {
    draft.tutorial = { completedSteps: [], done: false, skipped: false };
  });
}
