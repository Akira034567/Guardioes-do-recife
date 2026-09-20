import type { SaveStorage } from "../save/SaveManager";
import { SupabaseClient, SupabaseError, type SupabaseConfig, type SupabaseSession } from "./supabase";
import { normalizeAccountName, validateAccountName, validatePassword } from "./AccountStore";

/**
 * CONTA NA NUVEM — a conta de verdade.
 *
 * A `AccountStore` ao lado continua existindo e continua sendo o caminho de quem joga sem
 * cadastro: ela separa saves NESTE aparelho e move progresso por código colado. O que ela nunca
 * pôde fazer é o que o jogador pediu — entrar no celular e achar o Recife como ele ficou no
 * computador. Isso exige um servidor, e este módulo é a ponte para ele.
 *
 * Divisão de trabalho com o Supabase:
 *   * e-mail, hash da senha (bcrypt) e o e-mail de "esqueci a senha" são do Auth dele;
 *   * o nome de usuário único e o documento de progresso são de duas tabelas nossas, com RLS;
 *   * o jogo só sabe empurrar e puxar um JSON.
 *
 * Sem `VITE_SUPABASE_URL` configurado, `isConfigured` é falso e a tela de conta some com a parte
 * da nuvem: o jogo continua inteiro, offline, como sempre foi.
 */

export const CLOUD_SESSION_KEY = "guardioes-do-recife.cloud";
/** Prefixo do save local espelhado de uma conta da nuvem. */
export const CLOUD_SAVE_PREFIX = "guardioes-do-recife.save:cloud:";
/** Renova o token quando falta menos que isto para expirar. */
const REFRESH_MARGIN_MS = 60_000;

export interface CloudProfile {
  userId: string;
  email: string;
  username: string;
  emailConfirmed: boolean;
}

export type CloudResult<T = void> = { ok: true; value: T } | { ok: false; message: string };

export interface CloudSyncState {
  /** Última sincronização bem-sucedida, ou `null` se ainda não houve nenhuma nesta sessão. */
  lastSyncAt: string | null;
  pending: boolean;
  error: string | null;
}

interface StoredSession {
  session: SupabaseSession;
  username: string;
  emailConfirmed: boolean;
}

const ok = <T>(value: T): CloudResult<T> => ({ ok: true, value });
const fail = (message: string): CloudResult<never> => ({ ok: false, message });

function messageOf(error: unknown): string {
  if (error instanceof SupabaseError) return error.message;
  if (error instanceof TypeError) return "Não deu para falar com o servidor. Confira a conexão e tente de novo.";
  return error instanceof Error ? error.message : "Algo deu errado. Tente de novo.";
}

/** Formato mínimo de e-mail: quem valida de verdade é o servidor, ao mandar a confirmação. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  return EMAIL_SHAPE.test(email.trim()) ? null : "Escreva um e-mail válido — é por ele que a troca de senha chega.";
}

/** O servidor exige 6; o jogo pedia 4. Vale o maior dos dois, senão o cadastro falha só no fim. */
export const CLOUD_PASSWORD_MIN = 6;

export function validateCloudPassword(password: string): string | null {
  const local = validatePassword(password);
  if (local) return local;
  return password.length < CLOUD_PASSWORD_MIN ? `A senha da conta na nuvem precisa de pelo menos ${CLOUD_PASSWORD_MIN} caracteres.` : null;
}

export class CloudAccount {
  private readonly client: SupabaseClient | null;
  private stored: StoredSession | null = null;
  private readonly listeners = new Set<(account: CloudAccount) => void>();
  private syncState: CloudSyncState = { lastSyncAt: null, pending: false, error: null };
  /** Empurrão em voo, para não atropelar um com o outro. */
  private inFlight: Promise<void> | null = null;

  constructor(
    config: SupabaseConfig | null,
    private readonly storage: SaveStorage | null,
  ) {
    this.client = config ? new SupabaseClient(config) : null;
    this.stored = this.read();
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  get profile(): CloudProfile | null {
    if (!this.stored) return null;
    return {
      userId: this.stored.session.userId,
      email: this.stored.session.email,
      username: this.stored.username,
      emailConfirmed: this.stored.emailConfirmed,
    };
  }

  get sync(): Readonly<CloudSyncState> {
    return this.syncState;
  }

  /** A chave do save local desta conta; `null` quando não há ninguém entrado. */
  saveKey(): string | null {
    return this.stored ? `${CLOUD_SAVE_PREFIX}${this.stored.session.userId}` : null;
  }

  onChange(listener: (account: CloudAccount) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ------------------------------------------------------------------ entrar e sair

  async signUp(input: { username: string; email: string; password: string; confirmPassword?: string }): Promise<CloudResult<{ needsConfirmation: boolean }>> {
    if (!this.client) return fail("A conta na nuvem não está configurada nesta instalação.");
    const nameProblem = validateAccountName(input.username);
    if (nameProblem) return fail(nameProblem);
    const emailProblem = validateEmail(input.email);
    if (emailProblem) return fail(emailProblem);
    const passwordProblem = validateCloudPassword(input.password);
    if (passwordProblem) return fail(passwordProblem);
    if (input.confirmPassword !== undefined && input.confirmPassword !== input.password) return fail("As duas senhas precisam ser iguais.");

    const username = input.username.trim().replace(/\s+/g, " ");
    try {
      // Conferir antes é só gentileza: quem garante a unicidade é o índice do banco.
      if (!(await this.client.usernameAvailable(username))) return fail(`Já existe alguém chamado “${username}”. Escolha outro nome.`);
      const { session } = await this.client.signUp({
        email: input.email.trim(),
        password: input.password,
        username,
        redirectTo: redirectTarget(),
      });
      if (!session) return ok({ needsConfirmation: true });
      this.write({ session, username, emailConfirmed: true });
      return ok({ needsConfirmation: false });
    } catch (error) {
      return fail(messageOf(error));
    }
  }

  /** Entra por e-mail OU por nome de usuário — o jogador escolhe o que lembra. */
  async signIn(identifier: string, password: string): Promise<CloudResult<CloudProfile>> {
    if (!this.client) return fail("A conta na nuvem não está configurada nesta instalação.");
    const trimmed = identifier.trim();
    if (trimmed.length === 0 || password.length === 0) return fail("Preencha o usuário (ou e-mail) e a senha.");
    try {
      const email = trimmed.includes("@") ? trimmed : await this.client.emailForCredentials(trimmed, password);
      // `null` aqui é senha errada OU nome inexistente, de propósito: a resposta é a mesma para os
      // dois, então ninguém descobre quem tem conta só chutando apelidos.
      if (!email) return fail("Usuário ou senha não conferem.");
      const session = await this.client.signInWithEmail(email, password);
      const username = (await this.client.profileUsername(session.accessToken, session.userId)) ?? normalizeAccountName(trimmed);
      this.write({ session, username, emailConfirmed: true });
      return ok(this.profile!);
    } catch (error) {
      return fail(messageOf(error));
    }
  }

  async signOut(): Promise<void> {
    const token = this.stored?.session.accessToken;
    this.write(null);
    if (!this.client || !token) return;
    try {
      await this.client.signOut(token);
    } catch {
      // Sair do aparelho é o que importa e já aconteceu; o servidor expira o token sozinho.
    }
  }

  /** Manda o e-mail de troca de senha para o endereço cadastrado. */
  async requestPasswordReset(email: string): Promise<CloudResult> {
    if (!this.client) return fail("A conta na nuvem não está configurada nesta instalação.");
    const problem = validateEmail(email);
    if (problem) return fail(problem);
    try {
      await this.client.requestPasswordReset(email.trim(), redirectTarget());
      return ok(undefined);
    } catch (error) {
      return fail(messageOf(error));
    }
  }

  /** Troca a senha de quem já está logado (ou de quem chegou pelo link do e-mail). */
  async changePassword(next: string, confirm?: string): Promise<CloudResult> {
    if (!this.client) return fail("A conta na nuvem não está configurada nesta instalação.");
    const problem = validateCloudPassword(next);
    if (problem) return fail(problem);
    if (confirm !== undefined && confirm !== next) return fail("As duas senhas precisam ser iguais.");
    const token = await this.token();
    if (!token) return fail("Entre na conta antes de trocar a senha.");
    try {
      await this.client.updatePassword(token, next);
      return ok(undefined);
    } catch (error) {
      return fail(messageOf(error));
    }
  }

  /**
   * O link do e-mail volta para o jogo com os tokens no fragmento da URL (`#access_token=…`).
   * Adotar a sessão dali é o que faz "cliquei no link do e-mail" virar "estou dentro".
   *
   * Devolve o tipo do link (`recovery` = veio da troca de senha) para a tela saber o que abrir.
   */
  async adoptUrlSession(hash: string): Promise<{ type: string; profile: CloudProfile } | null> {
    if (!this.client || !hash.startsWith("#")) return null;
    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return null;
    const expiresIn = Number.parseInt(params.get("expires_in") ?? "3600", 10);
    try {
      const user = await this.client.getUser(accessToken);
      const session: SupabaseSession = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
        userId: user.id,
        email: user.email,
      };
      const username = (await this.client.profileUsername(accessToken, user.id)) ?? user.email;
      this.write({ session, username, emailConfirmed: user.emailConfirmedAt !== null });
      return { type: params.get("type") ?? "magiclink", profile: this.profile! };
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------ progresso

  /**
   * Puxa o save da nuvem. Devolve `null` quando a conta ainda não tem nada gravado lá — o caso de
   * quem acabou de criar a conta e vai subir o progresso do aparelho.
   */
  async pull(): Promise<CloudResult<{ document: unknown; updatedAt: string } | null>> {
    if (!this.client || !this.stored) return fail("Entre na conta para sincronizar.");
    const token = await this.token();
    if (!token) return fail("A sessão expirou. Entre de novo.");
    try {
      const row = await this.client.fetchSave(token, this.stored.session.userId);
      if (!row || !row.document || Object.keys(row.document as object).length === 0) return ok(null);
      this.setSync({ lastSyncAt: new Date().toISOString(), pending: false, error: null });
      return ok({ document: row.document, updatedAt: row.updatedAt });
    } catch (error) {
      const message = messageOf(error);
      this.setSync({ ...this.syncState, error: message });
      return fail(message);
    }
  }

  /**
   * Empurra o documento para a nuvem. Falhar aqui NUNCA pode quebrar o jogo: o save local já foi
   * gravado antes, e a falha vira só um aviso de "não sincronizado" na tela de conta.
   */
  async push(document: { saveVersion: number }): Promise<CloudResult> {
    if (!this.client || !this.stored) return fail("Entre na conta para sincronizar.");
    // Um empurrão de cada vez: dois em paralelo poderiam chegar fora de ordem.
    if (this.inFlight) await this.inFlight.catch(() => {});
    const token = await this.token();
    if (!token) return fail("A sessão expirou. Entre de novo.");
    this.setSync({ ...this.syncState, pending: true });
    const userId = this.stored.session.userId;
    const run = this.client
      .pushSave(token, userId, document, document.saveVersion)
      .then(() => {
        this.setSync({ lastSyncAt: new Date().toISOString(), pending: false, error: null });
      })
      .finally(() => {
        this.inFlight = null;
      });
    this.inFlight = run.then(
      () => undefined,
      () => undefined,
    );
    try {
      await run;
      return ok(undefined);
    } catch (error) {
      const message = messageOf(error);
      this.setSync({ lastSyncAt: this.syncState.lastSyncAt, pending: false, error: message });
      return fail(message);
    }
  }

  // ------------------------------------------------------------------ interno

  /** O token de acesso, renovado se estiver perto de vencer. `null` = precisa entrar de novo. */
  private async token(): Promise<string | null> {
    if (!this.client || !this.stored) return null;
    const { session } = this.stored;
    if (session.expiresAt - Date.now() > REFRESH_MARGIN_MS) return session.accessToken;
    try {
      const renewed = await this.client.refresh(session.refreshToken);
      this.write({ ...this.stored, session: renewed });
      return renewed.accessToken;
    } catch {
      // O refresh morreu (senha trocada em outro aparelho, sessão revogada): cai para deslogado.
      this.write(null);
      return null;
    }
  }

  private setSync(next: CloudSyncState): void {
    this.syncState = next;
    this.listeners.forEach((listener) => listener(this));
  }

  private read(): StoredSession | null {
    try {
      const raw = this.storage?.getItem(CLOUD_SESSION_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return null;
      const record = parsed as Partial<StoredSession>;
      const session = record.session;
      if (!session?.accessToken || !session.refreshToken || !session.userId) return null;
      return { session, username: String(record.username ?? session.email), emailConfirmed: record.emailConfirmed !== false };
    } catch {
      return null;
    }
  }

  private write(next: StoredSession | null): void {
    this.stored = next;
    try {
      if (next) this.storage?.setItem(CLOUD_SESSION_KEY, JSON.stringify(next));
      else this.storage?.removeItem?.(CLOUD_SESSION_KEY);
    } catch {
      // Sem armazenamento: a sessão vale só enquanto a aba estiver aberta.
    }
    this.listeners.forEach((listener) => listener(this));
  }
}

/** Para onde o link do e-mail volta: a própria página do jogo, sem query nem fragmento. */
function redirectTarget(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}
