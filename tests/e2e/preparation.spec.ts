import { expect, test, type Page } from "@playwright/test";
import { openGame } from "./helpers";

/** Abre a preparação da primeira fase, com um perfil novo. */
async function openPreparation(page: Page) {
  const opened = await openGame(page, "screen=map");
  await expect(opened.canvas).toHaveAttribute("data-screen", "menu");
  await page.getByTestId("map-node-recife-1").click();
  await page.getByTestId("map-enter").click();
  // A primeira fase abre com a história de abertura por cima da preparação.
  if (await page.getByTestId("story-skip").isVisible().catch(() => false)) {
    await page.getByTestId("story-skip").click();
  }
  await expect(page.getByTestId("prep-panel")).toBeVisible();
  return opened;
}

test("mantém Difícil e Abissal bloqueados até a campanha cair no Normal", async ({ page }) => {
  // Item 4: o desbloqueio é GLOBAL da campanha; um perfil novo só tem o Normal.
  const { pageErrors } = await openPreparation(page);

  await expect(page.getByTestId("prep-difficulty")).toHaveAttribute("data-value", "normal");
  await expect(page.getByTestId("prep-difficulty-normal")).toHaveAttribute("data-locked", "false");
  await expect(page.getByTestId("prep-difficulty-dificil")).toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("prep-difficulty-abissal")).toHaveAttribute("data-locked", "true");

  // A bloqueada aparece, explica o requisito e não pode ser escolhida.
  await expect(page.getByTestId("prep-difficulty-dificil")).toContainText("Conclua as 6 fases no Normal");
  // `force` porque o Playwright recusa clicar em `aria-disabled` — que é justamente o que queremos
  // marcado. O navegador não bloqueia o clique de verdade, então é ele que precisa ser testado.
  await page.getByTestId("prep-difficulty-dificil").click({ force: true });
  await expect(page.getByTestId("prep-difficulty")).toHaveAttribute("data-value", "normal");
  await expect(page.getByTestId("prep-difficulty-requirement")).toContainText("Conclua as 6 fases no Normal");
  expect(pageErrors).toEqual([]);
});

test("preenche a vaga e fecha o seletor sozinho", async ({ page }) => {
  // Item 5: clicar numa vaga vazia abre o quadro ligado a ela; escolher preenche AQUELA vaga e
  // fecha. Pelo botão "Alterar Guardiões" o quadro fica aberto para várias trocas.
  const { pageErrors } = await openPreparation(page);

  // O esquadrão padrão já vem cheio: esvazia uma vaga para testar o caminho da vaga vazia.
  await page.getByTestId("prep-slot-remove-2").click();
  await expect(page.getByTestId("prep-slot-4")).toHaveAttribute("data-guardian", "");

  await page.getByTestId("prep-slot-4").click();
  await expect(page.getByTestId("prep-guardians")).toBeVisible();
  await page.getByTestId("prep-guardian-pufferfish").click();

  // Fechou sozinho, sem precisar clicar em "Fechar".
  await expect(page.getByTestId("prep-guardians")).toHaveCount(0);
  await expect(page.getByTestId("prep-start")).toBeEnabled();

  // Já o quadro aberto pelo botão continua aberto depois de uma escolha.
  await page.getByTestId("prep-roster-toggle").click();
  await expect(page.getByTestId("prep-guardians")).toBeVisible();
  await page.getByTestId("prep-guardian-pufferfish").click();
  await expect(page.getByTestId("prep-guardians")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("não mexe na rolagem ao escolher Guardião", async ({ page }) => {
  // Item 6: a coluna da direita rola por dentro e era recriada inteira a cada clique, jogando a
  // página de volta ao topo. Agora só os pedaços que mudam são reescritos.
  await openPreparation(page);
  await page.getByTestId("prep-roster-toggle").click();
  await expect(page.getByTestId("prep-guardians")).toBeVisible();

  const side = page.locator(".gr-prep__side");
  // Rola até o fim, que é onde o quadro de Guardiões fica: assim o alvo do clique está à vista e o
  // navegador não precisa rolar por conta própria para alcançá-lo.
  await side.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const before = await side.evaluate((element) => element.scrollTop);
  // Em tela estreita a coluna não rola por dentro — o layout inteiro é que rola. Sem rolador, não
  // há o que preservar, e o cenário deste teste simplesmente não existe ali.
  test.skip(before === 0, "a coluna só rola por dentro nas telas largas");

  await page.getByTestId("prep-guardian-pufferfish").click();
  expect(await side.evaluate((element) => element.scrollTop)).toBe(before);

  await page.getByTestId("prep-guardian-pufferfish").click();
  expect(await side.evaluate((element) => element.scrollTop)).toBe(before);
});

test("reordena as vagas arrastando e leva a ordem para o HUD", async ({ page, isMobile }) => {
  // Item 7: a ordem das vagas é a ordem das cartas dentro da fase.
  //
  // Só no alvo de ponteiro: o Playwright não sintetiza um arrasto de TOQUE de verdade (o
  // `touchscreen` dele só toca). O caminho equivalente no toque tem cobertura própria, pelo teclado.
  test.skip(isMobile, "o Playwright não sintetiza arrasto por toque");
  const { canvas, pageErrors } = await openPreparation(page);

  const before = await page.getByTestId("prep-slot-0").getAttribute("data-guardian");
  const moved = await page.getByTestId("prep-slot-4").getAttribute("data-guardian");
  expect(before).not.toBe(moved);

  const from = await page.getByTestId("prep-slot-4").boundingBox();
  const to = await page.getByTestId("prep-slot-0").boundingBox();
  if (!from || !to) throw new Error("vagas sem geometria");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Dois passos: o primeiro cruza o limiar que separa arrastar de tocar, o segundo mira o destino.
  await page.mouse.move(from.x + from.width / 2 - 40, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByTestId("prep-slot-0")).toHaveAttribute("data-guardian", moved ?? "");
  await expect(page.getByTestId("prep-slot-1")).toHaveAttribute("data-guardian", before ?? "");

  await page.getByTestId("prep-start").click();
  await expect(canvas).toHaveAttribute("data-screen", "game");
  // `data-loadout` é a ordem que a fase recebeu: o arrasto tem que chegar até aqui.
  const loadout = await canvas.getAttribute("data-loadout");
  expect(loadout?.split(",")[0]).toBe(moved);
  expect(pageErrors).toEqual([]);
});

test("reordena as vagas pelo teclado", async ({ page }) => {
  // O mesmo resultado do arrasto, pelas setas: é o caminho acessível e o que dá cobertura no toque.
  await openPreparation(page);
  const first = await page.getByTestId("prep-slot-0").getAttribute("data-guardian");
  const second = await page.getByTestId("prep-slot-1").getAttribute("data-guardian");
  expect(first).not.toBe(second);

  await page.getByTestId("prep-slot-1").focus();
  await page.keyboard.press("ArrowLeft");

  await expect(page.getByTestId("prep-slot-0")).toHaveAttribute("data-guardian", second ?? "");
  await expect(page.getByTestId("prep-slot-1")).toHaveAttribute("data-guardian", first ?? "");
});

test("um toque curto numa vaga continua abrindo o seletor", async ({ page }) => {
  // O limiar do arrasto existe justamente para preservar isto no toque.
  await openPreparation(page);
  await page.getByTestId("prep-slot-remove-3").click();
  const slot = await page.getByTestId("prep-slot-4").boundingBox();
  if (!slot) throw new Error("vaga sem geometria");
  await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2);
  await page.mouse.down();
  await page.mouse.move(slot.x + slot.width / 2 + 2, slot.y + slot.height / 2, { steps: 2 });
  await page.mouse.up();
  await expect(page.getByTestId("prep-guardians")).toBeVisible();
});
