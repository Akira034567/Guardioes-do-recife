import { artPath, GUARDIAN_ART } from "../../../assets/guardianArt";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import type { UnlockStatus } from "../../../core/progression/unlocks";
import { GUARDIAN_LORE } from "../../../data/guardianLore";
import { GUARDIANS, GUARDIAN_ORDER } from "../../../data/guardians";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import { GUARDIAN_UNLOCKS } from "../../../data/unlocks";
import type { BranchId, GuardianDefinition, GuardianId, UpgradeBranch } from "../../../types";
import { button, h } from "../h";
import type { Screen, ScreenHost } from "../ScreenHost";

/** Caminho da imagem de uma variante do Guardião (`base`, `perfuracao-1`, …). */
function variantArt(guardianId: GuardianId, folder: string, kind: "idle" | "portrait"): string {
  return artPath(guardianId, { folder, ability: "projectile" }, kind);
}

/** O álbum usa a arte `idle`: é a criatura limpa, sem a moldura da tabela de upgrades. */
function basePortrait(guardianId: GuardianId): string {
  return variantArt(guardianId, GUARDIAN_ART[guardianId].base.folder, "idle");
}

/**
 * Álbum do Recife (item 4): uma carta por Guardião. Bloqueado vira silhueta com "???" e a pista de
 * onde encontrá-lo; encontrado abre a ficha com história, números e as duas árvores de evolução.
 */
export function collectionScreen(progression: ProgressionService, onBack: () => void): Screen {
  return {
    id: "collection",
    render(host: ScreenHost) {
      const statuses = new Map(progression.unlockStatuses().map((status) => [status.guardianId, status]));
      const found = GUARDIAN_ORDER.filter((id) => progression.isUnlocked(id)).length;
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel", testId: "collection-panel", dataFound: String(found) },
          h("span", { class: "gr-badge", text: `${found} de ${GUARDIAN_ORDER.length} encontrados` }),
          h("h1", { class: "gr-title", text: "ÁLBUM DO RECIFE" }),
          h("p", { class: "gr-subtitle", text: "Todo Guardião entra aqui no dia em que é encontrado." }),
          h("div", { class: "gr-album" }, ...GUARDIAN_ORDER.map((id) => card(GUARDIANS[id], statuses.get(id), progression, host))),
          h("div", { class: "gr-actions" }, button("VOLTAR", onBack, { testId: "collection-back" })),
        ),
      );
    },
  };
}

function card(definition: GuardianDefinition, status: UnlockStatus | undefined, progression: ProgressionService, host: ScreenHost): HTMLElement {
  const unlocked = progression.isUnlocked(definition.id);
  if (!unlocked) {
    const hidden = status?.hidden ?? false;
    const progress = status?.progress ?? null;
    return h(
      "div",
      { class: "gr-card gr-card--locked", testId: `collection-card-${definition.id}`, dataState: "locked" },
      h("img", { class: "gr-card__art gr-card__art--silhouette", src: basePortrait(definition.id), alt: "" }),
      h("span", { class: "gr-card__name", text: hidden ? "???" : definition.name }),
      h("span", { class: "gr-hint", text: hidden ? "Nenhum sinal dele até agora." : (status?.hint ?? "") }),
      progress && !hidden ? progressBar(progress.label, progress.current, progress.target) : null,
      status?.price != null
        ? button(`${GLOBAL_CURRENCY.symbol} ${status.price}`, () => {
            if (progression.buy(definition.id).ok) host.replace(collectionScreen(progression, () => host.pop()));
          }, { testId: `collection-buy-${definition.id}`, disabled: status.state !== "available" })
        : null,
    );
  }
  return h(
    "button",
    {
      class: "gr-card gr-card--found",
      testId: `collection-card-${definition.id}`,
      dataState: "unlocked",
      type: "button",
      onClick: () => host.push(guardianSheet(definition, progression, () => host.pop())),
    },
    h("img", { class: "gr-card__art", src: basePortrait(definition.id), alt: definition.name }),
    h("span", { class: "gr-card__name", text: definition.shortName }),
    h("span", { class: "gr-hint", text: definition.role }),
  );
}

function progressBar(label: string, current: number, target: number): HTMLElement {
  const ratio = Math.max(0, Math.min(1, current / Math.max(1, target)));
  return h(
    "div",
    { class: "gr-progress" },
    h("div", { class: "gr-progress__track" }, h("div", { class: "gr-progress__fill", style: `width:${Math.round(ratio * 100)}%` })),
    h("span", { class: "gr-progress__label", text: `${label} · ${Math.min(current, target)}/${target}` }),
  );
}

/** Ficha do Guardião: identidade, história, números de combate, carreira e as duas árvores. */
export function guardianSheet(definition: GuardianDefinition, progression: ProgressionService, onBack: () => void): Screen {
  const lore = GUARDIAN_LORE[definition.id];
  const unlock = GUARDIAN_UNLOCKS.find((candidate) => candidate.guardianId === definition.id);
  const career = progression.progress.guardianStats[definition.id];
  return {
    id: "guardian-sheet",
    render() {
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel", testId: "guardian-sheet", dataGuardian: definition.id },
          h(
            "div",
            { class: "gr-reveal" },
            h("img", { class: "gr-reveal__art", src: basePortrait(definition.id), alt: definition.name }),
            h(
              "div",
              { class: "gr-reveal__body" },
              h("h1", { class: "gr-title", text: definition.name }),
              h("p", { class: "gr-subtitle", text: `${definition.role} · ${"●".repeat(lore.difficulty)}${"○".repeat(3 - lore.difficulty)} de manejo` }),
              h("p", { text: unlock?.reveal.mechanic ?? definition.description }),
              h("p", { class: "gr-hint", text: lore.history }),
            ),
          ),
          h(
            "div",
            { class: "gr-grid" },
            stat("Custo", `◉ ${definition.cost}`),
            stat("Dano", String(definition.damage)),
            stat("Alcance", String(Math.round(definition.range))),
            stat("Recarga", `${(definition.cooldownMs / 1000).toFixed(1)}s`),
            stat("Posição", placementLabel(definition)),
          ),
          h("p", { class: "gr-hint", text: `Dica: ${lore.tip}` }),
          h("p", { class: "gr-subtitle", text: "EVOLUÇÕES" }),
          h("div", { class: "gr-branches", testId: "guardian-tree" }, ...definition.branches.map((branch, index) => branchColumn(definition, branch, index === 0 ? "a" : "b"))),
          h("p", { class: "gr-subtitle", text: "CARREIRA" }),
          h(
            "div",
            { class: "gr-grid", testId: "guardian-career" },
            stat("Partidas", String(career?.matches ?? 0)),
            stat("Abates", String(career?.kills ?? 0)),
            stat("Dano total", String(career?.damage ?? 0)),
            stat("Vezes em campo", String(career?.placements ?? 0)),
          ),
          h("div", { class: "gr-actions" }, button("VOLTAR", onBack, { testId: "sheet-back" })),
        ),
      );
    },
  };
}

function stat(label: string, value: string): HTMLElement {
  return h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: label }), h("span", { class: "gr-stat__value", text: value }));
}

function placementLabel(definition: GuardianDefinition): string {
  const labels: Record<GuardianDefinition["placementMode"], string> = {
    platform: "Plataforma",
    water: "Água aberta",
    route: "Sobre a correnteza",
    margin: "Beira da correnteza",
  };
  return labels[definition.placementMode];
}

/** Um ramo da árvore: base → passo I → passo II, com a forma que o Guardião assume em cada passo. */
function branchColumn(definition: GuardianDefinition, branch: UpgradeBranch, branchId: BranchId): HTMLElement {
  const folders = GUARDIAN_ART[definition.id].branches[branchId];
  return h(
    "div",
    { class: "gr-branch", testId: `guardian-branch-${branchId}` },
    h("span", { class: "gr-stat__label", text: `RAMO ${branch.name}` }),
    h("span", { class: "gr-hint", text: branch.tagline }),
    ...branch.upgrades.map((upgrade, step) =>
      h(
        "div",
        { class: "gr-branch__step" },
        h("img", { class: "gr-branch__art", src: variantArt(definition.id, folders[step].folder, "idle"), alt: upgrade.name }),
        h(
          "div",
          {},
          h("strong", { text: `${step === 0 ? "I" : "II"} · ${upgrade.name}` }),
          h("span", { class: "gr-hint", text: ` ◉ ${upgrade.cost}` }),
          h("p", { class: "gr-hint", text: upgrade.description }),
        ),
      ),
    ),
  );
}
