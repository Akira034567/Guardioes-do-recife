import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/game/core/save/PlayerProgress";
import { getSettings, onSettingsChanged, sfxGain, UI_SCALE_FACTOR, updateSettings } from "../src/game/systems/settings";

/**
 * Configurações (item 36): ficam no save versionado e avisam quem depende delas (áudio, escala das
 * telas, efeitos). Sem `localStorage` o `SaveManager` cai para memória, que é o caso aqui.
 */
describe("player settings", () => {
  beforeEach(() => {
    updateSettings({ ...DEFAULT_SETTINGS });
  });

  it("starts from the defaults", () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("stores a change and keeps the rest untouched", () => {
    updateSettings({ masterVolume: 0.4 });
    expect(getSettings().masterVolume).toBeCloseTo(0.4);
    expect(getSettings().screenShake).toBe(DEFAULT_SETTINGS.screenShake);
  });

  it("clamps volumes to the 0..1 range on the way into the save", () => {
    updateSettings({ masterVolume: 4, sfxVolume: -2 });
    expect(getSettings().masterVolume).toBe(1);
    expect(getSettings().sfxVolume).toBe(0);
  });

  it("notifies listeners until they unsubscribe", () => {
    const seen: number[] = [];
    const stop = onSettingsChanged((settings) => seen.push(settings.sfxVolume));
    updateSettings({ sfxVolume: 0.5 });
    stop();
    updateSettings({ sfxVolume: 0.25 });
    expect(seen).toEqual([0.5]);
  });

  it("mutes every effect regardless of the volume sliders", () => {
    updateSettings({ masterVolume: 1, sfxVolume: 1, muted: true });
    expect(sfxGain()).toBe(0);
    updateSettings({ muted: false, masterVolume: 0.5, sfxVolume: 0.5 });
    expect(sfxGain()).toBeCloseTo(0.25);
  });

  it("offers one scale factor per interface size", () => {
    expect(UI_SCALE_FACTOR.small).toBeLessThan(UI_SCALE_FACTOR.normal);
    expect(UI_SCALE_FACTOR.large).toBeGreaterThan(UI_SCALE_FACTOR.normal);
  });
});
