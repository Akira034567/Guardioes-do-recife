import { artPath, GUARDIAN_ART } from "../../../../assets/guardianArt";
import type { ProgressionService } from "../../../../core/progression/ProgressionService";
import { masteryPowerPercent } from "../../../../core/progression/mastery";
import { GOLDEN_FISH } from "../../../../data/goldenFish";
import { GUARDIANS } from "../../../../data/guardians";
import { MASTERY, MASTERY_MAX_LEVEL, MASTERY_ORDER, masteryNextCost } from "../../../../data/mastery";
import { GLOBAL_CURRENCY } from "../../../../data/progression";
import type { BranchId, GuardianId } from "../../../../types";
import { button, h } from "../../h";
import { ICONS } from "../../icons";
import type { AlbumEntry, SheetContext } from "./entry";

/**
 * MAESTRIA DO RECIFE, agora como uma aba do Álbum.
 *
 * Era uma lista de nomes com uma pilha de caixas de texto ao lado. Aqui ela é o que sempre quis ser:
 * a FOTO de cada Guardião na grade e, ao clicar, a árvore dele desenhada como árvore — um tronco de
 * quatro nós que sobe até o nó 5 e ali se abre nos dois ramos, com a arte da evolução final de cada
 * lado. O jogador vê de relance onde está e onde aquilo termina.
 *
 * A tela continua explícita sobre as duas coisas que o jogador mais confunde:
 *
 * 1. O nó 5 só entra em vigor quando AQUELA unidade chega ao nível 2 de um ramo, dentro da partida.
 * 2. A coroa do Peixinho Dourado é outra coisa, com outra fonte e outro alcance.
 */

/** A arte limpa do Guardião (sem a moldura da tabela de upgrades). */
function portrait(guardianId: GuardianId): string {
  return artPath(guardianId, GUARDIAN_ART[guardianId].base, "idle");
}

/** A arte da evolução FINAL de um ramo: o nível 2, que é onde o nó 5 passa a valer. */
function finalArt(guardianId: GuardianId, branchId: BranchId): string {
  const variants = GUARDIAN_ART[guardianId].branches[branchId];
  return artPath(guardianId, variants[1], "idle");
}

export function masteryEntries(progression: ProgressionService, context: SheetContext): AlbumEntry[] {
  return MASTERY_ORDER.map((guardianId) => {
    const definition = GUARDIANS[guardianId];
    const owned = progression.isUnlocked(guardianId);
    const level = progression.masteryLevel(guardianId);
    return {
      id: guardianId,
      name: definition.shortName,
      subtitle: owned ? `${masteryPowerPercent(guardianId, level)}% de poder acumulado` : definition.role,
      found: owned,
      hidden: false,
      art: portrait(guardianId),
      icon: ICONS.star,
      hint: "Encontre este Guardião para treiná-lo.",
      progress: owned ? { label: "nós", current: level, target: MASTERY_MAX_LEVEL } : null,
      state: owned ? (level >= MASTERY_MAX_LEVEL ? "maxed" : "unlocked") : "locked",
      chip: owned && level >= MASTERY_MAX_LEVEL ? { label: "Maestria completa", icon: ICONS.star, tone: "done" } : null,
      sheet: () => masterySheet(guardianId, progression, context),
    };
  });
}

function masterySheet(guardianId: GuardianId, progression: ProgressionService, context: SheetContext): HTMLElement {
  const definition = GUARDIANS[guardianId];
  const tree = MASTERY[guardianId];
  const level = progression.masteryLevel(guardianId);
  const owned = progression.isUnlocked(guardianId);
  const shells = progression.progress.currency.shells;
  const next = masteryNextCost(level);
  const canBuy = owned && next !== null && shells >= next;

  return h(
    "section",
    {
      class: "gr-album__sheet gr-album__sheet--mastery",
      testId: "mastery-detail",
      dataGuardian: guardianId,
      dataLevel: String(level),
      dataState: owned ? "unlocked" : "locked",
    },
    h("div", { class: "gr-album__banner" }, h("img", { class: `gr-album__banner-art${owned ? "" : " gr-node__art--unknown"}`, src: portrait(guardianId), alt: "" })),
    h(
      "div",
      { class: "gr-album__sheet-head" },
      h("span", { class: "gr-badge", text: `${level}/${MASTERY_MAX_LEVEL} nós` }),
      h("h2", { class: "gr-album__sheet-name", text: definition.name }),
      h("p", { class: "gr-subtitle", text: `${masteryPowerPercent(guardianId, level)}% de poder efetivo acumulado · ${definition.role}` }),
      h("span", { class: "gr-progress__track" }, h("span", { class: "gr-progress__fill", style: `width:${Math.round((level / MASTERY_MAX_LEVEL) * 100)}%` })),
    ),
    tree3(guardianId, tree, level),
    h(
      "div",
      { class: "gr-album__actions" },
      button(
        !owned ? "Guardião ainda bloqueado" : next === null ? "Maestria completa" : `Comprar nó ${level + 1} · ${GLOBAL_CURRENCY.symbol} ${next.toLocaleString("pt-BR")}`,
        () => {
          if (progression.buyMastery(guardianId).ok) context.onChanged();
        },
        { testId: "mastery-buy", variant: "primary", disabled: !canBuy },
      ),
      h("span", { class: "gr-album__meta", text: `${GLOBAL_CURRENCY.symbol} ${shells.toLocaleString("pt-BR")} em caixa` }),
    ),
    // O bloco que separa as duas fontes de poder. Sem ele, "dourado" e "maestria" viram a mesma
    // coisa na cabeça do jogador — e não são.
    h(
      "div",
      { class: "gr-mastery__golden", testId: "mastery-golden" },
      h("strong", { text: "Peixinho Dourado — outra coisa" }),
      h("span", { text: `${GOLDEN_FISH[guardianId].tagline} Vale só naquela partida, só naquela unidade, e é conquistado jogando — não comprado.` }),
    ),
  );
}

/** O tronco (nós 1 a 4), o nó 5 e a bifurcação nas duas evoluções finais. */
function tree3(guardianId: GuardianId, tree: (typeof MASTERY)[GuardianId], level: number): HTMLElement {
  const definition = GUARDIANS[guardianId];
  const capstoneBought = level >= MASTERY_MAX_LEVEL;
  return h(
    "div",
    { class: "gr-tree", testId: "mastery-tree" },
    h(
      "div",
      { class: "gr-tree__trunk" },
      ...tree.nodes.map((item) => {
        const bought = item.level <= level;
        const isNext = item.level === level + 1;
        return h(
          "div",
          {
            class: `gr-tree__node${bought ? " gr-tree__node--on" : ""}${isNext ? " gr-tree__node--next" : ""}`,
            testId: `mastery-node-${guardianId}-${item.level}`,
            dataState: bought ? "bought" : isNext ? "next" : "locked",
          },
          h("span", { class: "gr-tree__level", text: String(item.level) }),
          h(
            "div",
            { class: "gr-tree__body" },
            h("strong", { text: item.name }),
            h("span", { class: "gr-hint", text: item.description }),
          ),
          bought
            ? h("span", { class: "gr-tree__tag", text: "COMPRADO" })
            : h("span", { class: "gr-tree__cost" }, h("span", { class: "gr-icon", html: ICONS.shell }), h("span", { text: item.cost.toLocaleString("pt-BR") })),
        );
      }),
    ),
    h(
      "div",
      {
        class: `gr-tree__node gr-tree__node--capstone${capstoneBought ? " gr-tree__node--on" : ""}`,
        testId: `mastery-node-${guardianId}-5`,
        dataState: capstoneBought ? "bought" : level === MASTERY_MAX_LEVEL - 1 ? "next" : "locked",
      },
      h("span", { class: "gr-tree__level", text: "5" }),
      h(
        "div",
        { class: "gr-tree__body" },
        h("strong", { text: tree.capstone.name }),
        h("span", { class: "gr-hint", text: tree.capstone.description }),
        // A condição é a parte que o jogador mais erra: ela fica em destaque, não na letra miúda.
        h("span", { class: "gr-tree__note", text: "Só entra em vigor na unidade que chegar ao nível 2 de um ramo." }),
      ),
      capstoneBought
        ? h("span", { class: "gr-tree__tag", text: "COMPRADO" })
        : h("span", { class: "gr-tree__cost" }, h("span", { class: "gr-icon", html: ICONS.shell }), h("span", { text: tree.capstone.cost.toLocaleString("pt-BR") })),
    ),
    h("div", { class: "gr-tree__fork", "aria-hidden": "true" }),
    h(
      "div",
      { class: "gr-tree__branches" },
      ...(["a", "b"] as const).map((branchId, index) => {
        const branch = definition.branches[index];
        return h(
          "div",
          { class: `gr-tree__branch gr-tree__branch--${branchId}`, testId: `mastery-branch-${guardianId}-${branchId}` },
          h("img", { class: "gr-tree__branch-art", src: finalArt(guardianId, branchId), alt: "" }),
          h(
            "div",
            { class: "gr-tree__branch-copy" },
            h("span", { class: "gr-stat__label", text: `RAMO ${branch?.name ?? branchId.toUpperCase()}` }),
            h("strong", { text: branch?.upgrades[1]?.name ?? "Evolução final" }),
            h("span", { class: "gr-hint", text: tree.capstone.branches[branchId] }),
          ),
        );
      }),
    ),
  );
}
