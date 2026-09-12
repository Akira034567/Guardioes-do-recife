import { describe, expect, it } from "vitest";
import { simulateLevel } from "../src/game/core/Simulation";
import { getLevel } from "../src/game/data/levels";
import { BALANCE_BUILDS } from "./balance-builds";

/**
 * A partida precisa ser determinística (mesmo roteiro → mesmo resultado) para o balanceamento
 * headless valer no jogo real e para sincronização cooperativa no futuro. Aleatoriedade só entra
 * pelo `Rng` semeado do motor, nunca por `Math.random` dentro de `src/game/core`.
 */

const CORE_SOURCES = import.meta.glob("/src/game/core/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("determinism", () => {
  it("never uses Math.random inside the pure core", () => {
    const files = Object.keys(CORE_SOURCES);
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((file) => !file.endsWith("/Rng.ts") && /Math\.random\(/.test(CORE_SOURCES[file]));
    expect(offenders).toEqual([]);
  });

  it("produces the same result when the same script is played twice", () => {
    const build = BALANCE_BUILDS[0];
    const level = getLevel(build.level);
    if (!level) throw new Error(`Fase desconhecida: ${build.level}`);
    const first = simulateLevel(level, build.steps);
    const second = simulateLevel(level, build.steps);
    expect(second).toEqual(first);
  });
});
