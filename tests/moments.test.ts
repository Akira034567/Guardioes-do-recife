import { describe, expect, it } from "vitest";
import { MomentQueue, MOMENT_GAP_MS, MOMENT_HOLD_MS, MOMENTS, momentsFor, priorityOf, type MomentSignals } from "../src/game/core/tutorial/Moments";
import { LESSONS_BY_ID } from "../src/game/data/school";

const quiet: MomentSignals = {
  guardiansOnField: [],
  activeStatuses: [],
  enemyRoles: [],
  hasCurrentZone: false,
  hasCloakedEnemy: false,
};

describe("catálogo de momentos", () => {
  it("todo momento aponta para uma aula que existe", () => {
    for (const moment of MOMENTS) {
      expect(LESSONS_BY_ID.has(moment.lessonId), `${moment.id} → ${moment.lessonId}`).toBe(true);
    }
  });

  it("não repete id", () => {
    const ids = MOMENTS.map((moment) => moment.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ensina o campo antes da unidade que o jogador escolheu", () => {
    const ids = momentsFor({ ...quiet, hasCurrentZone: true, guardiansOnField: ["pistol-shrimp"] });
    expect(ids.indexOf("momento-correnteza")).toBeLessThan(ids.indexOf("momento-guardiao-pistol-shrimp"));
  });

  /** O que some da tela em segundos vem antes do que fica a fase inteira. */
  it("põe o efeito passageiro à frente da correnteza permanente", () => {
    expect(priorityOf("momento-status-poison")).toBeLessThan(priorityOf("momento-correnteza"));
    expect(priorityOf("momento-camuflado")).toBeLessThan(priorityOf("momento-cardume"));
    expect(priorityOf("momento-correnteza")).toBeLessThan(priorityOf("momento-guardiao-dolphin"));
  });
});

describe("fila de momentos", () => {
  it("solta o primeiro momento assim que o sinal aparece", () => {
    const queue = new MomentQueue();
    const moment = queue.update(0, { ...quiet, guardiansOnField: ["ink-octopus"] });
    expect(moment?.id).toBe("momento-guardiao-ink-octopus");
  });

  it("segura o segundo até a faixa sair e o intervalo passar", () => {
    const queue = new MomentQueue();
    const signals: MomentSignals = { ...quiet, activeStatuses: ["poison", "slow"] };
    const first = queue.update(0, signals);
    expect(first?.id).toBe("momento-status-poison");
    // Enquanto a faixa está na tela, continua a mesma frase.
    expect(queue.update(MOMENT_HOLD_MS - 1, signals)?.id).toBe("momento-status-poison");
    // Saiu da tela, mas o intervalo ainda não passou: silêncio.
    expect(queue.update(MOMENT_HOLD_MS, signals)).toBeNull();
    expect(queue.update(MOMENT_HOLD_MS + MOMENT_GAP_MS - 1, signals)).toBeNull();
    expect(queue.update(MOMENT_HOLD_MS + MOMENT_GAP_MS, signals)?.id).toBe("momento-status-slow");
  });

  it("nunca repete um momento já ensinado, nem em outra partida", () => {
    const first = new MomentQueue();
    first.update(0, { ...quiet, enemyRoles: ["boss"] });
    expect(first.seenIds).toContain("momento-chefe");

    const later = new MomentQueue(first.seenIds);
    expect(later.update(0, { ...quiet, enemyRoles: ["boss"] })).toBeNull();
  });

  it("calado não gasta os momentos: eles esperam a vez", () => {
    const queue = new MomentQueue();
    const signals: MomentSignals = { ...quiet, hasCurrentZone: true };
    expect(queue.update(0, signals, true)).toBeNull();
    expect(queue.seenIds).toEqual([]);
    expect(queue.update(1000, signals, false)?.id).toBe("momento-correnteza");
  });

  it("PULAR tira da tela e cala pelo intervalo", () => {
    const queue = new MomentQueue();
    const signals: MomentSignals = { ...quiet, activeStatuses: ["stun", "poison"] };
    queue.update(0, signals);
    queue.dismiss(500);
    expect(queue.update(500, signals)).toBeNull();
    expect(queue.update(500 + MOMENT_GAP_MS, signals)?.id).toBe("momento-status-poison");
  });

  /**
   * A regressão que a sonda em campo pegou: com fila FIFO, a aula do veneno esperava atrás de cinco
   * aulas de campo — quase dois minutos — enquanto o ícone estava na tela naquele instante.
   */
  it("solta o urgente na frente mesmo que ele tenha entrado depois", () => {
    const queue = new MomentQueue();
    const campo: MomentSignals = { ...quiet, hasCurrentZone: true, enemyRoles: ["swarm", "armored", "fast"] };
    expect(queue.update(0, campo)?.id).toBe("momento-cardume");
    // Agora o veneno aparece em campo, com quatro aulas de campo ainda na fila.
    const comVeneno: MomentSignals = { ...campo, activeStatuses: ["poison"] };
    // A faixa sai neste quadro (a fila só percebe a expiração quando é chamada, como no jogo a 10 Hz).
    expect(queue.update(MOMENT_HOLD_MS, comVeneno)).toBeNull();
    expect(queue.update(MOMENT_HOLD_MS + MOMENT_GAP_MS, comVeneno)?.id).toBe("momento-status-poison");
  });

  it("marca como visto ao entrar na tela, não ao sair", () => {
    const queue = new MomentQueue();
    queue.update(0, { ...quiet, hasCloakedEnemy: true });
    // O jogador fecharia o jogo aqui: o id já está gravado.
    expect(queue.seenIds).toContain("momento-camuflado");
  });
});
