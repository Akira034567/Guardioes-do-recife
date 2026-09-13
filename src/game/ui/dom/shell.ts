import { h } from "./h";
import { BRAND_WAVE, ICONS } from "./icons";

/**
 * A moldura compartilhada das telas de fora da partida: a marca, o menu lateral e o rodapé. O mapa e
 * o álbum desenham a mesma coluna da esquerda, só mudando qual item está aceso — assim o jogador nunca
 * perde a referência ao trocar de seção.
 */
export type ShellSection = "map" | "collection" | "bestiary" | "stories" | "achievements" | "settings";

export interface ShellNav {
  /** Volta para o mapa (a tela de baixo da pilha). */
  onGoMap(): void;
  onOpenCollection(): void;
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
  /** A frase do rodapé, em duas linhas. */
  motto: string;
  /** Um último controle discreto embaixo da frase (o "limpar progresso" do mapa). */
  footer?: HTMLElement | null;
}

const ITEMS: ReadonlyArray<{ section: ShellSection; icon: string; label: string; open: (nav: ShellNav) => void }> = [
  { section: "map", icon: ICONS.compass, label: "Mapa do Recife", open: (nav) => nav.onGoMap() },
  { section: "collection", icon: ICONS.fish, label: "Álbum do Recife", open: (nav) => nav.onOpenCollection() },
  { section: "bestiary", icon: ICONS.spiky, label: "Ameaças", open: (nav) => nav.onOpenBestiary() },
  { section: "stories", icon: ICONS.book, label: "História", open: (nav) => nav.onOpenStories() },
  { section: "achievements", icon: ICONS.trophy, label: "Conquistas", open: (nav) => nav.onOpenAchievements() },
  { section: "settings", icon: ICONS.gear, label: "Configurações", open: (nav) => nav.onOpenSettings() },
];

/** Os nomes que o menu do mapa sempre teve; a tela do mapa continua passando estes. */
export const MAP_NAV_IDS: Record<ShellSection, string> = {
  map: "map-here",
  collection: "map-collection",
  bestiary: "map-bestiary",
  stories: "map-stories",
  achievements: "map-achievements",
  settings: "map-settings",
};

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
            onClick: () => {
              if (!current) item.open(nav);
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
      h("p", { class: "gr-world__motto", text: options.motto }),
      options.footer ?? null,
    ),
  );
}
