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
};
