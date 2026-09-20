import { expect, test, type Page } from "@playwright/test";
import { HUD_LAYOUT } from "../../src/game/hudLayout";
import { openGame } from "./helpers";

/**
 * Comandos da partida (V3.5): o que o jogador aperta e o que acontece.
 *
 * Tudo aqui nasceu de um pedido só — "quero reiniciar sem abrir menu, e quero acelerar com o
 * espaço" — mas cada atalho traz um risco próprio, e é esse risco que as sondas guardam:
 *
 *   * R reinicia a fase, então NUNCA pode reiniciar no primeiro toque, e o segundo R disparado por
 *     engano (toque duplo) também não pode valer;
 *   * ESPAÇO faz duas coisas conforme o momento, e trocar as duas de lugar seria o pior dos mundos;
 *   * o botão de reiniciar mora entre a velocidade e a pausa, a um dedo de distância dos dois.
 */

const RESTART = { x: HUD_LAYOUT.restartButtonX, y: HUD_LAYOUT.topButtonY } as const;

/** O tempo de carência da confirmação, com uma folga para o relógio da máquina de teste. */
const ARM_WAIT_MS = 900;

async function inMatch(page: Page) {
  const opened = await openGame(page, "level=recife-1");
  await expect(opened.canvas).toHaveAttribute("data-game-state", "countdown");
  return opened;
}

test("o botão de reiniciar fica entre a velocidade e a pausa", async ({ page }) => {
  await inMatch(page);
  const controls = await page.evaluate(() => ({
    speed: window.__grUi?.bounds("speed") ?? null,
    restart: window.__grUi?.bounds("restart") ?? null,
    pause: window.__grUi?.bounds("pause") ?? null,
  }));
  if (!controls.speed || !controls.restart || !controls.pause) throw new Error("Controles do HUD não registrados");
  expect(controls.speed.x).toBeLessThan(controls.restart.x);
  expect(controls.restart.x).toBeLessThan(controls.pause.x);
  // Sem sobreposição: o dedo que quer pausar não pode reiniciar.
  expect(controls.restart.x - controls.restart.width / 2).toBeGreaterThanOrEqual(controls.speed.x + controls.speed.width / 2);
});

test("reiniciar pede confirmação e só aceita depois de um instante", async ({ page }) => {
  const { canvas, clickGame } = await inMatch(page);
  await clickGame(RESTART.x, RESTART.y);

  const confirm = page.getByTestId("confirm-restart");
  await expect(confirm).toBeVisible();
  // Recém-aberta, a confirmação está DESARMADA: o segundo toque do gesto que a abriu não vale.
  await expect(confirm).toHaveAttribute("data-armed", "false");
  await expect(page.getByTestId("confirm-restart-ok")).toBeDisabled();

  await expect(confirm).toHaveAttribute("data-armed", "true", { timeout: 3000 });
  await page.getByTestId("confirm-restart-cancel").click();
  await expect(page.getByTestId("confirm-restart")).toHaveCount(0);
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
});

test("R abre a confirmação, o toque duplo não reinicia e o segundo R depois reinicia", async ({ page }) => {
  const { canvas, clickGame } = await inMatch(page);

  // Põe um Guardião em campo: é o que prova que a fase realmente recomeçou.
  await clickGame(62, 664);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");

  await page.keyboard.press("KeyR");
  await expect(page.getByTestId("confirm-restart")).toBeVisible();
  // A armadilha do enunciado: R duas vezes seguidas, rápido. O segundo tem que ser engolido.
  await page.keyboard.press("KeyR");
  await expect(page.getByTestId("confirm-restart")).toBeVisible();
  await expect(canvas).toHaveAttribute("data-guardians", "1");

  await page.waitForTimeout(ARM_WAIT_MS);
  await page.keyboard.press("KeyR");
  await expect(page.getByTestId("confirm-restart")).toHaveCount(0);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
});

test("Enter confirma o reinício e Esc desiste dele", async ({ page }) => {
  const { canvas } = await inMatch(page);

  await page.keyboard.press("KeyR");
  await expect(page.getByTestId("confirm-restart")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("confirm-restart")).toHaveCount(0);

  await page.keyboard.press("KeyR");
  await expect(page.getByTestId("confirm-restart")).toBeVisible();
  await page.waitForTimeout(ARM_WAIT_MS);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("confirm-restart")).toHaveCount(0);
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
});

test("o espaço chama a onda e, sem onda para chamar, troca a velocidade", async ({ page }) => {
  const { canvas } = await inMatch(page);
  await expect(canvas).toHaveAttribute("data-speed", "1");

  // Durante a contagem, a coisa urgente é adiantar a onda.
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-game-state", /spawning|active/);
  await expect(canvas).toHaveAttribute("data-speed", "1");

  // Com a onda em campo o espaço fica ocioso: aí ele acelera, e alterna de volta.
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-speed", "2");
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-speed", "1");
});

test("a plaquinha da fase mora na barra de cima e diz a dificuldade", async ({ page }) => {
  const { canvas } = await openGame(page, "level=recife-3&difficulty=abissal");
  await expect(canvas).toHaveAttribute("data-difficulty", "abissal");
  // A plaquinha e o chamado de onda subiram para a barra de cima; o canto de baixo ficou só com o
  // painel do Guardião.
  const registry = await page.evaluate(() => window.__grUi?.bounds("nextWave") ?? null);
  if (!registry) throw new Error("Controle nextWave não registrado");
  expect(registry.y, "PRÓXIMA ONDA agora é um botão da barra de cima").toBeLessThan(100);
});
