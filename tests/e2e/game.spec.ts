import { expect, test } from "@playwright/test";

test("loads the vertical slice and places a guardian", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-game-state", /countdown|spawning|active/);
  await expect(canvas).toHaveAttribute("data-shrimp-assets", "true");

  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const scaleX = box.width / 1280;
  const scaleY = box.height / 720;
  await page.mouse.click(box.x + 72 * scaleX, box.y + 672 * scaleY);
  await page.mouse.click(box.x + 375 * scaleX, box.y + 245 * scaleY);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "120");
  await expect(canvas).toHaveAttribute("data-shrimp-art", "true");
  await expect(canvas).toHaveAttribute("data-shrimp-visual", "shrimp-level-0-idle");
  await expect(canvas).toHaveAttribute("data-shrimp-texture", "shrimp-level-0-idle");
  expect(pageErrors).toEqual([]);
});

test("opens debug overlay using F2", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/?debug=1");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-debug", "true");
  await expect(canvas).toHaveAttribute("data-debug-panel", "expanded");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);
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

test("upgrades, pauses and restarts without stale state", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);

  await clickGame(72, 672);
  await clickGame(375, 245);
  await clickGame(817, 672);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "65");
  await expect(canvas).toHaveAttribute("data-shrimp-visual", "shrimp-level-1-idle");
  await expect(canvas).toHaveAttribute("data-shrimp-texture", "shrimp-level-1-idle");

  await clickGame(1143, 36);
  await expect(canvas).toHaveAttribute("data-paused", "true");
  await clickGame(1143, 36);
  await expect(canvas).toHaveAttribute("data-paused", "false");

  await clickGame(1138, 673);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-pearls", "180");
  expect(pageErrors).toEqual([]);
});

test("enforces water and route placement rules", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);

  await clickGame(220, 672);
  await clickGame(200, 340);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-pearls", "180");
  await clickGame(200, 170);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "105");

  await clickGame(368, 672);
  await clickGame(650, 520);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "105");
  await clickGame(330, 385);
  await expect(canvas).toHaveAttribute("data-guardians", "2");
  await expect(canvas).toHaveAttribute("data-pearls", "5");
  await expect(canvas).toHaveAttribute("data-selected", "G2");
  await clickGame(200, 170);
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  await clickGame(1100, 150);
  await expect(canvas).toHaveAttribute("data-selected", "");
  await clickGame(330, 385);
  await expect(canvas).toHaveAttribute("data-selected", "G2");
  expect(pageErrors).toEqual([]);
});

test("skips wave preparation by keyboard and button", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-game-state", /spawning|active/);

  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);
  await clickGame(1138, 673);
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
  await page.waitForTimeout(250);
  await clickGame(928, 673);
  await expect(canvas).toHaveAttribute("data-game-state", /spawning|active/);
});

test("a balanced defense can finish all five waves", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Full balance run is covered once in Chromium.");
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    let simulationTimestamp = performance.now();
    window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
      nativeRequestAnimationFrame(() => {
        simulationTimestamp += 80;
        callback(simulationTimestamp);
      });
  });
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);
  const waitForPearls = (minimum: number) =>
    expect
      .poll(async () => Number(await canvas.getAttribute("data-pearls")), { timeout: 70_000 })
      .toBeGreaterThanOrEqual(minimum);

  await clickGame(72, 672);
  await clickGame(375, 245);
  await clickGame(368, 672);
  await clickGame(280, 372);

  await waitForPearls(75);
  await clickGame(220, 672);
  await clickGame(300, 540);
  await waitForPearls(60);
  await clickGame(72, 672);
  await clickGame(750, 135);

  await waitForPearls(55);
  await clickGame(375, 245);
  await clickGame(817, 672);
  await waitForPearls(85);
  await clickGame(817, 672);

  await waitForPearls(75);
  await clickGame(280, 372);
  await clickGame(817, 672);
  await waitForPearls(110);
  await clickGame(817, 672);

  await waitForPearls(65);
  await clickGame(300, 540);
  await clickGame(817, 672);
  await waitForPearls(90);
  await clickGame(817, 672);

  await expect(canvas).toHaveAttribute("data-game-state", "victory", { timeout: 70_000 });
  expect(pageErrors).toEqual([]);
});
