import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Senha no banco: PBKDF2-SHA-256 com sal por usuário. Nunca a senha em si.
 *
 * O formato guarda o algoritmo e o custo dentro da própria string. Assim, no dia em que o custo
 * subir, as senhas antigas continuam abrindo: quem confere lê os parâmetros com que AQUELE hash
 * nasceu, em vez de assumir os de hoje.
 */

export const PBKDF2_ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

/** `pbkdf2$sha256$<iterações>$<sal>$<hash>` */
export function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2$${DIGEST}$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") return false;
  const [, digest, rawIterations, salt, hash] = parts;
  const iterations = Number.parseInt(rawIterations, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  let candidate: Buffer;
  try {
    candidate = pbkdf2Sync(password, salt, iterations, hash.length / 2, digest);
  } catch {
    return false;
  }
  const expected = Buffer.from(hash, "hex");
  // Comparação de tempo constante: o tempo da resposta não pode contar o quanto o chute chegou perto.
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Token de sessão ou de link de e-mail: 32 bytes de sorteio criptográfico, seguro para URL. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
