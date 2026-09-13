/**
 * Junta o dano de vários acertos no mesmo inimigo antes de virar número na tela (item 33). Sem isso,
 * um Camarão evoluído escreveria dez "-3" por segundo em cima da mesma presa. Lógica pura: a cena só
 * pergunta o que já fechou a janela.
 */
export interface FloatingDamage {
  /** Inimigo que levou o dano (ou `kill:<id>` para a recompensa). */
  key: string;
  x: number;
  y: number;
  amount: number;
  /** Maior fatia de vida tirada de uma vez, 0..1: a tela usa para escolher o tamanho do número. */
  share: number;
  /** Cor temática do maior acerto da janela. */
  tone: DamageTone;
}

/** `weakPoint`: dano num ponto fraco de chefe — vale a própria cor, para o jogador notar. */
export type DamageTone = "hit" | "poison" | "area" | "reward" | "weakPoint";

export interface AggregatorOptions {
  /** Quanto tempo os acertos de um mesmo inimigo se somam antes de aparecer. */
  windowMs?: number;
  /** Teto de alvos acumulando ao mesmo tempo; o mais antigo sai primeiro. */
  maxPending?: number;
}

interface Pending extends FloatingDamage {
  dueAt: number;
}

export class DamageAggregator {
  private readonly windowMs: number;
  private readonly maxPending: number;
  private readonly pending = new Map<string, Pending>();

  constructor(options: AggregatorOptions = {}) {
    this.windowMs = options.windowMs ?? 260;
    this.maxPending = options.maxPending ?? 24;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /** Registra um acerto. `share` é a fração da vida máxima tirada neste golpe. */
  add(key: string, x: number, y: number, amount: number, now: number, tone: DamageTone = "hit", share = 0): void {
    if (amount <= 0) return;
    const current = this.pending.get(key);
    if (current) {
      current.amount += amount;
      current.x = x;
      current.y = y;
      // O tom e o tamanho acompanham o golpe mais forte da janela.
      if (share > current.share) {
        current.share = share;
        current.tone = tone;
      }
      return;
    }
    if (this.pending.size >= this.maxPending) {
      const oldest = this.pending.keys().next();
      if (!oldest.done) this.pending.delete(oldest.value);
    }
    this.pending.set(key, { key, x, y, amount, share, tone, dueAt: now + this.windowMs });
  }

  /** Entradas cuja janela fechou. Chame a cada quadro. */
  flush(now: number): FloatingDamage[] {
    if (this.pending.size === 0) return [];
    const ready: FloatingDamage[] = [];
    for (const [key, entry] of this.pending) {
      if (entry.dueAt > now) continue;
      ready.push({ key: entry.key, x: entry.x, y: entry.y, amount: entry.amount, share: entry.share, tone: entry.tone });
      this.pending.delete(key);
    }
    return ready;
  }

  /** Esvazia tudo de uma vez (morte do alvo, fim de partida). */
  take(key: string): FloatingDamage | null {
    const entry = this.pending.get(key);
    if (!entry) return null;
    this.pending.delete(key);
    return { key: entry.key, x: entry.x, y: entry.y, amount: entry.amount, share: entry.share, tone: entry.tone };
  }

  clear(): void {
    this.pending.clear();
  }
}
