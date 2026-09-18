import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { openHub } from "./helpers";

/**
 * Contas de verdade: cadastro, confirmação por e-mail e login, contra o servidor e o banco que o
 * `playwright.config.ts` sobe ao lado do jogo.
 *
 * O servidor de teste está sem SMTP, então cada mensagem vira um arquivo em `data/e2e-mail`. A sonda
 * lê esse arquivo exatamente como a pessoa leria a caixa de entrada, pega o link e o abre no
 * navegador — é o caminho completo, sem atalho por dentro do código.
 */

const MAIL_DIR = "data/e2e-mail";
const API = "http://127.0.0.1:4001";

/** Um e-mail novo por execução: o banco dos testes é o mesmo entre rodadas. */
function freshEmail(tag: string): string {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}@exemplo.com`;
}

/** Espera o servidor gravar a mensagem e devolve o link que está dentro dela. */
async function waitForEmailLink(email: string, kind: "verify" | "reset"): Promise<string> {
  if (!existsSync(MAIL_DIR)) mkdirSync(MAIL_DIR, { recursive: true });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    for (const file of readdirSync(MAIL_DIR)) {
      const raw = readFileSync(join(MAIL_DIR, file), "utf8");
      if (!raw.includes(email)) continue;
      const link = raw.match(new RegExp(`https?://\\S*/api/${kind === "verify" ? "verify" : "password/reset"}\\?token=\\S+`))?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Nenhuma mensagem de ${kind} para ${email} em ${MAIL_DIR}`);
}

async function openAccount(page: Page): Promise<void> {
  await page.getByTestId("hub-menu-toggle").click();
  await page.getByTestId("hub-nav-account").click();
  await expect(page.getByTestId("account-panel")).toBeVisible();
}

async function createAccount(page: Page, email: string, name: string, password: string): Promise<void> {
  await page.getByTestId("account-new-email").fill(email);
  await page.getByTestId("account-new-name").fill(name);
  await page.getByTestId("account-new-password").fill(password);
  await page.getByTestId("account-create").click();
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId("account-email").fill(email);
  await page.getByTestId("account-password").fill(password);
  await page.getByTestId("account-signin").click();
}

test.beforeAll(() => {
  // Caixa de e-mail limpa: a sonda procura pela mensagem DESTA rodada.
  rmSync(MAIL_DIR, { recursive: true, force: true });
  mkdirSync(MAIL_DIR, { recursive: true });
});

test("o servidor de contas está no ar e a tela diz isso", async ({ page, request }) => {
  expect((await (await request.get(`${API}/api/health`)).json()).ok).toBe(true);

  await openHub(page);
  await openAccount(page);
  await expect(page.getByTestId("account-server-status")).toHaveAttribute("data-tone", "ok", { timeout: 10_000 });
});

test("cria a conta, confirma pelo e-mail e só então entra", async ({ page }) => {
  const email = freshEmail("ana");
  const name = `Ana${Date.now() % 100000}`;
  const { canvas } = await openHub(page);

  await openAccount(page);
  await createAccount(page, email, name, "coral12345");
  await expect(page.getByTestId("account-create-status")).toContainText("confirme o e-mail", { timeout: 15_000 });

  // Ainda não dá para entrar: o endereço não foi provado.
  await signIn(page, email, "coral12345");
  await expect(page.getByTestId("account-signin-status")).toContainText("Confirme seu e-mail");
  await expect(canvas).toHaveAttribute("data-account", "");

  // A pessoa abre o link que chegou por e-mail.
  const link = await waitForEmailLink(email, "verify");
  await page.goto(link);
  await expect(page.locator("h2")).toContainText("Conta confirmada");

  await openHub(page);
  await openAccount(page);
  await signIn(page, email, "coral12345");
  await expect(canvas).toHaveAttribute("data-account", name, { timeout: 15_000 });
});

test("recusa e-mail repetido e senha errada", async ({ page, request }) => {
  const email = freshEmail("beto");
  const name = `Beto${Date.now() % 100000}`;
  // A conta já existe e está confirmada: montada direto pela API, que é o caminho mais curto.
  await request.post(`${API}/api/accounts`, { data: { email, name, password: "coral12345" } });
  await page.request.get(await waitForEmailLink(email, "verify"));

  await openHub(page);
  await openAccount(page);

  await createAccount(page, email, `${name}Outro`, "coral12345");
  await expect(page.getByTestId("account-create-status")).toContainText("Já existe uma conta com esse e-mail");

  await signIn(page, email, "senha-errada");
  await expect(page.getByTestId("account-signin-status")).toContainText("não conferem");
});

test("o progresso sobe para a conta e desce noutro navegador", async ({ page, request, browser }) => {
  const email = freshEmail("carla");
  const name = `Carla${Date.now() % 100000}`;
  await request.post(`${API}/api/accounts`, { data: { email, name, password: "coral12345" } });
  await page.request.get(await waitForEmailLink(email, "verify"));

  // Este aparelho já tem progresso de convidado: ele vira o progresso da conta no primeiro acesso.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "guardioes-do-recife.save",
      JSON.stringify({ saveVersion: 5, currency: { shells: 77, lifetimeShells: 77 }, settings: { reducedEffects: true } }),
    );
  });
  const { canvas } = await openHub(page);
  await expect(canvas).toHaveAttribute("data-shells", "77");

  await openAccount(page);
  await signIn(page, email, "coral12345");
  await expect(canvas).toHaveAttribute("data-account", name, { timeout: 15_000 });
  await expect(canvas).toHaveAttribute("data-shells", "77");

  // O servidor recebeu o progresso.
  const session = await (await request.post(`${API}/api/sessions`, { data: { email, password: "coral12345" } })).json();
  await expect
    .poll(async () => (await (await request.get(`${API}/api/save`, { headers: { Authorization: `Bearer ${session.token}` } })).json()).save?.document ?? "", {
      timeout: 15_000,
    })
    .toContain('"shells":77');

  // Outro navegador, nada guardado: entrar traz o Recife de volta.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/");
  await expect(otherPage.locator("canvas")).toHaveAttribute("data-hub-ready", "true", { timeout: 20_000 });
  await expect(otherPage.locator("canvas")).toHaveAttribute("data-shells", "0");
  await openAccount(otherPage);
  await signIn(otherPage, email, "coral12345");
  await expect(otherPage.locator("canvas")).toHaveAttribute("data-shells", "77", { timeout: 20_000 });
  await other.close();
});

test("recupera a senha esquecida pelo e-mail", async ({ page, request }) => {
  const email = freshEmail("dani");
  const name = `Dani${Date.now() % 100000}`;
  await request.post(`${API}/api/accounts`, { data: { email, name, password: "coral12345" } });
  await page.request.get(await waitForEmailLink(email, "verify"));

  await openHub(page);
  await openAccount(page);
  await page.getByTestId("account-email").fill(email);
  await page.getByTestId("account-forgot").click();
  await expect(page.getByTestId("account-signin-status")).toContainText("link para trocar a senha");

  // O link do e-mail abre um formulário de verdade, fora do jogo.
  const link = await waitForEmailLink(email, "reset");
  await page.goto(link);
  await page.locator("#password").fill("senha-nova-123");
  await page.locator("#confirm").fill("senha-nova-123");
  await page.getByRole("button", { name: "TROCAR A SENHA" }).click();
  await expect(page.locator("h2")).toContainText("Senha trocada");

  const { canvas } = await openHub(page);
  await openAccount(page);
  await signIn(page, email, "senha-nova-123");
  await expect(canvas).toHaveAttribute("data-account", name, { timeout: 15_000 });
});
