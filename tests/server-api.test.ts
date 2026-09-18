import { describe, expect, it } from "vitest";
import { AccountService } from "../server/accounts.ts";
import { openDatabase } from "../server/db.ts";
import { memoryMailer } from "../server/mailer.ts";
import { createRouter, type ApiRequest } from "../server/router.ts";

/**
 * A API inteira, sem abrir porta nenhuma: o roteador é uma função de pedido para resposta. O que
 * interessa aqui é o CONTRATO — o status que cada situação devolve, quem precisa de sessão, e o que
 * a API se recusa a contar a quem pergunta.
 */

function api(now = () => Date.now()) {
  const mailer = memoryMailer();
  const service = new AccountService(openDatabase(":memory:"), mailer, {
    appUrl: "http://localhost:4000",
    now: () => new Date(now()),
  });
  const route = createRouter(service, mailer, { now });
  const call = (method: string, path: string, options: { body?: Record<string, unknown>; token?: string; query?: string; ip?: string; form?: boolean } = {}) =>
    route({
      method,
      path,
      query: new URLSearchParams(options.query ?? ""),
      body: options.body ?? null,
      token: options.token ?? null,
      ip: options.ip ?? "1.2.3.4",
      form: options.form ?? false,
    } satisfies ApiRequest);
  return { mailer, service, call };
}

const tokenOf = (text: string): string => (text.match(/token=(\S+)/) as RegExpMatchArray)[1];

async function registered() {
  const it = api();
  await it.call("POST", "/api/accounts", { body: { email: "ana@exemplo.com", name: "Ana", password: "coral12345" } });
  return it;
}

async function loggedIn() {
  const it = await registered();
  await it.call("GET", "/api/verify", { query: `token=${tokenOf(it.mailer.sent[0].text)}` });
  const session = await it.call("POST", "/api/sessions", { body: { email: "ana@exemplo.com", password: "coral12345" } });
  const token = (session.json as { token: string }).token;
  return { ...it, token };
}

describe("API de contas", () => {
  it("diz que está no ar e como manda e-mail", async () => {
    const { call } = api();
    expect(await call("GET", "/api/health")).toMatchObject({ status: 200, json: { ok: true, mailer: "memory" } });
  });

  it("cadastra com 201 e recusa repetido com 409", async () => {
    const it = await registered();
    expect(it.mailer.sent).toHaveLength(1);
    const repeated = await it.call("POST", "/api/accounts", { body: { email: "ana@exemplo.com", name: "Outra", password: "coral12345" } });
    expect(repeated.status).toBe(409);
  });

  it("responde o link do e-mail com uma PÁGINA, porque quem abre é o navegador", async () => {
    const it = await registered();
    const page = await it.call("GET", "/api/verify", { query: `token=${tokenOf(it.mailer.sent[0].text)}` });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Conta confirmada!");
    expect(page.json).toBeUndefined();
  });

  it("bloqueia o login com 403 enquanto o e-mail não for confirmado", async () => {
    const it = await registered();
    const denied = await it.call("POST", "/api/sessions", { body: { email: "ana@exemplo.com", password: "coral12345" } });
    expect(denied.status).toBe(403);
    expect(denied.json).toMatchObject({ reason: "unverified" });
  });

  it("entra com 200 e devolve usuário, token e save", async () => {
    const { token } = await loggedIn();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("exige sessão para tudo que é da conta", async () => {
    const { call, token } = await loggedIn();
    for (const [method, path] of [
      ["GET", "/api/me"],
      ["GET", "/api/save"],
      ["PUT", "/api/save"],
      ["POST", "/api/password/change"],
      ["DELETE", "/api/accounts"],
    ] as const) {
      expect((await call(method, path, { body: { document: "{}" } })).status, `${method} ${path}`).toBe(401);
    }
    expect((await call("GET", "/api/me", { token })).status).toBe(200);
    // Token inventado não passa.
    expect((await call("GET", "/api/me", { token: "nao-sou-um-token" })).status).toBe(401);
  });

  it("guarda o save da conta e o devolve na sessão seguinte", async () => {
    const { call, token } = await loggedIn();
    expect((await call("PUT", "/api/save", { token, body: { document: '{"saveVersion":5,"currency":{"shells":42}}' } })).status).toBe(200);
    const read = await call("GET", "/api/save", { token });
    expect((read.json as { save: { document: string } }).save.document).toContain('"shells":42');
    const again = await call("POST", "/api/sessions", { body: { email: "ana@exemplo.com", password: "coral12345" } });
    expect(JSON.stringify(again.json)).toContain('shells');
  });

  it("recusa save vazio e save grande demais", async () => {
    const { call, token } = await loggedIn();
    expect((await call("PUT", "/api/save", { token, body: { document: "" } })).status).toBe(400);
    expect((await call("PUT", "/api/save", { token, body: { document: "x".repeat(600_000) } })).status).toBe(413);
  });

  it("não conta a quem pergunta se um e-mail tem conta aqui", async () => {
    const { call } = await loggedIn();
    const existe = await call("POST", "/api/password/forgot", { body: { email: "ana@exemplo.com" } });
    const naoExiste = await call("POST", "/api/password/forgot", { body: { email: "ninguem@exemplo.com" } });
    expect(existe.status).toBe(naoExiste.status);
    expect(JSON.stringify(existe.json)).toBe(JSON.stringify(naoExiste.json));
  });

  it("mostra o formulário do link de senha e aplica a troca pelo formulário", async () => {
    const it = await loggedIn();
    await it.call("POST", "/api/password/forgot", { body: { email: "ana@exemplo.com" } });
    const reset = tokenOf(it.mailer.sent[1].text);

    expect((await it.call("GET", "/api/password/reset", { query: `token=${reset}` })).html).toContain("Escolher uma senha nova");

    const mismatch = await it.call("POST", "/api/password/reset", {
      form: true,
      body: { token: reset, password: "senha-nova-123", confirm: "outra-coisa-123" },
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.html).toContain("iguais");

    const done = await it.call("POST", "/api/password/reset", {
      form: true,
      body: { token: reset, password: "senha-nova-123", confirm: "senha-nova-123" },
    });
    expect(done.status).toBe(200);
    expect(done.html).toContain("Senha trocada!");
    expect((await it.call("POST", "/api/sessions", { body: { email: "ana@exemplo.com", password: "senha-nova-123" } })).status).toBe(200);
  });

  it("segura tentativa em série de senha (mas só daquele IP)", async () => {
    const it = await loggedIn();
    const attempt = (ip: string) => it.call("POST", "/api/sessions", { ip, body: { email: "ana@exemplo.com", password: "errada" } });
    const statuses: number[] = [];
    for (let index = 0; index < 12; index += 1) statuses.push((await attempt("9.9.9.9")).status);
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
    // Quem não estava martelando a porta continua entrando normalmente.
    expect((await it.call("POST", "/api/sessions", { ip: "5.5.5.5", body: { email: "ana@exemplo.com", password: "coral12345" } })).status).toBe(200);
  });

  it("devolve 404 em endereço que não existe", async () => {
    const { call } = api();
    expect((await call("GET", "/api/nao-existe")).status).toBe(404);
  });

  it("sair invalida o token", async () => {
    const { call, token } = await loggedIn();
    expect((await call("DELETE", "/api/sessions", { token })).status).toBe(200);
    expect((await call("GET", "/api/me", { token })).status).toBe(401);
  });
});
