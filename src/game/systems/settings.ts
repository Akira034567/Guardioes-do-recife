import { DEFAULT_SETTINGS, type PlayerSettings } from "../core/save/PlayerProgress";
import { getSaveManager } from "./ProgressStore";

export type { PlayerSettings };

/** Multiplicador das telas HTML para cada escala escolhida (item 36). */
export const UI_SCALE_FACTOR: Record<PlayerSettings["uiScale"], number> = { small: 0.85, normal: 1, large: 1.18 };

const listeners = new Set<(settings: PlayerSettings) => void>();

export function getSettings(): PlayerSettings {
  try {
    return getSaveManager().progress.settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Grava um ajuste e avisa quem depende dele (áudio, escala das telas, efeitos). */
export function updateSettings(patch: Partial<PlayerSettings>): PlayerSettings {
  getSaveManager().update((draft) => {
    draft.settings = { ...draft.settings, ...patch };
  });
  notifySettingsChanged();
  return getSettings();
}

/**
 * Reavisa os ouvintes com as configurações vigentes, sem mudar nada. É o que a troca de conta usa:
 * o save passou a ser outro, então escala de interface, contraste e volume podem ter mudado de valor
 * sem ninguém ter mexido num controle.
 */
export function notifySettingsChanged(): void {
  const settings = getSettings();
  listeners.forEach((listener) => listener(settings));
}

/** Ouve mudanças de configuração; devolve a função que cancela a inscrição. */
export function onSettingsChanged(listener: (settings: PlayerSettings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Volume efetivo de um efeito sonoro: mudo derruba tudo. */
export function sfxGain(settings: PlayerSettings = getSettings()): number {
  return settings.muted ? 0 : settings.masterVolume * settings.sfxVolume;
}
