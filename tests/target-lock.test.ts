import { describe, expect, it } from "vitest";
import { GuardianStateMachine } from "../src/game/core/GuardianStateMachine";
import { MatchGuardian } from "../src/game/core/match/MatchGuardian";
import { GUARDIANS } from "../src/game/data/guardians";
import { FakeEnemy } from "./helpers/fakes";
import type { MatchEnemy } from "../src/game/core/match/MatchEnemy";

const timings = { windupMs: 100, attackMs: 120, impactAtMs: 40, recoveryMs: 200 };

/** Camarão num ponto fixo, com alcance conhecido, para mover o inimigo para dentro e para fora. */
function shrimpAt(x: number, y: number): MatchGuardian {
  return new MatchGuardian("G1", GUARDIANS["pistol-shrimp"], { x, y, routeDistance: null, platformId: "p1" }, "p1", 0);
}

describe("trava de alvo", () => {
  it("conclui o golpe mesmo com o alvo já fora do alcance", () => {
    // O ALCANCE SERVE PARA ADQUIRIR O ALVO. Depois disso o golpe vai até o fim: antes, um inimigo
    // que apenas passava de largada cancelava o ataque no meio e a animação quebrava.
    const guardian = shrimpAt(100, 0);
    const enemy = new FakeEnemy("E1", "swimmer", 100) as unknown as MatchEnemy;
    const impacts: string[] = [];
    const onImpact = (_g: MatchGuardian, target: MatchEnemy): void => void impacts.push(target.id);

    guardian.tick(0, [enemy], onImpact);
    expect(guardian.state).toBe("windup");

    // O inimigo foge para muito longe, ainda vivo.
    (enemy as unknown as FakeEnemy).setPathDistance(5000);
    for (let now = 20; now <= 600; now += 20) guardian.tick(now, [enemy], onImpact);

    expect(impacts).toEqual(["E1"]);
  });

  it("cancela quando o alvo morre antes do impacto", () => {
    const guardian = shrimpAt(100, 0);
    const enemy = new FakeEnemy("E1", "swimmer", 100) as unknown as MatchEnemy;
    const impacts: string[] = [];
    const onImpact = (_g: MatchGuardian, target: MatchEnemy): void => void impacts.push(target.id);

    guardian.tick(0, [enemy], onImpact);
    (enemy as unknown as FakeEnemy).dead = true;
    guardian.tick(20, [enemy], onImpact);

    expect(guardian.state).toBe("idle");
    expect(impacts).toEqual([]);
  });

  it("cancela quando o alvo chega ao Recife", () => {
    const guardian = shrimpAt(100, 0);
    const enemy = new FakeEnemy("E1", "swimmer", 100) as unknown as MatchEnemy;
    const impacts: string[] = [];
    const onImpact = (_g: MatchGuardian, target: MatchEnemy): void => void impacts.push(target.id);

    guardian.tick(0, [enemy], onImpact);
    (enemy as unknown as FakeEnemy).reachedGoal = true;
    guardian.tick(20, [enemy], onImpact);

    expect(guardian.state).toBe("idle");
    expect(impacts).toEqual([]);
  });

  it("volta a exigir alcance para adquirir o alvo seguinte", () => {
    // A trava vale por ataque. Terminado o golpe, quem está longe demais não é escolhido de novo.
    const guardian = shrimpAt(100, 0);
    const far = new FakeEnemy("E1", "swimmer", 100) as unknown as MatchEnemy;
    const onImpact = (): void => {};

    guardian.tick(0, [far], onImpact);
    (far as unknown as FakeEnemy).setPathDistance(5000);
    for (let now = 20; now <= 2000; now += 20) guardian.tick(now, [far], onImpact);

    // Sem ninguém ao alcance, ele descansa em vez de reengajar quem fugiu.
    expect(guardian.state).toBe("idle");
    expect(guardian.targetId).toBeNull();
  });

  it("o alcance continua fora do contrato da FSM", () => {
    // A FSM nunca soube de alcance — ela só obedece ao `targetIsValid` de quem a chama. Este teste
    // fixa o contrato: alvo vivo e em campo mantém o golpe, independentemente de onde ele esteja.
    const fsm = new GuardianStateMachine(timings);
    fsm.beginAttack("E1", 0);
    fsm.update(100, true);
    expect(fsm.state).toBe("attack");
    const impacts = fsm.update(140, true).filter((event) => event.type === "impact");
    expect(impacts).toHaveLength(1);
  });
});
