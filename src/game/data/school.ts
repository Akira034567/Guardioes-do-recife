import type { EnemyId, GuardianId } from "../types";
import type { StatusIcon } from "../assets/statusArt";

/**
 * Conteúdo da Escola do Recife — a camada que ENSINA, em oposição ao Álbum e às Ameaças, que
 * CATALOGAM.
 *
 * A diferença importa e define o que entra aqui. O Álbum conta a história do Guardião e mostra os
 * números da ficha; as Ameaças listam vida, velocidade e armadura de cada invasor. Nenhum dos dois
 * responde "o que eu faço com isso": por que a vulnerabilidade de dois Polvos não soma, por que o
 * tiro erra dentro da correnteza, por que atordoar o chefe três vezes seguidas não funciona. Essas
 * regras existem no motor desde sempre e nunca foram ditas ao jogador — ele as descobre perdendo.
 *
 * Por isso toda aula termina numa `rule`: a frase com o número exato. É o que separa uma aula de um
 * texto de sabor, e é o que o jogador volta aqui para reler.
 *
 * Nada é bloqueado. Um manual que esconde a página de que você precisa não é um manual — os
 * "momentos" (`Moments.ts`) apenas apontam para a aula certa na hora certa e marcam a leitura.
 */

export type CourseId = "guardioes" | "efeitos" | "correnteza" | "ameacas";

/** De onde sai a ilustração da aula. */
export type LessonArt =
  | { kind: "guardian"; id: GuardianId }
  | { kind: "status"; icon: StatusIcon }
  | { kind: "enemy"; id: EnemyId }
  | { kind: "icon"; name: string };

export interface Lesson {
  id: string;
  course: CourseId;
  title: string;
  /** Uma linha: o que esta aula resolve. Aparece na lista, antes de abrir. */
  summary: string;
  art: LessonArt;
  /** O corpo. Três a cinco frases curtas — mais que isso ninguém lê no meio de uma partida. */
  points: string[];
  /** A regra exata, com número. Toda aula tem uma; é o motivo de ela existir. */
  rule: string;
}

export interface Course {
  id: CourseId;
  title: string;
  /** O que o curso inteiro promete. */
  summary: string;
  icon: string;
}

export const COURSES: readonly Course[] = [
  { id: "guardioes", title: "Os Guardiões", summary: "O que cada um faz de verdade e quando escolher cada ramo.", icon: "fish" },
  { id: "efeitos", title: "Efeitos de status", summary: "Os cinco ícones em cima dos invasores — e como eles se somam.", icon: "spiky" },
  { id: "correnteza", title: "A correnteza", summary: "A rota, a água que empurra e onde cada Guardião cabe.", icon: "waves" },
  { id: "ameacas", title: "As ameaças", summary: "Os seis tipos de invasor e a resposta de cada um.", icon: "skull" },
];

// ---------------------------------------------------------------- Guardiões

const GUARDIAN_LESSONS: readonly Lesson[] = [
  {
    id: "guardiao-camarao",
    course: "guardioes",
    title: "Camarão-Pistola",
    summary: "A régua de dano do jogo. Se você está na dúvida, é ele.",
    art: { kind: "guardian", id: "pistol-shrimp" },
    points: [
      "Tiro simples, longo alcance, sempre no inimigo mais adiantado da rota.",
      "É o Guardião mais barato e o melhor dano por pérola contra alvo único — todo o resto do jogo é calibrado contra ele.",
      "Ramo Perfuração: o tiro atravessa 2 e depois 3 alvos. Quer a rota reta, com a fila enfileirada na sua frente.",
      "Ramo Dano Concentrado: tiros mais lentos e muito mais pesados. Quer o alvo gordo — Cascudo, Moreia, chefe.",
    ],
    rule: "80 pérolas · alcance 190 · 24 de dano a cada 1,1s. Só em plataforma de pedra.",
  },
  {
    id: "guardiao-aguaviva",
    course: "guardioes",
    title: "Água-viva",
    summary: "Não mata: segura o cardume para o resto do esquadrão trabalhar.",
    art: { kind: "guardian", id: "jellyfish" },
    points: [
      "A descarga salta entre inimigos próximos e deixa quem ela toca a 70% da velocidade.",
      "O valor dela é tempo: cada segundo que o invasor passa a menos velocidade é um segundo a mais de tiro dos outros.",
      "Ramo Elétrico: mais saltos e um campo que pulsa sozinho. Contra cardume.",
      "Ramo Controle: lentidão forte e paralisia curta. Contra o que não pode chegar perto do Recife.",
    ],
    rule: "90 pérolas · alcance 170 · 12 de dano a cada 0,95s. Só em água livre, a mais de 82 px da rota.",
  },
  {
    id: "guardiao-baiacu",
    course: "guardioes",
    title: "Baiacu",
    summary: "Não atira. Agarra quem passa e machuca no contato.",
    art: { kind: "guardian", id: "pufferfish" },
    points: [
      "Fica EM CIMA da correnteza e prende inimigos por um tempo — 1 na base, 3 e 5 nos upgrades do ramo Fortaleza.",
      "O agarrão tem prazo: ele solta, espera a recarga e pega de novo. Não é uma parede permanente.",
      "Ele causa dano de contato em quem está preso E em quem só passa por perto — com a lotação cheia ele continua cobrando pedágio.",
      "Ramo Pulso troca contenção por dano em área. Se você já tem Tartaruga na rota, é o ramo que rende mais.",
    ],
    rule: "105 pérolas · segura 1/3/5 por 3,5s a 5,5s, com 1,5s de recarga por inimigo solto. Chefe não é preso: só desacelera.",
  },
  {
    id: "guardiao-caranguejo",
    course: "guardioes",
    title: "Caranguejo-Recife",
    summary: "O melhor dano por pérola do jogo — em troca de um alcance minúsculo.",
    art: { kind: "guardian", id: "reef-crab" },
    points: [
      "Fica na rota e bate em quem passa ao lado. Alcance 78: ele só acerta o que chega perto.",
      "Por isso ele quer o trecho LENTO da rota — curva fechada, depois de um bloqueador, dentro de uma zona de lentidão.",
      "Ramo Quebra-Casco: ignora armadura e marca o alvo com vulnerabilidade para a equipe inteira. É a resposta ao Cascudo.",
      "Ramo Varredura: bate em todos ao alcance e gira a cada 4 ataques. É a resposta ao cardume.",
    ],
    rule: "90 pérolas · alcance 78 · 34 de dano a cada 1,25s. Na correnteza, a até 52 px da linha da rota.",
  },
  {
    id: "guardiao-polvo",
    course: "guardioes",
    title: "Polvo-Tinteiro",
    summary: "Sozinho rende pouco. Perto dos outros, multiplica o esquadrão inteiro.",
    art: { kind: "guardian", id: "ink-octopus" },
    points: [
      "O jato dele é fraco de propósito: o que importa é a VULNERABILIDADE que ele deixa no alvo.",
      "Ramo Tinta: o inimigo marcado passa a receber mais dano de TODO mundo. Um Polvo transforma cinco Camarões em seis.",
      "Ramo Maré Aliada: aura permanente que acelera e alonga o alcance dos Guardiões ao redor.",
      "Cuidado com o instinto de colocar dois: nem a vulnerabilidade nem a aura somam.",
    ],
    rule: "105 pérolas · alcance 155 · 14 de dano a cada 1,5s. Em plataforma OU em água livre.",
  },
  {
    id: "guardiao-tubarao",
    course: "guardioes",
    title: "Tubarão",
    summary: "Executor: sai da margem, morde quem está quase caindo e volta.",
    art: { kind: "guardian", id: "shark" },
    points: [
      "Ele não mira o mais adiantado como os outros: mira o de MENOS VIDA ao alcance.",
      "Isso o torna o pior primeiro Guardião e um dos melhores segundos — ele precisa de alguém ferindo antes.",
      "Ramo Frenesi: cada ferido ao alcance o deixa mais rápido. Contra ondas grandes já castigadas.",
      "Ramo Investida: marca o chefe ou o elite e acumula dano a cada mordida na presa marcada. É o mata-chefe.",
    ],
    rule: "110 pérolas · alcance 165 · 36 de dano a cada 1,25s. Na MARGEM: entre 30 e 120 px da linha da rota.",
  },
  {
    id: "guardiao-tartaruga",
    course: "guardioes",
    title: "Tartaruga-Marinha",
    summary: "Ela SEGURA. O Baiacu belisca; ela para a fila.",
    art: { kind: "guardian", id: "sea-turtle" },
    points: [
      "Bloqueia desde a base e segura por MUITO mais tempo que o Baiacu — 9s contra 3,5s no nível mais baixo.",
      "O dano dela é quase simbólico: quem mata é quem você puser em volta.",
      "Ramo Casco: mais vagas e mais tempo — 4 por 12s, depois 6 por 14s. A barreira viva.",
      "Ramo Correnteza: menos vagas, mas ela muda a ÁGUA — zona de corrente contrária que atrasa todo mundo e uma onda que empurra a fila rota abaixo.",
    ],
    rule: "85 pérolas · segura 2 por 9s na base. Casco: 4 por 12s, 6 por 14s. Correnteza: 3 por 10s, 5 por 11s.",
  },
  {
    id: "guardiao-peixe-pedra",
    course: "guardioes",
    title: "Peixe-Pedra",
    summary: "Emboscada recorrente na borda da correnteza. Você escolhe ONDE, não QUANDO.",
    art: { kind: "guardian", id: "stonefish" },
    points: [
      "Ele encaixa sozinho na borda da rota, camuflado de pedra, com a zona de emboscada invadindo a correnteza.",
      "Quando alguém entra na zona ele abre os espinhos, dá o bote em área com veneno, recolhe e se camufla de novo. Para sempre.",
      "O bote é COMPROMETIDO: depois que os espinhos começam a abrir ele sai, mesmo que o alvo escape. Acertar é leitura sua.",
      "Ramo Jardim Tóxico: névoa que envenena e atrasa quem atravessa. Ramo Predador: zona menor, bote que ignora armadura.",
    ],
    rule: "95 pérolas · zona 70 · bote de 46 + veneno de 9/s por 4s, a cada 3s. Encaixa a até 130 px da rota.",
  },
  {
    id: "guardiao-golfinho",
    course: "guardioes",
    title: "Golfinho",
    summary: "O sonar revela o que ninguém vê e deixa o alvo mais frágil.",
    art: { kind: "guardian", id: "dolphin" },
    points: [
      "O pulso de sonar REVELA camuflados — sem ele, a Água-viva Fantasma atravessa sua defesa sem levar um tiro.",
      "Quem o pulso toca também passa a receber mais dano por alguns segundos.",
      "Ramo Coro: fortalece os Guardiões ao redor, e o bônus cresce com a DIVERSIDADE de espécies do seu esquadrão.",
      "Ramo Sonar: pulso maior, marca prioridade e coordena a equipe.",
    ],
    rule: "110 pérolas · alcance 155 · pulso a cada 5,5s. Em água livre OU na margem.",
  },
];

// ---------------------------------------------------------------- Efeitos

const STATUS_LESSONS: readonly Lesson[] = [
  {
    id: "efeito-lento",
    course: "efeitos",
    title: "Lento",
    summary: "O efeito mais comum do jogo — e o que menos some.",
    art: { kind: "status", icon: "slow" },
    points: [
      "Reduz a velocidade do invasor por um tempo. Cada segundo perdido é um segundo a mais de tiro seu.",
      "Lentidões NÃO se somam: vale sempre a mais forte que estiver ativa. Duas Água-vivas não deixam o alvo duas vezes mais lento.",
      "Existe um piso: nada desce de 20% da velocidade original, por mais fontes que você empilhe.",
      "Vários invasores resistem parcialmente — a resistência é uma fração do efeito ignorada, não uma imunidade.",
    ],
    rule: "Vale a lentidão mais forte ativa, nunca a soma. Piso de 20% da velocidade.",
  },
  {
    id: "efeito-atordoado",
    course: "efeitos",
    title: "Atordoado",
    summary: "Para de andar e de agir. O controle mais forte — e o mais limitado.",
    art: { kind: "status", icon: "stun" },
    points: [
      "O invasor congela no lugar durante o efeito.",
      "Contra comuns funciona sempre. Contra elite e chefe, NÃO: cada atordoamento seguido vale menos.",
      "No chefe a sequência é 100%, 60%, 30% da duração — e depois ele fica imune por 4 segundos.",
      "Por isso atordoar o chefe sem parar é desperdício. Guarde o controle para o momento em que ele importa.",
    ],
    rule: "Elite: 100% → 75% → 50% em 6s, depois 2s de imunidade. Chefe: 100% → 60% → 30% em 8s, depois 4s de imunidade.",
  },
  {
    id: "efeito-envenenado",
    course: "efeitos",
    title: "Envenenado",
    summary: "Dano que continua depois que o Guardião já parou de atacar.",
    art: { kind: "status", icon: "poison" },
    points: [
      "Cobra uma fatia de vida por segundo, enquanto durar, independente de armadura.",
      "Diferente da lentidão, o veneno ACUMULA — mas até um teto, hoje de 2 doses.",
      "Uma dose nova renova a duração de todas: manter a fonte ativa vale mais do que trocar de alvo.",
      "É o que torna o Peixe-Pedra bom contra cardume: ele envenena o grupo e o grupo morre andando.",
    ],
    rule: "Acumula até 2 doses. Cada dose nova renova a duração. O dano ignora armadura.",
  },
  {
    id: "efeito-vulneravel",
    course: "efeitos",
    title: "Vulnerável",
    summary: "O multiplicador de dano de TODO o esquadrão, num alvo só.",
    art: { kind: "status", icon: "vulnerable" },
    points: [
      "O alvo marcado passa a receber mais dano de qualquer Guardião, não só de quem marcou.",
      "É a razão de existir o Polvo-Tinteiro e o ramo Quebra-Casco do Caranguejo.",
      "Vulnerabilidades NÃO se somam: vale sempre a MAIOR ativa. Dois Polvos marcando o mesmo alvo valem um.",
      "E existe um teto absoluto: nada no jogo recebe mais de 30% de dano extra por vulnerabilidade.",
    ],
    rule: "Vale a maior vulnerabilidade ativa, nunca a soma. Teto de ×1,30.",
  },
  {
    id: "efeito-revelado",
    course: "efeitos",
    title: "Revelado",
    summary: "Sem isto, o que é camuflado atravessa sua defesa sem levar um tiro.",
    art: { kind: "status", icon: "revealed" },
    points: [
      "Um invasor camuflado não pode ser mirado: os Guardiões simplesmente não o veem.",
      "Revelar o expõe por alguns segundos — e aí ele vira um alvo como qualquer outro.",
      "O pulso do Golfinho revela. Bloquear também: quem está preso não consegue se esconder.",
      "Se uma fase tem Água-viva Fantasma e você não levou resposta, ela passa. Não é azar, é a conta.",
    ],
    rule: "Camuflado não pode ser mirado. O sonar do Golfinho revela por 5s, a cada 5,5s; bloquear expõe de vez.",
  },
  {
    id: "efeito-auras",
    course: "efeitos",
    title: "Auras e a regra de não somar",
    summary: "A regra que decide se o segundo Polvo vale as 105 pérolas.",
    art: { kind: "icon", name: "star" },
    points: [
      "Aura é o bônus permanente que um Guardião dá aos vizinhos — hoje, a Maré Aliada do Polvo.",
      "Auras NUNCA acumulam: quando duas alcançam o mesmo Guardião, vale só a MELHOR fonte.",
      "Isso vale junto com a vulnerabilidade e a lentidão: o jogo inteiro prefere 'vale a maior' a 'soma tudo'.",
      "A consequência prática: o segundo Polvo só rende se ele cobrir Guardiões que o primeiro não alcança.",
    ],
    rule: "Aura, vulnerabilidade e lentidão: vale a melhor fonte ativa, nunca a soma. Só o veneno acumula, até 2 doses.",
  },
];

// ---------------------------------------------------------------- Correnteza

const CURRENT_LESSONS: readonly Lesson[] = [
  {
    id: "corrente-rota",
    course: "correnteza",
    title: "A rota e o Recife",
    summary: "A faixa clara é o caminho. O fim dela é a sua vida.",
    art: { kind: "icon", name: "compass" },
    points: [
      "Todo invasor entra por uma ponta da faixa clara e anda até a outra. Ele nunca sai dela por conta própria.",
      "Quem chega ao fim tira vida do Recife — e nem todos tiram a mesma: o Peixe-Agulha tira o dobro, o chefe tira dez.",
      "Você não constrói o caminho: ele já está desenhado. O que você escolhe é ONDE, ao longo dele, o invasor vai sofrer.",
      "O trecho que mais rende é o mais LENTO — curvas fechadas, e qualquer ponto depois de um bloqueador.",
    ],
    rule: "A rota é fixa. Vazamento custa de 1 a 10 de vida do Recife, conforme o invasor.",
  },
  {
    id: "corrente-mapa",
    course: "correnteza",
    title: "A correnteza do mapa",
    summary: "Água que empurra. E que entorta o seu tiro.",
    art: { kind: "icon", name: "waves" },
    points: [
      "Algumas fases têm zonas de corrente natural, marcadas pelas partículas que viajam na água.",
      "Dentro delas o invasor anda mais rápido ou mais devagar, conforme a direção da água.",
      "O que quase ninguém percebe: a corrente também DESVIA PROJÉTEIS. O tiro do Camarão entorta ao atravessar.",
      "Por isso um Guardião de tiro colocado do lado errado de uma correnteza rende menos do que a ficha dele promete.",
    ],
    rule: "A corrente mexe na velocidade do invasor E desvia o projétil que a atravessa. Nada desce de 30% da velocidade.",
  },
  {
    id: "corrente-lugares",
    course: "correnteza",
    title: "Onde cada Guardião cabe",
    summary: "Cinco lugares diferentes. Nenhum Guardião escolhe por acaso.",
    art: { kind: "icon", name: "target" },
    points: [
      "PLATAFORMA (pedra): Camarão e Polvo. Pontos fixos, longe da água.",
      "ÁGUA LIVRE: Água-viva, Golfinho e também o Polvo — precisa ficar a mais de 82 px da rota.",
      "MARGEM: Tubarão e Golfinho, na faixa de 30 a 120 px ao lado da rota. Perto o bastante para dar o bote.",
      "CORRENTEZA: Baiacu, Caranguejo e Tartaruga ficam EM CIMA da rota, a até 52 px da linha. BORDA: só o Peixe-Pedra.",
    ],
    rule: "Rota: até 52 px. Margem: 30 a 120 px. Água livre: mais de 82 px. Emboscada: encaixa a 38 px da linha.",
  },
  {
    id: "corrente-sua",
    course: "correnteza",
    title: "A água que você muda",
    summary: "A Tartaruga cria corrente. A Baleia amplifica a do mapa.",
    art: { kind: "guardian", id: "sea-turtle" },
    points: [
      "O ramo Correnteza da Tartaruga cria uma zona de corrente contrária: todo mundo dentro dela anda mais devagar, sem limite de alvos e sem recarga.",
      "No segundo nível ela ainda solta uma onda periódica que empurra a fila rota abaixo — desfazendo progresso já feito.",
      "Chefes que mexem na água AMPLIFICAM a correnteza natural do mapa, não a sua.",
      "É uma decisão de desenho: a Baleia nunca reforça o controle que você construiu, só o que já estava lá.",
    ],
    rule: "Correntes de Guardião nunca são amplificadas. A Baleia reforça só as naturais: ×2,2 de força e ×1,8 de deriva.",
  },
];

// ---------------------------------------------------------------- Ameaças

const ENEMY_LESSONS: readonly Lesson[] = [
  {
    id: "ameaca-cardume",
    course: "ameacas",
    title: "Cardume",
    summary: "Frágil sozinho. O problema é que nunca vem sozinho.",
    art: { kind: "enemy", id: "minnow" },
    points: [
      "Vida baixíssima, mas em quantidade: eles saturam qualquer defesa de alvo único.",
      "Um Camarão que mata um por tiro não dá conta de doze chegando juntos — o gargalo é a CADÊNCIA, não o dano.",
      "A resposta é área: Caranguejo Varredura, Água-viva Elétrica, Peixe-Pedra Jardim Tóxico, Baiacu Pulso.",
      "Veneno é especialmente bom aqui: envenenar o grupo mata o grupo inteiro andando.",
    ],
    rule: "Peixinho: 24 de vida. A conta que importa é quantos você mata por segundo, não quanto dano dá por tiro.",
  },
  {
    id: "ameaca-veloz",
    course: "ameacas",
    title: "Veloz",
    summary: "Atravessa o alcance do seu Guardião antes de ele atirar duas vezes.",
    art: { kind: "enemy", id: "needlefish" },
    points: [
      "Velocidade alta e vida média: o problema é o tempo que ele passa dentro do seu alcance, não o quanto aguenta.",
      "O Peixe-Agulha ainda tira o DOBRO de vida do Recife ao vazar. Cada escape custa caro.",
      "A resposta não é mais dano: é lentidão e bloqueio. Segurar um veloz por 3s vale mais que somar 30 de dano.",
      "Um bloqueador antes da sua zona de tiro transforma todo veloz num alvo comum.",
    ],
    rule: "Peixe-Agulha: 118 de velocidade (o dobro do comum) e 2 de dano ao Recife.",
  },
  {
    id: "ameaca-blindado",
    course: "ameacas",
    title: "Blindado",
    summary: "Armadura não é vida extra: é uma porcentagem tirada de cada golpe.",
    art: { kind: "enemy", id: "shellback" },
    points: [
      "A armadura reduz uma FRAÇÃO de cada acerto. Quanto menor o golpe, mais ele sofre com ela.",
      "O Cascudo tem armadura 9: isso corta 36% de tudo que acerta nele.",
      "Isso pune exatamente quem dá muitos golpes pequenos — cardume de Camarões rende péssimo contra ele.",
      "A resposta: dano que IGNORA armadura (Caranguejo Quebra-Casco, Peixe-Pedra ramo Predador) ou veneno, que passa por baixo dela.",
    ],
    rule: "Redução = armadura ÷ (armadura + 16). Armadura 9 → 36%. Armadura 5 → 24%. Armadura 2 → 11%.",
  },
  {
    id: "ameaca-camuflado",
    course: "ameacas",
    title: "Camuflado",
    summary: "Não é resistente. É invisível — e ninguém mira o que não vê.",
    art: { kind: "enemy", id: "ghostJelly" },
    points: [
      "A Água-viva Fantasma some na água. Enquanto estiver escondida, nenhum Guardião a escolhe como alvo.",
      "Ela não é forte: 100 de vida. Se você conseguir mirar nela, ela cai rápido.",
      "Duas coisas a expõem: o pulso de sonar do Golfinho e qualquer BLOQUEIO — quem está preso não se esconde.",
      "É de propósito que ela exista: força o esquadrão a ter algo além de dano puro.",
    ],
    rule: "Água-viva Fantasma: 100 de vida, camuflada até ser revelada ou bloqueada. Bloqueio expõe DE VEZ.",
  },
  {
    id: "ameaca-elite",
    course: "ameacas",
    title: "Elite",
    summary: "Vida de chefe, sem as regras de chefe — e resiste ao seu controle.",
    art: { kind: "enemy", id: "moray" },
    points: [
      "Moreia Sombria e Tubarão Corrompido: muita vida, armadura média e dano alto ao Recife.",
      "Eles PODEM ser presos e atordoados, mas com retornos decrescentes: o segundo controle vale menos que o primeiro.",
      "No Baiacu e na Tartaruga, um elite ocupa DUAS vagas de bloqueio. Uma Tartaruga de 4 vagas segura só dois elites.",
      "A resposta é dano concentrado e anti-armadura, com o controle guardado para o momento certo.",
    ],
    rule: "Elite: controle vale 100% → 75% → 50% numa janela de 6s, depois 2s de imunidade. Ocupa 2 vagas de bloqueio.",
  },
  {
    id: "ameaca-chefe",
    course: "ameacas",
    title: "Chefe",
    summary: "Não é preso, não é empurrado, e tira dez de vida se passar.",
    art: { kind: "enemy", id: "tidebreaker" },
    points: [
      "Chefe atravessa bloqueio: Baiacu e Tartaruga só conseguem DESACELERÁ-LO, nunca segurá-lo.",
      "Ele também resiste a atordoamento com retornos decrescentes mais duros que os do elite.",
      "Se ele chegar ao Recife são 10 de vida de uma vez — metade do que você tem na maioria das fases.",
      "A resposta é o Tubarão ramo Investida, que marca e acumula dano na presa marcada, mais tudo que ignora armadura.",
    ],
    rule: "Chefe: nunca bloqueado. Controle vale 100% → 60% → 30% em 8s, depois 4s de imunidade. Quebra-Marés tira 10 de vida.",
  },
];

export const LESSONS: readonly Lesson[] = [...GUARDIAN_LESSONS, ...STATUS_LESSONS, ...CURRENT_LESSONS, ...ENEMY_LESSONS];

export const LESSONS_BY_ID: ReadonlyMap<string, Lesson> = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));

export function lessonsOf(course: CourseId): readonly Lesson[] {
  return LESSONS.filter((lesson) => lesson.course === course);
}

/** A aula de um Guardião, para o momento de "você acabou de posicionar o Polvo pela primeira vez". */
export function lessonForGuardian(guardianId: GuardianId): Lesson | null {
  return LESSONS.find((lesson) => lesson.art.kind === "guardian" && lesson.art.id === guardianId && lesson.course === "guardioes") ?? null;
}
