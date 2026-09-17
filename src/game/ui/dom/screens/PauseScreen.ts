import { button, h } from "../h";
import type { Screen, ScreenHost } from "../ScreenHost";
import { schoolScreen } from "./SchoolScreen";
import { settingsScreen } from "./SettingsScreen";

export interface PauseActions {
  onResume(): void;
  onRestart(): void;
  onExit(): void;
}

export interface PauseInfo {
  levelName: string;
  waveLabel: string;
  reefLabel: string;
  pearls: number;
}

/**
 * Menu de pause (item 36): continuar, consultar a Escola, reiniciar, configurações e sair.
 *
 * A Escola entra aqui porque é o único lugar onde o jogador pode consultar o manual SEM abandonar a
 * partida. A dúvida que ela responde — "o que é esse ícone?", "por que meu tiro erra nessa faixa?" —
 * nasce no meio da onda, e mandar o jogador sair da fase para descobrir é pedir que ele não descubra.
 */
export function pauseScreen(info: PauseInfo, actions: PauseActions): Screen {
  return {
    id: "pause",
    render(host: ScreenHost) {
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel", testId: "pause-panel" },
          h("span", { class: "gr-badge", text: "partida pausada" }),
          h("h1", { class: "gr-title", text: info.levelName }),
          h(
            "div",
            { class: "gr-grid" },
            h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Onda" }), h("span", { class: "gr-stat__value", text: info.waveLabel })),
            h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Recife" }), h("span", { class: "gr-stat__value", text: info.reefLabel })),
            h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Pérolas" }), h("span", { class: "gr-stat__value", text: `◉ ${info.pearls}` })),
          ),
          h(
            "div",
            { class: "gr-actions gr-actions--stack" },
            button("CONTINUAR", actions.onResume, { testId: "pause-resume", variant: "primary" }),
            button("ESCOLA DO RECIFE", () => host.push(schoolScreen(() => host.pop())), { testId: "pause-school" }),
            button("CONFIGURAÇÕES", () => host.push(settingsScreen(() => host.pop())), { testId: "pause-settings" }),
            button("REINICIAR FASE", actions.onRestart, { testId: "pause-restart" }),
            button("SAIR PARA O RECIFE", actions.onExit, { testId: "pause-exit" }),
          ),
        ),
      );
    },
  };
}
