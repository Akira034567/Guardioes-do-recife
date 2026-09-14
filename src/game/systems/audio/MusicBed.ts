export type MusicMood = "calm" | "tense" | "victory";

/**
 * Trilha submarina do jogo (item 42).
 *
 * O que havia aqui antes era um DRONE: três osciladores presos num acorde e um LFO abrindo e
 * fechando o volume. Som de fundo contínuo cansa em dois minutos porque nada acontece — o ouvido
 * para de ter o que acompanhar e a nota vira zumbido. No lugar entrou uma peça de verdade:
 * progressão harmônica, baixo, almofada e uma melodia esparsa em pentatônica, agendados compasso a
 * compasso.
 *
 * ORIGEM E LICENÇA: a música é composta aqui, em código, nota por nota — não há sample, arquivo nem
 * trecho de terceiro no projeto. É obra original e segue a licença do próprio jogo, sem atribuição a
 * ninguém de fora. Era esse o pedido de "licença livre": nada de MP3 baixado de origem duvidosa
 * dentro de `public/`.
 *
 * Por que não cansa: o laço harmônico tem oito compassos (não quatro), a melodia é esparsa e sorteada
 * de uma pentatônica — vários compassos ficam em silêncio de propósito — e cada camada respira num
 * tempo diferente. Fica sempre reconhecível e nunca exatamente igual.
 */

/** Frequência de uma nota MIDI. 69 = lá central (440 Hz). Escrever em MIDI deixa a harmonia legível. */
const pitch = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

interface Chord {
  /** Nota do baixo, em MIDI. */
  bass: number;
  /** Vozes da almofada, em MIDI. */
  notes: number[];
}

interface Score {
  bpm: number;
  /** Corte do filtro passa-baixas, em hertz: é ele que põe a peça debaixo da água. */
  cutoff: number;
  /** Chance de cada colcheia do compasso receber uma nota da melodia. */
  leadDensity: number;
  /** Notas de onde a melodia sorteia, em MIDI. */
  scale: number[];
  progression: Chord[];
}

/**
 * Uma partitura por clima. `calm` é a da partida: lá menor com sétimas abertas, oito compassos, 58
 * BPM. `tense` fecha o filtro, encurta o laço e quase silencia a melodia. `victory` vira maior.
 */
const SCORES: Record<MusicMood, Score> = {
  calm: {
    bpm: 58,
    cutoff: 1700,
    leadDensity: 0.22,
    scale: [69, 71, 72, 74, 76, 79, 81],
    progression: [
      { bass: 45, notes: [57, 60, 64, 71] }, // Am9
      { bass: 41, notes: [53, 57, 60, 64] }, // Fmaj7
      { bass: 48, notes: [55, 60, 64, 71] }, // Cmaj7
      { bass: 43, notes: [55, 59, 62, 64] }, // G6
      { bass: 45, notes: [57, 60, 64, 71] }, // Am9
      { bass: 38, notes: [57, 62, 65, 69] }, // Dm7
      { bass: 41, notes: [53, 57, 60, 64] }, // Fmaj7
      { bass: 40, notes: [55, 59, 62, 67] }, // Em7 — devolve para o lá menor
    ],
  },
  tense: {
    bpm: 72,
    cutoff: 1150,
    leadDensity: 0.1,
    scale: [69, 72, 74, 76, 79],
    progression: [
      { bass: 45, notes: [57, 60, 64] }, // Am
      { bass: 41, notes: [53, 57, 60] }, // F
      { bass: 38, notes: [57, 62, 65] }, // Dm
      { bass: 40, notes: [56, 59, 62] }, // E7
    ],
  },
  victory: {
    bpm: 76,
    cutoff: 2600,
    leadDensity: 0.34,
    scale: [72, 74, 76, 79, 81, 84],
    progression: [
      { bass: 48, notes: [60, 64, 67, 71] }, // Cmaj7
      { bass: 43, notes: [59, 62, 64, 67] }, // G6
      { bass: 41, notes: [57, 60, 64, 65] }, // Fmaj7
      { bass: 48, notes: [60, 64, 67, 72] }, // Cmaj7
    ],
  },
};

/** De quanto em quanto tempo o agendador acorda, em milissegundos. */
const PUMP_MS = 180;
/** Quanto de música fica agendado à frente do relógio, em segundos. Cobre a estrangulada da aba oculta. */
const HORIZON_S = 1.8;

/** Gerador simples e determinístico: a melodia varia dentro da peça, não a cada sessão. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export class MusicBed {
  /** Volume da trilha. Só o nível entra aqui — nada de LFO somado, senão o mudo vaza. */
  private readonly output: GainNode;
  /** Onde todas as vozes entram, já a caminho do passa-baixas. */
  private readonly bus: GainNode;
  private readonly lowpass: BiquadFilterNode;
  /** Eco curto realimentado: dá o tamanho da caverna sem carregar um impulso de reverb. */
  private readonly echoSend: GainNode;
  private mood: MusicMood = "calm";
  private pendingMood: MusicMood | null = null;
  private started = false;
  private pumpId: number | null = null;
  /** Instante (no relógio do contexto) em que o próximo compasso começa. */
  private nextBarAt = 0;
  private bar = 0;
  private readonly random = seededRandom(0x5eaf15);

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
  ) {
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.connect(destination);

    this.lowpass = context.createBiquadFilter();
    this.lowpass.type = "lowpass";
    this.lowpass.frequency.value = SCORES.calm.cutoff;
    this.lowpass.Q.value = 0.7;
    this.lowpass.connect(this.output);

    this.bus = context.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.lowpass);

    const delay = context.createDelay(1);
    delay.delayTime.value = 0.38;
    const feedback = context.createGain();
    feedback.gain.value = 0.34;
    this.echoSend = context.createGain();
    this.echoSend.gain.value = 1;
    this.echoSend.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(this.bus);
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
    this.bar = 0;
    this.lowpass.frequency.value = SCORES[mood].cutoff;
    this.nextBarAt = this.context.currentTime + 0.12;
    this.pump();
    this.pumpId = window.setInterval(() => this.pump(), PUMP_MS);
  }

  /** A troca de clima espera a barra de compasso: cortar no meio de um acorde soa como defeito. */
  setMood(mood: MusicMood): void {
    if (!this.started || mood === this.mood) return;
    this.pendingMood = mood;
  }

  /**
   * Volume da trilha (0..1), já com o mudo aplicado pelo `AudioManager`. Zero aqui é silêncio de
   * verdade: o nó de saída não tem nenhuma modulação somada por cima.
   */
  setLevel(level: number): void {
    if (!this.started) return;
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(this.output.gain.value, now);
    this.output.gain.linearRampToValueAtTime(Math.max(0, level) * 0.5, now + 0.4);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.pumpId !== null) window.clearInterval(this.pumpId);
    this.pumpId = null;
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(this.output.gain.value, now);
    this.output.gain.linearRampToValueAtTime(0, now + 0.8);
  }

  /** Enche a janela de agendamento com os compassos que ainda cabem nela. */
  private pump(): void {
    if (!this.started) return;
    const horizon = this.context.currentTime + HORIZON_S;
    // Teto de segurança: se a aba dormiu, reancora em vez de agendar cem compassos de uma vez.
    if (this.nextBarAt < this.context.currentTime - 1) this.nextBarAt = this.context.currentTime + 0.05;
    let guard = 0;
    while (this.nextBarAt < horizon && guard < 8) {
      guard += 1;
      if (this.pendingMood) {
        this.mood = this.pendingMood;
        this.pendingMood = null;
        this.bar = 0;
        const now = this.context.currentTime;
        this.lowpass.frequency.cancelScheduledValues(now);
        this.lowpass.frequency.setValueAtTime(this.lowpass.frequency.value, now);
        this.lowpass.frequency.linearRampToValueAtTime(SCORES[this.mood].cutoff, this.nextBarAt + 1.2);
      }
      const score = SCORES[this.mood];
      const barSeconds = (60 / score.bpm) * 4;
      this.scheduleBar(score, this.nextBarAt, barSeconds);
      this.nextBarAt += barSeconds;
      this.bar += 1;
    }
  }

  private scheduleBar(score: Score, at: number, barSeconds: number): void {
    const chord = score.progression[this.bar % score.progression.length];

    // Almofada: ataque longo e cauda que entra no compasso seguinte, então os acordes se cruzam em
    // vez de trocar em corte seco.
    chord.notes.forEach((midi, index) => {
      this.voice({
        at,
        frequency: pitch(midi),
        type: index === 0 ? "sine" : "triangle",
        peak: 0.052,
        attack: 1.5,
        hold: barSeconds * 0.55,
        release: barSeconds * 0.75,
        detune: index * 3 - 4,
        send: 0.25,
      });
    });

    // Baixo: uma nota por compasso, curta o bastante para o compasso respirar.
    this.voice({
      at,
      frequency: pitch(chord.bass),
      type: "sine",
      peak: 0.12,
      attack: 0.08,
      hold: barSeconds * 0.35,
      release: barSeconds * 0.4,
      send: 0,
    });

    // Melodia: colcheias sorteadas da pentatônica. Compasso sem sorteio nenhum é silêncio de
    // propósito — é o silêncio que faz a frase seguinte valer alguma coisa.
    const eighth = barSeconds / 8;
    for (let step = 0; step < 8; step += 1) {
      // O tempo forte e o contratempo do terceiro tempo ganham peso: a frase cai no lugar.
      const weight = step === 0 || step === 5 ? 2 : step % 2 === 0 ? 1 : 0.45;
      if (this.random() > score.leadDensity * weight) continue;
      const midi = score.scale[Math.floor(this.random() * score.scale.length)];
      this.voice({
        at: at + step * eighth,
        frequency: pitch(midi),
        type: "triangle",
        peak: 0.058,
        attack: 0.012,
        hold: eighth * 0.6,
        release: 1.4,
        send: 0.8,
      });
    }
  }

  /** Uma nota: oscilador com envelope, parte do sinal indo para o eco. */
  private voice(options: {
    at: number;
    frequency: number;
    type: OscillatorType;
    peak: number;
    attack: number;
    hold: number;
    release: number;
    detune?: number;
    send: number;
  }): void {
    const { at, frequency, type, peak, attack, hold, release, detune = 0, send } = options;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.detune.setValueAtTime(detune, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    gain.gain.setValueAtTime(peak, at + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
    oscillator.connect(gain);
    gain.connect(this.bus);
    if (send > 0) {
      const tap = this.context.createGain();
      tap.gain.value = send;
      gain.connect(tap);
      tap.connect(this.echoSend);
    }
    oscillator.start(at);
    oscillator.stop(at + attack + hold + release + 0.05);
  }
}
