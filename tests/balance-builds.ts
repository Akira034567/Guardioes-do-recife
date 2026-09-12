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
    minReef: 10,
    loadout: NEW_LOADOUT,
    steps: [shrimp([375, 245]), shark([300, 470]), turtle([330, 388]), up([300, 470], "b"), up([330, 388], "a"), up([375, 245], "b")],
  },
  {
    name: "novatos: tubarão frenesi + peixe-pedra emboscada + camarão",
    level: "recife-1",
    minReef: 10,
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
  // ------------------------------------------------------------ Recife 2 · Guardiões novos
  {
    name: "novatos: camarões + tubarão frenesi na entrada + tartaruga corrente",
    level: "recife-2",
    minReef: 12,
    loadout: NEW_LOADOUT,
    steps: [
      shrimp([1080, 385]),
      shark([1150, 260]),
      shrimp([600, 340]),
      up([1150, 260], "a"),
      turtle([910, 395]),
      up([1080, 385], "b"),
      up([910, 395], "b"),
      up([600, 340], "b"),
      up([1150, 260], "a"),
    ],
  },
  {
    name: "novatos: tubarão alfa + camarões + golfinho sonar",
    level: "recife-2",
    minReef: 10,
    loadout: NEW_LOADOUT,
    steps: [
      shrimp([1080, 385]),
      shark([1150, 260]),
      up([1150, 260], "b"),
      shrimp([600, 340]),
      up([1080, 385], "b"),
      dolphin([720, 300]),
      up([720, 300], "b"),
      up([600, 340], "b"),
      up([1150, 260], "b"),
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
  // ------------------------------------------------------------ Recife 2 (entra pela direita)
  {
    name: "dano: camarões oeste/central/leste + caranguejo na entrada",
    level: "recife-2",
    minReef: 8,
    steps: [
      shrimp([250, 380]),
      crab([1190, 195]),
      shrimp([600, 340]),
      up([250, 380], "b"),
      up([600, 340], "b"),
      shrimp([1080, 385]),
      up([1190, 195], "a"),
      up([1080, 385], "b"),
      up([250, 380], "b"),
    ],
  },
  {
    name: "controle: água-viva elétrica na descida + baiacu + perfuração",
    level: "recife-2",
    minReef: 6,
    steps: [
      shrimp([250, 380]),
      crab([1190, 195]),
      jelly([800, 300]),
      up([250, 380], "a"),
      shrimp([600, 340]),
      up([800, 300], "a"),
      up([600, 340], "a"),
      puffer([270, 240]),
      up([250, 380], "a"),
    ],
  },
  // ------------------------------------------------------------ Recife 3 (entra por cima, sai à esquerda)
  {
    name: "dano: camarões meio/norte/centro + caranguejo",
    level: "recife-3",
    minReef: 8,
    steps: [
      shrimp([560, 390]),
      crab([360, 250]),
      shrimp([420, 120]),
      up([560, 390], "b"),
      shrimp([760, 300]),
      up([420, 120], "b"),
      up([360, 250], "a"),
      up([760, 300], "b"),
      up([560, 390], "b"),
    ],
  },
  {
    name: "controle: água-viva na descida + baiacu no fundo",
    level: "recife-3",
    minReef: 6,
    steps: [
      shrimp([560, 390]),
      crab([360, 250]),
      jelly([880, 330]),
      up([560, 390], "b"),
      shrimp([420, 120]),
      puffer([640, 510]),
      up([880, 330], "b"),
      up([420, 120], "a"),
      up([640, 510], "a"),
    ],
  },
  // ------------------------------------------------------------ Recife 4 (U com correntes cruzadas)
  {
    name: "dano: camarões fundo/centro/oeste/leste + caranguejo",
    level: "recife-4",
    minReef: 8,
    steps: [
      shrimp([560, 400]),
      crab([640, 545]),
      shrimp([800, 390]),
      up([560, 400], "b"),
      shrimp([240, 300]),
      up([800, 390], "b"),
      shrimp([1120, 320]),
      up([640, 545], "a"),
      up([240, 300], "b"),
      up([1120, 320], "b"),
    ],
  },
  {
    name: "controle: água-viva no fundo + baiacu na contra-maré",
    level: "recife-4",
    minReef: 6,
    steps: [
      shrimp([560, 400]),
      crab([640, 545]),
      jelly([700, 420]),
      up([560, 400], "b"),
      shrimp([800, 390]),
      puffer([910, 445]),
      up([800, 390], "b"),
      up([700, 420], "a"),
      shrimp([240, 300]),
      up([910, 445], "a"),
    ],
  },
  // ------------------------------------------------------------ Recife 5 (rota longa, dois chefes)
  {
    name: "dano: camarões norte/oeste/leste/alto + caranguejo",
    level: "recife-5",
    minReef: 8,
    steps: [
      shrimp([420, 290]),
      crab([230, 480]),
      shrimp([120, 400]),
      up([420, 290], "b"),
      shrimp([780, 300]),
      up([120, 400], "b"),
      shrimp([1140, 330]),
      up([780, 300], "b"),
      up([230, 480], "a"),
      up([1140, 330], "b"),
      up([420, 290], "b"),
    ],
  },
  {
    name: "controle: água-viva no sul + baiacu antes da saída",
    level: "recife-5",
    minReef: 6,
    steps: [
      shrimp([420, 290]),
      crab([230, 480]),
      shrimp([120, 400]),
      up([420, 290], "b"),
      jelly([1000, 520]),
      shrimp([1140, 330]),
      puffer([960, 410]),
      up([1000, 520], "b"),
      up([1140, 330], "b"),
      up([120, 400], "a"),
      up([960, 410], "a"),
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
