import { artPath, GUARDIAN_ART } from "../../../assets/guardianArt";
import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import type { UnlockStatus } from "../../../core/progression/unlocks";
import { ENCOUNTERS, ENCOUNTER_LEVELS, encounterForLevel, type EncounterDefinition } from "../../../data/encounters";
import { GUARDIAN_LORE } from "../../../data/guardianLore";
import { GUARDIANS, GUARDIAN_ORDER } from "../../../data/guardians";
import { LEVELS } from "../../../data/levels";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import { GUARDIAN_UNLOCKS } from "../../../data/unlocks";
import type { BranchId, GuardianDefinition, GuardianId, InteractableDefinition, LevelDefinition, UpgradeBranch } from "../../../types";
import { fill, button, h } from "../h";
import { preserveScroll } from "../scroll";
import { ICONS } from "../icons";
import type { Screen } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

/** Caminho da imagem de uma variante do Guardião (`base`, `perfuracao-1`, …). */
function variantArt(guardianId: GuardianId, folder: string, kind: "idle" | "attack" | "projectile" | "portrait"): string {
  return artPath(guardianId, { folder, ability: "projectile" }, kind);
}

/** O álbum usa a arte `idle`: é a criatura limpa, sem a moldura da tabela de upgrades. */
function basePortrait(guardianId: GuardianId): string {
  return variantArt(guardianId, GUARDIAN_ART[guardianId].base.folder, "idle");
}

export type AlbumTab = "guardians" | "encounters" | "places" | "treasures";

const TABS: ReadonlyArray<{ id: AlbumTab; label: string; icon: string }> = [
  { id: "guardians", label: "Guardiões", icon: ICONS.fish },
  { id: "encounters", label: "Encontros", icon: ICONS.shell },
  { id: "places", label: "Locais", icon: ICONS.coral },
  { id: "treasures", label: "Tesouros", icon: ICONS.chest },
];

/**
 * Uma carta do álbum, seja ela um Guardião, um Encontro, um lugar ou um achado. Tudo o que a tela
 * precisa saber para desenhar a carta à esquerda e a ficha à direita mora aqui, então uma aba nova é
 * só uma função que devolve uma lista destas.
 */
interface AlbumEntry {
  id: string;
  name: string;
  subtitle: string;
  found: boolean;
  /** Sem nenhuma pista, a carta vira "???" e a arte fica em silhueta. */
  hidden: boolean;
  art: string | null;
  /** Pictograma usado quando a entrada não tem arte própria. */
  icon: string;
  /** O que falta para encontrar, quando ainda não foi. */
  hint: string;
  progress: { label: string; current: number; target: number } | null;
  /** Corpo da ficha da direita. */
  sheet(): HTMLElement;
  /** Faixa grande no topo da ficha; ausente = a própria arte da carta. */
  banner?: string | null;
}

/**
 * Álbum do Recife (item 4): tudo o que o jogador já encontrou. Quatro abas — Guardiões, Encontros,
 * Locais e Tesouros —, a lista à esquerda e a ficha completa à direita, sem trocar de tela.
 */
/** Onde o álbum abre. O hub usa `focus` para cair direto no Guardião que o jogador clicou no Recife. */
export interface CollectionOptions {
  tab?: AlbumTab;
  focus?: string;
}

export function collectionScreen(
  progression: ProgressionService,
  onBack: () => void,
  nav?: ShellNav,
/** `embedded`: o AppShell já desenha a coluna e o fundo, então a tela entrega só o conteúdo (item 2). */
  options: CollectionOptions = {},
  embedded = false,
): Screen {
  let tab: AlbumTab = options.tab ?? "guardians";
  let chosen: string | null = options.focus ?? null;
  /** Qual quadro a ficha do Guardião está mostrando em "ver em ação". */
  let actionFrame = 0;
  let sheetTab: SheetTab = "info";

  return {
    id: "collection",
    render() {
      const root = h("div", { class: `${"gr-album"}${embedded ? " gr-album--embedded" : ""}`, testId: "collection-panel" });
      const art = levelBackgroundPath(LEVELS[0].backgroundKey);
      if (art && !embedded) root.append(h("div", { class: "gr-world__backdrop", style: `background-image:url(${art})` }));
      const layout = h("div", { class: "gr-album__layout" });
      root.append(layout);

      const redraw = (): void => {
        const entries = entriesFor(tab, progression, {
          frame: actionFrame,
          sheetTab,
          onFrame: (next) => {
            actionFrame = next;
            draw();
          },
          onSheetTab: (next) => {
            sheetTab = next;
            draw();
          },
          onChanged: () => draw(),
        });
        const current = entries.find((entry) => entry.id === chosen) ?? entries.find((entry) => entry.found) ?? entries[0];
        const found = entries.filter((entry) => entry.found).length;

        fill(layout, 
          embedded ? null : shellSidebar("collection", nav ?? fallbackNav(onBack), {
            navId: (section) => `album-nav-${section}`,
            back: onBack,
            backId: "collection-back",
            motto: "Conheça as vidas que protegem o Recife.",
          }),
          h(
            "div",
            { class: "gr-album__main" },
            header(tab, found, entries.length),
            tabs(tab, (next) => {
              tab = next;
              chosen = null;
              sheetTab = "info";
              actionFrame = 0;
              draw();
            }),
            h(
              "div",
              { class: "gr-album__body" },
              h(
                "div",
                { class: "gr-album__grid", testId: "album-grid" },
                ...entries.map((entry) =>
                  card(entry, current?.id === entry.id, () => {
                    chosen = entry.id;
                    sheetTab = "info";
                    actionFrame = 0;
                    draw();
                  }),
                ),
              ),
              current ? current.sheet() : h("div", { class: "gr-album__sheet" }),
            ),
            h("p", { class: "gr-album__foot", text: "No Recife, cada Guardião deixa sua marca." }),
          ),
        );
      };

      // Clicar num card reconstrói o miolo. A rolagem da grade e o foco do botão são
      // repostos em volta disso, senão a tela salta para o topo a cada escolha (item 6).
      const draw = (): void => preserveScroll(root, redraw);

      redraw();
      return root;
    },
  };
}

/** Quando a tela é aberta sem a navegação da moldura, todo item do menu só volta para o mapa. */
function fallbackNav(onBack: () => void): ShellNav {
  return {
    onGoHub: onBack,
    onGoMap: onBack,
    onOpenCollection: () => {},
    onOpenMastery: onBack,
    onOpenBestiary: onBack,
    onOpenStories: onBack,
    onOpenAchievements: onBack,
    onOpenAccount: onBack,
    onOpenSettings: onBack,
  };
}

function header(tab: AlbumTab, found: number, total: number): HTMLElement {
  const label = TABS.find((candidate) => candidate.id === tab)?.label ?? "Itens";
  const ratio = Math.round((found / Math.max(1, total)) * 100);
  return h(
    "header",
    { class: "gr-album__top" },
    h(
      "div",
      { class: "gr-album__titles" },
      h("h1", { class: "gr-album__title", text: "ÁLBUM DO RECIFE" }),
      h("p", { class: "gr-subtitle", text: "Todo Guardião tem uma história. Descubra, desbloqueie e faça parte desse oceano." }),
    ),
    h(
      "div",
      { class: "gr-album__score", testId: "album-progress", dataFound: String(found) },
      h("span", { class: "gr-icon gr-icon--lg", html: ICONS.squad }),
      h(
        "span",
        { class: "gr-album__score-copy" },
        h("span", { class: "gr-stat__label", text: `${label} encontrados` }),
        h("span", { class: "gr-album__score-value", text: `${found} de ${total}` }),
        h("span", { class: "gr-progress__track" }, h("span", { class: "gr-progress__fill", style: `width:${ratio}%` })),
      ),
    ),
    h("p", { class: "gr-album__quote", text: "“Mais que criaturas, são laços que mantêm o Recife vivo.”" }),
  );
}

function tabs(current: AlbumTab, onPick: (tab: AlbumTab) => void): HTMLElement {
  return h(
    "nav",
    { class: "gr-album__tabs", testId: "album-tabs", dataValue: current },
    ...TABS.map((tab) =>
      h(
        "button",
        {
          class: `gr-album__tab${tab.id === current ? " gr-album__tab--on" : ""}`,
          testId: `album-tab-${tab.id}`,
          type: "button",
          "aria-pressed": String(tab.id === current),
          onClick: () => onPick(tab.id),
        },
        h("span", { class: "gr-icon gr-icon--lg", html: tab.icon }),
        h("span", { text: tab.label.toUpperCase() }),
      ),
    ),
  );
}

function card(entry: AlbumEntry, chosen: boolean, onClick: () => void): HTMLElement {
  const state = entry.found ? "unlocked" : "locked";
  return h(
    "button",
    {
      class: `gr-album__card${chosen ? " gr-album__card--on" : ""}${entry.found ? "" : " gr-album__card--locked"}`,
      testId: `collection-card-${entry.id}`,
      dataState: state,
      type: "button",
      onClick,
    },
    h(
      "span",
      { class: "gr-album__card-art" },
      entry.art
        ? h("img", { class: `gr-album__art${entry.found ? "" : " gr-node__art--unknown"}`, src: entry.art, alt: "" })
        : h("span", { class: "gr-icon gr-album__art-icon", html: entry.icon }),
      entry.found ? null : h("span", { class: "gr-icon gr-icon--lg gr-album__card-lock", html: ICONS.lock }),
    ),
    h("span", { class: "gr-album__card-name", text: entry.hidden && !entry.found ? "???" : entry.name }),
    h("span", { class: "gr-hint", text: entry.found ? entry.subtitle : entry.hint }),
    entry.found
      ? h("span", { class: "gr-album__chip" }, h("span", { class: "gr-icon", html: ICONS.star }), h("span", { text: "Encontrado" }))
      : entry.progress
        ? progressBar(entry.progress.label, entry.progress.current, entry.progress.target)
        : null,
  );
}

function progressBar(label: string, current: number, target: number): HTMLElement {
  const ratio = Math.max(0, Math.min(1, current / Math.max(1, target)));
  return h(
    "span",
    { class: "gr-progress" },
    h("span", { class: "gr-progress__label", text: `${Math.min(current, target)}/${target} ${label}` }),
    h("span", { class: "gr-progress__track" }, h("span", { class: "gr-progress__fill", style: `width:${Math.round(ratio * 100)}%` })),
  );
}

// ------------------------------------------------------------------------------- conteúdo das abas

interface SheetContext {
  frame: number;
  sheetTab: SheetTab;
  onFrame(next: number): void;
  onSheetTab(next: SheetTab): void;
  /** Redesenha a tela no lugar. Trocar por `host.replace` perderia `nav`, aba e foco. */
  onChanged(): void;
}

function entriesFor(tab: AlbumTab, progression: ProgressionService, context: SheetContext): AlbumEntry[] {
  switch (tab) {
    case "guardians":
      return guardianEntries(progression, context);
    case "encounters":
      return encounterEntries(progression);
    case "places":
      return placeEntries(progression);
    case "treasures":
      return treasureEntries(progression);
  }
}

function guardianEntries(progression: ProgressionService, context: SheetContext): AlbumEntry[] {
  const statuses = new Map(progression.unlockStatuses().map((status) => [status.guardianId, status]));
  return GUARDIAN_ORDER.map((guardianId) => {
    const definition = GUARDIANS[guardianId];
    const status = statuses.get(guardianId);
    const found = progression.isUnlocked(guardianId);
    return {
      id: guardianId,
      name: definition.shortName,
      subtitle: definition.role,
      found,
      hidden: status?.hidden ?? false,
      art: basePortrait(guardianId),
      icon: ICONS.fish,
      hint: (status?.hidden ?? false) ? "Nenhum sinal dele até agora." : (status?.hint ?? ""),
      progress: status?.progress ?? null,
      sheet: () => guardianSheetPanel(definition, status, progression, context, found),
    };
  });
}

function encounterEntries(progression: ProgressionService): AlbumEntry[] {
  return ENCOUNTERS.map((encounter) => {
    const found = progression.progress.completedEncounters.includes(encounter.id);
    const guardian = GUARDIANS[encounter.guardianId];
    return {
      id: encounter.id,
      name: encounter.level.name,
      subtitle: found ? `Trouxe ${guardian.name}` : "Encontro por fazer",
      found,
      hidden: false,
      art: artPath(encounter.guardianId, GUARDIAN_ART[encounter.guardianId].base, "idle"),
      icon: ICONS.shell,
      hint: encounter.teaser,
      progress: { label: "Encontro", current: found ? 1 : 0, target: 1 },
      sheet: () => encounterPanel(encounter, found),
    };
  });
}

function placeEntries(progression: ProgressionService): AlbumEntry[] {
  const places: LevelDefinition[] = [...LEVELS, ...ENCOUNTER_LEVELS];
  return places.map((level) => {
    const encounter = encounterForLevel(level.id);
    const found = encounter
      ? progression.progress.completedEncounters.includes(encounter.id)
      : progression.progress.completedLevels.includes(level.id);
    return {
      id: level.id,
      name: level.name,
      subtitle: level.subtitle,
      found,
      hidden: false,
      art: levelBackgroundPath(level.backgroundKey),
      icon: ICONS.coral,
      hint: encounter ? "Um lugar fora da rota da campanha." : "Ainda não foi defendido.",
      progress: null,
      sheet: () => placePanel(level, found),
    };
  });
}

/** Tudo o que o mapa esconde: a pedra que pisca, a rede, o sino, a gruta. */
interface Treasure {
  level: LevelDefinition;
  interactable: InteractableDefinition;
}

function allTreasures(): Treasure[] {
  return [...LEVELS, ...ENCOUNTER_LEVELS].flatMap((level) => (level.interactables ?? []).map((interactable) => ({ level, interactable })));
}

function treasureEntries(progression: ProgressionService): AlbumEntry[] {
  return allTreasures().map(({ level, interactable }) => {
    const encounter = encounterForLevel(level.id);
    const found = interactable.secretId
      ? progression.progress.discoveredSecrets.includes(interactable.secretId)
      : encounter
        ? progression.progress.completedEncounters.includes(encounter.id)
        : progression.progress.completedLevels.includes(level.id);
    return {
      id: interactable.id,
      name: interactable.label,
      subtitle: level.name,
      found,
      hidden: !found && Boolean(interactable.secretId),
      art: levelBackgroundPath(level.backgroundKey),
      icon: ICONS.chest,
      hint: interactable.secretId ? "Escondido em algum canto do mapa." : `Aparece em ${level.name}.`,
      progress: null,
      sheet: () => treasurePanel(level, interactable, found),
    };
  });
}

// ------------------------------------------------------------------------------- ficha da direita

type SheetTab = "info" | "skills" | "tree" | "story";

const SHEET_TABS: ReadonlyArray<{ id: SheetTab; label: string }> = [
  { id: "info", label: "Informações" },
  { id: "skills", label: "Habilidades" },
  { id: "tree", label: "Evoluções" },
  { id: "story", label: "História" },
];

/** Os três quadros de "ver em ação": parado, atacando e a habilidade saindo. */
const ACTION_FRAMES: ReadonlyArray<{ kind: "idle" | "attack" | "projectile"; label: string }> = [
  { kind: "idle", label: "Em guarda" },
  { kind: "attack", label: "Atacando" },
  { kind: "projectile", label: "Habilidade" },
];

function guardianSheetPanel(
  definition: GuardianDefinition,
  status: UnlockStatus | undefined,
  progression: ProgressionService,
  context: SheetContext,
  found: boolean,
): HTMLElement {
  const lore = GUARDIAN_LORE[definition.id];
  const unlock = GUARDIAN_UNLOCKS.find((candidate) => candidate.guardianId === definition.id);
  const career = progression.progress.guardianStats[definition.id];
  const hidden = (status?.hidden ?? false) && !found;

  return h(
    "section",
    { class: "gr-album__sheet", testId: "guardian-sheet", dataGuardian: definition.id, dataState: found ? "unlocked" : "locked" },
    h(
      "div",
      { class: "gr-album__banner" },
      h("img", { class: `gr-album__banner-art${found ? "" : " gr-node__art--unknown"}`, src: basePortrait(definition.id), alt: "" }),
    ),
    h(
      "div",
      { class: "gr-album__sheet-head" },
      h("h2", { class: "gr-album__sheet-name", text: hidden ? "???" : definition.name }),
      h("p", { class: "gr-subtitle", text: hidden ? "Ainda não há sinais deste Guardião." : `${definition.role}. ${roleLine(definition)}` }),
      hidden
        ? null
        : h(
            "div",
            { class: "gr-album__chips" },
            ...traits(definition).map((trait) => h("span", { class: "gr-album__trait", text: trait })),
          ),
      h("p", { class: "gr-album__sheet-line", text: hidden ? (status?.hint ?? "") : (unlock?.reveal.mechanic ?? definition.description) }),
      found
        ? null
        : h(
            "div",
            { class: "gr-album__locked-note" },
            h("span", { class: "gr-icon", html: ICONS.lock }),
            h("span", { text: hidden ? "Siga jogando: o Recife ainda vai apresentá-lo." : (status?.hint ?? "") }),
            status?.price != null
              ? button(
                  `${GLOBAL_CURRENCY.symbol} ${status.price}`,
                  () => {
                    if (progression.buy(definition.id).ok) context.onChanged();
                  },
                  { testId: `collection-buy-${definition.id}`, disabled: status.state !== "available" },
                )
              : null,
          ),
    ),
    hidden
      ? null
      : h(
          "div",
          { class: "gr-album__sheet-tabs", testId: "sheet-tabs", dataValue: context.sheetTab },
          ...SHEET_TABS.map((tab) =>
            h("button", {
              class: `gr-album__sheet-tab${tab.id === context.sheetTab ? " gr-album__sheet-tab--on" : ""}`,
              testId: `sheet-tab-${tab.id}`,
              type: "button",
              text: tab.label.toUpperCase(),
              "aria-pressed": String(tab.id === context.sheetTab),
              onClick: () => context.onSheetTab(tab.id),
            }),
          ),
        ),
    hidden ? null : sheetBody(definition, lore, context),
    h(
      "div",
      { class: "gr-album__career", testId: "guardian-career" },
      h("span", { class: "gr-album__section-title", text: "Estatísticas gerais" }),
      h(
        "div",
        { class: "gr-album__career-row" },
        careerStat(ICONS.book, "Partidas", String(career?.matches ?? 0)),
        careerStat(ICONS.skull, "Inimigos derrotados", String(career?.kills ?? 0)),
        careerStat(ICONS.target, "Dano causado", formatNumber(career?.damage ?? 0)),
      ),
    ),
  );
}

function sheetBody(definition: GuardianDefinition, lore: (typeof GUARDIAN_LORE)[GuardianId], context: SheetContext): HTMLElement {
  if (context.sheetTab === "tree") {
    return h(
      "div",
      { class: "gr-album__branches", testId: "guardian-tree" },
      ...definition.branches.map((branch, index) => branchColumn(definition, branch, index === 0 ? "a" : "b")),
    );
  }
  if (context.sheetTab === "story") {
    return h(
      "div",
      { class: "gr-album__prose", testId: "sheet-story" },
      h("p", { text: lore.history }),
      h("p", { class: "gr-hint", text: `Dica: ${lore.tip}` }),
    );
  }
  if (context.sheetTab === "skills") {
    return h("ul", { class: "gr-album__skills", testId: "sheet-skills" }, ...abilities(definition).map((line) => h("li", { text: line })));
  }
  return h(
    "div",
    { class: "gr-album__info", testId: "sheet-info" },
    h(
      "div",
      { class: "gr-album__rows" },
      infoRow(ICONS.compass, "Dificuldade", rating(lore.difficulty)),
      infoRow(ICONS.target, "Alcance", `${rangeLabel(definition.range)} · ${Math.round(definition.range)}`),
      infoRow(ICONS.trident, "Tipo de ataque", ATTACK_LABELS[definition.attackKind]),
      infoRow(ICONS.timer, "Velocidade de ataque", `${speedLabel(definition.cooldownMs)} · ${(definition.cooldownMs / 1000).toFixed(1)}s`),
      infoRow(ICONS.coral, "Posição", PLACEMENT_LABELS[definition.placementMode]),
      infoRow(ICONS.pearl, "Custo", String(definition.cost)),
    ),
    actionPreview(definition, context),
  );
}

/** "Ver em ação": troca entre os quadros que a arte do Guardião já tem, sem vídeo nenhum. */
function actionPreview(definition: GuardianDefinition, context: SheetContext): HTMLElement {
  const frame = ACTION_FRAMES[context.frame % ACTION_FRAMES.length];
  const folder = GUARDIAN_ART[definition.id].base.folder;
  return h(
    "div",
    { class: "gr-album__action", testId: "sheet-action", dataFrame: frame.kind },
    h("img", { class: "gr-album__action-art", src: variantArt(definition.id, folder, frame.kind), alt: frame.label }),
    h(
      "button",
      {
        class: "gr-album__action-play",
        testId: "sheet-action-next",
        type: "button",
        onClick: () => context.onFrame(context.frame + 1),
      },
      h("span", { class: "gr-icon", html: ICONS.play }),
      h("span", { text: frame.label.toUpperCase() }),
    ),
  );
}

function infoRow(icon: string, label: string, value: string | HTMLElement): HTMLElement {
  return h(
    "div",
    { class: "gr-album__row" },
    h("span", { class: "gr-icon", html: icon }),
    h("span", { class: "gr-album__row-label", text: label }),
    typeof value === "string" ? h("span", { class: "gr-album__row-value", text: value }) : value,
  );
}

/** Dificuldade de manejo em peixinhos cheios e vazios (o `difficulty` do lore vai de 1 a 3). */
function rating(difficulty: number): HTMLElement {
  return h(
    "span",
    { class: "gr-album__rating", dataValue: String(difficulty) },
    ...Array.from({ length: 3 }, (_, index) =>
      h("span", { class: `gr-icon gr-album__rating-pip${index < difficulty ? " gr-album__rating-pip--on" : ""}`, html: ICONS.fish }),
    ),
  );
}

const ATTACK_LABELS: Record<GuardianDefinition["attackKind"], string> = {
  projectile: "Projétil",
  chain: "Descarga em cadeia",
  area: "Área",
  melee: "Corpo a corpo",
  ink: "Tinta",
  trap: "Armadilha",
  sonar: "Sonar",
};

const PLACEMENT_LABELS: Record<GuardianDefinition["placementMode"], string> = {
  platform: "Plataforma",
  water: "Água aberta",
  route: "Sobre a correnteza",
  margin: "Beira da correnteza",
};

const TARGETING_LABELS: Record<NonNullable<GuardianDefinition["targeting"]>, string> = {
  leading: "Foco em Alvos",
  lowestHealth: "Caça os Feridos",
  wounded: "Caça os Feridos",
  threat: "Lê a Ameaça",
};

function rangeLabel(range: number): string {
  if (range <= 110) return "Curto";
  return range <= 175 ? "Médio" : "Longo";
}

function speedLabel(cooldownMs: number): string {
  if (cooldownMs <= 800) return "Alta";
  return cooldownMs <= 1400 ? "Média" : "Baixa";
}

function roleLine(definition: GuardianDefinition): string {
  return `${rangeLabel(definition.range)} alcance, ataque ${speedLabel(definition.cooldownMs).toLowerCase()}.`;
}

/** As etiquetas curtas do topo da ficha, todas tiradas dos números do Guardião. */
function traits(definition: GuardianDefinition): string[] {
  const list = [definition.role, `Ataque ${speedLabel(definition.cooldownMs)}`];
  if (definition.targeting) list.push(TARGETING_LABELS[definition.targeting]);
  else if (definition.blocks) list.push("Segura a Fila");
  return list;
}

/** O que o Guardião faz em campo, linha a linha, lido da própria definição. */
function abilities(definition: GuardianDefinition): string[] {
  const lines = [
    `${ATTACK_LABELS[definition.attackKind]}: ${definition.damage} de dano a cada ${(definition.cooldownMs / 1000).toFixed(1)}s, até ${Math.round(definition.range)} de distância.`,
  ];
  if (definition.blocks) lines.push(`Segura até ${definition.blockCapacity ?? 1} invasor(es) parado(s) na correnteza.`);
  if (definition.contactDamagePerSecond) lines.push(`Fere ${definition.contactDamagePerSecond} por segundo quem encosta nele.`);
  if (definition.slowFactor) {
    const percent = Math.round((1 - definition.slowFactor) * 100);
    lines.push(`Deixa a água pesada: −${percent}% de velocidade por ${((definition.slowDurationMs ?? 0) / 1000).toFixed(1)}s.`);
  }
  if (definition.vulnerability) {
    const percent = Math.round((definition.vulnerability.multiplier - 1) * 100);
    lines.push(`Marca o alvo: +${percent}% de dano recebido por ${(definition.vulnerability.durationMs / 1000).toFixed(1)}s.`);
  }
  if (definition.trap) lines.push(`Fica enterrado e arma em ${(definition.trap.armMs / 1000).toFixed(1)}s; estoura em quem passar a ${definition.trap.triggerRadius}.`);
  if (definition.sonar) lines.push(`Pulso de sonar a cada ${(definition.sonar.cooldownMs / 1000).toFixed(1)}s: revela o que está escondido por ${(definition.sonar.revealMs / 1000).toFixed(1)}s.`);
  if (definition.dash) lines.push("Investe até o alvo e volta para a beira da correnteza.");
  if (definition.generatesPearls) lines.push(`Rende ${definition.generatesPearls.amount} pérola(s) a cada ${(definition.generatesPearls.intervalMs / 1000).toFixed(0)}s.`);
  lines.push(`Vai na ${PLACEMENT_LABELS[definition.placementMode].toLowerCase()}, por ${definition.cost} pérolas.`);
  return lines;
}

function careerStat(icon: string, label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "gr-album__career-stat" },
    h("span", { class: "gr-icon gr-icon--lg", html: icon }),
    h("span", { class: "gr-album__career-text" }, h("span", { class: "gr-stat__label", text: label }), h("span", { class: "gr-album__career-value", text: value })),
  );
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
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

// ---- fichas das outras abas

/** Faixa do topo da ficha: a arte do lugar quando existe, o pictograma da aba quando não. */
function banner(art: string | null, icon: string): HTMLElement {
  return art
    ? h("div", { class: "gr-album__banner gr-album__banner--wide", style: `background-image:url(${art})` })
    : h("div", { class: "gr-album__banner" }, h("span", { class: "gr-icon gr-album__banner-icon", html: icon }));
}

function encounterPanel(encounter: EncounterDefinition, found: boolean): HTMLElement {
  const guardian = GUARDIANS[encounter.guardianId];
  return h(
    "section",
    { class: "gr-album__sheet", testId: "album-sheet", dataEntry: encounter.id, dataState: found ? "unlocked" : "locked" },
    h(
      "div",
      { class: "gr-album__banner" },
      h("img", {
        class: `gr-album__banner-art${found ? "" : " gr-node__art--unknown"}`,
        src: artPath(encounter.guardianId, GUARDIAN_ART[encounter.guardianId].base, "idle"),
        alt: "",
      }),
    ),
    h(
      "div",
      { class: "gr-album__sheet-head" },
      h("h2", { class: "gr-album__sheet-name", text: encounter.level.name }),
      h("p", { class: "gr-subtitle", text: found ? `${guardian.name} entrou para o Recife aqui.` : "Encontro por fazer." }),
      h("p", { class: "gr-album__sheet-line", text: encounter.teaser }),
    ),
    h(
      "div",
      { class: "gr-album__rows" },
      infoRow(ICONS.waves, "Ondas", String(encounter.level.waves.length)),
      infoRow(ICONS.heart, "Vidas do Recife", String(encounter.level.reefHealth)),
      infoRow(ICONS.pearl, "Pérolas iniciais", String(encounter.level.startingPearls)),
      infoRow(ICONS.fish, "Guardião", found ? guardian.name : "???"),
    ),
  );
}

function placePanel(level: LevelDefinition, found: boolean): HTMLElement {
  const art = levelBackgroundPath(level.backgroundKey);
  return h(
    "section",
    { class: "gr-album__sheet", testId: "album-sheet", dataEntry: level.id, dataState: found ? "unlocked" : "locked" },
    banner(art, ICONS.coral),
    h(
      "div",
      { class: "gr-album__sheet-head" },
      h("h2", { class: "gr-album__sheet-name", text: level.name }),
      h("p", { class: "gr-subtitle", text: level.subtitle }),
      level.briefing ? h("p", { class: "gr-album__sheet-line", text: level.briefing }) : null,
      level.quote ? h("p", { class: "gr-album__quote gr-album__quote--inline", text: `“${level.quote}”` }) : null,
    ),
    h(
      "div",
      { class: "gr-album__rows" },
      infoRow(ICONS.waves, "Ondas", String(level.waves.length)),
      infoRow(ICONS.heart, "Vidas do Recife", String(level.reefHealth)),
      infoRow(ICONS.pearl, "Pérolas iniciais", String(level.startingPearls)),
      infoRow(ICONS.star, "Estado", found ? "Defendido" : "Ainda por defender"),
    ),
  );
}

function treasurePanel(level: LevelDefinition, interactable: InteractableDefinition, found: boolean): HTMLElement {
  const art = levelBackgroundPath(level.backgroundKey);
  return h(
    "section",
    { class: "gr-album__sheet", testId: "album-sheet", dataEntry: interactable.id, dataState: found ? "unlocked" : "locked" },
    banner(art, ICONS.chest),
    h(
      "div",
      { class: "gr-album__sheet-head" },
      h("h2", { class: "gr-album__sheet-name", text: found || !interactable.secretId ? interactable.label : "???" }),
      h("p", { class: "gr-subtitle", text: level.name }),
      h("p", { class: "gr-album__sheet-line", text: goalLine(interactable) }),
    ),
    h(
      "div",
      { class: "gr-album__rows" },
      infoRow(ICONS.coral, "Onde", level.name),
      infoRow(ICONS.chest, "Estado", found ? "Encontrado" : "Ainda escondido"),
      interactable.ally ? infoRow(ICONS.fish, "Liberta", GUARDIANS[interactable.ally.guardianId].name) : null,
      interactable.availableFromWave ? infoRow(ICONS.waves, "A partir da onda", String(interactable.availableFromWave)) : null,
    ),
  );
}

/** O que o mapa pede para resolver o achado, em uma linha. */
function goalLine(interactable: InteractableDefinition): string {
  const goal = interactable.goal;
  switch (goal.type) {
    case "taps":
      return `Precisa de ${goal.taps} toques, com fôlego entre eles.`;
    case "guardNearby":
      return `Mantenha um Guardião a ${goal.radius} de distância por ${(goal.durationMs / 1000).toFixed(0)}s.`;
    case "enemyDefeated":
      return `Abre quando ${goal.count ?? 1} inimigo(s) certo(s) caem.`;
    case "reveal":
      return "Um toque basta — se você souber onde tocar.";
  }
}
