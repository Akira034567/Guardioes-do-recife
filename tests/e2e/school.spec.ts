import { expect, test } from "@playwright/test";
import { openGame, openHub } from "./helpers";

/**
 * Escola do Recife: o manual fora da partida e as aulas-relâmpago dentro dela.
 *
 * O que estas sondas protegem é a promessa da camada inteira — ensinar sem interromper. Por isso a
 * última delas volta a posicionar um Guardião com a faixa na tela: se um dia ela virar modal, é aqui
 * que isso aparece.
 */

test("abre a Escola como aba do Álbum e lê uma aula", async ({ page }) => {
  await openHub(page);
  await page.getByTestId("hub-menu-toggle").click();
  // A Escola saiu do menu lateral: hoje ela é uma aba do Álbum do Recife.
  await page.getByTestId("hub-nav-collection").click();
  const panel = page.getByTestId("collection-panel");
  await expect(panel).toBeVisible();
  await page.getByTestId("album-tab-school").click();
  await expect(panel).toHaveAttribute("data-tab", "school");

  // Save novo: só a aula que abriu por padrão conta como lida.
  await expect(panel).toHaveAttribute("data-read", "1");
  await expect(page.getByTestId("album-progress")).toContainText("1 de 25");

  // Cada aula é uma carta da grade, e a do efeito abre com a regra dela.
  const card = page.getByTestId("collection-card-efeito-vulneravel");
  await expect(card).toHaveAttribute("data-state", "new");
  await card.click();
  await expect(page.getByTestId("school-lesson")).toHaveAttribute("data-lesson", "efeito-vulneravel");
  await expect(page.getByTestId("school-rule")).toContainText("1,30");
  // Lida uma vez, deixa de ser nova — e o contador anda.
  await expect(card).toHaveAttribute("data-state", "read");
  await expect(panel).toHaveAttribute("data-read", "2");
});

test("a Maestria também é aba do Álbum, com a árvore do Guardião escolhido", async ({ page }) => {
  await openHub(page);
  await page.getByTestId("hub-menu-toggle").click();
  await page.getByTestId("hub-nav-collection").click();
  await page.getByTestId("album-tab-mastery").click();
  await expect(page.getByTestId("collection-panel")).toHaveAttribute("data-tab", "mastery");

  await page.getByTestId("collection-card-pistol-shrimp").click();
  const detail = page.getByTestId("mastery-detail");
  await expect(detail).toHaveAttribute("data-guardian", "pistol-shrimp");
  await expect(detail).toHaveAttribute("data-level", "0");
  // A árvore vai do nó 1 até o nó 5 e abre nos dois ramos, com a arte da evolução final.
  await expect(page.getByTestId("mastery-node-pistol-shrimp-1")).toBeVisible();
  await expect(page.getByTestId("mastery-node-pistol-shrimp-5")).toBeVisible();
  await expect(page.getByTestId("mastery-branch-pistol-shrimp-a")).toBeVisible();
  await expect(page.getByTestId("mastery-branch-pistol-shrimp-b")).toBeVisible();
  // Sem Conchas em caixa, comprar fica desligado — e nada some da tela por isso.
  await expect(page.getByTestId("mastery-buy")).toBeDisabled();
});

test("a Escola é alcançável sem sair da partida", async ({ page }) => {
  const { clickGame } = await openGame(page, "level=recife-1");
  const pause = await page.evaluate(() => window.__grUi?.bounds("pause") ?? null);
  if (!pause) throw new Error("Controle pause não registrado");
  await clickGame(pause.x, pause.y);
  await page.getByTestId("pause-school").click();
  const panel = page.getByTestId("collection-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("data-tab", "school");
  await expect(page.getByTestId("collection-card-corrente-mapa")).toBeVisible();
});

test("ensina a correnteza quando ela existe, uma frase por vez", async ({ page }) => {
  // Recife 2 tem zona de corrente natural e não tem o tutorial básico (que só existe no Recife 1).
  const { canvas, pageErrors } = await openGame(page, "level=recife-2");
  await expect(canvas).toHaveAttribute("data-moment", "momento-correnteza", { timeout: 20_000 });
  // O passo do tutorial não concorre com a aula: fora do Recife 1 ele não existe.
  await expect(canvas).toHaveAttribute("data-tutorial", "");
  // Uma de cada vez: a frase sai e a próxima só entra depois do intervalo.
  await expect(canvas).toHaveAttribute("data-moment", "", { timeout: 20_000 });
  await expect(canvas).toHaveAttribute("data-moment", /^momento-.+/, { timeout: 60_000 });
  expect(pageErrors).toEqual([]);
});

test("a aula do campo nunca atropela o tutorial nem trava o jogo", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1");
  // Enquanto o passo está na faixa, a fila fica calada.
  await expect(canvas).toHaveAttribute("data-tutorial", "pick-card");
  await expect(canvas).toHaveAttribute("data-moment", "");

  // E o jogo continua respondendo com a faixa na tela.
  await clickGame(62, 664);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");

  // Pulado o tutorial, a faixa passa a ser da Escola — e ensina o Guardião que está em campo.
  const skip = await page.evaluate(() => window.__grUi?.bounds("tutorial:skip") ?? null);
  if (!skip) throw new Error("Controle tutorial:skip não registrado");
  await clickGame(skip.x, skip.y);
  await expect(canvas).toHaveAttribute("data-tutorial", "");
  await expect(canvas).toHaveAttribute("data-moment", /^momento-/, { timeout: 20_000 });
  expect(pageErrors).toEqual([]);
});

test("desligar as aulas em campo silencia a faixa e mantém o manual", async ({ page }) => {
  await page.addInitScript(() => {
    const key = "guardioes-do-recife.save";
    const raw = window.localStorage.getItem(key);
    const save = raw ? JSON.parse(raw) : { saveVersion: 6 };
    save.settings = { ...(save.settings ?? {}), tutorialMoments: false };
    window.localStorage.setItem(key, JSON.stringify(save));
  });
  const { canvas } = await openGame(page, "level=recife-2");
  await page.waitForTimeout(6000);
  await expect(canvas).toHaveAttribute("data-moment", "");
});
