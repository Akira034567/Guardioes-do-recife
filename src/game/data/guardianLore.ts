import type { GuardianId } from "../types";

/** Texto de coleção: história, dificuldade de uso e dica. Só apresentação, nada de regra. */
export interface GuardianLore {
  /** 1 fácil · 2 exige posicionamento · 3 pede leitura da onda. */
  difficulty: 1 | 2 | 3;
  history: string;
  tip: string;
}

export const GUARDIAN_LORE: Record<GuardianId, GuardianLore> = {
  "pistol-shrimp": {
    difficulty: 1,
    history: "Vive nas fendas do coral e caça com um estouro de bolha mais quente que a areia do meio-dia. Foi o primeiro a responder quando a maré mudou.",
    tip: "Plataformas altas rendem mais: o tiro dele atravessa a fila inteira quando a rota vem reta.",
  },
  jellyfish: {
    difficulty: 2,
    history: "Flutua sem pressa desde antes das rotas existirem. Diz a história que ela lembra de todas as marés que já passaram pelo Recife.",
    tip: "Ela não mata sozinha: segura o cardume para o resto do esquadrão trabalhar.",
  },
  pufferfish: {
    difficulty: 2,
    history: "Pequeno, teimoso e impossível de empurrar. Escolheu o canal mais estreito do Recife para morar e nunca mais saiu de lá.",
    tip: "Só funciona em cima da correnteza. Coloque-o onde a fila precisa afunilar.",
  },
  "reef-crab": {
    difficulty: 1,
    history: "Passou a vida limpando o coral de invasores menores. Quando as carapaças chegaram, ele já sabia exatamente onde bater.",
    tip: "Corpo a corpo: quanto mais perto do trecho lento da rota, mais golpes por onda.",
  },
  "ink-octopus": {
    difficulty: 3,
    history: "Guarda os segredos do Recife em oito braços e uma memória comprida. Marca o inimigo antes que ele perceba que foi visto.",
    tip: "Sozinho rende pouco. Perto dos outros Guardiões, multiplica o esquadrão inteiro.",
  },
  shark: {
    difficulty: 2,
    history: "Chegou ferido, desconfiado e faminto. Ficou porque o Recife foi o primeiro lugar que não tentou expulsá-lo.",
    tip: "Fica na beira da correnteza e escolhe quem já está quase caindo. Deixe alguém ferir primeiro.",
  },
  "sea-turtle": {
    difficulty: 3,
    history: "Mais velha que as rochas do canal. Nada sem pressa porque sabe que a maré sempre volta.",
    tip: "O casco segura e a correnteza empurra: use-a onde a rota faz curva.",
  },
  stonefish: {
    difficulty: 3,
    history: "Ninguém sabe há quanto tempo ele está ali. Ninguém pisou duas vezes no mesmo lugar depois de descobrir.",
    tip: "Precisa de tempo para se enterrar e carregar. Coloque-o cedo, longe da briga.",
  },
  dolphin: {
    difficulty: 2,
    history: "Some por semanas e volta sempre que o Recife chama. Ouve a maré antes de todo mundo.",
    tip: "O sonar revela o que está escondido e coordena os Guardiões por perto.",
  },
};
