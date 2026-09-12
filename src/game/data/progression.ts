/**
 * Moeda global e recompensas de progressão (item 2 do design). Separada das pérolas, que só existem
 * dentro da partida. "Conchas" é o nome provisório; troque aqui e o jogo inteiro acompanha.
 */
export const GLOBAL_CURRENCY = {
  id: "shells",
  name: "Conchas",
  singular: "Concha",
  /** Nome completo para textos de história/coleção. */
  fullName: "Conchas Ancestrais",
  symbol: "◈",
} as const;

/** Dificuldades maiores pagam mais Conchas pelo mesmo feito. */
export const DIFFICULTY_REWARD_MULTIPLIER: Record<string, number> = {
  normal: 1,
  dificil: 1.35,
  abissal: 1.75,
};

export const REWARDS = {
  /** Primeira conclusão de uma fase. */
  firstCompletion: 50,
  /** Cada estrela nova conquistada em uma fase. */
  perNewStar: 25,
  /** Primeira vez que uma fase fecha com 3/3. */
  firstPerfect: 30,
  /** Vitória repetida sem objetivo novo. */
  replayVictory: 5,
} as const;
