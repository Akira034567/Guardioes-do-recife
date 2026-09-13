import { expect, test, type Page } from "@playwright/test";
import { openGame } from "./helpers";

/**
 * Regressões de interface dos itens 1, 2, 3, 5, 6 e 7.
 *
 * Tudo aqui nasceu do mesmo lugar: contêineres que rolam por dentro e conteúdo que é reconstruído
 * a cada clique. O sintoma variava — barra de rolagem horizontal no menu, card cortado no topo,
 * página pulando ao escolher um Guardião — mas a causa era sempre estrutural.
 */

/** Um save com a campanha aberta, para as telas terem conteúdo de verdade. */
async function seedProgress(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "guardioes-do-recife.save",
      JSON.stringify({
        saveVersion: 4,
        completedLevels: ["recife-1", "recife-2"],
        levelStars: {
          "recife-1": { stars: 3, objectives: [true, true, true], completions: 1, best: null, clearedDifficulties: ["normal"] },
          "recife-2": { stars: 2, objectives: [true, true, false], completions: 1, best: null, clearedDifficulties: ["normal"] },
        },
        enemyDiscovery: {
          swimmer: { firstSeenLevelId: "recife-1", seenAt: "2026-01-01T00:00:00.000Z", kills: 12 },
          minnow: { firstSeenLevelId: "recife-1", seenAt: "2026-01-01T00:00:00.000Z", kills: 30 },
          dartfish: { firstSeenLevelId: "recife-2", seenAt: "2026-01-01T00:00:00.000Z", kills: 8 },
        },
        settings: { reducedEffects: true },
      }),
    );
  });
}

const SCROLLERS = [".gr-world__nav", ".gr-album__grid", ".gr-album__sheet"];

test("nenhuma coluna do menu rola na horizontal", async ({ page }) => {
  await seedProgress(page);
  const { pageErrors } = await openGame(page, "screen=map");

  await page.getByTestId("map-collection").click();
  await expect(page.getByTestId("collection-panel")).toBeVisible();

  for (const selector of SCROLLERS) {
    const elements = page.locator(selector);
    for (let index = 0; index < (await elements.count()); index += 1) {
      const overflows = await elements.nth(index).evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(overflows, `${selector} não rola na horizontal`).toBe(false);
    }
  }

  // O deslize do hover é o que gerava a barra: com o ponteiro em cima, a regra tem que continuar valendo.
  const item = page.getByTestId("album-nav-bestiary");
  await item.hover();
  const nav = page.locator(".gr-world__nav").first();
  expect(await nav.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
  expect(pageErrors).toEqual([]);
});

test("dá espaço para o card subir no hover sem cortar", async ({ page }) => {
  await seedProgress(page);
  await openGame(page, "screen=map");
  await page.getByTestId("map-collection").click();

  const grid = page.locator(".gr-album__grid").first();
  // A folga no topo é o que impede a primeira linha de ser decepada quando o card sobe 3px.
  const paddingTop = await grid.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop));
  expect(paddingTop).toBeGreaterThanOrEqual(3);
});

test("troca de seção sem remontar a coluna da esquerda", async ({ page }) => {
  await seedProgress(page);
  const { pageErrors } = await openGame(page, "screen=map");
  await page.getByTestId("map-collection").click();
  await expect(page.getByTestId("app-shell")).toBeVisible();

  // Marca a coluna atual. Se a navegação a recriasse, a marca sumiria junto (item 2).
  await page.locator(".gr-shell .gr-world__side").evaluate((element) => element.setAttribute("data-probe", "mesma-coluna"));

  await page.getByTestId("album-nav-bestiary").click();
  await expect(page.getByTestId("bestiary-panel")).toBeVisible();
  await expect(page.locator(".gr-shell .gr-world__side")).toHaveAttribute("data-probe", "mesma-coluna");

  await page.getByTestId("bestiary-nav-achievements").click();
  await expect(page.getByTestId("achievements-panel")).toBeVisible();
  await expect(page.locator(".gr-shell .gr-world__side")).toHaveAttribute("data-probe", "mesma-coluna");
  // E nunca passa pelo mapa no meio do caminho: a moldura segue no topo da pilha.
  await expect(page.locator("canvas")).toHaveAttribute("data-overlay", "shell");
  expect(pageErrors).toEqual([]);
});

test("não mexe na rolagem ao escolher um card", async ({ page }) => {
  await seedProgress(page);
  await openGame(page, "screen=map");
  await page.getByTestId("map-bestiary").click();
  await expect(page.getByTestId("bestiary-panel")).toBeVisible();

  // A grade só rola quando o conteúdo passa da altura disponível, o que depende da resolução.
  // A regra apertada entra por folha de estilo (e não inline) porque o miolo é reconstruído no
  // clique: um estilo no elemento sumiria junto com ele e o teste mediria a coisa errada.
  await page.addStyleTag({ content: ".gr-album__grid { max-height: 90px !important; }" });
  const grid = page.locator(".gr-album__grid").first();
  await grid.evaluate((element) => {
    element.scrollTop = 60;
  });
  const before = await grid.evaluate((element) => element.scrollTop);
  // Em tela estreita a grade não rola por dentro (o layout inteiro é que rola), então não há
  // posição a preservar e o cenário deste teste não existe ali.
  test.skip(before === 0, "a grade só rola por dentro nas telas largas");

  await page.getByTestId("bestiary-card-swimmer").click();
  await expect(page.getByTestId("enemy-page")).toHaveAttribute("data-enemy", "swimmer");
  expect(await grid.evaluate((element) => element.scrollTop)).toBe(before);
});
