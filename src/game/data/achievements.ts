import { DIFFICULTY_GATE_LEVEL_IDS } from "./levels";

/**
 * Conquistas (item 37). Cada uma é só dado: um jeito de medir, uma meta e as Conchas que paga.
 * A avaliação é pura (`core/progression/achievements.ts`) e roda no fim de cada partida.
 */

/**
 * As conquistas de "campanha inteira" medem o Recife Costeiro — é o que as descrições prometem, e
 * contar os Canais Profundos (v4) tiraria de volta a meta de quem já a tinha cumprido.
 */
const CAMPAIGN_LEVELS = DIFFICULTY_GATE_LEVEL_IDS.length;

/**
 * Teto de vidas perdidas do "Sopro de vida". Um único número, num lugar só: se a façanha ficar dura
 * demais (ou fácil demais) é aqui que ela se mexe, e a descrição na tela acompanha.
 */
const MAX_LIVES_LOST_FOR_SECRET = 1;
export type AchievementMeasure =
  /** Totais do perfil. */
  | { type: "totalKills" }
  | { type: "totalVictories" }
  | { type: "wavesCleared" }
  | { type: "playTimeMinutes" }
  /** Coleções. */
  | { type: "levelsCompleted" }
  | { type: "starsTotal" }
  | { type: "perfectLevels" }
  | { type: "guardiansFound" }
  | { type: "encountersCompleted" }
  | { type: "secretsFound" }
  | { type: "enemiesCatalogued" }
  | { type: "storiesRead" }
  /** Melhor marca de uma única partida. */
  | { type: "bestInMatch"; stat: "enemiesKilled" | "pearlsEarned" | "upgradesBought" | "maxSimultaneousGuardians" }
  /** Contagem de partidas que satisfizeram uma condição. */
  | { type: "matchesWith"; condition: "noLeaks" | "hardDifficulty" | "soloGuardian" }
  /**
   * Fases da campanha cuja MELHOR vitória respeita um teto. É o que sustenta as conquistas de
   * campanha inteira ("todas as fases com no máximo X"): cada fase entra na conta uma vez, e o
   * recorde de uma partida antiga continua valendo.
   */
  | { type: "campaignBest"; stat: "livesLost" | "distinctGuardians"; max: number }
  /**
   * Fases concluídas ENQUANTO o jogador nunca reiniciou nenhuma. Um único recomeço na vida zera a
   * medida — e como o progresso de conquista nunca regride, o que já foi contado fica congelado
   * abaixo da meta para sempre. É exatamente o que "sem reiniciar nenhuma vez" quer dizer.
   */
  | { type: "campaignWithoutRestart" };

/** Prateleira da conquista na tela de Conquistas. Só organiza a lista; não muda regra nenhuma. */
export type AchievementCategory = "exploracao" | "combate" | "guardioes" | "colecao" | "especiais";

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  measure: AchievementMeasure;
  /** Valor a alcançar. */
  target: number;
  shells: number;
  /** Fica em "???" na lista até ser conquistada (surpresas do fim do jogo). */
  hidden?: boolean;
  /**
   * SECRETA: não aparece na tela de jeito nenhum antes de ser conquistada — nem como "???".
   *
   * `hidden` mostra a moldura e esconde o nome; `secret` esconde a entrada inteira, e ela surge na
   * lista no momento em que o jogador a completa. A tela anuncia só quantas existem, para o jogador
   * saber que há o que procurar sem saber o quê.
   */
  secret?: boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "primeira-mare",
    name: "Primeira maré",
    description: "Vença uma fase.",
    category: "combate",
    measure: { type: "totalVictories" },
    target: 1,
    shells: 15,
  },
  {
    id: "recife-protegido",
    name: "Recife protegido",
    description: "Conclua as seis fases da campanha.",
    category: "exploracao",
    measure: { type: "levelsCompleted" },
    target: 6,
    shells: 80,
  },
  {
    id: "mao-cheia",
    name: "Mão cheia",
    description: "Junte 9 estrelas.",
    category: "exploracao",
    measure: { type: "starsTotal" },
    target: 9,
    shells: 40,
  },
  {
    id: "maré-perfeita",
    name: "Maré perfeita",
    description: "Feche três fases com as três estrelas.",
    category: "exploracao",
    measure: { type: "perfectLevels" },
    target: 3,
    shells: 60,
  },
  {
    id: "cacador-de-guardioes",
    name: "Caçador de Guardiões",
    description: "Encontre os quatro Guardiões escondidos no Recife.",
    category: "guardioes",
    measure: { type: "encountersCompleted" },
    target: 4,
    shells: 90,
  },
  {
    id: "olho-de-peixe",
    name: "Olho de peixe",
    description: "Descubra um segredo escondido no mapa.",
    category: "exploracao",
    measure: { type: "secretsFound" },
    target: 1,
    shells: 25,
  },
  {
    id: "catalogo-do-recife",
    name: "Catálogo do Recife",
    description: "Catalogue as sete ameaças do bestiário.",
    category: "colecao",
    measure: { type: "enemiesCatalogued" },
    target: 7,
    shells: 45,
  },
  {
    id: "contador-de-historias",
    name: "Contador de histórias",
    description: "Leia cinco capítulos da história do Recife.",
    category: "colecao",
    measure: { type: "storiesRead" },
    target: 5,
    shells: 30,
  },
  {
    id: "faxina",
    name: "Faxina",
    description: "Derrote 500 invasores no total.",
    category: "combate",
    measure: { type: "totalKills" },
    target: 500,
    shells: 50,
  },
  {
    id: "muralha",
    name: "Muralha",
    description: "Vença uma fase sem deixar ninguém passar.",
    category: "combate",
    measure: { type: "matchesWith", condition: "noLeaks" },
    target: 1,
    shells: 35,
  },
  {
    id: "fundo-do-poco",
    name: "Fundo do poço",
    description: "Vença uma fase no Abissal.",
    category: "especiais",
    measure: { type: "matchesWith", condition: "hardDifficulty" },
    target: 1,
    shells: 70,
  },
  {
    id: "sozinho-no-escuro",
    name: "Sozinho no escuro",
    description: "Vença uma fase usando uma espécie só.",
    category: "especiais",
    measure: { type: "matchesWith", condition: "soloGuardian" },
    target: 1,
    shells: 55,
    hidden: true,
  },
  {
    id: "banquete",
    name: "Banquete",
    description: "Derrote 60 invasores em uma única partida.",
    category: "combate",
    measure: { type: "bestInMatch", stat: "enemiesKilled" },
    target: 60,
    shells: 30,
  },
  {
    id: "colecionador-de-perolas",
    name: "Colecionador de pérolas",
    description: "Junte 600 pérolas em uma única partida.",
    category: "colecao",
    measure: { type: "bestInMatch", stat: "pearlsEarned" },
    target: 600,
    shells: 30,
  },
  {
    id: "arsenal",
    name: "Arsenal",
    description: "Tenha 8 Guardiões em campo ao mesmo tempo.",
    category: "guardioes",
    measure: { type: "bestInMatch", stat: "maxSimultaneousGuardians" },
    target: 8,
    shells: 35,
  },
  // ── Segredos do Recife ───────────────────────────────────────────────────────
  // Nenhuma aparece na lista antes da hora. São façanhas de campanha inteira: quem as persegue de
  // propósito precisa jogar as seis fases de um jeito específico do começo ao fim.
  {
    id: "sopro-de-vida",
    name: "Sopro de vida",
    description: `Vença as ${CAMPAIGN_LEVELS} fases do Recife Costeiro perdendo no máximo ${MAX_LIVES_LOST_FOR_SECRET} vida em cada uma.`,
    category: "especiais",
    measure: { type: "campaignBest", stat: "livesLost", max: MAX_LIVES_LOST_FOR_SECRET },
    target: CAMPAIGN_LEVELS,
    shells: 120,
    secret: true,
  },
  {
    id: "sem-recomeco",
    name: "Sem recomeço",
    description: "Conclua o Recife Costeiro inteiro sem nunca reiniciar uma fase.",
    category: "especiais",
    measure: { type: "campaignWithoutRestart" },
    target: CAMPAIGN_LEVELS,
    shells: 140,
    secret: true,
  },
  {
    id: "dupla-do-recife",
    name: "Dupla do Recife",
    description: "Vença todas as fases do Recife Costeiro usando no máximo duas espécies de Guardião em cada.",
    category: "especiais",
    measure: { type: "campaignBest", stat: "distinctGuardians", max: 2 },
    target: CAMPAIGN_LEVELS,
    shells: 160,
    secret: true,
  },
  {
    id: "veterano",
    name: "Veterano",
    description: "Passe uma hora defendendo o Recife.",
    category: "especiais",
    measure: { type: "playTimeMinutes" },
    target: 60,
    shells: 40,
  },
];

export const ACHIEVEMENT_IDS: readonly string[] = ACHIEVEMENTS.map((achievement) => achievement.id);

/** As secretas, para a tela anunciar quantas existem sem revelar quais são. */
export const SECRET_ACHIEVEMENTS: readonly AchievementDefinition[] = ACHIEVEMENTS.filter((entry) => entry.secret === true);

export function achievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((candidate) => candidate.id === id);
}
