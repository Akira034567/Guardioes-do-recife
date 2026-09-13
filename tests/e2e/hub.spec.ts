import { expect, test, type Page } from "@playwright/test";
import { openHub } from "./helpers";

/**
 * Meu Recife: a tela inicial do jogo.
 *
 * As asserções esperam por atributo (`data-hub-ready`, `data-hub-focus`) em vez de correr contra o
 * DOM — o hub tem fade e criaturas em movimento, e esperar por estado é o que mantém a suíte
 * estável. Se o boot ficar instável, revalide com `--workers=1`.
 *
 * O perfil de celular não tem como passar o cursor por cima, então lá vale a regra dos dois toques:
 * o primeiro mostra o nome do lugar, o segundo entra. `enterPlace` cobre os dois casos.
 */

/** Entra num lugar do Recife, respeitando os dois toques de quem não tem cursor. */
async function enterPlace(page: Page, id: string): Promise<void> {
  const spot = page.getByTestId(`hub-spot-${id}`);
  const canvas = page.locator("canvas");
  // Trocar de cena muda `data-screen`; abrir uma seção por cima muda só `data-overlay`.
  const entered = async (): Promise<boolean> =>
    (await canvas.getAttribute("data-screen")) !== "hub" || (await canvas.getAttribute("data-overlay")) !== "hub";
  await spot.click();
  if (await entered()) return;
  await spot.click();
}

test("opens the game in the reef, not in the map", async ({ page }) => {
  const { canvas, pageErrors } = await openHub(page);
  await expect(page.getByTestId("hub-panel")).toBeVisible();
  // Save zerado: os cinco fundadores nadando.
  await expect(canvas).toHaveAttribute("data-hub-guardians", "5");
  await expect(canvas).toHaveAttribute("data-overlay", "hub");
  // Recife pequeno no começo.
  await expect(canvas).toHaveAttribute("data-reef-stage", "0");
  expect(pageErrors).toEqual([]);
});

test("travels from the reef to the map and back", async ({ page }) => {
  const { canvas, pageErrors } = await openHub(page);

  await enterPlace(page, "map");
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  await expect(canvas).toHaveAttribute("data-overlay", "map");

  await page.getByTestId("map-back").click();
  await expect(canvas).toHaveAttribute("data-screen", "hub");
  await expect(canvas).toHaveAttribute("data-hub-ready", "true");
  expect(pageErrors).toEqual([]);
});

test("reaches every section from the reef and comes home", async ({ page }) => {
  // Um save adiantado abre os seis lugares e deixa as seções todas alcançáveis.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "guardioes-do-recife.save",
      JSON.stringify({
        saveVersion: 3,
        completedLevels: ["recife-1", "recife-2", "recife-3", "recife-4"],
        levelStars: {
          "recife-1": { stars: 3, objectives: [true, true, true], completions: 1, best: null },
          "recife-2": { stars: 3, objectives: [true, true, true], completions: 1, best: null },
          "recife-3": { stars: 3, objectives: [true, true, true], completions: 1, best: null },
        },
        completedEncounters: ["gruta-do-predador", "rede-fantasma"],
        storyProgress: { seen: ["abertura", "canal-estreito"] },
        settings: { reducedEffects: true },
      }),
    );
  });
  const { canvas, pageErrors } = await openHub(page);

  await enterPlace(page, "collection");
  await expect(page.getByTestId("collection-panel")).toBeVisible();
  await page.getByTestId("album-nav-hub").click();
  await expect(canvas).toHaveAttribute("data-screen", "hub");

  await enterPlace(page, "bestiary");
  await expect(page.getByTestId("bestiary-panel")).toBeVisible();
  await page.getByTestId("bestiary-back").click();
  await expect(canvas).toHaveAttribute("data-overlay", "hub");

  await enterPlace(page, "achievements");
  await expect(page.getByTestId("achievements-panel")).toBeVisible();
  await page.getByTestId("achievements-back").click();

  await enterPlace(page, "settings");
  await expect(page.getByTestId("settings-panel")).toBeVisible();
  await page.getByTestId("settings-back").click();
  await expect(canvas).toHaveAttribute("data-overlay", "hub");
  expect(pageErrors).toEqual([]);
});

test("shows a guardian sheet that opens the album on that guardian", async ({ page }) => {
  const { pageErrors } = await openHub(page);

  await page.getByTestId("hub-spot-guardian-pistol-shrimp").focus();
  await page.keyboard.press("Enter");
  const card = page.getByTestId("hub-card");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-guardian", "pistol-shrimp");
  // A ficha mostra o papel do Guardião, não um nível que o save não guarda.
  await expect(page.getByTestId("hub-card-role")).toContainText("Dano à distância");

  await page.getByTestId("hub-card-album").click();
  await expect(page.getByTestId("collection-panel")).toBeVisible();
  await expect(page.getByTestId("guardian-sheet")).toHaveAttribute("data-guardian", "pistol-shrimp");
  expect(pageErrors).toEqual([]);
});

test("lights up a place when the keyboard reaches it", async ({ page }) => {
  const { canvas, pageErrors } = await openHub(page);

  // O cenário não pode ser o único caminho: os lugares estão na ordem de tabulação.
  await page.getByTestId("hub-spot-map").focus();
  await expect(canvas).toHaveAttribute("data-hub-focus", "map");
  await expect(page.getByTestId("hub-label")).toContainText("Mapa do Recife");

  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  expect(pageErrors).toEqual([]);
});

test("grows the reef as the campaign advances", async ({ page }) => {
  const empty = await openHub(page);
  const emptyDecorations = Number(await empty.canvas.getAttribute("data-reef-decorations"));
  const emptyGuardians = Number(await empty.canvas.getAttribute("data-hub-guardians"));

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "guardioes-do-recife.save",
      JSON.stringify({
        saveVersion: 3,
        completedLevels: ["recife-1", "recife-2", "recife-3", "recife-4", "recife-5"],
        levelStars: {
          "recife-1": { stars: 3, objectives: [true, true, true], completions: 1, best: null },
          "recife-2": { stars: 3, objectives: [true, true, true], completions: 1, best: null },
          "recife-3": { stars: 3, objectives: [true, true, true], completions: 1, best: null },
          "recife-4": { stars: 3, objectives: [true, true, true], completions: 1, best: null },
        },
        completedEncounters: ["gruta-do-predador", "rede-fantasma", "chamado-do-golfinho"],
        storyProgress: { seen: ["abertura", "canal-estreito", "gruta-fria"] },
        settings: { reducedEffects: true },
      }),
    );
  });
  const grown = await openHub(page);
  const grownDecorations = Number(await grown.canvas.getAttribute("data-reef-decorations"));
  const grownGuardians = Number(await grown.canvas.getAttribute("data-hub-guardians"));

  expect(grownDecorations).toBeGreaterThan(emptyDecorations);
  expect(grownGuardians).toBeGreaterThan(emptyGuardians);
  expect(Number(await grown.canvas.getAttribute("data-reef-stage"))).toBeGreaterThan(0);
  expect(grown.pageErrors).toEqual([]);
});

test("keeps the same reef across reloads", async ({ page }) => {
  await openHub(page);
  const first = await page.evaluate(() => window.localStorage.getItem("guardioes-do-recife.save"));
  const firstReef = JSON.parse(first ?? "{}").reef;
  expect(firstReef.placed.length).toBeGreaterThan(0);

  await page.reload();
  await expect(page.locator("canvas")).toHaveAttribute("data-hub-ready", "true", { timeout: 10_000 });
  const second = await page.evaluate(() => window.localStorage.getItem("guardioes-do-recife.save"));
  // O Recife é do jogador: recarregar não pode reembaralhar o que ele já viu.
  expect(JSON.parse(second ?? "{}").reef.placed).toEqual(firstReef.placed);
});
