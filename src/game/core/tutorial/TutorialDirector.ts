/**
 * Tutorial progressivo (item 30). Só decide *o que* mostrar; quem desenha é a `UIScene`. Nada aqui
 * bloqueia o jogo: cada passo é uma dica que some sozinha quando o jogador faz a ação.
 */
export interface TutorialContext {
  /** Fase em curso, para limitar o tutorial à primeira. */
  levelId: string;
  waveIndex: number;
  waveRunning: boolean;
  pearls: number;
  guardiansPlaced: number;
  upgradesBought: number;
  /** Carta escolhida na barra de baixo, ainda sem posicionar. */
  cardSelected: boolean;
  /** Unidade já posicionada que está em foco no painel. */
  unitSelected: boolean;
  speed: number;
}

export interface TutorialStep {
  id: string;
  text: string;
  /** Controle do HUD que a dica está mencionando, por nome do `UiRegistry`. */
  highlight?: string;
  /** Só aparece quando isto é verdade (além de não estar concluído). */
  when?(context: TutorialContext): boolean;
  /** Concluído para sempre quando isto é verdade. */
  done(context: TutorialContext): boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "pick-card",
    text: "Escolha um Guardião na barra de baixo.",
    highlight: "card:first",
    done: (context) => context.cardSelected || context.guardiansPlaced > 0,
  },
  {
    id: "place-guardian",
    text: "Agora toque em uma plataforma de pedra para posicioná-lo. O círculo verde mostra o alcance.",
    when: (context) => context.cardSelected || context.guardiansPlaced > 0,
    done: (context) => context.guardiansPlaced > 0,
  },
  {
    id: "wave-start",
    text: "A onda começa sozinha. Para adiantar e ganhar tempo, use INICIAR PRÓXIMA ONDA.",
    highlight: "nextWave",
    when: (context) => context.guardiansPlaced > 0,
    done: (context) => context.waveRunning || context.waveIndex > 0,
  },
  {
    id: "select-unit",
    text: "Toque em um Guardião do mapa para ver os dois ramos de evolução dele.",
    when: (context) => context.waveIndex > 0 || context.waveRunning,
    done: (context) => context.unitSelected || context.upgradesBought > 0,
  },
  {
    id: "buy-upgrade",
    text: "Com pérolas na mão, compre uma evolução. O ramo escolhido fecha o outro nesta unidade.",
    highlight: "upgrade:a",
    when: (context) => context.unitSelected || context.upgradesBought > 0,
    done: (context) => context.upgradesBought > 0,
  },
  {
    id: "use-speed",
    text: "O botão de velocidade alterna entre 1× e 2×. Ⅱ pausa e mostra o mapa com o menu ao lado.",
    highlight: "speed",
    when: (context) => context.upgradesBought > 0,
    done: (context) => context.speed > 1,
  },
];

export interface TutorialState {
  completedSteps: string[];
  done: boolean;
  skipped: boolean;
}

/** Fases em que o tutorial aparece. Fora delas ele nunca interrompe. */
export const TUTORIAL_LEVEL_ID = "recife-1";

export interface ActiveTutorialStep {
  id: string;
  text: string;
  highlight: string | null;
  /** Posição do passo na sequência, para o "2 de 6". */
  index: number;
  total: number;
}

/**
 * Estado do tutorial entre um quadro e o próximo. Recebe o contexto, marca o que foi cumprido e
 * devolve o passo que deve estar na tela (ou `null`).
 */
export class TutorialDirector {
  private readonly completed: Set<string>;
  private skipped: boolean;
  private finished: boolean;

  constructor(
    state: TutorialState,
    private readonly steps: TutorialStep[] = TUTORIAL_STEPS,
  ) {
    this.completed = new Set(state.completedSteps);
    this.skipped = state.skipped;
    this.finished = state.done;
  }

  get isOver(): boolean {
    return this.finished || this.skipped;
  }

  get state(): TutorialState {
    return { completedSteps: [...this.completed], done: this.finished, skipped: this.skipped };
  }

  skip(): void {
    this.skipped = true;
  }

  /** Avança o tutorial e devolve o passo visível. Chamar a cada atualização do HUD. */
  update(context: TutorialContext): ActiveTutorialStep | null {
    if (this.isOver || context.levelId !== TUTORIAL_LEVEL_ID) return null;
    // Um passo cumprido fora de ordem (o jogador já sabe jogar) também conta como feito.
    this.steps.forEach((step) => {
      if (step.done(context)) this.completed.add(step.id);
    });
    const index = this.steps.findIndex((step) => !this.completed.has(step.id));
    if (index < 0) {
      this.finished = true;
      return null;
    }
    const step = this.steps[index];
    if (step.when && !step.when(context)) return null;
    return { id: step.id, text: step.text, highlight: step.highlight ?? null, index, total: this.steps.length };
  }
}
