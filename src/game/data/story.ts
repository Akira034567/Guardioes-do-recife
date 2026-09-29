import type { GuardianId } from "../types";

/**
 * Histórias do Recife (item 31). Texto puro, sem Phaser: o visualizador em HTML lê daqui e o save
 * guarda só os ids já vistos. Uma sequência nova é só uma entrada nesta lista.
 *
 * Os capítulos das fases são páginas de quadrinhos (`art/story/fase-N.png`, cortadas por
 * `scripts/slice-story-pages.py`). O `text` de uma página é a transcrição dos balões: vira o texto
 * alternativo da imagem e a prévia no menu de histórias.
 */
export interface StorySlide {
  /** Quem fala ou de onde vem a narração; vazio = narrador. */
  speaker?: string;
  text: string;
  /** Página de quadrinho, relativa a `public/`. Quando existe, o texto só acompanha a imagem. */
  image?: string;
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
  /** Guardião que fala neste capítulo; o índice usa a arte dele como capa. */
  guardianId?: GuardianId;
  trigger: StoryTrigger;
  slides: StorySlide[];
}

const page = (fase: number, number: number, text: string): StorySlide => ({
  image: `assets/story/fase-${fase}/page-${number}.webp`,
  text,
});

/*
 * Os ids vêm da primeira versão, em texto, destes capítulos: o save guarda o que já foi lido por
 * eles, então trocar o id faria o capítulo reaparecer para quem já o viu.
 */
export const STORY_SEQUENCES: StorySequence[] = [
  {
    id: "abertura",
    title: "Primeira Corrente",
    summary: "A água do Recife muda de direção, e não foi sozinha.",
    guardianId: "pistol-shrimp",
    trigger: { type: "levelIntro", levelId: "recife-1" },
    slides: [
      page(1, 1, "Recife Costeiro, onde as correntes sempre encontravam seu caminho. Um lugar vibrante, cheio de vida, e em perfeita harmonia. Camarão: Aposto duas pérolas que eu acerto aquela concha ali! Baiacu: Você me deve quatro da última vez. O Camarão-Pistola atira — PAF! Camarão: ...eu fiz isso? Baiacu: Acho que não..."),
      page(1, 2, "De repente, a água muda de direção. WOOOOSH! Peixes, corais e até a areia são levados por uma corrente muito mais forte. Camarão: A corrente... mudou! Baiacu: Isso não é normal. O que está acontecendo? Tartaruga: Não. A corrente não mudou sozinha. Algo está causando isso. E precisamos proteger o Recife enquanto descobrimos o que é."),
      page(1, 3, "Peixes são arrastados pela corrente e começam a se mover em direção ao Recife. Baiacu: Eles estão vindo muito rápido! Tartaruga: Este é o primeiro sinal. Vamos defender o Recife. Camarão: Tudo bem! Hora de trabalhar! Eles seguirão este caminho. Não podemos deixar que cheguem até o coração do Recife. Camarão: Com os Guardiões aqui, eles não passam! Fase 1: Primeira Corrente."),
    ],
  },
  {
    id: "canal-estreito",
    title: "Correnteza",
    summary: "Novos sinais. Alguém enorme passou por aqui.",
    guardianId: "sea-turtle",
    trigger: { type: "levelIntro", levelId: "recife-2" },
    slides: [
      page(2, 1, "Fase 2: Correnteza. Novos sinais. Alguém passou por aqui. Tartaruga: A corrente ficou ainda mais forte. E olha isso... Camarão: O quê? Mais peixes vindo? Baiacu: Ou mais pérolas pra nós? Não são pegadas comuns. Veja o tamanho dessas marcas. Camarão: Correntes não deixam marcas assim... Tartaruga: Isso não é uma marca de corrente. Baiacu: Então... de quem é?"),
      page(2, 2, "Tartaruga: É uma passagem. Alguém enorme passou por aqui. E recentemente. Baiacu: Nossa... Olha isso! As correntes estão diferentes agora. Elas não só ficam mais fortes... como mudam de direção de repente. WHOOOSH! Até os peixes normalmente dóceis estão agitados. Eles não estão atacando... estão sendo levados. Baiacu: Isso significa que vem mais por aí? Camarão: Então vamos nos preparar! Tartaruga: Sim. O Recife precisa de nós. Essas correntes não vão parar sozinhas."),
      page(2, 3, "A corrente agora traz grupos maiores e mais rápidos. Baiacu: Vamos conseguir, né? Camarão: Claro! Duas pérolas que EU acerto todos! Mas, lá no fundo... algo ainda maior se move. Fase 2: Correnteza."),
    ],
  },
  {
    id: "gruta-fria",
    title: "Encruzilhada do Recife",
    summary: "Três caminhos. O mesmo mistério.",
    guardianId: "pufferfish",
    trigger: { type: "levelIntro", levelId: "recife-3" },
    slides: [
      page(3, 1, "Fase 3: Encruzilhada do Recife. Três caminhos. O mesmo mistério. Tartaruga: Aqui é a encruzilhada... Três caminhos. Camarão: Eles vêm de todos os lados agora? Baiacu: Parece que o Recife inteiro está em movimento... Tartaruga: Os sinais estão mais claros. Algo está empurrando todos eles. Peixes de todas as espécies estão sendo levados pela corrente. E eles não parecem estar atacando... Camarão: Espera... Olha aquele ali! Ele está assustado... Não está tentando nos atacar. Baiacu: Eles não são inimigos!"),
      page(3, 2, "Quanto mais avançamos, mais criaturas encontramos, e todas parecem estar fugindo de algo. Tartaruga: Nada aqui é natural. Essa corrente está forçando todos eles a seguir pelo mesmo caminho. Camarão: Mas por quê? O que pode deixar tanta gente assim, com tanto medo? Baiacu: Talvez seja algum predador gigante... Algo enorme! Encontramos rastros no fundo do mar, muito maiores do que qualquer criatura que já vimos aqui. Camarão: Uau... Isso é enorme. Tartaruga: E está fresco. Passou há pouco tempo. E não é só um rastro. São vários. Camarão: Então essa coisa passa por aqui sempre? Baiacu: Ou está voltando de novo... Nos afastamos um pouco e, pela primeira vez, conseguimos ver uma sombra gigantesca ao longe, passando pela encruzilhada."),
      page(3, 3, "Tartaruga: Então era isso... Camarão: É... muito maior do que eu imaginava. Baiacu: Ela é... uma baleia? Ela passou rápido demais para vermos todos os detalhes, mas não há dúvida. É uma baleia. E ela está seguindo para as profundezas. Tartaruga: Os peixes estão fugindo dela. Mas ela também parecia estar com pressa. Como se estivesse fugindo de algo ainda maior. Camarão: Isso não termina aqui. Precisamos nos preparar para o que vem depois. Baiacu: O Recife precisa de nós. A corrente continua. E o mistério está só começando..."),
    ],
  },
  {
    id: "espiral",
    title: "Corrente Turbulenta",
    summary: "A maré aumenta. Uma cauda gigante cruza o horizonte.",
    guardianId: "pistol-shrimp",
    trigger: { type: "levelIntro", levelId: "recife-4" },
    slides: [
      page(4, 1, "Fase 4: Corrente Turbulenta. A maré aumenta. O perigo se aproxima. Tartaruga: A corrente está cada vez mais forte. Camarão: E olha o tamanho dessas ondas! Baiacu: Isso não parece mais normal... Os cardumes estão maiores e mais agitados, como se estivessem fugindo de algo. Camarão: Eles estão com muito medo... Deve ter algo grande lá na frente. Baiacu: Será que a gente ainda consegue segurar? Tartaruga: Conseguimos se trabalharmos juntos. Camarão: Então vamos mostrar do que os Guardiões do Recife são feitos!"),
      page(4, 2, "Conforme avançam, as correntes se tornam mais violentas e trazem mais inimigos. Baiacu: Olha isso! Eles estão vindo em grupos ainda maiores! Até o ambiente está mudando. Rochas se deslocam e a água parece girar em espiral. Camarão: Isso não é mais só uma corrente. Parece que algo enorme passou por aqui! De repente, uma sombra gigantesca cruza o horizonte... Baiacu: É... é uma cauda...? Tartaruga: Agora sabemos. Existe algo muito grande. Camarão: E está do nosso lado do Recife..."),
      page(4, 3, "A cauda desaparece nas profundezas, mas a corrente que ela deixou continua agitando tudo ao redor. Tartaruga: Se ela passou por aqui... Camarão: ...não está indo para o Recife, está indo para algum lugar. Baiacu: E está levando todas essas criaturas junto com ela... Camarão: Então precisamos impedir que ela destrua o que a gente mais ama. Baiacu: Eu também! Tartaruga: Nas próximas fases, a corrente vai ficar ainda mais forte. Fiquem atentos. A maré está crescendo. A próxima fase nos levará ainda mais perto da origem dessas correntes."),
    ],
  },
  {
    id: "naufragio",
    title: "Olho da Maré",
    summary: "A baleia aparece, e ela parece assustada.",
    guardianId: "pufferfish",
    trigger: { type: "levelIntro", levelId: "recife-5" },
    slides: [
      page(5, 1, "Fase 5: Olho da Maré. Algo gigantesco se aproxima. Tartaruga: A corrente está muito mais forte... Como se algo enorme estivesse vindo. Camarão: Dá pra sentir de longe. Baiacu: O Recife todo vai tremer! Cardumes inteiros estão sendo arrastados. Até as maiores espécies fogem em pânico. Não são inimigos. Eles estão fugindo de alguma coisa. Tartaruga: Precisamos ficar atentos. Se o que vem aí passar pelo Recife, a maré pode destruir tudo. Camarão: Eu estou pronto! Minhas pérolas também! Baiacu: Eu consigo ficar maior! Vai ajudar, né?"),
      page(5, 2, "Então, uma sombra gigantesca aparece no horizonte. É uma baleia. Enorme. Muito maior que tudo que já vimos. Camarão: Tá... Essa é grande. Baiacu: Eu consigo ficar maior! Assim já ajuda! ...talvez não tanto. Mas, olhando de perto, percebemos alguma coisa diferente nela... A baleia não parece estar atacando o Recife. Ela parece assustada."),
      page(5, 3, "Tartaruga: Ela também está fugindo? Camarão: Fugindo de quê? Baiacu: Então não é ela que está causando tudo isso? Ela passa pelo Recife, criando correntes imensas que arrastam tudo pelo caminho. Precisamos contê-la antes que cause ainda mais destruição. Tartaruga: Vamos proteger o Recife. Camarão: Com todos os Guardiões juntos. Baiacu: Eu também vou ajudar! Fase 5: Olho da Maré."),
    ],
  },
  {
    id: "quebra-mares",
    title: "Guardiã da Tempestade",
    summary: "Chegou a hora de enfrentar a verdade.",
    guardianId: "sea-turtle",
    trigger: { type: "levelIntro", levelId: "recife-6" },
    slides: [
      page(6, 1, "Fase 6: Guardiã da Tempestade. Chegou a hora de enfrentar a verdade. Tartaruga: É ela... Camarão: É ainda maior do que parecia. Baiacu: Conseguimos parar isso? A baleia atravessa o Recife, arrastando tudo com as suas correntes imensas. Não é um ataque direto. Ela está passando... mas o estrago no caminho é enorme. Tartaruga: Ela não parece querer nos atacar. Camarão: Mas se continuarmos assim, o Recife não vai aguentar. Baiacu: Então vamos impedir ela de passar! Juntos!"),
    ],
  },
  {
    // As duas últimas páginas da Fase 6 contam a batalha e o que a baleia revela: só depois da vitória.
    id: "recife-protegido",
    title: "Ele acordou",
    summary: "A baleia fala, e o perigo vem de mais fundo.",
    guardianId: "jellyfish",
    trigger: { type: "levelOutro", levelId: "recife-6" },
    slides: [
      page(6, 2, "Os Guardiões se posicionam. É a nossa maior batalha até agora. Tartaruga: Vamos lá! Pelo Recife! Todos os Guardiões entram em ação. Juntos, conseguimos enfraquecer e retardar a sua passagem. Por fim, conseguimos fazê-la parar. Tartaruga: Parem! Ela não é nossa inimiga. Camarão: Ela está exausta... Olhem para o olhar dela. A baleia nos encara. Não há raiva, apenas medo."),
      page(6, 3, "Pela primeira vez, a baleia fala. Baleia: Ele... acordou. Camarão: ...quem? Baiacu: O que aconteceu? Tartaruga: Do que ela está fugindo? Baleia: Eu não estava indo para o Recife. Eu estava saindo do Abismo. Ela não causou isso de propósito. Ela também está tentando escapar. Lá embaixo, nas profundezas... algo muito maior desperta. O perigo ainda não acabou. Essa foi apenas a primeira parte da nossa jornada. Abismo Azul: em breve..."),
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
