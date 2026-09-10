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

export class AudioManager {
  private context: AudioContext | null = null;
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    if (!this.context) {
      const Context = window.AudioContext ?? window.webkitAudioContext;
      if (Context) this.context = new Context();
    }
    if (this.context?.state === "suspended") void this.context.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  play(cue: SoundCue): void {
    if (this.muted || !this.context || this.context.state !== "running") return;
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
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + definition.duration);
  }

  destroy(): void {
    if (this.context) void this.context.close();
    this.context = null;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
