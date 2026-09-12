import { describe, expect, it } from "vitest";
import { Match } from "../src/game/core/match/Match";
import { RECIFE_ONE } from "../src/game/data/levels";

function run(match: Match, ms: number): void {
  const ticks = Math.ceil(ms / match.dtMs);
  for (let index = 0; index < ticks; index += 1) match.tick();
}

describe("debug commands", () => {
  it("adds pearls and marks the match as tested", () => {
    const match = new Match(RECIFE_ONE);
    expect(match.stats.cheated).toBe(false);
    expect(match.execute({ type: "debug.addPearls", amount: 100 })).toEqual({ ok: true });
    expect(match.pearls()).toBe(RECIFE_ONE.startingPearls + 100);
    expect(match.stats.cheated, "partida testada não vale progressão").toBe(true);
  });

  it("spawns an enemy on demand, plain or elite", () => {
    const match = new Match(RECIFE_ONE);
    match.execute({ type: "debug.spawnEnemy", enemyId: "swimmer" });
    match.execute({ type: "debug.spawnEnemy", enemyId: "shellback", elite: "armored" });
    expect(match.enemies).toHaveLength(2);
    expect(match.enemies[1].definition.eliteId).toBe("armored");
    expect(match.enemies[1].definition.id, "o id base continua o mesmo").toBe("shellback");
  });

  it("kills everything in the field without paying rewards", () => {
    const match = new Match(RECIFE_ONE);
    match.execute({ type: "debug.spawnEnemy", enemyId: "swimmer" });
    const pearls = match.pearls();
    match.execute({ type: "debug.killAll" });
    match.tick();
    expect(match.enemies).toHaveLength(0);
    expect(match.pearls()).toBe(pearls);
    expect(match.stats.enemiesKilled, "abates de debug não entram nas estatísticas").toBe(0);
  });

  it("skips the current wave and moves on to the next", () => {
    const match = new Match(RECIFE_ONE);
    run(match, 12_000);
    const wave = match.snapshot().wave;
    match.execute({ type: "debug.skipWave" });
    run(match, 100);
    expect(match.snapshot().wave).toBe(wave + 1);
  });

  it("protects the reef while invincibility is on", () => {
    const match = new Match({ ...RECIFE_ONE, reefHealth: 3 });
    match.execute({ type: "debug.invincible", on: true });
    run(match, 120_000);
    expect(match.reef).toBe(3);
    expect(match.stats.enemiesLeaked, "os inimigos passam; o Recife é que não sofre").toBeGreaterThan(0);
    expect(match.stats.livesLost).toBe(0);
  });

  it("refuses every command once the match is over", () => {
    const match = new Match({ ...RECIFE_ONE, reefHealth: 1 });
    run(match, 120_000);
    expect(match.status).toBe("defeat");
    expect(match.execute({ type: "debug.addPearls", amount: 100 })).toMatchObject({ ok: false, reason: "gameOver" });
  });
});
