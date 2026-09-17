import { expect, test } from "@playwright/test";
import { openGame, openHub } from "./helpers";

/**
 * Escola do Recife: o manual fora da partida e as aulas-relâmpago dentro dela.
 *
 * O que estas sondas protegem é a promessa da camada inteira — ensinar sem interromper. Por isso a
 * última delas volta a posicionar um Guardião com a faixa na tela: se um dia ela virar modal, é aqui
 * que isso aparece.
 */

test("abre a Escola pelo menu e lê uma aula", async ({ page }) => {
  await openHub(page);
  await page.getByTestId("hub-menu-toggle").click();
  await page.getByTestId("hub-nav-school").click();

  const panel = page.getByTestId("school-panel");
  await expect(panel).toBeVisible();
  // Save novo: só a aula que abriu por padrão conta como lida.
  await expect(panel).toHaveAttribute("data-read", "1");
  await expect(page.getByTestId("school-progress")).toContainText("1/25");

  // Os quatro cursos existem e a aula de um efeito de status abre com a regra dela.
  for (const course of ["guardioes", "efeitos", "correnteza", "ameacas"]) {
    await expect(page.getByTestId(`school-course-${course}`)).toBeVisible();
  }
  await expect(page.getByTestId("school-lesson-efeito-vulneravel")).toHaveAttribute("data-state", "new");
  await page.getByTestId("school-lesson-efeito-vulneravel").click();
  await expect(page.getByTestId("school-lesson")).toHaveAttribute("data-lesson", "efeito-vulneravel");
  await expect(page.getByTestId("school-rule")).toContainText("1,30");
  // Lida uma vez, deixa de ser nova — e o contador anda.
  await expect(page.getByTestId("school-lesson-efeito-vulneravel")).toHaveAttribute("data-state", "read");
  await expect(panel).toHaveAttribute("data-read", "2");
});

test("a Escola é alcançável sem sair da partida", async ({ page }) => {
  const { clickGame } = await openGame(page, "level=recife-1");
  const pause = await page.evaluate(() => window.__grUi?.bounds("pause") ?? null);
  if (!pause) throw new Error("Controle pause não registrado");
  await clickGame(pause.x, pause.y);
  await page.getByTestId("pause-school").click();
  await expect(page.getByTestId("school-panel")).toBeVisible();
  await expect(page.getByTestId("school-lesson-corrente-mapa")).toBeVisible();
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
    const save = raw ? JSON.parse(raw) : { saveVersion: 5 };
    save.settings = { ...(save.settings ?? {}), tutorialMoments: false };
    window.localStorage.setItem(key, JSON.stringify(save));
  });
  const { canvas } = await openGame(page, "level=recife-2");
  await page.waitForTimeout(6000);
  await expect(canvas).toHaveAttribute("data-moment", "");
});
