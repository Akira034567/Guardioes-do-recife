import { achievementStatuses, type AchievementStatus } from "../../../core/progression/achievements";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import type { AchievementCategory } from "../../../data/achievements";
import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import { LEVELS } from "../../../data/levels";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import { fill, h } from "../h";
import { preserveScroll } from "../scroll";
import { ICONS } from "../icons";
import type { Screen } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

type AchievementFilter = "all" | AchievementCategory;

const CATEGORIES: ReadonlyArray<{ id: AchievementCategory; label: string; icon: string }> = [
  { id: "exploracao", label: "Exploração", icon: ICONS.compass },
  { id: "combate", label: "Combate", icon: ICONS.swords },
  { id: "guardioes", label: "Guardiões", icon: ICONS.fish },
  { id: "colecao", label: "Coleção", icon: ICONS.shell },
  { id: "especiais", label: "Especiais", icon: ICONS.star },
];

const CATEGORY_ICONS: Record<AchievementCategory, string> = {
  exploracao: ICONS.compass,
  combate: ICONS.swords,
  guardioes: ICONS.fish,
  colecao: ICONS.shell,
  especiais: ICONS.star,
};

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  exploracao: "Exploração",
  combate: "Combate",
  guardioes: "Guardiões",
  colecao: "Coleção",
  especiais: "Especiais",
};

/** Conquista escondida só mostra o nome depois de obtida. */
function isHidden(status: AchievementStatus): boolean {
  return Boolean(status.definition.hidden) && !status.unlocked;
}

/**
 * Conquistas do Recife (item 37): o que o jogador já fez e o que falta, por prateleira. A lista fica
 * à esquerda e a ficha da conquista escolhida à direita — conquista escondida não entrega o nome nem
 * o que pede, só que existe.
 */
/** `embedded`: o AppShell já desenha a coluna e o fundo, então a tela entrega só o conteúdo (item 2). */
export function achievementsScreen(progression: ProgressionService, onBack: () => void, nav?: ShellNav, embedded = false): Screen {
  let filter: AchievementFilter = "all";
  let chosen: string | null = null;

  return {
    id: "achievements",
    render() {
      const root = h("div", { class: `${"gr-album gr-album--achievements"}${embedded ? " gr-album--embedded" : ""}`, testId: "achievements-panel" });
      const art = levelBackgroundPath(LEVELS[5].backgroundKey);
      if (art && !embedded) root.append(h("div", { class: "gr-world__backdrop", style: `background-image:url(${art})` }));
      const layout = h("div", { class: "gr-album__layout" });
      root.append(layout);

      const redraw = (): void => {
        const statuses = achievementStatuses(progression.progress);
        const done = statuses.filter((status) => status.unlocked).length;
        const listed = statuses.filter((status) => filter === "all" || status.definition.category === filter);
        const current = listed.find((status) => status.definition.id === chosen) ?? listed.find((status) => status.unlocked) ?? listed[0];
        root.dataset.done = String(done);

        fill(layout, 
          embedded ? null : shellSidebar("achievements", nav ?? fallbackNav(onBack), {
            navId: (section) => `achievements-nav-${section}`,
            back: onBack,
            backId: "achievements-back",
          }),
          h(
            "div",
            { class: "gr-album__main" },
            header(done, statuses.length),
            filters(filter, done, statuses.length, (next) => {
              filter = next;
              chosen = null;
              draw();
            }),
            h(
              "div",
              { class: "gr-album__body" },
              h(
                "div",
                { class: "gr-album__grid gr-album__grid--rows", testId: "achievements-grid" },
                ...listed.map((status) =>
                  card(status, current?.definition.id === status.definition.id, () => {
                    chosen = status.definition.id;
                    draw();
                  }),
                ),
              ),
              current
                ? sheet(current, progression.progress.achievements[current.definition.id]?.unlockedAt ?? null, () => {
                    filter = "all";
                    draw();
                  })
                : emptySheet(),
            ),
            h("p", { class: "gr-album__foot", text: "Conquiste hoje um oceano melhor." }),
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

/** Sem a navegação da moldura, todo item do menu só volta para a tela anterior. */
function fallbackNav(onBack: () => void): ShellNav {
  return {
    onGoHub: onBack,
    onGoMap: onBack,
    onOpenCollection: onBack,
    onOpenMastery: onBack,
    onOpenBestiary: onBack,
    onOpenStories: onBack,
    onOpenAchievements: () => {},
    onOpenSettings: onBack,
  };
}

function header(done: number, total: number): HTMLElement {
  const ratio = Math.round((done / Math.max(1, total)) * 100);
  return h(
    "header",
    { class: "gr-album__top" },
    h(
      "div",
      { class: "gr-album__titles" },
      h("h1", { class: "gr-album__title", text: "CONQUISTAS DO RECIFE" }),
      h("p", { class: "gr-subtitle", text: "Cada conquista é um passo a mais para um oceano mais vivo." }),
    ),
    h(
      "div",
      { class: "gr-album__score", testId: "achievements-progress", dataDone: String(done) },
      h("span", { class: "gr-icon gr-icon--lg", html: ICONS.trophy }),
      h(
        "span",
        { class: "gr-album__score-copy" },
        h("span", { class: "gr-stat__label", text: "Conquistas desbloqueadas" }),
        h("span", { class: "gr-album__score-value", text: `${done} de ${total}` }),
        h("span", { class: "gr-progress__track" }, h("span", { class: "gr-progress__fill", style: `width:${ratio}%` })),
      ),
    ),
    h("p", { class: "gr-album__quote", text: "“Grandes jornadas também são feitas de pequenos feitos.”" }),
  );
}

function filters(current: AchievementFilter, done: number, total: number, onPick: (filter: AchievementFilter) => void): HTMLElement {
  const tab = (id: AchievementFilter, label: string, icon: string): HTMLElement =>
    h(
      "button",
      {
        class: `gr-album__tab${id === current ? " gr-album__tab--on" : ""}`,
        testId: `achievements-filter-${id}`,
        type: "button",
        "aria-pressed": String(id === current),
        onClick: () => onPick(id),
      },
      h("span", { class: "gr-icon gr-icon--lg", html: icon }),
      h("span", { text: label.toUpperCase() }),
    );
  return h(
    "nav",
    { class: "gr-album__tabs", testId: "achievements-filters", dataValue: current },
    tab("all", `Todas (${done}/${total})`, ICONS.trophy),
    ...CATEGORIES.map((category) => tab(category.id, category.label, category.icon)),
  );
}

function card(status: AchievementStatus, chosen: boolean, onClick: () => void): HTMLElement {
  const definition = status.definition;
  const hidden = isHidden(status);
  const ratio = Math.max(0, Math.min(1, status.progress / status.target));
  return h(
    "button",
    {
      class: `gr-album__row-card${chosen ? " gr-album__row-card--on" : ""}${status.unlocked ? " gr-album__row-card--done" : ""}`,
      testId: `achievement-${definition.id}`,
      dataState: status.unlocked ? "unlocked" : "locked",
      type: "button",
      onClick,
    },
    h(
      "span",
      { class: `gr-album__badge gr-album__badge--${definition.category}` },
      h("span", { class: "gr-icon gr-icon--lg", html: hidden ? ICONS.lock : CATEGORY_ICONS[definition.category] }),
    ),
    h(
      "span",
      { class: "gr-album__row-copy" },
      h("span", { class: "gr-album__card-name", text: hidden ? "???" : definition.name }),
      h("span", { class: "gr-hint", text: hidden ? "Ainda não descoberta." : definition.description }),
      hidden
        ? null
        : h(
            "span",
            { class: "gr-album__row-meter" },
            h("span", { class: "gr-progress__track" }, h("span", { class: "gr-progress__fill", style: `width:${Math.round(ratio * 100)}%` })),
            h(
              "span",
              { class: "gr-album__row-foot" },
              h("span", { class: "gr-progress__label", text: status.unlocked ? "Concluída" : `${status.progress}/${status.target}` }),
              h("span", { class: "gr-album__prize" }, h("span", { class: "gr-icon", html: ICONS.shell }), h("span", { text: String(definition.shells) })),
            ),
          ),
    ),
  );
}

function emptySheet(): HTMLElement {
  return h(
    "section",
    { class: "gr-album__sheet gr-album__sheet--empty" },
    h("span", { class: "gr-icon gr-album__banner-icon", html: ICONS.trophy }),
    h("p", { class: "gr-hint", text: "Nenhuma conquista nesta prateleira ainda." }),
  );
}

/** `2026-09-12T…` vira `12 de setembro de 2026`. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function sheet(status: AchievementStatus, unlockedAt: string | null, onShowAll: () => void): HTMLElement {
  const definition = status.definition;
  const hidden = isHidden(status);
  const ratio = Math.max(0, Math.min(1, status.progress / status.target));
  return h(
    "section",
    {
      class: `gr-album__sheet${status.unlocked ? " gr-album__sheet--won" : ""}`,
      testId: "achievement-sheet",
      dataAchievement: definition.id,
      dataState: status.unlocked ? "unlocked" : "locked",
    },
    h(
      "div",
      { class: `gr-album__banner gr-album__badge--${definition.category}` },
      h("span", { class: "gr-icon gr-album__banner-icon", html: hidden ? ICONS.lock : CATEGORY_ICONS[definition.category] }),
      status.unlocked
        ? h("span", { class: "gr-album__chip gr-album__chip--float" }, h("span", { class: "gr-icon", html: ICONS.star }), h("span", { text: "Concluída" }))
        : null,
    ),
    h(
      "div",
      { class: "gr-album__sheet-head" },
      h("span", { class: "gr-badge", text: CATEGORY_LABELS[definition.category] }),
      h("h2", { class: "gr-album__sheet-name", text: hidden ? "???" : definition.name }),
      h("p", { class: "gr-subtitle", text: hidden ? "Uma surpresa guardada para quem procurar." : definition.description }),
    ),
    hidden
      ? null
      : h(
          "div",
          { class: "gr-album__rows" },
          h("span", { class: "gr-album__section-title", text: "Progresso" }),
          h(
            "div",
            { class: "gr-album__row-meter" },
            h("span", { class: "gr-progress__track" }, h("span", { class: "gr-progress__fill", style: `width:${Math.round(ratio * 100)}%` })),
            h(
              "span",
              { class: "gr-album__row-foot" },
              h("span", { class: "gr-progress__label", text: `${status.progress} de ${status.target}` }),
              h("span", { class: "gr-progress__label", text: `${Math.round(ratio * 100)}%` }),
            ),
          ),
        ),
    h(
      "div",
      { class: "gr-album__rows", testId: "achievement-reward" },
      h("span", { class: "gr-album__section-title", text: "Recompensa" }),
      h(
        "div",
        { class: "gr-album__row" },
        h("span", { class: "gr-icon", html: ICONS.shell }),
        h("span", { class: "gr-album__row-label", text: GLOBAL_CURRENCY.name }),
        h("span", { class: "gr-album__row-value", text: `${GLOBAL_CURRENCY.symbol} ${definition.shells}` }),
      ),
      h(
        "div",
        { class: "gr-album__row" },
        h("span", { class: "gr-icon", html: status.unlocked ? ICONS.star : ICONS.timer }),
        h("span", { class: "gr-album__row-label", text: status.unlocked ? "Concluída em" : "Situação" }),
        h("span", { class: "gr-album__row-value", text: status.unlocked ? (unlockedAt ? formatDate(unlockedAt) : "Já conquistada") : "Em andamento" }),
      ),
    ),
    h(
      "button",
      { class: "gr-button gr-album__read", testId: "achievements-show-all", type: "button", onClick: onShowAll },
      h("span", { class: "gr-icon", html: ICONS.trophy }),
      h("span", { text: "VER TODAS AS CONQUISTAS" }),
    ),
  );
}
