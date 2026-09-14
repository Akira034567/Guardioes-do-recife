import { expect, test, type Page } from "@playwright/test";
import { HUD_LAYOUT } from "../../src/game/hudLayout";
import { openGame } from "./helpers";

const MUTE = { x: HUD_LAYOUT.muteButtonX, y: HUD_LAYOUT.topButtonY } as const;

/**
 * Escuta o que sai da placa de som.
 *
 * Nenhuma sonda de estado provaria o item pedido: `data-muted` diria "mudo" mesmo com a trilha
 * escapando por um caminho esquecido do grafo — que foi exatamente o defeito. Então o teste mede
 * AMPLITUDE. O truque é trocar o `destination` do contexto por um analisador que repassa tudo para o
 * destino de verdade: qualquer nó que o jogo ligue na saída passa a ser medido, hoje e depois.
 */
async function listenToOutput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, "destination");
    if (!descriptor?.get) return;
    const realDestination = descriptor.get;
    Object.defineProperty(BaseAudioContext.prototype, "destination", {
      configurable: true,
      get(this: BaseAudioContext & { __probe?: AnalyserNode }) {
        if (!this.__probe) {
          const analyser = this.createAnalyser();
          analyser.fftSize = 2048;
          analyser.connect(realDestination.call(this) as AudioNode);
          this.__probe = analyser;
          (window as unknown as { __audioProbe?: AnalyserNode }).__audioProbe = analyser;
        }
        return this.__probe;
      },
    });
  });
}

/** Volume médio do que está tocando agora. -1 quando o jogo nem chegou a abrir o áudio. */
async function loudness(page: Page): Promise<number> {
  return page.evaluate(() => {
    const analyser = (window as unknown as { __audioProbe?: AnalyserNode }).__audioProbe;
    if (!analyser) return -1;
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
  });
}

/** Maior volume observado numa janela de tempo: a trilha é lenta e tem compassos mais vazios. */
async function peakOver(page: Page, samples: number): Promise<number> {
  let peak = 0;
  for (let index = 0; index < samples; index += 1) {
    peak = Math.max(peak, await loudness(page));
    await page.waitForTimeout(120);
  }
  return peak;
}

test("o botão de som da fase silencia tudo de verdade e devolve os volumes intactos", async ({ page }) => {
  test.slow();
  await listenToOutput(page);
  const { canvas, clickGame, pageErrors } = await openGame(page, "level=recife-1");

  // O navegador só libera o áudio depois de um toque; é esse toque que também liga a trilha.
  await clickGame(640, 300);
  // A almofada abre em rampa longa de propósito, então o som demora alguns segundos para encorpar.
  await expect.poll(() => peakOver(page, 6), { timeout: 30_000, message: "a trilha tem de estar tocando" }).toBeGreaterThan(0.002);

  await clickGame(MUTE.x, MUTE.y);
  await expect(canvas).toHaveAttribute("data-muted", "true");
  // Silêncio de verdade, e que SE MANTÉM: o defeito antigo vazava justamente ao longo dos compassos.
  await page.waitForTimeout(600);
  expect(await peakOver(page, 12), "nada pode escapar com o som desligado").toBeLessThan(0.0005);

  // Desligar o som não é mexer no volume: as três barras das configurações ficam onde estavam.
  const settings = await page.evaluate(() => JSON.parse(window.localStorage.getItem("guardioes-do-recife.save") ?? "{}").settings);
  expect(settings.muted).toBe(true);
  expect(settings.masterVolume).toBe(1);
  expect(settings.musicVolume).toBe(0.8);
  expect(settings.sfxVolume).toBe(1);

  // E religar devolve o som sem o jogador ter de reconstruir volume nenhum.
  await clickGame(MUTE.x, MUTE.y);
  await expect(canvas).toHaveAttribute("data-muted", "false");
  await expect.poll(() => peakOver(page, 6), { timeout: 30_000, message: "o som volta ao religar" }).toBeGreaterThan(0.002);
  expect(pageErrors).toEqual([]);
});
