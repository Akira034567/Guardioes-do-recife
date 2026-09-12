import { expect, test } from "@playwright/test";
import { CARD_X, CARD_Y, MENU, openGame, OPTION_B, RESULT_NEXT } from "./helpers";

/**
 * Partida completa do Recife 1: leva minutos e gera um trace enorme. Em máquinas com antivírus o
 * arquivo de trace some antes de o navegador fechar ("browserContext.close: ENOENT ... .trace"),
 * então esta sonda roda sem trace nem vídeo.
 */
test.use({ trace: "off", video: "off" });

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
  await expect(canvas).toHaveAttribute("data-pearls", "220");

  await clickGame(MENU.x, MENU.y);
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  await expect(canvas).toHaveAttribute("data-unlocked-levels", "2");
  expect(pageErrors).toEqual([]);
});
