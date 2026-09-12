import { describe, expect, it } from "vitest";
import { TutorialDirector, TUTORIAL_STEPS, type TutorialContext } from "../src/game/core/tutorial/TutorialDirector";

const context = (patch: Partial<TutorialContext> = {}): TutorialContext => ({
  levelId: "recife-1",
  waveIndex: 0,
  waveRunning: false,
  pearls: 180,
  guardiansPlaced: 0,
  upgradesBought: 0,
  cardSelected: false,
  unitSelected: false,
  speed: 1,
  ...patch,
});

const fresh = (): TutorialDirector => new TutorialDirector({ completedSteps: [], done: false, skipped: false });

describe("tutorial director", () => {
  it("começa pedindo a escolha de uma carta", () => {
    expect(fresh().update(context())?.id).toBe("pick-card");
  });

  it("avança conforme o jogador age", () => {
    const director = fresh();
    expect(director.update(context())?.id).toBe("pick-card");
    expect(director.update(context({ cardSelected: true }))?.id).toBe("place-guardian");
    expect(director.update(context({ guardiansPlaced: 1 }))?.id).toBe("wave-start");
    expect(director.update(context({ guardiansPlaced: 1, waveRunning: true }))?.id).toBe("select-unit");
    expect(director.update(context({ guardiansPlaced: 1, waveRunning: true, unitSelected: true }))?.id).toBe("buy-upgrade");
    expect(director.update(context({ guardiansPlaced: 1, waveRunning: true, upgradesBought: 1 }))?.id).toBe("use-speed");
  });

  it("termina quando todos os passos foram cumpridos", () => {
    const director = fresh();
    const done = context({ cardSelected: true, guardiansPlaced: 2, waveRunning: true, unitSelected: true, upgradesBought: 1, speed: 2 });
    expect(director.update(done)).toBeNull();
    expect(director.isOver).toBe(true);
    expect(director.state.done).toBe(true);
    expect(director.state.completedSteps).toHaveLength(TUTORIAL_STEPS.length);
  });

  it("não aparece fora da primeira fase", () => {
    expect(fresh().update(context({ levelId: "recife-4" }))).toBeNull();
  });

  it("some de vez quando o jogador pula", () => {
    const director = fresh();
    director.skip();
    expect(director.update(context())).toBeNull();
    expect(director.state.skipped).toBe(true);
  });

  it("retoma de onde parou em uma partida seguinte", () => {
    const director = new TutorialDirector({ completedSteps: ["pick-card", "place-guardian"], done: false, skipped: false });
    expect(director.update(context({ guardiansPlaced: 1 }))?.id).toBe("wave-start");
  });

  it("não repete um passo que o jogador já cumpriu por conta própria", () => {
    const director = fresh();
    // Colocou dois Guardiões antes de qualquer dica aparecer: os dois primeiros passos já valem.
    expect(director.update(context({ guardiansPlaced: 2 }))?.id).toBe("wave-start");
  });

  it("segura a dica até o momento certo dela", () => {
    const director = new TutorialDirector({ completedSteps: ["pick-card"], done: false, skipped: false });
    // "place-guardian" só aparece com a carta na mão; sem ela, nada é mostrado.
    expect(director.update(context())).toBeNull();
  });
});
