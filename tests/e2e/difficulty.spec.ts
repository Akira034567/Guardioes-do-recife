import { expect, test, type Page } from "@playwright/test";
import { openGame } from "./helpers";

/**
 * Dificuldade fora da partida (V3.5).
 *
 * O Difícil existia e era invisível: o jogador fechava a campanha no Normal, liberava o Difícil e
 * nada no mapa mudava — nem que ele existia, nem que a missão de lá é OUTRA. Estas sondas guardam
 * as três coisas que passaram a aparecer: a trilha escolhida, a progressão dela e os objetivos
 * próprios de cada uma.
 */

const LEVELS = ["recife-1", "recife-2", "recife-3", "recife-4", "recife-5", "recife-6"];

/** Um save com a campanha inteira vencida no Normal — o que abre o Difícil. */
async function seedCampaignCleared(page: Page): Promise<void> {
  await page.addInitScript(
    ([levelIds]) => {
      const levelStars: Record<string, unknown> = {};
      for (const levelId of levelIds as string[]) {
        levelStars[levelId] = {
          stars: 3,
          objectives: [true, true, true],
          completions: 1,
          best: { livesLost: 2, durationMs: 200000, guardiansUsed: 5, difficulty: "normal", distinctGuardians: 4 },
          clearedDifficulties: ["normal"],
          byDifficulty: { normal: { stars: 3, objectives: [true, true, true], completions: 1 } },
        };
      }
      window.localStorage.setItem(
        "guardioes-do-recife.save",
        JSON.stringify({
          saveVersion: 6,
          completedLevels: levelIds,
          levelStars,
          settings: { reducedEffects: true },
        }),
      );
    },
    [LEVELS],
  );
}

test("o mapa abre na dificuldade mais alta que o jogador liberou e mostra a trilha dela", async ({ page }) => {
  await seedCampaignCleared(page);
  await openGame(page, "screen=map");

  const panel = page.getByTestId("map-panel");
  // Campanha fechada no Normal: o mapa já abre no Difícil, em vez de esconder que ele existe.
  await expect(panel).toHaveAttribute("data-difficulty", "dificil");
  await expect(page.getByTestId("map-difficulty-sign")).toHaveAttribute("data-value", "dificil");
  await expect(page.getByTestId("map-track-dificil")).toHaveAttribute("data-state", "current");
  await expect(page.getByTestId("map-track-abissal")).toHaveAttribute("data-state", "locked");

  // No Difícil ninguém venceu nada ainda: as estrelas voltam a zero, e os nós voltam a "por fazer".
  // A pílula é enxuta de propósito — a contagem de fases vive no `data-cleared` e no `title`.
  await expect(page.getByTestId("map-track-dificil")).toHaveAttribute("data-cleared", "0");
  // As estrelas contam a campanha inteira: 16 fases × 3 (Recife Costeiro + Canais Profundos).
  await expect(page.getByTestId("map-track-dificil")).toContainText("0/48");
  // Quem fechou o Recife Costeiro abre o mapa já nos Canais; a seta volta para a primeira região.
  await expect(page.getByTestId("map-regions")).toHaveAttribute("data-value", "canais-profundos");
  await page.getByTestId("map-region-prev").click();
  await expect(page.getByTestId("map-regions")).toHaveAttribute("data-value", "recife-costeiro");
  await expect(page.getByTestId("map-node-recife-1")).toHaveAttribute("data-state", "available");

  // Voltando ao Normal, a campanha aparece como o jogador a deixou.
  await page.getByTestId("map-track-normal").click();
  await expect(panel).toHaveAttribute("data-difficulty", "normal");
  await expect(page.getByTestId("map-node-recife-1")).toHaveAttribute("data-state", "perfect");
  await expect(page.getByTestId("map-track-normal")).toHaveAttribute("data-cleared", "6");
  await expect(page.getByTestId("map-track-normal")).toContainText("18/48");
});

test("cada dificuldade mostra os próprios objetivos, no mapa e na preparação", async ({ page }) => {
  await seedCampaignCleared(page);
  await openGame(page, "screen=map");

  await page.getByTestId("map-track-normal").click();
  await page.getByTestId("map-region-prev").click();
  await page.getByTestId("map-node-recife-1").click();
  const objectives = page.getByTestId("map-objectives");
  await expect(objectives).toHaveAttribute("data-difficulty", "normal");
  await expect(objectives).toContainText("pelo menos 15 vidas");

  await page.getByTestId("map-track-dificil").click();
  await page.getByTestId("map-node-recife-1").click();
  await expect(objectives).toHaveAttribute("data-difficulty", "dificil");
  await expect(objectives).toContainText("Próprios do Difícil");
  await expect(objectives).toContainText("Não deixe nenhum inimigo passar");

  // A preparação entra na trilha que estava aberta no mapa, com a missão daquela dificuldade.
  await page.getByTestId("map-enter").click();
  // A história de abertura entra na frente na primeira vez; ela não é o assunto aqui.
  if (await page.getByTestId("story-skip").isVisible().catch(() => false)) await page.getByTestId("story-skip").click();
  await expect(page.getByTestId("prep-difficulty")).toHaveAttribute("data-value", "dificil");
  await expect(page.getByTestId("prep-objectives-track")).toContainText("Missão própria desta dificuldade");
  await expect(page.getByTestId("prep-objectives")).toContainText("Não deixe nenhum inimigo passar");
});

test("as conquistas secretas não aparecem antes de serem feitas", async ({ page }) => {
  await seedCampaignCleared(page);
  await openGame(page, "screen=map");
  await page.getByTestId("map-achievements").click();

  const panel = page.getByTestId("achievements-panel");
  await expect(panel).toBeVisible();
  // A campanha foi fechada perdendo 2 vidas por fase e com 4 espécies: duas das três não caíram e
  // não existem na tela — nem como "???".
  await expect(page.getByTestId("achievement-sopro-de-vida")).toHaveCount(0);
  await expect(page.getByTestId("achievement-dupla-do-recife")).toHaveCount(0);
  // A que depende só de nunca ter reiniciado já caiu — e aí ela aparece, e a conta anda.
  await expect(panel).toHaveAttribute("data-secrets", "1");
  await expect(page.getByTestId("achievements-secrets")).toContainText("1 de 3");
  await expect(page.getByTestId("achievement-sem-recomeco")).toBeVisible();
});
