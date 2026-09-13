import { artPath, GUARDIAN_ART } from "../../../assets/guardianArt";
import { enemyPortraitPath } from "../../../assets/enemyArt";
import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import { objectiveLabel } from "../../../core/progression/objectives";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import type { LevelRecord } from "../../../core/save/PlayerProgress";
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from "../../../data/difficulty";
import { ENEMIES } from "../../../data/enemies";
import { ENEMY_LORE } from "../../../data/enemyLore";
import { GUARDIANS, GUARDIAN_ORDER, LOADOUT_SIZE } from "../../../data/guardians";
import { DIFFICULTY_REWARD_MULTIPLIER, GLOBAL_CURRENCY, REWARDS } from "../../../data/progression";
import type { EnemyId, GuardianId, LevelDefinition } from "../../../types";
import { button, h } from "../h";
import { BRAND_WAVE, ICONS } from "../icons";
import type { Screen } from "../ScreenHost";

export interface PreparationActions {
  onStart(difficulty: DifficultyId, loadout: GuardianId[]): void;
  onBack(): void;
}

/** O chefe ainda não catalogado não entrega o nome: fica na promessa. */
const UNKNOWN_BOSS_TEASER = "Uma força primitiva desperta…";

/**
 * Tela de preparação (item 20): o que esperar da fase e qual esquadrão levar. O jogador escolhe
 * exatamente `LOADOUT_SIZE` Guardiões entre os que já encontrou.
 *
 * Leitura em duas colunas: à esquerda o lugar (arte, briefing, números e objetivos), à direita as
 * escolhas (dificuldade, ameaças e esquadrão). A esquerda é só informação e a direita é só decisão,
 * então o olho não precisa ir e voltar entre as duas.
 */
export function preparationScreen(
  level: LevelDefinition,
  levelIndex: number,
  progression: ProgressionService,
  actions: PreparationActions,
  initial: {
    difficulty: DifficultyId;
    loadout: GuardianId[];
    encounter?: { guardianId: GuardianId; teaser: string };
    /** Desafio: fase, dificuldade e esquadrão vêm decididos; o jogador não escolhe. */
    locked?: boolean;
    challenge?: { name: string; rule: string; shells: number };
  },
): Screen {
  let difficulty = initial.difficulty;
  const squad: GuardianId[] = initial.loadout.filter((id) => progression.isUnlocked(id)).slice(0, LOADOUT_SIZE);
  // O quadro de Guardiões abre sob demanda ("Alterar Guardiões"): a tela começa mostrando a escolha
  // feita, não o catálogo inteiro.
  let rosterOpen = false;
  const statuses = new Map(progression.unlockStatuses().map((status) => [status.guardianId, status]));
  const record = progression.record(level.id);

  return {
    id: "preparation",
    render() {
      const root = h("div", { class: "gr-prep" });
      const art = levelBackgroundPath(level.backgroundKey);
      if (art) root.append(h("div", { class: "gr-prep__backdrop", style: `background-image:url(${art})` }));

      const layout = h("div", { class: "gr-prep__layout" });
      root.append(layout);

      const draw = (): void => {
        layout.replaceChildren(
          topBar(actions.onBack),
          h(
            "div",
            { class: "gr-prep__body" },
            h(
              "section",
              { class: "gr-panel gr-prep__main", testId: "prep-panel", dataLevel: level.id },
              hero(level, levelIndex, initial.encounter !== undefined, art),
              initial.encounter
                ? h("p", {
                    class: "gr-hint",
                    testId: "prep-encounter",
                    text: `${initial.encounter.teaser} Vencer aqui traz ${GUARDIANS[initial.encounter.guardianId].name} para a coleção.`,
                  })
                : null,
              initial.challenge
                ? h("p", {
                    class: "gr-hint",
                    testId: "prep-challenge",
                    text: `${initial.challenge.name}: vença ${initial.challenge.rule}. Vale ${GLOBAL_CURRENCY.symbol} ${initial.challenge.shells}.`,
                  })
                : null,
              statsRow(level, record?.stars ?? 0),
              objectives(level, record, difficulty),
              ...bossCards(level, progression),
            ),
            h(
              "aside",
              { class: "gr-prep__side" },
              initial.locked
                ? lockedDifficulty(difficulty)
                : difficultyPicker(difficulty, (next) => {
                    difficulty = next;
                    draw();
                  }),
              knownThreats(level, progression),
              squadBlock(squad, statuses, progression, initial.locked ?? false, rosterOpen, {
                redraw: draw,
                toggleRoster: () => {
                  rosterOpen = !rosterOpen;
                  draw();
                  // A coluna rola por dentro: abrir o quadro sem trazê-lo à vista o deixaria fora da tela.
                  if (rosterOpen) layout.querySelector(".gr-prep__roster")?.scrollIntoView({ block: "nearest" });
                },
              }),
            ),
          ),
          bottomBar(actions, () => difficulty, squad),
        );
      };

      draw();
      return root;
    },
  };
}

/** Volta para o mapa à esquerda, marca do jogo à direita. */
function topBar(onBack: () => void): HTMLElement {
  return h(
    "header",
    { class: "gr-prep__top" },
    h(
      "button",
      { class: "gr-prep__back", testId: "prep-back-map", type: "button", onClick: onBack },
      h("span", { class: "gr-icon", html: ICONS.chevronLeft }),
      h("span", { text: "MAPA DO RECIFE" }),
    ),
    h(
      "div",
      { class: "gr-prep__brand" },
      h("span", { class: "gr-prep__brand-name", text: "GUARDIÕES" }),
      h("span", { class: "gr-prep__brand-name", text: "DO RECIFE" }),
      h("span", { class: "gr-prep__brand-wave", html: BRAND_WAVE }),
      h("span", { class: "gr-prep__brand-tag", text: "Diferentes espécies, um mesmo lar." }),
    ),
  );
}

/**
 * Cabeçalho da fase: a arte do mapa entra por trás do texto, esmaecida da direita para a esquerda.
 *
 * A arte vai numa camada própria com `background-image` inline em vez de numa variável CSS: um
 * `url()` relativo dentro de uma custom property é resolvido contra a folha de estilo (`/assets/`),
 * não contra a página, e o caminho sairia dobrado.
 */
function hero(level: LevelDefinition, levelIndex: number, isEncounter: boolean, art: string | null): HTMLElement {
  return h(
    "div",
    { class: `gr-prep__hero${art ? "" : " gr-prep__hero--plain"}` },
    art ? h("div", { class: "gr-prep__hero-art", style: `background-image:url(${art})` }) : null,
    h(
      "div",
      { class: "gr-prep__hero-copy" },
      h("span", { class: "gr-badge", text: isEncounter ? "encontro" : `Fase ${levelIndex + 1}` }),
      h("h1", { class: "gr-title", text: level.name }),
      h("p", { class: "gr-subtitle", text: level.subtitle }),
      level.briefing ? h("p", { class: "gr-prep__briefing", text: level.briefing }) : null,
      level.quote ? h("p", { class: "gr-prep__quote", text: `“${level.quote}”` }) : null,
    ),
  );
}

/** Os quatro números da fase, cada um com o seu pictograma. */
function statsRow(level: LevelDefinition, stars: number): HTMLElement {
  return h(
    "div",
    { class: "gr-prep__stats" },
    statTile(ICONS.waves, "Ondas", String(level.waves.length)),
    statTile(ICONS.heart, "Vidas do Recife", String(level.reefHealth)),
    statTile(ICONS.pearl, "Pérolas iniciais", String(level.startingPearls)),
    statTile(ICONS.star, "Estrelas", `${stars}/3`),
  );
}

function statTile(icon: string, label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "gr-prep__stat" },
    h("span", { class: "gr-icon gr-icon--lg", html: icon }),
    h(
      "span",
      { class: "gr-prep__stat-text" },
      h("span", { class: "gr-stat__label", text: label }),
      h("span", { class: "gr-stat__value", text: value }),
    ),
  );
}

/**
 * Conchas que o objetivo ainda paga, na dificuldade escolhida. Objetivo já cumprido não paga de novo,
 * então ele aparece marcado em vez de anunciar um prêmio que não vem mais.
 */
function objectiveShells(index: number, record: LevelRecord | undefined, difficulty: DifficultyId): number {
  let shells = REWARDS.perNewStar;
  if (index === 0 && (record?.completions ?? 0) === 0) shells += REWARDS.firstCompletion;
  if (index === 2 && (record?.stars ?? 0) < 3) shells += REWARDS.firstPerfect;
  return Math.round(shells * (DIFFICULTY_REWARD_MULTIPLIER[difficulty] ?? 1));
}

function objectives(level: LevelDefinition, record: LevelRecord | undefined, difficulty: DifficultyId): HTMLElement {
  return h(
    "section",
    { class: "gr-prep__block" },
    blockTitle(ICONS.star, "Objetivos da missão"),
    h(
      "ul",
      { class: "gr-objectives", testId: "prep-objectives" },
      ...(level.objectives ?? []).map((objective, index) => {
        const done = record?.objectives[index] ?? false;
        return h(
          "li",
          { class: `gr-objective${done ? " gr-objective--done" : ""}`, dataState: done ? "done" : "open" },
          h("span", { class: "gr-objective__mark", html: done ? ICONS.star : ICONS.starOutline }),
          h("span", { class: "gr-objective__text", text: `${objectiveLabel(objective)}.` }),
          done
            ? h("span", { class: "gr-prep__reward gr-prep__reward--done", text: "conquistado" })
            : h(
                "span",
                { class: "gr-prep__reward", title: `${GLOBAL_CURRENCY.name} por cumprir este objetivo` },
                h("span", { class: "gr-icon", html: ICONS.shell }),
                h("span", { text: `+${objectiveShells(index, record, difficulty)}` }),
              ),
        );
      }),
    ),
  );
}

/**
 * Chefes da fase, um cartão cada. O chefe é anunciado — nome e retrato — porque é ele que decide se
 * o esquadrão escolhido serve; o que fica guardado até o primeiro encontro é COMO ele luta.
 */
function bossCards(level: LevelDefinition, progression: ProgressionService): HTMLElement[] {
  const bosses = [...new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))].filter((id) => ENEMIES[id].isBoss);
  return bosses.map((enemyId) => {
    const seen = Boolean(progression.progress.enemyDiscovery[enemyId]);
    const portrait = enemyPortraitPath(ENEMIES[enemyId]);
    return h(
      "div",
      { class: "gr-prep__boss", testId: `prep-boss-${enemyId}`, dataState: seen ? "known" : "unknown" },
      portrait ? h("img", { class: "gr-prep__boss-art", src: portrait, alt: "" }) : null,
      h(
        "div",
        { class: "gr-prep__boss-copy" },
        h("span", { class: "gr-badge gr-badge--boss", text: "Chefe" }),
        h("span", { class: "gr-prep__boss-name", text: ENEMIES[enemyId].name }),
        h("span", { class: "gr-prep__boss-line", text: seen ? ENEMY_LORE[enemyId].description : UNKNOWN_BOSS_TEASER }),
      ),
    );
  });
}

function blockTitle(icon: string, text: string): HTMLElement {
  return h("h2", { class: "gr-prep__block-title" }, h("span", { class: "gr-icon", html: icon }), h("span", { text }));
}

/** Quantas cristas a dificuldade acende: a primeira uma, a última três. */
const difficultyWaves = (id: DifficultyId): 1 | 2 | 3 => Math.min(3, Math.max(1, DIFFICULTY_IDS.indexOf(id) + 1)) as 1 | 2 | 3;

/** Desafio: a dificuldade já veio sorteada, então ela é anunciada em vez de oferecida. */
function lockedDifficulty(current: DifficultyId): HTMLElement {
  const definition = DIFFICULTIES[current];
  return h(
    "section",
    { class: "gr-prep__block" },
    blockTitle(ICONS.trident, "Dificuldade"),
    h(
      "div",
      { class: "gr-prep__locked", testId: "prep-difficulty-locked", dataValue: current, style: `--gr-accent:${definition.accent}` },
      h("span", { class: "gr-icon gr-icon--lg", html: ICONS.difficulty(difficultyWaves(current), definition.accent) }),
      h(
        "span",
        { class: "gr-prep__locked-copy" },
        h("span", { class: "gr-prep__choice-name", text: definition.name.toUpperCase() }),
        h("span", { class: "gr-hint", text: "Dificuldade e esquadrão fixos neste desafio." }),
      ),
    ),
  );
}

function difficultyPicker(current: DifficultyId, onPick: (id: DifficultyId) => void): HTMLElement {
  return h(
    "section",
    { class: "gr-prep__block" },
    blockTitle(ICONS.trident, "Dificuldade"),
    h(
      "div",
      { class: "gr-prep__choices", testId: "prep-difficulty", dataValue: current },
      ...DIFFICULTY_IDS.map((id) => {
        const definition = DIFFICULTIES[id];
        const chosen = id === current;
        return h(
          "button",
          {
            class: `gr-prep__choice${chosen ? " gr-prep__choice--on" : ""}`,
            testId: `prep-difficulty-${id}`,
            type: "button",
            style: `--gr-accent:${definition.accent}`,
            "aria-pressed": String(chosen),
            onClick: () => onPick(id),
          },
          h("span", { class: "gr-prep__choice-name", text: definition.name.toUpperCase() }),
          h("span", { class: "gr-icon gr-icon--lg", html: ICONS.difficulty(difficultyWaves(id), definition.accent) }),
          h("span", { class: "gr-prep__choice-pitch", text: definition.pitch }),
        );
      }),
    ),
  );
}

/** Inimigos que o jogador já encontrou aparecem pelo nome e pelo retrato; o resto fica em "???". */
function knownThreats(level: LevelDefinition, progression: ProgressionService): HTMLElement {
  const ids = [...new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))].filter((id) => !ENEMIES[id].isBoss);
  return h(
    "section",
    { class: "gr-prep__block" },
    blockTitle(ICONS.skull, "Ameaças conhecidas"),
    h(
      "div",
      { class: "gr-prep__threats", testId: "prep-enemies" },
      ...ids.map((id) => threat(id, Boolean(progression.progress.enemyDiscovery[id]))),
    ),
  );
}

function threat(enemyId: EnemyId, seen: boolean): HTMLElement {
  const portrait = enemyPortraitPath(ENEMIES[enemyId]);
  return h(
    "div",
    { class: "gr-prep__threat", testId: `prep-enemy-${enemyId}`, dataState: seen ? "known" : "unknown" },
    portrait
      ? h("img", { class: `gr-prep__threat-art${seen ? "" : " gr-prep__threat-art--unknown"}`, src: portrait, alt: "" })
      : h("span", { class: "gr-prep__threat-art" }),
    h("span", { class: "gr-prep__threat-name", text: seen ? ENEMIES[enemyId].name : "???" }),
  );
}

/** O retrato usa a arte `idle` da forma base: a criatura limpa, sem a moldura da tabela de upgrades. */
function guardianPortrait(guardianId: GuardianId): string {
  return artPath(guardianId, { folder: GUARDIAN_ART[guardianId].base.folder, ability: "projectile" }, "idle");
}

interface SquadHandlers {
  redraw: () => void;
  toggleRoster: () => void;
}

function squadBlock(
  squad: GuardianId[],
  statuses: Map<GuardianId, { state: string; hidden: boolean; hint: string; price: number | null }>,
  progression: ProgressionService,
  locked: boolean,
  rosterOpen: boolean,
  handlers: SquadHandlers,
): HTMLElement {
  return h(
    "section",
    { class: "gr-prep__block" },
    blockTitle(ICONS.squad, `Selecione seus Guardiões (${squad.length}/${LOADOUT_SIZE})`),
    h(
      "div",
      { class: "gr-prep__squad", testId: "prep-slots" },
      ...Array.from({ length: LOADOUT_SIZE }, (_, index) => slot(squad, index, locked, handlers)),
    ),
    locked
      ? null
      : h(
          "div",
          { class: "gr-prep__squad-actions" },
          h(
            "button",
            {
              class: `gr-prep__roster-toggle${rosterOpen ? " gr-prep__roster-toggle--on" : ""}`,
              testId: "prep-roster-toggle",
              type: "button",
              "aria-expanded": String(rosterOpen),
              onClick: handlers.toggleRoster,
            },
            h("span", { class: "gr-icon", html: rosterOpen ? ICONS.close : ICONS.plus }),
            h("span", { text: rosterOpen ? "Fechar" : "Alterar Guardiões" }),
          ),
        ),
    locked || !rosterOpen ? null : roster(squad, statuses, progression, handlers.redraw),
  );
}

function slot(squad: GuardianId[], index: number, locked: boolean, handlers: SquadHandlers): HTMLElement {
  const guardianId = squad[index];
  if (!guardianId) {
    return h(
      "button",
      {
        class: "gr-prep__slot gr-prep__slot--empty",
        testId: `prep-slot-${index}`,
        dataGuardian: "",
        type: "button",
        disabled: locked,
        onClick: handlers.toggleRoster,
      },
      h("span", { class: "gr-icon gr-icon--lg", html: ICONS.plus }),
      h("span", { class: "gr-prep__slot-name", text: `Vaga ${index + 1}` }),
    );
  }
  const definition = GUARDIANS[guardianId];
  return h(
    "div",
    { class: "gr-prep__slot", testId: `prep-slot-${index}`, dataGuardian: guardianId },
    locked
      ? null
      : h("button", {
          class: "gr-prep__slot-remove",
          testId: `prep-slot-remove-${index}`,
          type: "button",
          "aria-label": `Tirar ${definition.name} do esquadrão`,
          html: ICONS.close,
          onClick: () => {
            squad.splice(index, 1);
            handlers.redraw();
          },
        }),
    h("img", { class: "gr-prep__slot-art", src: guardianPortrait(guardianId), alt: "" }),
    h("span", { class: "gr-prep__slot-name", text: definition.shortName }),
  );
}

/** O quadro completo: quem já foi encontrado entra no esquadrão; o resto mostra a pista ou o preço. */
function roster(
  squad: GuardianId[],
  statuses: Map<GuardianId, { state: string; hidden: boolean; hint: string; price: number | null }>,
  progression: ProgressionService,
  redraw: () => void,
): HTMLElement {
  return h(
    "div",
    { class: "gr-prep__roster", testId: "prep-guardians" },
    ...GUARDIAN_ORDER.map((guardianId) => {
      const definition = GUARDIANS[guardianId];
      const status = statuses.get(guardianId);
      if (!progression.isUnlocked(guardianId)) {
        const hidden = status?.hidden ?? false;
        return h(
          "div",
          { class: "gr-prep__option gr-prep__option--locked", testId: `prep-locked-${guardianId}` },
          h("img", { class: "gr-prep__option-art gr-prep__option-art--locked", src: guardianPortrait(guardianId), alt: "" }),
          h("span", { class: "gr-prep__option-name", text: hidden ? "???" : definition.name }),
          h("span", { class: "gr-hint", text: hidden ? "Ainda não há sinais deste Guardião." : (status?.hint ?? "") }),
          status?.price !== null && status?.price !== undefined
            ? button(
                `${GLOBAL_CURRENCY.symbol} ${status.price}`,
                () => {
                  if (progression.buy(guardianId).ok) redraw();
                },
                { testId: `prep-buy-${guardianId}`, disabled: status.state !== "available" },
              )
            : null,
        );
      }
      const chosen = squad.includes(guardianId);
      return h(
        "button",
        {
          class: `gr-prep__option${chosen ? " gr-prep__option--on" : ""}`,
          testId: `prep-guardian-${guardianId}`,
          type: "button",
          "aria-pressed": String(chosen),
          disabled: !chosen && squad.length >= LOADOUT_SIZE,
          onClick: () => {
            const index = squad.indexOf(guardianId);
            if (index >= 0) squad.splice(index, 1);
            else if (squad.length < LOADOUT_SIZE) squad.push(guardianId);
            redraw();
          },
        },
        h("img", { class: "gr-prep__option-art", src: guardianPortrait(guardianId), alt: "" }),
        h("span", { class: "gr-prep__option-name", text: definition.shortName }),
        h("span", { class: "gr-hint", text: definition.role }),
      );
    }),
  );
}

function bottomBar(actions: PreparationActions, difficulty: () => DifficultyId, squad: readonly GuardianId[]): HTMLElement {
  return h(
    "footer",
    { class: "gr-prep__actions" },
    h(
      "button",
      { class: "gr-button gr-prep__leave", testId: "prep-back", type: "button", onClick: actions.onBack },
      h("span", { class: "gr-icon", html: ICONS.chevronLeft }),
      h("span", { text: "VOLTAR" }),
    ),
    h(
      "button",
      {
        class: "gr-button gr-button--primary gr-prep__go",
        testId: "prep-start",
        type: "button",
        disabled: squad.length !== LOADOUT_SIZE,
        onClick: () => actions.onStart(difficulty(), [...squad]),
      },
      h("span", { class: "gr-icon", html: ICONS.waves }),
      h("span", { text: "PROTEGER O RECIFE" }),
      h("span", { class: "gr-icon", html: ICONS.chevronRight }),
    ),
  );
}
