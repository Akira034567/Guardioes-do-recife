import { expect, test, type Page } from "@playwright/test";
import { openHub } from "./helpers";

/**
 * Minha Conta: entrar, criar conta e levar o progresso para outro aparelho.
 *
 * As sondas conferem o que o jogador vê: o nome da conta no letreiro do Recife e as Conchas que
 * vieram junto. O jogo não tem servidor, então "outro aparelho" é simulado limpando o armazenamento
 * da página antes de colar o código — é exatamente o que acontece ao abrir o jogo num computador novo.
 */

/**
 * Semeia o save do aparelho (modo convidado) com Conchas, para ver o progresso migrar. A semente
 * vale UMA vez por aba: a sonda do código simula um aparelho novo limpando o armazenamento, e um
 * script de boot que replantasse as Conchas a cada recarga escondaria justamente o que se quer ver.
 */
async function seedGuestProgress(page: Page, shells: number): Promise<void> {
  await page.addInitScript((amount) => {
    if (window.sessionStorage.getItem("gr-e2e-seeded") !== null) return;
    window.sessionStorage.setItem("gr-e2e-seeded", "1");
    window.localStorage.setItem(
      "guardioes-do-recife.save",
      JSON.stringify({ saveVersion: 5, currency: { shells: amount, lifetimeShells: amount }, settings: { reducedEffects: true } }),
    );
  }, shells);
}

async function openAccount(page: Page): Promise<void> {
  await page.getByTestId("hub-menu-toggle").click();
  await page.getByTestId("hub-nav-account").click();
  await expect(page.getByTestId("account-panel")).toBeVisible();
}

async function createAccount(page: Page, name: string, password: string): Promise<void> {
  await page.getByTestId("account-new-name").fill(name);
  await page.getByTestId("account-new-password").fill(password);
  await page.getByTestId("account-new-confirm").fill(password);
  await page.getByTestId("account-create").click();
}

test("creates an account that carries the progress of this device", async ({ page }) => {
  await seedGuestProgress(page, 42);
  const { canvas, pageErrors } = await openHub(page);
  await expect(canvas).toHaveAttribute("data-shells", "42");
  // Sem conta, o letreiro diz "Convidado": o jogador sabe onde o progresso está.
  await expect(page.getByTestId("hub-account")).toHaveAttribute("data-value", "Convidado");

  await openAccount(page);
  await createAccount(page, "Ana", "coral123");

  // A conta entrou: o Recife é montado de novo, agora com o save dela — e as Conchas vieram junto.
  await expect(canvas).toHaveAttribute("data-account", "Ana", { timeout: 10_000 });
  await expect(canvas).toHaveAttribute("data-shells", "42");
  await expect(page.getByTestId("hub-account")).toHaveAttribute("data-value", "Ana");

  await openAccount(page);
  await expect(page.getByTestId("account-subtitle")).toContainText("Ana");
  await page.getByTestId("account-signout").click();
  await expect(canvas).toHaveAttribute("data-account", "", { timeout: 10_000 });
  expect(pageErrors).toEqual([]);
});

test("refuses a repeated name and a wrong password", async ({ page }) => {
  const { canvas, pageErrors } = await openHub(page);
  await openAccount(page);
  await createAccount(page, "Ana", "coral123");
  await expect(canvas).toHaveAttribute("data-account", "Ana", { timeout: 10_000 });

  await openAccount(page);
  await page.getByTestId("account-signout").click();
  await expect(canvas).toHaveAttribute("data-account", "", { timeout: 10_000 });

  // Dois jogadores não podem usar o mesmo nome, nem trocando a caixa das letras.
  await openAccount(page);
  await createAccount(page, "ANA", "outra123");
  await expect(page.getByTestId("account-create-status")).toContainText("Já existe uma conta");
  await expect(canvas).toHaveAttribute("data-account", "");

  await page.getByTestId("account-name").fill("Ana");
  await page.getByTestId("account-password").fill("errada");
  await page.getByTestId("account-signin").click();
  await expect(page.getByTestId("account-signin-status")).toContainText("Senha incorreta");
  await expect(canvas).toHaveAttribute("data-account", "");

  await page.getByTestId("account-password").fill("coral123");
  await page.getByTestId("account-signin").click();
  await expect(canvas).toHaveAttribute("data-account", "Ana", { timeout: 10_000 });
  expect(pageErrors).toEqual([]);
});

test("carries the account to another device through the reef code", async ({ page }) => {
  await seedGuestProgress(page, 42);
  const { canvas } = await openHub(page);
  await openAccount(page);
  await createAccount(page, "Ana", "coral123");
  await expect(canvas).toHaveAttribute("data-account", "Ana", { timeout: 10_000 });

  await openAccount(page);
  const code = await page.getByTestId("account-code").inputValue();
  expect(code.startsWith("GR1.")).toBe(true);

  // "Outro aparelho": nenhuma conta e nenhum save guardados nesta página.
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(canvas).toHaveAttribute("data-hub-ready", "true", { timeout: 15_000 });
  await expect(canvas).toHaveAttribute("data-account", "");
  // Aparelho novo: nenhuma conta, nenhuma Concha.
  await expect(canvas).toHaveAttribute("data-shells", "0");

  await openAccount(page);
  await page.getByTestId("account-import-code").fill(code);
  await page.getByTestId("account-import-password").fill("coral123");
  await page.getByTestId("account-import").click();

  await expect(canvas).toHaveAttribute("data-account", "Ana", { timeout: 10_000 });
  await expect(canvas).toHaveAttribute("data-shells", "42");
});
