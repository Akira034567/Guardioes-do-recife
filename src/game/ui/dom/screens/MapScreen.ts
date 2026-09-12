import { artPath, GUARDIAN_ART } from "../../../assets/guardianArt";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import { ENCOUNTERS, type EncounterDefinition } from "../../../data/encounters";
import { GUARDIANS } from "../../../data/guardians";
import { LEVELS } from "../../../data/levels";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import type { LevelDefinition } from "../../../types";
import { button, h } from "../h";
import type { Screen, ScreenHost } from "../ScreenHost";

export type NodeState = "locked" | "available" | "completed" | "perfect";

export interface MapActions {
  onPlayLevel(level: LevelDefinition): void;
  onPlayEncounter(encounter: EncounterDefinition): void;
  onOpenCollection(): void;
  onOpenBestiary(): void;
  onOpenStories(): void;
  onOpenSettings(): void;
  onResetProgress(): void;
}

/** Estado de uma fase da campanha: bloqueada, aberta, concluída ou concluída com três estrelas. */
export function levelNodeState(levelId: string, progression: ProgressionService, unlocked: boolean): NodeState {
  const record = progression.record(levelId);
  if (!record) return unlocked ? "available" : "locked";
  if (record.stars >= 3) return "perfect";
  return "completed";
}

/** Estado de um Encontro: fechado até a condição dele, depois aberto e, por fim, concluído. */
export function encounterNodeState(encounter: EncounterDefinition, progression: ProgressionService): NodeState {
  const progress = progression.progress;
  if (progress.completedEncounters.includes(encounter.id)) return "completed";
  const requires = encounter.requires;
  const levelOk = !requires.levelCompleted || progress.completedLevels.includes(requires.levelCompleted);
  const secretOk = !requires.secretFound || progress.discoveredSecrets.includes(requires.secretFound);
  return levelOk && secretOk ? "available" : "locked";
}

/**
 * Mapa de progressão (item 29): as seis fases em sequência e, penduradas nelas, as fases de Encontro
 * onde os Guardiões são achados. É a tela inicial do jogo fora da partida.
 */
export function mapScreen(progression: ProgressionService, isUnlocked: (levelId: string) => boolean, actions: MapActions): Screen {
  return {
    id: "map",
    render(host: ScreenHost) {
      const stars = Object.values(progression.progress.levelStars).reduce((total, record) => total + record.stars, 0);
      const found = ENCOUNTERS.filter((encounter) => progression.progress.completedEncounters.includes(encounter.id)).length;
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel gr-panel--map", testId: "map-panel" },
          h(
            "div",
            { class: "gr-map__header" },
            h(
              "div",
              {},
              h("h1", { class: "gr-title", text: "MAPA DO RECIFE" }),
              h("p", { class: "gr-subtitle", text: "Cada fase concluída abre a seguinte. Os Encontros aparecem pelo caminho." }),
            ),
            h(
              "div",
              { class: "gr-map__counters" },
              h("span", { class: "gr-badge", testId: "map-shells", text: `${GLOBAL_CURRENCY.symbol} ${progression.progress.currency.shells}` }),
              h("span", { class: "gr-badge", testId: "map-stars", text: `★ ${stars}/${LEVELS.length * 3}` }),
              h("span", { class: "gr-badge", testId: "map-encounters", text: `Encontros ${found}/${ENCOUNTERS.length}` }),
            ),
          ),
          h(
            "div",
            { class: "gr-map", testId: "map-track" },
            ...LEVELS.map((level, index) => column(level, index, progression, isUnlocked, actions)),
          ),
          h(
            "div",
            { class: "gr-actions gr-map__nav" },
            button("ÁLBUM DO RECIFE", actions.onOpenCollection, { testId: "map-collection" }),
            button("AMEAÇAS DO RECIFE", actions.onOpenBestiary, { testId: "map-bestiary" }),
            button("HISTÓRIAS", actions.onOpenStories, { testId: "map-stories" }),
            button("CONFIGURAÇÕES", actions.onOpenSettings, { testId: "map-settings" }),
            button("LIMPAR PROGRESSO", () => host.push(confirmResetScreen(() => host.pop(), actions.onResetProgress)), { testId: "map-reset" }),
          ),
        ),
      );
    },
  };
}

function column(
  level: LevelDefinition,
  index: number,
  progression: ProgressionService,
  isUnlocked: (levelId: string) => boolean,
  actions: MapActions,
): HTMLElement {
  const state = levelNodeState(level.id, progression, isUnlocked(level.id));
  const record = progression.record(level.id);
  const encounter = ENCOUNTERS.find((candidate) => candidate.after === level.id);
  return h(
    "div",
    { class: "gr-map__column" },
    h(
      "button",
      {
        class: "gr-node gr-node--level",
        testId: `map-node-${level.id}`,
        dataState: state,
        type: "button",
        disabled: state === "locked",
        onClick: () => actions.onPlayLevel(level),
      },
      h("span", { class: "gr-node__index", text: `FASE ${index + 1}` }),
      h("span", { class: "gr-node__name", text: level.name }),
      h("span", { class: "gr-node__stars", text: state === "locked" ? "— — —" : "★★★".slice(0, record?.stars ?? 0).padEnd(3, "☆") }),
      h("span", { class: "gr-hint", text: state === "locked" ? "Conclua a fase anterior" : level.subtitle }),
    ),
    encounter ? h("div", { class: "gr-map__link" }) : null,
    encounter ? encounterNode(encounter, progression, actions) : null,
  );
}

function encounterNode(encounter: EncounterDefinition, progression: ProgressionService, actions: MapActions): HTMLElement {
  const state = encounterNodeState(encounter, progression);
  const definition = GUARDIANS[encounter.guardianId];
  const art = artPath(encounter.guardianId, GUARDIAN_ART[encounter.guardianId].base, "idle");
  return h(
    "button",
    {
      class: "gr-node gr-node--encounter",
      testId: `map-node-${encounter.id}`,
      dataState: state,
      type: "button",
      disabled: state === "locked",
      onClick: () => actions.onPlayEncounter(encounter),
    },
    h("img", { class: `gr-node__art ${state === "completed" ? "" : "gr-node__art--unknown"}`, src: art, alt: "" }),
    h("span", { class: "gr-node__index", text: "encontro" }),
    h("span", { class: "gr-node__name", text: state === "completed" ? definition.name : encounter.level.name }),
    h("span", { class: "gr-hint", text: state === "locked" ? lockedHint(encounter) : state === "completed" ? "Já faz parte do Recife." : encounter.teaser }),
  );
}

function lockedHint(encounter: EncounterDefinition): string {
  if (encounter.requires.secretFound) return "Existe alguma coisa escondida em uma das fases.";
  return "Avance na campanha para chegar até aqui.";
}

/** Limpar progresso apaga tudo: melhor perguntar duas vezes. */
function confirmResetScreen(onCancel: () => void, onConfirm: () => void): Screen {
  return {
    id: "confirm-reset",
    render() {
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel", testId: "confirm-reset" },
          h("h1", { class: "gr-title gr-title--defeat", text: "LIMPAR PROGRESSO" }),
          h("p", { text: "Isto apaga fases, estrelas, Conchas, Guardiões encontrados e histórias lidas. Não dá para desfazer." }),
          h(
            "div",
            { class: "gr-actions" },
            button("CANCELAR", onCancel, { testId: "confirm-reset-cancel", variant: "primary" }),
            button("APAGAR TUDO", onConfirm, { testId: "confirm-reset-ok", variant: "danger" }),
          ),
        ),
      );
    },
  };
}
