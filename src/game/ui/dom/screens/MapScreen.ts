import { artPath, GUARDIAN_ART } from "../../../assets/guardianArt";
import { enemyPortraitPath } from "../../../assets/enemyArt";
import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import { challengeExpiresAt, challengeRule, currentChallenges, type ChallengeDefinition } from "../../../core/progression/challenges";
import { difficultyGates, highestUnlockedDifficulty, type DifficultyGate } from "../../../core/progression/difficultyUnlocks";
import { hasOwnObjectives, objectivesFor } from "../../../core/progression/levelObjectives";
import { objectiveLabel } from "../../../core/progression/objectives";
import { difficultyTrack } from "../../../core/progression/stars";
import { LEVEL_IDS } from "../../../data/levels";
import { DIFFICULTY_IDS, type DifficultyId } from "../../../data/difficulty";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import { DIFFICULTIES } from "../../../data/difficulty";
import { ENCOUNTERS, type EncounterDefinition } from "../../../data/encounters";
import { GUARDIANS } from "../../../data/guardians";
import { ENEMIES } from "../../../data/enemies";
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
  /** A dificuldade vem do mapa: é a trilha que o jogador está olhando. */
  onPlayLevel(level: LevelDefinition, difficulty: DifficultyId): void;
  onPlayEncounter(encounter: EncounterDefinition): void;
  onPlayChallenge(challenge: ChallengeDefinition): void;
  onOpenAchievements(): void;
  onOpenSchool(): void;
  onOpenCollection(): void;
  onOpenMastery(): void;
  onOpenBestiary(): void;
  onOpenStories(): void;
  onOpenAccount(): void;
  onOpenSettings(): void;
  onResetProgress(): void;
}

/** O que a tela está mostrando embaixo: uma fase da campanha ou um Encontro. */
type Selection = { kind: "level"; level: LevelDefinition } | { kind: "encounter"; encounter: EncounterDefinition };

/**
 * Estado de uma fase NA TRILHA que o mapa está mostrando: bloqueada, aberta, concluída ou concluída
 * com as três estrelas daquela dificuldade.
 *
 * A trilha importa: uma fase com 3/3 no Normal continua "por fazer" no Difícil, que pede outra
 * missão. Era exatamente isso que o mapa escondia — ele mostrava sempre as estrelas do Normal.
 */
export function levelNodeState(levelId: string, progression: ProgressionService, unlocked: boolean, difficulty: DifficultyId = "normal"): NodeState {
  const record = progression.record(levelId);
  if (!record) return unlocked ? "available" : "locked";
  const track = difficultyTrack(record, difficulty);
  if (track.completions === 0 && !record.clearedDifficulties.includes(difficulty)) return unlocked ? "available" : "locked";
  if (track.stars >= 3) return "perfect";
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
  /**
   * A TRILHA que o mapa está mostrando. O mapa abre na mais alta que o jogador já abriu: quem
   * terminou a campanha no Normal quer ver o Difícil, e antes disso o Difícil aparecia em lugar
   * nenhum — o jogador nem descobria que tinha liberado.
   */
  let difficulty: DifficultyId = highestUnlockedDifficulty(progression.progress, LEVEL_IDS);
  let selected: Selection = { kind: "level", level: nextLevel(region, progression, isUnlocked, difficulty) };

  return {
    id: "map",
    render(host: ScreenHost) {
      const root = h("div", { class: "gr-world", testId: "map-panel" });
      const art = levelBackgroundPath(region.backgroundKey);
      if (art) root.append(h("div", { class: "gr-world__backdrop", style: `background-image:url(${art})` }));

      const layout = h("div", { class: "gr-world__layout" });
      root.append(layout);

      const draw = (): void => {
        root.dataset.difficulty = difficulty;
        layout.replaceChildren(
          sidebar(host, actions),
          h(
            "div",
            { class: "gr-world__main" },
            topBar(progression, actions, difficulty),
            difficultyTrackBar(progression, isUnlocked, difficulty, (next) => {
              difficulty = next;
              // Trocar de trilha é trocar de campanha: a fase em foco vira a próxima DAQUELA trilha.
              selected = { kind: "level", level: nextLevel(region, progression, isUnlocked, difficulty) };
              draw();
            }),
            mapField(region, progression, isUnlocked, art, selected, difficulty, (next) => {
              selected = next;
              draw();
            }),
            detail(selected, progression, actions, difficulty),
            challengeRow(progression, isUnlocked, actions),
          ),
        );
      };

      draw();
      return root;
    },
  };
}

// ------------------------------------------------------------------- trilhas de dificuldade

/**
 * A barra das trilhas: uma fileira fina, e nada mais.
 *
 * A primeira versão eram três cartões grandes com nome, contagem, estrelas e uma frase de apoio
 * cada — um bloco que comia um quinto da tela para responder algo que cabe numa linha. O mapa é o
 * assunto; a dificuldade é um ajuste do mapa, e agora ocupa o tamanho de um ajuste.
 *
 * O que sobrou em cada pílula é o essencial para escolher: o nome, e quantas estrelas daquela
 * trilha já estão em casa. O resto (a descrição, o que falta para destravar) vive no `title`.
 */
function difficultyTrackBar(
  progression: ProgressionService,
  isUnlocked: (levelId: string) => boolean,
  current: DifficultyId,
  onPick: (next: DifficultyId) => void,
): HTMLElement {
  const gates = difficultyGates(progression.progress, LEVEL_IDS);
  return h(
    "nav",
    { class: "gr-world__tracks", testId: "map-tracks", dataValue: current, "aria-label": "Dificuldade da campanha" },
    h("span", { class: "gr-world__tracks-label", text: "DIFICULDADE" }),
    ...DIFFICULTY_IDS.map((id) => trackPill(id, gates.find((gate) => gate.id === id), progression, isUnlocked, current, onPick)),
  );
}

function trackPill(
  id: DifficultyId,
  gate: DifficultyGate | undefined,
  progression: ProgressionService,
  isUnlocked: (levelId: string) => boolean,
  current: DifficultyId,
  onPick: (next: DifficultyId) => void,
): HTMLElement {
  const definition = DIFFICULTIES[id];
  const open = gate?.unlocked ?? id === "normal";
  const cleared = LEVEL_IDS.filter((levelId) => progression.record(levelId)?.clearedDifficulties.includes(id)).length;
  const stars = LEVEL_IDS.reduce((total, levelId) => total + difficultyTrack(progression.record(levelId), id).stars, 0);
  void isUnlocked;
  return h(
    "button",
    {
      class: `gr-world__track${id === current ? " gr-world__track--on" : ""}${open ? "" : " gr-world__track--locked"}`,
      testId: `map-track-${id}`,
      dataState: open ? (id === current ? "current" : "open") : "locked",
      dataCleared: String(cleared),
      type: "button",
      disabled: !open,
      style: `--gr-accent:${definition.accent}`,
      "aria-pressed": String(id === current),
      // A frase de apoio e o requisito saíram da tela e ficaram aqui: quem quiser, pergunta.
      title: open ? `${definition.name} — ${definition.pitch} (${cleared}/${LEVEL_IDS.length} fases vencidas)` : (gate?.requirement ?? ""),
      onClick: () => onPick(id),
    },
    h("span", { class: "gr-icon", html: open ? ICONS.difficulty(difficultyWaves(id), definition.accent) : ICONS.lock }),
    h("span", { class: "gr-world__track-name", text: definition.name }),
    open
      ? h(
          "span",
          { class: "gr-world__track-score" },
          h("span", { class: "gr-icon", html: ICONS.star }),
          h("span", { text: `${stars}/${LEVEL_IDS.length * 3}` }),
        )
      : null,
  );
}

/** Quantas ondinhas o pictograma da dificuldade desenha: 1 no Normal, 3 no Abissal. */
const difficultyWaves = (id: DifficultyId): 1 | 2 | 3 => Math.min(3, Math.max(1, DIFFICULTY_IDS.indexOf(id) + 1)) as 1 | 2 | 3;

/** A fase que o mapa abre marcada: a primeira ainda por vencer, ou a última aberta. */
function nextLevel(
  region: RegionDefinition,
  progression: ProgressionService,
  isUnlocked: (levelId: string) => boolean,
  difficulty: DifficultyId = "normal",
): LevelDefinition {
  const levels = region.nodes.map((node) => getLevel(node.levelId)).filter((level): level is LevelDefinition => level !== undefined);
  const pending = levels.find((level) => levelNodeState(level.id, progression, isUnlocked(level.id), difficulty) === "available");
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
      onOpenSchool: actions.onOpenSchool,
      onOpenCollection: actions.onOpenCollection,
      onOpenMastery: actions.onOpenMastery,
      onOpenBestiary: actions.onOpenBestiary,
      onOpenStories: actions.onOpenStories,
      onOpenAchievements: actions.onOpenAchievements,
      onOpenAccount: actions.onOpenAccount,
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

function topBar(progression: ProgressionService, actions: MapActions, difficulty: DifficultyId): HTMLElement {
  const progress = progression.progress;
  // As estrelas contadas aqui são as DA TRILHA aberta: no Difícil, o contador começa do zero.
  const stars = LEVEL_IDS.reduce((total, levelId) => total + difficultyTrack(progress.levelStars[levelId], difficulty).stars, 0);
  const found = ENCOUNTERS.filter((encounter) => progress.completedEncounters.includes(encounter.id)).length;
  const read = STORY_SEQUENCES.filter((sequence) => progress.storyProgress.seen.includes(sequence.id)).length;
  return h(
    "header",
    { class: "gr-world__top" },
    h(
      "div",
      { class: "gr-world__counters" },
      counter(ICONS.shell, String(progress.currency.shells), GLOBAL_CURRENCY.name, "map-shells"),
      counter(ICONS.star, `${stars}/${LEVELS.length * 3}`, `Estrelas · ${DIFFICULTIES[difficulty].name}`, "map-stars"),
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
  difficulty: DifficultyId,
  onSelect: (next: Selection) => void,
): HTMLElement {
  const field = h("div", { class: "gr-world__map", testId: "map-track", dataRegion: region.id, dataDifficulty: difficulty });
  if (art) field.append(h("div", { class: "gr-world__map-art", style: `background-image:url(${art})` }));
  field.append(trail(region, isUnlocked));

  const nodes = h("div", { class: "gr-world__nodes" });
  const pending = region.nodes.find((node) => levelNodeState(node.levelId, progression, isUnlocked(node.levelId), difficulty) === "available");
  for (const node of region.nodes) {
    const level = getLevel(node.levelId);
    if (!level) continue;
    nodes.append(levelNode(level, node.x, node.y, region.nodes.indexOf(node), progression, isUnlocked, selected, difficulty, onSelect, node === pending));
    const encounter = ENCOUNTERS.find((candidate) => candidate.after === node.levelId);
    if (encounter) nodes.append(encounterNode(encounter, node.x + ENCOUNTER_OFFSET.x, node.y + ENCOUNTER_OFFSET.y, progression, selected, onSelect));
  }
  field.append(nodes);

  field.append(regionTabs(region));
  field.append(h("div", { class: "gr-world__compass", html: MAP_COMPASS }));
  field.append(h("span", { class: "gr-world__sign gr-world__sign--here", text: region.name }));
  // A faixa da dificuldade fica POR CIMA do mapa, com a cor dela: é impossível confundir a trilha.
  field.append(
    h("span", {
      class: "gr-world__sign gr-world__sign--difficulty",
      testId: "map-difficulty-sign",
      dataValue: difficulty,
      style: `--gr-accent:${DIFFICULTIES[difficulty].accent}`,
      text: DIFFICULTIES[difficulty].name.toUpperCase(),
    }),
  );
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
  difficulty: DifficultyId,
  onSelect: (next: Selection) => void,
  isNext: boolean,
): HTMLElement {
  const state = levelNodeState(level.id, progression, isUnlocked(level.id), difficulty);
  const stars = difficultyTrack(progression.record(level.id), difficulty).stars;
  const chosen = selected.kind === "level" && selected.level.id === level.id;
  return h(
    "div",
    { class: "gr-world__pin", style: `left:${x}%;top:${y}%;--gr-accent:${DIFFICULTIES[difficulty].accent}` },
    isNext ? h("span", { class: "gr-world__pin-flag", text: "Próxima fase" }) : null,
    h(
      "button",
      {
        class: `gr-world__node${chosen ? " gr-world__node--on" : ""}${isNext ? " gr-world__node--next" : ""}`,
        testId: `map-node-${level.id}`,
        dataState: state,
        type: "button",
        disabled: state === "locked",
        "aria-label": `Fase ${index + 1}: ${level.name} (${DIFFICULTIES[difficulty].name})`,
        onClick: () => onSelect({ kind: "level", level }),
      },
      h("span", { text: String(index + 1) }),
    ),
    h("span", { class: "gr-world__pin-stars", dataStars: String(stars), dataDifficulty: difficulty }, ...starRow(stars)),
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
    // O satélite sozinho não dizia NADA: nem que ali mora um Guardião, nem qual fase é. A etiqueta
    // resolve as duas coisas de uma vez, e some quando o Encontro já foi feito.
    h(
      "span",
      { class: `gr-world__encounter-tag gr-world__encounter-tag--${state}` },
      h("strong", { text: state === "completed" ? GUARDIANS[encounter.guardianId].shortName : state === "locked" ? "?" : "NOVO GUARDIÃO" }),
      state === "locked" ? null : h("span", { text: encounter.level.name }),
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

function detail(selected: Selection, progression: ProgressionService, actions: MapActions, difficulty: DifficultyId): HTMLElement {
  const level = selected.kind === "level" ? selected.level : selected.encounter.level;
  const art = levelBackgroundPath(level.backgroundKey);
  const isEncounter = selected.kind === "encounter";
  const index = LEVELS.findIndex((candidate) => candidate.id === level.id);
  const track = difficultyTrack(progression.record(level.id), difficulty);
  const stars = track.stars;
  const bosses = [...new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))].filter((id) => ENEMIES[id].isBoss);
  const threats = [...new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))].filter((id) => !ENEMIES[id].isBoss);

  return h(
    "section",
    { class: "gr-world__detail", testId: "map-detail", dataLevel: level.id, dataKind: selected.kind, dataDifficulty: difficulty },
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
      h(
        "span",
        { class: "gr-world__detail-tags" },
        h("span", { class: "gr-badge", text: isEncounter ? "encontro" : `Fase ${index + 1}` }),
        isEncounter
          ? null
          : h("span", {
              class: "gr-badge gr-badge--accent",
              testId: "map-detail-difficulty",
              style: `--gr-accent:${DIFFICULTIES[difficulty].accent}`,
              text: DIFFICULTIES[difficulty].name,
            }),
      ),
      h("h1", { class: "gr-world__detail-name", text: level.name }),
      h("p", { class: "gr-subtitle", text: level.subtitle }),
      h("p", {
        class: "gr-world__detail-line",
        text: isEncounter
          ? `${selected.encounter.teaser} Vencer aqui traz ${GUARDIANS[selected.encounter.guardianId].name} para a coleção.`
          : (level.briefing ?? ""),
      }),
      isEncounter ? null : trackObjectives(level, track, difficulty),
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
        onClick: () => (selected.kind === "level" ? actions.onPlayLevel(selected.level, difficulty) : actions.onPlayEncounter(selected.encounter)),
      },
      h("span", { class: "gr-icon", html: ICONS.play }),
      h("span", { text: isEncounter ? "ENTRAR NO ENCONTRO" : "ENTRAR NA FASE" }),
    ),
  );
}

/**
 * Os três objetivos DESTA trilha, com o que já caiu marcado. É o que responde, sem entrar na fase,
 * à pergunta que o Difícil criou: "o que muda aqui além de os bichos baterem mais forte?".
 */
function trackObjectives(level: LevelDefinition, track: { stars: number; objectives: boolean[] }, difficulty: DifficultyId): HTMLElement {
  const own = hasOwnObjectives(level, difficulty);
  return h(
    "div",
    { class: "gr-world__objectives", testId: "map-objectives", dataDifficulty: difficulty, style: `--gr-accent:${DIFFICULTIES[difficulty].accent}` },
    h(
      "span",
      { class: "gr-world__detail-title" },
      h("span", { text: "Objetivos da missão" }),
      h("span", { class: "gr-hint", text: own ? `Próprios do ${DIFFICULTIES[difficulty].name}` : "Iguais aos do Normal" }),
    ),
    h(
      "ul",
      { class: "gr-objectives gr-objectives--compact" },
      ...objectivesFor(level, difficulty).map((objective, position) => {
        const done = track.objectives[position] ?? false;
        return h(
          "li",
          { class: `gr-objective${done ? " gr-objective--done" : ""}`, dataState: done ? "done" : "open" },
          h("span", { class: "gr-objective__mark", html: done ? ICONS.star : ICONS.starOutline }),
          h("span", { class: "gr-objective__text", text: `${objectiveLabel(objective)}.` }),
        );
      }),
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
