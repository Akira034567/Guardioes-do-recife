import { expect, type Page } from "@playwright/test";
import { cardCenterX, HUD_LAYOUT, MENU_NAV } from "../../src/game/hudLayout";

/**
 * Coordenadas do HUD e utilitários compartilhados pelas sondas e2e. As posições vêm de
 * `src/game/hudLayout.ts`, a mesma fonte que a `UIScene` usa para desenhar.
 */
export const CARD_Y = HUD_LAYOUT.cardY;
export const CARD_X = {
  shrimp: cardCenterX(0),
  jellyfish: cardCenterX(1),
  pufferfish: cardCenterX(2),
  crab: cardCenterX(3),
  octopus: cardCenterX(4),
} as const;
export const OPTION_A = { x: HUD_LAYOUT.optionButtonXs[0], y: HUD_LAYOUT.optionButtonY } as const;
export const OPTION_B = { x: HUD_LAYOUT.optionButtonXs[1], y: HUD_LAYOUT.optionButtonY } as const;
export const SELL = { x: HUD_LAYOUT.sellButtonX, y: HUD_LAYOUT.optionButtonY } as const;
/** Botão "PRÓXIMA ONDA" (antigo PULAR). */
export const NEXT_WAVE = { x: HUD_LAYOUT.skipButtonX, y: HUD_LAYOUT.skipButtonY } as const;
export const RESTART = { x: HUD_LAYOUT.restartButtonX, y: HUD_LAYOUT.restartButtonY } as const;
export const MENU = { x: HUD_LAYOUT.menuButtonX, y: HUD_LAYOUT.menuButtonY } as const;
export const PAUSE = { x: HUD_LAYOUT.pauseButtonX, y: HUD_LAYOUT.topButtonY } as const;
export const SPEED_1X = { x: HUD_LAYOUT.speedButtonXs[0], y: HUD_LAYOUT.topButtonY } as const;
export const SPEED_2X = { x: HUD_LAYOUT.speedButtonXs[1], y: HUD_LAYOUT.topButtonY } as const;
export const RESULT_NEXT = { x: 640, y: 408 } as const;
/** Seis cartas de 192px com 16px de espaço, centralizadas (ver `LevelSelectScene`). */
export const MENU_CARD_BUTTON = (index: number) => ({ x: 120 + index * 208, y: 478 });
/** Barra de baixo do menu: álbum, bestiário e configurações. */
export const NAV = {
  collection: { x: MENU_NAV.collection, y: MENU_NAV.y },
  bestiary: { x: MENU_NAV.bestiary, y: MENU_NAV.y },
  stories: { x: MENU_NAV.stories, y: MENU_NAV.y },
  settings: { x: MENU_NAV.settings, y: MENU_NAV.y },
} as const;

export async function openGame(page: Page, query = "level=recife-1") {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`/?${query}`);
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  // O boot carrega toda a arte dos Guardiões; cliques antes da cena do jogo existir seriam perdidos.
  await expect(canvas).toHaveAttribute("data-screen", /game|menu/, { timeout: 15_000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);
  return { canvas, clickGame, pageErrors };
}
