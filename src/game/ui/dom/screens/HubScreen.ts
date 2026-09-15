import { GAME_HEIGHT, GAME_WIDTH } from "../../../constants";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import { REEF_LANDMARKS, type ReefLandmarkId } from "../../../data/reef/layout";
import type { GuardianId } from "../../../types";
import { button, h } from "../h";
import { ICONS } from "../icons";
import type { Screen } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

/**
 * A camada de texto do Meu Recife.
 *
 * O cenário é a interface, então aqui entra só o que precisa ser TEXTO: o rótulo do lugar, a ficha
 * do Guardião, o saldo de Conchas e a lista de atalhos para teclado. O Recife em si é desenhado pelo
 * Phaser, atrás desta camada.
 *
 * Dois cuidados que mantêm isso funcionando:
 *
 * 1. A tela é `modal: false`, senão `ScreenHost.sync()` desligaria o input do Phaser e o Recife
 *    ficaria morto ao toque.
 * 2. O CSS precisa de `pointer-events: none` na raiz, porque `#ui-layer > *` liga o ponteiro em todo
 *    filho direto — sem isso, esta camada engoliria TODO clique do cenário, sem erro nenhum.
 *
 * Os botões invisíveis de `gr-hub__spots` são o caminho de teclado (e o que os testes clicam): o
 * cenário não pode ser o único jeito de chegar a uma tela.
 */

export interface HubGuardianInfo {
  id: GuardianId;
  name: string;
  /** O papel do Guardião na partida ("Execução", "Controle"…). */
  role: string;
  /** Como ele entrou para o Recife ("Fundador do Recife", "Encontrado na Rede Fantasma"). */
  origin: string;
  /** Patente derivada da carreira. */
  rank: string;
  career: { matches: number; kills: number };
}

export interface HubLabel {
  id: string;
  text: string;
  hint?: string;
  /** Posição no mundo 1280×720; a camada converte para % da área. */
  x: number;
  y: number;
  /** No toque, o primeiro toque arma e o segundo entra. */
  armed?: boolean;
}

export interface HubCounters {
  shells: number;
  stars: number;
  guardians: number;
  /** Nome da conta em uso; `null` = jogando como convidado, no save deste aparelho. */
  account: string | null;
}

export interface HubActions {
  /** `viaKeyboard` pula a regra dos dois toques: com o foco, o nome do lugar já está à vista. */
  onOpenLandmark(id: ReefLandmarkId, viaKeyboard: boolean): void;
  onFocusSpot(id: string | null): void;
  onSelectGuardian(id: GuardianId): void;
  onOpenAlbum(id: GuardianId): void;
  onCloseCard(): void;
}

/** O que a cena chama para manter a camada em dia. */
export interface HubOverlay {
  showLabel(label: HubLabel | null): void;
  showGuardian(info: HubGuardianInfo | null): void;
  setCounters(counters: HubCounters): void;
  /** Atalhos de teclado dos Guardiões que estão no Recife agora. */
  setGuardianSpots(spots: ReadonlyArray<{ id: GuardianId; name: string }>): void;
  setLandmarks(ids: readonly ReefLandmarkId[]): void;
}

export interface HubScreenHandle {
  screen: Screen;
  overlay: HubOverlay;
}

export function hubScreen(actions: HubActions, nav: ShellNav): HubScreenHandle {
  const label = h("div", { class: "gr-hub__tag", testId: "hub-label", hidden: "" });
  const card = h("aside", { class: "gr-hub__card", testId: "hub-card", hidden: "" });
  const counters = h("div", { class: "gr-hub__counters" });
  const spots = h("nav", { class: "gr-hub__spots", "aria-label": "Lugares do Recife" });
  // Os lugares ficam espalhados sobre o Recife; os Guardiões, que se mexem, viram atalhos de teclado.
  const landmarkSpots = h("div", { class: "gr-hub__places" });
  const guardianSpots = h("div", { class: "gr-hub__spot-group" });
  spots.append(landmarkSpots, guardianSpots);
  /*
   * O menu é retrátil, e fechado por padrão. O fundo pintado traz os seis lugares desenhados, dois
   * deles na faixa da esquerda: uma coluna sempre aberta taparia o Álbum e as Ameaças. Assim o
   * cenário fica inteiro e o atalho continua a um toque.
   */
  const side = h(
    "div",
    { class: "gr-hub__side", testId: "hub-menu", hidden: "" },
    shellSidebar("hub", nav, { navId: (section) => `hub-nav-${section}`, motto: "O Recife é seu. Cuide bem dele." }),
  );
  const toggle = h("button", {
    class: "gr-hub__menu-toggle",
    testId: "hub-menu-toggle",
    type: "button",
    "aria-label": "Abrir o menu do Recife",
    "aria-expanded": "false",
    html: ICONS.menu,
    onClick: () => setMenu(side.hidden),
  });
  const scrim = h("button", {
    class: "gr-hub__scrim",
    testId: "hub-menu-scrim",
    type: "button",
    tabindex: "-1",
    "aria-label": "Fechar o menu",
    hidden: "",
    onClick: () => setMenu(false),
  });

  function setMenu(open: boolean): void {
    side.hidden = !open;
    scrim.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar o menu do Recife" : "Abrir o menu do Recife");
    if (open) side.querySelector<HTMLElement>("button")?.focus();
    else toggle.focus();
  }

  const root = h("div", { class: "gr-hub", testId: "hub-panel" }, scrim, side, toggle, counters, spots, label, card);
  // ESC fecha o menu, como em qualquer painel que cobre a tela.
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !side.hidden) setMenu(false);
  });

  const alive = (): boolean => root.isConnected;

  const overlay: HubOverlay = {
    showLabel(next) {
      if (!alive()) return;
      if (!next) {
        label.hidden = true;
        label.removeAttribute("data-spot");
        return;
      }
      label.hidden = false;
      label.dataset.spot = next.id;
      label.dataset.armed = next.armed ? "true" : "false";
      label.style.left = `${(next.x / GAME_WIDTH) * 100}%`;
      label.style.top = `${(next.y / GAME_HEIGHT) * 100}%`;
      const lines: HTMLElement[] = [h("span", { class: "gr-hub__tag-name", text: next.text })];
      if (next.hint) lines.push(h("span", { class: "gr-hub__tag-hint", text: next.hint }));
      if (next.armed) lines.push(h("span", { class: "gr-hub__tag-hint", text: "Toque de novo para entrar" }));
      label.replaceChildren(...lines);
    },

    showGuardian(info) {
      if (!alive()) return;
      if (!info) {
        card.hidden = true;
        card.removeAttribute("data-guardian");
        return;
      }
      card.hidden = false;
      card.dataset.guardian = info.id;
      card.replaceChildren(
        h(
          "header",
          { class: "gr-hub__card-head" },
          h("h2", { class: "gr-hub__card-name", text: info.name }),
          h("button", {
            class: "gr-hub__card-close",
            testId: "hub-card-close",
            type: "button",
            "aria-label": "Fechar",
            html: ICONS.close,
            onClick: actions.onCloseCard,
          }),
        ),
        h("p", { class: "gr-hub__card-role", testId: "hub-card-role", text: info.role }),
        h("p", { class: "gr-hub__card-origin", text: info.origin }),
        h(
          "dl",
          { class: "gr-hub__card-stats" },
          stat("Patente", info.rank),
          stat("Partidas", String(info.career.matches)),
          stat("Invasores contidos", String(info.career.kills)),
        ),
        button("VER NO ÁLBUM", () => actions.onOpenAlbum(info.id), { testId: "hub-card-album", variant: "primary" }),
      );
    },

    setCounters(next) {
      if (!alive()) return;
      counters.replaceChildren(
        counter(ICONS.shell, String(next.shells), GLOBAL_CURRENCY.name, "hub-shells"),
        counter(ICONS.star, String(next.stars), "Estrelas", "hub-stars"),
        counter(ICONS.fish, String(next.guardians), "Guardiões no Recife", "hub-guardians"),
        counter(ICONS.account, next.account ?? "Convidado", next.account ? `Conta: ${next.account}` : "Jogando sem conta", "hub-account"),
      );
    },

    setGuardianSpots(list) {
      if (!alive()) return;
      guardianSpots.replaceChildren(
        ...list.map((entry) =>
          spotButton({
            testId: `hub-spot-guardian-${entry.id}`,
            label: `${entry.name}: ver a ficha`,
            spotId: `guardian:${entry.id}`,
            onActivate: () => actions.onSelectGuardian(entry.id),
            onFocusSpot: actions.onFocusSpot,
          }),
        ),
      );
    },

    setLandmarks(ids) {
      if (!alive()) return;
      landmarkSpots.replaceChildren(
        ...REEF_LANDMARKS.filter((landmark) => ids.includes(landmark.id)).map((landmark) => {
          const element = spotButton({
            testId: `hub-spot-${landmark.id}`,
            label: `${landmark.label}: ${landmark.hint}`,
            spotId: landmark.id,
            onActivate: (viaKeyboard) => actions.onOpenLandmark(landmark.id, viaKeyboard),
            onFocusSpot: actions.onFocusSpot,
          });
          // O alvo fica EM CIMA do lugar, transparente: o Recife aparece através dele. O cenário
          // continua sendo a interface; o DOM só empresta o clique, o hover e o foco de teclado.
          element.classList.add("gr-hub__spot--place");
          element.style.left = `${landmark.at.x}%`;
          element.style.top = `${landmark.at.y}%`;
          element.style.width = `${landmark.radius * 2}%`;
          element.style.aspectRatio = "1";
          element.addEventListener("pointerenter", (event) => {
            if ((event as PointerEvent).pointerType === "mouse") actions.onFocusSpot(landmark.id);
          });
          element.addEventListener("pointerleave", (event) => {
            if ((event as PointerEvent).pointerType === "mouse") actions.onFocusSpot(null);
          });
          return element;
        }),
      );
    },
  };

  return {
    overlay,
    screen: {
      id: "hub",
      // O Recife precisa receber o ponteiro: esta camada NUNCA pode ser modal.
      modal: false,
      render() {
        return root;
      },
    },
  };
}

/**
 * Um atalho para um lugar do Recife. Fica fora da vista, mas NUNCA `display: none` — um botão
 * escondido assim sai da ordem de tabulação, e aí o cenário vira o único caminho. Ao receber foco
 * ele acende o mesmo realce que o mouse acenderia.
 */
function spotButton(options: {
  testId: string;
  label: string;
  spotId: string;
  onActivate: (viaKeyboard: boolean) => void;
  onFocusSpot: (id: string | null) => void;
}): HTMLElement {
  const element = h("button", {
    class: "gr-hub__spot",
    testId: options.testId,
    type: "button",
    text: options.label,
    // `detail === 0` é como o navegador conta um clique que veio do teclado (Enter ou espaço).
    onClick: (event) => options.onActivate(event.detail === 0),
  });
  element.addEventListener("focus", () => options.onFocusSpot(options.spotId));
  element.addEventListener("blur", () => options.onFocusSpot(null));
  return element;
}

function counter(icon: string, value: string, title: string, testId: string): HTMLElement {
  return h(
    "div",
    { class: "gr-hub__counter", testId, title, dataValue: value },
    h("span", { class: "gr-icon", html: icon }),
    h("span", { class: "gr-hub__counter-value", text: value }),
  );
}

function stat(label: string, value: string): HTMLElement {
  return h("div", { class: "gr-hub__stat" }, h("dt", { text: label }), h("dd", { text: value }));
}
