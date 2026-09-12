/**
 * Gerador pseudoaleatório semeado (mulberry32). Toda aleatoriedade da partida deve passar por aqui
 * para que o mesmo seed reproduza a mesma partida (balanceamento headless, replays, coop futuro).
 * `Math.random` é proibido em `src/game/core` (ver `tests/determinism.test.ts`).
 */
export interface Rng {
  /** Próximo número em [0, 1). */
  next(): number;
  /** Inteiro em [0, max). */
  int(max: number): number;
  /** Elemento uniforme de uma lista não vazia. */
  pick<T>(items: readonly T[]): T;
}

export function hashSeed(...parts: Array<string | number>): number {
  let state = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let index = 0; index < text.length; index += 1) {
      state ^= text.charCodeAt(index);
      state = Math.imul(state, 16777619) >>> 0;
    }
    state ^= 0x9e3779b9;
  }
  return state >>> 0;
}

export function createRng(seed: number | string): Rng {
  let state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (max) => Math.floor(next() * Math.max(0, max)),
    pick: (items) => {
      if (items.length === 0) throw new Error("Rng.pick: lista vazia");
      return items[Math.floor(next() * items.length)];
    },
  };
}
