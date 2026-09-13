import type { GuardianId } from "../types";

/**
 * Como cada Guardião entra na coleção (item 3). A regra do projeto é narrativa: os Guardiões são
 * ENCONTRADOS no Recife (resgate numa fase de Encontro, segredo escondido no mapa ou aparição durante
 * uma onda), não comprados num menu.
 *
 * Cada Guardião novo sai de um Encontro próprio (`data/encounters/`). Quem já tinha o Guardião antes
 * dos Encontros existirem continua com ele: a reconciliação só adiciona, nunca tira.
 */
export type UnlockCondition =
  | { type: "default" }
  | { type: "levelCompleted"; levelId: string }
  | { type: "bossDefeated"; enemyId: string }
  | { type: "starsTotal"; stars: number }
  | { type: "secretFound"; secretId: string }
  | { type: "encounterCompleted"; encounterId: string }
  | { type: "achievement"; achievementId: string }
  | { type: "guardiansUnlocked"; count: number }
  | { type: "levelsCompleted"; count: number }
  | { type: "purchase"; shells: number };

export interface GuardianUnlockDefinition {
  guardianId: GuardianId;
  /** Basta UMA condição ser satisfeita. */
  conditions: UnlockCondition[];
  /** Sem progresso nenhum, o card fica como "???" na coleção. */
  hidden?: boolean;
  /** Condições que só tiram o "???" da coleção, sem desbloquear o Guardião. */
  revealWhen?: UnlockCondition[];
  /** Texto curto da apresentação de desbloqueio e da dica na coleção. */
  reveal: { title: string; role: string; mechanic: string; hint: string };
}

export const GUARDIAN_UNLOCKS: GuardianUnlockDefinition[] = [
  {
    guardianId: "pistol-shrimp",
    conditions: [{ type: "default" }],
    reveal: {
      title: "Camarão-Pistola",
      role: "Dano à distância",
      mechanic: "Dispara bolhas que atravessam e ricocheteiam entre os invasores.",
      hint: "Companheiro do Recife desde o primeiro dia.",
    },
  },
  {
    guardianId: "jellyfish",
    conditions: [{ type: "default" }],
    reveal: {
      title: "Água-viva",
      role: "Controle",
      mechanic: "Descarga elétrica que salta entre alvos e deixa a água pesada.",
      hint: "Companheira do Recife desde o primeiro dia.",
    },
  },
  {
    guardianId: "pufferfish",
    conditions: [{ type: "default" }],
    reveal: {
      title: "Baiacu",
      role: "Contenção",
      mechanic: "Infla no meio da correnteza e segura quem tentar passar.",
      hint: "Companheiro do Recife desde o primeiro dia.",
    },
  },
  {
    guardianId: "reef-crab",
    conditions: [{ type: "default" }],
    reveal: {
      title: "Caranguejo-Recife",
      role: "Corpo a corpo",
      mechanic: "Garras que quebram carapaças bem no meio do canal.",
      hint: "Companheiro do Recife desde o primeiro dia.",
    },
  },
  {
    guardianId: "ink-octopus",
    conditions: [{ type: "default" }],
    reveal: {
      title: "Polvo-Tinteiro",
      role: "Suporte",
      mechanic: "Tinta que marca os invasores e maré que fortalece os aliados.",
      hint: "Companheiro do Recife desde o primeiro dia.",
    },
  },
  {
    guardianId: "shark",
    conditions: [{ type: "encounterCompleted", encounterId: "gruta-do-predador" }],
    reveal: {
      title: "Tubarão — Instinto Predador",
      role: "Execução",
      mechanic: "Espreita na beira da correnteza e investe contra a presa mais fraca.",
      hint: "Ferido numa gruta além do Canal das Algas. Alguém precisa afastar o que o cerca.",
    },
  },
  {
    guardianId: "sea-turtle",
    conditions: [{ type: "encounterCompleted", encounterId: "rede-fantasma" }],
    reveal: {
      title: "Tartaruga-Marinha — Guardiã do Recife",
      role: "Controle de rota",
      mechanic: "Segura o cardume e vira a correnteza contra quem avança.",
      hint: "Presa numa rede fantasma perto dos Três Redemoinhos.",
    },
  },
  {
    guardianId: "stonefish",
    conditions: [{ type: "encounterCompleted", encounterId: "emboscada-no-coral" }],
    hidden: true,
    // Achar a pedra que pisca não entrega o Guardião: tira o "???" e abre o Encontro dele.
    revealWhen: [{ type: "secretFound", secretId: "pedra-que-pisca" }],
    reveal: {
      title: "Peixe-Pedra — Emboscador do Recife",
      role: "Armadilha",
      mechanic: "Enterra-se na rota e explode em veneno quando pisam nele.",
      hint: "Dizem que uma pedra da Espiral de Coral pisca de vez em quando.",
    },
  },
  {
    guardianId: "dolphin",
    conditions: [{ type: "encounterCompleted", encounterId: "chamado-do-golfinho" }],
    reveal: {
      title: "Golfinho — Mensageiro do Recife",
      role: "Suporte",
      mechanic: "Pulso de sonar que revela ameaças e coordena os Guardiões próximos.",
      hint: "Um sonar atravessou o naufrágio e sumiu. Ele volta se o Recife resistir.",
    },
  },
];

export const DEFAULT_UNLOCKED_GUARDIANS: GuardianId[] = GUARDIAN_UNLOCKS.filter((definition) =>
  definition.conditions.some((condition) => condition.type === "default"),
).map((definition) => definition.guardianId);
