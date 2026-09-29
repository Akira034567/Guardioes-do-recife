import type { EnemyId } from "../types";

/** Texto de bestiário: como a ameaça age e o que costuma derrubá-la. Só apresentação. */
export interface EnemyLore {
  description: string;
  /** O que define o comportamento dele em campo. */
  trait: string;
  weaknesses: string[];
  resistances: string[];
}

export const ENEMY_LORE: Record<EnemyId, EnemyLore> = {
  minnow: {
    description: "Nunca aparece sozinho. Vem em cardume, ocupa a rota inteira e conta com o número para passar.",
    trait: "Frágil, mas chega em bando e satura defesas de alvo único.",
    weaknesses: ["Dano em área", "Correnteza contrária"],
    resistances: [],
  },
  swimmer: {
    description: "O invasor comum das marés novas. Sem pressa, sem truque, direto para o coral.",
    trait: "Referência do Recife: se um Guardião não dá conta dele, não dá conta de nada.",
    weaknesses: ["Qualquer dano sustentado"],
    resistances: [],
  },
  dartfish: {
    description: "Corta a água em linha reta e não desvia de nada. Chega antes de você decidir onde atirar.",
    trait: "Rápido e magro: atravessa o alcance de um Guardião em poucos segundos.",
    weaknesses: ["Lentidão", "Bloqueio na rota"],
    resistances: [],
  },
  needlefish: {
    description: "O mais veloz do cardume invasor e o que mais machuca o coral quando passa.",
    trait: "Velocidade alta e dano dobrado ao Recife: cada escape custa caro.",
    weaknesses: ["Atordoamento", "Armadilhas"],
    resistances: [],
  },
  ghostJelly: {
    description:
      "Não se esconde atrás de nada: ela some. O corpo dela some na água e só o que encosta nela sabe que estava ali.",
    trait: "Invisível até ser contida ou revelada: nenhum tiro mira o que não dá para ver.",
    weaknesses: ["Bloqueio na rota", "Sonar do Golfinho", "Dano em área"],
    resistances: ["Camuflagem: não pode ser mirada enquanto invisível"],
  },
  shellback: {
    description: "Carapaça velha de tanto raspar rocha. Anda devagar porque não precisa correr.",
    trait: "Armadura pesada: golpes fracos e repetidos quase não o arranham.",
    weaknesses: ["Quebra de armadura", "Dano alto por golpe"],
    resistances: ["Tiros fracos e rápidos"],
  },
  moray: {
    description: "Sai da fenda só quando sente que o Recife está mal defendido. Aguenta muito e cobra caro.",
    trait: "Elite: muita vida, dano forte ao coral e metade da lentidão que os outros sofrem.",
    weaknesses: ["Foco de vários Guardiões", "Vulnerabilidade"],
    resistances: ["Lentidão (50%)"],
  },
  corruptedShark: {
    description: "Era o guardião da gruta antes de a maré negra alcançá-lo. Agora caça o Recife que aprendeu a proteger.",
    trait: "Elite caçadora: nada em investidas curtas, resiste a lentidão e atordoamento e enlouquece com pouca vida.",
    weaknesses: ["Dano concentrado antes da investida", "Bloqueio na rota", "Quebra de armadura depois da fúria"],
    resistances: ["Lentidão (40%)", "Atordoamento (35%)"],
  },
  tidebreaker: {
    description: "A maré em forma de bicho. Inverte a corrente do Recife em ciclos e atravessa qualquer bloqueio.",
    trait: "Chefe: não pode ser bloqueado e vira a correnteza contra os Guardiões que dependem dela.",
    weaknesses: ["Dano concentrado e contínuo"],
    resistances: ["Bloqueio (imune)", "Lentidão (35%)"],
  },
  puffer: {
    description: "Nos Canais a maré negra entrou até nos baiacus. Qualquer arranhão e ele vira uma bola de espinhos.",
    trait: "Infla ao levar dano: ganha armadura e fica lento. Morto inflado, os espinhos atrasam os Guardiões em volta.",
    weaknesses: ["Um golpe forte antes de ele inflar", "Quebra de armadura", "Dano contínuo (ignora a armadura)"],
    resistances: ["Tiros fracos enquanto inflado"],
  },
  thief: {
    description: "Não quer o coral: quer o que o Recife guarda. Esguicha tinta em quem o vigia e foge com as pérolas.",
    trait: "Rápido e frágil. A tinta faz os Guardiões próximos atacarem mais devagar; se escapar, leva pérolas do caixa.",
    weaknesses: ["Lentidão", "Bloqueio na rota", "Dano à distância antes de ele chegar perto"],
    resistances: [],
  },
  ironShell: {
    description: "Uma tartaruga velha dos Canais que a maré negra cobriu de pedra. Não ataca ninguém: protege quem ataca.",
    trait: "Tanque de suporte: muita armadura e um escudo que corta 30% do dano dos vizinhos.",
    weaknesses: ["Quebra de armadura", "Estocada do Peixe-Espada (rompe o escudo)", "Derrubá-la primeiro"],
    resistances: ["Tiros fracos e rápidos", "Lentidão (30%)"],
  },
  carrier: {
    description: "A concha dele não é casa: é um barco. Leva um cardume inteiro escondido lá dentro.",
    trait: "Blindado e lento. Morto, solta quatro Peixinhos de uma vez no mesmo ponto da rota.",
    weaknesses: ["Dano em área logo depois do ponto em que ele cai", "Quebra de armadura"],
    resistances: ["Alvo único: o cardume que ele solta passa"],
  },
  queenMoray: {
    description: "Mora no fundo dos Canais desde antes do Recife ter nome. Conhece cada passagem e nunca volta pelo mesmo caminho.",
    trait: "Chefe em três fases: ao se ferir mergulha para o outro canal e chama escolta. Não pode ser bloqueada.",
    weaknesses: ["Defesa nos DOIS canais", "Dano concentrado e contínuo", "Vulnerabilidade"],
    resistances: ["Bloqueio (imune)", "Lentidão (40%)"],
  },
};
