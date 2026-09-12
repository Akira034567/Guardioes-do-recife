import type { SimPoint, SimStep } from "../src/game/core/Simulation";
import type { BranchId, GuardianId } from "../src/game/types";

/**
 * Roteiros de compra usados tanto pela simulação headless (`balance-sim.test.ts`)
 * quanto pelas sondas e2e (`e2e/balance.spec.ts`). Cada fase deve ser vencível
 * por builds diversos perdendo poucas vidas, sem ficar fácil demais.
 */
export interface BalanceBuild {
  name: string;
  level: string;
  /** Vidas mínimas no fim. Há variação de ±2 entre execuções reais. */
  minReef: number;
  steps: SimStep[];
  /** Esquadrão das cartas quando a build usa Guardiões fora do padrão (vira `?guardians=` no e2e). */
  loadout?: GuardianId[];
}

export const shrimp = (at: SimPoint): SimStep => ({ place: "pistol-shrimp", at });
export const jelly = (at: SimPoint): SimStep => ({ place: "jellyfish", at });
export const puffer = (at: SimPoint): SimStep => ({ place: "pufferfish", at });
export const crab = (at: SimPoint): SimStep => ({ place: "reef-crab", at });
export const octopus = (at: SimPoint): SimStep => ({ place: "ink-octopus", at });
export const shark = (at: SimPoint): SimStep => ({ place: "shark", at });
export const turtle = (at: SimPoint): SimStep => ({ place: "sea-turtle", at });
export const stonefish = (at: SimPoint): SimStep => ({ place: "stonefish", at });
export const dolphin = (at: SimPoint): SimStep => ({ place: "dolphin", at });
export const up = (at: SimPoint, branch: BranchId): SimStep => ({ upgrade: at, branch });

/** Esquadrão com os quatro Guardiões novos mais o Camarão. */
export const NEW_LOADOUT: GuardianId[] = ["pistol-shrimp", "shark", "sea-turtle", "stonefish", "dolphin"];

export const BALANCE_BUILDS: BalanceBuild[] = [
  // ------------------------------------------------------------ Recife 1 · Guardiões novos
  {
    name: "novatos: tubarão alfa na margem + tartaruga casco + camarão",
    level: "recife-1",
    minReef: 8,
    loadout: NEW_LOADOUT,
    steps: [shrimp([375, 245]), shark([300, 470]), turtle([330, 388]), up([300, 470], "b"), up([330, 388], "a"), up([375, 245], "b")],
  },
  {
    name: "novatos: tubarão frenesi + peixe-pedra emboscada + camarão",
    level: "recife-1",
    minReef: 8,
    loadout: NEW_LOADOUT,
    steps: [
      shrimp([375, 245]),
      shark([300, 470]),
      stonefish([700, 260]),
      up([300, 470], "a"),
      up([700, 260], "b"),
      up([375, 245], "b"),
      up([700, 260], "b"),
    ],
  },
  {
    name: "novatos: camarões + peixe-pedra veneno + golfinho sonar",
    level: "recife-1",
    minReef: 7,
    loadout: NEW_LOADOUT,
    steps: [
      shrimp([375, 245]),
      shrimp([925, 500]),
      stonefish([700, 260]),
      up([375, 245], "b"),
      dolphin([245, 255]),
      up([700, 260], "a"),
      up([925, 500], "b"),
      up([245, 255], "b"),
    ],
  },
  {
    name: "novatos: camarões + tartaruga corrente + golfinho coro",
    level: "recife-1",
    minReef: 9,
    loadout: NEW_LOADOUT,
    steps: [
      shrimp([375, 245]),
      shrimp([925, 500]),
      turtle([860, 372]),
      up([375, 245], "b"),
      up([860, 372], "b"),
      dolphin([760, 470]),
      up([760, 470], "a"),
      up([925, 500], "b"),
    ],
  },
  // ------------------------------------------------------------ Recife 2 · Guardiões novos (sobe à esquerda, dois laços, desce à direita)
  {
    name: "novatos: camarões nos laços + tubarão frenesi no canal + tartaruga corrente",
    level: "recife-2",
    minReef: 12,
    loadout: NEW_LOADOUT,
    steps: [
      shrimp([268, 206]),
      shark([560, 375]),
      shrimp([1010, 206]),
      up([560, 375], "a"),
      turtle([640, 305]),
      up([268, 206], "b"),
      up([640, 305], "b"),
      up([1010, 206], "b"),
      up([560, 375], "a"),
    ],
  },
  {
    name: "novatos: tubarão alfa + camarões + golfinho sonar",
    level: "recife-2",
    minReef: 10,
    loadout: NEW_LOADOUT,
    steps: [
      shrimp([268, 206]),
      shark([560, 375]),
      up([560, 375], "b"),
      shrimp([1010, 206]),
      up([268, 206], "b"),
      dolphin([640, 180]),
      up([640, 180], "b"),
      up([1010, 206], "b"),
      up([560, 375], "b"),
    ],
  },
  // ------------------------------------------------------------ Recife 1
  {
    name: "concentrado + quebra-casco (referência)",
    level: "recife-1",
    minReef: 10,
    steps: [shrimp([375, 245]), crab([330, 388]), shrimp([925, 500]), up([375, 245], "b"), up([925, 500], "b"), up([330, 388], "a")],
  },
  {
    name: "perfuração + água-viva controle",
    level: "recife-1",
    minReef: 6,
    steps: [shrimp([375, 245]), jelly([245, 255]), shrimp([925, 500]), up([375, 245], "a"), up([245, 255], "b"), up([925, 500], "a")],
  },
  {
    name: "contenção com baiacu",
    level: "recife-1",
    minReef: 6,
    steps: [shrimp([375, 245]), puffer([330, 388]), crab([505, 325]), up([330, 388], "a"), up([375, 245], "b"), up([505, 325], "a")],
  },
  {
    name: "suporte com polvo (tinta)",
    level: "recife-1",
    minReef: 4,
    steps: [shrimp([925, 500]), crab([350, 389]), octopus([375, 245]), up([925, 500], "b"), up([350, 389], "a"), up([375, 245], "a")],
  },
  // ------------------------------------------------------------ Recife 2 (sobe à esquerda, dois laços, desce à direita)
  {
    name: "dano: camarões nos laços e no centro + caranguejo no canal",
    level: "recife-2",
    minReef: 8,
    steps: [
      shrimp([268, 206]),
      crab([640, 305]),
      shrimp([1010, 206]),
      up([268, 206], "b"),
      up([1010, 206], "b"),
      shrimp([640, 421]),
      up([640, 305], "a"),
      up([640, 421], "b"),
      up([268, 206], "b"),
    ],
  },
  {
    name: "controle: água-viva elétrica no canal + baiacu na descida + perfuração",
    level: "recife-2",
    minReef: 6,
    steps: [
      shrimp([268, 206]),
      crab([397, 500]),
      jelly([640, 180]),
      up([268, 206], "a"),
      shrimp([1010, 206]),
      up([640, 180], "a"),
      up([1010, 206], "a"),
      puffer([885, 500]),
      up([268, 206], "a"),
    ],
  },
  // ------------------------------------------------------------ Recife 3 (entra à esquerda, três laços, desce à direita)
  {
    name: "dano: camarões meio/norte/laço + caranguejo no canal",
    level: "recife-3",
    minReef: 8,
    steps: [
      shrimp([620, 261]),
      crab([600, 389]),
      shrimp([790, 236]),
      up([620, 261], "b"),
      shrimp([1030, 331]),
      up([790, 236], "b"),
      up([600, 389], "a"),
      up([1030, 331], "b"),
      up([620, 261], "b"),
    ],
  },
  {
    name: "controle: água-viva no laço leste + baiacu na descida",
    level: "recife-3",
    minReef: 6,
    steps: [
      shrimp([620, 261]),
      crab([600, 389]),
      jelly([1000, 130]),
      up([620, 261], "b"),
      shrimp([1030, 331]),
      puffer([910, 541]),
      up([1000, 130], "b"),
      up([1030, 331], "a"),
      up([910, 541], "a"),
    ],
  },
  // ------------------------------------------------------------ Recife 4 (espiral: entra por cima, sai pelo fundo)
  {
    name: "dano: camarões ilha/norte/oeste/leste + caranguejo no fundo da espiral",
    level: "recife-4",
    minReef: 8,
    steps: [
      shrimp([565, 335]),
      crab([550, 435]),
      shrimp([920, 115]),
      up([565, 335], "b"),
      shrimp([150, 235]),
      up([920, 115], "b"),
      shrimp([1060, 300]),
      up([550, 435], "a"),
      up([150, 235], "b"),
      up([1060, 300], "b"),
    ],
  },
  {
    name: "controle: água-viva no arco externo + baiacu na saída",
    level: "recife-4",
    minReef: 6,
    steps: [
      shrimp([565, 335]),
      crab([550, 435]),
      jelly([820, 385]),
      up([565, 335], "b"),
      shrimp([920, 115]),
      puffer([760, 518]),
      up([920, 115], "b"),
      up([820, 385], "a"),
      shrimp([1060, 300]),
      up([760, 518], "a"),
    ],
  },
  // ------------------------------------------------------------ Recife 5 (naufrágio: rota curta em diagonal, dois chefes)
  {
    name: "dano: camarões proa/popa/leste/norte/sudeste + caranguejo sob o casco",
    level: "recife-5",
    minReef: 8,
    steps: [
      shrimp([400, 250]),
      crab([650, 310]),
      shrimp([615, 400]),
      up([400, 250], "b"),
      shrimp([865, 385]),
      up([615, 400], "b"),
      shrimp([595, 135]),
      up([865, 385], "b"),
      up([650, 310], "a"),
      up([595, 135], "b"),
      up([400, 250], "b"),
      shrimp([1065, 420]),
      up([615, 400], "b"),
      up([1065, 420], "b"),
      up([650, 310], "a"),
      up([865, 385], "b"),
    ],
  },
  {
    name: "controle: água-viva na vala + baiacu antes da saída",
    level: "recife-5",
    minReef: 6,
    steps: [
      shrimp([400, 250]),
      crab([650, 310]),
      shrimp([615, 400]),
      up([400, 250], "b"),
      shrimp([865, 385]),
      up([615, 400], "b"),
      jelly([750, 250]),
      puffer([1030, 514]),
      up([865, 385], "b"),
      up([750, 250], "b"),
      up([400, 250], "b"),
      up([1030, 514], "a"),
      shrimp([595, 135]),
      up([615, 400], "b"),
      up([595, 135], "a"),
      up([650, 310], "a"),
    ],
  },
  // ------------------------------------------------------------ Recife 6 (laço em volta do galeão, três chefes)
  {
    name: "dano: camarões convés/nordeste/mastro/casco/sul + caranguejo na quilha",
    level: "recife-6",
    minReef: 8,
    steps: [
      shrimp([760, 270]),
      crab([474, 341]),
      shrimp([885, 240]),
      shrimp([715, 165]),
      up([760, 270], "b"),
      up([474, 341], "a"),
      up([885, 240], "b"),
      shrimp([690, 470]),
      up([715, 165], "b"),
      up([760, 270], "b"),
      up([690, 470], "b"),
      shrimp([440, 435]),
      up([885, 240], "b"),
      up([474, 341], "a"),
      up([440, 435], "b"),
      shrimp([1080, 301]),
      up([715, 165], "b"),
      up([1080, 301], "b"),
    ],
  },
  {
    name: "controle: água-viva no casco + baiacu na saída + perfuração",
    level: "recife-6",
    minReef: 6,
    steps: [
      shrimp([760, 270]),
      crab([474, 341]),
      shrimp([885, 240]),
      up([760, 270], "b"),
      shrimp([715, 165]),
      up([885, 240], "b"),
      jelly([560, 440]),
      puffer([940, 324]),
      up([560, 440], "b"),
      up([715, 165], "a"),
      up([940, 324], "a"),
      shrimp([690, 470]),
      up([760, 270], "b"),
      up([690, 470], "a"),
      shrimp([440, 435]),
      up([885, 240], "b"),
      up([440, 435], "a"),
      up([474, 341], "a"),
    ],
  },
  {
    name: "novatos: camarões + tubarão alfa + tartaruga casco + peixe-pedra",
    level: "recife-6",
    minReef: 6,
    loadout: NEW_LOADOUT,
    steps: [
      shrimp([760, 270]),
      shrimp([885, 240]),
      shark([640, 290]),
      up([760, 270], "b"),
      up([640, 290], "b"),
      turtle([474, 341]),
      up([885, 240], "b"),
      shrimp([715, 165]),
      stonefish([940, 324]),
      up([474, 341], "a"),
      up([715, 165], "b"),
      up([940, 324], "b"),
      up([760, 270], "b"),
      shrimp([690, 470]),
      up([640, 290], "b"),
      up([885, 240], "b"),
      up([690, 470], "b"),
    ],
  },
];

/** Build cru para a checagem de "não é fácil demais". */
export const RAW_BUILD: BalanceBuild = {
  name: "duas unidades cruas",
  level: "recife-1",
  minReef: 0,
  steps: [shrimp([375, 245]), crab([330, 388])],
};
