import { expect, test } from "@playwright/test";
import { CARD_X, CARD_Y, MENU, NEXT_WAVE, openGame, OPTION_A, OPTION_B, PAUSE, RESTART, SELL, SPEED_1X, SPEED_2X } from "./helpers";

test("loads a level directly and places a shrimp on a platform", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);
  await expect(canvas).toHaveAttribute("data-screen", "game");
  await expect(canvas).toHaveAttribute("data-level", "recife-1");
  await expect(canvas).toHaveAttribute("data-game-state", /countdown|spawning|active/);
  await expect(canvas).toHaveAttribute("data-shrimp-assets", "true");

  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "100");
  await expect(canvas).toHaveAttribute("data-shrimp-art", "true");
  await expect(canvas).toHaveAttribute("data-shrimp-visual", "pistol-shrimp-base-idle");
  await expect(canvas).toHaveAttribute("data-shrimp-texture", "pistol-shrimp-base-idle");
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  await expect(canvas).toHaveAttribute("data-selected-options", "2");
  await expect(canvas).toHaveAttribute("data-sell-value", "20");
  expect(pageErrors).toEqual([]);
});

test("opens debug overlay using F2", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1&debug=1");
  await expect(canvas).toHaveAttribute("data-debug", "true");
  await expect(canvas).toHaveAttribute("data-debug-panel", "expanded");
  await clickGame(1238, 105);
  await expect(canvas).toHaveAttribute("data-debug", "true");
  await expect(canvas).toHaveAttribute("data-debug-panel", "collapsed");
  await clickGame(1190, 92);
  await expect(canvas).toHaveAttribute("data-debug-panel", "expanded");
  await page.keyboard.press("F2");
  await expect(canvas).toHaveAttribute("data-debug", "false");
  await expect(canvas).toHaveAttribute("data-debug-panel", "hidden");
  await page.keyboard.press("F2");
  await expect(canvas).toHaveAttribute("data-debug", "true");
  await expect(canvas).toHaveAttribute("data-game-state", /countdown|spawning|active/);
  expect(pageErrors).toEqual([]);
});

test("sells a guardian for a quarter of the investment and frees the platform", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "100");

  await clickGame(SELL.x, SELL.y);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-pearls", "120");
  await expect(canvas).toHaveAttribute("data-selected", "");

  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "40");
  expect(pageErrors).toEqual([]);
});

test("locks a unit into one upgrade branch, pauses and restarts without stale state", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);
  await clickGame(CARD_X.shrimp, CARD_Y);
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-pearls", "100");

  await clickGame(OPTION_A.x, OPTION_A.y);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "30");
  await expect(canvas).toHaveAttribute("data-selected-branch", "a");
  await expect(canvas).toHaveAttribute("data-selected-options", "1");
  await expect(canvas).toHaveAttribute("data-sell-value", "37");
  await expect(canvas).toHaveAttribute("data-shrimp-visual", "pistol-shrimp-perfuracao-1-idle");
  await expect(canvas).toHaveAttribute("data-shrimp-texture", "pistol-shrimp-perfuracao-1-idle");

  // O segundo botão fica oculto após a escolha do ramo: clicar ali não compra nada.
  await clickGame(OPTION_B.x, OPTION_B.y);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "30");

  await clickGame(PAUSE.x, PAUSE.y);
  await expect(canvas).toHaveAttribute("data-paused", "true");
  await expect(page.getByTestId("pause-panel")).toBeVisible();
  await page.getByTestId("pause-resume").click();
  await expect(canvas).toHaveAttribute("data-paused", "false");

  await clickGame(RESTART.x, RESTART.y);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await expect(canvas).toHaveAttribute("data-pearls", "180");
  await expect(canvas).toHaveAttribute("data-level", "recife-1");
  expect(pageErrors).toEqual([]);
});

test("enforces water and route placement rules on the shipwreck level", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-5");
  await expect(canvas).toHaveAttribute("data-level", "recife-5");
  await expect(canvas).toHaveAttribute("data-pearls", "340");

  // Água-viva: em cima da correnteza é inválido; água livre longe da rota é válido.
  await clickGame(CARD_X.jellyfish, CARD_Y);
  await clickGame(900, 492);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await clickGame(700, 150);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "240");

  // Caranguejo: longe da correnteza é inválido; em cima dela "snapa" para a linha central.
  await clickGame(CARD_X.crab, CARD_Y);
  await clickGame(1100, 150);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await clickGame(900, 492);
  await expect(canvas).toHaveAttribute("data-guardians", "2");
  await expect(canvas).toHaveAttribute("data-pearls", "150");
  await expect(canvas).toHaveAttribute("data-selected", "G2");

  await clickGame(700, 150);
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  await clickGame(1100, 150);
  await expect(canvas).toHaveAttribute("data-selected", "");
  await clickGame(900, 492);
  await expect(canvas).toHaveAttribute("data-selected", "G2");
  expect(pageErrors).toEqual([]);
});

const NEW_SQUAD = "guardians=pistol-shrimp,shark,sea-turtle,stonefish,dolphin";
/** Carta na posição do esquadrão acima: 0 camarão, 1 tubarão, 2 tartaruga, 3 peixe-pedra, 4 golfinho. */
const squadCard = (slot: number) => 62 + slot * 118;

test("places the shark only in the margin band and locks the other branch after the first upgrade", async ({ page }) => {
  test.setTimeout(200_000);
  const { canvas, clickGame, pageErrors } = await openGame(page, `level=recife-1&${NEW_SQUAD}`);
  await expect(canvas).toHaveAttribute("data-loadout", "pistol-shrimp,shark,sea-turtle,stonefish,dolphin");

  // Em cima da rota é recusado; na beira (30–120px da linha central) é aceito.
  await clickGame(squadCard(1), CARD_Y);
  await clickGame(350, 390);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await clickGame(300, 470);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "70");
  await expect(canvas).toHaveAttribute("data-selected-options", "2");

  // Ramo B (Caçador Alfa): o ramo A fica bloqueado e o botão A não compra nada.
  await expect.poll(async () => Number(await canvas.getAttribute("data-pearls")), { timeout: 150_000 }).toBeGreaterThanOrEqual(90);
  await clickGame(300, 470);
  await expect(canvas).toHaveAttribute("data-selected", "G1");
  await clickGame(OPTION_B.x, OPTION_B.y);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-selected-branch", "b");
  await expect(canvas).toHaveAttribute("data-selected-variant", "alfa_1");
  await expect(canvas).toHaveAttribute("data-selected-options", "1");
  const pearlsAfter = await canvas.getAttribute("data-pearls");
  await clickGame(OPTION_A.x, OPTION_A.y);
  await page.waitForTimeout(200);
  await expect(canvas).toHaveAttribute("data-upgrades", "1");
  await expect(canvas).toHaveAttribute("data-pearls", pearlsAfter ?? "");
  expect(pageErrors).toEqual([]);
});

test("buries the stonefish on the route and arms it after a few seconds", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, `level=recife-1&${NEW_SQUAD}`);
  await clickGame(squadCard(3), CARD_Y);
  await clickGame(700, 150);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await clickGame(700, 260);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "85");
  await expect(canvas).toHaveAttribute("data-trap-phase", "arming");
  await expect(canvas).toHaveAttribute("data-trap-phase", /armed|triggered|cooldown/, { timeout: 15_000 });
  expect(pageErrors).toEqual([]);
});

test("places the dolphin in open water and the turtle on the route", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, `level=recife-2&${NEW_SQUAD}`);
  await expect(canvas).toHaveAttribute("data-pearls", "220");
  await clickGame(squadCard(4), CARD_Y);
  await clickGame(950, 340);
  await expect(canvas).toHaveAttribute("data-guardians", "0");
  await clickGame(640, 180);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "100");

  await clickGame(squadCard(2), CARD_Y);
  await clickGame(720, 200);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await clickGame(910, 395);
  await expect(canvas).toHaveAttribute("data-guardians", "2");
  await expect(canvas).toHaveAttribute("data-pearls", "0");
  await expect(canvas).toHaveAttribute("data-selected", "G2");
  await expect(canvas).toHaveAttribute("data-selected-options", "2");
  expect(pageErrors).toEqual([]);
});

test("skips wave preparation by keyboard and button", async ({ page }) => {
  const { canvas, clickGame } = await openGame(page);
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-game-state", /spawning|active/);
  await clickGame(RESTART.x, RESTART.y);
  await expect(canvas).toHaveAttribute("data-game-state", "countdown");
  await page.waitForTimeout(250);
  await clickGame(NEXT_WAVE.x, NEXT_WAVE.y);
  await expect(canvas).toHaveAttribute("data-game-state", /spawning|active/);
});

test("level select only opens unlocked levels", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/?screen=map");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  await expect(canvas).toHaveAttribute("data-unlocked-levels", "1");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);

  // O mapa mostra as seis fases; só a primeira está aberta, e os Encontros começam fechados.
  await expect(page.getByTestId("map-node-recife-1")).toHaveAttribute("data-state", "available");
  await expect(page.getByTestId("map-node-recife-2")).toHaveAttribute("data-state", "locked");
  await expect(page.getByTestId("map-node-recife-2")).toBeDisabled();
  await expect(page.getByTestId("map-node-gruta-do-predador")).toHaveAttribute("data-state", "locked");

  // O nó escolhe a fase e enche a ficha de baixo; quem entra na partida é o botão da ficha.
  await page.getByTestId("map-node-recife-1").click();
  await expect(page.getByTestId("map-detail")).toHaveAttribute("data-level", "recife-1");
  await expect(page.getByTestId("map-detail")).toContainText("Recife Costeiro");
  await page.getByTestId("map-enter").click();
  await expect(page.getByTestId("story-panel")).toHaveAttribute("data-story", "abertura");
  await page.getByTestId("story-next").click();
  await expect(page.getByTestId("story-text")).toContainText("corrente virar");
  await page.getByTestId("story-skip").click();
  await expect(page.getByTestId("prep-panel")).toHaveAttribute("data-level", "recife-1");
  await expect(page.getByTestId("prep-objectives")).toContainText("Proteja o Recife");
  await page.getByTestId("prep-start").click();
  await expect(canvas).toHaveAttribute("data-screen", "game");
  await expect(canvas).toHaveAttribute("data-level", "recife-1");

  await clickGame(MENU.x, MENU.y);
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  expect(pageErrors).toEqual([]);
});

test("switches match speed, pauses and previews the next wave", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page);
  await expect(canvas).toHaveAttribute("data-speed", "1");
  // A prévia lista a composição da onda que está por vir (item 9).
  await expect(canvas).toHaveAttribute("data-next-wave", /swimmer:\d+/);

  await clickGame(SPEED_2X.x, SPEED_2X.y);
  await expect(canvas).toHaveAttribute("data-speed", "2");
  await clickGame(PAUSE.x, PAUSE.y);
  await expect(canvas).toHaveAttribute("data-paused", "true");
  await expect(page.getByTestId("pause-panel")).toBeVisible();
  await page.getByTestId("pause-resume").click();
  await expect(canvas).toHaveAttribute("data-paused", "false");
  await clickGame(SPEED_1X.x, SPEED_1X.y);
  await expect(canvas).toHaveAttribute("data-speed", "1");
  expect(pageErrors).toEqual([]);
});

test("plays a harder difficulty with elites in the waves", async ({ page }) => {
  const { canvas, pageErrors } = await openGame(page, "level=recife-1&difficulty=abissal");
  await expect(canvas).toHaveAttribute("data-difficulty", "abissal");
  // No Abissal a fase começa com menos pérolas e alguma onda traz elites (marcados com "+").
  await expect(canvas).toHaveAttribute("data-pearls", "144");
  expect(pageErrors).toEqual([]);
});

test("migrates an old save so existing players keep their levels", async ({ page }) => {
  // Progresso antigo (`{completed}` na chave v1) precisa continuar valendo depois do save versionado.
  await page.addInitScript(() => {
    window.localStorage.setItem("guardioes-do-recife.progress.v1", JSON.stringify({ completed: ["recife-1", "recife-2"] }));
  });
  const { canvas, pageErrors } = await openGame(page, "screen=map");
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  await expect(canvas).toHaveAttribute("data-unlocked-levels", "3");
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem("guardioes-do-recife.save") ?? "{}"));
  expect(saved.saveVersion).toBe(3);
  expect(saved.completedLevels).toEqual(["recife-1", "recife-2"]);
  expect(saved.levelStars["recife-1"].stars).toBe(1);
  expect(saved.currency.shells).toBeGreaterThan(0);
  const legacy = await page.evaluate(() => window.localStorage.getItem("guardioes-do-recife.progress.v1"));
  expect(legacy, "a chave antiga fica para trás como segurança").not.toBeNull();
  expect(pageErrors).toEqual([]);
});

test("opens the reef album, the bestiary and the settings from the map", async ({ page }) => {
  // Save com Recife 1 concluído e um inimigo já catalogado.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "guardioes-do-recife.save",
      JSON.stringify({
        saveVersion: 2,
        completedLevels: ["recife-1"],
        enemyDiscovery: { swimmer: { firstSeenLevelId: "recife-1", seenAt: "2026-01-01T00:00:00.000Z", kills: 12 } },
      }),
    );
  });
  const { canvas, pageErrors } = await openGame(page, "screen=map");
  await expect(canvas).toHaveAttribute("data-screen", "menu");

  // Álbum do Recife: os cinco fundadores aparecem; o Peixe-Pedra segue oculto em "???".
  await page.getByTestId("map-collection").click();
  await expect(page.getByTestId("collection-panel")).toBeVisible();
  await expect(page.getByTestId("collection-card-pistol-shrimp")).toHaveAttribute("data-state", "unlocked");
  await expect(page.getByTestId("collection-card-stonefish")).toHaveAttribute("data-state", "locked");
  await expect(page.getByTestId("collection-card-stonefish")).toContainText("???");

  // A carta escolhe o Guardião e a ficha ao lado troca, sem sair da tela.
  await page.getByTestId("collection-card-pistol-shrimp").click();
  await expect(page.getByTestId("guardian-sheet")).toHaveAttribute("data-guardian", "pistol-shrimp");
  await expect(page.getByTestId("sheet-info")).toContainText("Alcance");
  await expect(page.getByTestId("guardian-career")).toBeVisible();

  // As abas da ficha trocam o miolo: habilidades, evoluções e história.
  await page.getByTestId("sheet-tab-skills").click();
  await expect(page.getByTestId("sheet-skills")).toContainText("dano");
  await page.getByTestId("sheet-tab-tree").click();
  await expect(page.getByTestId("guardian-branch-a")).toBeVisible();
  await expect(page.getByTestId("guardian-branch-b")).toBeVisible();

  // As outras abas do álbum saem dos mesmos dados do jogo.
  await page.getByTestId("album-tab-places").click();
  await expect(page.getByTestId("album-progress")).toContainText("de 10");
  await expect(page.getByTestId("collection-card-recife-1")).toHaveAttribute("data-state", "unlocked");
  await expect(page.getByTestId("collection-card-recife-6")).toHaveAttribute("data-state", "locked");
  await page.getByTestId("album-tab-treasures").click();
  await expect(page.getByTestId("collection-card-rede")).toBeVisible();

  await page.getByTestId("collection-back").click();

  // Bestiário: o Quebra-Marés só aparece depois do primeiro encontro.
  await page.getByTestId("map-bestiary").click();
  await expect(page.getByTestId("bestiary-panel")).toBeVisible();
  await expect(page.getByTestId("bestiary-card-tidebreaker")).toHaveAttribute("data-state", "unknown");
  await expect(page.getByTestId("bestiary-card-tidebreaker")).toBeDisabled();
  await expect(page.getByTestId("bestiary-card-swimmer")).toHaveAttribute("data-state", "seen");
  await page.getByTestId("bestiary-card-swimmer").click();
  await expect(page.getByTestId("enemy-page")).toHaveAttribute("data-enemy", "swimmer");
  await expect(page.getByTestId("enemy-tip")).toContainText("contra ele");

  // O filtro esconde quem não interessa e some com a ficha quando nada sobra catalogado.
  await page.getByTestId("bestiary-filter-boss").click();
  await expect(page.getByTestId("bestiary-card-swimmer")).toHaveCount(0);
  await expect(page.getByTestId("bestiary-card-tidebreaker")).toBeVisible();
  await page.getByTestId("bestiary-filter-all").click();
  await page.getByTestId("bestiary-back").click();

  // Histórias: o capítulo da fase aberta está "em andamento"; o das fases distantes segue fechado.
  await page.getByTestId("map-stories").click();
  await expect(page.getByTestId("story-index")).toBeVisible();
  await expect(page.getByTestId("story-entry-abertura")).toHaveAttribute("data-state", "pending");
  await expect(page.getByTestId("story-entry-naufragio")).toHaveAttribute("data-state", "locked");
  await expect(page.getByTestId("story-entry-naufragio")).toContainText("???");

  // Capítulo não vivido não pode ser lido; a ficha conta onde ele acontece, não o que acontece.
  await page.getByTestId("story-entry-naufragio").click();
  await expect(page.getByTestId("story-sheet")).toHaveAttribute("data-story", "naufragio");
  await expect(page.getByTestId("story-read")).toBeDisabled();
  await expect(page.getByTestId("story-quote")).toHaveCount(0);

  // O filtro separa o que já foi vivido do resto.
  await page.getByTestId("story-filter-locked").click();
  await expect(page.getByTestId("story-entry-abertura")).toHaveCount(0);
  await page.getByTestId("story-index-back").click();

  // Configurações: a escolha vale na hora e fica gravada no save.
  await page.getByTestId("map-settings").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();
  await page.getByTestId("settings-mute").click();
  await page.getByTestId("settings-scale-large").click();
  await expect(page.getByTestId("settings-ui-scale")).toHaveAttribute("data-value", "large");
  const settings = await page.evaluate(() => JSON.parse(window.localStorage.getItem("guardioes-do-recife.save") ?? "{}").settings);
  expect(settings.muted).toBe(true);
  expect(settings.uiScale).toBe("large");

  // Alto contraste é acessibilidade de verdade: vale na hora, na camada inteira de menus.
  await page.getByTestId("settings-contrast").click();
  await expect(page.locator("#ui-layer")).toHaveAttribute("data-contrast", "high");

  // "Restaurar padrão" devolve tudo de uma vez.
  await page.getByTestId("settings-restore").click();
  await expect(page.getByTestId("settings-ui-scale")).toHaveAttribute("data-value", "normal");
  await expect(page.locator("#ui-layer")).toHaveAttribute("data-contrast", "normal");
  const restored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("guardioes-do-recife.save") ?? "{}").settings);
  expect(restored.muted).toBe(false);
  expect(restored.highContrast).toBe(false);
  await page.getByTestId("settings-back").click();
  // Fechar uma tela volta para o mapa, que agora é a tela inicial do jogo.
  await expect(canvas).toHaveAttribute("data-overlay", "map");
  expect(pageErrors).toEqual([]);
});

test("guides the first match with hints that never block the game", async ({ page }) => {
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1");
  // O registro do HUD publica cada controle por nome: os testes não dependem de coordenadas soltas.
  const names = await page.evaluate(() => window.__grUi?.names() ?? []);
  expect(names).toEqual(expect.arrayContaining(["pause", "speed:2", "nextWave", "sell", "card:first", "tutorial:skip"]));

  await expect(canvas).toHaveAttribute("data-tutorial", "pick-card");
  await clickGame(CARD_X.shrimp, CARD_Y);
  await expect(canvas).toHaveAttribute("data-tutorial", "place-guardian");
  // A dica fica na tela e o jogo continua respondendo: o Guardião é posicionado normalmente.
  await clickGame(375, 245);
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-tutorial", "wave-start");

  const skip = await page.evaluate(() => window.__grUi?.bounds("tutorial:skip") ?? null);
  if (!skip) throw new Error("Controle tutorial:skip não registrado");
  await clickGame(skip.x, skip.y);
  await expect(canvas).toHaveAttribute("data-tutorial", "");
  // Pulado uma vez, o tutorial não volta na próxima partida.
  await page.reload();
  await expect(canvas).toHaveAttribute("data-screen", "game", { timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-tutorial", "");
  expect(pageErrors).toEqual([]);
});

test("rescues a guardian in an encounter and adds him to the collection", async ({ page }) => {
  // Save com a campanha até o Recife 3: o Encontro da Tartaruga está aberto no mapa.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "guardioes-do-recife.save",
      JSON.stringify({ saveVersion: 2, completedLevels: ["recife-1", "recife-2", "recife-3"], storyProgress: { seen: ["abertura"] } }),
    );
  });
  const { canvas, clickGame, pageErrors } = await openGame(page, "screen=map");
  await expect(page.getByTestId("map-node-rede-fantasma")).toHaveAttribute("data-state", "available");
  await page.getByTestId("map-node-rede-fantasma").click();
  await expect(page.getByTestId("map-detail")).toHaveAttribute("data-kind", "encounter");
  await page.getByTestId("map-enter").click();
  await expect(page.getByTestId("prep-encounter")).toContainText("Tartaruga");
  await page.getByTestId("prep-start").click();
  await expect(canvas).toHaveAttribute("data-level", "rede-fantasma");
  // A rede começa disponível e sem progresso.
  await expect(canvas).toHaveAttribute("data-interactables", "rede:available:0");

  // Cinco cortes, com fôlego entre eles; um toque adiantado não conta, então insistimos até cair.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if ((await canvas.getAttribute("data-interactables")) === "rede:done:100") break;
    await clickGame(700, 480);
    await page.waitForTimeout(1200);
  }
  await expect(canvas).toHaveAttribute("data-interactables", "rede:done:100");
  // A Tartaruga entra em campo de graça, sem custar pérolas.
  await expect(canvas).toHaveAttribute("data-guardians", "1");
  await expect(canvas).toHaveAttribute("data-pearls", "210");
  expect(pageErrors).toEqual([]);
});

test("tracks achievements and offers the rotating challenges", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "guardioes-do-recife.save",
      JSON.stringify({
        saveVersion: 2,
        completedLevels: ["recife-1", "recife-2"],
        totals: { matches: 9, victories: 4, defeats: 5, kills: 260, playTimeMs: 1_800_000, wavesCleared: 30 },
        storyProgress: { seen: ["abertura", "canal-estreito"] },
      }),
    );
  });
  const { canvas, pageErrors } = await openGame(page, "screen=map");
  await expect(canvas).toHaveAttribute("data-screen", "menu");

  // As conquistas são recalculadas ao abrir o mapa: um perfil com histórico não vê a lista zerada.
  await page.getByTestId("map-achievements").click();
  await expect(page.getByTestId("achievements-panel")).toBeVisible();
  await expect(page.getByTestId("achievement-primeira-mare")).toHaveAttribute("data-state", "unlocked");
  await expect(page.getByTestId("achievement-faxina")).toContainText("260/500");
  await expect(page.getByTestId("achievement-sozinho-no-escuro"), "conquista escondida").toContainText("???");

  // A ficha mostra a data real da conquista e a prateleira filtra a lista.
  await page.getByTestId("achievement-primeira-mare").click();
  await expect(page.getByTestId("achievement-sheet")).toHaveAttribute("data-achievement", "primeira-mare");
  await expect(page.getByTestId("achievement-reward")).toContainText("Concluída em");
  await page.getByTestId("achievements-filter-colecao").click();
  await expect(page.getByTestId("achievement-primeira-mare")).toHaveCount(0);
  await expect(page.getByTestId("achievement-catalogo-do-recife")).toBeVisible();
  await page.getByTestId("achievements-back").click();

  // O desafio do dia vem com fase, dificuldade e esquadrão já decididos.
  await page.getByTestId("map-challenge-daily").click();
  await expect(page.getByTestId("prep-challenge")).toContainText("Desafio do dia");
  await expect(page.getByTestId("prep-slot-0")).not.toHaveAttribute("data-guardian", "");
  await expect(page.getByTestId("prep-difficulty")).toHaveCount(0);
  await page.getByTestId("prep-back").click();
  await expect(canvas).toHaveAttribute("data-overlay", "map");
  expect(pageErrors).toEqual([]);
});
