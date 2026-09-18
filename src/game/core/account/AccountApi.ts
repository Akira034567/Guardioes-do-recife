/**
 * O cliente da API de contas. Só fala HTTP: nenhuma regra mora aqui, porque quem decide é o
 * servidor — a tela pode validar antes para avisar cedo, mas quem barra nome repetido, senha errada
 * ou e-mail não confirmado é o banco, do outro lado.
 *
 * Toda falha vira o mesmo formato de resposta, inclusive "não consegui falar com o servidor". Assim
 * a tela tem UM caminho de erro para mostrar, em vez de um `try/catch` em cada botão.
 */

export interface ApiUser {
  id: number;
  email: string;
  name: string;
  verified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ApiSave {
  document: string;
  updatedAt: string;
}

export interface ApiFailure {
  ok: false;
  status: number;
  reason: string;
  message: string;
}

export type ApiResult<T> = ({ ok: true } & T) | ApiFailure;

export const OFFLINE: ApiFailure = {
  ok: false,
  status: 0,
  reason: "offline",
  message: "Não consegui falar com o servidor de contas. Confira sua internet — dá para seguir jogando como convidado.",
};

/**
 * Onde está a API.
 *
 * Em produção o mesmo servidor entrega o jogo e a API, então o caminho relativo resolve sozinho.
 * No `npm run dev` o jogo roda no Vite (5173) e a API ao lado (4000), e é isso que o segundo caso
 * cobre. `VITE_API_URL` manda em qualquer situação — é o que se usa quando a API mora noutro host.
 */
export function defaultApiUrl(): string {
  const configured = import.meta.env?.VITE_API_URL as string | undefined;
  if (configured) return configured.replace(/\/+$/, "");
  try {
    if (window.location.port === "5173") return "http://localhost:4000";
  } catch {
    // sem `window` (testes): caminho relativo
  }
  return "";
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class AccountApi {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;

  constructor(baseUrl: string = defaultApiUrl(), fetcher?: Fetcher) {
    this.baseUrl = baseUrl;
    this.fetcher = fetcher ?? ((input, init) => fetch(input, init));
  }

  register(email: string, name: string, password: string): Promise<ApiResult<{ user: ApiUser; mailer: string }>> {
    return this.send("POST", "/api/accounts", { body: { email, name, password } });
  }

  login(email: string, password: string): Promise<ApiResult<{ user: ApiUser; token: string; save: ApiSave | null }>> {
    return this.send("POST", "/api/sessions", { body: { email, password } });
  }

  logout(token: string): Promise<ApiResult<Record<string, never>>> {
    return this.send("DELETE", "/api/sessions", { token });
  }

  me(token: string): Promise<ApiResult<{ user: ApiUser; save: ApiSave | null }>> {
    return this.send("GET", "/api/me", { token });
  }

  resendVerification(email: string): Promise<ApiResult<{ message: string }>> {
    return this.send("POST", "/api/verify/resend", { body: { email } });
  }

  forgotPassword(email: string): Promise<ApiResult<{ message: string }>> {
    return this.send("POST", "/api/password/forgot", { body: { email } });
  }

  changePassword(token: string, current: string, next: string): Promise<ApiResult<Record<string, never>>> {
    return this.send("POST", "/api/password/change", { token, body: { current, next } });
  }

  deleteAccount(token: string, password: string): Promise<ApiResult<Record<string, never>>> {
    return this.send("DELETE", "/api/accounts", { token, body: { password } });
  }

  getSave(token: string): Promise<ApiResult<{ save: ApiSave | null }>> {
    return this.send("GET", "/api/save", { token });
  }

  putSave(token: string, document: string): Promise<ApiResult<{ save: ApiSave }>> {
    return this.send("PUT", "/api/save", { token, body: { document } });
  }

  health(): Promise<ApiResult<{ mailer: string }>> {
    return this.send("GET", "/api/health", {});
  }

  private async send<T>(method: string, path: string, options: { token?: string; body?: unknown }): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      return OFFLINE;
    }
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // resposta sem JSON (um proxy no caminho, por exemplo): vira erro genérico abaixo
    }
    if (typeof payload !== "object" || payload === null) {
      return { ok: false, status: response.status, reason: "server", message: "O servidor respondeu de um jeito que não entendi." };
    }
    const data = payload as Record<string, unknown>;
    if (response.ok && data.ok === true) return data as ApiResult<T>;
    return {
      ok: false,
      status: response.status,
      reason: typeof data.reason === "string" ? data.reason : "server",
      message: typeof data.message === "string" ? data.message : "Não consegui completar. Tente de novo.",
    };
  }
}
