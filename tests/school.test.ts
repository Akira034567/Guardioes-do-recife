import { describe, expect, it } from "vitest";
import { COURSES, LESSONS, LESSONS_BY_ID, lessonForGuardian, lessonsOf } from "../src/game/data/school";
import { GUARDIANS, GUARDIAN_ORDER } from "../src/game/data/guardians";
import { ENEMIES } from "../src/game/data/enemies";
import { STATUS_ICONS } from "../src/game/assets/statusArt";

describe("catálogo da Escola do Recife", () => {
  it("não repete id de aula", () => {
    const ids = LESSONS.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo curso tem aula e toda aula tem curso", () => {
    for (const course of COURSES) expect(lessonsOf(course.id).length, course.id).toBeGreaterThan(0);
    const known = new Set(COURSES.map((course) => course.id));
    for (const lesson of LESSONS) expect(known.has(lesson.course), lesson.id).toBe(true);
  });

  /**
   * A `rule` é a razão de a aula existir: é o número exato que o Álbum e as Ameaças não dão. Uma aula
   * sem ela virou texto de sabor e devia estar no lore, não aqui.
   */
  it("toda aula tem corpo e uma regra com número", () => {
    for (const lesson of LESSONS) {
      expect(lesson.points.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.summary.length, lesson.id).toBeGreaterThan(10);
      expect(lesson.rule, lesson.id).toMatch(/\d/);
    }
  });

  it("a arte de cada aula aponta para algo que existe", () => {
    for (const lesson of LESSONS) {
      const art = lesson.art;
      if (art.kind === "guardian") expect(GUARDIANS[art.id], lesson.id).toBeDefined();
      if (art.kind === "enemy") expect(ENEMIES[art.id], lesson.id).toBeDefined();
      if (art.kind === "status") expect(STATUS_ICONS, lesson.id).toContain(art.icon);
    }
  });
});

describe("cobertura", () => {
  it("todo Guardião jogável tem a própria aula", () => {
    for (const guardianId of GUARDIAN_ORDER) {
      const lesson = lessonForGuardian(guardianId);
      expect(lesson, guardianId).not.toBeNull();
      expect(lesson?.title, guardianId).toContain(GUARDIANS[guardianId].shortName);
    }
  });

  /**
   * Os cinco ícones aparecem em cima do inimigo desde a V3.1 e até agora não havia UM lugar no jogo
   * que dissesse o que cada um significa. Este teste existe para impedir que um ícone novo entre em
   * campo sem a aula dele.
   */
  it("todo ícone de status tem aula", () => {
    for (const icon of STATUS_ICONS) {
      const lesson = LESSONS.find((candidate) => candidate.art.kind === "status" && candidate.art.icon === icon);
      expect(lesson, icon).toBeDefined();
    }
  });

  it("a aula citada por um Guardião existe no mapa de ids", () => {
    for (const lesson of LESSONS) expect(LESSONS_BY_ID.get(lesson.id)).toBe(lesson);
  });
});
