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
  // V3: a fase 1 passou de 5 para 7 ondas. O parâmetro `wave` é 1-BASED (ver MatchLaunchConfig),
  // então a última é `wave=7`.
  const { canvas, pageErrors } = await openGame(page, "level=recife-1&difficulty=dificil&wave=7&debug=1");
  await expect(canvas).toHaveAttribute("data-difficulty", "dificil");
  await expect(canvas).toHaveAttribute("data-boss-weak-points", "4/4", { timeout: 45_000 });
  expect(pageErrors).toEqual([]);
});

test("no Normal a Baleia não tem coral nenhum", async ({ page }) => {
  // O chefe leva ~8s para entrar em campo, e com os testes correndo em paralelo isso estica.
  test.slow();
  // O gate é por dificuldade: a fase base fica exatamente como era.
  const { canvas, pageErrors } = await openGame(page, "level=recife-1&wave=7&debug=1");
  await expect(canvas).toHaveAttribute("data-difficulty", "normal");
  await expect(canvas).toHaveAttribute("data-boss", /.+/, { timeout: 45_000 });
  expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).dataset.bossWeakPoints)).toBe("");
  expect(pageErrors).toEqual([]);
});

test("arrasta a carta ate a plataforma para posicionar", async ({ page }) => {
  const { canvas, dragGame, pageErrors } = await openGame(page, "level=recife-1");
  await expect(canvas).toHaveAttribute("data-guardians", "0");

  // Um gesto so: aperta a carta, arrasta ate a plataforma, solta.
  await dragGame(CARD_X.shrimp, CARD_Y, 375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "100");
  // Posicionou: a carta sai da mao e o Guardiao novo entra em foco.
  await expect(canvas).toHaveAttribute("data-card", "");
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  expect(pageErrors).toEqual([]);
});

test("soltar a carta longe de qualquer plataforma nao posiciona nada", async ({ page }) => {
  const { canvas, dragGame, pageErrors } = await openGame(page, "level=recife-1");

  // Agua aberta nao serve ao Camarao. Nada e posicionado e a carta continua na mao, para tentar de novo.
  await dragGame(CARD_X.shrimp, CARD_Y, 1100, 200);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-card", "pistol-shrimp");
  expect(pageErrors).toEqual([]);
});

test("clicar na carta e depois no mapa continua posicionando", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1");

  // O arraste nao pode ter comido o fluxo antigo: dois cliques separados tambem posicionam, e UM so.
  await clickGame(CARD_X.shrimp, CARD_Y);
  await expect(canvas).toHaveAttribute("data-card", "pistol-shrimp");
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "100");
  expect(pageErrors).toEqual([]);
});

test("descer de volta ao menu larga a carta escolhida", async ({ page }) => {
  const { canvas, clickGame, moveGame, pageErrors } = await openGame(page, "level=recife-1");
  await clickGame(CARD_X.shrimp, CARD_Y);
  await expect(canvas).toHaveAttribute("data-card", "pistol-shrimp");

  // Sobe ao mapa (mudou de ideia) e volta para a barra de baixo.
  await moveGame(640, 300);
  await expect(canvas).toHaveAttribute("data-card", "pistol-shrimp");
  await moveGame(CARD_X.jellyfish, CARD_Y);
  await expect(canvas).toHaveAttribute("data-card", "");

  // E nao pode ter derrubado o Guardiao POSICIONADO em foco: evoluir e vender moram nesta barra.
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  await moveGame(640, 300);
  await moveGame(CARD_X.jellyfish, CARD_Y);
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  expect(pageErrors).toEqual([]);
});

test("o Guardiao vira para o lado do alvo", async ({ page }) => {
  // Item 9, segunda metade: so o Tubarao virava, porque o lado era decidido dentro da investida.
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1");
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");

  // A rota entra pela esquerda e passa por baixo do posto (375, 245) rumo à direita, dentro dos 188
  // de alcance nos dois lados: o Camarão tem de olhar para a esquerda e, depois, para a direita.
  await expect(canvas).toHaveAttribute("data-shrimp-facing", "left", { timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-shrimp-facing", "right", { timeout: 30_000 });
  expect(pageErrors).toEqual([]);
});
