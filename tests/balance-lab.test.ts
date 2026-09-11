import { describe, it } from "vitest";
import { RoutePath } from "../src/game/core/RoutePath";
import { ECONOMY } from "../src/game/data/balance";
import { ENEMIES, scaleEnemy } from "../src/game/data/enemies";
import { LEVELS } from "../src/game/data/levels";

// Laboratório temporário: geometria e orçamento de cada fase.
describe("balance lab", () => {
  it("prints geometry and budgets", () => {
    for (const level of LEVELS) {
      const route = new RoutePath(level.waypoints);
      const samples: Array<{ x: number; y: number }> = [];
      for (let d = 0; d <= route.totalLength; d += 4) samples.push(route.getPointAtDistance(d));
      const coverage = level.placements
        .map((p) => {
          const c188 = samples.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) <= 188).length * 4;
          const c150 = samples.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) <= 150).length * 4;
          return `${p.id}(${p.x},${p.y})=${c188}/${c150}`;
        })
        .join(" ");
      let hpTotal = 0;
      let rewardTotal = 0;
      const waves = level.waves.map((wave, i) => {
        let hp = 0;
        let reward = 0;
        let count = 0;
        wave.groups.forEach((g) => {
          const e = scaleEnemy(ENEMIES[g.enemyId], level.enemyScaling, level.enemyOverrides?.[g.enemyId]);
          hp += g.count * e.maxHealth;
          reward += g.count * e.reward;
          count += g.count;
        });
        hpTotal += hp;
        rewardTotal += reward + ECONOMY.waveClearBonus;
        return `W${i + 1}:${count}en/${hp}hp/${reward}p`;
      });
      console.log(`[lab] ${level.id} start=${level.startingPearls} route=${route.totalLength.toFixed(0)} hp=${hpTotal} income=${rewardTotal} ratio=${(hpTotal / (rewardTotal + level.startingPearls)).toFixed(2)}`);
      console.log(`[lab]   waves: ${waves.join(" ")}`);
      console.log(`[lab]   coverage(188/150): ${coverage}`);
    }
  });
});
