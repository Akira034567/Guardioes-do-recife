import { objectiveLabel } from "../../../core/progression/objectives";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from "../../../data/difficulty";
import { ENEMIES } from "../../../data/enemies";
import { GUARDIANS, LOADOUT_SIZE } from "../../../data/guardians";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import type { GuardianId, LevelDefinition } from "../../../types";
import { button, h } from "../h";
import type { Screen } from "../ScreenHost";

export interface PreparationActions {
  onStart(difficulty: DifficultyId, loadout: GuardianId[]): void;
  onBack(): void;
}

/**
 * Tela de preparação (item 20): o que esperar da fase e qual esquadrão levar. O jogador escolhe
 * exatamente `LOADOUT_SIZE` Guardiões entre os que já encontrou.
 */
export function preparationScreen(
  level: LevelDefinition,
  levelIndex: number,
  progression: ProgressionService,
  actions: PreparationActions,
  initial: { difficulty: DifficultyId; loadout: GuardianId[] },
): Screen {
  let difficulty = initial.difficulty;
  const squad: GuardianId[] = initial.loadout.filter((id) => progression.isUnlocked(id)).slice(0, LOADOUT_SIZE);
  const statuses = new Map(progression.unlockStatuses().map((status) => [status.guardianId, status]));
  const record = progression.record(level.id);

  return {
    id: "preparation",
    render() {
      const root = h("div", {});
      const panel = h("div", { class: "gr-panel", testId: "prep-panel", dataLevel: level.id });
      root.append(panel);

      const draw = (): void => {
        panel.replaceChildren();
        panel.append(
          h("span", { class: "gr-badge", text: `Fase ${levelIndex + 1}` }),
          h("h1", { class: "gr-title", text: level.name }),
          h("p", { class: "gr-subtitle", text: level.subtitle }),
          statsRow(level, record?.stars ?? 0),
          objectives(level),
          difficultyPicker(difficulty, (next) => {
            difficulty = next;
            draw();
          }),
          knownEnemies(level, progression),
          squadPicker(squad, statuses, progression, draw),
          h(
            "div",
            { class: "gr-actions" },
            button("VOLTAR", actions.onBack, { testId: "prep-back" }),
            button("PROTEGER O RECIFE", () => actions.onStart(difficulty, [...squad]), {
              testId: "prep-start",
              variant: "primary",
              disabled: squad.length !== LOADOUT_SIZE,
            }),
          ),
        );
      };

      draw();
      return root;
    },
  };
}

function statsRow(level: LevelDefinition, stars: number): HTMLElement {
  const bosses = new Set(level.waves.flatMap((wave) => wave.groups.filter((group) => ENEMIES[group.enemyId].isBoss).map((group) => group.enemyId)));
  return h(
    "div",
    { class: "gr-grid" },
    h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Ondas" }), h("span", { class: "gr-stat__value", text: String(level.waves.length) })),
    h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Vidas do Recife" }), h("span", { class: "gr-stat__value", text: String(level.reefHealth) })),
    h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Pérolas iniciais" }), h("span", { class: "gr-stat__value", text: String(level.startingPearls) })),
    h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: "Estrelas" }), h("span", { class: "gr-stat__value", text: `${stars}/3` })),
    bosses.size > 0
      ? h(
          "div",
          { class: "gr-stat" },
          h("span", { class: "gr-stat__label", text: "Chefe" }),
          h("span", { class: "gr-stat__value", text: [...bosses].map((id) => ENEMIES[id].name).join(", ") }),
        )
      : null,
  );
}

function objectives(level: LevelDefinition): HTMLElement {
  return h(
    "ul",
    { class: "gr-objectives", testId: "prep-objectives" },
    ...(level.objectives ?? []).map((objective) => h("li", { class: "gr-objective" }, h("span", { class: "gr-objective__mark", text: "☆" }), h("span", { text: objectiveLabel(objective) }))),
  );
}

function difficultyPicker(current: DifficultyId, onPick: (id: DifficultyId) => void): HTMLElement {
  return h(
    "div",
    { class: "gr-actions", testId: "prep-difficulty", dataValue: current, style: "justify-content:flex-start" },
    ...DIFFICULTY_IDS.map((id) =>
      button(DIFFICULTIES[id].name.toUpperCase(), () => onPick(id), { testId: `prep-difficulty-${id}`, variant: id === current ? "primary" : "ghost" }),
    ),
  );
}

/** Inimigos que o jogador já encontrou aparecem pelo nome; o resto fica em "???". */
function knownEnemies(level: LevelDefinition, progression: ProgressionService): HTMLElement {
  const ids = [...new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))];
  const names = ids.map((id) => (progression.progress.enemyDiscovery[id] ? ENEMIES[id].name : "???"));
  return h("p", { class: "gr-hint", testId: "prep-enemies", text: `Ameaças conhecidas: ${names.join(" · ")}` });
}

function squadPicker(
  squad: GuardianId[],
  statuses: Map<GuardianId, { state: string; hidden: boolean; hint: string; price: number | null }>,
  progression: ProgressionService,
  redraw: () => void,
): HTMLElement {
  const slots = h(
    "div",
    { class: "gr-grid", testId: "prep-slots" },
    ...Array.from({ length: LOADOUT_SIZE }, (_, index) => {
      const guardianId = squad[index];
      return h(
        "div",
        { class: "gr-stat", testId: `prep-slot-${index}`, dataGuardian: guardianId ?? "" },
        h("span", { class: "gr-stat__label", text: `Vaga ${index + 1}` }),
        h("span", { class: "gr-stat__value", text: guardianId ? GUARDIANS[guardianId].shortName : "—" }),
      );
    }),
  );

  const options = h(
    "div",
    { class: "gr-grid", testId: "prep-guardians" },
    ...Object.values(GUARDIANS).map((definition) => {
      const status = statuses.get(definition.id);
      const unlocked = progression.isUnlocked(definition.id);
      const chosen = squad.includes(definition.id);
      if (!unlocked) {
        const hidden = status?.hidden ?? false;
        return h(
          "div",
          { class: "gr-stat", testId: `prep-locked-${definition.id}` },
          h("span", { class: "gr-stat__label", text: hidden ? "???" : definition.name }),
          h("span", { class: "gr-hint", text: hidden ? "Ainda não há sinais deste Guardião." : (status?.hint ?? "") }),
          status?.price !== null && status?.price !== undefined
            ? button(`${GLOBAL_CURRENCY.symbol} ${status.price}`, () => {
                if (progression.buy(definition.id).ok) redraw();
              }, { testId: `prep-buy-${definition.id}`, disabled: status.state !== "available" })
            : null,
        );
      }
      return button(`${chosen ? "✓ " : ""}${definition.shortName}`, () => {
        const index = squad.indexOf(definition.id);
        if (index >= 0) squad.splice(index, 1);
        else if (squad.length < LOADOUT_SIZE) squad.push(definition.id);
        redraw();
      }, { testId: `prep-guardian-${definition.id}`, variant: chosen ? "primary" : "ghost" });
    }),
  );

  return h(
    "div",
    {},
    h("p", { class: "gr-subtitle", text: `SELECIONE SEUS GUARDIÕES (${squad.length}/${LOADOUT_SIZE})` }),
    slots,
    options,
  );
}
