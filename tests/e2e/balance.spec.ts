import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SimPoint } from "../../src/game/core/Simulation";
import { DEFAULT_LOADOUT, GUARDIANS } from "../../src/game/data/guardians";
import { cardCenterX, HUD_LAYOUT } from "../../src/game/hudLayout";
import type { BranchId, GuardianId } from "../../src/game/types";
import { BALANCE_BUILDS, RAW_BUILD, type BalanceBuild } from "../balance-builds";

/**
 * Sondas de balanceamento (@balance): cada build joga uma fase inteira e precisa
 * vencer perdendo poucas vidas, sem que a fase fique fácil demais. Rode com
 * `npm run test:balance`; os resultados (vidas e pérolas) saem no console.
 * As pérolas necessárias para cada passo são calculadas a partir dos custos em
 * `guardians.ts`, então basta descrever o que comprar e onde.
 */

const CARD_Y = HUD_LAYOUT.cardY;
const OPTION = {
  a: { x: HUD_LAYOUT.optionButtonXs[0], y: HUD_LAYOUT.optionButtonY },
  b: { x: HUD_LAYOUT.optionButtonXs[1], y: HUD_LAYOUT.optionButtonY },
} as const;
const REEF_MAX = 20;

type Point = SimPoint;
type Build = BalanceBuild;
const BUILDS = BALANCE_BUILDS;

/** Coordenada da carta de um Guardião no esquadrão desta build. */
function cardX(loadout: readonly GuardianId[], id: GuardianId): number {
  const slot = loadout.indexOf(id);
  if (slot < 0) throw new Error(`${id} não está no esquadrão ${loadout.join(",")}`);
  return cardCenterX(slot);
}

async function openLevel(page: Page, levelId: string, loadout: readonly GuardianId[]) {
  await page.goto(`/?level=${levelId}&guardians=${loadout.join(",")}`);
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-level", levelId);
  await expect(canvas).toHaveAttribute("data-loadout", loadout.join(","));
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);
  return { canvas, clickGame };
}

const isOver = (state: string | null): boolean => state === "victory" || state === "defeat";
const key = (point: Point): string => `${point[0]},${point[1]}`;

/** Espera pérolas suficientes, mas desiste assim que a partida termina. */
async function waitForPearls(page: Page, canvas: Locator, minimum: number, timeoutMs = 150_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const [pearls, state] = await Promise.all([canvas.getAttribute("data-pearls"), canvas.getAttribute("data-game-state")]);
    if (isOver(state)) return false;
    if (Number(pearls) >= minimum) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function playBuild(page: Page, build: Build) {
  const loadout = build.loadout ?? DEFAULT_LOADOUT;
  const { canvas, clickGame } = await openLevel(page, build.level, loadout);
  const placed = new Map<string, { id: GuardianId; branch: BranchId | null; level: number }>();
  for (const step of build.steps) {
    if ("place" in step) {
      const ready = await waitForPearls(page, canvas, GUARDIANS[step.place].cost);
      if (!ready) break;
      const before = Number(await canvas.getAttribute("data-guardians"));
      await clickGame(cardX(loadout, step.place), CARD_Y);
      await clickGame(step.at[0], step.at[1]);
      await expect(canvas, `${build.name}: posicionar ${step.place} em ${key(step.at)}`).toHaveAttribute("data-guardians", String(before + 1));
      placed.set(key(step.at), { id: step.place, branch: null, level: 0 });
    } else {
      const unit = placed.get(key(step.upgrade));
      if (!unit) throw new Error(`${build.name}: nenhuma unidade em ${key(step.upgrade)}`);
      const branch = GUARDIANS[unit.id].branches.find((candidate) => candidate.id === step.branch)!;
      const ready = await waitForPearls(page, canvas, branch.upgrades[unit.level].cost);
      if (!ready) break;
      const before = Number(await canvas.getAttribute("data-upgrades"));
      await clickGame(step.upgrade[0], step.upgrade[1]);
      await expect(canvas).toHaveAttribute("data-selected", /G\d+/);
      await clickGame(OPTION[step.branch].x, OPTION[step.branch].y);
      await expect(canvas, `${build.name}: upgrade ${step.branch} em ${key(step.upgrade)}`).toHaveAttribute("data-upgrades", String(before + 1));
      unit.branch = step.branch;
      unit.level += 1;
    }
  }
  // Uma fase longa em que pouco morre pode passar de 6 minutos; folga para máquinas lentas.
  await expect(canvas).toHaveAttribute("data-game-state", /victory|defeat/, { timeout: 540_000 });
  const result = {
    state: await canvas.getAttribute("data-game-state"),
    reef: Number(await canvas.getAttribute("data-reef")),
    pearls: Number(await canvas.getAttribute("data-pearls")),
    guardians: Number(await canvas.getAttribute("data-guardians")),
    upgrades: Number(await canvas.getAttribute("data-upgrades")),
  };
  console.log(
    `[balance] ${build.level} · ${build.name} · ${result.state} · vidas ${result.reef}/${REEF_MAX} · pérolas ${result.pearls} · ${result.guardians} unidades / ${result.upgrades} upgrades`,
  );
  return result;
}

for (const build of BUILDS) {
  test(`@balance ${build.level} é vencível com poucas perdas: ${build.name}`, async ({ page }) => {
    test.setTimeout(780_000);
    const result = await playBuild(page, build);
    expect(result.state, `${build.name} deveria vencer`).toBe("victory");
    expect(result.reef, `${build.name} perdeu vidas demais`).toBeGreaterThanOrEqual(build.minReef);
  });
}

test("@balance recife-1 não é fácil demais: duas unidades sem upgrades não vencem sem perder vidas", async ({ page }) => {
  test.setTimeout(780_000);
  const result = await playBuild(page, RAW_BUILD);

  expect(result.state === "victory" && result.reef === REEF_MAX, "fase 1 está fácil demais").toBe(false);
});
