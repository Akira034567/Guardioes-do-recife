/**
 * Conquistas (item 37). Cada uma é só dado: um jeito de medir, uma meta e as Conchas que paga.
 * A avaliação é pura (`core/progression/achievements.ts`) e roda no fim de cada partida.
 */
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
  | { type: "matchesWith"; condition: "noLeaks" | "hardDifficulty" | "soloGuardian" };

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

export function achievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((candidate) => candidate.id === id);
}
