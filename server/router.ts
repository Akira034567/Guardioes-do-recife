import type { AccountService } from "./accounts.ts";
import { toPublicUser } from "./accounts.ts";
import type { Mailer } from "./mailer.ts";
import { messagePage, resetFormPage } from "./pages.ts";

/**
 * A API, como função pura: pedido entra, resposta sai. Sem `node:http` aqui dentro — é o que deixa
 * os testes exercitarem TODA a API (inclusive os status HTTP) sem abrir porta nenhuma.
 */

export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  /** JSON ou formulário já decodificado; `null` quando não veio corpo. */
  body: Record<string, unknown> | null;
  /** Token da sessão, do cabeçalho `Authorization: Bearer …`. */
  token: string | null;
  /** Identificação grosseira de origem, só para segurar tentativa em série. */
  ip: string;
  /** O pedido veio de um formulário HTML (a página do e-mail) e espera HTML de volta. */
  form: boolean;
}

export interface ApiResponse {
  status: number;
  json?: unknown;
  html?: string;
  headers?: Record<string, string>;
}

export interface RouterOptions {
  /** Endereço do jogo, para o botão "voltar para o jogo" das páginas de e-mail. */
  gameUrl?: string | null;
  now?: () => number;
}

/** Janela fixa por IP e rota: barra a força bruta sem precisar de Redis nem de dependência nova. */
class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(limit: number, windowMs: number, now: () => number) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  take(key: string): boolean {
    const current = this.hits.get(key);
    const now = this.now();
    if (!current || current.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    current.count += 1;
    return current.count <= this.limit;
  }
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

export function createRouter(service: AccountService, mailer: Mailer, options: RouterOptions = {}) {
  const now = options.now ?? (() => Date.now());
  const gameUrl = options.gameUrl ?? process.env.GAME_URL ?? null;
  // 10 tentativas por minuto: o suficiente para errar a senha sem medo, pouco para varrer senhas.
  const attempts = new RateLimiter(10, 60_000, now);

  return async function route(request: ApiRequest): Promise<ApiResponse> {
    const { method, path } = request;
    const body = request.body ?? {};

    const limited = (bucket: string): ApiResponse | null =>
      attempts.take(`${bucket}:${request.ip}`)
        ? null
        : { status: 429, json: { ok: false, reason: "rate-limited", message: "Tentativas demais. Espere um minuto e tente de novo." } };

    const auth = () => service.authenticate(request.token);
    const unauthorized: ApiResponse = {
      status: 401,
      json: { ok: false, reason: "no-session", message: "Sua sessão expirou. Entre de novo." },
    };

    if (method === "GET" && path === "/api/health") {
      return { status: 200, json: { ok: true, mailer: mailer.kind } };
    }

    // ------------------------------------------------------------------------------ cadastro

    if (method === "POST" && path === "/api/accounts") {
      const blocked = limited("register");
      if (blocked) return blocked;
      const result = await service.register({ email: text(body.email), name: text(body.name), password: text(body.password) });
      if (!result.ok) return { status: result.status, json: result };
      return { status: 201, json: { ok: true, user: result.user, mailer: mailer.kind } };
    }

    if (method === "DELETE" && path === "/api/accounts") {
      const user = auth();
      if (!user) return unauthorized;
      const result = service.deleteAccount(user.id, text(body.password));
      return { status: result.ok ? 200 : result.status, json: result };
    }

    // -------------------------------------------------------------------------- confirmação

    // O link do e-mail é um GET: quem abre é o navegador, e o que ele mostra é uma página.
    if (method === "GET" && path === "/api/verify") {
      const result = service.verify(request.query.get("token") ?? "");
      return result.ok
        ? { status: 200, html: messagePage("Conta confirmada!", `Tudo certo, ${result.user.name}. Agora é só entrar no jogo com o seu e-mail e a sua senha.`, "ok", gameUrl) }
        : { status: result.status, html: messagePage("Link inválido", result.message, "erro", gameUrl) };
    }

    if (method === "POST" && path === "/api/verify") {
      const result = service.verify(text(body.token));
      return { status: result.ok ? 200 : result.status, json: result };
    }

    if (method === "POST" && path === "/api/verify/resend") {
      const blocked = limited("resend");
      if (blocked) return blocked;
      await service.resendVerification(text(body.email));
      // Resposta igual exista ou não a conta: senão isto vira um jeito de descobrir quem tem cadastro.
      return { status: 200, json: { ok: true, message: "Se essa conta existir e ainda não estiver confirmada, a mensagem já está a caminho." } };
    }

    // -------------------------------------------------------------------------- entrar e sair

    if (method === "POST" && path === "/api/sessions") {
      const blocked = limited("login");
      if (blocked) return blocked;
      const result = await service.login(text(body.email), text(body.password));
      return { status: result.ok ? 200 : result.status, json: result };
    }

    if (method === "DELETE" && path === "/api/sessions") {
      if (request.token) service.logout(request.token);
      return { status: 200, json: { ok: true } };
    }

    if (method === "GET" && path === "/api/me") {
      const user = auth();
      if (!user) return unauthorized;
      return { status: 200, json: { ok: true, user: toPublicUser(user), save: service.getSave(user.id) } };
    }

    // --------------------------------------------------------------------------------- senha

    if (method === "POST" && path === "/api/password/change") {
      const user = auth();
      if (!user) return unauthorized;
      const result = service.changePassword(user.id, text(body.current), text(body.next));
      return { status: result.ok ? 200 : result.status, json: result };
    }

    if (method === "POST" && path === "/api/password/forgot") {
      const blocked = limited("forgot");
      if (blocked) return blocked;
      await service.forgotPassword(text(body.email));
      return { status: 200, json: { ok: true, message: "Se existir uma conta com esse e-mail, o link para trocar a senha já está a caminho." } };
    }

    if (method === "GET" && path === "/api/password/reset") {
      return { status: 200, html: resetFormPage(request.query.get("token") ?? "", null) };
    }

    if (method === "POST" && path === "/api/password/reset") {
      const token = text(body.token);
      const password = text(body.password);
      // Veio do formulário da página: a resposta também é página, não JSON.
      if (request.form) {
        if (password !== text(body.confirm)) return { status: 400, html: resetFormPage(token, "As duas senhas precisam ser iguais.") };
        const result = service.resetPassword(token, password);
        return result.ok
          ? { status: 200, html: messagePage("Senha trocada!", `Pronto, ${result.user.name}. Entre no jogo com a senha nova.`, "ok", gameUrl) }
          : { status: result.status, html: result.reason === "invalid" ? resetFormPage(token, result.message) : messagePage("Link inválido", result.message, "erro", gameUrl) };
      }
      const result = service.resetPassword(token, password);
      return { status: result.ok ? 200 : result.status, json: result };
    }

    // ---------------------------------------------------------------------------------- save

    if (method === "GET" && path === "/api/save") {
      const user = auth();
      if (!user) return unauthorized;
      return { status: 200, json: { ok: true, save: service.getSave(user.id) } };
    }

    if (method === "PUT" && path === "/api/save") {
      const user = auth();
      if (!user) return unauthorized;
      const document = body.document;
      if (typeof document !== "string" || document.length === 0) {
        return { status: 400, json: { ok: false, reason: "invalid", message: "Save vazio." } };
      }
      // Teto generoso, mas teto: o save do jogo é pequeno, e ninguém usa a conta como disco.
      if (document.length > 512_000) {
        return { status: 413, json: { ok: false, reason: "too-large", message: "Esse save é grande demais." } };
      }
      return { status: 200, json: { ok: true, save: service.putSave(user.id, document) } };
    }

    return { status: 404, json: { ok: false, reason: "not-found", message: "Endereço não existe nesta API." } };
  };
}
