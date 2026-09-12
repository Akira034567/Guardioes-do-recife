import { describe, expect, it } from "vitest";
import { simulateLevel } from "../src/game/core/Simulation";
import { getLevel } from "../src/game/data/levels";
import { BALANCE_BUILDS, RAW_BUILD, type BalanceBuild } from "./balance-builds";

/**
 * Rede de segurança numérica: o resultado exato de cada roteiro de balanceamento é congelado em
 * snapshot. Qualquer refatoração do motor da partida (extração da `LevelSimulation`, sistemas de
 * status/correntes/ondas) precisa manter estes números; uma mudança deliberada de balanceamento
 * atualiza o snapshot com `npx vitest run tests/match-golden.test.ts -u`.
 */

function golden(build: BalanceBuild) {
  const level = getLevel(build.level);
  if (!level) throw new Error(`Fase desconhecida: ${build.level}`);
  const result = simulateLevel(level, build.steps);
  return {
    state: result.state,
    reef: result.reef,
    pearls: result.pearls,
    guardians: result.guardians,
    upgrades: result.upgrades,
    timeMs: Math.round(result.timeMs),
    wavesCleared: result.wavesCleared,
    kills: result.kills,
    leaks: result.leaks,
    stepsExecuted: result.stepsExecuted,
  };
}

describe("golden match results", () => {
  it.each([...BALANCE_BUILDS, RAW_BUILD].map((build) => [`${build.level} · ${build.name}`, build] as const))(
    "%s",
    (_label, build) => {
      expect(golden(build)).toMatchSnapshot();
    },
  );
});
