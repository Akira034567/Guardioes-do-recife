import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { AccountService } from "./accounts.ts";
import { openDatabase, defaultDatabasePath } from "./db.ts";
import { createMailer } from "./mailer.ts";
import { createRouter, type ApiRequest } from "./router.ts";

/**
 * O servidor de contas — e, de quebra, do jogo.
 *
 * Se existir uma pasta `dist/` (o `npm run build`), ele também entrega o jogo. Assim o endereço é um
 * só: nada de CORS, nada de configurar API em lugar nenhum, e publicar é subir UM processo. A API
 * continua atendendo qualquer origem para o caso de o jogo estar hospedado à parte (GitHub Pages).
 */

const PORT = Number.parseInt(process.env.PORT ?? "4000", 10);
const HOST = process.env.HOST ?? "127.0.0.1";
const STATIC_ROOT = resolve(process.env.GR_STATIC ?? "dist");
const MAX_BODY = 1_000_000;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".woff2": "font/woff2",
};

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
      // Corta antes de encher a memória: nenhum pedido legítimo desta API chega perto disso.
      if (raw.length > MAX_BODY) {
        reject(new Error("corpo grande demais"));
        request.destroy();
      }
    });
    request.on("end", () => resolvePromise(raw));
    request.on("error", reject);
  });
}

function parseBody(raw: string, contentType: string): { body: Record<string, unknown> | null; form: boolean } {
  if (raw.length === 0) return { body: null, form: false };
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return { body: Object.fromEntries(new URLSearchParams(raw)), form: true };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return { body: parsed as Record<string, unknown>, form: false };
    }
  } catch {
    // corpo inválido vira "sem corpo": a rota responde o erro de validação que ela já sabe dar
  }
  return { body: null, form: false };
}

function bearer(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** Arquivo do jogo, quando o caminho existir dentro de `dist/` (e nunca fora dela). */
function staticFile(pathname: string): string | null {
  if (!existsSync(STATIC_ROOT)) return null;
  const relative = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(STATIC_ROOT, relative === "/" || relative === "\\" ? "index.html" : relative);
  if (!candidate.startsWith(STATIC_ROOT)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const asIndex = join(candidate, "index.html");
  if (existsSync(asIndex) && statSync(asIndex).isFile()) return asIndex;
  return null;
}

const db = openDatabase();
const mailer = createMailer();
const service = new AccountService(db, mailer);
const route = createRouter(service, mailer);
// Sessão e link vencidos saem de hora em hora; `unref` deixa o processo morrer sem esperar o timer.
setInterval(() => service.purgeExpired(), 3600_000).unref();

const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const cors = {
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  if (request.method === "OPTIONS") {
    response.writeHead(204, cors);
    response.end();
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    let raw = "";
    try {
      raw = await readBody(request);
    } catch {
      response.writeHead(413, { ...cors, "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, reason: "too-large", message: "Pedido grande demais." }));
      return;
    }
    const { body, form } = parseBody(raw, request.headers["content-type"] ?? "");
    const apiRequest: ApiRequest = {
      method: request.method ?? "GET",
      path: url.pathname,
      query: url.searchParams,
      body,
      form,
      token: bearer(request),
      // Atrás de proxy (Render, Fly, nginx) o IP real vem no cabeçalho; sem proxy, vem do socket.
      ip: (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ?? request.socket.remoteAddress ?? "desconhecido",
    };
    let result;
    try {
      result = await route(apiRequest);
    } catch (error) {
      console.error("[api] erro não tratado", error);
      result = { status: 500, json: { ok: false, reason: "server", message: "Deu ruim aqui do lado. Tente de novo." } };
    }
    const headers = { ...cors, ...(result.headers ?? {}) };
    if (result.html !== undefined) {
      response.writeHead(result.status, { ...headers, "Content-Type": "text/html; charset=utf-8" });
      response.end(result.html);
      return;
    }
    response.writeHead(result.status, { ...headers, "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(result.json ?? {}));
    return;
  }

  const file = staticFile(url.pathname);
  if (file) {
    response.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(existsSync(STATIC_ROOT) ? "Não encontrado." : "Servidor de contas no ar. Rode `npm run build` para ele servir o jogo também.");
});

server.listen(PORT, HOST, () => {
  console.log(`[servidor] contas e jogo em http://${HOST}:${PORT}`);
  console.log(`[servidor] banco: ${defaultDatabasePath()}`);
  console.log(
    mailer.kind === "smtp"
      ? `[servidor] e-mail: SMTP em ${process.env.SMTP_HOST}`
      : "[servidor] e-mail: sem SMTP configurado — as mensagens são gravadas em data/mail/ e o link sai aqui no terminal",
  );
  if (!existsSync(STATIC_ROOT)) console.log("[servidor] dist/ não existe ainda: rode `npm run build` para servir o jogo por aqui");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    db.close();
    process.exit(0);
  });
}
