/**
 * Cliente mínimo do Supabase, escrito à mão.
 *
 * Por que não o `@supabase/supabase-js`: este jogo tem UMA dependência de runtime (o Phaser) e usa
 * seis rotas HTTP do Supabase — cadastrar, entrar, renovar, ler o usuário, pedir troca de senha e
 * ler/gravar uma linha. O SDK traria WebSocket, storage, realtime e um punhado de polyfills para
 * isso. Aqui são ~150 linhas de `fetch` que dá para ler inteiras.
 *
 * O que ele NÃO faz, de propósito: guardar segredo nenhum. A chave publicável é pública por desenho
 * (o próprio Supabase a descreve como segura para expor numa página) — o que protege os dados é a
 * RLS do banco (`supabase/schema.sql`), não o sigilo da chave.
 */

export interface SupabaseConfig {
  url: string;
  /** A chave publicável (`sb_publishable_…`) ou, em projetos antigos, o JWT `anon`. */
  anonKey: string;
}

export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  /** Instante (ms) em que o `accessToken` expira. */
  expiresAt: number;
  userId: string;
  email: string;
}

export interface SupabaseUser {
  id: string;
  email: string;
  /** Data de confirmação do e-mail; `null` = ainda não confirmado. */
  emailConfirmedAt: string | null;
}

/** Erro previsto do Supabase, já com a mensagem pronta em português quando dá para traduzir. */
export class SupabaseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * Traduz o que o Supabase responde. As mensagens dele são em inglês e genéricas; estas dizem o que
 * o jogador tem que fazer a seguir, que é o único motivo de uma mensagem de erro existir.
 */
function translate(status: number, body: unknown): SupabaseError {
  const record = isRecord(body) ? body : {};
  const raw = String(record.error_description ?? record.msg ?? record.message ?? record.error ?? "");
  const code = typeof record.error_code === "string" ? record.error_code : typeof record.code === "string" ? record.code : null;
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials")) return new SupabaseError("E-mail, usuário ou senha não conferem.", status, code);
  if (lower.includes("email not confirmed")) return new SupabaseError("Confirme o e-mail que enviamos antes de entrar.", status, code);
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return new SupabaseError("Já existe uma conta com este e-mail.", status, code);
  }
  if (lower.includes("duplicate key") && lower.includes("username")) return new SupabaseError("Este nome de usuário já está em uso.", status, code);
  if (lower.includes("password should be")) return new SupabaseError("A senha é curta demais para o servidor: use pelo menos 6 caracteres.", status, code);
  if (lower.includes("rate limit") || status === 429) return new SupabaseError("Muitas tentativas seguidas. Espere um minuto e tente de novo.", status, code);
  if (raw.length > 0) return new SupabaseError(raw, status, code);
  return new SupabaseError(`O servidor respondeu ${status}.`, status, code);
}

export class SupabaseClient {
  constructor(private readonly config: SupabaseConfig) {}

  private async call(path: string, init: RequestInit & { token?: string | null }): Promise<unknown> {
    const { token, ...rest } = init;
    const response = await fetch(`${this.config.url}${path}`, {
      ...rest,
      headers: {
        apikey: this.config.anonKey,
        Authorization: `Bearer ${token ?? this.config.anonKey}`,
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
    });
    const text = await response.text();
    const body: unknown = text.length > 0 ? safeJson(text) : null;
    if (!response.ok) throw translate(response.status, body);
    return body;
  }

  // ------------------------------------------------------------------ autenticação

  /**
   * Cria a conta. O nome de usuário viaja nos metadados e o gatilho do banco o transforma em
   * perfil no mesmo instante — ver `handle_new_user` no esquema.
   *
   * Devolve `session: null` quando o projeto exige confirmação de e-mail (o padrão): a pessoa
   * precisa clicar no link antes de entrar.
   */
  async signUp(input: { email: string; password: string; username: string; redirectTo?: string }): Promise<{ session: SupabaseSession | null }> {
    const body = await this.call(`/auth/v1/signup${input.redirectTo ? `?redirect_to=${encodeURIComponent(input.redirectTo)}` : ""}`, {
      method: "POST",
      body: JSON.stringify({ email: input.email, password: input.password, data: { username: input.username } }),
    });
    return { session: sessionFrom(body) };
  }

  async signInWithEmail(email: string, password: string): Promise<SupabaseSession> {
    const body = await this.call("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const session = sessionFrom(body);
    if (!session) throw new SupabaseError("O servidor não devolveu uma sessão.", 500, null);
    return session;
  }

  /** Troca o par (usuário, senha) pelo e-mail correspondente. `null` = não confere. */
  async emailForCredentials(username: string, password: string): Promise<string | null> {
    const body = await this.call("/rest/v1/rpc/email_for_credentials", {
      method: "POST",
      body: JSON.stringify({ p_username: username, p_password: password }),
    });
    return typeof body === "string" && body.length > 0 ? body : null;
  }

  async usernameAvailable(username: string): Promise<boolean> {
    const body = await this.call("/rest/v1/rpc/username_available", {
      method: "POST",
      body: JSON.stringify({ p_username: username }),
    });
    return body === true;
  }

  async refresh(refreshToken: string): Promise<SupabaseSession> {
    const body = await this.call("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const session = sessionFrom(body);
    if (!session) throw new SupabaseError("Não foi possível renovar a sessão.", 401, null);
    return session;
  }

  async signOut(token: string): Promise<void> {
    await this.call("/auth/v1/logout", { method: "POST", token, body: "{}" });
  }

  /** Manda o e-mail de "esqueci a senha" para o endereço cadastrado. */
  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    await this.call(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  /** Define a senha nova. O token vem do link do e-mail (ou da sessão, para trocar logado). */
  async updatePassword(token: string, password: string): Promise<void> {
    await this.call("/auth/v1/user", { method: "PUT", token, body: JSON.stringify({ password }) });
  }

  async getUser(token: string): Promise<SupabaseUser> {
    const body = await this.call("/auth/v1/user", { method: "GET", token });
    const record = isRecord(body) ? body : {};
    return {
      id: String(record.id ?? ""),
      email: String(record.email ?? ""),
      emailConfirmedAt: typeof record.email_confirmed_at === "string" ? record.email_confirmed_at : null,
    };
  }

  // ------------------------------------------------------------------ dados

  async profileUsername(token: string, userId: string): Promise<string | null> {
    const body = await this.call(`/rest/v1/profiles?id=eq.${userId}&select=username`, { method: "GET", token });
    const rows = Array.isArray(body) ? body : [];
    const first = isRecord(rows[0]) ? rows[0] : null;
    return typeof first?.username === "string" ? first.username : null;
  }

  async setUsername(token: string, userId: string, username: string): Promise<void> {
    await this.call(`/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ username, updated_at: new Date().toISOString() }),
    });
  }

  async fetchSave(token: string, userId: string): Promise<{ document: unknown; updatedAt: string; revision: number } | null> {
    const body = await this.call(`/rest/v1/saves?user_id=eq.${userId}&select=document,updated_at,revision`, { method: "GET", token });
    const rows = Array.isArray(body) ? body : [];
    const first = isRecord(rows[0]) ? rows[0] : null;
    if (!first) return null;
    return {
      document: first.document,
      updatedAt: typeof first.updated_at === "string" ? first.updated_at : new Date(0).toISOString(),
      revision: typeof first.revision === "number" ? first.revision : 0,
    };
  }

  /** Grava o documento inteiro. `upsert` porque a linha pode não existir em contas antigas. */
  async pushSave(token: string, userId: string, document: unknown, saveVersion: number): Promise<void> {
    await this.call("/rest/v1/saves", {
      method: "POST",
      token,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: userId, document, save_version: saveVersion }),
    });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function sessionFrom(body: unknown): SupabaseSession | null {
  if (!isRecord(body)) return null;
  const accessToken = typeof body.access_token === "string" ? body.access_token : null;
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : null;
  if (!accessToken || !refreshToken) return null;
  const user = isRecord(body.user) ? body.user : {};
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    userId: String(user.id ?? ""),
    email: String(user.email ?? ""),
  };
}
