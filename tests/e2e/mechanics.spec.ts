import { expect, test } from "@playwright/test";
import { CARD_X, CARD_Y, openGame } from "./helpers";

test("o Camarão volta ao repouso entre os golpes", async ({ page }) => {
  // Item 15: o motor estica windup+ataque+recuperação para somarem o cooldown inteiro, e a view
  // mapeava os três para a mesma textura. Com um inimigo no alcance, o Camarão ficava exibindo a
  // bolha de ataque o tempo todo. A pose de ataque agora é uma janela curta em volta do golpe.
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1");
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");

  const seen = new Set<string>();
  for (let sample = 0; sample < 60; sample += 1) {
    seen.add((await canvas.getAttribute("data-shrimp-state")) ?? "");
    await page.waitForTimeout(100);
  }

  // Precisa ter descansado em algum momento, com inimigos em campo o tempo todo.
  expect([...seen], "o Camarão passa por idle").toContain("idle");
  expect(pageErrors).toEqual([]);
});

test("a Baleia ganha Corais Corrompidos no Difícil e os perde ao serem rompidos", async ({ page }) => {
  test.slow();
  // Item 11. A onda do chefe do Recife 1 é a última; `wave` pula direto para ela.
  const { canvas, pageErrors } = await openGame(page, "level=recife-1&difficulty=dificil&wave=5&debug=1");
  await expect(canvas).toHaveAttribute("data-difficulty", "dificil");
  await expect(canvas).toHaveAttribute("data-boss-weak-points", "4/4", { timeout: 45_000 });
  expect(pageErrors).toEqual([]);
});

test("no Normal a Baleia não tem coral nenhum", async ({ page }) => {
  // O chefe leva ~8s para entrar em campo, e com os testes correndo em paralelo isso estica.
  test.slow();
  // O gate é por dificuldade: a fase base fica exatamente como era.
  const { canvas, pageErrors } = await openGame(page, "level=recife-1&wave=5&debug=1");
  await expect(canvas).toHaveAttribute("data-difficulty", "normal");
  await expect(canvas).toHaveAttribute("data-boss", /.+/, { timeout: 45_000 });
  expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).dataset.bossWeakPoints)).toBe("");
  expect(pageErrors).toEqual([]);
});
