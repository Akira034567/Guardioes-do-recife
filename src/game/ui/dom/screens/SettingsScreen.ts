import type { PlayerSettings } from "../../../core/save/PlayerProgress";
import { getSettings, updateSettings } from "../../../systems/settings";
import { button, h } from "../h";
import type { Screen } from "../ScreenHost";

const UI_SCALE_LABELS: Array<[PlayerSettings["uiScale"], string]> = [
  ["small", "PEQUENA"],
  ["normal", "NORMAL"],
  ["large", "GRANDE"],
];

/** Configurações (item 36). Cada mudança grava no save na hora; não existe "cancelar". */
export function settingsScreen(onBack: () => void): Screen {
  return {
    id: "settings",
    render() {
      const root = h("div", {});
      const panel = h("div", { class: "gr-panel", testId: "settings-panel" });
      root.append(panel);

      const draw = (): void => {
        const settings = getSettings();
        const apply = (patch: Partial<PlayerSettings>): void => {
          updateSettings(patch);
          draw();
        };
        panel.replaceChildren(
          h("h1", { class: "gr-title", text: "CONFIGURAÇÕES" }),
          h("p", { class: "gr-subtitle", text: "Tudo é salvo na hora." }),
          slider("Volume geral", "settings-master", settings.masterVolume, (value) => updateSettings({ masterVolume: value })),
          slider("Efeitos sonoros", "settings-sfx", settings.sfxVolume, (value) => updateSettings({ sfxVolume: value })),
          toggle("Silenciar tudo", "settings-mute", settings.muted, (value) => apply({ muted: value })),
          toggle("Efeitos reduzidos", "settings-reduced", settings.reducedEffects, (value) => apply({ reducedEffects: value })),
          toggle("Tremor de tela", "settings-shake", settings.screenShake, (value) => apply({ screenShake: value })),
          h(
            "div",
            { class: "gr-row", testId: "settings-ui-scale", dataValue: settings.uiScale },
            h("span", { class: "gr-row__label", text: "Escala da interface" }),
            h(
              "div",
              { class: "gr-actions", style: "justify-content:flex-end" },
              ...UI_SCALE_LABELS.map(([value, label]) =>
                button(label, () => apply({ uiScale: value }), { testId: `settings-scale-${value}`, variant: settings.uiScale === value ? "primary" : "ghost" }),
              ),
            ),
          ),
          h("p", { class: "gr-hint", text: "Números de dano e trilha sonora chegam com a próxima etapa." }),
          h("div", { class: "gr-actions" }, button("VOLTAR", onBack, { testId: "settings-back", variant: "primary" })),
        );
      };

      draw();
      return root;
    },
  };
}

function slider(label: string, testId: string, value: number, onInput: (value: number) => void): HTMLElement {
  const output = h("span", { class: "gr-row__value", text: `${Math.round(value * 100)}%` });
  const input = h("input", {
    class: "gr-slider",
    testId,
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: String(Math.round(value * 100)),
  }) as HTMLInputElement;
  input.addEventListener("input", () => {
    const next = Number(input.value) / 100;
    output.textContent = `${input.value}%`;
    onInput(next);
  });
  return h("div", { class: "gr-row" }, h("span", { class: "gr-row__label", text: label }), input, output);
}

function toggle(label: string, testId: string, on: boolean, onChange: (value: boolean) => void): HTMLElement {
  return h(
    "div",
    { class: "gr-row" },
    h("span", { class: "gr-row__label", text: label }),
    button(on ? "SIM" : "NÃO", () => onChange(!on), { testId, variant: on ? "primary" : "ghost" }),
  );
}
