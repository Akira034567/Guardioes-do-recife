import { STORY_SEQUENCES, type StorySequence } from "../../../data/story";
import { hasSeenStory, markStorySeen } from "../../../systems/story";
import { button, h } from "../h";
import type { Screen, ScreenHost } from "../ScreenHost";

/**
 * Visualizador de história (item 31): um trecho por vez, com "CONTINUAR" e "PULAR". Ao chegar ao fim
 * (ou ao pular) a sequência fica marcada como lida e pode ser revista pelo menu de histórias.
 */
export function storyScreen(sequence: StorySequence, onFinish: () => void): Screen {
  let index = 0;
  return {
    id: "story",
    render() {
      const root = h("div", {});
      const panel = h("div", { class: "gr-panel gr-panel--story", testId: "story-panel", dataStory: sequence.id });
      root.append(panel);

      const finish = (): void => {
        markStorySeen(sequence.id);
        onFinish();
      };

      const draw = (): void => {
        const slide = sequence.slides[index];
        const parts: Node[] = [
          h("span", { class: "gr-badge", text: `${index + 1} de ${sequence.slides.length}` }),
          h("h1", { class: "gr-title", text: sequence.title }),
        ];
        if (slide.speaker) parts.push(h("p", { class: "gr-subtitle", text: slide.speaker }));
        panel.replaceChildren(
          ...parts,
          h("p", { class: "gr-story__text", testId: "story-text", text: slide.text }),
          h(
            "div",
            { class: "gr-actions" },
            button("PULAR", finish, { testId: "story-skip" }),
            button(index + 1 < sequence.slides.length ? "CONTINUAR" : "SEGUIR EM FRENTE", () => {
              if (index + 1 < sequence.slides.length) {
                index += 1;
                draw();
                return;
              }
              finish();
            }, { testId: "story-next", variant: "primary" }),
          ),
        );
      };

      draw();
      return root;
    },
  };
}

/** Índice das histórias: as lidas podem ser revistas; as demais ficam em "???". */
export function storyIndexScreen(onBack: () => void): Screen {
  return {
    id: "story-index",
    render(host: ScreenHost) {
      const read = STORY_SEQUENCES.filter((sequence) => hasSeenStory(sequence.id)).length;
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel", testId: "story-index" },
          h("span", { class: "gr-badge", text: `${read} de ${STORY_SEQUENCES.length} capítulos` }),
          h("h1", { class: "gr-title", text: "HISTÓRIAS DO RECIFE" }),
          h("p", { class: "gr-subtitle", text: "Tudo o que o Recife já viveu, para reler quando quiser." }),
          h(
            "ul",
            { class: "gr-objectives" },
            ...STORY_SEQUENCES.map((sequence) => {
              const seen = hasSeenStory(sequence.id);
              return h(
                "li",
                { class: "gr-objective", testId: `story-entry-${sequence.id}`, dataState: seen ? "read" : "locked" },
                h("span", { class: "gr-objective__mark", text: seen ? "✦" : "·" }),
                h(
                  "span",
                  {},
                  h("strong", { text: seen ? sequence.title : "???" }),
                  h("br"),
                  h("span", { class: "gr-hint", text: seen ? sequence.summary : "Ainda não vivida." }),
                ),
                seen ? button("RELER", () => host.push(storyScreen(sequence, () => host.pop())), { testId: `story-read-${sequence.id}` }) : null,
              );
            }),
          ),
          h("div", { class: "gr-actions" }, button("VOLTAR", onBack, { testId: "story-index-back" })),
        ),
      );
    },
  };
}
