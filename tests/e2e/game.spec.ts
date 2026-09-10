import { expect, test } from "@playwright/test";

test("loads the vertical slice and places a guardian", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-game-state", /countdown|spawning|active/);

  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const scaleX = box.width / 1280;
  const scaleY = box.height / 720;
  await page.mouse.click(box.x + 72 * scaleX, box.y + 672 * scaleY);
  await page.mouse.click(box.x + 330 * scaleX, box.y + 205 * scaleY);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "120");
  expect(pageErrors).toEqual([]);
});

test("opens debug overlay using F2", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/?debug=1");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-debug", "true");
  await page.keyboard.press("F2");
  await expect(canvas).toHaveAttribute("data-debug", "false");
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
  await clickGame(330, 205);
  await clickGame(817, 672);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "65");

  await clickGame(1143, 36);
  await expect(canvas).toHaveAttribute("data-paused", "true");
  await clickGame(1143, 36);
  await expect(canvas).toHaveAttribute("data-paused", "false");

  await clickGame(1138, 673);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-pearls", "180");
  expect(pageErrors).toEqual([]);
});
