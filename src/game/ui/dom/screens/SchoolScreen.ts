import { enemyPortraitPath } from "../../../assets/enemyArt";
import { artPath, GUARDIAN_ART } from "../../../assets/guardianArt";
import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import { statusIconPath } from "../../../assets/statusArt";
import { ENEMIES } from "../../../data/enemies";
import { LEVELS } from "../../../data/levels";
import { COURSES, LESSONS, lessonsOf, type Course, type Lesson, type LessonArt } from "../../../data/school";
import { hasReadLesson, markLessonRead, schoolProgress } from "../../../systems/school";
import { fill, h } from "../h";
import { ICONS } from "../icons";
import { preserveScroll } from "../scroll";
import type { Screen } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

/**
 * ESCOLA DO RECIFE — o manual.
 *
 * Existe porque o Álbum e as Ameaças CATALOGAM e nunca EXPLICAM. Lá o jogador descobre que o Cascudo
 * tem armadura 9; aqui ele descobre que isso corta 36% de cada golpe e que a resposta é dano que
 * ignora armadura. Lá ele vê o ícone de caveira em cima do inimigo; aqui ele descobre que veneno é o
 * único efeito do jogo que acumula.
 *
 * Nada é bloqueado, de propósito: um manual que esconde a página de que você precisa não é um
 * manual. O que a tela guarda é só o que já foi LIDO, para marcar o que é novo.
 */

/** A ilustração da aula. Cada tipo vem de uma pasta diferente de arte já existente. */
function lessonArt(art: LessonArt): HTMLElement {
  switch (art.kind) {
    case "guardian": {
      const profile = GUARDIAN_ART[art.id];
      // O `idle` é a criatura limpa; o `portrait` traz a moldura do card, que aqui competiria com a aula.
      return h("img", { class: "gr-school__art", src: artPath(art.id, profile.base, "idle"), alt: "" });
    }
    case "status":
      return h("img", { class: "gr-school__art gr-school__art--icon", src: statusIconPath(art.icon), alt: "" });
    case "enemy": {
      const path = enemyPortraitPath(ENEMIES[art.id]);
      return path
        ? h("img", { class: "gr-school__art", src: path, alt: "" })
        : h("span", { class: "gr-icon gr-icon--lg", html: ICONS.skull });
    }
    case "icon":
      return h("span", { class: "gr-icon gr-icon--lg gr-school__art--glyph", html: glyph(art.name) });
  }
}

/** Pictograma por nome. `ICONS.difficulty` é função, não string, então só valem os desenhos fixos. */
function glyph(name: string): string {
  const icon = ICONS[name as keyof typeof ICONS];
  return typeof icon === "string" ? icon : ICONS.book;
}

function courseIcon(course: Course): string {
  return glyph(course.icon);
}

export interface SchoolScreenOptions {
  /** Abre a Escola já nesta aula — é por aqui que o momento em campo aponta para o manual. */
  focus?: string;
}

export function schoolScreen(onBack: () => void, nav?: ShellNav, options: SchoolScreenOptions = {}, embedded = false): Screen {
  const initial = options.focus && LESSONS.some((lesson) => lesson.id === options.focus) ? options.focus : LESSONS[0].id;
  let chosenId = initial;

  return {
    id: "school",
    render() {
      const root = h("div", { class: `gr-album gr-album--school${embedded ? " gr-album--embedded" : ""}`, testId: "school-panel" });
      const art = levelBackgroundPath(LEVELS[0].backgroundKey);
      if (art && !embedded) root.append(h("div", { class: "gr-world__backdrop", style: `background-image:url(${art})` }));
      if (!embedded && nav) root.append(shellSidebar("school", nav, { navId: (section) => `school-${section}`, back: onBack, backId: "school-back" }));
      const layout = h("div", { class: "gr-album__layout" });
      root.append(layout);

      const redraw = (): void => {
        const progress = schoolProgress();
        root.dataset.read = String(progress.read);

        const list = h("div", { class: "gr-album__list gr-school__list", testId: "school-list" });
        list.append(
          h(
            "div",
            { class: "gr-school__progress", testId: "school-progress" },
            h("strong", { text: `${progress.read}/${progress.total} aulas lidas` }),
            h("span", { class: "gr-hint", text: "Nada aqui é bloqueado. Leia na ordem que quiser." }),
          ),
        );

        for (const course of COURSES) {
          list.append(
            h(
              "div",
              { class: "gr-school__course", testId: `school-course-${course.id}` },
              h("span", { class: "gr-icon", html: courseIcon(course) }),
              h("div", {}, h("strong", { text: course.title }), h("span", { class: "gr-hint", text: course.summary })),
            ),
          );
          for (const lesson of lessonsOf(course.id)) {
            const read = hasReadLesson(lesson.id);
            list.append(
              h(
                "button",
                {
                  class: `gr-album__item gr-school__item${lesson.id === chosenId ? " gr-album__item--on" : ""}`,
                  testId: `school-lesson-${lesson.id}`,
                  dataState: read ? "read" : "new",
                  type: "button",
                  onClick: () => {
                    chosenId = lesson.id;
                    markLessonRead(lesson.id);
                    redraw();
                  },
                },
                h("span", { class: "gr-album__item-name", text: lesson.title }),
                read ? null : h("span", { class: "gr-school__new", text: "NOVO" }),
              ),
            );
          }
        }

        const lesson = LESSONS.find((candidate) => candidate.id === chosenId) ?? LESSONS[0];
        const detail = h("div", { class: "gr-album__detail gr-school__detail", testId: "school-lesson" });
        detail.dataset.lesson = lesson.id;

        detail.append(
          h(
            "div",
            { class: "gr-school__head" },
            lessonArt(lesson.art),
            h("div", {}, h("h2", { class: "gr-album__title", text: lesson.title }), h("p", { class: "gr-album__lead", text: lesson.summary })),
          ),
        );

        const points = h("ul", { class: "gr-school__points" });
        for (const point of lesson.points) points.append(h("li", { text: point }));
        detail.append(points);

        // A regra é a razão de a aula existir: ela fica em destaque, não na letra miúda.
        detail.append(
          h(
            "div",
            { class: "gr-school__rule", testId: "school-rule" },
            h("span", { class: "gr-school__rule-tag", text: "A REGRA" }),
            h("span", { text: lesson.rule }),
          ),
        );

        fill(layout, list, detail);
      };

      // Abrir a Escola numa aula conta como ler aquela aula.
      markLessonRead(chosenId);
      preserveScroll(layout, redraw);
      redraw();
      return root;
    },
  };
}

export type { Lesson };
