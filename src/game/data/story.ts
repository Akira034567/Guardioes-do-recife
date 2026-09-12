/**
 * Histórias do Recife (item 31). Texto puro, sem Phaser: o visualizador em HTML lê daqui e o save
 * guarda só os ids já vistos. Uma sequência nova é só uma entrada nesta lista.
 */
export interface StorySlide {
  /** Quem fala ou de onde vem a narração; vazio = narrador. */
  speaker?: string;
  text: string;
}

export type StoryTrigger =
  /** Antes da preparação da fase, uma única vez. */
  | { type: "levelIntro"; levelId: string }
  /** Depois de vencer a fase pela primeira vez. */
  | { type: "levelOutro"; levelId: string }
  /** Só pelo menu de histórias. */
  | { type: "manual" };

export interface StorySequence {
  id: string;
  title: string;
  /** Uma linha curta no índice do menu de histórias. */
  summary: string;
  trigger: StoryTrigger;
  slides: StorySlide[];
}

export const STORY_SEQUENCES: StorySequence[] = [
  {
    id: "abertura",
    title: "A maré que mudou",
    summary: "O dia em que a água do Recife ficou diferente.",
    trigger: { type: "levelIntro", levelId: "recife-1" },
    slides: [
      { text: "O Recife acordou com a água morna e um silêncio que não era dele. Os peixes de sempre tinham ido embora durante a noite." },
      { speaker: "Camarão-Pistola", text: "Eu senti a corrente virar antes de ver qualquer coisa. Quando vi, já vinha cardume estranho pelo canal norte." },
      { text: "Cinco moradores ficaram. Não porque eram os mais fortes, mas porque não tinham para onde ir. O coral era a casa deles." },
    ],
  },
  {
    id: "canal-estreito",
    title: "O canal estreito",
    summary: "A segunda maré traz carapaças que não cedem.",
    trigger: { type: "levelIntro", levelId: "recife-2" },
    slides: [
      { text: "A primeira maré passou. A segunda veio mais devagar, e isso era pior: o que vem devagar costuma vir preparado." },
      { speaker: "Polvo-de-Tinta", text: "São Cascudos. Carapaça velha, teimosia nova. Bater forte uma vez resolve mais do que bater fraco dez." },
    ],
  },
  {
    id: "gruta-fria",
    title: "A gruta fria",
    summary: "Alguma coisa grande se move nas fendas do leste.",
    trigger: { type: "levelIntro", levelId: "recife-3" },
    slides: [
      { text: "As fendas do leste sempre foram território de ninguém. Naquela semana, começaram a soltar bolhas quentes." },
      { speaker: "Água-viva", text: "Eu lembro de marés assim. A última durou três luas e levou metade do coral." },
      { text: "O Recife precisava de mais braços. E os braços, às vezes, chegam feridos e desconfiados." },
    ],
  },
  {
    id: "espiral",
    title: "A espiral",
    summary: "A correnteza vira um labirinto e o Recife aprende a usá-la.",
    trigger: { type: "levelIntro", levelId: "recife-4" },
    slides: [
      { text: "A corrente passou a girar em espiral, como se a água estivesse procurando alguma coisa no fundo." },
      { speaker: "Baiacu", text: "Se a água escolhe o caminho, então o caminho é nosso. Basta ficar onde ela aperta." },
    ],
  },
  {
    id: "naufragio",
    title: "O naufrágio",
    summary: "Um casco velho vira abrigo e armadilha ao mesmo tempo.",
    trigger: { type: "levelIntro", levelId: "recife-5" },
    slides: [
      { text: "O casco está no fundo desde antes de qualquer um deles. Nunca incomodou ninguém. Agora incomoda." },
      { speaker: "Caranguejo", text: "Tem sombra demais ali dentro. E sombra, no Recife, quase sempre tem dente." },
    ],
  },
  {
    id: "quebra-mares",
    title: "Quebra-Marés",
    summary: "O que estava virando a corrente finalmente aparece.",
    trigger: { type: "levelIntro", levelId: "recife-6" },
    slides: [
      { text: "Não era uma maré. Era uma coisa do tamanho de uma maré, e ela vinha subindo o canal principal." },
      { speaker: "Camarão-Pistola", text: "Todo mundo em posição. Se ele inverter a corrente, a gente inverte o plano. Não o contrário." },
    ],
  },
  {
    id: "recife-protegido",
    title: "Água limpa",
    summary: "Depois do Quebra-Marés, o Recife respira.",
    trigger: { type: "levelOutro", levelId: "recife-6" },
    slides: [
      { text: "A corrente voltou ao fluxo de sempre. Levou dois dias até os peixes antigos começarem a reaparecer no canal norte." },
      { speaker: "Água-viva", text: "Marés voltam. Sempre voltam. A diferença é que agora o Recife sabe se defender." },
      { text: "E em algum lugar mais fundo, longe do coral, outra coisa começou a se mexer." },
    ],
  },
];

export function storySequence(id: string): StorySequence | undefined {
  return STORY_SEQUENCES.find((sequence) => sequence.id === id);
}

/** Sequência disparada por um gatilho, quando existe. */
export function storyFor(trigger: StoryTrigger): StorySequence | undefined {
  return STORY_SEQUENCES.find(
    (sequence) =>
      sequence.trigger.type === trigger.type &&
      (trigger.type === "manual" || ("levelId" in sequence.trigger && "levelId" in trigger && sequence.trigger.levelId === trigger.levelId)),
  );
}
