import { DEFAULT_SETTINGS, type PlayerSettings } from "../core/save/PlayerProgress";
import { MusicBed, type MusicMood } from "./audio/MusicBed";
import { getSettings, onSettingsChanged, updateSettings } from "./settings";

export type SoundCue = "shot" | "zap" | "pulse" | "impact" | "buy" | "upgrade" | "wave" | "warning";

const CUES: Record<SoundCue, { frequency: number; duration: number; type: OscillatorType; gain: number }> = {
  shot: { frequency: 180, duration: 0.08, type: "square", gain: 0.045 },
  zap: { frequency: 620, duration: 0.1, type: "sawtooth", gain: 0.035 },
  pulse: { frequency: 115, duration: 0.16, type: "sine", gain: 0.05 },
  impact: { frequency: 95, duration: 0.06, type: "triangle", gain: 0.035 },
  buy: { frequency: 520, duration: 0.09, type: "sine", gain: 0.04 },
  upgrade: { frequency: 760, duration: 0.18, type: "sine", gain: 0.045 },
  wave: { frequency: 330, duration: 0.22, type: "triangle", gain: 0.04 },
  warning: { frequency: 145, duration: 0.28, type: "square", gain: 0.04 },
};

/**
 * Áudio do jogo (item 42). Dois barramentos sob o volume geral: efeitos e música. Tudo é sintetizado
 * na hora — não há arquivo de áudio no projeto —, então trocar os osciladores por samples depois é só
 * mexer aqui. As regras da partida nunca chamam esta classe: quem toca é `systems/MatchEffects.ts`.
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private bed: MusicBed | null = null;
  private muted = DEFAULT_SETTINGS.muted;
  private settings: PlayerSettings = { ...DEFAULT_SETTINGS };
  private readonly unsubscribe: () => void;

  constructor() {
    this.settings = getSettings();
    this.muted = this.settings.muted;
    this.unsubscribe = onSettingsChanged((settings) => this.applySettings(settings));
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Volume efetivo de cada barramento, já com o mudo aplicado. */
  private get levels(): { sfx: number; music: number } {
    if (this.muted) return { sfx: 0, music: 0 };
    return { sfx: this.settings.masterVolume * this.settings.sfxVolume, music: this.settings.masterVolume * this.settings.musicVolume };
  }

  private applySettings(settings: PlayerSettings): void {
    this.settings = settings;
    this.muted = settings.muted;
    const { sfx, music } = this.levels;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.musicGain) this.musicGain.gain.value = 1;
    this.bed?.setLevel(music);
  }

  /** O navegador só libera áudio depois de um toque; é aqui que o grafo nasce. */
  unlock(): void {
    if (!this.context) {
      const Context = window.AudioContext ?? window.webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.sfxGain = this.context.createGain();
      this.sfxGain.connect(this.masterGain);
      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.masterGain);
      this.applySettings(this.settings);
    }
    if (this.context.state === "suspended") void this.context.resume();
  }

  /** Liga a trilha ambiente. Sem toque anterior do jogador, não faz nada. */
  startMusic(mood: MusicMood = "calm"): void {
    if (!this.context || !this.musicGain || this.levels.music <= 0) return;
    if (!this.bed) this.bed = new MusicBed(this.context, this.musicGain);
    this.bed.start(mood);
    this.bed.setLevel(this.levels.music);
  }

  /** Troca o clima da trilha (chefe em campo, vitória). */
  setMusicMood(mood: MusicMood): void {
    this.bed?.setMood(mood);
  }

  stopMusic(): void {
    this.bed?.stop();
    this.bed = null;
  }

  /** Atalho do HUD: silencia e grava a escolha no save. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    updateSettings({ muted: this.muted });
    return this.muted;
  }

  play(cue: SoundCue): void {
    const level = this.levels.sfx;
    if (level <= 0 || !this.context || !this.sfxGain || this.context.state !== "running") return;
    const definition = CUES[cue];
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = definition.type;
    oscillator.frequency.setValueAtTime(definition.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, definition.frequency * 0.72), now + definition.duration);
    gain.gain.setValueAtTime(definition.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + definition.duration);
    oscillator.connect(gain);
    gain.connect(this.sfxGain);
    oscillator.start(now);
    oscillator.stop(now + definition.duration);
  }

  destroy(): void {
    this.unsubscribe();
    this.stopMusic();
    if (this.context) void this.context.close();
    this.context = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
