import { expect, test } from "@playwright/test";
import { CARD_X, CARD_Y, OPTION_A, PAUSE, restartViaPause, openGame } from "./helpers";

/**
 * Regressões do item 8: o jogo continuava desenhado e parava de responder.
 *
 * As duas causas eram diferentes e nenhuma era óbvia. Uma estourava uma exceção dentro do `update()`
 * — e como o laço do Phaser reagenda o quadro DEPOIS do callback, isso mata o laço para sempre. A
 * outra não gerava erro nenhum: um overlay HTML sobrevivente deixava `game.input.enabled` desligado.
 *
 * Por isso todo teste daqui termina clicando em alguma coisa e conferindo `pageErrors`: reiniciar e
 * olhar os atributos não bastava — o teste antigo fazia exatamente isso e o bug passou por ele.
 */

test("reinicia no meio da fase e continua respondendo aos cliques", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");

  await restartViaPause(page, clickGame);
  await expect(canvas).toHaveAttribute("data-guardians", "0");

  // O passo que faltava: SELECIONAR alguma coisa depois do reinício. Escolher uma carta redesenha o
  // retrato do painel, que guardava uma imagem já destruída entre partidas — era este clique que
  // derrubava o jogo, e o HUD parava de atualizar a partir dali.
  await clickGame(CARD_X.jellyfish, CARD_Y);
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-selected", "G1");

  // E continua vivo depois de evoluir, que é o outro caminho que passa pelo mesmo painel.
  await clickGame(OPTION_A.x, OPTION_A.y);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  expect(pageErrors).toEqual([]);
});

test("nunca deixa o input desligado sem nenhuma tela aberta", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);

  // Pausa e retoma: a tela de pausa desliga o input do jogo enquanto está aberta.
  await clickGame(PAUSE.x, PAUSE.y);
  await expect(page.getByTestId("pause-panel")).toBeVisible();
  await page.getByTestId("pause-resume").click();
  await expect(canvas).toHaveAttribute("data-paused", "false");

  await expect(page.locator("#ui-layer > .gr-screen")).toHaveCount(0);
  await expect(canvas).toHaveAttribute("data-overlay", "");

  // A prova de que o input voltou não é o atributo: é o jogo reagir a um clique de verdade.
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  expect(pageErrors).toEqual([]);
});

test("expõe as fases do ciclo de vida da partida", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1&debug=1");
  await expect(canvas).toHaveAttribute("data-lifecycle", "running");

  // Posiciona alguém para que o reinício tenha efeito observável, e espera esse efeito: sem isso a
  // leitura do registro aconteceria antes de a partida velha ser desmontada.
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await restartViaPause(page, clickGame);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-lifecycle", "running");

  const phases = await page.evaluate(() => window.__grLifecycle?.dump().join("\n") ?? "");
  for (const phase of ["initializing", "ready", "running", "reset", "destroying", "destroyed"]) {
    expect(phases, `fase ${phase} registrada`).toContain(phase);
  }
  expect(pageErrors).toEqual([]);
});

test("não desenha os nós da pista ao selecionar Guardião nenhum", async ({ page }) => {
  // Item 13: os cones que apareciam na pista eram o overlay de debug, repintado por sete caminhos de
  // seleção. Sem `?debug=1`, selecionar qualquer Guardião não pode ligar nada disso.
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1");
  for (const card of [CARD_X.shrimp, CARD_X.jellyfish, CARD_X.pufferfish, CARD_X.crab]) {
    await clickGame(card, CARD_Y);
    await expect(canvas).toHaveAttribute("data-debug", "false");
    await expect(canvas).toHaveAttribute("data-debug-panel", "hidden");
  }
  expect(pageErrors).toEqual([]);
});
