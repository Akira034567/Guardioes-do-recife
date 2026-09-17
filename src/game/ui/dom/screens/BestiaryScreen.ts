import { enemyPortraitPath } from "../../../assets/enemyArt";
import { levelBackgroundPath } from "../../../assets/levelBackgrounds";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import { ENEMIES, ENEMY_ORDER, resolveEnemy } from "../../../data/enemies";
import { ENEMY_LORE } from "../../../data/enemyLore";
import { LEVELS } from "../../../data/levels";
import type { EnemyDefinition, EnemyId, EnemyRole, EnemyShapeKey } from "../../../types";
import { fill, h } from "../h";
import { preserveScroll } from "../scroll";
import { ICONS } from "../icons";
import type { Screen } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** Onde a ameaça aparece pela primeira vez, para a linha "visto em". */
function firstLevelName(enemyId: EnemyId): string {
  const level = LEVELS.find((candidate) => candidate.waves.some((wave) => wave.groups.some((group) => group.enemyId === enemyId)));
  return level?.name ?? "—";
}

/** Etiqueta curta que a carta mostra embaixo do nome. */
const ROLE_LABELS: Record<EnemyRole, string> = {
  swarm: "Cardume",
  common: "Comum",
  fast: "Veloz",
  armored: "Tanque",
  elite: "Elite",
  boss: "Chefe",
};

type BestiaryFilter = "all" | "common" | "elite" | "boss" | "unknown";

const FILTERS: ReadonlyArray<{ id: BestiaryFilter; label: string; icon: string }> = [
  { id: "all", label: "Todos", icon: ICONS.spiky },
  { id: "common", label: "Comuns", icon: ICONS.fish },
  { id: "elite", label: "Elites", icon: ICONS.skull },
  { id: "boss", label: "Chefes", icon: ICONS.trophy },
  { id: "unknown", label: "Não encontrados", icon: ICONS.lock },
];

function matchesFilter(definition: EnemyDefinition, filter: BestiaryFilter, seen: boolean): boolean {
  switch (filter) {
    case "all":
      return true;
    case "elite":
      return definition.role === "elite";
    case "boss":
      return definition.role === "boss";
    case "unknown":
      return !seen;
    case "common":
      return definition.role !== "elite" && definition.role !== "boss";
  }
}

/**
 * Ameaças do Recife (item 5): o bestiário. Inimigo nunca visto fica em "???"; depois do primeiro
 * encontro a ficha ao lado abre com números, comportamento, fraquezas e resistências — sem trocar de
 * tela, como no álbum.
 */
/** `embedded`: o AppShell já desenha a coluna e o fundo, então a tela entrega só o conteúdo (item 2). */
export function bestiaryScreen(progression: ProgressionService, onBack: () => void, nav?: ShellNav, embedded = false): Screen {
  let filter: BestiaryFilter = "all";
  let chosen: EnemyId | null = null;

  return {
    id: "bestiary",
    render() {
      const root = h("div", { class: `${"gr-album gr-album--bestiary"}${embedded ? " gr-album--embedded" : ""}`, testId: "bestiary-panel" });
      const art = levelBackgroundPath(LEVELS[3].backgroundKey);
      if (art && !embedded) root.append(h("div", { class: "gr-world__backdrop", style: `background-image:url(${art})` }));
      const layout = h("div", { class: "gr-album__layout" });
      root.append(layout);

      const redraw = (): void => {
        const discovery = progression.progress.enemyDiscovery;
        const seenOf = (enemyId: EnemyId): boolean => Boolean(discovery[enemyId]);
        const known = ENEMY_ORDER.filter(seenOf).length;
        const listed = ENEMY_ORDER.filter((enemyId) => matchesFilter(ENEMIES[enemyId], filter, seenOf(enemyId)));
        const current = (chosen && listed.includes(chosen) ? chosen : listed.find(seenOf)) ?? null;

        fill(layout, 
          embedded ? null : shellSidebar("bestiary", nav ?? fallbackNav(onBack), {
            navId: (section) => `bestiary-nav-${section}`,
            back: onBack,
            backId: "bestiary-back",
            motto: "O Recife lembra, observa e se prepara.",
          }),
          h(
            "div",
            { class: "gr-album__main" },
            header(known),
            filters(filter, known, (next) => {
              filter = next;
              chosen = null;
              draw();
            }),
            h(
              "div",
              { class: "gr-album__body" },
              h(
                "div",
                { class: "gr-album__grid gr-album__grid--wide", testId: "bestiary-grid" },
                ...listed.map((enemyId) =>
                  enemyCard(ENEMIES[enemyId], seenOf(enemyId), discovery[enemyId]?.kills ?? 0, current === enemyId, () => {
                    chosen = enemyId;
                    draw();
                  }),
                ),
              ),
              current ? enemyPanel(ENEMIES[current], discovery[current]?.kills ?? 0) : emptyPanel(),
            ),
            h("p", { class: "gr-album__foot", text: "Toda ameaça catalogada é uma defesa a mais." }),
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

/** Sem a navegação da moldura, todo item do menu só volta para a tela anterior. */
function fallbackNav(onBack: () => void): ShellNav {
  return {
    onGoHub: onBack,
    onGoMap: onBack,
    onOpenSchool: onBack,
    onOpenCollection: onBack,
    onOpenMastery: onBack,
    onOpenBestiary: () => {},
    onOpenStories: onBack,
    onOpenAchievements: onBack,
    onOpenAccount: onBack,
    onOpenSettings: onBack,
  };
}

function header(known: number): HTMLElement {
  const ratio = Math.round((known / Math.max(1, ENEMY_ORDER.length)) * 100);
  return h(
    "header",
    { class: "gr-album__top" },
    h(
      "div",
      { class: "gr-album__titles" },
      h("h1", { class: "gr-album__title", text: "AMEAÇAS DO RECIFE" }),
      h("p", { class: "gr-subtitle", text: "Conheça os inimigos que ameaçam nosso lar. Quanto mais você enfrenta, mais informações são descobertas." }),
    ),
    h(
      "div",
      { class: "gr-album__score", testId: "bestiary-progress", dataKnown: String(known) },
      h("span", { class: "gr-icon gr-icon--lg", html: ICONS.spiky }),
      h(
        "span",
        { class: "gr-album__score-copy" },
        h("span", { class: "gr-stat__label", text: "Inimigos descobertos" }),
        h("span", { class: "gr-album__score-value", text: `${known} de ${ENEMY_ORDER.length}` }),
        h("span", { class: "gr-progress__track" }, h("span", { class: "gr-progress__fill", style: `width:${ratio}%` })),
      ),
    ),
    h("p", { class: "gr-album__quote", text: "“Conhecer é o primeiro passo para proteger.”" }),
  );
}

function filters(current: BestiaryFilter, known: number, onPick: (filter: BestiaryFilter) => void): HTMLElement {
  return h(
    "nav",
    { class: "gr-album__tabs", testId: "bestiary-filters", dataValue: current },
    ...FILTERS.map((entry) =>
      h(
        "button",
        {
          class: `gr-album__tab${entry.id === current ? " gr-album__tab--on" : ""}`,
          testId: `bestiary-filter-${entry.id}`,
          type: "button",
          "aria-pressed": String(entry.id === current),
          onClick: () => onPick(entry.id),
        },
        h("span", { class: "gr-icon gr-icon--lg", html: entry.icon }),
        h("span", { text: entry.id === "all" ? `TODOS (${known}/${ENEMY_ORDER.length})` : entry.label.toUpperCase() }),
      ),
    ),
  );
}

function enemyCard(definition: EnemyDefinition, seen: boolean, kills: number, chosen: boolean, onOpen: () => void): HTMLElement {
  return h(
    "button",
    {
      class: `gr-album__card${chosen ? " gr-album__card--on" : ""}${seen ? "" : " gr-album__card--locked"}`,
      testId: `bestiary-card-${definition.id}`,
      dataState: seen ? "seen" : "unknown",
      type: "button",
      disabled: !seen,
      onClick: onOpen,
    },
    h("span", { class: "gr-album__card-art" }, portrait(definition, seen, 78)),
    h("span", { class: "gr-album__card-name", text: seen ? definition.name : "???" }),
    seen
      ? h("span", { class: `gr-album__tagchip gr-album__tagchip--${definition.role}`, text: ROLE_LABELS[definition.role].toUpperCase() })
      : h("span", { class: "gr-hint", text: "Ainda não encontrado." }),
    seen ? h("span", { class: "gr-album__card-kills", text: `${kills} derrotados` }) : null,
  );
}

function emptyPanel(): HTMLElement {
  return h(
    "section",
    { class: "gr-album__sheet gr-album__sheet--empty" },
    h("span", { class: "gr-icon gr-album__banner-icon", html: ICONS.spiky }),
    h("p", { class: "gr-hint", text: "Enfrente as marés para catalogar o que vem nelas." }),
  );
}

// ------------------------------------------------------------------------------- ficha da ameaça

/** Escalas qualitativas: o número cru diz pouco; "vida baixa" diz o que fazer. */
function healthLabel(value: number): string {
  if (value <= 40) return "Baixa";
  if (value <= 120) return "Média";
  return value <= 300 ? "Alta" : "Altíssima";
}

function speedLabel(value: number): string {
  if (value <= 45) return "Lenta";
  if (value <= 80) return "Média";
  return value <= 110 ? "Rápida" : "Altíssima";
}

function armorLabel(value: number): string {
  if (value <= 0) return "Nenhuma";
  return value <= 2 ? "Leve" : value <= 4 ? "Média" : "Pesada";
}

function enemyPanel(definition: EnemyDefinition, kills: number): HTMLElement {
  const resolved = resolveEnemy(definition);
  const lore = ENEMY_LORE[definition.id];
  return h(
    "section",
    {
      class: `gr-album__sheet${definition.isBoss ? " gr-album__sheet--boss" : ""}`,
      testId: "enemy-page",
      dataEnemy: definition.id,
    },
    h(
      "div",
      { class: "gr-album__sheet-head" },
      h("span", { class: `gr-album__tagchip gr-album__tagchip--${definition.role}`, text: ROLE_LABELS[definition.role].toUpperCase() }),
      h("h2", { class: "gr-album__sheet-name", text: definition.name }),
      h("p", { class: "gr-subtitle", text: lore.trait }),
    ),
    h("div", { class: "gr-album__banner" }, portrait(definition, true, 150)),
    h("p", { class: "gr-album__sheet-line", text: resolved.description || lore.description }),
    h(
      "div",
      { class: "gr-album__duo" },
      h(
        "div",
        { class: "gr-album__rows" },
        row(ICONS.heart, "Vida", `${healthLabel(definition.maxHealth)} · ${definition.maxHealth}`),
        row(ICONS.waves, "Velocidade", `${speedLabel(definition.speed)} · ${definition.speed}`),
        row(ICONS.trident, "Armadura", armorLabel(definition.armor)),
        row(ICONS.pearl, "Recompensa", `${definition.reward} ${definition.reward === 1 ? "pérola" : "pérolas"}`),
        row(ICONS.skull, "Dano ao Recife", String(definition.reefDamage)),
      ),
      h(
        "div",
        { class: "gr-album__rows" },
        h("span", { class: "gr-album__section-title", text: "Resistências" }),
        row(ICONS.skull, "Nível de ameaça", THREAT_LABELS[Math.min(3, resolved.threatLevel)]),
        ...(resistanceLines(definition).length > 0
          ? resistanceLines(definition).map((line) => row(ICONS.shell, line.label, line.value))
          : [row(ICONS.shell, "Nenhuma conhecida", "—")]),
        ...(resolved.abilities.length > 0
          ? [h("span", { class: "gr-album__section-title", text: "Em campo" }), ...resolved.abilities.map((ability) => h("p", { class: "gr-album__ability", text: abilityLabel(ability.type) }))]
          : []),
      ),
    ),
    h(
      "div",
      { class: "gr-album__kills", testId: "enemy-kills" },
      h("span", { class: "gr-album__kills-art" }, portrait(definition, true, 44)),
      h(
        "span",
        { class: "gr-album__career-text" },
        h("span", { class: "gr-stat__label", text: "Derrotados por você" }),
        h("span", { class: "gr-album__career-value", text: String(kills) }),
      ),
      h("span", { class: "gr-hint", text: `Visto em ${firstLevelName(definition.id)}` }),
    ),
    h(
      "div",
      { class: "gr-album__tip", testId: "enemy-tip" },
      h("span", { class: "gr-icon gr-icon--lg", html: ICONS.star }),
      h(
        "span",
        { class: "gr-album__tip-copy" },
        h("span", { class: "gr-album__section-title", text: "Dica" }),
        h("span", { text: `${lore.weaknesses.join(" e ")} ${lore.weaknesses.length > 1 ? "funcionam" : "funciona"} bem contra ele.` }),
      ),
    ),
  );
}

/** Resistências vindas dos números do inimigo, não de texto solto. */
function resistanceLines(definition: EnemyDefinition): Array<{ label: string; value: string }> {
  const resolved = resolveEnemy(definition);
  const lines: Array<{ label: string; value: string }> = [];
  if (definition.unblockable) lines.push({ label: "Bloqueio", value: "Imune" });
  for (const [status, amount] of Object.entries(resolved.resistances)) {
    if (typeof amount !== "number" || amount <= 0) continue;
    lines.push({ label: STATUS_LABELS[status] ?? status, value: `${Math.round(amount * 100)}%` });
  }
  for (const status of resolved.immunities) lines.push({ label: STATUS_LABELS[status] ?? status, value: "Imune" });
  if (definition.armor > 0) lines.push({ label: "Golpes fracos", value: `−${definition.armor} por acerto` });
  return lines;
}

/** `threatLevel` (0 comum · 1 blindado · 2 elite · 3 chefe) em uma palavra. */
const THREAT_LABELS = ["Baixo", "Médio", "Alto", "Chefe"] as const;

const STATUS_LABELS: Record<string, string> = {
  slow: "Lentidão",
  stun: "Atordoamento",
  poison: "Veneno",
  vulnerability: "Vulnerabilidade",
  burn: "Queimadura",
};

function row(icon: string, label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "gr-album__row" },
    h("span", { class: "gr-icon", html: icon }),
    h("span", { class: "gr-album__row-label", text: label }),
    h("span", { class: "gr-album__row-value", text: value }),
  );
}

/** Nome legível de cada habilidade de inimigo (item 5). */
function abilityLabel(type: string): string {
  const labels: Record<string, string> = {
    regen: "Regenera vida com o tempo",
    enrageBelowHp: "Enfurece quando está ferido",
    shieldAllies: "Protege os aliados por perto",
    disruptGuardians: "Atrapalha os Guardiões próximos",
    stealth: "Some da mira até ser revelado",
    splitOnDeath: "Se divide ao morrer",
    phaseChangeAtHp: "Muda de fase conforme perde vida",
    speedBurst: "Dispara em arrancadas",
    amplifyCurrents: "Amplifica a correnteza natural do Recife",
  };
  return labels[type] ?? type;
}

// ------------------------------------------------------------------------------- arte

/**
 * Retrato do inimigo. Quando a espécie tem arte (`public/assets/enemies/`), é a própria imagem, em
 * silhueta enquanto não foi encontrada. Sem arte, cai no desenho vetorial abaixo.
 */
function portrait(definition: EnemyDefinition, seen: boolean, size = 92): HTMLElement {
  const path = enemyPortraitPath(definition);
  if (!path) return blob(definition, seen, size);
  return h("img", {
    class: `gr-enemy-art ${seen ? "" : "gr-node__art--unknown"}`,
    src: path,
    alt: seen ? definition.name : "",
    style: `width:calc(${Math.round(size * 1.1)}px * var(--gr-scale))`,
  });
}

/**
 * Silhueta vetorial do inimigo, para quem ainda não tem arte própria: cada forma de `EnemyShapeKey`
 * vira um SVG simples com as cores da espécie.
 */
function blob(definition: EnemyDefinition, seen: boolean, size = 92): HTMLElement {
  const shape = resolveEnemy(definition).art;
  const key = shape.kind === "procedural" ? shape.shape : (shape.shapeFallback ?? "fish");
  const fill = seen ? `url(#${gradientId(definition)})` : "#0b3346";
  const line = seen ? hex(definition.accent) : "#14465c";
  const width = Math.round(size * Math.min(1.35, 0.8 + definition.scale * 0.3));
  return h("div", {
    class: "gr-blob",
    style: `width:calc(${width}px * var(--gr-scale))`,
    html: `<svg viewBox="0 0 120 76" width="100%" role="img" aria-hidden="true">
      <defs><radialGradient id="${gradientId(definition)}" cx="35%" cy="32%">
        <stop offset="0%" stop-color="${hex(definition.accent)}"/><stop offset="100%" stop-color="${hex(definition.color)}"/>
      </radialGradient></defs>
      ${SHAPE_PATHS[key](fill, line)}
    </svg>`,
  });
}

function gradientId(definition: EnemyDefinition): string {
  return `gr-enemy-${definition.id}`;
}

/** Um desenho por forma: corpo, cauda e um detalhe que dá a leitura da ameaça. */
const SHAPE_PATHS: Record<EnemyShapeKey, (fill: string, line: string) => string> = {
  minnow: (fill, line) =>
    `<ellipse cx="52" cy="38" rx="26" ry="14" fill="${fill}"/><path d="M76 38 L104 24 L104 52 Z" fill="${line}" opacity=".85"/><circle cx="38" cy="33" r="3" fill="#02202e"/>`,
  fish: (fill, line) =>
    `<ellipse cx="54" cy="38" rx="32" ry="19" fill="${fill}"/><path d="M84 38 L112 20 L112 56 Z" fill="${line}" opacity=".85"/><path d="M52 19 L66 8 L70 22 Z" fill="${line}" opacity=".6"/><circle cx="36" cy="32" r="4" fill="#02202e"/>`,
  dart: (fill, line) =>
    `<path d="M16 38 L78 22 L96 38 L78 54 Z" fill="${fill}"/><path d="M96 38 L116 26 L116 50 Z" fill="${line}" opacity=".85"/><circle cx="34" cy="36" r="3" fill="#02202e"/>`,
  needle: (fill, line) =>
    `<path d="M10 38 L86 28 L86 48 Z" fill="${fill}"/><path d="M86 38 L114 28 L114 48 Z" fill="${line}" opacity=".85"/><circle cx="30" cy="37" r="2.6" fill="#02202e"/>`,
  shell: (fill, line) =>
    `<ellipse cx="56" cy="42" rx="34" ry="18" fill="${fill}"/><path d="M24 42 a32 26 0 0 1 64 0 Z" fill="${line}" opacity=".55"/><path d="M88 42 L112 30 L112 54 Z" fill="${line}" opacity=".8"/><circle cx="36" cy="40" r="3.4" fill="#02202e"/>`,
  moray: (fill, line) =>
    `<path d="M12 46 q26 -30 52 -12 q22 16 48 4 v16 q-28 14 -52 -2 q-22 -14 -48 8 Z" fill="${fill}"/><path d="M108 38 L118 30 L118 50 Z" fill="${line}" opacity=".8"/><circle cx="26" cy="42" r="3" fill="#02202e"/>`,
  shark: (fill, line) =>
    `<path d="M14 44 L40 28 q28 -14 58 6 q10 6 12 8 q-14 10 -28 12 q-30 6 -42 -4 Z" fill="${fill}"/><path d="M14 44 L2 28 L4 58 Z" fill="${line}" opacity=".85"/><path d="M52 24 L62 6 L74 26 Z" fill="${line}" opacity=".75"/><path d="M74 54 L84 68 L92 52 Z" fill="${line}" opacity=".6"/><path d="M84 42 q8 6 16 6" stroke="#02202e" stroke-width="3" fill="none" opacity=".8"/><circle cx="86" cy="34" r="3.4" fill="#02202e"/>`,
  boss: (fill, line) =>
    `<ellipse cx="58" cy="40" rx="40" ry="24" fill="${fill}"/><path d="M50 16 L66 2 L74 20 Z" fill="${line}"/><path d="M96 40 L120 18 L120 62 Z" fill="${line}" opacity=".9"/><path d="M22 34 q16 -10 32 -2" stroke="${line}" stroke-width="3" fill="none" opacity=".7"/><circle cx="38" cy="34" r="5" fill="#02202e"/>`,
};
