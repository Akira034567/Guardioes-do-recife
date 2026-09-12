export type MusicMood = "calm" | "tense" | "victory";

/** Notas de cada clima, em hertz. Acordes baixos e abertos: é fundo, não melodia. */
const CHORDS: Record<MusicMood, number[]> = {
  calm: [98.0, 146.83, 220.0],
  tense: [82.41, 110.0, 164.81],
  victory: [130.81, 196.0, 261.63],
};

/**
 * Trilha ambiente sintetizada (item 42). Sem arquivo de áudio: três osciladores em acorde, com um
 * respiro lento no volume. Troca de clima faz um deslize entre os acordes em vez de cortar.
 */
export class MusicBed {
  private readonly voices: Array<{ oscillator: OscillatorNode; gain: GainNode }> = [];
  private readonly output: GainNode;
  private breath: OscillatorNode | null = null;
  private mood: MusicMood = "calm";
  private started = false;

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
  ) {
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.connect(destination);
  }

  get currentMood(): MusicMood {
    return this.mood;
  }

  start(mood: MusicMood = "calm"): void {
    if (this.started) {
      this.setMood(mood);
      return;
    }
    this.started = true;
    this.mood = mood;
    const now = this.context.currentTime;
    CHORDS[mood].forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now);
      // Leve desafinação entre as vozes: sem isso o acorde soa eletrônico demais.
      oscillator.detune.setValueAtTime(index * 4 - 4, now);
      gain.gain.setValueAtTime(index === 0 ? 0.5 : 0.22, now);
      oscillator.connect(gain);
      gain.connect(this.output);
      oscillator.start(now);
      this.voices.push({ oscillator, gain });
    });

    // Respiro: um LFO lento abrindo e fechando o volume do conjunto.
    const breath = this.context.createOscillator();
    const depth = this.context.createGain();
    breath.frequency.setValueAtTime(0.06, now);
    depth.gain.setValueAtTime(0.25, now);
    breath.connect(depth);
    depth.connect(this.output.gain);
    breath.start(now);
    this.breath = breath;
    this.output.gain.setValueAtTime(0, now);
    this.output.gain.linearRampToValueAtTime(0.6, now + 4);
  }

  setMood(mood: MusicMood): void {
    if (!this.started || mood === this.mood) return;
    this.mood = mood;
    const now = this.context.currentTime;
    CHORDS[mood].forEach((frequency, index) => {
      const voice = this.voices[index];
      if (!voice) return;
      voice.oscillator.frequency.cancelScheduledValues(now);
      voice.oscillator.frequency.setValueAtTime(voice.oscillator.frequency.value, now);
      voice.oscillator.frequency.linearRampToValueAtTime(frequency, now + 1.6);
    });
  }

  /** Volume do barramento de música (0..1), já com o mudo aplicado. */
  setLevel(level: number): void {
    if (!this.started) return;
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(this.output.gain.value, now);
    this.output.gain.linearRampToValueAtTime(Math.max(0.0001, level * 0.6), now + 0.4);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(this.output.gain.value, now);
    this.output.gain.linearRampToValueAtTime(0.0001, now + 0.6);
    this.voices.forEach(({ oscillator }) => oscillator.stop(now + 0.7));
    this.breath?.stop(now + 0.7);
    this.voices.length = 0;
    this.breath = null;
  }
}
