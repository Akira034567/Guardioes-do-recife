import { expect, test } from "@playwright/test";
import { CARD_Y, openGame } from "./helpers";

/**
 * Canais Profundos (v4): os aparelhos do mapa respondem ao toque e os quatro Guardiões novos entram
 * em campo. O estado sai no `data-*` do canvas (`data-gates`, `data-whirlpools`, `data-fog`).
 */

const card = (slot: number) => 62 + slot * 118;

test("a comporta da Eclusa Velha vira o canal ao toque e depois tranca", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=canais-2");
  await expect(canvas).toHaveAttribute("data-gates", "eclusa:main");
  await clickGame(200, 300);
  await expect(canvas).toHaveAttribute("data-gates", "eclusa:longo");
  // Recém-virada, ela tranca: um segundo toque logo em seguida não desfaz.
  await clickGame(200, 300);
  await page.waitForTimeout(300);
  await expect(canvas).toHaveAttribute("data-gates", "eclusa:longo");
  expect(pageErrors).toEqual([]);
});

test("o redemoinho dormente do Farol só gira depois do toque", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=canais-5");
  await expect(canvas).toHaveAttribute("data-whirlpools", "farol:on,dormente:off");
  await clickGame(810, 350);
  await expect(canvas).toHaveAttribute("data-whirlpools", "farol:on,dormente:on");
  expect(pageErrors).toEqual([]);
});

test("os quatro Guardiões dos Canais entram em campo cada um no seu lugar", async ({ page }) => {
  test.setTimeout(180_000);
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=canais-3&guardians=oyster,lanternfish,manta-ray,swordfish,pistol-shrimp");
  await expect(canvas).toHaveAttribute("data-loadout", "oyster,lanternfish,manta-ray,swordfish,pistol-shrimp");
  await expect(canvas).toHaveAttribute("data-pearls", "400");

  // Ostra: pedra.
  await clickGame(card(0), CARD_Y);
  await clickGame(560, 230);
  await expect(canvas).toHaveAttribute("data-guardians", "1");

  // Peixe-Lanterna: água livre entre duas fileiras de canal.
  await clickGame(card(1), CARD_Y);
  await clickGame(400, 230);
  await expect(canvas).toHaveAttribute("data-guardians", "2");

  // Arraia: água livre.
  await clickGame(card(2), CARD_Y);
  await clickGame(690, 232);
  await expect(canvas).toHaveAttribute("data-guardians", "3");

  // Peixe-Espada: recusado em cima da rota, aceito na beira dela.
  await expect.poll(async () => Number(await canvas.getAttribute("data-pearls")), { timeout: 150_000 }).toBeGreaterThanOrEqual(120);
  await clickGame(card(3), CARD_Y);
  await clickGame(960, 140);
  await expect(canvas).toHaveAttribute("data-guardians", "3");
  await clickGame(960, 180);
  await expect(canvas).toHaveAttribute("data-guardians", "4");
  expect(pageErrors).toEqual([]);
});

test("a névoa liga na onda dela e desliga ao fim", async ({ page }) => {
  test.setTimeout(120_000);
  // Onda 3 (índice 2) do Névoa de Lodo é de névoa: o atalho de debug começa nela.
  const { canvas, pageErrors } = await openGame(page, "level=canais-4&debug=1&wave=3");
  await expect(canvas).toHaveAttribute("data-fog", "off");
  await expect(canvas).toHaveAttribute("data-fog", "on", { timeout: 40_000 });
  expect(pageErrors).toEqual([]);
});
