import { expect, test, type Page } from "@playwright/test";

/** Coordenadas do HUD (ver `HUD_LAYOUT` em UIScene) e do menu de fases. */
const CARD_Y = 672;
const CARD_X = { shrimp: 62, jellyfish: 180, pufferfish: 298, crab: 416, octopus: 534 } as const;
const OPTION_A = { x: 690, y: 692 } as const;
const OPTION_B = { x: 800, y: 692 } as const;
const SELL = { x: 980, y: 692 } as const;
const SKIP = { x: 1078, y: 640 } as const;
const RESTART = { x: 1190, y: 640 } as const;
const MENU = { x: 1190, y: 684 } as const;
const PAUSE = { x: 1143, y: 36 } as const;
const RESULT_NEXT = { x: 640, y: 408 } as const;
const MENU_CARD_BUTTON = (index: number) => ({ x: 156 + index * 242, y: 478 });

async function openGame(page: Page, query = "level=recife-1") {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`/?${query}`);
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);
  return { canvas, clickGame, pageErrors };
}

test("loads a level directly and places a shrimp on a platform", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);
  await expect(canvas).toHaveAttribute("data-screen", "game");
  await expect(canvas).toHaveAttribute("data-level", "recife-1");
  await expect(canvas).toHaveAttribute("data-game-state", /countdown|spawning|active/);
  await expect(canvas).toHaveAttribute("data-shrimp-assets", "true");

  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "100");
  await expect(canvas).toHaveAttribute("data-shrimp-art", "true");
  await expect(canvas).toHaveAttribute("data-shrimp-visual", "shrimp-level-0-idle");
  await expect(canvas).toHaveAttribute("data-shrimp-texture", "shrimp-level-0-idle");
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  await expect(canvas).toHaveAttribute("data-selected-options", "2");
  await expect(canvas).toHaveAttribute("data-sell-value", "20");
  expect(pageErrors).toEqual([]);
});

test("opens debug overlay using F2", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1&debug=1");
  await expect(canvas).toHaveAttribute("data-debug", "true");
  await expect(canvas).toHaveAttribute("data-debug-panel", "expanded");
  await clickGame(1238, 105);
  await expect(canvas).toHaveAttribute("data-debug", "true");
  await expect(canvas).toHaveAttribute("data-debug-panel", "collapsed");
  await clickGame(1190, 92);
  await expect(canvas).toHaveAttribute("data-debug-panel", "expanded");
  await page.keyboard.press("F2");
  await expect(canvas).toHaveAttribute("data-debug", "false");
  await expect(canvas).toHaveAttribute("data-debug-panel", "hidden");
  await page.keyboard.press("F2");
  await expect(canvas).toHaveAttribute("data-debug", "true");
  await expect(canvas).toHaveAttribute("data-game-state", /countdown|spawning|active/);
  expect(pageErrors).toEqual([]);
});

test("sells a guardian for a quarter of the investment and frees the platform", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "100");

  await clickGame(SELL.x, SELL.y);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-pearls", "120");
  await expect(canvas).toHaveAttribute("data-selected", "");

  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "40");
  expect(pageErrors).toEqual([]);
});

test("locks a unit into one upgrade branch, pauses and restarts without stale state", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-pearls", "100");

  await clickGame(OPTION_A.x, OPTION_A.y);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "30");
  await expect(canvas).toHaveAttribute("data-selected-branch", "a");
  await expect(canvas).toHaveAttribute("data-selected-options", "1");
  await expect(canvas).toHaveAttribute("data-sell-value", "37");
  await expect(canvas).toHaveAttribute("data-shrimp-visual", "shrimp-level-1-idle");
  await expect(canvas).toHaveAttribute("data-shrimp-texture", "shrimp-level-1-idle");

  // O segundo botão fica oculto após a escolha do ramo: clicar ali não compra nada.
  await clickGame(OPTION_B.x, OPTION_B.y);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "30");

  await clickGame(PAUSE.x, PAUSE.y);
  await expect(canvas).toHaveAttribute("data-paused", "true");
  await clickGame(PAUSE.x, PAUSE.y);
  await expect(canvas).toHaveAttribute("data-paused", "false");

  await clickGame(RESTART.x, RESTART.y);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-pearls", "180");
  await expect(canvas).toHaveAttribute("data-level", "recife-1");
  expect(pageErrors).toEqual([]);
});

test("enforces water and route placement rules on a procedural level", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-5");
  await expect(canvas).toHaveAttribute("data-level", "recife-5");
  await expect(canvas).toHaveAttribute("data-pearls", "260");

  await clickGame(CARD_X.jellyfish, CARD_Y);
  await clickGame(175, 510);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await clickGame(700, 150);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "160");

  await clickGame(CARD_X.crab, CARD_Y);
  await clickGame(1100, 520);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await clickGame(175, 510);
  await expect(canvas).toHaveAttribute("data-guardians", "2");
  await expect(canvas).toHaveAttribute("data-pearls", "70");
  await expect(canvas).toHaveAttribute("data-selected", "G2");

  await clickGame(700, 150);
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  await clickGame(1100, 150);
  await expect(canvas).toHaveAttribute("data-selected", "");
  await clickGame(175, 510);
  await expect(canvas).toHaveAttribute("data-selected", "G2");
  expect(pageErrors).toEqual([]);
});

test("skips wave preparation by keyboard and button", async ({ page }) => {
  const { canvas, clickGame } = await openGame(page);
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-game-state", /spawning|active/);
  await clickGame(RESTART.x, RESTART.y);
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
  await page.waitForTimeout(250);
  await clickGame(SKIP.x, SKIP.y);
  await expect(canvas).toHaveAttribute("data-game-state", /spawning|active/);
});

test("level select only opens unlocked levels", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  await expect(canvas).toHaveAttribute("data-unlocked-levels", "1");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);

  const locked = MENU_CARD_BUTTON(1);
  await clickGame(locked.x, locked.y);
  await page.waitForTimeout(200);
  await expect(canvas).toHaveAttribute("data-screen", "menu");

  const first = MENU_CARD_BUTTON(0);
  await clickGame(first.x, first.y);
  await expect(canvas).toHaveAttribute("data-screen", "game");
  await expect(canvas).toHaveAttribute("data-level", "recife-1");

  await clickGame(MENU.x, MENU.y);
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  expect(pageErrors).toEqual([]);
});

test("a balanced defense can finish all five waves and unlock the next level", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Full balance run is covered once in Chromium.");
  test.setTimeout(240_000);
  const { canvas, clickGame, pageErrors } = await openGame(page);
  const waitForPearls = (minimum: number) =>
    expect
      .poll(async () => Number(await canvas.getAttribute("data-pearls")), { timeout: 90_000 })
      .toBeGreaterThanOrEqual(minimum);

  // Abertura: Camarão na plataforma norte e Caranguejo no trecho lento da rota.
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await clickGame(CARD_X.crab, CARD_Y);
  await clickGame(330, 388);
  await expect(canvas).toHaveAttribute("data-guardians", "2");
  await expect(canvas).toHaveAttribute("data-pearls", "10");

  await waitForPearls(80);
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(925, 500);
  await expect(canvas).toHaveAttribute("data-guardians", "3");

  // Contra o chefe blindado, o ramo Dano Concentrado rende mais que a Perfuração.
  await waitForPearls(70);
  await clickGame(375, 245);
  await clickGame(OPTION_B.x, OPTION_B.y);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");

  await waitForPearls(70);
  await clickGame(925, 500);
  await clickGame(OPTION_B.x, OPTION_B.y);
  await expect(canvas).toHaveAttribute("data-upgrades", "2");

  await expect(canvas).toHaveAttribute("data-game-state", "victory", { timeout: 120_000 });
  const finalPearls = await canvas.getAttribute("data-pearls");
  const finalReef = await canvas.getAttribute("data-reef");
  console.log(`[balance] recife-1 victory · pearls left: ${finalPearls} · reef: ${finalReef}/20`);
  await expect(canvas).toHaveAttribute("data-next-level", "recife-2");

  await clickGame(RESULT_NEXT.x, RESULT_NEXT.y);
  await expect(canvas).toHaveAttribute("data-level", "recife-2");
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
  await expect(canvas).toHaveAttribute("data-pearls", "200");

  await clickGame(MENU.x, MENU.y);
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  await expect(canvas).toHaveAttribute("data-unlocked-levels", "2");
  expect(pageErrors).toEqual([]);
});
