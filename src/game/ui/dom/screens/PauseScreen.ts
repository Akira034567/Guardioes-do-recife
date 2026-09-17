import type { PlayerSettings } from "../../../core/save/PlayerProgress";
import { getSettings, updateSettings } from "../../../systems/settings";
import { fill, h } from "../h";
import { ICONS } from "../icons";
import type { Screen, ScreenHost } from "../ScreenHost";
import { schoolScreen } from "./SchoolScreen";
import { settingsSections } from "./SettingsScreen";

export interface PauseActions {
  onResume(): void;
  onRestart(): void;
  onLevels(): void;
  onExit(): void;
}

export interface PauseInfo {
  levelName: string;
  waveLabel: string;
  reefLabel: string;
  pearls: number;
  /**
   * Lado em que a gaveta encosta. Quem decide é a cena, olhando por onde a rota passa: a pausa não
   * pode cobrir a pista, que é justamente o que o jogador parou o jogo para olhar.
   */
  side: "left" | "right";
}

/**
 * PAUSA — uma gaveta ao lado do mapa, não um painel em cima dele.
 *
 * Antes era um painel centralizado com um véu escuro por cima de tudo: o jogador pausava para
 * ESTUDAR o campo e a primeira coisa que o jogo fazia era esconder o campo. Agora a partida congela,
 * o mapa continua à vista, e tudo — estado, comandos e os ajustes inteiros — mora numa coluna
 * encostada no lado por onde a rota NÃO passa.
 *
 * Reiniciar e Fases vieram do HUD para cá. Eles jogam a partida fora e estavam a um toque acidental
 * de distância, ao lado de "PRÓXIMA ONDA", que é o botão mais clicado do jogo. Aqui os dois pedem
 * confirmação: o primeiro toque arma, o segundo executa.
 */
export function pauseScreen(info: PauseInfo, actions: PauseActions): Screen {
  /** Qual comando destrutivo está armado, esperando o segundo toque. */
  let armed: "restart" | "levels" | null = null;

  return {
    id: "pause",
    render(host: ScreenHost) {
      const root = h("div", { class: `gr-pause gr-pause--${info.side}`, testId: "pause-panel" });
      const drawer = h("div", { class: "gr-pause__drawer" });
      root.append(drawer);

      const draw = (): void => {
        const settings = getSettings();
        const apply = (patch: Partial<PlayerSettings>): void => {
          updateSettings(patch);
          draw();
        };

        /** Botão que só age no segundo toque. O primeiro troca o rótulo e arma. */
        const confirm = (key: "restart" | "levels", label: string, icon: string, testId: string, run: () => void): HTMLElement =>
          h(
            "button",
            {
              class: `gr-pause__action${armed === key ? " gr-pause__action--armed" : ""}`,
              testId,
              type: "button",
              dataArmed: armed === key ? "true" : "false",
              onClick: () => {
                if (armed === key) {
                  run();
                  return;
                }
                armed = key;
                draw();
              },
            },
            h("span", { class: "gr-icon", html: icon }),
            h("span", { text: armed === key ? "TOQUE DE NOVO PARA CONFIRMAR" : label }),
          );

        const action = (label: string, icon: string, testId: string, run: () => void, tone = ""): HTMLElement =>
          h(
            "button",
            {
              class: `gr-pause__action${tone}`,
              testId,
              type: "button",
              onClick: () => {
                armed = null;
                run();
              },
            },
            h("span", { class: "gr-icon", html: icon }),
            h("span", { text: label }),
          );

        fill(
          drawer,
          h(
            "div",
            { class: "gr-pause__head" },
            h("span", { class: "gr-badge", text: "partida pausada" }),
            h("h1", { class: "gr-pause__title", text: info.levelName }),
            h(
              "div",
              { class: "gr-pause__stats" },
              h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Onda" }), h("span", { class: "gr-stat__value", text: info.waveLabel })),
              h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Recife" }), h("span", { class: "gr-stat__value", text: info.reefLabel })),
              h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Pérolas" }), h("span", { class: "gr-stat__value", text: `◉ ${info.pearls}` })),
            ),
          ),
          h(
            "div",
            { class: "gr-pause__actions" },
            action("CONTINUAR", ICONS.play, "pause-resume", actions.onResume, " gr-pause__action--primary"),
            action("ESCOLA DO RECIFE", ICONS.target, "pause-school", () => host.push(schoolScreen(() => host.pop()))),
            confirm("restart", "REINICIAR FASE", ICONS.timer, "pause-restart", actions.onRestart),
            confirm("levels", "FASES", ICONS.compass, "pause-levels", actions.onLevels),
            action("SAIR PARA O RECIFE", ICONS.coral, "pause-exit", actions.onExit),
          ),
          h("div", { class: "gr-pause__settings" }, ...settingsSections(settings, apply, host, draw)),
        );
      };

      draw();
      return root;
    },
  };
}
