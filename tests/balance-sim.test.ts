import { describe, expect, it } from "vitest";
import { simulateLevel, type SimResult } from "../src/game/core/Simulation";
import { getLevel } from "../src/game/data/levels";
import { BALANCE_BUILDS, RAW_BUILD, type BalanceBuild } from "./balance-builds";

/**
 * Contrato de balanceamento: cada fase deve ser vencível por builds diversos
 * perdendo poucas vidas (simulação headless, determinística). Rode com
 * `npx vitest run tests/balance-sim.test.ts` para ver a tabela completa.
 */

const REEF_MAX = 20;

function play(build: BalanceBuild): SimResult {
  const level = getLevel(build.level);
  if (!level) throw new Error(`Fase desconhecida: ${build.level}`);
  return simulateLevel(level, build.steps);
}

function describeResult(build: BalanceBuild, result: SimResult): string {
  const leaks = Object.entries(result.leaks)
    .map(([id, count]) => `${id}×${count}`)
    .join(" ");
  return `${build.level} · ${build.name} · ${result.state} · vidas ${result.reef}/${REEF_MAX} · pérolas ${result.pearls} · ${result.guardians} un / ${result.upgrades} up · ${(result.timeMs / 1000).toFixed(0)}s · vazou: ${leaks || "-"}`;
}

describe("balance simulation", () => {
  const results = BALANCE_BUILDS.map((build) => ({ build, result: play(build) }));

  it("prints the balance table", () => {
    results.forEach(({ build, result }) => console.log(`[sim] ${describeResult(build, result)}`));
    expect(results.length).toBeGreaterThan(0);
  });

  describe.each(results.map(({ build, result }) => [`${build.level} · ${build.name}`, build, result] as const))(
    "%s",
    (_label, build, result) => {
      it("wins", () => {
        expect(result.state, describeResult(build, result)).toBe("victory");
      });
      it("keeps enough reef lives", () => {
        expect(result.reef, describeResult(build, result)).toBeGreaterThanOrEqual(build.minReef);
      });
    },
  );

  it("is not trivial: two raw units do not win flawlessly on Recife 1", () => {
    const result = play(RAW_BUILD);
    console.log(`[sim] ${describeResult(RAW_BUILD, result)}`);
    expect(result.state === "victory" && result.reef === REEF_MAX).toBe(false);
  });
});
