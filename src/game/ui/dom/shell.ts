import { h } from "./h";
import { BRAND_WAVE, ICONS } from "./icons";

/**
 * A moldura compartilhada das telas de fora da partida: a marca, o menu lateral e o rodapé. O mapa e
 * o álbum desenham a mesma coluna da esquerda, só mudando qual item está aceso — assim o jogador nunca
 * perde a referência ao trocar de seção.
 */
export type ShellSection = "hub" | "map" | "collection" | "mastery" | "bestiary" | "stories" | "achievements" | "settings";

export interface ShellNav {
  /** Volta para o Meu Recife, a tela inicial e a casa do jogador. */
  onGoHub(): void;
  /** Abre o mapa das fases. */
  onGoMap(): void;
  onOpenCollection(): void;
  /** Abre a Maestria do Recife (progressão permanente por Guardião). */
  onOpenMastery(): void;
  onOpenBestiary(): void;
  onOpenStories(): void;
  onOpenAchievements(): void;
  onOpenSettings(): void;
}

interface ShellOptions {
  /**
   * `data-testid` de cada item. As duas barras (a do mapa e a da tela aberta por cima) coexistem no
   * DOM, então cada tela precisa dar nomes próprios aos seus botões.
   */
  navId(section: ShellSection): string;
  /** Botão "VOLTAR" acima da marca; ausente no mapa, que não tem para onde voltar. */
  back?: () => void;
  backId?: string;
  /** A frase do rodapé; ausente = a coluna termina no menu. */
  motto?: string;
  /** Um último controle discreto embaixo da frase (o "limpar progresso" do mapa). */
  footer?: HTMLElement | null;
}

const ITEMS: ReadonlyArray<{ section: ShellSection; icon: string; label: string; open: (nav: ShellNav) => void }> = [
  { section: "hub", icon: ICONS.coral, label: "Meu Recife", open: (nav) => nav.onGoHub() },
  { section: "map", icon: ICONS.compass, label: "Mapa do Recife", open: (nav) => nav.onGoMap() },
  { section: "collection", icon: ICONS.fish, label: "Álbum do Recife", open: (nav) => nav.onOpenCollection() },
  { section: "mastery", icon: ICONS.star, label: "Maestria", open: (nav) => nav.onOpenMastery() },
  { section: "bestiary", icon: ICONS.spiky, label: "Ameaças", open: (nav) => nav.onOpenBestiary() },
  { section: "stories", icon: ICONS.book, label: "História", open: (nav) => nav.onOpenStories() },
  { section: "achievements", icon: ICONS.trophy, label: "Conquistas", open: (nav) => nav.onOpenAchievements() },
  { section: "settings", icon: ICONS.gear, label: "Configurações", open: (nav) => nav.onOpenSettings() },
];

/** Os nomes que o menu do mapa sempre teve; a tela do mapa continua passando estes. */
export const MAP_NAV_IDS: Record<ShellSection, string> = {
  hub: "map-hub",
  map: "map-here",
  collection: "map-collection",
  mastery: "map-mastery",
  bestiary: "map-bestiary",
  stories: "map-stories",
  achievements: "map-achievements",
  settings: "map-settings",
};

/**
 * Acende a seção atual e reetiqueta os botões SEM remontar a coluna (item 2).
 *
 * O `data-testid` de cada item continua variando por seção porque os testes e2e o usam assim; a
 * diferença é que agora ele muda de valor num elemento que permanece o mesmo, em vez de o elemento
 * inteiro ser recriado.
 */
export function retargetShell(
  side: HTMLElement,
  active: ShellSection,
  options: { navId(section: ShellSection): string; backId?: string; back?: () => void },
): void {
  side.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((item) => {
    const section = item.dataset.section as ShellSection;
    const current = section === active;
    item.classList.toggle("gr-world__nav-item--on", current);
    item.dataset.testid = options.navId(section);
    if (current) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  const back = side.querySelector<HTMLButtonElement>(".gr-world__back");
  if (back && options.backId) back.dataset.testid = options.backId;
  if (back && options.back) back.onclick = options.back;
}

export function shellSidebar(active: ShellSection, nav: ShellNav, options: ShellOptions): HTMLElement {
  return h(
    "aside",
    { class: "gr-world__side" },
    options.back
      ? h(
          "button",
          { class: "gr-world__back", testId: options.backId ?? "shell-back", type: "button", onClick: options.back },
          h("span", { class: "gr-icon", html: ICONS.chevronLeft }),
          h("span", { text: "VOLTAR" }),
        )
      : null,
    h(
      "div",
      { class: "gr-world__brand" },
      h("span", { class: "gr-world__brand-name", text: "GUARDIÕES" }),
      h("span", { class: "gr-world__brand-name", text: "DO RECIFE" }),
      h("span", { class: "gr-world__brand-wave", html: BRAND_WAVE }),
    ),
    h(
      "nav",
      { class: "gr-world__nav" },
      ...ITEMS.map((item) => {
        const current = item.section === active;
        return h(
          "button",
          {
            class: `gr-world__nav-item${current ? " gr-world__nav-item--on" : ""}`,
            testId: options.navId(item.section),
            dataSection: item.section,
            type: "button",
            "aria-current": current ? "page" : undefined,
            onClick: (event: MouseEvent) => {
              // Lê o estado do DOM, e não o `current` do fechamento: `retargetShell` muda a classe
              // sem recriar o botão, então o valor capturado aqui envelheceria.
              if ((event.currentTarget as HTMLElement).classList.contains("gr-world__nav-item--on")) return;
              item.open(nav);
            },
          },
          h("span", { class: "gr-icon gr-icon--lg", html: item.icon }),
          h("span", { text: item.label.toUpperCase() }),
        );
      }),
    ),
    h(
      "div",
      { class: "gr-world__side-foot" },
      options.motto ? h("p", { class: "gr-world__motto", text: options.motto }) : null,
      options.footer ?? null,
    ),
  );
}
