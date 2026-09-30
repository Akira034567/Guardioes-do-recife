import { expect, test } from "@playwright/test";
import { openGame } from "./helpers";

/**
 * O jogo como app no celular (v4): entrada animada, manifest instalável, "gire o celular" em pé e o
 * HUD próprio do celular (`?hud=mobile`), com posicionamento em dois toques.
 */

test("a entrada sai da frente quando o jogo fica pronto", async ({ page }) => {
  await openGame(page, "screen=map");
  await expect(page.locator("#boot-splash")).toHaveCount(0, { timeout: 10_000 });
});

test("o manifest é instalável: tela cheia, deitado e com ícone maskable", async ({ page, request }) => {
  await page.goto("/?screen=map");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href ?? "", page.url()).toString())).json();
  expect(manifest.display).toBe("fullscreen");
  expect(manifest.orientation).toBe("landscape");
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons as Array<{ src: string }>) {
    expect((await request.get(new URL(icon.src, page.url()).toString())).ok(), icon.src).toBe(true);
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /icon-180/);
});

test("em pé, o celular mostra o aviso de girar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-landscape", "o aviso é só de aparelho de toque");
  await openGame(page, "screen=map");
  await expect(page.locator("#rotate-hint")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#rotate-hint")).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#rotate-hint")).toBeHidden();
});

test("no HUD do celular, posicionar pede dois toques no mesmo lugar", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1&hud=mobile");
  await expect(canvas).toHaveAttribute("data-pearls", "180");
  // No HUD do celular as cartas encostam na borda da tela: a posição vem do registro de controles.
  const card = await page.evaluate(() => window.__grUi?.bounds("card:first") ?? null);
  expect(card).not.toBeNull();
  await clickGame(card!.x, card!.y);
  await expect(canvas).toHaveAttribute("data-card", "pistol-shrimp");
  // Primeiro toque: só mostra onde e o alcance.
  await clickGame(375, 245);
  await page.waitForTimeout(250);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  // Segundo toque no mesmo lugar: posiciona.
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "100");
  expect(pageErrors).toEqual([]);
});

test("no celular deitado o jogo ocupa a tela inteira, sem moldura", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-landscape", "o palco largo é só de telefone");
  const { canvas, pageErrors } = await openGame(page, "level=recife-1&hud=mobile");
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  // Sem as faixas pretas do 16:9: o canvas tem a largura da janela, e o mundo de 1280 fica no meio.
  expect(Math.round(box!.width)).toBe(viewport!.width);
  // E de cima a baixo: sem moldura nenhuma em volta do jogo.
  expect(Math.round(box!.x)).toBe(0);
  expect(Math.round(box!.y)).toBe(0);
  expect(Math.round(box!.height)).toBe(viewport!.height);
  expect(Number(await canvas.getAttribute("width"))).toBeGreaterThan(1280);
  expect(pageErrors).toEqual([]);
});
