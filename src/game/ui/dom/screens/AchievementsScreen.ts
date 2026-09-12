import { achievementStatuses, type AchievementStatus } from "../../../core/progression/achievements";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import { button, h } from "../h";
import type { Screen } from "../ScreenHost";

/**
 * Conquistas do Recife (item 37): o que o jogador já fez e o que falta. Conquista escondida só
 * aparece pelo nome depois de obtida.
 */
export function achievementsScreen(progression: ProgressionService, onBack: () => void): Screen {
  return {
    id: "achievements",
    render() {
      const statuses = achievementStatuses(progression.progress);
      const done = statuses.filter((status) => status.unlocked).length;
      const shells = statuses.filter((status) => status.unlocked).reduce((total, status) => total + status.definition.shells, 0);
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel", testId: "achievements-panel", dataDone: String(done) },
          h("span", { class: "gr-badge", text: `${done}/${statuses.length} conquistas · ${GLOBAL_CURRENCY.symbol} ${shells}` }),
          h("h1", { class: "gr-title", text: "CONQUISTAS DO RECIFE" }),
          h("p", { class: "gr-subtitle", text: "O que o Recife já viu você fazer." }),
          h("div", { class: "gr-columns" }, ...statuses.map(row)),
          h("div", { class: "gr-actions" }, button("VOLTAR", onBack, { testId: "achievements-back" })),
        ),
      );
    },
  };
}

function row(status: AchievementStatus): HTMLElement {
  const hidden = Boolean(status.definition.hidden) && !status.unlocked;
  const ratio = Math.max(0, Math.min(1, status.progress / status.target));
  return h(
    "div",
    { class: "gr-stat", testId: `achievement-${status.definition.id}`, dataState: status.unlocked ? "unlocked" : "locked" },
    h(
      "span",
      { class: "gr-stat__value", text: `${status.unlocked ? "★ " : ""}${hidden ? "???" : status.definition.name}` },
    ),
    h("span", { class: "gr-hint", text: hidden ? "Uma surpresa guardada para quem procurar." : status.definition.description }),
    h(
      "div",
      { class: "gr-progress" },
      h("div", { class: "gr-progress__track" }, h("div", { class: "gr-progress__fill", style: `width:${Math.round(ratio * 100)}%` })),
      h("span", {
        class: "gr-progress__label",
        text: status.unlocked ? `Conquistada · ${GLOBAL_CURRENCY.symbol} ${status.definition.shells}` : `${status.progress}/${status.target}`,
      }),
    ),
  );
}
