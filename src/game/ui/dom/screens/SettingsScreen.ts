import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import type { PlayerSettings } from "../../../core/save/PlayerProgress";
import { LEVELS } from "../../../data/levels";
import { getSettings, updateSettings } from "../../../systems/settings";
import { resetTutorial, tutorialDone } from "../../../systems/tutorial";
import { h } from "../h";
import { ICONS } from "../icons";
import type { Screen, ScreenHost } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

const UI_SCALE_LABELS: Array<[PlayerSettings["uiScale"], string]> = [
  ["small", "Pequena"],
  ["normal", "Normal"],
  ["large", "Grande"],
];

/**
 * Configurações (item 36). Cada mudança grava no save na hora; não existe "cancelar" nem "aplicar".
 *
 * A tela serve a dois lugares: aberta pelo menu do Recife ela vem com a coluna da esquerda, como as
 * outras seções; aberta pela pausa, no meio de uma partida, ela vem sozinha — ali o menu do Recife
 * não faria sentido.
 */
export function settingsScreen(onBack: () => void, nav?: ShellNav): Screen {
  let host: ScreenHost | null = null;
  let redraw = (): void => {};
  // A saída da tela cheia pode vir do jogador (tecla Esc), não só do botão: a tela escuta o navegador.
  const onFullscreenChange = (): void => redraw();

  return {
    id: "settings",
    onClose() {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    },
    render(screenHost: ScreenHost) {
      host = screenHost;
      document.addEventListener("fullscreenchange", onFullscreenChange);
      const root = h("div", { class: `gr-album gr-config${nav ? "" : " gr-config--bare"}`, testId: "settings-panel" });
      // Aberta pela pausa a tela fica por cima da partida; ali o fundo do Recife só atrapalharia.
      const art = nav ? levelBackgroundPath(LEVELS[1].backgroundKey) : null;
      if (art) root.append(h("div", { class: "gr-world__backdrop", style: `background-image:url(${art})` }));
      const layout = h("div", { class: "gr-album__layout" });
      root.append(layout);

      const draw = (): void => {
        const settings = getSettings();
        const apply = (patch: Partial<PlayerSettings>): void => {
          updateSettings(patch);
          draw();
        };

        layout.replaceChildren(
          nav
            ? shellSidebar("settings", nav, {
                navId: (section) => `settings-nav-${section}`,
                back: onBack,
                backId: "settings-back",
                motto: "Ajuste do seu jeito. O importante é continuar no mar.",
              })
            : h(
                "aside",
                { class: "gr-world__side gr-world__side--bare" },
                h(
                  "button",
                  { class: "gr-world__back", testId: "settings-back", type: "button", onClick: onBack },
                  h("span", { class: "gr-icon", html: ICONS.chevronLeft }),
                  h("span", { text: "VOLTAR" }),
                ),
              ),
          h(
            "div",
            { class: "gr-album__main" },
            header(),
            h(
              "div",
              { class: "gr-config__body" },
              h(
                "div",
                { class: "gr-config__column" },
                audioSection(settings, apply),
                videoSection(settings, apply, host),
                playSection(settings, apply),
              ),
              h("div", { class: "gr-config__column" }, accessSection(settings, apply), dataSection(apply, draw)),
            ),
            h("p", { class: "gr-album__foot", text: "Tudo é salvo na hora — não existe “aplicar”." }),
          ),
        );
      };

      redraw = draw;
      draw();
      return root;
    },
  };
}

function header(): HTMLElement {
  return h(
    "header",
    { class: "gr-album__top" },
    h(
      "div",
      { class: "gr-album__titles" },
      h("h1", { class: "gr-album__title", text: "CONFIGURAÇÕES" }),
      h("p", { class: "gr-subtitle", text: "Tudo funciona melhor quando está no seu ritmo." }),
    ),
    h("p", { class: "gr-album__quote", text: "“Mesmo no oceano, cada detalhe importa.”" }),
  );
}

// ------------------------------------------------------------------------------- seções

function section(icon: string, title: string, subtitle: string, testId: string, ...rows: Array<HTMLElement | null>): HTMLElement {
  return h(
    "section",
    { class: "gr-config__card", testId },
    h(
      "div",
      { class: "gr-config__head" },
      h("span", { class: "gr-icon gr-icon--lg", html: icon }),
      h(
        "span",
        { class: "gr-config__head-copy" },
        h("span", { class: "gr-config__title", text: title.toUpperCase() }),
        h("span", { class: "gr-hint", text: subtitle }),
      ),
    ),
    ...rows,
  );
}

function audioSection(settings: PlayerSettings, apply: (patch: Partial<PlayerSettings>) => void): HTMLElement {
  return section(
    ICONS.waves,
    "Áudio",
    "Sinta o som do oceano.",
    "settings-audio",
    slider(ICONS.waves, "Volume geral", "settings-master", settings.masterVolume, (value) => updateSettings({ masterVolume: value })),
    slider(ICONS.spiky, "Efeitos sonoros", "settings-sfx", settings.sfxVolume, (value) => updateSettings({ sfxVolume: value })),
    slider(ICONS.book, "Trilha sonora", "settings-music", settings.musicVolume, (value) => updateSettings({ musicVolume: value })),
    choice(ICONS.lock, "Silenciar tudo", "settings-mute", settings.muted, (value) => apply({ muted: value })),
  );
}

function videoSection(settings: PlayerSettings, apply: (patch: Partial<PlayerSettings>) => void, host: ScreenHost | null): HTMLElement {
  const fullscreen = host?.isFullscreen ?? false;
  return section(
    ICONS.compass,
    "Vídeo",
    "Deixe o Recife ainda mais bonito.",
    "settings-video",
    h(
      "div",
      { class: "gr-config__row", testId: "settings-ui-scale", dataValue: settings.uiScale },
      h("span", { class: "gr-icon", html: ICONS.plus }),
      h("span", { class: "gr-config__label", text: "Escala da interface" }),
      h(
        "span",
        { class: "gr-config__seg" },
        ...UI_SCALE_LABELS.map(([value, label]) =>
          segButton(label, settings.uiScale === value, () => apply({ uiScale: value }), `settings-scale-${value}`),
        ),
      ),
    ),
    h(
      "div",
      { class: "gr-config__row", testId: "settings-fullscreen", dataValue: fullscreen ? "fullscreen" : "window" },
      h("span", { class: "gr-icon", html: ICONS.coral }),
      h("span", { class: "gr-config__label", text: "Modo de tela" }),
      h(
        "span",
        { class: "gr-config__seg" },
        segButton("Janela", !fullscreen, () => host?.toggleFullscreen(), "settings-window"),
        segButton("Tela cheia", fullscreen, () => host?.toggleFullscreen(), "settings-fullscreen-on"),
      ),
    ),
  );
}

function playSection(settings: PlayerSettings, apply: (patch: Partial<PlayerSettings>) => void): HTMLElement {
  return section(
    ICONS.swords,
    "Jogabilidade",
    "Do seu jeito, no seu ritmo.",
    "settings-play",
    choice(ICONS.waves, "Tremor de tela", "settings-shake", settings.screenShake, (value) => apply({ screenShake: value })),
    choice(ICONS.target, "Números de dano", "settings-damage", settings.damageNumbers, (value) => apply({ damageNumbers: value })),
  );
}

function accessSection(settings: PlayerSettings, apply: (patch: Partial<PlayerSettings>) => void): HTMLElement {
  return section(
    ICONS.squad,
    "Acessibilidade",
    "Um oceano para todos.",
    "settings-access",
    choice(ICONS.trident, "Alto contraste", "settings-contrast", settings.highContrast, (value) => apply({ highContrast: value })),
    choice(ICONS.star, "Efeitos reduzidos", "settings-reduced", settings.reducedEffects, (value) => apply({ reducedEffects: value })),
    h("p", { class: "gr-hint gr-config__note", text: "O alto contraste deixa os menus mais sólidos e as bordas mais fortes. O tamanho do texto acompanha a escala da interface." }),
  );
}

function dataSection(apply: (patch: Partial<PlayerSettings>) => void, redraw: () => void): HTMLElement {
  const done = tutorialDone();
  return section(
    ICONS.chest,
    "Dados",
    "O progresso fica neste aparelho.",
    "settings-data",
    h(
      "div",
      { class: "gr-config__row", testId: "settings-tutorial", dataValue: done ? "done" : "pending" },
      h("span", { class: "gr-icon", html: ICONS.book }),
      h("span", { class: "gr-config__label", text: "Dicas do tutorial" }),
      h(
        "button",
        {
          class: "gr-config__action",
          testId: "settings-reset-tutorial",
          type: "button",
          disabled: !done,
          onClick: () => {
            resetTutorial();
            redraw();
          },
        },
        h("span", { class: "gr-icon", html: ICONS.play }),
        h("span", { text: done ? "REINICIAR TUTORIAIS" : "AINDA RODANDO" }),
      ),
    ),
    h(
      "div",
      { class: "gr-config__row" },
      h("span", { class: "gr-icon", html: ICONS.gear }),
      h("span", { class: "gr-config__label", text: "Ajustes" }),
      h(
        "button",
        {
          class: "gr-config__action",
          testId: "settings-restore",
          type: "button",
          onClick: () => apply({ masterVolume: 1, musicVolume: 0.8, sfxVolume: 1, muted: false, reducedEffects: false, screenShake: true, damageNumbers: true, highContrast: false, uiScale: "normal" }),
        },
        h("span", { class: "gr-icon", html: ICONS.timer }),
        h("span", { text: "RESTAURAR PADRÃO" }),
      ),
    ),
    h("p", { class: "gr-hint gr-config__note", text: "Para apagar fases, estrelas e Guardiões, use “limpar progresso” no mapa do Recife." }),
  );
}

// ------------------------------------------------------------------------------- controles

function slider(icon: string, label: string, testId: string, value: number, onInput: (value: number) => void): HTMLElement {
  const output = h("span", { class: "gr-config__value", text: `${Math.round(value * 100)}%` });
  const input = h("input", {
    class: "gr-slider",
    testId,
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: String(Math.round(value * 100)),
    "aria-label": label,
  }) as HTMLInputElement;
  input.addEventListener("input", () => {
    output.textContent = `${input.value}%`;
    onInput(Number(input.value) / 100);
  });
  return h(
    "div",
    { class: "gr-config__row" },
    h("span", { class: "gr-icon", html: icon }),
    h("span", { class: "gr-config__label", text: label }),
    input,
    output,
  );
}

/** Um par NÃO/SIM, como no resto da tela: a escolha atual fica acesa. */
function choice(icon: string, label: string, testId: string, on: boolean, onChange: (value: boolean) => void): HTMLElement {
  return h(
    "div",
    { class: "gr-config__row", dataValue: on ? "sim" : "nao" },
    h("span", { class: "gr-icon", html: icon }),
    h("span", { class: "gr-config__label", text: label }),
    h(
      "span",
      { class: "gr-config__seg" },
      segButton("Não", !on, () => onChange(false), `${testId}-off`),
      segButton("Sim", on, () => onChange(true), testId),
    ),
  );
}

function segButton(label: string, on: boolean, onClick: () => void, testId: string): HTMLElement {
  return h("button", {
    class: `gr-config__seg-button${on ? " gr-config__seg-button--on" : ""}`,
    testId,
    type: "button",
    text: label.toUpperCase(),
    "aria-pressed": String(on),
    onClick,
  });
}
