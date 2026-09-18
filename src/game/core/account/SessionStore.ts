import { SAVE_KEY, type SaveStorage } from "../save/SaveManager";
import type { ApiUser } from "./AccountApi";

/**
 * Quem está logado NESTE aparelho.
 *
 * O dono das contas é o servidor; aqui fica só o crachá: o token da sessão e o retrato do usuário
 * que veio junto. É o bastante para o jogo abrir já logado, sem esperar resposta de rede, e para
 * saber QUAL save abrir enquanto a sincronização não chega.
 *
 * O save de cada conta tem a sua chave (`guardioes-do-recife.save:u<id>`), e quem joga sem entrar
 * continua no save do aparelho — assim sair da conta nunca apaga o que já foi jogado.
 */

export const SESSION_KEY = "guardioes-do-recife.session";

export interface StoredSession {
  token: string;
  user: ApiUser;
}

function isUser(value: unknown): value is ApiUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === "number" && typeof user.email === "string" && typeof user.name === "string";
}

export class SessionStore {
  private session: StoredSession | null;
  private readonly storage: SaveStorage | null;
  private readonly key: string;
  private readonly listeners = new Set<(session: StoredSession | null) => void>();

  constructor(storage: SaveStorage | null, key: string = SESSION_KEY) {
    this.storage = storage;
    this.key = key;
    this.session = this.load();
  }

  get current(): StoredSession | null {
    return this.session;
  }

  get token(): string | null {
    return this.session?.token ?? null;
  }

  get user(): ApiUser | null {
    return this.session?.user ?? null;
  }

  /** A chave de save da sessão atual; sem sessão, o save do aparelho (modo convidado). */
  saveKey(): string {
    return this.session ? `${SAVE_KEY}:u${this.session.user.id}` : SAVE_KEY;
  }

  set(session: StoredSession): void {
    this.session = session;
    this.write();
  }

  /** Atualiza o retrato do usuário sem mexer no token (depois de confirmar o e-mail, por exemplo). */
  updateUser(user: ApiUser): void {
    if (!this.session) return;
    this.session = { token: this.session.token, user };
    this.write();
  }

  clear(): void {
    this.session = null;
    this.write();
  }

  onChange(listener: (session: StoredSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private load(): StoredSession | null {
    let raw: string | null = null;
    try {
      raw = this.storage?.getItem(this.key) ?? null;
    } catch {
      return null;
    }
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return null;
      const entry = parsed as Record<string, unknown>;
      if (typeof entry.token !== "string" || !isUser(entry.user)) return null;
      return { token: entry.token, user: entry.user };
    } catch {
      return null;
    }
  }

  private write(): void {
    try {
      if (this.session) this.storage?.setItem(this.key, JSON.stringify(this.session));
      else this.storage?.removeItem?.(this.key);
    } catch {
      // Aba anônima ou cota cheia: a sessão vale enquanto a página estiver aberta.
    }
    this.listeners.forEach((listener) => listener(this.session));
  }
}
