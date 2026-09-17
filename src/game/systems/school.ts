import { LESSONS } from "../data/school";
import { getSaveManager } from "./ProgressStore";

/**
 * Leitura da Escola do Recife no save. Nenhuma aula é bloqueada — o que se guarda é só o que já foi
 * LIDO, para a lista marcar o que é novo e o rodapé contar o progresso.
 */
export function seenLessons(): readonly string[] {
  return getSaveManager().progress.tutorial.seenLessons;
}

export function hasReadLesson(id: string): boolean {
  return getSaveManager().progress.tutorial.seenLessons.includes(id);
}

export function markLessonRead(id: string): void {
  getSaveManager().update((draft) => {
    if (!draft.tutorial.seenLessons.includes(id)) draft.tutorial.seenLessons.push(id);
  });
}

/** Quantas aulas o jogador já leu, para o "12/25" do cabeçalho. */
export function schoolProgress(): { read: number; total: number } {
  const read = new Set(getSaveManager().progress.tutorial.seenLessons);
  return { read: LESSONS.filter((lesson) => read.has(lesson.id)).length, total: LESSONS.length };
}

/** Momentos já ensinados em campo, para a fila não repetir entre partidas. */
export function seenMoments(): readonly string[] {
  return getSaveManager().progress.tutorial.seenMoments;
}

export function saveSeenMoments(ids: readonly string[]): void {
  getSaveManager().update((draft) => {
    draft.tutorial.seenMoments = [...ids];
  });
}
