import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { simulateLevel } from "../src/game/core/Simulation";
import { getLevel } from "../src/game/data/levels";
import { BALANCE_BUILDS } from "./balance-builds";

/**
 * A partida precisa ser determinística (mesmo roteiro → mesmo resultado) para o balanceamento
 * headless valer no jogo real e para sincronização cooperativa no futuro. Aleatoriedade só entra
 * pelo `Rng` semeado do motor, nunca por `Math.random` dentro de `src/game/core`.
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("determinism", () => {
  it("never uses Math.random inside the pure core", () => {
    const offenders = walk(join(__dirname, "..", "src", "game", "core")).filter((file) => /Math\.random/.test(readFileSync(file, "utf8")));
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
