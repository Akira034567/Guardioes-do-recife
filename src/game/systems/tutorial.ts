import { getSaveManager } from "./ProgressStore";

/**
 * Estado do tutorial no save. A `GameScene` escreve o progresso conforme os passos acontecem; aqui
 * fica só o que as telas de menu precisam — ver e zerar.
 */
export function tutorialDone(): boolean {
  return getSaveManager().progress.tutorial.done || getSaveManager().progress.tutorial.skipped;
}

/**
 * Zera o tutorial inteiro: os seis passos do primeiro jogo, os momentos que já dispararam em campo e
 * as aulas marcadas como lidas na Escola. É tudo ou nada de propósito — quem pede para rever o
 * tutorial quer rever o tutorial, não metade dele.
 */
export function resetTutorial(): void {
  getSaveManager().update((draft) => {
    draft.tutorial = { completedSteps: [], done: false, skipped: false, seenMoments: [], seenLessons: [] };
  });
}
