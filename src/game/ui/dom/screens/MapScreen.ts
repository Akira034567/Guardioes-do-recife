import { artPath, GUARDIAN_ART } from "../../../assets/guardianArt";
import { enemyPortraitPath } from "../../../assets/enemyArt";
import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import { challengeExpiresAt, challengeRule, currentChallenges, type ChallengeDefinition } from "../../../core/progression/challenges";
import { highestUnlockedDifficulty } from "../../../core/progression/difficultyUnlocks";
import { LEVEL_IDS } from "../../../data/levels";
import { DIFFICULTY_IDS } from "../../../data/difficulty";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import { DIFFICULTIES } from "../../../data/difficulty";
import { ENCOUNTERS, type EncounterDefinition } from "../../../data/encounters";
import { ENEMIES } from "../../../data/enemies";
import { GUARDIANS } from "../../../data/guardians";
import { getLevel, LEVELS } from "../../../data/levels";
import { GLOBAL_CURRENCY } from "../../../data/progression";
import { isRegionOpen, REGIONS, type RegionDefinition } from "../../../data/regions";
import { STORY_SEQUENCES } from "../../../data/story";
import type { EnemyId, LevelDefinition } from "../../../types";
import { button, h } from "../h";
import { ICONS, MAP_COMPASS } from "../icons";
import { MAP_NAV_IDS, shellSidebar } from "../shell";
import type { Screen, ScreenHost } from "../ScreenHost";

export type NodeState = "locked" | "available" | "completed" | "perfect";

export interface MapActions {
  /** Volta para o Meu Recife, a tela inicial. */
  onGoHub(): void;
  onPlayLevel(level: LevelDefinition): void;
  onPlayEncounter(encounter: EncounterDefinition): void;
  onPlayChallenge(challenge: ChallengeDefinition): void;
  onOpenAchievements(): void;
  onOpenCollection(): void;
  onOpenBestiary(): void;
  onOpenStories(): void;
  onOpenSettings(): void;
  onResetProgress(): void;
}

/** O que a tela está mostrando embaixo: uma fase da campanha ou um Encontro. */
type Selection = { kind: "level"; level: LevelDefinition } | { kind: "encounter"; encounter: EncounterDefinition };

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
 * Mapa do Recife (item 29): a tela inicial do jogo fora da partida. À esquerda o menu; no meio a
 * região com as fases sobre o mapa pintado e os Encontros pendurados nelas; embaixo a ficha da fase
 * escolhida e os desafios da rotação.
 *
 * Clicar num nó ESCOLHE a fase e enche a ficha; quem entra na partida é o botão da ficha. Assim dá
 * para conferir ondas, vidas e ameaças antes de decidir, sem entrar e voltar.
 */
export function mapScreen(progression: ProgressionService, isUnlocked: (levelId: string) => boolean, actions: MapActions): Screen {
  const region = REGIONS.find(isRegionOpen) ?? REGIONS[0];
  let selected: Selection = { kind: "level", level: nextLevel(region, progression, isUnlocked) };

  return {
    id: "map",
    render(host: ScreenHost) {
      const root = h("div", { class: "gr-world", testId: "map-panel" });
      const art = levelBackgroundPath(region.backgroundKey);
      if (art) root.append(h("div", { class: "gr-world__backdrop", style: `background-image:url(${art})` }));

      const layout = h("div", { class: "gr-world__layout" });
      root.append(layout);

      const draw = (): void => {
        layout.replaceChildren(
          sidebar(host, actions),
          h(
            "div",
            { class: "gr-world__main" },
            topBar(progression, actions),
            mapField(region, progression, isUnlocked, art, selected, (next) => {
              selected = next;
              draw();
            }),
            detail(selected, progression, actions),
            challengeRow(progression, isUnlocked, actions),
          ),
        );
      };

      draw();
      return root;
    },
  };
}

/** A fase que o mapa abre marcada: a primeira ainda por vencer, ou a última aberta. */
function nextLevel(region: RegionDefinition, progression: ProgressionService, isUnlocked: (levelId: string) => boolean): LevelDefinition {
  const levels = region.nodes.map((node) => getLevel(node.levelId)).filter((level): level is LevelDefinition => level !== undefined);
  const pending = levels.find((level) => levelNodeState(level.id, progression, isUnlocked(level.id)) === "available");
  const open = levels.filter((level) => isUnlocked(level.id));
  return pending ?? open.at(-1) ?? levels[0] ?? LEVELS[0];
}

// ------------------------------------------------------------------------------- menu da esquerda

function sidebar(host: ScreenHost, actions: MapActions): HTMLElement {
  return shellSidebar(
    "map",
    {
      onGoHub: actions.onGoHub,
      onGoMap: () => {},
      onOpenCollection: actions.onOpenCollection,
      onOpenBestiary: actions.onOpenBestiary,
      onOpenStories: actions.onOpenStories,
      onOpenAchievements: actions.onOpenAchievements,
      onOpenSettings: actions.onOpenSettings,
    },
    {
      navId: (section) => MAP_NAV_IDS[section],
      back: actions.onGoHub,
      backId: "map-back",
      motto: "Força no mar, vida no Recife.",
      footer: h("button", {
        class: "gr-world__reset",
        testId: "map-reset",
        type: "button",
        text: "Limpar progresso",
        onClick: () => host.push(confirmResetScreen(() => host.pop(), actions.onResetProgress)),
      }),
    },
  );
}

// ------------------------------------------------------------------------------- barra de cima

function topBar(progression: ProgressionService, actions: MapActions): HTMLElement {
  const progress = progression.progress;
  const stars = Object.values(progress.levelStars).reduce((total, record) => total + record.stars, 0);
  const found = ENCOUNTERS.filter((encounter) => progress.completedEncounters.includes(encounter.id)).length;
  const read = STORY_SEQUENCES.filter((sequence) => progress.storyProgress.seen.includes(sequence.id)).length;
  return h(
    "header",
    { class: "gr-world__top" },
    h(
      "div",
      { class: "gr-world__counters" },
      counter(ICONS.shell, String(progress.currency.shells), GLOBAL_CURRENCY.name, "map-shells"),
      counter(ICONS.star, `${stars}/${LEVELS.length * 3}`, "Estrelas", "map-stars"),
      counter(ICONS.book, `${found}/${ENCOUNTERS.length}`, "Encontros", "map-encounters", "Encontros"),
    ),
    h(
      "button",
      { class: "gr-world__stories", testId: "map-stories-card", type: "button", onClick: actions.onOpenStories },
      h("span", { class: "gr-icon gr-icon--lg", html: ICONS.book }),
      h(
        "span",
        { class: "gr-world__stories-copy" },
        h("span", { class: "gr-world__stories-line", text: "O oceano sempre guarda novas histórias." }),
        h("span", { class: "gr-hint", text: `${read} de ${STORY_SEQUENCES.length} capítulos lidos` }),
      ),
    ),
  );
}

function counter(icon: string, value: string, title: string, testId: string, label?: string): HTMLElement {
  return h(
    "div",
    { class: "gr-world__counter", testId, title },
    h("span", { class: "gr-icon", html: icon }),
    label ? h("span", { class: "gr-world__counter-label", text: label.toUpperCase() }) : null,
    h("span", { class: "gr-world__counter-value", text: value }),
  );
}

// ------------------------------------------------------------------------------- o mapa

/** Onde o Encontro fica em relação à fase que o abre, em % do mapa. */
const ENCOUNTER_OFFSET = { x: 5, y: -23 } as const;

function mapField(
  region: RegionDefinition,
  progression: ProgressionService,
  isUnlocked: (levelId: string) => boolean,
  art: string | null,
  selected: Selection,
  onSelect: (next: Selection) => void,
): HTMLElement {
  const field = h("div", { class: "gr-world__map", testId: "map-track", dataRegion: region.id });
  if (art) field.append(h("div", { class: "gr-world__map-art", style: `background-image:url(${art})` }));
  field.append(trail(region, isUnlocked));

  const nodes = h("div", { class: "gr-world__nodes" });
  const pending = region.nodes.find((node) => levelNodeState(node.levelId, progression, isUnlocked(node.levelId)) === "available");
  for (const node of region.nodes) {
    const level = getLevel(node.levelId);
    if (!level) continue;
    nodes.append(levelNode(level, node.x, node.y, region.nodes.indexOf(node), progression, isUnlocked, selected, onSelect, node === pending));
    const encounter = ENCOUNTERS.find((candidate) => candidate.after === node.levelId);
    if (encounter) nodes.append(encounterNode(encounter, node.x + ENCOUNTER_OFFSET.x, node.y + ENCOUNTER_OFFSET.y, progression, selected, onSelect));
  }
  field.append(nodes);

  field.append(regionTabs(region));
  field.append(h("div", { class: "gr-world__compass", html: MAP_COMPASS }));
  field.append(h("span", { class: "gr-world__sign gr-world__sign--here", text: region.name }));
  if (region.nextSign) field.append(h("span", { class: "gr-world__sign gr-world__sign--next", text: region.nextSign }));
  return field;
}

/**
 * A trilha pontilhada: opaca até onde o jogador já chegou, apagada no resto, mais um fio ligando cada
 * Encontro à fase de onde ele sai. `non-scaling-stroke` mantém o tracejado uniforme mesmo com o
 * `viewBox` esticado para a caixa do mapa.
 */
function trail(region: RegionDefinition, isUnlocked: (levelId: string) => boolean): HTMLElement {
  const points = region.nodes.map((node) => `${node.x},${node.y}`);
  const walked = region.nodes.filter((node) => isUnlocked(node.levelId)).length;
  const line = (from: number, to: number, cls: string): string =>
    to - from < 2 ? "" : `<polyline class="${cls}" points="${points.slice(from, to).join(" ")}" vector-effect="non-scaling-stroke"/>`;
  const branches = region.nodes
    .filter((node) => ENCOUNTERS.some((encounter) => encounter.after === node.levelId))
    .map((node) => `<line class="gr-world__trail-branch" x1="${node.x}" y1="${node.y}" x2="${node.x + ENCOUNTER_OFFSET.x}" y2="${node.y + ENCOUNTER_OFFSET.y}" vector-effect="non-scaling-stroke"/>`)
    .join("");
  return h("div", {
    class: "gr-world__trail",
    html:
      `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">` +
      line(0, points.length, "gr-world__trail-rest") +
      branches +
      line(0, walked, "gr-world__trail-walked") +
      `</svg>`,
  });
}

function levelNode(
  level: LevelDefinition,
  x: number,
  y: number,
  index: number,
  progression: ProgressionService,
  isUnlocked: (levelId: string) => boolean,
  selected: Selection,
  onSelect: (next: Selection) => void,
  isNext: boolean,
): HTMLElement {
  const state = levelNodeState(level.id, progression, isUnlocked(level.id));
  const stars = progression.record(level.id)?.stars ?? 0;
  const chosen = selected.kind === "level" && selected.level.id === level.id;
  return h(
    "div",
    { class: "gr-world__pin", style: `left:${x}%;top:${y}%` },
    isNext ? h("span", { class: "gr-world__pin-flag", text: "Próxima fase" }) : null,
    h(
      "button",
      {
        class: `gr-world__node${chosen ? " gr-world__node--on" : ""}${isNext ? " gr-world__node--next" : ""}`,
        testId: `map-node-${level.id}`,
        dataState: state,
        type: "button",
        disabled: state === "locked",
        "aria-label": `Fase ${index + 1}: ${level.name}`,
        onClick: () => onSelect({ kind: "level", level }),
      },
      h("span", { text: String(index + 1) }),
    ),
    h("span", { class: "gr-world__pin-stars", dataStars: String(stars) }, ...starRow(stars)),
  );
}

function starRow(stars: number): HTMLElement[] {
  return Array.from({ length: 3 }, (_, index) =>
    h("span", { class: `gr-icon gr-world__star${index < stars ? " gr-world__star--on" : ""}`, html: index < stars ? ICONS.star : ICONS.starOutline }),
  );
}

function encounterNode(
  encounter: EncounterDefinition,
  x: number,
  y: number,
  progression: ProgressionService,
  selected: Selection,
  onSelect: (next: Selection) => void,
): HTMLElement {
  const state = encounterNodeState(encounter, progression);
  const chosen = selected.kind === "encounter" && selected.encounter.id === encounter.id;
  const art = artPath(encounter.guardianId, GUARDIAN_ART[encounter.guardianId].base, "idle");
  return h(
    "div",
    { class: "gr-world__pin gr-world__pin--encounter", style: `left:${x}%;top:${y}%` },
    h(
      "button",
      {
        class: `gr-world__node gr-world__node--encounter${chosen ? " gr-world__node--on" : ""}`,
        testId: `map-node-${encounter.id}`,
        dataState: state,
        type: "button",
        disabled: state === "locked",
        "aria-label": `Encontro: ${encounter.level.name}`,
        onClick: () => onSelect({ kind: "encounter", encounter }),
      },
      state === "locked"
        ? h("span", { class: "gr-icon", html: ICONS.lock })
        : h("img", { class: `gr-world__node-art${state === "completed" ? "" : " gr-node__art--unknown"}`, src: art, alt: "" }),
    ),
  );
}

/** Abas das regiões: a aberta à esquerda, com as setas; as que ainda virão ficam anunciadas ao lado. */
function regionTabs(current: RegionDefinition): HTMLElement {
  const open = REGIONS.filter(isRegionOpen);
  const alone = open.length < 2;
  const step = (delta: number): HTMLElement =>
    h("button", {
      class: "gr-world__region-step",
      testId: `map-region-${delta < 0 ? "prev" : "next"}`,
      type: "button",
      disabled: alone,
      title: alone ? "Só o Recife Costeiro está aberto por enquanto." : "",
      "aria-label": delta < 0 ? "Região anterior" : "Próxima região",
      html: delta < 0 ? ICONS.chevronLeft : ICONS.chevronRight,
    });

  return h(
    "div",
    { class: "gr-world__regions", testId: "map-regions", dataValue: current.id },
    h(
      "div",
      { class: "gr-world__region gr-world__region--on", testId: `map-region-${current.id}` },
      step(-1),
      h(
        "span",
        { class: "gr-world__region-copy" },
        h("span", { class: "gr-world__region-name", text: current.name.toUpperCase() }),
        h("span", { class: "gr-world__region-tag", text: current.tagline }),
      ),
      step(1),
    ),
    ...REGIONS.filter((region) => region.id !== current.id).map((region) =>
      h(
        "div",
        { class: "gr-world__region gr-world__region--locked", testId: `map-region-${region.id}`, dataState: "locked" },
        h("span", { class: "gr-icon", html: ICONS.lock }),
        h(
          "span",
          { class: "gr-world__region-copy" },
          h("span", { class: "gr-world__region-name", text: region.name.toUpperCase() }),
          h("span", { class: "gr-world__region-tag", text: region.tagline }),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------------------- ficha da fase

function detail(selected: Selection, progression: ProgressionService, actions: MapActions): HTMLElement {
  const level = selected.kind === "level" ? selected.level : selected.encounter.level;
  const art = levelBackgroundPath(level.backgroundKey);
  const isEncounter = selected.kind === "encounter";
  const index = LEVELS.findIndex((candidate) => candidate.id === level.id);
  const stars = progression.record(level.id)?.stars ?? 0;
  const bosses = [...new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))].filter((id) => ENEMIES[id].isBoss);
  const threats = [...new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))].filter((id) => !ENEMIES[id].isBoss);

  return h(
    "section",
    { class: "gr-world__detail", testId: "map-detail", dataLevel: level.id, dataKind: selected.kind },
    art
      ? h("div", { class: "gr-world__shot", style: `background-image:url(${art})` })
      : h(
          "div",
          { class: "gr-world__shot gr-world__shot--plain" },
          isEncounter
            ? h("img", {
                class: `gr-world__shot-art${progression.isUnlocked(selected.encounter.guardianId) ? "" : " gr-node__art--unknown"}`,
                src: artPath(selected.encounter.guardianId, GUARDIAN_ART[selected.encounter.guardianId].base, "idle"),
                alt: "",
              })
            : null,
        ),
    h(
      "div",
      { class: "gr-world__detail-copy" },
      h("span", { class: "gr-badge", text: isEncounter ? "encontro" : `Fase ${index + 1}` }),
      h("h1", { class: "gr-world__detail-name", text: level.name }),
      h("p", { class: "gr-subtitle", text: level.subtitle }),
      h("p", {
        class: "gr-world__detail-line",
        text: isEncounter
          ? `${selected.encounter.teaser} Vencer aqui traz ${GUARDIANS[selected.encounter.guardianId].name} para a coleção.`
          : (level.briefing ?? ""),
      }),
    ),
    h(
      "div",
      { class: "gr-world__detail-facts" },
      h(
        "div",
        { class: "gr-world__stats" },
        fact(ICONS.waves, "Ondas", String(level.waves.length)),
        fact(ICONS.heart, "Vidas", String(level.reefHealth)),
        fact(ICONS.pearl, "Pérolas iniciais", String(level.startingPearls)),
        ...(isEncounter ? [] : [fact(ICONS.star, "Estrelas", `${stars}/3`)]),
        ...bosses.map((enemyId) => bossFact(enemyId, Boolean(progression.progress.enemyDiscovery[enemyId]))),
      ),
      h(
        "div",
        { class: "gr-world__threats-box" },
        h("span", { class: "gr-world__detail-title", text: "Ameaças conhecidas" }),
        h(
          "div",
          { class: "gr-world__threats", testId: "map-threats" },
          ...threats.map((enemyId) => threatTile(enemyId, Boolean(progression.progress.enemyDiscovery[enemyId]))),
        ),
      ),
    ),
    h(
      "button",
      {
        class: "gr-button gr-button--primary gr-world__enter",
        testId: "map-enter",
        type: "button",
        onClick: () => (selected.kind === "level" ? actions.onPlayLevel(selected.level) : actions.onPlayEncounter(selected.encounter)),
      },
      h("span", { class: "gr-icon", html: ICONS.play }),
      h("span", { text: isEncounter ? "ENTRAR NO ENCONTRO" : "ENTRAR NA FASE" }),
    ),
  );
}

function fact(icon: string, label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "gr-world__fact" },
    h("span", { class: "gr-icon gr-icon--lg", html: icon }),
    h("span", { class: "gr-world__fact-text" }, h("span", { class: "gr-stat__label", text: label }), h("span", { class: "gr-world__fact-value", text: value })),
  );
}

function bossFact(enemyId: EnemyId, seen: boolean): HTMLElement {
  const portrait = enemyPortraitPath(ENEMIES[enemyId]);
  return h(
    "div",
    { class: "gr-world__fact gr-world__fact--boss", testId: `map-boss-${enemyId}` },
    portrait ? h("img", { class: "gr-world__fact-art", src: portrait, alt: "" }) : h("span", { class: "gr-icon gr-icon--lg", html: ICONS.skull }),
    h(
      "span",
      { class: "gr-world__fact-text" },
      h("span", { class: "gr-stat__label", text: "Chefe" }),
      h("span", { class: "gr-world__fact-value", text: seen ? ENEMIES[enemyId].name : "???" }),
    ),
  );
}

function threatTile(enemyId: EnemyId, seen: boolean): HTMLElement {
  const portrait = enemyPortraitPath(ENEMIES[enemyId]);
  return h(
    "div",
    {
      class: "gr-world__threat",
      testId: `map-enemy-${enemyId}`,
      dataState: seen ? "known" : "unknown",
      title: seen ? ENEMIES[enemyId].name : "Ameaça ainda não catalogada",
    },
    portrait
      ? h("img", { class: `gr-world__threat-art${seen ? "" : " gr-node__art--unknown"}`, src: portrait, alt: seen ? ENEMIES[enemyId].name : "???" })
      : h("span", { class: "gr-world__threat-art" }),
  );
}

// ------------------------------------------------------------------------------- desafios

/** Desafios do dia e da semana: a mesma rotação para todo mundo, sorteada a partir da data. */
function challengeRow(progression: ProgressionService, isUnlocked: (levelId: string) => boolean, actions: MapActions): HTMLElement {
  const now = new Date();
  const reachable = LEVELS.filter((level) => isUnlocked(level.id)).map((level) => level.id);
  const challenges = currentChallenges(
    now,
    progression.progress.unlockedGuardians as never,
    reachable,
    DIFFICULTY_IDS.indexOf(highestUnlockedDifficulty(progression.progress, LEVEL_IDS)),
  );
  return h(
    "div",
    { class: "gr-world__challenges", testId: "map-challenges" },
    ...challenges.map((challenge) => {
      const done = progression.progress.challenges.completed.includes(challenge.id);
      const level = LEVELS.find((candidate) => candidate.id === challenge.levelId);
      const squad = challenge.loadout.map((guardianId) => GUARDIANS[guardianId].shortName).join(", ");
      return h(
        "button",
        {
          class: "gr-world__challenge",
          testId: `map-challenge-${challenge.kind}`,
          dataState: done ? "completed" : "available",
          type: "button",
          disabled: done,
          onClick: () => actions.onPlayChallenge(challenge),
        },
        h(
          "span",
          { class: "gr-world__challenge-head" },
          h("span", { class: "gr-icon gr-icon--lg", html: challenge.kind === "daily" ? ICONS.target : ICONS.calendar }),
          h("span", { class: "gr-world__challenge-name", text: challenge.name.toUpperCase() }),
          h(
            "span",
            { class: "gr-world__challenge-clock" },
            h("span", { class: "gr-icon", html: ICONS.timer }),
            h("span", { text: countdown(challengeExpiresAt(challenge.kind, now), now) }),
          ),
        ),
        h("span", { class: "gr-world__challenge-level", text: `${level?.name ?? challenge.levelId} — ${DIFFICULTIES[challenge.difficulty].name}` }),
        h("span", { class: "gr-hint", text: done ? "Cumprido. Espere a próxima rotação." : `Vença ${challengeRule(challenge)}, com ${squad}.` }),
        h(
          "span",
          { class: "gr-world__challenge-prize" },
          h("span", { class: "gr-icon", html: ICONS.shell }),
          h("span", { text: String(challenge.shells) }),
        ),
      );
    }),
  );
}

/** Quanto falta, na maior unidade que ainda cabe: `5d 12h`, `12h 34min`, `8min`. */
export function countdown(deadline: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}min`;
  return `${minutes}min`;
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
