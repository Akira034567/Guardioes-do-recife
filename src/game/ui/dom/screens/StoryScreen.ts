import { artPath, GUARDIAN_ART } from "../../../assets/guardianArt";
import { GUARDIANS } from "../../../data/guardians";
import { getLevel } from "../../../data/levels";
import { STORY_SEQUENCES, type StorySequence } from "../../../data/story";
import { hasSeenStory, markStorySeen } from "../../../systems/story";
import { fill, button, h } from "../h";
import { preserveScroll } from "../scroll";
import { ICONS } from "../icons";
import type { Screen, ScreenHost } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

/**
 * Visualizador de história (item 31): um trecho por vez, com "CONTINUAR" e "PULAR". Ao chegar ao fim
 * (ou ao pular) a sequência fica marcada como lida e pode ser revista pelo menu de histórias.
 */
export function storyScreen(sequence: StorySequence, onFinish: () => void): Screen {
  let index = 0;
  return {
    id: "story",
    render() {
      const root = h("div", { class: "gr-story" });
      const panel = h("div", { class: "gr-panel gr-panel--story", testId: "story-panel", dataStory: sequence.id });
      root.append(panel);

      const finish = (): void => {
        markStorySeen(sequence.id);
        onFinish();
      };

      const redraw = (): void => {
        const slide = sequence.slides[index];
        panel.classList.toggle("gr-panel--comic", Boolean(slide.image));
        panel.classList.remove("gr-panel--zoom");
        const parts: Node[] = [
          h("span", { class: "gr-badge", text: `${index + 1} de ${sequence.slides.length}` }),
          h("h1", { class: "gr-title", text: sequence.title }),
        ];
        if (slide.speaker) parts.push(h("p", { class: "gr-subtitle", text: slide.speaker }));
        // Página de quadrinho: a imagem é o capítulo e a transcrição fica como texto alternativo.
        // Tocar na página alterna entre caber na tela e a largura cheia (celular deitado).
        const body = slide.image
          ? h(
              "button",
              {
                class: "gr-story__page",
                type: "button",
                testId: "story-page",
                "aria-label": "Ampliar a página",
                onClick: () => panel.classList.toggle("gr-panel--zoom"),
              },
              h("img", { class: "gr-story__image", src: slide.image, alt: slide.text, testId: "story-text" }),
            )
          : h("p", { class: "gr-story__text", testId: "story-text", text: slide.text });
        const next = sequence.slides[index + 1];
        if (next?.image) new Image().src = next.image;
        panel.replaceChildren(
          ...parts,
          body,
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

      // Clicar num card reconstrói o miolo. A rolagem da grade e o foco do botão são
      // repostos em volta disso, senão a tela salta para o topo a cada escolha (item 6).
      const draw = (): void => preserveScroll(root, redraw);

      redraw();
      return root;
    },
  };
}

/**
 * Onde cada capítulo está na vida do jogador: `read` já foi vivido, `pending` está prestes a
 * acontecer (a fase dele já abriu) e `locked` ainda depende de a campanha avançar.
 */
type StoryState = "read" | "pending" | "locked";

type StoryFilter = "all" | "read" | "pending" | "locked";

const FILTERS: ReadonlyArray<{ id: StoryFilter; label: string; icon: string }> = [
  { id: "all", label: "Todas", icon: ICONS.book },
  { id: "read", label: "Descobertas", icon: ICONS.compass },
  { id: "pending", label: "Em andamento", icon: ICONS.timer },
  { id: "locked", label: "Não descobertas", icon: ICONS.lock },
];

const STATE_LABELS: Record<StoryState, string> = {
  read: "Descoberta",
  pending: "Em andamento",
  locked: "Ainda não vivida.",
};

/** A fase a que o capítulo está preso, quando ele tem uma. */
function levelIdOf(sequence: StorySequence): string | null {
  return "levelId" in sequence.trigger ? sequence.trigger.levelId : null;
}

function stateOf(sequence: StorySequence, isUnlocked: (levelId: string) => boolean): StoryState {
  if (hasSeenStory(sequence.id)) return "read";
  const levelId = levelIdOf(sequence);
  if (!levelId) return "pending";
  return isUnlocked(levelId) ? "pending" : "locked";
}

/** Arte do Guardião que fala no capítulo, em silhueta até ser vivido. */
function guardianArt(sequence: StorySequence): string | null {
  if (!sequence.guardianId) return null;
  return artPath(sequence.guardianId, GUARDIAN_ART[sequence.guardianId].base, "idle");
}

/** Capa do capítulo: a primeira página do quadrinho, quando ele tem uma; senão, o Guardião. */
function coverArt(sequence: StorySequence): { src: string; comic: boolean } | null {
  const image = sequence.slides.find((slide) => slide.image)?.image;
  if (image) return { src: image, comic: true };
  const art = guardianArt(sequence);
  return art ? { src: art, comic: false } : null;
}

/** As primeiras frases do capítulo, para a ficha: a transcrição de uma página inteira é longa demais. */
function preview(sequence: StorySequence): string {
  const text = sequence.slides[0].text;
  if (text.length <= 160) return text;
  const cut = text.lastIndexOf(". ", 160);
  return cut > 40 ? text.slice(0, cut + 1) : `${text.slice(0, 157)}…`;
}

/**
 * Histórias do Recife (item 31): o índice dos capítulos. As lidas podem ser revistas; as demais ficam
 * em "???" com o estado de cada uma — a lista à esquerda, a ficha do capítulo à direita.
 */
/** `embedded`: o AppShell já desenha a coluna e o fundo, então a tela entrega só o conteúdo (item 2). */
export function storyIndexScreen(
  onBack: () => void,
  nav?: ShellNav,
  isUnlocked: (levelId: string) => boolean = () => false,
  embedded = false,
): Screen {
  let filter: StoryFilter = "all";
  let chosen: string | null = null;

  return {
    id: "story-index",
    render(host: ScreenHost) {
      const root = h("div", { class: `${"gr-album gr-album--stories"}${embedded ? " gr-album--embedded" : ""}`, testId: "story-index" });
      const layout = h("div", { class: "gr-album__layout" });
      root.append(layout);

      const draw = (): void => {
        const states = new Map(STORY_SEQUENCES.map((sequence) => [sequence.id, stateOf(sequence, isUnlocked)]));
        const read = STORY_SEQUENCES.filter((sequence) => states.get(sequence.id) === "read").length;
        const listed = STORY_SEQUENCES.filter((sequence) => filter === "all" || states.get(sequence.id) === filter);
        const current = listed.find((sequence) => sequence.id === chosen) ?? listed.find((sequence) => states.get(sequence.id) === "read") ?? listed[0];

        fill(layout, 
          embedded ? null : shellSidebar("stories", nav ?? fallbackNav(onBack), {
            navId: (section) => `stories-nav-${section}`,
            back: onBack,
            backId: "story-index-back",
            motto: "Grandes histórias também vivem debaixo d'água.",
          }),
          h(
            "div",
            { class: "gr-album__main" },
            header(read),
            filters(filter, (next) => {
              filter = next;
              chosen = null;
              draw();
            }),
            h(
              "div",
              { class: "gr-album__body" },
              h(
                "div",
                { class: "gr-album__grid", testId: "story-grid" },
                ...listed.map((sequence) =>
                  card(sequence, states.get(sequence.id) ?? "locked", current?.id === sequence.id, () => {
                    chosen = sequence.id;
                    draw();
                  }),
                ),
              ),
              current ? sheet(current, states.get(current.id) ?? "locked", host) : emptySheet(),
            ),
            h("p", { class: "gr-album__foot", text: "No Recife, cada encontro guarda um segredo." }),
          ),
        );
      };

      draw();
      return root;
    },
  };
}

/** Sem a navegação da moldura, todo item do menu só volta para a tela anterior. */
function fallbackNav(onBack: () => void): ShellNav {
  return {
    onGoHub: onBack,
    onGoMap: onBack,
    onOpenSchool: onBack,
    onOpenCollection: onBack,
    onOpenMastery: onBack,
    onOpenBestiary: onBack,
    onOpenStories: () => {},
    onOpenAchievements: onBack,
    onOpenAccount: onBack,
    onOpenSettings: onBack,
  };
}

function header(read: number): HTMLElement {
  const ratio = Math.round((read / Math.max(1, STORY_SEQUENCES.length)) * 100);
  return h(
    "header",
    { class: "gr-album__top" },
    h(
      "div",
      { class: "gr-album__titles" },
      h("span", { class: "gr-badge", text: `${read} de ${STORY_SEQUENCES.length} capítulos` }),
      h("h1", { class: "gr-album__title", text: "HISTÓRIAS DO RECIFE" }),
      h("p", { class: "gr-subtitle", text: "Cada encontro revela um pedaço da vida que existe no Recife." }),
    ),
    h(
      "div",
      { class: "gr-album__score", testId: "story-progress", dataRead: String(read) },
      h("span", { class: "gr-icon gr-icon--lg", html: ICONS.book }),
      h(
        "span",
        { class: "gr-album__score-copy" },
        h("span", { class: "gr-stat__label", text: "Histórias descobertas" }),
        h("span", { class: "gr-album__score-value", text: `${read} de ${STORY_SEQUENCES.length}` }),
        h("span", { class: "gr-progress__track" }, h("span", { class: "gr-progress__fill", style: `width:${ratio}%` })),
      ),
    ),
    h("p", { class: "gr-album__quote", text: "“No Recife, cada encontro guarda um segredo.”" }),
  );
}

function filters(current: StoryFilter, onPick: (filter: StoryFilter) => void): HTMLElement {
  return h(
    "nav",
    { class: "gr-album__tabs", testId: "story-filters", dataValue: current },
    ...FILTERS.map((entry) =>
      h(
        "button",
        {
          class: `gr-album__tab${entry.id === current ? " gr-album__tab--on" : ""}`,
          testId: `story-filter-${entry.id}`,
          type: "button",
          "aria-pressed": String(entry.id === current),
          onClick: () => onPick(entry.id),
        },
        h("span", { class: "gr-icon gr-icon--lg", html: entry.icon }),
        h("span", { text: entry.label.toUpperCase() }),
      ),
    ),
  );
}

function card(sequence: StorySequence, state: StoryState, chosen: boolean, onClick: () => void): HTMLElement {
  const read = state === "read";
  const art = coverArt(sequence);
  return h(
    "button",
    {
      class: `gr-album__card${chosen ? " gr-album__card--on" : ""}${read ? "" : " gr-album__card--locked"}`,
      testId: `story-entry-${sequence.id}`,
      dataState: state,
      type: "button",
      onClick,
    },
    h(
      "span",
      { class: "gr-album__card-art" },
      art
        ? h("img", { class: `gr-album__art${art.comic ? " gr-album__art--comic" : ""}${read ? "" : " gr-node__art--unknown"}`, src: art.src, alt: "" })
        : h("span", { class: "gr-icon gr-album__art-icon", html: ICONS.book }),
      state === "locked" ? h("span", { class: "gr-icon gr-icon--lg gr-album__card-lock", html: ICONS.lock }) : null,
    ),
    h("span", { class: "gr-album__card-name", text: state === "locked" ? "???" : sequence.title }),
    h("span", { class: "gr-hint", text: state === "locked" ? STATE_LABELS.locked : sequence.summary }),
    state === "locked"
      ? null
      : h(
          "span",
          { class: `gr-album__chip${state === "pending" ? " gr-album__chip--pending" : ""}` },
          h("span", { class: "gr-icon", html: read ? ICONS.star : ICONS.timer }),
          h("span", { text: STATE_LABELS[state] }),
        ),
  );
}

function emptySheet(): HTMLElement {
  return h(
    "section",
    { class: "gr-album__sheet gr-album__sheet--empty" },
    h("span", { class: "gr-icon gr-album__banner-icon", html: ICONS.book }),
    h("p", { class: "gr-hint", text: "Nenhum capítulo nesta prateleira ainda." }),
  );
}

/** Momento em que o capítulo acontece, lido do gatilho. */
const MOMENT_LABELS: Record<StorySequence["trigger"]["type"], string> = {
  levelIntro: "Antes da fase",
  levelOutro: "Depois da vitória",
  manual: "A qualquer hora",
};

function sheet(sequence: StorySequence, state: StoryState, host: ScreenHost): HTMLElement {
  const read = state === "read";
  const art = coverArt(sequence);
  const index = STORY_SEQUENCES.indexOf(sequence);
  const levelId = levelIdOf(sequence);
  const level = levelId ? getLevel(levelId) : undefined;
  const quote = sequence.slides.find((slide) => slide.speaker);
  const guardian = sequence.guardianId ? GUARDIANS[sequence.guardianId] : undefined;

  return h(
    "section",
    { class: "gr-album__sheet", testId: "story-sheet", dataStory: sequence.id, dataState: state },
    h(
      "div",
      { class: "gr-album__banner" },
      art
        ? h("img", { class: `gr-album__banner-art${art.comic ? " gr-album__art--comic" : ""}${read ? "" : " gr-node__art--unknown"}`, src: art.src, alt: "" })
        : h("span", { class: "gr-icon gr-album__banner-icon", html: ICONS.book }),
    ),
    h(
      "div",
      { class: "gr-album__sheet-head" },
      h("span", { class: "gr-badge", text: `Capítulo ${index + 1}` }),
      h("h2", { class: "gr-album__sheet-name", text: state === "locked" ? "???" : sequence.title }),
      h("p", { class: "gr-subtitle", text: state === "locked" ? STATE_LABELS.locked : sequence.summary }),
    ),
    read
      ? h("p", { class: "gr-album__sheet-line", testId: "story-preview", text: preview(sequence) })
      : h("p", { class: "gr-album__sheet-line", text: state === "pending" ? "Este capítulo está prestes a acontecer. Jogue a fase para vivê-lo." : "Avance na campanha para chegar até aqui." }),
    read && quote
      ? h(
          "blockquote",
          { class: "gr-album__quotebox", testId: "story-quote" },
          h("p", { text: `“${quote.text}”` }),
          h("cite", { text: `— ${quote.speaker}` }),
        )
      : null,
    h(
      "div",
      { class: "gr-album__duo" },
      h(
        "div",
        { class: "gr-album__rows" },
        h("span", { class: "gr-album__section-title", text: "O capítulo" }),
        row(ICONS.coral, "Onde", level?.name ?? "Fora das fases"),
        row(ICONS.timer, "Quando", MOMENT_LABELS[sequence.trigger.type]),
        row(ICONS.book, sequence.slides.some((slide) => slide.image) ? "Páginas" : "Falas", String(sequence.slides.length)),
      ),
      guardian
        ? h(
            "div",
            { class: "gr-album__rows gr-album__voice", testId: "story-guardian" },
            h("span", { class: "gr-album__section-title", text: "Guardião relacionado" }),
            h(
              "span",
              { class: "gr-album__voice-row" },
              h("img", { class: `gr-album__voice-art${read ? "" : " gr-node__art--unknown"}`, src: guardianArt(sequence) ?? "", alt: "" }),
              h(
                "span",
                { class: "gr-album__career-text" },
                h("span", { class: "gr-album__row-value", text: read ? guardian.name : "???" }),
                h("span", { class: "gr-hint", text: read ? guardian.role : "Revelado ao viver o capítulo." }),
              ),
            ),
          )
        : null,
    ),
    h(
      "button",
      {
        class: "gr-button gr-button--primary gr-album__read",
        testId: "story-read",
        type: "button",
        disabled: !read,
        onClick: () => host.push(storyScreen(sequence, () => host.pop())),
      },
      h("span", { class: "gr-icon", html: ICONS.play }),
      h("span", { text: read ? "LER HISTÓRIA" : "AINDA NÃO VIVIDA" }),
    ),
  );
}

function row(icon: string, label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "gr-album__row" },
    h("span", { class: "gr-icon", html: icon }),
    h("span", { class: "gr-album__row-label", text: label }),
    h("span", { class: "gr-album__row-value", text: value }),
  );
}
