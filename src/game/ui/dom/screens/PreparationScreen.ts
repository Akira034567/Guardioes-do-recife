import { artPath, GUARDIAN_ART } from "../../../assets/guardianArt";
import { enemyPortraitPath } from "../../../assets/enemyArt";
import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import { objectiveLabel } from "../../../core/progression/objectives";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import type { LevelRecord } from "../../../core/save/PlayerProgress";
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from "../../../data/difficulty";
import { difficultyGates, type DifficultyGate } from "../../../core/progression/difficultyUnlocks";
import { LEVEL_IDS } from "../../../data/levels";
import { enableReorder } from "../reorder";
import { preserveScroll } from "../scroll";
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
  /**
   * Vaga que pediu o seletor (item 5). Quando ela existe, escolher um Guardião preenche AQUELA vaga
   * e fecha o quadro na hora; quando é `null`, o quadro foi aberto pelo botão "Alterar Guardiões" e
   * fica aberto para várias trocas seguidas.
   */
  let rosterSlot: number | null = null;
  const statuses = new Map(progression.unlockStatuses().map((status) => [status.guardianId, status]));
  const record = progression.record(level.id);
  const gates = difficultyGates(progression.progress, LEVEL_IDS);
  // Toda fase abre no Normal (item 4). O que ficou guardado no save não decide mais isto, e uma
  // dificuldade que o jogador ainda não conquistou nunca vem pré-selecionada.
  if (!initial.locked && !(gates.find((gate) => gate.id === difficulty)?.unlocked ?? true)) difficulty = "normal";

  return {
    id: "preparation",
    render() {
      const root = h("div", { class: "gr-prep" });
      const art = levelBackgroundPath(level.backgroundKey);
      if (art) root.append(h("div", { class: "gr-prep__backdrop", style: `background-image:url(${art})` }));

      const layout = h("div", { class: "gr-prep__layout" });
      root.append(layout);

      // A árvore é montada UMA VEZ e só os pedaços que mudam são reescritos (item 6). A coluna da
      // direita rola por dentro: trocar `.gr-prep__side` inteira a cada clique jogava o scroll de
      // volta ao topo e tirava o foco do botão — a queixa era exatamente essa.
      const objectivesBox = h("div", { class: "gr-prep__objectives-host" });
      const difficultyBox = h("div", { class: "gr-prep__block-host" });
      const squadTitle = blockTitle(ICONS.squad, `Selecione seus Guardiões (${squad.length}/${LOADOUT_SIZE})`);
      const squadBox = h("div", { class: "gr-prep__squad", testId: "prep-slots", role: "list" });
      const squadActions = h("div", { class: "gr-prep__squad-actions" });
      const rosterHost = h("div", { class: "gr-prep__roster-host" });
      const squadStatus = h("p", { class: "gr-sr-live", id: "prep-squad-status", "aria-live": "polite" });
      const startButton = startAction(actions, () => difficulty, squad);

      const syncSquad = (): void => {
        squadTitle.replaceChildren(...blockTitleParts(ICONS.squad, `Selecione seus Guardiões (${squad.length}/${LOADOUT_SIZE})`));
        squadBox.replaceChildren(...Array.from({ length: LOADOUT_SIZE }, (_, index) => slot(squad, index, initial.locked ?? false, handlers)));
        startButton.disabled = squad.length !== LOADOUT_SIZE;
        // A ordem escolhida é a ordem das cartas dentro da fase, então vale a pena guardá-la assim
        // que ela muda — e não só no fim da partida, como antes.
        if (!initial.locked) progression.rememberLoadout(squad);
      };

      const syncRoster = (): void => {
        squadActions.replaceChildren(
          initial.locked
            ? h("span", {})
            : h(
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
        );
        rosterHost.replaceChildren(
          initial.locked || !rosterOpen ? h("span", {}) : roster(squad, statuses, progression, rosterSlot, handlers),
        );
      };

      const syncDifficulty = (): void => {
        difficultyBox.replaceChildren(
          initial.locked
            ? lockedDifficulty(difficulty)
            : difficultyPicker(difficulty, gates, (next) => {
                difficulty = next;
                syncDifficulty();
                syncObjectives();
              }),
        );
      };

      const syncObjectives = (): void => {
        objectivesBox.replaceChildren(objectives(level, record, difficulty));
      };

      /**
       * As vagas e o quadro são reescritos juntos, e a coluna da direita rola por dentro. Mesmo
       * trocando só esses pedaços, o navegador reancora a rolagem quando a altura do conteúdo muda
       * — o que fazia a página saltar ao escolher um Guardião. Repor a posição fecha o item 6.
       */
      const syncChoices = (): void =>
        preserveScroll(root, () => {
          syncSquad();
          syncRoster();
        });

      const handlers: SquadHandlers = {
        redraw: syncChoices,
        openRosterFor: (index) => {
          rosterSlot = index;
          rosterOpen = true;
          syncRoster();
          // A coluna rola por dentro: abrir o quadro sem trazê-lo à vista o deixaria fora da tela.
          rosterHost.querySelector(".gr-prep__roster")?.scrollIntoView({ block: "nearest" });
        },
        toggleRoster: () => {
          rosterOpen = !rosterOpen;
          rosterSlot = null;
          syncRoster();
          if (rosterOpen) rosterHost.querySelector(".gr-prep__roster")?.scrollIntoView({ block: "nearest" });
        },
        pick: (guardianId) => {
          const slotIndex = rosterSlot;
          const existing = squad.indexOf(guardianId);
          if (slotIndex !== null) {
            // Escolha dirigida a uma vaga: preenche AQUELA e fecha sozinha (item 5).
            if (existing >= 0) squad.splice(existing, 1);
            const at = Math.min(slotIndex, squad.length);
            squad.splice(at, 0, guardianId);
            squad.length = Math.min(squad.length, LOADOUT_SIZE);
            rosterSlot = null;
            rosterOpen = false;
          } else if (existing >= 0) {
            squad.splice(existing, 1);
          } else if (squad.length < LOADOUT_SIZE) {
            squad.push(guardianId);
          }
          syncChoices();
        },
        announce: (message) => {
          squadStatus.textContent = message;
        },
      };

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
            objectivesBox,
            ...bossCards(level, progression),
          ),
          h(
            "aside",
            { class: "gr-prep__side" },
            difficultyBox,
            knownThreats(level, progression),
            h("section", { class: "gr-prep__block" }, squadTitle, squadBox, squadStatus, squadActions, rosterHost),
          ),
        ),
        bottomBar(actions, startButton),
      );

      syncDifficulty();
      syncObjectives();
      syncSquad();
      syncRoster();

      if (!initial.locked) {
        enableReorder({
          container: squadBox,
          columns: LOADOUT_SIZE,
          itemSelector: ".gr-prep__slot",
          ignoreSelector: ".gr-prep__slot-remove",
          draggable: (item) => Boolean(item.dataset.guardian),
          onReorder: (from, to) => {
            const destination = Math.min(to, squad.length - 1);
            const [moved] = squad.splice(from, 1);
            if (!moved) return;
            squad.splice(destination, 0, moved);
            syncChoices();
            handlers.announce(`${GUARDIANS[moved].name} movido para a vaga ${destination + 1} de ${LOADOUT_SIZE}.`);
          },
        });
      }

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

function blockTitleParts(icon: string, text: string): HTMLElement[] {
  return [h("span", { class: "gr-icon", html: icon }), h("span", { text })];
}

function blockTitle(icon: string, text: string): HTMLElement {
  return h("h2", { class: "gr-prep__block-title" }, ...blockTitleParts(icon, text));
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

/**
 * Dificuldade (item 4). As três aparecem sempre; as que ainda não foram conquistadas ficam visíveis,
 * apagadas e com o requisito escrito.
 *
 * A bloqueada NÃO usa `disabled`: um botão desabilitado não recebe foco nem mostra o `title` de
 * forma confiável, e o jogador precisa conseguir ler POR QUE não pode escolher. Ela vira
 * `aria-disabled` com o requisito no lugar da chamada.
 */
function difficultyPicker(current: DifficultyId, gates: readonly DifficultyGate[], onPick: (id: DifficultyId) => void): HTMLElement {
  const message = h("p", { class: "gr-hint gr-prep__choice-requirement", testId: "prep-difficulty-requirement", "aria-live": "polite" });
  return h(
    "section",
    { class: "gr-prep__block" },
    blockTitle(ICONS.trident, "Dificuldade"),
    h(
      "div",
      { class: "gr-prep__choices", testId: "prep-difficulty", dataValue: current },
      ...DIFFICULTY_IDS.map((id) => {
        const definition = DIFFICULTIES[id];
        const gate = gates.find((entry) => entry.id === id);
        const locked = !(gate?.unlocked ?? true);
        const chosen = id === current && !locked;
        return h(
          "button",
          {
            class: `gr-prep__choice${chosen ? " gr-prep__choice--on" : ""}`,
            testId: `prep-difficulty-${id}`,
            type: "button",
            style: `--gr-accent:${definition.accent}`,
            "aria-pressed": String(chosen),
            "aria-disabled": String(locked),
            dataState: locked ? "locked" : "open",
            dataLocked: String(locked),
            title: locked ? (gate?.requirement ?? "") : definition.description,
            onClick: () => {
              if (locked) {
                message.textContent = gate?.requirement ?? "";
                return;
              }
              message.textContent = "";
              onPick(id);
            },
          },
          locked ? h("span", { class: "gr-icon gr-prep__choice-lock", html: ICONS.lock ?? ICONS.close }) : null,
          h("span", { class: "gr-prep__choice-name", text: definition.name.toUpperCase() }),
          h("span", { class: "gr-icon gr-icon--lg", html: ICONS.difficulty(difficultyWaves(id), definition.accent) }),
          h("span", { class: "gr-prep__choice-pitch", text: locked ? (gate?.requirement ?? "") : definition.pitch }),
        );
      }),
    ),
    message,
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
  /** Abre o quadro ligado a uma vaga: escolher fecha sozinho (item 5). */
  openRosterFor: (index: number) => void;
  /** Abre ou fecha o quadro livre, pelo botão "Alterar Guardiões": escolher NÃO fecha. */
  toggleRoster: () => void;
  pick: (guardianId: GuardianId) => void;
  announce: (message: string) => void;
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
        role: "listitem",
        type: "button",
        disabled: locked,
        // Vaga vazia abre o quadro LIGADO A ELA: escolher preenche esta vaga e fecha (item 5).
        onClick: () => handlers.openRosterFor(index),
      },
      h("span", { class: "gr-icon gr-icon--lg", html: ICONS.plus }),
      h("span", { class: "gr-prep__slot-name", text: `Vaga ${index + 1}` }),
    );
  }
  const definition = GUARDIANS[guardianId];
  // Vaga cheia NÃO pode ser um `<button>`: o `×` é um botão de verdade e botão dentro de botão é
  // HTML inválido. Um item de lista focável dá o mesmo comportamento sem a armadilha.
  return h(
    "div",
    {
      class: "gr-prep__slot",
      testId: `prep-slot-${index}`,
      dataGuardian: guardianId,
      dataDraggable: String(!locked),
      role: "listitem",
      tabindex: locked ? "-1" : "0",
      "aria-label": `Vaga ${index + 1}: ${definition.name}`,
      onClick: (event: Event) => {
        if (locked) return;
        if ((event.target as HTMLElement).closest(".gr-prep__slot-remove")) return;
        handlers.openRosterFor(index);
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (locked) return;
        // Setas reordenam sem precisar de arrasto: o mesmo resultado, pelo teclado (item 7).
        const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (direction !== 0) {
          const to = Math.max(0, Math.min(squad.length - 1, index + direction));
          if (to === index) return;
          event.preventDefault();
          const [moved] = squad.splice(index, 1);
          squad.splice(to, 0, moved);
          handlers.redraw();
          handlers.announce(`${GUARDIANS[moved].name} movido para a vaga ${to + 1} de ${LOADOUT_SIZE}.`);
          (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(".gr-prep__slot")[to]?.focus();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlers.openRosterFor(index);
        }
      },
    },
    locked
      ? null
      : h("button", {
          class: "gr-prep__slot-remove",
          testId: `prep-slot-remove-${index}`,
          type: "button",
          "aria-label": `Tirar ${definition.name} do esquadrão`,
          html: ICONS.close,
          onClick: (event: Event) => {
            event.stopPropagation();
            squad.splice(index, 1);
            handlers.redraw();
          },
        }),
    // `draggable=false`: senão a imagem inicia o arrasto nativo e cancela o nosso (item 7).
    h("img", { class: "gr-prep__slot-art", src: guardianPortrait(guardianId), alt: "", draggable: "false" }),
    h("span", { class: "gr-prep__slot-name", text: definition.shortName }),
  );
}

/** O quadro completo: quem já foi encontrado entra no esquadrão; o resto mostra a pista ou o preço. */
function roster(
  squad: GuardianId[],
  statuses: Map<GuardianId, { state: string; hidden: boolean; hint: string; price: number | null }>,
  progression: ProgressionService,
  forSlot: number | null,
  handlers: SquadHandlers,
): HTMLElement {
  const redraw = handlers.redraw;
  return h(
    "div",
    { class: "gr-prep__roster", testId: "prep-guardians", dataSlot: forSlot === null ? "" : String(forSlot) },
    forSlot === null
      ? null
      : h("p", { class: "gr-hint gr-prep__roster-title", text: `Escolha o Guardião da Vaga ${forSlot + 1}.` }),
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
          // Escolhendo PARA uma vaga, trocar sempre é possível; no quadro livre, o esquadrão cheio
          // só aceita tirar quem já está nele.
          disabled: forSlot === null && !chosen && squad.length >= LOADOUT_SIZE,
          onClick: () => handlers.pick(guardianId),
        },
        h("img", { class: "gr-prep__option-art", src: guardianPortrait(guardianId), alt: "" }),
        h("span", { class: "gr-prep__option-name", text: definition.shortName }),
        h("span", { class: "gr-hint", text: definition.role }),
      );
    }),
  );
}

/** O botão de começar é guardado à parte: só o `disabled` dele muda a cada escolha de Guardião. */
function startAction(actions: PreparationActions, difficulty: () => DifficultyId, squad: readonly GuardianId[]): HTMLButtonElement {
  return h(
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
  ) as HTMLButtonElement;
}

function bottomBar(actions: PreparationActions, start: HTMLButtonElement): HTMLElement {
  return h(
    "footer",
    { class: "gr-prep__actions" },
    h(
      "button",
      { class: "gr-button gr-prep__leave", testId: "prep-back", type: "button", onClick: actions.onBack },
      h("span", { class: "gr-icon", html: ICONS.chevronLeft }),
      h("span", { text: "VOLTAR" }),
    ),
    start,
  );
}
