import type { DatabaseSync } from "node:sqlite";
import {
  cleanName,
  normalizeEmail,
  normalizeName,
  validateEmail,
  validateName,
  validatePassword,
} from "../src/game/core/account/rules.ts";
import { passwordResetEmail, verificationEmail } from "./emails.ts";
import type { Mailer } from "./mailer.ts";
import { hashPassword, randomToken, verifyPassword } from "./passwords.ts";
import type { UserRow } from "./db.ts";

/**
 * As regras de conta, em cima do banco.
 *
 * Todo o serviço é síncrono (o `node:sqlite` é síncrono) menos o envio de e-mail. E toda resposta de
 * erro carrega o status HTTP junto: a camada HTTP não precisa adivinhar o que cada falha significa.
 */

export const SESSION_TTL_HOURS = 24 * 60;
export const VERIFY_TTL_HOURS = 24;
export const RESET_TTL_HOURS = 2;

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  verified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface SaveRecord {
  document: string;
  updatedAt: string;
}

export type Failure = { ok: false; status: number; reason: string; message: string };
/** `Result` sem argumento = sucesso sem carga (`{ ok: true }`). */
export type Result<T = unknown> = ({ ok: true } & T) | Failure;

function fail(status: number, reason: string, message: string): Failure {
  return { ok: false, status, reason, message };
}

export interface AccountServiceOptions {
  /** Endereço público do servidor; é o que vai dentro dos links do e-mail. */
  appUrl?: string;
  now?: () => Date;
  /** Injetado nos testes para links previsíveis. */
  token?: () => string;
}

/*
 * Os campos vêm declarados um a um, e não como parâmetros do construtor: o servidor roda direto no
 * Node, que só REMOVE os tipos do TypeScript (`--experimental-strip-types`) em vez de compilar —
 * e "propriedade de parâmetro" é açúcar que precisaria de compilação de verdade.
 */
export class AccountService {
  private readonly db: DatabaseSync;
  private readonly mailer: Mailer;
  private readonly now: () => Date;
  private readonly newToken: () => string;
  readonly appUrl: string;

  constructor(db: DatabaseSync, mailer: Mailer, options: AccountServiceOptions = {}) {
    this.db = db;
    this.mailer = mailer;
    this.now = options.now ?? (() => new Date());
    this.newToken = options.token ?? randomToken;
    this.appUrl = (options.appUrl ?? process.env.APP_URL ?? "http://localhost:4000").replace(/\/+$/, "");
    this.purgeExpired();
  }

  // ------------------------------------------------------------------ cadastro e confirmação

  /**
   * Cria a conta e manda o e-mail de confirmação. NÃO devolve sessão: entrar só depois de confirmar
   * o endereço — é isso que separa "escreveu um e-mail" de "tem esse e-mail".
   */
  async register(input: { email: string; name: string; password: string }): Promise<Result<{ user: PublicUser }>> {
    const problem = validateEmail(input.email) ?? validateName(input.name) ?? validatePassword(input.password);
    if (problem) return fail(400, "invalid", problem);

    const stamp = this.now().toISOString();
    const email = normalizeEmail(input.email);
    const name = cleanName(input.name);
    try {
      const result = this.db
        .prepare(
          `INSERT INTO users (email, email_key, name, name_key, password, verified_at, created_at, last_login_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)`,
        )
        .run(email, email, name, normalizeName(name), hashPassword(input.password), stamp);
      const user = this.userById(Number(result.lastInsertRowid));
      if (!user) return fail(500, "storage", "Não consegui gravar a conta. Tente de novo.");
      await this.sendVerification(user);
      return { ok: true, user: toPublicUser(user) };
    } catch (error) {
      // A unicidade é do banco: quem barra o nome repetido é o índice, não uma consulta antes.
      const message = error instanceof Error ? error.message : "";
      if (message.includes("users.email_key")) {
        return fail(409, "email-taken", "Já existe uma conta com esse e-mail. Entre, ou use “esqueci minha senha”.");
      }
      if (message.includes("users.name_key")) {
        return fail(409, "name-taken", "Esse nome já está em uso no Recife. Escolha outro.");
      }
      throw error;
    }
  }

  /** Confirma o e-mail. O link é de uso único e tem prazo. */
  verify(token: string): Result<{ user: PublicUser }> {
    const row = this.consumeEmailToken(token, "verify");
    if (!row.ok) return row;
    const user = row.user;
    if (user.verified_at === null) {
      this.db.prepare("UPDATE users SET verified_at = ? WHERE id = ?").run(this.now().toISOString(), user.id);
    }
    const fresh = this.userById(user.id);
    return { ok: true, user: toPublicUser(fresh ?? user) };
  }

  /**
   * Reenvia a confirmação. Responde igual exista ou não a conta: uma resposta diferente para cada
   * caso viraria um jeito de descobrir quem tem cadastro aqui.
   */
  async resendVerification(email: string): Promise<void> {
    const user = this.userByEmail(email);
    if (!user || user.verified_at !== null) return;
    await this.sendVerification(user);
  }

  // --------------------------------------------------------------------------- entrar e sair

  async login(email: string, password: string): Promise<Result<{ user: PublicUser; token: string; save: SaveRecord | null }>> {
    const user = this.userByEmail(email);
    // Mesma mensagem para e-mail inexistente e senha errada: não entregamos quem tem conta aqui.
    const denied = fail(401, "bad-credentials", "E-mail ou senha não conferem.");
    if (!user || !verifyPassword(password, user.password)) return denied;
    if (user.verified_at === null) {
      return fail(403, "unverified", "Confirme seu e-mail antes de entrar. Procure a mensagem que enviamos — dá para reenviar aqui.");
    }
    const stamp = this.now().toISOString();
    this.db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(stamp, user.id);
    const token = this.newToken();
    this.db
      .prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(token, user.id, stamp, this.hoursFromNow(SESSION_TTL_HOURS));
    const fresh = this.userById(user.id) ?? user;
    return { ok: true, user: toPublicUser(fresh), token, save: this.getSave(user.id) };
  }

  logout(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  /** Quem é o dono deste token, se ele ainda vale. */
  authenticate(token: string | null): UserRow | null {
    if (!token) return null;
    const row = this.db
      .prepare(
        `SELECT users.* FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token = ? AND sessions.expires_at > ?`,
      )
      .get(token, this.now().toISOString()) as unknown as UserRow | undefined;
    return row ?? null;
  }

  // ---------------------------------------------------------------------------------- senha

  changePassword(userId: number, current: string, next: string): Result {
    const user = this.userById(userId);
    if (!user) return fail(404, "not-found", "Conta não encontrada.");
    if (!verifyPassword(current, user.password)) return fail(401, "bad-credentials", "A senha atual não confere.");
    const problem = validatePassword(next);
    if (problem) return fail(400, "invalid", problem);
    this.db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword(next), userId);
    return { ok: true };
  }

  /** Manda o link de troca de senha. Silencioso quando o e-mail não existe, pelo mesmo motivo. */
  async forgotPassword(email: string): Promise<void> {
    const user = this.userByEmail(email);
    if (!user) return;
    const token = this.newToken();
    this.db
      .prepare("INSERT INTO email_tokens (token, user_id, purpose, created_at, expires_at, used_at) VALUES (?, ?, 'reset', ?, ?, NULL)")
      .run(token, user.id, this.now().toISOString(), this.hoursFromNow(RESET_TTL_HOURS));
    const message = passwordResetEmail(user.name, `${this.appUrl}/api/password/reset?token=${token}`, RESET_TTL_HOURS);
    await this.mailer.send({ ...message, to: user.email });
  }

  /**
   * Troca a senha pelo link do e-mail. Derruba TODAS as sessões: se o pedido veio de alguém que
   * perdeu o acesso à conta, quem estava dentro sai junto.
   */
  resetPassword(token: string, password: string): Result<{ user: PublicUser }> {
    const problem = validatePassword(password);
    if (problem) return fail(400, "invalid", problem);
    const row = this.consumeEmailToken(token, "reset");
    if (!row.ok) return row;
    const user = row.user;
    this.db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword(password), user.id);
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    // Quem recuperou a senha pelo e-mail provou que o endereço é dele; a conta já pode ser usada.
    if (user.verified_at === null) {
      this.db.prepare("UPDATE users SET verified_at = ? WHERE id = ?").run(this.now().toISOString(), user.id);
    }
    return { ok: true, user: toPublicUser(this.userById(user.id) ?? user) };
  }

  // ----------------------------------------------------------------------------------- conta

  deleteAccount(userId: number, password: string): Result {
    const user = this.userById(userId);
    if (!user) return fail(404, "not-found", "Conta não encontrada.");
    if (!verifyPassword(password, user.password)) return fail(401, "bad-credentials", "Senha incorreta.");
    // Sessões, links e o save caem junto pelo ON DELETE CASCADE.
    this.db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    return { ok: true };
  }

  // ------------------------------------------------------------------------------------ save

  getSave(userId: number): SaveRecord | null {
    const row = this.db.prepare("SELECT document, updated_at FROM saves WHERE user_id = ?").get(userId) as unknown as
      | { document: string; updated_at: string }
      | undefined;
    return row ? { document: row.document, updatedAt: row.updated_at } : null;
  }

  putSave(userId: number, document: string): SaveRecord {
    const updatedAt = this.now().toISOString();
    this.db
      .prepare(
        `INSERT INTO saves (user_id, document, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at`,
      )
      .run(userId, document, updatedAt);
    return { document, updatedAt };
  }

  // -------------------------------------------------------------------------------- listagem

  /** Para a ferramenta de terminal (`npm run users`): o que existe no banco, sem senha nenhuma. */
  listUsers(): Array<PublicUser & { hasSave: boolean; saveUpdatedAt: string | null }> {
    const rows = this.db
      .prepare(
        `SELECT users.*, saves.updated_at AS save_updated_at
         FROM users LEFT JOIN saves ON saves.user_id = users.id
         ORDER BY users.id`,
      )
      .all() as unknown as Array<UserRow & { save_updated_at: string | null }>;
    return rows.map((row) => ({
      ...toPublicUser(row),
      hasSave: row.save_updated_at !== null,
      saveUpdatedAt: row.save_updated_at,
    }));
  }

  // ---------------------------------------------------------------------------------- interno

  userById(id: number): UserRow | null {
    return (this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as UserRow | undefined) ?? null;
  }

  userByEmail(email: string): UserRow | null {
    return (this.db.prepare("SELECT * FROM users WHERE email_key = ?").get(normalizeEmail(email)) as unknown as UserRow | undefined) ?? null;
  }

  private async sendVerification(user: UserRow): Promise<void> {
    // Um link novo apaga os anteriores: o e-mail que vale é sempre o último que chegou.
    this.db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'verify'").run(user.id);
    const token = this.newToken();
    this.db
      .prepare("INSERT INTO email_tokens (token, user_id, purpose, created_at, expires_at, used_at) VALUES (?, ?, 'verify', ?, ?, NULL)")
      .run(token, user.id, this.now().toISOString(), this.hoursFromNow(VERIFY_TTL_HOURS));
    const message = verificationEmail(user.name, `${this.appUrl}/api/verify?token=${token}`, VERIFY_TTL_HOURS);
    await this.mailer.send({ ...message, to: user.email });
  }

  /** Gasta um link de e-mail: confere prazo e uso, e marca como usado na mesma hora. */
  private consumeEmailToken(token: string, purpose: "verify" | "reset"): ({ ok: true; user: UserRow }) | Failure {
    const row = this.db.prepare("SELECT * FROM email_tokens WHERE token = ? AND purpose = ?").get(token, purpose) as unknown as
      | { token: string; user_id: number; expires_at: string; used_at: string | null }
      | undefined;
    const expired = fail(410, "token-invalid", "Este link não vale mais. Peça outro e use o mais recente.");
    if (!row || row.used_at !== null || row.expires_at <= this.now().toISOString()) return expired;
    const user = this.userById(row.user_id);
    if (!user) return expired;
    this.db.prepare("UPDATE email_tokens SET used_at = ? WHERE token = ?").run(this.now().toISOString(), token);
    return { ok: true, user };
  }

  private hoursFromNow(hours: number): string {
    return new Date(this.now().getTime() + hours * 3600_000).toISOString();
  }

  /** Limpeza de rotina: sessão vencida e link vencido não servem para nada. */
  purgeExpired(): void {
    const stamp = this.now().toISOString();
    this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(stamp);
    this.db.prepare("DELETE FROM email_tokens WHERE expires_at <= ?").run(stamp);
  }
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    verified: row.verified_at !== null,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}
