import { getSettings } from "../../systems/settings";
import { prefersReducedMotion } from "../../systems/sceneTransition";
import { h } from "./h";
import type { Screen } from "./ScreenHost";
import { retargetShell, shellSidebar, type ShellNav, type ShellSection } from "./shell";

/**
 * Moldura persistente das seções (item 2).
 *
 * Antes, trocar de seção pelo menu lateral fazia `pop()` da tela atual e `push()` da nova — o que
 * desmontava backdrop, coluna, cabeçalho e grade inteiros, e ainda passava pela tela raiz no meio do
 * caminho. Daí a sensação de que a interface voltava para o Mapa antes de abrir a próxima seção.
 *
 * Aqui a coluna da esquerda é montada UMA vez e só é reetiquetada; quem troca é o miolo, com uma
 * animação curta. O Mapa e o Meu Recife continuam de fora: são telas de layout próprio (e o hub é
 * outra cena do Phaser).
 */
export type ShellView = Exclude<ShellSection, "hub" | "map">;

export interface ShellContent {
  view: ShellView;
  /** Conteúdo já montado, sem coluna e sem fundo: o AppShell é dono dos dois. */
  element: HTMLElement;
  backdrop: string | null;
  /** `data-testid` dos itens do menu enquanto esta seção está aberta. */
  navId(section: ShellSection): string;
  backId: string;
  onBack(): void;
  motto?: string;
  onClose?(): void;
}

export interface AppShellHandle {
  screen: Screen;
  show(content: ShellContent): void;
  readonly view: ShellView;
}

/** 150ms: curto o bastante para não atrasar e longo o bastante para o olho seguir a troca. */
const VIEW_FADE_MS = 150;

export function appShell(initial: ShellContent, nav: ShellNav): AppShellHandle {
  let current = initial;
  const backdrop = h("div", { class: "gr-world__backdrop" });
  const content = h("main", { class: "gr-shell__content" });
  const side = shellSidebar(initial.view, nav, {
    navId: initial.navId,
    back: () => current.onBack(),
    backId: initial.backId,
    motto: initial.motto,
  });
  const layout = h("div", { class: "gr-album__layout" }, side, content);
  const root = h("div", { class: "gr-album gr-shell", testId: "app-shell" }, backdrop, layout);

  const show = (next: ShellContent): void => {
    if (next !== current) current.onClose?.();
    current = next;
    root.dataset.view = next.view;
    backdrop.style.backgroundImage = next.backdrop ? `url(${next.backdrop})` : "";
    retargetShell(side, next.view, { navId: next.navId, backId: next.backId, back: () => current.onBack() });
    content.replaceChildren(next.element);
    // Movimento reduzido é preferência do jogador e do sistema: nesse caso a troca é seca.
    if (prefersReducedMotion() || getSettings().reducedEffects) return;
    content.classList.remove("gr-shell__content--in");
    // Força o reflow para a animação reiniciar; sem isto a classe recém-removida não "conta".
    void content.offsetWidth;
    content.classList.add("gr-shell__content--in");
  };

  show(initial);

  return {
    screen: {
      id: "shell",
      render: () => root,
      onClose: () => current.onClose?.(),
    },
    show,
    get view() {
      return current.view;
    },
  };
}

export { VIEW_FADE_MS };
