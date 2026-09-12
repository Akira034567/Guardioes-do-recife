import { artTextureKeyForFolder, artVariant, GUARDIAN_ART } from "../../../assets/guardianArt";
import type { MatchResult } from "../../../core/progression/MatchResult";
import { objectiveLabel } from "../../../core/progression/objectives";
import type { MatchOutcome } from "../../../core/progression/ProgressionService";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import { GUARDIANS } from "../../../data/guardians";
import { GUARDIAN_UNLOCKS } from "../../../data/unlocks";
import type { GuardianId } from "../../../types";
import { button, h } from "../h";
import type { Screen, ScreenHost } from "../ScreenHost";

export interface ResultActions {
  onRetry(): void;
  onNextLevel(): void;
  onChangeSquad(): void;
  onMap(): void;
}

const seconds = (ms: number): string => {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function stars(count: number): HTMLElement {
  return h(
    "div",
    { class: "gr-stars", testId: "result-stars", dataStars: String(count) },
    ...[0, 1, 2].map((index) => h("span", { class: `gr-star ${index < count ? "gr-star--on" : ""}`, text: "★" })),
  );
}

function statGrid(entries: Array<[string, string]>): HTMLElement {
  return h(
    "div",
    { class: "gr-grid" },
    ...entries.map(([label, value]) => h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: label }), h("span", { class: "gr-stat__value", text: value }))),
  );
}

function objectiveList(outcome: MatchOutcome): HTMLElement {
  return h(
    "ul",
    { class: "gr-objectives", testId: "result-objectives" },
    ...outcome.objectives.map((objective) =>
      h(
        "li",
        { class: `gr-objective ${objective.achieved ? "gr-objective--done" : ""} ${objective.isNew ? "gr-objective--new" : ""}` },
        h("span", { class: "gr-objective__mark", text: objective.achieved ? "★" : "☆" }),
        h("span", { text: objectiveLabel(objective.definition) }),
        objective.isNew ? h("span", { class: "gr-badge", text: "novo" }) : null,
      ),
    ),
  );
}

function rewardBox(outcome: MatchOutcome): HTMLElement | null {
  if (outcome.rewards.lines.length === 0) return null;
  return h(
    "div",
    { class: "gr-reward", testId: "result-rewards" },
    ...outcome.rewards.lines.map((line) => h("div", { class: "gr-reward__line" }, h("span", { text: line.label }), h("span", { text: `${GLOBAL_CURRENCY.symbol} ${line.shells}` }))),
    h("div", { class: "gr-reward__line gr-reward__total" }, h("span", { text: GLOBAL_CURRENCY.name }), h("span", { text: `${GLOBAL_CURRENCY.symbol} ${outcome.rewards.shells}` })),
  );
}

/** Tela de vitória (item 34): estrelas, objetivos, números da partida e recompensa. */
export function victoryScreen(result: MatchResult, outcome: MatchOutcome, levelName: string, actions: ResultActions): Screen {
  return {
    id: "victory",
    render() {
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel" },
          h("h1", { class: "gr-title gr-title--victory", text: "FASE CONCLUÍDA" }),
          h("p", { class: "gr-subtitle", text: `${levelName} · ${outcome.stars}/3 estrelas` }),
          stars(outcome.stars),
          objectiveList(outcome),
          statGrid([
            ["Vidas restantes", `${result.livesRemaining}/${result.maxLives}`],
            ["Inimigos derrotados", String(result.stats.enemiesKilled)],
            ["Pérolas geradas", String(result.stats.pearlsEarned)],
            ["Pérolas gastas", String(result.stats.pearlsSpent)],
            ["Guardiões usados", String(result.stats.distinctGuardiansUsed.length)],
            ["Tempo", seconds(result.stats.timeMs)],
          ]),
          rewardBox(outcome),
          outcome.counted ? null : h("p", { class: "gr-hint", text: "Partida com ferramentas de debug: nada foi salvo na progressão." }),
          h(
            "div",
            { class: "gr-actions" },
            button("JOGAR DE NOVO", actions.onRetry, { testId: "result-retry" }),
            button("MAPA", actions.onMap, { testId: "result-map" }),
            outcome.nextLevelId ? button("PRÓXIMA FASE", actions.onNextLevel, { testId: "result-next", variant: "primary" }) : null,
          ),
        ),
      );
    },
  };
}

/** Dica curta escolhida a partir do que deu errado na partida. */
export function defeatHint(result: MatchResult): string {
  const stats = result.stats;
  if (stats.guardiansPlaced <= 2) return "Poucos Guardiões em campo. Gaste as pérolas: elas não valem nada no fim.";
  if (stats.upgradesBought === 0) return "Nenhuma evolução comprada. Um Guardião evoluído costuma render mais que dois novos.";
  if (stats.pearlsEarned - stats.pearlsSpent > 150) return "Sobraram muitas pérolas. Tente gastar durante as ondas, não depois.";
  if (stats.bossLeaks > 0) return "O chefe passou. Concentre dano e controle na reta final da rota.";
  if (stats.eliteLeaks > 0) return "Os elites passaram. Eles resistem a controle: prepare dano puro para eles.";
  if (stats.distinctGuardiansUsed.length <= 1) return "Uma espécie só cobre pouco. Misture dano, controle e contenção.";
  return "Reposicione a defesa perto dos trechos lentos da correnteza e tente de novo.";
}

/** Tela de derrota (item 35): nunca um "game over" seco. */
export function defeatScreen(result: MatchResult, outcome: MatchOutcome, levelName: string, actions: ResultActions): Screen {
  return {
    id: "defeat",
    render() {
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel" },
          h("h1", { class: "gr-title gr-title--defeat", text: "O RECIFE FOI INVADIDO" }),
          h("p", { class: "gr-subtitle", text: levelName }),
          statGrid([
            ["Onda alcançada", `${result.stats.wavesCompleted + 1}/${result.stats.totalWaves}`],
            ["Inimigos derrotados", String(result.stats.enemiesKilled)],
            ["Inimigos que passaram", String(result.stats.enemiesLeaked)],
            ["Tempo", seconds(result.stats.timeMs)],
          ]),
          h("div", { class: "gr-reward", testId: "defeat-hint" }, h("span", { text: defeatHint(result) })),
          outcome.objectives.length > 0 ? objectiveList(outcome) : null,
          h(
            "div",
            { class: "gr-actions" },
            button("VOLTAR AO MAPA", actions.onMap, { testId: "result-map" }),
            button("ALTERAR GUARDIÕES", actions.onChangeSquad, { testId: "result-change-squad" }),
            button("TENTAR NOVAMENTE", actions.onRetry, { testId: "result-retry", variant: "primary" }),
          ),
        ),
      );
    },
  };
}

/** Apresentação de um Guardião recém-encontrado (item 3). */
export function unlockRevealScreen(guardianId: GuardianId, onContinue: () => void): Screen {
  const definition = GUARDIANS[guardianId];
  const unlock = GUARDIAN_UNLOCKS.find((candidate) => candidate.guardianId === guardianId);
  const portrait = artTextureKeyForFolder(guardianId, artVariant(guardianId, { branchId: null, upgradeLevel: 0 }).folder, "portrait");
  return {
    id: "unlock",
    render(host: ScreenHost) {
      void host;
      const art = GUARDIAN_ART[guardianId];
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel", testId: "unlock-panel", dataGuardian: guardianId },
          h("span", { class: "gr-badge", text: "novo guardião do recife" }),
          h(
            "div",
            { class: "gr-reveal" },
            h("img", { class: "gr-reveal__art", src: `assets/guardians/${art.assetFolder ?? guardianId}/base/portrait.png`, alt: definition.name, dataKey: portrait }),
            h(
              "div",
              { class: "gr-reveal__body" },
              h("h1", { class: "gr-title", text: unlock?.reveal.title ?? definition.name }),
              h("p", { class: "gr-subtitle", text: unlock?.reveal.role ?? definition.role }),
              h("p", { text: unlock?.reveal.mechanic ?? definition.description }),
              h("p", { class: "gr-hint", text: `Custo em pérolas: ${definition.cost} · ${definition.branches[0].name} ou ${definition.branches[1].name}` }),
            ),
          ),
          h("div", { class: "gr-actions" }, button("ENTRA PARA A COLEÇÃO", onContinue, { testId: "unlock-continue", variant: "primary" })),
        ),
      );
    },
  };
}
