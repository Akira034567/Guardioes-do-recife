/**
 * Senha de conta local. O jogo é uma página estática (GitHub Pages, sem servidor), então a senha
 * nunca viaja: ela só destranca, NESTE aparelho, qual save o jogo vai abrir.
 *
 * Mesmo assim a senha não é guardada em texto puro. Guardamos a derivação PBKDF2-SHA-256 com sal por
 * conta, que é o que a WebCrypto oferece sem dependência nenhuma. Em contexto inseguro (http puro,
 * `file://`) `crypto.subtle` some; aí cai para um esquema fraco, MARCADO como tal no registro, para
 * a conta continuar funcionando e a gente saber que aquele hash não vale como segredo.
 */

export type PasswordAlgorithm = "pbkdf2-sha256" | "weak-fallback-1";

export interface PasswordRecord {
  algo: PasswordAlgorithm;
  /** Hexadecimal; nunca reaproveitado entre contas. */
  salt: string;
  hash: string;
  iterations: number;
}

/** Custo do PBKDF2: alto o bastante para incomodar um chute, rápido o bastante para o login. */
export const PBKDF2_ITERATIONS = 150_000;

function subtle(): SubtleCrypto | null {
  try {
    return globalThis.crypto?.subtle ?? null;
  } catch {
    return null;
  }
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Contador do plano B: garante sais diferentes mesmo para duas contas criadas no mesmo milissegundo. */
let saltCounter = 0;

/**
 * Sal de 16 bytes. O sorteio vem da WebCrypto; sem ela, cai para relógio + contador.
 *
 * Nada de `Math.random` aqui: este arquivo mora em `core/`, onde o guarda de determinismo
 * (`tests/determinism.test.ts`) proíbe a função — e, para um sal, o que importa é NÃO SE REPETIR,
 * não ser imprevisível.
 */
export function randomSalt(): string {
  const bytes = new Uint8Array(16);
  try {
    globalThis.crypto?.getRandomValues?.(bytes);
    if (bytes.some((byte) => byte !== 0)) return toHex(bytes);
  } catch {
    // segue para o plano B
  }
  saltCounter += 1;
  const clock = typeof performance !== "undefined" ? Math.floor(performance.now() * 1000) : 0;
  return `${Date.now().toString(16)}${clock.toString(16)}${saltCounter.toString(16).padStart(4, "0")}`.padEnd(32, "0").slice(0, 32);
}

/**
 * Plano B sem WebCrypto. NÃO é criptografia: é um embaralhamento iterado que só evita a senha em
 * texto puro no `localStorage`. O registro fica marcado com `weak-fallback-1` justamente para ninguém
 * confundir os dois casos depois.
 */
function weakHash(password: string, salt: string, iterations: number): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  const material = `${salt}:${password}`;
  for (let round = 0; round < iterations; round += 1) {
    for (let index = 0; index < material.length; index += 1) {
      a ^= material.charCodeAt(index) + round;
      a = Math.imul(a, 0x01000193) >>> 0;
      b = (Math.imul(b ^ a, 0x85ebca6b) + index) >>> 0;
    }
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

async function derive(password: string, salt: string, iterations: number): Promise<{ algo: PasswordAlgorithm; hash: string }> {
  const crypto = subtle();
  if (!crypto) return { algo: "weak-fallback-1", hash: weakHash(password, salt, 2_000) };
  const encoder = new TextEncoder();
  const key = await crypto.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations }, key, 256);
  return { algo: "pbkdf2-sha256", hash: toHex(new Uint8Array(bits)) };
}

export async function hashPassword(password: string, salt = randomSalt(), iterations = PBKDF2_ITERATIONS): Promise<PasswordRecord> {
  const { algo, hash } = await derive(password, salt, iterations);
  return { algo, salt, hash, iterations };
}

/** Confere a senha contra o registro gravado, respeitando o algoritmo com que ELE foi criado. */
export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  const candidate =
    record.algo === "weak-fallback-1"
      ? weakHash(password, record.salt, 2_000)
      : (await derive(password, record.salt, record.iterations)).hash;
  return timingSafeEqual(candidate, record.hash);
}

/** Comparação de tempo constante: hábito barato, e aqui não custa nada. */
function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

export function isPasswordRecord(value: unknown): value is PasswordRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.algo === "pbkdf2-sha256" || record.algo === "weak-fallback-1") &&
    typeof record.salt === "string" &&
    typeof record.hash === "string" &&
    typeof record.iterations === "number"
  );
}
