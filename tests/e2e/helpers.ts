import { expect, type Page } from "@playwright/test";
import { cardCenterX, HUD_LAYOUT } from "../../src/game/hudLayout";

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
// O mapa do Recife é HTML: fases, Encontros e navegação são alcançados por `data-testid`
// (`map-node-recife-1`, `map-collection`, …), não por coordenada no canvas.

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

declare global {
  interface Window {
    /** Posições dos controles do HUD publicadas por `UiRegistry` (somente leitura). */
    __grUi?: {
      bounds(name: string): { name: string; x: number; y: number; width: number; height: number; enabled: boolean } | null;
      names(): string[];
    };
  }
}
