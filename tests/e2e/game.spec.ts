import { expect, test } from "@playwright/test";
import { CARD_X, CARD_Y, MENU, MENU_CARD_BUTTON, NEXT_WAVE, openGame, OPTION_A, OPTION_B, PAUSE, RESTART, SELL, SPEED_1X, SPEED_2X } from "./helpers";

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
  await expect(canvas).toHaveAttribute("data-shrimp-visual", "pistol-shrimp-base-idle");
  await expect(canvas).toHaveAttribute("data-shrimp-texture", "pistol-shrimp-base-idle");
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
  await expect(canvas).toHaveAttribute("data-shrimp-visual", "pistol-shrimp-perfuracao-1-idle");
  await expect(canvas).toHaveAttribute("data-shrimp-texture", "pistol-shrimp-perfuracao-1-idle");

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

test("enforces water and route placement rules on the shipwreck level", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-5");
  await expect(canvas).toHaveAttribute("data-level", "recife-5");
  await expect(canvas).toHaveAttribute("data-pearls", "340");

  // Água-viva: em cima da correnteza é inválido; água livre longe da rota é válido.
  await clickGame(CARD_X.jellyfish, CARD_Y);
  await clickGame(900, 492);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await clickGame(700, 150);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "240");

  // Caranguejo: longe da correnteza é inválido; em cima dela "snapa" para a linha central.
  await clickGame(CARD_X.crab, CARD_Y);
  await clickGame(1100, 150);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await clickGame(900, 492);
  await expect(canvas).toHaveAttribute("data-guardians", "2");
  await expect(canvas).toHaveAttribute("data-pearls", "150");
  await expect(canvas).toHaveAttribute("data-selected", "G2");

  await clickGame(700, 150);
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  await clickGame(1100, 150);
  await expect(canvas).toHaveAttribute("data-selected", "");
  await clickGame(900, 492);
  await expect(canvas).toHaveAttribute("data-selected", "G2");
  expect(pageErrors).toEqual([]);
});

const NEW_SQUAD = "guardians=pistol-shrimp,shark,sea-turtle,stonefish,dolphin";
/** Carta na posição do esquadrão acima: 0 camarão, 1 tubarão, 2 tartaruga, 3 peixe-pedra, 4 golfinho. */
const squadCard = (slot: number) => 62 + slot * 118;

test("places the shark only in the margin band and locks the other branch after the first upgrade", async ({ page }) => {
  test.setTimeout(200_000);
  const { canvas, clickGame, pageErrors } = await openGame(page, `level=recife-1&${NEW_SQUAD}`);
  await expect(canvas).toHaveAttribute("data-loadout", "pistol-shrimp,shark,sea-turtle,stonefish,dolphin");

  // Em cima da rota é recusado; na beira (30–120px da linha central) é aceito.
  await clickGame(squadCard(1), CARD_Y);
  await clickGame(350, 390);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await clickGame(300, 470);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "70");
  await expect(canvas).toHaveAttribute("data-selected-options", "2");

  // Ramo B (Caçador Alfa): o ramo A fica bloqueado e o botão A não compra nada.
  await expect.poll(async () => Number(await canvas.getAttribute("data-pearls")), { timeout: 150_000 }).toBeGreaterThanOrEqual(90);
  await clickGame(300, 470);
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  await clickGame(OPTION_B.x, OPTION_B.y);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-selected-branch", "b");
  await expect(canvas).toHaveAttribute("data-selected-variant", "alfa_1");
  await expect(canvas).toHaveAttribute("data-selected-options", "1");
  const pearlsAfter = await canvas.getAttribute("data-pearls");
  await clickGame(OPTION_A.x, OPTION_A.y);
  await page.waitForTimeout(200);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-pearls", pearlsAfter ?? "");
  expect(pageErrors).toEqual([]);
});

test("buries the stonefish on the route and arms it after a few seconds", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, `level=recife-1&${NEW_SQUAD}`);
  await clickGame(squadCard(3), CARD_Y);
  await clickGame(700, 150);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await clickGame(700, 260);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "85");
  await expect(canvas).toHaveAttribute("data-trap-phase", "arming");
  await expect(canvas).toHaveAttribute("data-trap-phase", /armed|triggered|cooldown/, { timeout: 15_000 });
  expect(pageErrors).toEqual([]);
});

test("places the dolphin in open water and the turtle on the route", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, `level=recife-2&${NEW_SQUAD}`);
  await expect(canvas).toHaveAttribute("data-pearls", "220");
  await clickGame(squadCard(4), CARD_Y);
  await clickGame(950, 340);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await clickGame(640, 180);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "100");

  await clickGame(squadCard(2), CARD_Y);
  await clickGame(720, 200);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await clickGame(910, 395);
  await expect(canvas).toHaveAttribute("data-guardians", "2");
  await expect(canvas).toHaveAttribute("data-pearls", "0");
  await expect(canvas).toHaveAttribute("data-selected", "G2");
  await expect(canvas).toHaveAttribute("data-selected-options", "2");
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
  await clickGame(NEXT_WAVE.x, NEXT_WAVE.y);
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

  // A carta abre a preparação (HTML) e é lá que a partida começa.
  const first = MENU_CARD_BUTTON(0);
  await clickGame(first.x, first.y);
  await expect(page.getByTestId("prep-panel")).toHaveAttribute("data-level", "recife-1");
  await expect(page.getByTestId("prep-objectives")).toContainText("Proteja o Recife");
  await page.getByTestId("prep-start").click();
  await expect(canvas).toHaveAttribute("data-screen", "game");
  await expect(canvas).toHaveAttribute("data-level", "recife-1");

  await clickGame(MENU.x, MENU.y);
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  expect(pageErrors).toEqual([]);
});

test("switches match speed, pauses and previews the next wave", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);
  await expect(canvas).toHaveAttribute("data-speed", "1");
  // A prévia lista a composição da onda que está por vir (item 9).
  await expect(canvas).toHaveAttribute("data-next-wave", /swimmer:\d+/);

  await clickGame(SPEED_2X.x, SPEED_2X.y);
  await expect(canvas).toHaveAttribute("data-speed", "2");
  await clickGame(PAUSE.x, PAUSE.y);
  await expect(canvas).toHaveAttribute("data-paused", "true");
  await clickGame(PAUSE.x, PAUSE.y);
  await expect(canvas).toHaveAttribute("data-paused", "false");
  await clickGame(SPEED_1X.x, SPEED_1X.y);
  await expect(canvas).toHaveAttribute("data-speed", "1");
  expect(pageErrors).toEqual([]);
});

test("plays a harder difficulty with elites in the waves", async ({ page }) => {
  const { canvas, pageErrors } = await openGame(page, "level=recife-1&difficulty=abissal");
  await expect(canvas).toHaveAttribute("data-difficulty", "abissal");
  // No Abissal a fase começa com menos pérolas e alguma onda traz elites (marcados com "+").
  await expect(canvas).toHaveAttribute("data-pearls", "144");
  expect(pageErrors).toEqual([]);
});

test("migrates an old save so existing players keep their levels", async ({ page }) => {
  // Progresso antigo (`{completed}` na chave v1) precisa continuar valendo depois do save versionado.
  await page.addInitScript(() => {
    window.localStorage.setItem("guardioes-do-recife.progress.v1", JSON.stringify({ completed: ["recife-1", "recife-2"] }));
  });
  const { canvas, pageErrors } = await openGame(page, "");
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  await expect(canvas).toHaveAttribute("data-unlocked-levels", "3");
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem("guardioes-do-recife.save") ?? "{}"));
  expect(saved.saveVersion).toBe(2);
  expect(saved.completedLevels).toEqual(["recife-1", "recife-2"]);
  expect(saved.levelStars["recife-1"].stars).toBe(1);
  expect(saved.currency.shells).toBeGreaterThan(0);
  const legacy = await page.evaluate(() => window.localStorage.getItem("guardioes-do-recife.progress.v1"));
  expect(legacy, "a chave antiga fica para trás como segurança").not.toBeNull();
  expect(pageErrors).toEqual([]);
});
