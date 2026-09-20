import type { PlayerSettings } from "../../../core/save/PlayerProgress";
import { getSettings, updateSettings } from "../../../systems/settings";
import { fill, h } from "../h";
import { ICONS } from "../icons";
import type { Screen, ScreenHost } from "../ScreenHost";
import { collectionScreen } from "./CollectionScreen";
import { getProgression } from "../../../systems/progression";
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
  /** O lado escolhido À MÃO nesta sessão vence o palpite da cena, para não brigar com o jogador. */
  let side: "left" | "right" = pausePreference() ?? info.side;

  return {
    id: "pause",
    render(host: ScreenHost) {
      const root = h("div", { class: `gr-pause gr-pause--${side}`, testId: "pause-panel", dataSide: side });
      const drawer = h("div", { class: "gr-pause__drawer" });
      root.append(drawer);
      makeDraggable(root, drawer, side, (next) => {
        side = next;
        rememberPauseSide(next);
      });

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
          // A alça: é por ela que a gaveta anda de um lado para o outro. Fica acima de tudo porque
          // arrastar pelo corpo esbarraria nos controles deslizantes dos ajustes.
          h(
            "div",
            { class: "gr-pause__grip", testId: "pause-grip", title: "Arraste para mudar a gaveta de lado" },
            h("span", { class: "gr-pause__grip-bar" }),
            h("span", { class: "gr-hint", text: "arraste para o lado" }),
          ),
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
                        // A Escola virou aba do Álbum; o atalho da pausa abre o álbum já nela.
            action("ESCOLA DO RECIFE", ICONS.target, "pause-school", () =>
              host.push(collectionScreen(getProgression(), () => host.pop(), undefined, { tab: "school" })),
            ),
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

/**
 * A gaveta anda para os lados no arrasto.
 *
 * A cena escolhe um lado olhando por onde a rota passa, mas ela não sabe de que lado está a coisa
 * que ESTE jogador quer olhar agora. Arrastar resolve na hora: enquanto o dedo está na tela a
 * gaveta segue o dedo; ao soltar, ela encosta no lado mais perto e aquele lado fica valendo para as
 * próximas pausas desta sessão.
 *
 * Só a alça arrasta. O corpo da gaveta tem controles deslizantes de volume, e um arrasto que
 * começasse neles roubaria o gesto de quem só queria baixar a música.
 */
function makeDraggable(root: HTMLElement, drawer: HTMLElement, initialSide: "left" | "right", onSide: (side: "left" | "right") => void): void {
  let pointerId: number | null = null;
  let startX = 0;
  /** Limites do arrasto, medidos no começo do gesto: a gaveta nunca sai da moldura. */
  let minOffset = 0;
  let maxOffset = 0;
  let side = initialSide;

  const grip = (): HTMLElement | null => drawer.querySelector(".gr-pause__grip");

  const move = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    const offset = Math.max(minOffset, Math.min(maxOffset, event.clientX - startX));
    drawer.style.transform = `translateX(${offset}px)`;
  };

  const end = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    drawer.classList.remove("gr-pause__drawer--dragging");
    // Encosta no lado mais perto: o centro da gaveta decide.
    const bounds = drawer.getBoundingClientRect();
    const rootBounds = root.getBoundingClientRect();
    const next = bounds.left + bounds.width / 2 < rootBounds.left + rootBounds.width / 2 ? "left" : "right";
    drawer.style.transform = "";
    if (next !== side) {
      side = next;
      onSide(next);
    }
    root.classList.remove("gr-pause--left", "gr-pause--right");
    root.classList.add(`gr-pause--${side}`);
    root.dataset.side = side;
  };

  const start = (event: PointerEvent): void => {
    if (pointerId !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    const rootBounds = root.getBoundingClientRect();
    const bounds = drawer.getBoundingClientRect();
    const pad = Number.parseFloat(getComputedStyle(root).paddingLeft) || 0;
    minOffset = rootBounds.left + pad - bounds.left;
    maxOffset = rootBounds.right - pad - bounds.right;
    drawer.classList.add("gr-pause__drawer--dragging");
    drawer.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  // A alça é recriada a cada redesenho da gaveta, então o ouvinte fica no ancestral que permanece.
  drawer.addEventListener("pointerdown", (event) => {
    const handle = grip();
    if (!handle || !handle.contains(event.target as Node)) return;
    start(event);
  });
  drawer.addEventListener("pointermove", move);
  drawer.addEventListener("pointerup", end);
  drawer.addEventListener("pointercancel", end);
}

/** O lado escolhido à mão, guardado só para esta sessão do navegador. */
let chosenSide: "left" | "right" | null = null;

function pausePreference(): "left" | "right" | null {
  return chosenSide;
}

function rememberPauseSide(side: "left" | "right"): void {
  chosenSide = side;
}
