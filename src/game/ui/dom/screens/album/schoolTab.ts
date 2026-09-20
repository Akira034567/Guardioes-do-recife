import { enemyPortraitPath } from "../../../../assets/enemyArt";
import { artPath, GUARDIAN_ART } from "../../../../assets/guardianArt";
import { statusIconPath } from "../../../../assets/statusArt";
import { ENEMIES } from "../../../../data/enemies";
import { COURSES, LESSONS, lessonsOf, type Course, type Lesson, type LessonArt } from "../../../../data/school";
import { hasReadLesson, markLessonRead } from "../../../../systems/school";
import { h } from "../../h";
import { ICONS } from "../../icons";
import type { AlbumEntry } from "./entry";

/**
 * ESCOLA DO RECIFE, agora como uma aba do Álbum.
 *
 * Era uma tela própria, com lista de texto à esquerda e um bloco de prosa à direita — nada parecido
 * com o resto do jogo. Aqui ela usa a MESMA carta ilustrada e a MESMA ficha das outras abas: a aula
 * vira uma carta com a arte de quem ela ensina, e a ficha traz o resumo, os pontos e a regra.
 *
 * Nada continua bloqueado, de propósito: um manual que esconde a página de que você precisa não é um
 * manual. O que a aba guarda é só o que já foi LIDO, para marcar o que é novo.
 */

/** A ilustração da aula. Cada tipo vem de uma pasta diferente de arte já existente. */
function lessonArtPath(art: LessonArt): string | null {
  switch (art.kind) {
    case "guardian":
      // O `idle` é a criatura limpa; o `portrait` traz a moldura do card, que aqui competiria com a carta.
      return artPath(art.id, GUARDIAN_ART[art.id].base, "idle");
    case "status":
      return statusIconPath(art.icon);
    case "enemy":
      return enemyPortraitPath(ENEMIES[art.id]);
    case "icon":
      return null;
  }
}

/** Pictograma por nome. `ICONS.difficulty` é função, não string, então só valem os desenhos fixos. */
export function glyph(name: string): string {
  const icon = ICONS[name as keyof typeof ICONS];
  return typeof icon === "string" ? icon : ICONS.book;
}

const courseOf = (lesson: Lesson): Course | undefined => COURSES.find((course) => lessonsOf(course.id).some((candidate) => candidate.id === lesson.id));

export function schoolEntries(): AlbumEntry[] {
  // A ordem é a dos cursos, não a do arquivo: a grade fica lida de cima para baixo como uma apostila.
  const ordered = COURSES.flatMap((course) => lessonsOf(course.id));
  const rest = LESSONS.filter((lesson) => !ordered.some((candidate) => candidate.id === lesson.id));
  return [...ordered, ...rest].map((lesson) => {
    const read = hasReadLesson(lesson.id);
    const course = courseOf(lesson);
    return {
      id: lesson.id,
      name: lesson.title,
      subtitle: course?.title ?? "Aula avulsa",
      // Aula nenhuma é bloqueada: a carta está sempre acesa, e o que muda é a etiqueta.
      found: true,
      hidden: false,
      art: lessonArtPath(lesson.art),
      icon: lesson.art.kind === "icon" ? glyph(lesson.art.name) : ICONS.book,
      hint: lesson.summary,
      progress: null,
      group: course?.title ?? "Aulas avulsas",
      state: read ? "read" : "new",
      chip: read ? { label: "Lida", icon: ICONS.book, tone: "read" } : { label: "Nova", icon: ICONS.star, tone: "new" },
      // Abrir a aula é ler a aula: é o mesmo gesto, e o contador do topo anda junto.
      onOpen: () => markLessonRead(lesson.id),
      sheet: () => lessonSheet(lesson, course),
    };
  });
}

function lessonSheet(lesson: Lesson, course: Course | undefined): HTMLElement {
  return h(
    "section",
    { class: "gr-album__sheet gr-album__sheet--lesson", testId: "school-lesson", dataLesson: lesson.id },
    h(
      "div",
      { class: "gr-album__banner" },
      (() => {
        const art = lessonArtPath(lesson.art);
        return art
          ? h("img", { class: "gr-album__banner-art", src: art, alt: "" })
          : h("span", { class: "gr-icon gr-icon--lg", html: lesson.art.kind === "icon" ? glyph(lesson.art.name) : ICONS.book });
      })(),
    ),
    h(
      "div",
      { class: "gr-album__sheet-head" },
      course ? h("span", { class: "gr-badge", text: course.title }) : null,
      h("h2", { class: "gr-album__sheet-name", text: lesson.title }),
      h("p", { class: "gr-subtitle", text: lesson.summary }),
    ),
    h("ul", { class: "gr-album__skills", testId: "school-points" }, ...lesson.points.map((point) => h("li", { text: point }))),
    // A regra é a razão de a aula existir: ela fica em destaque, não na letra miúda.
    h(
      "div",
      { class: "gr-school__rule", testId: "school-rule" },
      h("span", { class: "gr-school__rule-tag", text: "A REGRA" }),
      h("span", { text: lesson.rule }),
    ),
  );
}

/** Os cursos, para a faixa de contexto do topo da aba. */
export function schoolCourses(): readonly Course[] {
  return COURSES;
}
