import { enemyPortraitPath } from "../../../assets/enemyArt";
import type { ProgressionService } from "../../../core/progression/ProgressionService";
import { ENEMIES, ENEMY_ORDER, resolveEnemy } from "../../../data/enemies";
import { ENEMY_LORE } from "../../../data/enemyLore";
import { LEVELS } from "../../../data/levels";
import type { EnemyDefinition, EnemyId, EnemyShapeKey } from "../../../types";
import { button, h } from "../h";
import type { Screen, ScreenHost } from "../ScreenHost";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** Onde a ameaça aparece pela primeira vez, para a linha "visto em". */
function firstLevelName(enemyId: EnemyId): string {
  const level = LEVELS.find((candidate) => candidate.waves.some((wave) => wave.groups.some((group) => group.enemyId === enemyId)));
  return level?.name ?? "—";
}

/**
 * Ameaças do Recife (item 5): o bestiário. Inimigo nunca visto fica em "???"; depois do primeiro
 * encontro abre a página com números, comportamento, fraquezas e resistências.
 */
export function bestiaryScreen(progression: ProgressionService, onBack: () => void): Screen {
  return {
    id: "bestiary",
    render(host: ScreenHost) {
      const discovery = progression.progress.enemyDiscovery;
      const known = ENEMY_ORDER.filter((id) => discovery[id]).length;
      return h(
        "div",
        {},
        h(
          "div",
          { class: "gr-panel", testId: "bestiary-panel", dataKnown: String(known) },
          h("span", { class: "gr-badge", text: `${known} de ${ENEMY_ORDER.length} catalogadas` }),
          h("h1", { class: "gr-title", text: "AMEAÇAS DO RECIFE" }),
          h("p", { class: "gr-subtitle", text: "Cada invasor é catalogado no primeiro encontro." }),
          h(
            "div",
            { class: "gr-album" },
            ...ENEMY_ORDER.map((enemyId) => {
              const seen = Boolean(discovery[enemyId]);
              return enemyCard(ENEMIES[enemyId], seen, discovery[enemyId]?.kills ?? 0, () => {
                if (seen) host.push(enemyPage(ENEMIES[enemyId], discovery[enemyId]?.kills ?? 0, () => host.pop()));
              });
            }),
          ),
          h("div", { class: "gr-actions" }, button("VOLTAR", onBack, { testId: "bestiary-back" })),
        ),
      );
    },
  };
}

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
    style: `width:${Math.round(size * 1.1)}px`,
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
    style: `width:${width}px`,
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
  boss: (fill, line) =>
    `<ellipse cx="58" cy="40" rx="40" ry="24" fill="${fill}"/><path d="M50 16 L66 2 L74 20 Z" fill="${line}"/><path d="M96 40 L120 18 L120 62 Z" fill="${line}" opacity=".9"/><path d="M22 34 q16 -10 32 -2" stroke="${line}" stroke-width="3" fill="none" opacity=".7"/><circle cx="38" cy="34" r="5" fill="#02202e"/>`,
};

function enemyCard(definition: EnemyDefinition, seen: boolean, kills: number, onOpen: () => void): HTMLElement {
  return h(
    "button",
    {
      class: `gr-card ${seen ? "gr-card--found" : "gr-card--locked"}`,
      testId: `bestiary-card-${definition.id}`,
      dataState: seen ? "seen" : "unknown",
      type: "button",
      disabled: !seen,
      onClick: onOpen,
    },
    portrait(definition, seen),
    h("span", { class: "gr-card__name", text: seen ? definition.name : "???" }),
    h("span", { class: "gr-hint", text: seen ? `${kills} derrotados` : "Ainda não encontrado" }),
  );
}

/** Página da ameaça. Chefes ganham destaque e a lista de habilidades. */
export function enemyPage(definition: EnemyDefinition, kills: number, onBack: () => void): Screen {
  const resolved = resolveEnemy(definition);
  const lore = ENEMY_LORE[definition.id];
  return {
    id: "enemy-page",
    render() {
      return h(
        "div",
        {},
        h(
          "div",
          { class: `gr-panel ${definition.isBoss ? "gr-panel--boss" : ""}`, testId: "enemy-page", dataEnemy: definition.id },
          definition.isBoss ? h("span", { class: "gr-badge gr-badge--boss", text: "chefe" }) : h("span", { class: "gr-badge", text: resolved.tags.join(" · ").toLowerCase() }),
          h(
            "div",
            { class: "gr-reveal" },
            h("div", { class: "gr-reveal__art gr-reveal__art--blob" }, portrait(definition, true, 180)),
            h(
              "div",
              { class: "gr-reveal__body" },
              h("h1", { class: "gr-title", text: definition.name }),
              h("p", { class: "gr-subtitle", text: `Visto em ${firstLevelName(definition.id)} · ${kills} derrotados` }),
              h("p", { text: resolved.description || lore.description }),
              h("p", { class: "gr-hint", text: lore.trait }),
            ),
          ),
          h(
            "div",
            { class: "gr-grid" },
            stat("Vida", String(definition.maxHealth)),
            stat("Velocidade", String(definition.speed)),
            stat("Armadura", String(definition.armor)),
            stat("Dano ao Recife", String(definition.reefDamage)),
            stat("Pérolas", `◉ ${definition.reward}`),
            stat("Ameaça", "▲".repeat(Math.max(1, resolved.threatLevel + 1))),
          ),
          h(
            "div",
            { class: "gr-columns" },
            listBox("FRAQUEZAS", lore.weaknesses, "gr-list--good"),
            listBox("RESISTÊNCIAS", lore.resistances.length > 0 ? lore.resistances : ["Nenhuma conhecida"], "gr-list--bad"),
          ),
          resolved.abilities.length > 0
            ? h(
                "div",
                { class: "gr-reward", testId: "enemy-abilities" },
                ...resolved.abilities.map((ability) => h("div", { class: "gr-reward__line" }, h("span", { text: abilityLabel(ability.type) }))),
              )
            : null,
          h("div", { class: "gr-actions" }, button("VOLTAR", onBack, { testId: "enemy-back" })),
        ),
      );
    },
  };
}

function stat(label: string, value: string): HTMLElement {
  return h("div", { class: "gr-stat" }, h("span", { class: "gr-stat__label", text: label }), h("span", { class: "gr-stat__value", text: value }));
}

function listBox(title: string, items: string[], variant: string): HTMLElement {
  return h(
    "div",
    { class: "gr-stat" },
    h("span", { class: "gr-stat__label", text: title }),
    h("ul", { class: `gr-list ${variant}` }, ...items.map((item) => h("li", { text: item }))),
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
    reverseCurrents: "Inverte a correnteza do Recife",
  };
  return labels[type] ?? type;
}
