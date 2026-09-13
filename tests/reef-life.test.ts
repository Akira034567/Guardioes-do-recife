import { describe, expect, it } from "vitest";
import { MAX_TICK_MS, ReefInhabitant, type ReefWorld } from "../src/game/core/reef/ReefInhabitant";
import { ReefLife } from "../src/game/core/reef/ReefLife";
import { guardianRank } from "../src/game/core/reef/guardianRank";
import { DEFAULT_HUB_BEHAVIOR, hubBehavior, HUB_BEHAVIORS } from "../src/game/data/reef/hubBehaviors";
import { reefZone, REEF_REST_SPOTS } from "../src/game/data/reef/layout";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";
import type { GuardianId } from "../src/game/types";

const emptyWorld = (pointer: { x: number; y: number } | null = null): ReefWorld => ({
  restSpots: REEF_REST_SPOTS,
  cover: [],
  pointer,
});

/** Roda a criatura por um tempo em passos de 16 ms e devolve todos os retratos. */
function run(inhabitant: ReefInhabitant, ms: number, world: ReefWorld = emptyWorld()) {
  const frames = [];
  for (let elapsed = 0; elapsed < ms; elapsed += 16) {
    inhabitant.tick(16, world);
    frames.push(inhabitant.snapshot());
  }
  return frames;
}

describe("reef life", () => {
  it("registers a behaviour for every guardian and never throws on an unknown one", () => {
    for (const id of GUARDIAN_ORDER) {
      expect(HUB_BEHAVIORS[id], `${id} sem comportamento de hub`).toBeDefined();
      expect(HUB_BEHAVIORS[id].guardianId).toBe(id);
    }
    // Um Guardião novo que alguém esqueceu de cadastrar não pode derrubar o hub.
    const fallback = hubBehavior("guardiao-que-nao-existe");
    expect(fallback.habitat).toBe(DEFAULT_HUB_BEHAVIOR.habitat);
    expect(fallback.speed).toBe(DEFAULT_HUB_BEHAVIOR.speed);
  });

  it("is deterministic for the same seed and different for another", () => {
    const first = new ReefLife({ guardianIds: ["dolphin", "shark"], seed: "recife" });
    const second = new ReefLife({ guardianIds: ["dolphin", "shark"], seed: "recife" });
    const third = new ReefLife({ guardianIds: ["dolphin", "shark"], seed: "outro" });
    for (let step = 0; step < 200; step += 1) {
      first.tick(16, { cover: [], pointer: null });
      second.tick(16, { cover: [], pointer: null });
      third.tick(16, { cover: [], pointer: null });
    }
    expect(second.snapshots()).toEqual(first.snapshots());
    expect(third.snapshots()).not.toEqual(first.snapshots());
  });

  it("keeps every guardian inside its habitat, no matter how long it swims", () => {
    for (const id of GUARDIAN_ORDER) {
      const profile = HUB_BEHAVIORS[id];
      const bounds = reefZone(profile.habitat).bounds;
      const inhabitant = new ReefInhabitant(profile, "recife");
      for (const frame of run(inhabitant, 20_000)) {
        expect(frame.x, `${id} saiu pela esquerda/direita`).toBeGreaterThanOrEqual(bounds.x - 0.001);
        expect(frame.x).toBeLessThanOrEqual(bounds.x + bounds.w + 0.001);
        expect(frame.y, `${id} saiu por cima/baixo`).toBeGreaterThanOrEqual(bounds.y - 0.001);
        expect(frame.y).toBeLessThanOrEqual(bounds.y + bounds.h + 0.001);
      }
    }
  });

  it("makes the roamers roam and the ambusher stay put", () => {
    const spread = (id: GuardianId): number => {
      const frames = run(new ReefInhabitant(HUB_BEHAVIORS[id], "recife"), 30_000);
      const xs = frames.map((frame) => frame.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spread("dolphin")).toBeGreaterThan(40);
    expect(spread("shark")).toBeGreaterThan(40);
    // O Peixe-Pedra é emboscador: ele praticamente não sai do lugar.
    expect(spread("stonefish")).toBeLessThan(8);
  });

  it("runs the pufferfish quirk at a believable pace", () => {
    const frames = run(new ReefInhabitant(HUB_BEHAVIORS.pufferfish, "recife"), 60_000);
    let entries = 0;
    let previous: string | null = null;
    for (const frame of frames) {
      if (frame.quirk === "inflate" && previous !== "inflate") entries += 1;
      previous = frame.quirk;
    }
    expect(entries).toBeGreaterThanOrEqual(3);
    expect(entries).toBeLessThanOrEqual(11);
  });

  it("lets the turtle rest near the corals", () => {
    const inhabitant = new ReefInhabitant(HUB_BEHAVIORS["sea-turtle"], "recife");
    const frames = run(inhabitant, 40_000);
    const resting = frames.filter((frame) => frame.state === "rest");
    expect(resting.length).toBeGreaterThan(0);
    const coralSpots = REEF_REST_SPOTS.filter((spot) => spot.habitat === "nearCoral");
    const last = resting.at(-1)!;
    const near = coralSpots.some((spot) => Math.hypot(spot.at.x - last.x, spot.at.y - last.y) <= spot.radius + 2);
    expect(near).toBe(true);
  });

  it("reacts to the cursor the way each guardian should", () => {
    const distanceAfter = (id: GuardianId, pointer: { x: number; y: number }): { before: number; after: number } => {
      const inhabitant = new ReefInhabitant(HUB_BEHAVIORS[id], "recife");
      const start = inhabitant.snapshot();
      const before = Math.hypot(pointer.x - start.x, pointer.y - start.y);
      const frames = run(inhabitant, 2000, emptyWorld(pointer));
      const end = frames.at(-1)!;
      return { before, after: Math.hypot(pointer.x - end.x, pointer.y - end.y) };
    };

    // O golfinho vem ver quem chegou.
    const dolphinStart = new ReefInhabitant(HUB_BEHAVIORS.dolphin, "recife").snapshot();
    const dolphin = distanceAfter("dolphin", { x: dolphinStart.x + 16, y: dolphinStart.y + 8 });
    expect(dolphin.after).toBeLessThan(dolphin.before);

    // O baiacu se afasta.
    const pufferStart = new ReefInhabitant(HUB_BEHAVIORS.pufferfish, "recife").snapshot();
    const puffer = distanceAfter("pufferfish", { x: pufferStart.x + 3, y: pufferStart.y });
    expect(puffer.after).toBeGreaterThan(puffer.before);

    // O tubarão ignora: o trajeto é o mesmo com e sem cursor.
    const sharkStart = new ReefInhabitant(HUB_BEHAVIORS.shark, "recife").snapshot();
    const withPointer = run(new ReefInhabitant(HUB_BEHAVIORS.shark, "recife"), 2000, emptyWorld({ x: sharkStart.x, y: sharkStart.y })).at(-1)!;
    const without = run(new ReefInhabitant(HUB_BEHAVIORS.shark, "recife"), 2000).at(-1)!;
    expect(withPointer.x).toBeCloseTo(without.x, 6);
    expect(withPointer.y).toBeCloseTo(without.y, 6);
  });

  it("sends the crab to the nearest rock when it flees", () => {
    const rock = { x: 26, y: 80, kind: "rock" as const };
    const inhabitant = new ReefInhabitant(HUB_BEHAVIORS["reef-crab"], "recife");
    const start = inhabitant.snapshot();
    const world: ReefWorld = { restSpots: REEF_REST_SPOTS, cover: [rock], pointer: { x: start.x - 2, y: start.y } };
    const end = run(inhabitant, 3000, world).at(-1)!;
    expect(Math.hypot(rock.x - end.x, rock.y - end.y)).toBeLessThan(Math.hypot(rock.x - start.x, rock.y - start.y));
  });

  it("never lets a frame spike teleport anyone", () => {
    const profile = HUB_BEHAVIORS.dolphin;
    const inhabitant = new ReefInhabitant(profile, "recife");
    const before = inhabitant.snapshot();
    inhabitant.tick(500, emptyWorld());
    const after = inhabitant.snapshot();
    const travelled = Math.hypot(after.x - before.x, after.y - before.y);
    const ceiling = (profile.speed * (1 + profile.speedJitter) * MAX_TICK_MS) / 1000 + 0.001;
    expect(travelled).toBeLessThanOrEqual(ceiling);
  });

  it("gives every guardian its own bob phase", () => {
    const offsets = GUARDIAN_ORDER.map((id) => new ReefInhabitant(HUB_BEHAVIORS[id], "recife").snapshot().bobOffset);
    expect(new Set(offsets.map((value) => value.toFixed(6))).size).toBe(GUARDIAN_ORDER.length);
    for (const id of GUARDIAN_ORDER) {
      const profile = HUB_BEHAVIORS[id];
      for (const frame of run(new ReefInhabitant(profile, "recife"), 8000)) {
        expect(Math.abs(frame.bobOffset)).toBeLessThanOrEqual(profile.bob.amplitude + 0.001);
      }
    }
  });

  it("swaps residents without disturbing the ones already swimming", () => {
    const life = new ReefLife({ guardianIds: ["dolphin", "shark"], seed: "recife" });
    for (let step = 0; step < 60; step += 1) life.tick(16, { cover: [], pointer: null });
    const dolphinBefore = life.snapshots().find((snapshot) => snapshot.guardianId === "dolphin");

    life.setResidents(["dolphin", "sea-turtle"]);
    expect(life.size).toBe(2);
    expect(life.snapshots().map((snapshot) => snapshot.guardianId)).toEqual(["dolphin", "sea-turtle"]);
    expect(life.snapshots().find((snapshot) => snapshot.guardianId === "dolphin")).toEqual(dolphinBefore);
  });

  it("ranks a guardian by the matches it actually played", () => {
    expect(guardianRank(undefined).id).toBe("novato");
    expect(guardianRank({ matches: 4, kills: 0, damage: 0, placements: 0, upgrades: 0 }).id).toBe("novato");
    expect(guardianRank({ matches: 5, kills: 0, damage: 0, placements: 0, upgrades: 0 }).id).toBe("veterano");
    expect(guardianRank({ matches: 15, kills: 0, damage: 0, placements: 0, upgrades: 0 }).id).toBe("guardiao");
    const legend = guardianRank({ matches: 40, kills: 0, damage: 0, placements: 0, upgrades: 0 });
    expect(legend.id).toBe("lenda");
    expect(legend.nextAt).toBeNull();
  });
});
