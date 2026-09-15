import type { ProgressionService } from "../../../core/progression/ProgressionService";
import { masteryPowerPercent } from "../../../core/progression/mastery";
import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import { GUARDIANS } from "../../../data/guardians";
import { LEVELS } from "../../../data/levels";
import { MASTERY, MASTERY_MAX_LEVEL, MASTERY_ORDER, masteryNextCost } from "../../../data/mastery";
import { GOLDEN_FISH } from "../../../data/goldenFish";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import type { GuardianId } from "../../../types";
import { button, fill, h } from "../h";
import { preserveScroll } from "../scroll";
import type { Screen } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

/**
 * MAESTRIA DO RECIFE.
 *
 * Progressão permanente de fora da partida: cinco nós por Guardião, comprados com Conchas. A lista de
 * Guardiões fica à esquerda e a árvore do escolhido à direita.
 *
 * A tela é explícita sobre as duas coisas que o jogador precisa entender para decidir:
 *
 * 1. O nó 5 só entra em vigor quando AQUELA unidade chega ao nível 2 de um ramo, dentro da partida.
 * 2. A coroa do Peixinho Dourado é outra coisa, com outra fonte e outro alcance. O bloco no rodapé
 *    existe para os dois nunca se confundirem.
 */
export function masteryScreen(progression: ProgressionService, onBack: () => void, nav?: ShellNav, embedded = false): Screen {
  let chosen: GuardianId = MASTERY_ORDER[0];

  return {
    id: "mastery",
    render() {
      const root = h("div", { class: `gr-album gr-album--mastery${embedded ? " gr-album--embedded" : ""}`, testId: "mastery-panel" });
      const art = levelBackgroundPath(LEVELS[2].backgroundKey);
      if (art && !embedded) root.append(h("div", { class: "gr-world__backdrop", style: `background-image:url(${art})` }));
      const layout = h("div", { class: "gr-album__layout" });
      if (!embedded && nav) root.append(shellSidebar("mastery", nav, { navId: (section) => `mastery-${section}`, back: onBack, backId: "mastery-back" }));
      root.append(layout);

      const redraw = (): void => {
        const shells = progression.progress.currency.shells;
        const unlocked = progression.progress.unlockedGuardians;
        root.dataset.shells = String(shells);

        const list = h("div", { class: "gr-album__list", testId: "mastery-list" });
        for (const guardianId of MASTERY_ORDER) {
          const level = progression.masteryLevel(guardianId);
          const owned = unlocked.includes(guardianId);
          const item = h(
            "button",
            {
              class: `gr-album__item${guardianId === chosen ? " gr-album__item--on" : ""}${owned ? "" : " gr-album__item--locked"}`,
              testId: `mastery-item-${guardianId}`,
              type: "button",
              onClick: () => {
                chosen = guardianId;
                redraw();
              },
            },
            h("span", { class: "gr-album__item-name", text: GUARDIANS[guardianId].shortName }),
            h("span", { class: "gr-album__item-meta", text: owned ? `${level}/${MASTERY_MAX_LEVEL}` : "bloqueado" }),
          );
          list.append(item);
        }

        const tree = MASTERY[chosen];
        const level = progression.masteryLevel(chosen);
        const owned = unlocked.includes(chosen);
        const next = masteryNextCost(level);
        const detail = h("div", { class: "gr-album__detail", testId: "mastery-detail" });

        detail.append(
          h("h2", { class: "gr-album__title", text: `${GUARDIANS[chosen].name} · Maestria` }),
          h("p", { class: "gr-album__lead", text: `${masteryPowerPercent(chosen, level)}% de poder efetivo acumulado · ${level}/${MASTERY_MAX_LEVEL} nós` }),
        );

        for (const item of tree.nodes) {
          const bought = item.level <= level;
          const isNext = item.level === level + 1;
          detail.append(
            h(
              "div",
              { class: `gr-mastery__node${bought ? " gr-mastery__node--on" : ""}`, testId: `mastery-node-${chosen}-${item.level}` },
              h("span", { class: "gr-mastery__node-level", text: String(item.level) }),
              h(
                "div",
                { class: "gr-mastery__node-body" },
                h("strong", { text: item.name }),
                h("span", { text: item.description }),
              ),
              bought
                ? h("span", { class: "gr-mastery__node-tag", text: "COMPRADO" })
                : h("span", { class: "gr-mastery__node-cost", text: `${GLOBAL_CURRENCY.symbol} ${item.cost.toLocaleString("pt-BR")}` }),
            ),
          );
          void isNext;
        }

        const capstoneBought = level >= MASTERY_MAX_LEVEL;
        detail.append(
          h(
            "div",
            { class: `gr-mastery__node gr-mastery__node--capstone${capstoneBought ? " gr-mastery__node--on" : ""}`, testId: `mastery-node-${chosen}-5` },
            h("span", { class: "gr-mastery__node-level", text: "5" }),
            h(
              "div",
              { class: "gr-mastery__node-body" },
              h("strong", { text: tree.capstone.name }),
              h("span", { text: tree.capstone.description }),
              // A condição é a parte que o jogador mais erra: ela fica em destaque, não na letra miúda.
              h("span", { class: "gr-mastery__node-note", text: "Só entra em vigor na unidade que chegar ao nível 2 de um ramo." }),
              h("span", { text: `Ramo A — ${tree.capstone.branches.a}` }),
              h("span", { text: `Ramo B — ${tree.capstone.branches.b}` }),
            ),
            capstoneBought
              ? h("span", { class: "gr-mastery__node-tag", text: "COMPRADO" })
              : h("span", { class: "gr-mastery__node-cost", text: `${GLOBAL_CURRENCY.symbol} ${tree.capstone.cost.toLocaleString("pt-BR")}` }),
          ),
        );

        const canBuy = owned && next !== null && shells >= next;
        const label = !owned
          ? "Guardião ainda bloqueado"
          : next === null
            ? "Maestria completa"
            : `Comprar nó ${level + 1} · ${GLOBAL_CURRENCY.symbol} ${next.toLocaleString("pt-BR")}`;
        detail.append(
          h(
            "div",
            { class: "gr-album__actions" },
            button(label, () => {
              const result = progression.buyMastery(chosen);
              if (result.ok) redraw();
            }, { testId: "mastery-buy", variant: "primary", disabled: !canBuy }),
            h("span", { class: "gr-album__meta", text: `${GLOBAL_CURRENCY.symbol} ${shells.toLocaleString("pt-BR")} em caixa` }),
          ),
        );

        // O bloco que separa as duas fontes de poder. Sem ele, "dourado" e "maestria" viram a mesma
        // coisa na cabeça do jogador — e não são.
        detail.append(
          h(
            "div",
            { class: "gr-mastery__golden", testId: "mastery-golden" },
            h("strong", { text: "Peixinho Dourado — outra coisa" }),
            h("span", { text: `${GOLDEN_FISH[chosen].tagline} Vale só naquela partida, só naquela unidade, e é conquistado jogando — não comprado.` }),
          ),
        );

        fill(layout, list, detail);
      };

      preserveScroll(layout, redraw);
      redraw();
      return root;
    },
  };
}
